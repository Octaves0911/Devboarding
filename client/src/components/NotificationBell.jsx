import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../lib/api';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshCount() {
      try {
        const res = await api.get('/notifications/unread-count');
        if (!cancelled) setCount(res.data.count ?? 0);
      } catch {
        /* poll errors stay quiet */
      }
    }

    refreshCount();
    const id = setInterval(refreshCount, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;

    setLoading(true);
    try {
      const res = await api.get('/notifications?limit=10');
      setItems(res.data.notifications ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function onClickItem(n) {
    if (!n.isRead) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        setCount((c) => Math.max(0, c - 1));
        setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)));
      } catch {
        /* still navigate */
      }
    }
    setOpen(false);
    if (typeof n.link === 'string' && n.link.startsWith('/')) navigate(n.link);
  }

  async function markAll() {
    try {
      await api.patch('/notifications/read-all');
      setCount(0);
      setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    } catch {
      /* ignore */
    }
  }

  const badge = count > 9 ? '9+' : String(count);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        className="relative text-gray-500 hover:text-gray-700 p-1"
        onClick={toggle}
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-80 bg-white rounded-xl border border-gray-200 shadow-lg text-sm">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="font-semibold text-gray-800">Notifications</span>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                onClick={markAll}
                disabled={count === 0}
              >
                Mark all read
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center text-gray-400 text-xs">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-6 text-center text-gray-400 text-xs">No notifications</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onClickItem(n)}
                    className={`w-full text-left px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 ${n.isRead ? '' : 'bg-blue-50/60'}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className={`text-gray-800 truncate ${n.isRead ? 'font-medium' : 'font-semibold'}`}>{n.title}</p>
                        {n.body && <p className="text-xs text-gray-500 line-clamp-2">{n.body}</p>}
                        <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
