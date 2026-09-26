import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  ADMIN: '/admin',
  HR: '/hr',
  MENTOR: '/mentor',
  MENTEE: '/mentee',
};

export default function Unauthorized() {
  const { user } = useAuth();
  const home = user ? (ROLE_HOME[user.role] ?? '/') : '/login';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center mb-6">
        <ShieldOff size={36} className="text-red-500" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        You don't have permission to view this page. Please contact your administrator if you believe this is an error.
      </p>
      <Link
        to={home}
        className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
      >
        {user ? 'Back to Dashboard' : 'Sign in'}
      </Link>
    </div>
  );
}
