import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Button from '../../components/Button';

const INITIAL = {
  name: '',
  email: '',
  password: '',
  role: '',
  phone: '',
  department: '',
  designation: '',
  joiningDate: '',
  mentorId: '',
};

export default function AdminCreateUser() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load mentors whenever role changes to MENTEE
  useEffect(() => {
    if (form.role === 'MENTEE') {
      setMentorsLoading(true);
      api
        .get('/users/mentors')
        .then((r) => setMentors(r.data.mentors))
        .catch(() => setMentors([]))
        .finally(() => setMentorsLoading(false));
    }
  }, [form.role]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email address.';
    if (!form.password) e.password = 'Temporary password is required.';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters.';
    if (!form.role) e.role = 'Role is required.';
    if (form.role === 'MENTEE' && !form.mentorId) e.mentorId = 'Assigned mentor is required for Mentee.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        phone: form.phone.trim() || undefined,
        department: form.department.trim() || undefined,
        joiningDate: form.joiningDate || undefined,
      };
      if (form.role === 'MENTOR') payload.designation = form.designation.trim() || undefined;
      if (form.role === 'MENTEE') payload.mentorId = parseInt(form.mentorId, 10);

      await api.post('/users', payload);
      toast.success(`User "${form.name}" created successfully.`);
      navigate('/admin/users');
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Failed to create user.';
      if (msg.toLowerCase().includes('email')) {
        setErrors((prev) => ({ ...prev, email: msg }));
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Create User</h1>
        <button
          onClick={() => navigate('/admin/users')}
          className="text-sm text-slate-600 hover:underline"
        >
          ← Back to Users
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {/* Full name */}
        <Field label="Full Name" required error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Jane Doe"
            className={inputCls(errors.name)}
          />
        </Field>

        {/* Email */}
        <Field label="Email" required error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="jane@company.com"
            className={inputCls(errors.email)}
          />
        </Field>

        {/* Password */}
        <Field label="Temporary Password" required error={errors.password}>
          <input
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="Min 6 characters"
            className={inputCls(errors.password)}
          />
        </Field>

        {/* Role */}
        <Field label="Role" required error={errors.role}>
          <select
            value={form.role}
            onChange={(e) => { set('role', e.target.value); set('mentorId', ''); }}
            className={inputCls(errors.role)}
          >
            <option value="">Select role…</option>
            <option value="HR">HR</option>
            <option value="MENTOR">Mentor</option>
            <option value="MENTEE">Mentee</option>
          </select>
        </Field>

        {/* Conditional: designation for MENTOR */}
        {form.role === 'MENTOR' && (
          <Field label="Designation">
            <input
              type="text"
              value={form.designation}
              onChange={(e) => set('designation', e.target.value)}
              placeholder="e.g. Senior Engineer"
              className={inputCls()}
            />
          </Field>
        )}

        {/* Conditional: mentor dropdown for MENTEE */}
        {form.role === 'MENTEE' && (
          <Field label="Assigned Mentor" required error={errors.mentorId}>
            {mentorsLoading ? (
              <p className="text-sm text-gray-500">Loading mentors…</p>
            ) : mentors.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No active mentors found.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/admin/users/new')}
                  className="underline font-medium"
                >
                  Create a mentor first
                </button>
                .
              </p>
            ) : (
              <select
                value={form.mentorId}
                onChange={(e) => set('mentorId', e.target.value)}
                className={inputCls(errors.mentorId)}
              >
                <option value="">Select mentor…</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.designation ? `— ${m.designation}` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        {/* Phone */}
        <Field label="Phone">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+1 555 000 0000"
            className={inputCls()}
          />
        </Field>

        {/* Department */}
        <Field label="Department">
          <input
            type="text"
            value={form.department}
            onChange={(e) => set('department', e.target.value)}
            placeholder="Engineering"
            className={inputCls()}
          />
        </Field>

        {/* Joining date */}
        <Field label="Joining Date">
          <input
            type="date"
            value={form.joiningDate}
            onChange={(e) => set('joiningDate', e.target.value)}
            className={inputCls()}
          />
        </Field>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/users')}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create User
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────
function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputCls(error) {
  return `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;
}
