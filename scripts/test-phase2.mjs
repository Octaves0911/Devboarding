// DevBoarding - Phase 2 permission tests
// Run from repo root while the server is running: node scripts/test-phase2.mjs
const BASE = process.env.BASE || 'http://localhost:5001/api';
const ADMIN = { email: 'admin@devboarding.com', password: '123456' };
const PW = 'Test@1234';
const ts = Date.now();
let pass = 0, fail = 0;

async function req(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, res };
}

async function login(email, password) {
  const r = await req('POST', '/login', null, { email, password });
  if (r.status >= 400) throw new Error(`Login failed for ${email}: ${r.status} ${JSON.stringify(r.data)}`);
  return r.res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}

const ok = s => s >= 200 && s < 300;
const denied = s => s === 403 || s === 404;
const clientErr = s => s >= 400 && s < 500;
const unwrap = (d, key) => d?.[key] ?? d;
const list = (d, key) => (Array.isArray(d) ? d : d?.[key] ?? []);

function check(name, cond, r) {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  -> ${r?.status} ${JSON.stringify(r?.data)}`); }
}

async function createUser(admin, role, slug, extra = {}) {
  const r = await req('POST', '/users', admin, {
    name: slug, email: `${slug}${ts}@test.com`, password: PW, role, ...extra,
  });
  if (!ok(r.status)) throw new Error(`Create ${role} failed: ${r.status} ${JSON.stringify(r.data)}`);
  return unwrap(r.data, 'user');
}

async function main() {
  const due = new Date(Date.now() + 7 * 864e5).toISOString();
  const admin = await login(ADMIN.email, ADMIN.password);
  const hr = await createUser(admin, 'HR', 'hr');
  const m1 = await createUser(admin, 'MENTOR', 'mentorone');
  const m2 = await createUser(admin, 'MENTOR', 'mentortwo');
  const e1 = await createUser(admin, 'MENTEE', 'menteeone', { mentorId: m1.id });
  const e2 = await createUser(admin, 'MENTEE', 'menteetwo', { mentorId: m2.id });
  console.log('Setup OK: created 5 test users\n');
  const [cHr, cM1, cE1, cE2] = await Promise.all([hr, m1, e1, e2].map(u => login(u.email, PW)));

  const task = (assigneeId, title) => ({
    title, description: 'Permission test task', priority: 'MEDIUM', dueDate: due,
    assigneeId, subtasks: [{ title: 'Subtask A' }],
  });

  let r;
  // Task creation rules
  r = await req('POST', '/tasks', admin, task(e1.id, 'Admin task'));
  check('Admin cannot create task', r.status === 403, r);
  r = await req('POST', '/tasks', cE1, task(e1.id, 'Mentee task'));
  check('Mentee cannot create task', r.status === 403, r);
  r = await req('POST', '/tasks', cM1, task(e2.id, 'Wrong mentee'));
  check("Mentor cannot assign to another mentor's mentee", r.status === 403, r);
  r = await req('POST', '/tasks', cM1, task(e1.id, 'Mentor task'));
  check('Mentor can assign to own mentee', ok(r.status), r);
  const t1 = unwrap(r.data, 'task');
  r = await req('POST', '/tasks', cHr, task(m1.id, 'HR task'));
  check('HR can assign to a mentor', ok(r.status), r);

  // Visibility rules
  r = await req('GET', '/users', cM1);
  const ids = list(r.data, 'users').map(u => u.id);
  check('Mentor user list shows only own mentee', ids.includes(e1.id) && !ids.includes(e2.id) && !ids.includes(hr.id), r);
  r = await req('GET', `/users/${e2.id}`, cM1);
  check("Mentor cannot view another mentor's mentee", denied(r.status), r);
  r = await req('GET', `/tasks/${t1?.id}`, cE2);
  check("Mentee cannot view another mentee's task", denied(r.status), r);

  // Creator vs assignee rules
  r = await req('PATCH', `/tasks/${t1?.id}/status`, cM1, { status: 'DONE' });
  check('Creator (non-assignee) cannot change status', r.status === 403, r);
  r = await req('PUT', `/tasks/${t1?.id}`, cE1, { title: 'Hacked' });
  check('Assignee cannot edit task', r.status === 403, r);
  r = await req('PATCH', `/tasks/${t1?.id}/status`, cE1, { status: 'DONE' });
  check('Cannot jump TODO -> DONE', clientErr(r.status), r);
  r = await req('PATCH', `/tasks/${t1?.id}/status`, cE1, { status: 'IN_PROGRESS' });
  check('Assignee can move TODO -> IN_PROGRESS', ok(r.status), r);
  r = await req('PATCH', `/tasks/${t1?.id}/status`, cE1, { status: 'DONE' });
  check('Cannot mark DONE with open subtasks', clientErr(r.status) && /subtask/i.test(JSON.stringify(r.data)), r);

  // Subtasks
  r = await req('GET', `/tasks/${t1?.id}`, cE1);
  const sub = unwrap(r.data, 'task')?.subtasks?.[0];
  r = await req('PATCH', `/subtasks/${sub?.id}/toggle`, cM1);
  check('Non-assignee cannot tick subtask', r.status === 403, r);
  r = await req('PATCH', `/subtasks/${sub?.id}/toggle`, cE1);
  check('Assignee can tick subtask', ok(r.status), r);
  r = await req('PATCH', `/tasks/${t1?.id}/status`, cE1, { status: 'DONE' });
  check('Assignee can mark DONE after subtasks done', ok(r.status), r);

  // User management rules
  r = await req('DELETE', `/users/${m1.id}`, admin);
  check('Cannot delete mentor with mentees', clientErr(r.status), r);
  r = await req('PATCH', `/users/${m1.id}/status`, admin, { isActive: false });
  check('Cannot deactivate mentor with mentees', clientErr(r.status), r);
  r = await req('PATCH', `/users/${e2.id}/status`, admin, { isActive: false });
  check('Admin can deactivate mentee', ok(r.status), r);
  r = await req('GET', '/me', cE2);
  check('Deactivated user session stops working', r.status === 401 || r.status === 403, r);
  r = await req('POST', '/login', null, { email: ADMIN.email, password: 'wrong' });
  check('Wrong password rejected', r.status === 400 || r.status === 401, r);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

try { await main(); } catch (e) { console.error('SETUP ERROR:', e.message); process.exit(1); }
