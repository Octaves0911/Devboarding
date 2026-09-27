import { useEffect, useState } from 'react';
import { Mail, Phone, Briefcase, Building2, GraduationCap } from 'lucide-react';
import api from '../../lib/api';

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-green-700" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function MenteeMentor() {
  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/users/my-mentor')
      .then((res) => setMentor(res.data.mentor))
      .catch((err) => setError(err.response?.data?.error ?? 'Failed to load mentor.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="animate-spin w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!mentor) return null;

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-xl font-bold text-gray-900">My Mentor</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-800 text-white flex items-center justify-center text-xl font-bold">
            {mentor.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{mentor.name}</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              Mentor
            </span>
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="space-y-4">
          <InfoRow icon={Mail}        label="Email"       value={mentor.email} />
          <InfoRow icon={Phone}       label="Phone"       value={mentor.phone} />
          <InfoRow icon={Briefcase}   label="Designation" value={mentor.designation} />
          <InfoRow icon={Building2}   label="Department"  value={mentor.department} />
        </div>
      </div>
    </div>
  );
}
