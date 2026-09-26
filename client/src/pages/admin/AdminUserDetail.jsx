import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, UserX, UserCheck, Trash2, ClipboardList } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import ConfirmModal from '../../components/ConfirmModal';

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="w-36 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState({ open: false, type: null });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadUser(); }, [id]);

  async function loadUser() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/users/${id}`);
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load user.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    const { type } = modal;
    setActionLoading(true);
    try {
      if (type === 'delete') {
        await api.delete(`/users/${id}`);
        toast.success(`${user.name} deleted.`);
        navigate('/admin/users');
      } else if (type === 'deactivate') {
        const res = await api.patch(`/users/${id}/status`, { isActive: false });
        toast.success(`${user.name} deactivated.`);
        setUser(res.data.user);
        setModal({ open: false, type: null });
      } else if (type === 'activate') {
        const res = await api.patch(`/users/${id}/status`, { isActive: true });
        toast.success(`${user.name} activated.`);
        setUser(res.data.user);
        setModal({ open: false, type: null });
      }
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Action failed.');
    } finally {
      setActionLoading(false);
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

  if (error) {
    return <div className="text-red-600 text-sm text-center py-10">{error}</div>;
  }

  if (!user) return null;

  const modalMeta = {
    delete: {
      title: 'Delete User',
      message: `Permanently delete "${user.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    },
    deactivate: {
      title: 'Deactivate User',
      message: `Deactivate "${user.name}"? They will not be able to log in.`,
      confirmLabel: 'Deactivate',
      variant: 'danger',
    },
    activate: {
      title: 'Activate User',
      message: `Reactivate "${user.name}"? They will regain access.`,
      confirmLabel: 'Activate',
      variant: 'success',
    },
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/users')}
            className="text-sm text-slate-600 hover:underline"
          >
            ← Users
          </button>
          <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
          <StatusBadge type="role" value={user.role} />
          <StatusBadge type="active" value={user.isActive} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/users/${id}/edit`)}>
            <Pencil size={14} /> Edit
          </Button>
          {user.isActive ? (
            <Button size="sm" variant="danger" onClick={() => setModal({ open: true, type: 'deactivate' })}>
              <UserX size={14} /> Deactivate
            </Button>
          ) : (
            <Button size="sm" variant="success" onClick={() => setModal({ open: true, type: 'activate' })}>
              <UserCheck size={14} /> Activate
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => setModal({ open: true, type: 'delete' })}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Profile</h2>
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Phone" value={user.phone} />
        <InfoRow label="Department" value={user.department} />
        {user.role === 'MENTOR' && <InfoRow label="Designation" value={user.designation} />}
        <InfoRow
          label="Joining Date"
          value={user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : null}
        />
        <InfoRow
          label="Member Since"
          value={new Date(user.createdAt).toLocaleDateString()}
        />
        {user.role === 'MENTEE' && user.mentor && (
          <div className="flex gap-3 py-2 border-b border-gray-50">
            <span className="w-36 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
              Mentor
            </span>
            <button
              onClick={() => navigate(`/admin/users/${user.mentor.id}`)}
              className="text-sm text-slate-700 hover:underline font-medium"
            >
              {user.mentor.name}
            </button>
          </div>
        )}
      </div>

      {/* Mentees list (for MENTOR role) */}
      {user.role === 'MENTOR' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Mentees ({user.mentees?.length ?? 0})
            </h2>
          </div>
          {!user.mentees || user.mentees.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No mentees assigned.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {user.mentees.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/admin/users/${m.id}`)}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </div>
                  <StatusBadge type="role" value="MENTEE" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks assigned to this user */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ClipboardList size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">
            Tasks Assigned ({user.tasksAssigned?.length ?? 0})
          </h2>
        </div>
        {!user.tasksAssigned || user.tasksAssigned.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No tasks assigned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Title</th>
                  <th className="px-5 py-3 text-left font-medium">Priority</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Due</th>
                  <th className="px-5 py-3 text-left font-medium">Created by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {user.tasksAssigned.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900 max-w-xs truncate">{t.title}</td>
                    <td className="px-5 py-3"><StatusBadge type="priority" value={t.priority} /></td>
                    <td className="px-5 py-3"><StatusBadge type="status" value={t.status} /></td>
                    <td className="px-5 py-3 text-gray-500">
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {t.createdBy?.name ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {modal.open && modal.type && (
        <ConfirmModal
          open={modal.open}
          title={modalMeta[modal.type]?.title}
          message={modalMeta[modal.type]?.message}
          confirmLabel={modalMeta[modal.type]?.confirmLabel}
          variant={modalMeta[modal.type]?.variant}
          loading={actionLoading}
          onConfirm={handleConfirm}
          onCancel={() => setModal({ open: false, type: null })}
        />
      )}
    </div>
  );
}
