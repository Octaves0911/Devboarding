import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import ConfirmModal from '../../components/ConfirmModal';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Confirm modal state
  const [modal, setModal] = useState({ open: false, type: null, user: null });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  function openModal(type, user) {
    setModal({ open: true, type, user });
  }
  function closeModal() {
    setModal({ open: false, type: null, user: null });
  }

  async function handleConfirm() {
    const { type, user } = modal;
    setActionLoading(true);
    try {
      if (type === 'delete') {
        await api.delete(`/users/${user.id}`);
        toast.success(`${user.name} deleted.`);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      } else if (type === 'deactivate') {
        const res = await api.patch(`/users/${user.id}/status`, { isActive: false });
        toast.success(`${user.name} deactivated.`);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? res.data.user : u)));
      } else if (type === 'activate') {
        const res = await api.patch(`/users/${user.id}/status`, { isActive: true });
        toast.success(`${user.name} activated.`);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? res.data.user : u)));
      }
      closeModal();
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Action failed.';
      toast.error(msg);
      // Keep modal open so user can read the error
    } finally {
      setActionLoading(false);
    }
  }

  const modalMeta = {
    delete: {
      title: 'Delete User',
      message: modal.user
        ? `Permanently delete "${modal.user.name}"? This cannot be undone.`
        : '',
      confirmLabel: 'Delete',
      variant: 'danger',
    },
    deactivate: {
      title: 'Deactivate User',
      message: modal.user
        ? `Deactivate "${modal.user.name}"? They will not be able to log in.`
        : '',
      confirmLabel: 'Deactivate',
      variant: 'danger',
    },
    activate: {
      title: 'Activate User',
      message: modal.user
        ? `Reactivate "${modal.user.name}"? They will regain access.`
        : '',
      confirmLabel: 'Activate',
      variant: 'success',
    },
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        <Button onClick={() => navigate('/admin/users/new')}>+ Create User</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All Roles</option>
          <option value="HR">HR</option>
          <option value="MENTOR">Mentor</option>
          <option value="MENTEE">Mentee</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          {search || roleFilter ? 'No users match your filters.' : 'No users yet. '}
          {!search && !roleFilter && (
            <button
              onClick={() => navigate('/admin/users/new')}
              className="text-slate-600 underline ml-1"
            >
              Create one
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Email</th>
                  <th className="px-5 py-3 text-left font-medium">Role</th>
                  <th className="px-5 py-3 text-left font-medium">Mentor</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Created</th>
                  <th className="px-5 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-5 py-3 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3"><StatusBadge type="role" value={u.role} /></td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {u.mentor ? u.mentor.name : '—'}
                    </td>
                    <td className="px-5 py-3"><StatusBadge type="active" value={u.isActive} /></td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          title="View"
                          onClick={() => navigate(`/admin/users/${u.id}`)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          title="Edit"
                          onClick={() => navigate(`/admin/users/${u.id}/edit`)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        >
                          <Pencil size={15} />
                        </button>
                        {u.isActive ? (
                          <button
                            title="Deactivate"
                            onClick={() => openModal('deactivate', u)}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                          >
                            <UserX size={15} />
                          </button>
                        ) : (
                          <button
                            title="Activate"
                            onClick={() => openModal('activate', u)}
                            className="p-1.5 rounded hover:bg-green-50 text-gray-500 hover:text-green-600"
                          >
                            <UserCheck size={15} />
                          </button>
                        )}
                        <button
                          title="Delete"
                          onClick={() => openModal('delete', u)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {modal.open && modal.type && (
        <ConfirmModal
          open={modal.open}
          title={modalMeta[modal.type]?.title}
          message={modalMeta[modal.type]?.message}
          confirmLabel={modalMeta[modal.type]?.confirmLabel}
          variant={modalMeta[modal.type]?.variant}
          loading={actionLoading}
          onConfirm={handleConfirm}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}
