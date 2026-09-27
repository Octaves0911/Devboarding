import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  User,
  PlusCircle,
  ListChecks,
  CheckCircle2,
  GraduationCap,
  Menu,
  X,
  ChevronDown,
  LogOut,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import NotificationBell from '../components/NotificationBell';

// ── Role colour palettes ──────────────────────────────────────────
const ROLE_PALETTE = {
  ADMIN:  { bg: 'bg-slate-800',  hover: 'hover:bg-slate-700', text: 'text-white', badge: 'bg-slate-600' },
  HR:     { bg: 'bg-purple-800', hover: 'hover:bg-purple-700', text: 'text-white', badge: 'bg-purple-600' },
  MENTOR: { bg: 'bg-blue-800',   hover: 'hover:bg-blue-700',  text: 'text-white', badge: 'bg-blue-600'  },
  MENTEE: { bg: 'bg-green-800',  hover: 'hover:bg-green-700', text: 'text-white', badge: 'bg-green-600' },
};

// ── Sidebar tab definitions per role ─────────────────────────────
const ROLE_TABS = {
  ADMIN: [
    { label: 'Overview',    to: '/admin',            icon: LayoutDashboard, end: true },
    { label: 'Users',       to: '/admin/users',      icon: Users },
    { label: 'Create User', to: '/admin/users/new',  icon: UserPlus },
    { label: 'All Tasks',   to: '/admin/tasks',      icon: ClipboardList },
    { label: 'Chat',        to: '/admin/chat',       icon: MessageSquare },
    { label: 'Calendar',    to: '/admin/calendar',   icon: Calendar },
    { label: 'My Profile',  to: '/admin/profile',    icon: User },
  ],
  HR: [
    { label: 'Overview',             to: '/hr',           icon: LayoutDashboard, end: true },
    { label: 'Assign Task',          to: '/hr/tasks/new', icon: PlusCircle },
    { label: 'Tasks Assigned by Me', to: '/hr/tasks',     icon: ListChecks },
    { label: 'My Tasks',             to: '/hr/my-tasks',  icon: CheckCircle2 },
    { label: 'Users',                to: '/hr/users',     icon: Users },
    { label: 'Chat',                 to: '/hr/chat',      icon: MessageSquare },
    { label: 'Calendar',             to: '/hr/calendar',  icon: Calendar },
    { label: 'My Profile',           to: '/hr/profile',   icon: User },
  ],
  MENTOR: [
    { label: 'Overview',             to: '/mentor',           icon: LayoutDashboard, end: true },
    { label: 'My Mentees',           to: '/mentor/mentees',   icon: GraduationCap },
    { label: 'Assign Task',          to: '/mentor/tasks/new', icon: PlusCircle },
    { label: 'Tasks Assigned by Me', to: '/mentor/tasks',     icon: ListChecks },
    { label: 'My Tasks',             to: '/mentor/my-tasks',  icon: CheckCircle2 },
    { label: 'Chat',                 to: '/mentor/chat',      icon: MessageSquare },
    { label: 'Calendar',             to: '/mentor/calendar',  icon: Calendar },
    { label: 'My Profile',           to: '/mentor/profile',   icon: User },
  ],
  MENTEE: [
    { label: 'Overview',   to: '/mentee',          icon: LayoutDashboard, end: true },
    { label: 'My Tasks',   to: '/mentee/tasks',    icon: ListChecks },
    { label: 'My Mentor',  to: '/mentee/mentor',   icon: GraduationCap },
    { label: 'Chat',       to: '/mentee/chat',     icon: MessageSquare },
    { label: 'Calendar',   to: '/mentee/calendar', icon: Calendar },
    { label: 'My Profile', to: '/mentee/profile',  icon: User },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────
function roleBadgeLabel(role) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

// ── Component ─────────────────────────────────────────────────────
export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const palette = ROLE_PALETTE[user?.role] ?? ROLE_PALETTE.ADMIN;
  const tabs = ROLE_TABS[user?.role] ?? [];

  async function handleLogout() {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('Logout failed.');
    }
  }

  const Sidebar = ({ mobile = false }) => (
    <aside
      className={`
        flex flex-col h-full
        ${palette.bg} ${palette.text}
        ${mobile ? 'w-72' : 'w-64'}
      `}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-white/10 shrink-0">
        <span className="font-bold text-lg tracking-tight">DevBoarding</span>
        {mobile && (
          <button
            className="ml-auto opacity-70 hover:opacity-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            onClick={() => mobile && setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive ? 'bg-white/20' : `opacity-75 ${palette.hover} hover:opacity-100`}`
            }
          >
            <tab.icon size={18} />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {/* User snippet */}
      <div className="shrink-0 px-4 py-4 border-t border-white/10 text-xs opacity-60">
        <p className="font-medium truncate">{user?.name}</p>
        <p className="truncate">{user?.email}</p>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col h-full shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 flex"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="relative z-50" onClick={e => e.stopPropagation()}>
            <Sidebar mobile />
          </div>
          <div className="flex-1 bg-black/40" />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
          {/* Hamburger */}
          <button
            className="md:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          {/* Page title (filled by child pages via document.title or left blank) */}
          <div className="flex-1" />

          <NotificationBell />

          {/* User area */}
          <div className="relative flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name}</p>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${palette.badge}`}
              >
                {roleBadgeLabel(user?.role ?? '')}
              </span>
            </div>

            <button
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
              onClick={() => setProfileOpen(v => !v)}
            >
              <div className={`w-8 h-8 rounded-full ${palette.badge} text-white flex items-center justify-center text-sm font-bold`}>
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <ChevronDown size={14} />
            </button>

            {/* Dropdown */}
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-10 z-20 w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-1 text-sm">
                  <NavLink
                    to={`/${user?.role?.toLowerCase()}/profile`}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700"
                    onClick={() => setProfileOpen(false)}
                  >
                    <User size={14} /> My Profile
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-gray-50 text-red-600"
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
