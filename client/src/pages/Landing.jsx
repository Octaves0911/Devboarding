import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Paperclip,
  Users,
  Activity,
  ChevronRight,
  Menu,
  X,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';

const NAV_LINKS = [
  { label: 'Features', id: 'features' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'Contact', id: 'contact' },
];

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Role-based Dashboards',
    desc: 'Tailored views for Admin, HR, Mentor, and Mentee — everyone sees exactly what they need.',
  },
  {
    icon: ClipboardList,
    title: 'Structured Task Assignment',
    desc: 'HR and Mentors create and assign tasks with priorities, due dates, and full context.',
  },
  {
    icon: CheckSquare,
    title: 'Subtasks & Progress Tracking',
    desc: 'Break work into subtasks, tick them off, and watch completion rates climb in real time.',
  },
  {
    icon: Paperclip,
    title: 'Document Attachments',
    desc: 'Attach reference materials or submit completed work files directly on each task.',
  },
  {
    icon: Users,
    title: 'Mentor–Mentee Pairing',
    desc: 'Assign dedicated mentors to new hires and give mentors a focused view of their mentees.',
  },
  {
    icon: Activity,
    title: 'Real-time Status Updates',
    desc: 'Every status change is logged and visible instantly across assignee and creator views.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Admin Creates Users',
    desc: 'Admins provision HR staff, Mentors, and Mentees with role-appropriate access in seconds.',
  },
  {
    num: '02',
    title: 'HR & Mentors Assign Tasks',
    desc: 'Task owners create structured onboarding tasks with subtasks, files, and deadlines.',
  },
  {
    num: '03',
    title: 'Mentees Complete & Track',
    desc: 'New hires work through tasks, update status, and upload submissions — all in one place.',
  },
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  function handleSubmit(e) {
    e.preventDefault();
    toast.success('Message sent! We\'ll be in touch soon.');
    setForm({ name: '', email: '', message: '' });
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600 tracking-tight">DevBoarding</span>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                {l.label}
              </button>
            ))}
            <Link
              to="/login"
              className="ml-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Sign in
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-gray-600"
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 flex flex-col gap-3">
            {NAV_LINKS.map(l => (
              <button
                key={l.id}
                onClick={() => { scrollTo(l.id); setMenuOpen(false); }}
                className="text-sm text-gray-700 text-left py-1"
              >
                {l.label}
              </button>
            ))}
            <Link
              to="/login"
              className="mt-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium text-center"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-blue-50 to-white pt-24 pb-28 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block mb-4 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wide">
            Developer Onboarding Platform
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
            Onboard developers{' '}
            <span className="text-blue-600">faster and smarter</span>
          </h1>
          <p className="text-lg text-gray-500 mb-8 leading-relaxed">
            DevBoarding gives every new hire a structured, trackable onboarding
            experience — from day one to full productivity.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition-colors shadow-md"
          >
            Get Started <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">Everything you need</h2>
          <p className="text-center text-gray-500 mb-14 max-w-xl mx-auto">
            One platform that keeps Admins, HR, Mentors, and Mentees in sync from hire to productivity.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">How it works</h2>
          <p className="text-center text-gray-500 mb-14">Three simple steps to a seamless onboarding process.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(s => (
              <div key={s.num} className="text-center">
                <div className="w-14 h-14 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-4">
                  {s.num}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* Info */}
          <div>
            <h2 className="text-3xl font-bold mb-4">Get in touch</h2>
            <p className="text-gray-500 mb-8">Have questions about DevBoarding? We'd love to hear from you.</p>
            <ul className="space-y-5">
              <li className="flex items-start gap-3">
                <Mail size={18} className="text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Email</p>
                  <a href="mailto:hello@devboarding.io" className="text-gray-700 hover:text-blue-600 text-sm">
                    hello@devboarding.io
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Phone size={18} className="text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Phone</p>
                  <span className="text-gray-700 text-sm">+1 (555) 123-4567</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Office</p>
                  <span className="text-gray-700 text-sm">123 Innovation Drive, San Francisco, CA 94105</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(v => ({ ...v, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={e => setForm(v => ({ ...v, message: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="How can we help?"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors self-start"
            >
              Send Message
            </button>
          </form>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-8 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <span className="font-semibold text-gray-600">DevBoarding</span>
          <span>© {new Date().getFullYear()} DevBoarding. All rights reserved.</span>
          <div className="flex gap-4">
            <button onClick={() => scrollTo('features')} className="hover:text-gray-600">Features</button>
            <button onClick={() => scrollTo('contact')} className="hover:text-gray-600">Contact</button>
            <Link to="/login" className="hover:text-gray-600">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
