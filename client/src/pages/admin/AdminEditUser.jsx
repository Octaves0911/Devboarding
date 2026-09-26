import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Button from '../../components/Button';

export default function AdminEditUser() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/users/${id}`);
        const u = res.data.user;
        setForm({
          name: u.name ?? '',
          email: u.email ?? '',
          role: u.role ?? '',
          phone: u.phone ?? '',
          department: u.department ?? '',
          designation: u.designation ?? '',
          joiningDate: u.joiningDate ? u.joiningDate.substring(0, 10) : '',
          mentorId: u.mentorId ? String(u.mentorId) : '',
        });
        if (u.role === 'MENTEE') {
          const mRes = await api.get('/users/mentors');
          setMentors(mRes.data.mentors);
        }
      } catch (err) {
        setFetchError(err.response?.data?.error ?? 'Failed to load user.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email address.';
    if (form.role === 'MENTEE' && !form.mentorId) e.mentorId = 'Assigned mentor is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        joiningDate: form.joiningDate || null,
      };
      if (form.role === 'MENTOR') payload.designation = form.designation.trim() || null;
      if (form.role === 'MENTEE') payload.mentorId = parseInt(form.mentorId, 10);

      await api.put(`/users/${id}`, payload);
      toast.success('User updated successfully.');
      navigate(`/admin/users/${id}`);
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Failed to update user.';
      if (msg.toLowerCase().includes('email')) {
        setErrors((prev) => ({ ...prev, email: msg }));
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (fetchError) {
    return <div className="text-red-600 text-sm py-10 text-center">{fetchError}</div>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Edit User</h1>
        <button
          onClick={() => navigate(`/admin/users/${id}`)}
          className="text-sm text-slate-600 hover:underline"
        >
          ← Back to User
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Field label="Full Name" required error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls(errors.name)}
          />
        </Field>

        <Field label="Email" required error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={inputCls(errors.email)}
          />
        </Field>

        {/* Role is shown but not editable */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <p className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
            {form.role}
          </p>
        </div>

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

        {form.role === 'MENTEE' && (
          <Field label="Assigned Mentor" required error={errors.mentorId}>
            {mentors.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No active mentors available.
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

        <Field label="Phone">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputCls()}
          />
        </Field>

        <Field label="Department">
          <input
            type="text"
            value={form.department}
            onChange={(e) => set('department', e.target.value)}
            className={inputCls()}
          />
        </Field>

        <Field label="Joining Date">
          <input
            type="date"
            value={form.joiningDate}
            onChange={(e) => set('joiningDate', e.target.value)}
            className={inputCls()}
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate(`/admin/users/${id}`)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}

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
