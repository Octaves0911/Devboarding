/**
 * StatusBadge — renders a coloured pill for task status, user role, or active state.
 *
 * Props:
 *   type  "status" | "role" | "active"
 *   value  e.g. "TODO" | "IN_PROGRESS" | "DONE" | "ADMIN" | "HR" | "MENTOR" | "MENTEE" | true | false
 */
const STATUS_MAP = {
  TODO:        { label: 'To Do',      cls: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700' },
  DONE:        { label: 'Done',        cls: 'bg-green-100 text-green-700' },
};

const ROLE_MAP = {
  ADMIN:  { label: 'Admin',  cls: 'bg-slate-100 text-slate-700' },
  HR:     { label: 'HR',     cls: 'bg-purple-100 text-purple-700' },
  MENTOR: { label: 'Mentor', cls: 'bg-blue-100 text-blue-700' },
  MENTEE: { label: 'Mentee', cls: 'bg-green-100 text-green-700' },
};

const PRIORITY_MAP = {
  LOW:    { label: 'Low',    cls: 'bg-gray-100 text-gray-600' },
  MEDIUM: { label: 'Medium', cls: 'bg-yellow-100 text-yellow-700' },
  HIGH:   { label: 'High',   cls: 'bg-red-100 text-red-700' },
};

export default function StatusBadge({ type = 'status', value }) {
  let label, cls;

  if (type === 'status') {
    ({ label, cls } = STATUS_MAP[value] ?? { label: value, cls: 'bg-gray-100 text-gray-700' });
  } else if (type === 'role') {
    ({ label, cls } = ROLE_MAP[value] ?? { label: value, cls: 'bg-gray-100 text-gray-700' });
  } else if (type === 'priority') {
    ({ label, cls } = PRIORITY_MAP[value] ?? { label: value, cls: 'bg-gray-100 text-gray-700' });
  } else if (type === 'active') {
    label = value ? 'Active' : 'Inactive';
    cls   = value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  } else {
    label = value;
    cls   = 'bg-gray-100 text-gray-700';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
