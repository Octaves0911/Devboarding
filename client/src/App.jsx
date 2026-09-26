import { Routes, Route, Navigate } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Public pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';

// Admin pages
import AdminOverview from './pages/admin/AdminOverview';
import AdminUsers from './pages/admin/AdminUsers';
import AdminCreateUser from './pages/admin/AdminCreateUser';
import AdminEditUser from './pages/admin/AdminEditUser';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminTasks from './pages/admin/AdminTasks';
import AdminProfile from './pages/admin/AdminProfile';

// HR pages
import HROverview from './pages/hr/HROverview';
import HRAssignTask from './pages/hr/HRAssignTask';
import HRTasks from './pages/hr/HRTasks';
import HRMyTasks from './pages/hr/HRMyTasks';
import HRUsers from './pages/hr/HRUsers';
import HRProfile from './pages/hr/HRProfile';

// Mentor pages
import MentorOverview from './pages/mentor/MentorOverview';
import MentorMentees from './pages/mentor/MentorMentees';
import MentorAssignTask from './pages/mentor/MentorAssignTask';
import MentorTasks from './pages/mentor/MentorTasks';
import MentorMyTasks from './pages/mentor/MentorMyTasks';
import MentorProfile from './pages/mentor/MentorProfile';

// Mentee pages
import MenteeOverview from './pages/mentee/MenteeOverview';
import MenteeTasks from './pages/mentee/MenteeTasks';
import MenteeTaskDetail from './pages/mentee/MenteeTaskDetail';
import MenteeMentor from './pages/mentee/MenteeMentor';
import MenteeProfile from './pages/mentee/MenteeProfile';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          {/* ── Public ── */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ── Admin ── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/new" element={<AdminCreateUser />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="users/:id/edit" element={<AdminEditUser />} />
            <Route path="tasks" element={<AdminTasks />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          {/* ── HR ── */}
          <Route
            path="/hr"
            element={
              <ProtectedRoute allowedRoles={['HR']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HROverview />} />
            <Route path="tasks/new" element={<HRAssignTask />} />
            <Route path="tasks" element={<HRTasks />} />
            <Route path="my-tasks" element={<HRMyTasks />} />
            <Route path="users" element={<HRUsers />} />
            <Route path="profile" element={<HRProfile />} />
          </Route>

          {/* ── Mentor ── */}
          <Route
            path="/mentor"
            element={
              <ProtectedRoute allowedRoles={['MENTOR']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<MentorOverview />} />
            <Route path="mentees" element={<MentorMentees />} />
            <Route path="tasks/new" element={<MentorAssignTask />} />
            <Route path="tasks" element={<MentorTasks />} />
            <Route path="my-tasks" element={<MentorMyTasks />} />
            <Route path="profile" element={<MentorProfile />} />
          </Route>

          {/* ── Mentee ── */}
          <Route
            path="/mentee"
            element={
              <ProtectedRoute allowedRoles={['MENTEE']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<MenteeOverview />} />
            <Route path="tasks" element={<MenteeTasks />} />
            <Route path="tasks/:id" element={<MenteeTaskDetail />} />
            <Route path="mentor" element={<MenteeMentor />} />
            <Route path="profile" element={<MenteeProfile />} />
          </Route>

          {/* ── 404 ── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
