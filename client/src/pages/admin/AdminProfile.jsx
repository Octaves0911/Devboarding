import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Button from '../../components/Button';

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

export default function AdminProfile() {
  const { user, setUser } = useAuth();

  // Profile form
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdErrors, setPwdErrors] = useState({});
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name ?? '', phone: user.phone ?? '' });
    }
  }, [user]);

  function setP(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setProfileErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function setPw(field, value) {
    setPwd((prev) => ({ ...prev, [field]: value }));
    setPwdErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    const errs = {};
    if (!profile.name.trim()) errs.name = 'Name is required.';
    if (Object.keys(errs).length > 0) { setProfileErrors(errs); return; }

    setSavingProfile(true);
    try {
      const res = await api.put('/profile', { name: profile.name.trim(), phone: profile.phone.trim() || null });
      setUser(res.data.user);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    const errs = {};
    if (!pwd.currentPassword) errs.currentPassword = 'Current password is required.';
    if (!pwd.newPassword) errs.newPassword = 'New password is required.';
    else if (pwd.newPassword.length < 6) errs.newPassword = 'Must be at least 6 characters.';
    if (!pwd.confirmPassword) errs.confirmPassword = 'Please confirm the new password.';
    else if (pwd.newPassword !== pwd.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    if (Object.keys(errs).length > 0) { setPwdErrors(errs); return; }

    setSavingPwd(true);
    try {
      await api.put('/profile/password', pwd);
      toast.success('Password changed successfully.');
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Failed to change password.';
      if (msg.toLowerCase().includes('current')) {
        setPwdErrors((prev) => ({ ...prev, currentPassword: msg }));
      } else {
        toast.error(msg);
      }
    } finally {
      setSavingPwd(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>

      {/* Read-only info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Account Info</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Email</p>
            <p className="text-gray-800 font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Role</p>
            <p className="text-gray-800 font-medium capitalize">{user.role.toLowerCase()}</p>
          </div>
          {user.department && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Department</p>
              <p className="text-gray-800">{user.department}</p>
            </div>
          )}
          {user.joiningDate && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Joining Date</p>
              <p className="text-gray-800">{new Date(user.joiningDate).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit name & phone */}
      <form onSubmit={handleProfileSave} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Edit Profile</h2>

        <Field label="Full Name" required error={profileErrors.name}>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setP('name', e.target.value)}
            className={inputCls(profileErrors.name)}
          />
        </Field>

        <Field label="Phone">
          <input
            type="tel"
            value={profile.phone}
            onChange={(e) => setP('phone', e.target.value)}
            placeholder="+1 555 000 0000"
            className={inputCls()}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={savingProfile}>
            Save Changes
          </Button>
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={handlePasswordChange} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Change Password</h2>

        <Field label="Current Password" required error={pwdErrors.currentPassword}>
          <input
            type="password"
            value={pwd.currentPassword}
            onChange={(e) => setPw('currentPassword', e.target.value)}
            className={inputCls(pwdErrors.currentPassword)}
          />
        </Field>

        <Field label="New Password" required error={pwdErrors.newPassword}>
          <input
            type="password"
            value={pwd.newPassword}
            onChange={(e) => setPw('newPassword', e.target.value)}
            placeholder="Min 6 characters"
            className={inputCls(pwdErrors.newPassword)}
          />
        </Field>

        <Field label="Confirm New Password" required error={pwdErrors.confirmPassword}>
          <input
            type="password"
            value={pwd.confirmPassword}
            onChange={(e) => setPw('confirmPassword', e.target.value)}
            className={inputCls(pwdErrors.confirmPassword)}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={savingPwd} variant="secondary">
            Change Password
          </Button>
        </div>
      </form>
    </div>
  );
}
