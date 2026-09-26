import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  ADMIN: '/admin',
  HR: '/hr',
  MENTOR: '/mentor',
  MENTEE: '/mentee',
};

export default function NotFound() {
  const { user } = useAuth();
  const home = user ? (ROLE_HOME[user.role] ?? '/') : '/';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
        <FileQuestion size={36} className="text-gray-400" />
      </div>
      <h1 className="text-6xl font-extrabold text-gray-200 mb-2">404</h1>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Page not found</h2>
      <p className="text-gray-500 mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to={home}
        className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
      >
        {user ? 'Back to Dashboard' : 'Go to Home'}
      </Link>
    </div>
  );
}
