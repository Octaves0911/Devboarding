require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const PASSWORD = '123456';

function atDays(offsetDays, hours = 10, minutes = 0) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function nextWeekday(weekday, hours, minutes) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  let delta = (weekday - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= Date.now()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

const PEOPLE = [
  { key: 'kavya', name: 'Kavya Menon', email: 'admin@devboarding.com', role: 'ADMIN', phone: '+91 9811022001', department: 'People Operations', designation: 'Platform Administrator', joiningDate: atDays(-640) },
  { key: 'rahul', name: 'Rahul Mehta', email: 'rahul.mehta@devboarding.com', role: 'HR', phone: '+91 9820033412', department: 'Human Resources', designation: 'HR Business Partner', joiningDate: atDays(-510) },
  { key: 'neha', name: 'Neha Singh', email: 'neha.singh@devboarding.com', role: 'HR', phone: '+91 9900188274', department: 'Human Resources', designation: 'Onboarding Specialist', joiningDate: atDays(-280) },
  { key: 'arjun', name: 'Arjun Kapoor', email: 'arjun.kapoor@devboarding.com', role: 'MENTOR', phone: '+91 9845011290', department: 'Engineering', designation: 'Senior Backend Engineer', joiningDate: atDays(-420) },
  { key: 'priya', name: 'Priya Nair', email: 'priya.nair@devboarding.com', role: 'MENTOR', phone: '+91 9886022145', department: 'Engineering', designation: 'Frontend Tech Lead', joiningDate: atDays(-390) },
  { key: 'vikram', name: 'Vikram Iyer', email: 'vikram.iyer@devboarding.com', role: 'MENTOR', phone: '+91 9731554408', department: 'Product', designation: 'Product Engineer', joiningDate: atDays(-310) },
  { key: 'aisha', name: 'Aisha Khan', email: 'aisha.khan@devboarding.com', role: 'MENTEE', phone: '+91 9765432108', department: 'Engineering', designation: 'Backend Engineer', joiningDate: atDays(-20), mentor: 'arjun' },
  { key: 'dev', name: 'Dev Patel', email: 'dev.patel@devboarding.com', role: 'MENTEE', phone: '+91 9812347781', department: 'Engineering', designation: 'Backend Engineer', joiningDate: atDays(-12), mentor: 'arjun' },
  { key: 'kabir', name: 'Kabir Shah', email: 'kabir.shah@devboarding.com', role: 'MENTEE', phone: '+91 9922001844', department: 'Engineering', designation: 'Backend Engineer', joiningDate: atDays(-4), mentor: 'arjun' },
  { key: 'sana', name: 'Sana Reddy', email: 'sana.reddy@devboarding.com', role: 'MENTEE', phone: '+91 9700456123', department: 'Engineering', designation: 'Frontend Engineer', joiningDate: atDays(-24), mentor: 'priya' },
  { key: 'rohan', name: 'Rohan Das', email: 'rohan.das@devboarding.com', role: 'MENTEE', phone: '+91 9833012290', department: 'Engineering', designation: 'Frontend Engineer', joiningDate: atDays(-6), mentor: 'priya' },
  { key: 'meera', name: 'Meera Joshi', email: 'meera.joshi@devboarding.com', role: 'MENTEE', phone: '+91 9898981120', department: 'Product', designation: 'Associate Product Manager', joiningDate: atDays(-16), mentor: 'vikram' },
  { key: 'ishaan', name: 'Ishaan Verma', email: 'ishaan.verma@devboarding.com', role: 'MENTEE', phone: '+91 9810093345', department: 'Product', designation: 'Associate Product Manager', joiningDate: atDays(-9), mentor: 'vikram' },
];

const ONBOARDING_SUBTASKS = [
  'Confirm joining details with the People team',
  'Finish the information security module',
  'Join #engineering and #new-hires on Slack',
  'Book your first 1:1 with your mentor',
];

function onboarding(assignee, doneCount, status, dueOffset, createdDaysAgo) {
  return {
    title: 'Complete your first-week onboarding',
    description: 'People team checklist for your first week. Finish each item before your mentor intro so your accounts, access, and first 1:1 are in place.',
    priority: 'HIGH',
    dueDate: atDays(dueOffset, 18),
    status,
    createdBy: 'neha',
    assignee,
    createdDaysAgo,
    completedAt: status === 'DONE' ? atDays(-2, 16) : null,
    completionNote: status === 'DONE' ? 'All first-week items closed. Laptop, Slack, and mentor 1:1 are set.' : null,
    notify: status !== 'DONE',
    subtasks: ONBOARDING_SUBTASKS.map((title, i) => ({ title, isDone: i < doneCount })),
  };
}

const TASKS = [
  onboarding('aisha', 4, 'DONE', -6, 19),
  onboarding('dev', 4, 'DONE', -1, 11),
  onboarding('sana', 4, 'DONE', -8, 22),
  onboarding('meera', 4, 'DONE', -3, 15),
  onboarding('rohan', 2, 'IN_PROGRESS', 2, 5),
  onboarding('ishaan', 2, 'IN_PROGRESS', 3, 8),
  onboarding('kabir', 1, 'IN_PROGRESS', 4, 3),

  {
    title: 'Set up the billing service locally',
    description: 'Get the billing service running on your machine and confirm the test suite is green before you pick up a ticket.\n\nResources\n- Billing service README: https://github.com/nodejs/node/blob/main/README.md\n- Node.js LTS downloads: https://nodejs.org/en/download',
    priority: 'HIGH',
    dueDate: atDays(-8, 18),
    status: 'DONE',
    createdBy: 'arjun',
    assignee: 'aisha',
    createdDaysAgo: 18,
    completedAt: atDays(-9, 17),
    completionNote: 'Service boots with the local seed data. Full test suite passed on Node 20.',
    subtasks: [
      { title: 'Install Node 20 and run npm ci', isDone: true },
      { title: 'Copy .env.example and point it at the local database', isDone: true },
      { title: 'Run the billing test suite and paste the result in the 1:1 notes', isDone: true },
    ],
  },
  {
    title: 'Fix GST rounding on invoice line items',
    description: 'Invoices for amounts ending in 0.005 are off by one paise after tax. Reproduce it on a sample September invoice, add a regression test, and open a pull request against main.\n\nThe expected behaviour is half-up rounding to two decimal places before tax is applied, matching the finance spec from August.',
    priority: 'HIGH',
    dueDate: atDays(2, 18),
    status: 'IN_PROGRESS',
    createdBy: 'arjun',
    assignee: 'aisha',
    createdDaysAgo: 5,
    notify: true,
    subtasks: [
      { title: 'Reproduce the off-by-one paise case with a fixture invoice', isDone: true },
      { title: 'Add a regression test for half-up rounding', isDone: true },
      { title: 'Open a pull request and request review from Arjun', isDone: false },
    ],
  },
  {
    title: 'Shadow Thursday on-call handover',
    description: 'Sit with Arjun for the Thursday handover. Note how alerts are triaged, which runbook to open first, and when to page finance.',
    priority: 'MEDIUM',
    dueDate: atDays(5, 18),
    status: 'TODO',
    createdBy: 'arjun',
    assignee: 'aisha',
    createdDaysAgo: 1,
    notify: true,
    subtasks: [
      { title: 'Read the billing on-call runbook', isDone: false },
      { title: 'Attend the handover and write three notes in the task', isDone: false },
    ],
  },
  {
    title: 'Walk through the orders API',
    description: 'Read the orders create and cancel handlers. Trace one successful create and one validation failure in the logs, then summarise the flow in a short note for your mentor.',
    priority: 'MEDIUM',
    dueDate: atDays(4, 18),
    status: 'IN_PROGRESS',
    createdBy: 'arjun',
    assignee: 'dev',
    createdDaysAgo: 6,
    notify: true,
    subtasks: [
      { title: 'Clone the orders service and run it locally', isDone: true },
      { title: 'Trace a successful POST /orders in the logs', isDone: true },
      { title: 'Write a half-page summary of validation and persistence', isDone: false },
    ],
  },
  {
    title: 'Add request logging to POST /orders',
    description: 'Log method, path, status, and duration for order creation. Do not log card numbers or full request bodies. Cover the happy path and a 400 validation failure.',
    priority: 'MEDIUM',
    dueDate: atDays(8, 18),
    status: 'TODO',
    createdBy: 'arjun',
    assignee: 'dev',
    createdDaysAgo: 1,
    notify: true,
    subtasks: [
      { title: 'Add a request logger middleware on the orders router', isDone: false },
      { title: 'Redact payment fields before anything is logged', isDone: false },
      { title: 'Add tests for 201 and 400 responses', isDone: false },
    ],
  },
  {
    title: 'Get laptop access for GitHub and the staging VPN',
    description: 'Raise the access requests Neha sent on your joining day. You need GitHub in the engineering org and the staging VPN before you can clone services.',
    priority: 'HIGH',
    dueDate: atDays(1, 18),
    status: 'IN_PROGRESS',
    createdBy: 'arjun',
    assignee: 'kabir',
    createdDaysAgo: 3,
    notify: true,
    subtasks: [
      { title: 'Accept the GitHub org invite', isDone: true },
      { title: 'Install the VPN client and sign in once', isDone: false },
      { title: 'Clone the billing service read-only and confirm it builds', isDone: false },
    ],
  },
  {
    title: 'Read the backend onboarding guide',
    description: 'Read the engineering handbook sections on branching, pull requests, and how we name migrations. Reply in this task with one question you want to ask in your first 1:1.',
    priority: 'LOW',
    dueDate: atDays(6, 18),
    status: 'TODO',
    createdBy: 'arjun',
    assignee: 'kabir',
    createdDaysAgo: 2,
    subtasks: [
      { title: 'Read the branching and pull request section', isDone: false },
      { title: 'Post one question for your mentor', isDone: false },
    ],
  },
  {
    title: 'Set up the web app and Storybook',
    description: 'Run the customer web app and Storybook locally. Confirm the Button, EmptyState, and TextField stories render without console errors.',
    priority: 'HIGH',
    dueDate: atDays(-10, 18),
    status: 'DONE',
    createdBy: 'priya',
    assignee: 'sana',
    createdDaysAgo: 20,
    completedAt: atDays(-12, 15),
    completionNote: 'Storybook is up on port 6006. Button, EmptyState, and TextField stories render cleanly.',
    subtasks: [
      { title: 'Install dependencies and start the Vite dev server', isDone: true },
      { title: 'Start Storybook and open the three component stories', isDone: true },
      { title: 'Fix any local environment issues and note them for the team', isDone: true },
    ],
  },
  {
    title: 'Build the empty state for the task list',
    description: 'When a mentee has no tasks, the list page should show the EmptyState component with a short line of copy and no broken illustration. Match the spacing used on the notifications empty state.',
    priority: 'HIGH',
    dueDate: atDays(3, 18),
    status: 'IN_PROGRESS',
    createdBy: 'priya',
    assignee: 'sana',
    createdDaysAgo: 4,
    notify: true,
    subtasks: [
      { title: 'Reuse the shared EmptyState component', isDone: true },
      { title: 'Add the empty copy and hide the table header', isDone: true },
      { title: 'Check the layout at mobile width', isDone: false },
    ],
  },
  {
    title: 'Accessibility pass on the login form',
    description: 'The login form fails keyboard focus order and the password error is not announced. Fix labels, focus, and the error message so a screen reader user can sign in.',
    priority: 'MEDIUM',
    dueDate: atDays(9, 18),
    status: 'TODO',
    createdBy: 'priya',
    assignee: 'sana',
    createdDaysAgo: 1,
    notify: true,
    subtasks: [
      { title: 'Associate each error with its input via aria-describedby', isDone: false },
      { title: 'Move focus to the first invalid field on submit', isDone: false },
      { title: 'Verify the flow with keyboard only', isDone: false },
    ],
  },
  {
    title: 'Run the frontend app on your machine',
    description: 'Clone the web app, install dependencies, and load the login page. If the API proxy fails, check that the server is on port 5001 and note what you changed.',
    priority: 'HIGH',
    dueDate: atDays(3, 18),
    status: 'TODO',
    createdBy: 'priya',
    assignee: 'rohan',
    createdDaysAgo: 2,
    notify: true,
    subtasks: [
      { title: 'Clone the repo and create a local branch from main', isDone: false },
      { title: 'Start the dev server and open the login page', isDone: false },
      { title: 'Share a screenshot in your mentor 1:1', isDone: false },
    ],
  },
  {
    title: 'Read the component guide before your first ticket',
    description: 'Skim how we structure pages, forms, and API calls. You will use the same patterns on the empty-state ticket next week.',
    priority: 'LOW',
    dueDate: atDays(7, 18),
    status: 'TODO',
    createdBy: 'priya',
    assignee: 'rohan',
    createdDaysAgo: 2,
    subtasks: [
      { title: 'Read the page and form sections of the frontend guide', isDone: false },
      { title: 'Note one pattern you want to reuse', isDone: false },
    ],
  },
  {
    title: 'Summarise the new-hire funnel',
    description: 'Write a one-page summary of how a new hire moves from offer accepted to first merged pull request. Call out where people wait on access, equipment, or a mentor assignment.',
    priority: 'MEDIUM',
    dueDate: atDays(1, 18),
    status: 'IN_PROGRESS',
    createdBy: 'vikram',
    assignee: 'meera',
    createdDaysAgo: 7,
    notify: true,
    subtasks: [
      { title: 'Interview Neha on the current joining checklist', isDone: true },
      { title: 'Map the steps from offer accepted to first pull request', isDone: true },
      { title: 'Send the one-pager to Vikram for comments', isDone: false },
    ],
  },
  {
    title: 'Draft the mentor assignment flow',
    description: 'Specify how HR assigns a mentor before the joining date. Include the fields HR needs, what the mentor is notified about, and what happens if the mentor is on leave.',
    priority: 'HIGH',
    dueDate: atDays(10, 18),
    status: 'TODO',
    createdBy: 'vikram',
    assignee: 'meera',
    createdDaysAgo: 2,
    notify: true,
    subtasks: [
      { title: 'List the data HR already collects at offer stage', isDone: false },
      { title: 'Write the happy path and the mentor-on-leave case', isDone: false },
      { title: 'Review the draft with Rahul before sharing it widely', isDone: false },
    ],
  },
  {
    title: 'Sit in on two customer onboarding calls',
    description: 'Shadow Vikram on two onboarding calls this week. After each call, write what the customer was blocked on and whether it belongs in the product or in the joining checklist.',
    priority: 'MEDIUM',
    dueDate: atDays(6, 18),
    status: 'IN_PROGRESS',
    createdBy: 'vikram',
    assignee: 'ishaan',
    createdDaysAgo: 4,
    notify: true,
    subtasks: [
      { title: 'Attend the Tuesday onboarding call', isDone: true },
      { title: 'Attend the Thursday onboarding call', isDone: false },
      { title: 'File notes for both calls on this task', isDone: false },
    ],
  },
  {
    title: 'Rewrite the welcome email',
    description: 'The current welcome email still says "test cohort". Rewrite it in the product voice: what to do on day one, who their mentor is, and where to ask for help.',
    priority: 'MEDIUM',
    dueDate: atDays(8, 18),
    status: 'TODO',
    createdBy: 'rahul',
    assignee: 'ishaan',
    createdDaysAgo: 1,
    notify: true,
    subtasks: [
      { title: 'Read the last three welcome emails that went out', isDone: false },
      { title: 'Draft a day-one version under 150 words', isDone: false },
      { title: 'Get a copy edit from Neha', isDone: false },
    ],
  },
];

const MEETINGS = [
  {
    organizer: 'arjun',
    invitee: 'aisha',
    title: 'Weekly 1:1 — invoice rounding',
    description: 'Review the GST rounding pull request and plan the on-call shadow.',
    meetingLink: 'https://meet.google.com/lookup/devboarding-aisha',
    startAt: nextWeekday(2, 11, 0),
    endAt: nextWeekday(2, 11, 30),
    status: 'ACCEPTED',
  },
  {
    organizer: 'arjun',
    invitee: 'dev',
    title: 'Orders API walkthrough',
    description: 'Dev walks through the create and cancel path before adding request logs.',
    meetingLink: 'https://meet.google.com/lookup/devboarding-dev',
    startAt: nextWeekday(3, 15, 0),
    endAt: nextWeekday(3, 15, 45),
    status: 'ACCEPTED',
  },
  {
    organizer: 'arjun',
    invitee: 'kabir',
    title: 'Joining 1:1 and access check',
    description: 'Confirm GitHub and VPN access, then pick Kabir’s first reading task.',
    meetingLink: 'https://meet.google.com/lookup/devboarding-kabir',
    startAt: nextWeekday(1, 16, 0),
    endAt: nextWeekday(1, 16, 30),
    status: 'PENDING',
  },
  {
    organizer: 'priya',
    invitee: 'sana',
    title: 'Empty state design review',
    description: 'Look at the task-list empty state on mobile and agree the remaining spacing tweaks.',
    meetingLink: 'https://meet.google.com/lookup/devboarding-sana',
    startAt: nextWeekday(4, 10, 30),
    endAt: nextWeekday(4, 11, 0),
    status: 'ACCEPTED',
  },
  {
    organizer: 'priya',
    invitee: 'rohan',
    title: 'Frontend setup help',
    description: 'Unblock the local web app if the API proxy is still failing.',
    meetingLink: 'https://meet.google.com/lookup/devboarding-rohan',
    startAt: nextWeekday(2, 14, 0),
    endAt: nextWeekday(2, 14, 30),
    status: 'PENDING',
  },
  {
    organizer: 'vikram',
    invitee: 'meera',
    title: 'Funnel summary review',
    description: 'Go through Meera’s one-pager and decide what belongs in the mentor assignment spec.',
    meetingLink: 'https://meet.google.com/lookup/devboarding-meera',
    startAt: nextWeekday(5, 12, 0),
    endAt: nextWeekday(5, 12, 30),
    status: 'ACCEPTED',
  },
  {
    organizer: 'neha',
    invitee: 'ishaan',
    title: 'Welcome email copy review',
    description: 'Neha reviews the day-one welcome email before it replaces the old template.',
    startAt: nextWeekday(4, 16, 0),
    endAt: nextWeekday(4, 16, 20),
    status: 'PENDING',
  },
];

async function clearAll() {
  await prisma.chatMessage.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.subtask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.updateMany({ data: { mentorId: null } });
  await prisma.user.deleteMany();
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await clearAll();

  const users = {};
  for (const person of PEOPLE) {
    users[person.key] = await prisma.user.create({
      data: {
        name: person.name,
        email: person.email,
        passwordHash,
        role: person.role,
        phone: person.phone,
        department: person.department,
        designation: person.designation,
        joiningDate: person.joiningDate,
        isActive: true,
        mentorId: person.mentor ? users[person.mentor].id : null,
      },
    });
  }

  for (const spec of TASKS) {
    const createdAt = atDays(-spec.createdDaysAgo, 9, 30);
    const task = await prisma.task.create({
      data: {
        title: spec.title,
        description: spec.description,
        priority: spec.priority,
        dueDate: spec.dueDate,
        status: spec.status,
        createdById: users[spec.createdBy].id,
        assigneeId: users[spec.assignee].id,
        completionNote: spec.completionNote ?? null,
        completedAt: spec.status === 'DONE' ? spec.completedAt : null,
        createdAt,
        subtasks: {
          create: spec.subtasks.map((s, order) => ({ title: s.title, isDone: s.isDone, order })),
        },
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId: users[spec.createdBy].id,
        action: 'CREATED',
        createdAt,
      },
    });
    if (spec.status !== 'TODO') {
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: users[spec.assignee].id,
          action: 'STATUS_CHANGED',
          fromStatus: 'TODO',
          toStatus: 'IN_PROGRESS',
          createdAt: atDays(-Math.max(spec.createdDaysAgo - 1, 1), 11),
        },
      });
    }
    if (spec.status === 'DONE') {
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: users[spec.assignee].id,
          action: 'STATUS_CHANGED',
          fromStatus: 'IN_PROGRESS',
          toStatus: 'DONE',
          createdAt: spec.completedAt,
        },
      });
    }

    if (spec.notify) {
      const assignee = users[spec.assignee];
      await prisma.notification.create({
        data: {
          userId: assignee.id,
          type: 'TASK_ASSIGNED',
          title: spec.title,
          body: `${users[spec.createdBy].name} assigned you this task.`,
          link: `/mentee/tasks/${task.id}`,
          isRead: false,
        },
      });
    }
  }

  for (const meeting of MEETINGS) {
    await prisma.meeting.create({
      data: {
        organizerId: users[meeting.organizer].id,
        inviteeId: users[meeting.invitee].id,
        title: meeting.title,
        description: meeting.description,
        meetingLink: meeting.meetingLink ?? null,
        startAt: meeting.startAt,
        endAt: meeting.endAt,
        status: meeting.status,
      },
    });
    if (meeting.status === 'PENDING') {
      await prisma.notification.create({
        data: {
          userId: users[meeting.invitee].id,
          type: 'MEETING_REQUEST',
          title: meeting.title,
          body: `${users[meeting.organizer].name} requested a meeting.`,
          link: `/${users[meeting.invitee].role === 'MENTEE' ? 'mentee' : 'hr'}/calendar`,
          isRead: false,
        },
      });
    }
  }

  console.log(`Seeded ${PEOPLE.length} people and ${TASKS.length} tasks. Password for every user: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
