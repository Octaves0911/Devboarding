import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50';

function pad(n) {
  return String(n).padStart(2, '0');
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function combineLocal(date, time) {
  const clock = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !clock) return null;
  const [y, m, d] = date.split('-').map(Number);
  const hh = Number(clock[1]);
  const mm = Number(clock[2]);
  if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function formatWhen(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time(start)} – ${time(end)}`;
}

function formatClock(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function roleLabel(role) {
  if (!role) return '';
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function defaultSlot() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    date: dayKey(start),
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  };
}

function meetingDayKeys(meeting) {
  const start = new Date(meeting.startAt);
  const end = new Date(meeting.endAt);
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0 &&
    end.getMilliseconds() === 0
  ) {
    last.setDate(last.getDate() - 1);
  }
  const keys = [];
  while (cursor <= last && keys.length < 62) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function otherParty(meeting, userId) {
  return meeting.organizer?.id === userId ? meeting.invitee : meeting.organizer;
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [meetings, setMeetings] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [pending, setPending] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [acting, setActing] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async ({ initial = false } = {}) => {
    const from = new Date(cursor.year, cursor.month, 1);
    const to = new Date(cursor.year, cursor.month + 1, 1);
    if (initial) setLoading(true);
    setError(null);
    try {
      const [meetingsRes, contactsRes] = await Promise.all([
        api.get('/meetings', { params: { from: from.toISOString(), to: to.toISOString() } }),
        api.get('/meetings/contacts'),
      ]);
      setMeetings(meetingsRes.data.meetings ?? []);
      setUpcoming(meetingsRes.data.upcoming ?? []);
      setPending(meetingsRes.data.pending ?? []);
      setContacts(contactsRes.data.contacts ?? []);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load calendar.');
    } finally {
      if (initial) setLoading(false);
    }
  }, [cursor.year, cursor.month]);

  useEffect(() => {
    load({ initial: true });
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const meeting of meetings) {
      for (const key of meetingDayKeys(meeting)) {
        const list = map.get(key) ?? [];
        list.push(meeting);
        map.set(key, list);
      }
    }
    return map;
  }, [meetings]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const count = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const items = Array(first.getDay()).fill(null);
    for (let day = 1; day <= count; day += 1) {
      items.push(new Date(cursor.year, cursor.month, day));
    }
    while (items.length % 7 !== 0) items.push(null);
    return items;
  }, [cursor.year, cursor.month]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  function shiftMonth(delta) {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  async function respond(meeting, action) {
    setActing({ id: meeting.id, action });
    try {
      await api.post(`/meetings/${meeting.id}/${action}`);
      toast.success(action === 'accept' ? 'Meeting accepted.' : 'Meeting declined.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not update the meeting.');
    } finally {
      setActing(null);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.post(`/meetings/${cancelTarget.id}/cancel`);
      toast.success('Meeting cancelled.');
      setCancelTarget(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not cancel the meeting.');
    } finally {
      setCancelling(false);
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
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="secondary" onClick={() => load({ initial: true })}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
        <Button onClick={() => setRequestOpen(true)} disabled={contacts.length === 0}>
          <CalendarPlus size={16} /> Request meeting
        </Button>
      </div>
      {contacts.length === 0 && (
        <p className="text-sm text-gray-500">No one you can meet with yet.</p>
      )}

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Requests for you</h2>
          <div className="space-y-2">
            {pending.map((meeting) => {
              const started = new Date(meeting.startAt).getTime() < Date.now();
              return (
                <article key={meeting.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{meeting.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {meeting.organizer?.name} · {formatWhen(meeting.startAt, meeting.endAt)}
                      </p>
                      {meeting.description && (
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{meeting.description}</p>
                      )}
                      {meeting.meetingLink && (
                        <a
                          href={meeting.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-700 hover:underline mt-1 inline-block"
                        >
                          Meeting link
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="success"
                        disabled={started || acting?.id === meeting.id}
                        loading={acting?.id === meeting.id && acting.action === 'accept'}
                        onClick={() => respond(meeting, 'accept')}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={acting?.id === meeting.id}
                        loading={acting?.id === meeting.id && acting.action === 'decline'}
                        onClick={() => respond(meeting, 'decline')}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                  {started && (
                    <p className="text-xs text-amber-800 mt-2">This meeting is in the past and can only be declined.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">{monthLabel}</h2>
            <button
              type="button"
              className="text-xs font-medium text-gray-500 hover:text-gray-800"
              onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
            >
              Today
            </button>
          </div>
          <button
            type="button"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {WEEKDAYS.map((label) => (
            <div key={label} className="bg-gray-50 text-center text-xs font-medium text-gray-500 py-2">
              {label}
            </div>
          ))}
          {cells.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="bg-gray-50 min-h-[5.5rem]" />;
            }
            const key = dayKey(date);
            const dayMeetings = byDay.get(key) ?? [];
            const isToday = dayKey(today) === key;
            return (
              <div key={key} className="bg-white min-h-[5.5rem] p-1.5">
                <p className={`text-xs mb-1 ${isToday ? 'font-bold text-slate-900' : 'text-gray-500'}`}>
                  {date.getDate()}
                </p>
                <div className="space-y-1">
                  {dayMeetings.slice(0, 2).map((meeting) => (
                    <p
                      key={meeting.id}
                      title={`${meeting.title} · ${formatWhen(meeting.startAt, meeting.endAt)}`}
                      className={`text-[11px] leading-tight px-1 py-0.5 rounded truncate ${
                        meeting.status === 'ACCEPTED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {formatClock(meeting.startAt)} {meeting.title}
                    </p>
                  ))}
                  {dayMeetings.length > 2 && (
                    <p className="text-[11px] text-gray-500 px-1">+{dayMeetings.length - 2} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-800">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl px-4 py-10 text-center">
            <p className="text-sm text-gray-600">No upcoming meetings.</p>
            {contacts.length > 0 && (
              <Button className="mt-3" size="sm" onClick={() => setRequestOpen(true)}>
                Request meeting
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((meeting) => {
              const other = otherParty(meeting, user?.id);
              return (
                <article key={meeting.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{meeting.title}</p>
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            meeting.status === 'ACCEPTED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {meeting.status === 'ACCEPTED' ? 'Accepted' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        With {other?.name} ({roleLabel(other?.role)}) · {formatWhen(meeting.startAt, meeting.endAt)}
                      </p>
                      {meeting.description && (
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{meeting.description}</p>
                      )}
                      {meeting.meetingLink && (
                        <a
                          href={meeting.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-700 hover:underline mt-1 inline-block"
                        >
                          Meeting link
                        </a>
                      )}
                    </div>
                    {meeting.isOrganizer && (
                      <Button size="sm" variant="danger" onClick={() => setCancelTarget(meeting)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {requestOpen && (
        <RequestMeetingModal
          contacts={contacts}
          onClose={() => setRequestOpen(false)}
          onCreated={async () => {
            setRequestOpen(false);
            await load();
          }}
        />
      )}

      <ConfirmModal
        open={!!cancelTarget}
        title="Cancel meeting?"
        message={cancelTarget ? `Cancel “${cancelTarget.title}”? The other person will be notified.` : ''}
        confirmLabel="Cancel meeting"
        variant="danger"
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => { if (!cancelling) setCancelTarget(null); }}
      />
    </div>
  );
}

function RequestMeetingModal({ contacts, onClose, onCreated }) {
  const slot = useMemo(() => defaultSlot(), []);
  const [form, setForm] = useState({
    inviteeId: contacts[0] ? String(contacts[0].id) : '',
    title: '',
    description: '',
    meetingLink: '',
    ...slot,
  });
  const [overlaps, setOverlaps] = useState([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [overlapOpen, setOverlapOpen] = useState(false);
  const [readyPayload, setReadyPayload] = useState(null);

  const todayKey = dayKey(new Date());

  useEffect(() => {
    const startAt = combineLocal(form.date, form.startTime);
    const endAt = combineLocal(form.date, form.endTime);
    if (!form.inviteeId || !startAt || !endAt || endAt <= startAt) {
      setOverlaps([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/meetings/conflicts', {
          params: {
            inviteeId: form.inviteeId,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
          },
        });
        if (!cancelled) setOverlaps(res.data.overlaps ?? []);
      } catch {
        if (!cancelled) setOverlaps([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.inviteeId, form.date, form.startTime, form.endTime]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload() {
    const title = form.title.trim();
    if (!form.inviteeId) return { error: 'Invitee is required' };
    if (!title) return { error: 'Title is required' };
    const startAt = combineLocal(form.date, form.startTime);
    const endAt = combineLocal(form.date, form.endTime);
    if (!startAt || !endAt) return { error: 'Invalid date or time' };
    if (endAt <= startAt) return { error: 'End time must be after the start time' };
    if (startAt.getTime() < Date.now()) return { error: 'Meetings cannot be in the past' };
    return {
      payload: {
        inviteeId: Number(form.inviteeId),
        title,
        description: form.description.trim(),
        meetingLink: form.meetingLink.trim(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      },
    };
  }

  async function lookupOverlaps(payload) {
    const res = await api.get('/meetings/conflicts', {
      params: {
        inviteeId: payload.inviteeId,
        startAt: payload.startAt,
        endAt: payload.endAt,
      },
    });
    return res.data.overlaps ?? [];
  }

  async function create(payload) {
    await api.post('/meetings', payload);
    toast.success('Meeting requested.');
    setOverlapOpen(false);
    await onCreated();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const built = buildPayload();
    if (built.error) {
      setFormError(built.error);
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      let found = overlaps;
      try {
        found = await lookupOverlaps(built.payload);
        setOverlaps(found);
      } catch (err) {
        const status = err.response?.status;
        if (status === 400 || status === 403) {
          setFormError(err.response?.data?.error ?? 'Could not check the invitee’s calendar.');
          setSubmitting(false);
          return;
        }
      }
      if (found.length > 0) {
        setReadyPayload(built.payload);
        setOverlapOpen(true);
        setSubmitting(false);
        return;
      }
      await create(built.payload);
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Could not request the meeting.');
      setSubmitting(false);
    }
  }

  async function confirmOverlap() {
    if (!readyPayload) return;
    setSubmitting(true);
    try {
      await create(readyPayload);
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Could not request the meeting.');
      setOverlapOpen(false);
      setSubmitting(false);
    }
  }

  const overlapMessage = overlaps.length
    ? `This overlaps ${overlaps.length === 1 ? 'an accepted meeting' : `${overlaps.length} accepted meetings`} for the invitee: ${overlaps.map((item) => item.title).join(', ')}. Request it anyway?`
    : '';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => { if (!submitting && !overlapOpen) onClose(); }} />
      <form
        onSubmit={onSubmit}
        className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-base font-semibold text-gray-900">Request meeting</h2>

        {formError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
        )}

        <Field label="Invitee" required>
          <select
            className={inputCls}
            value={form.inviteeId}
            onChange={(e) => setField('inviteeId', e.target.value)}
            disabled={submitting}
          >
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} ({roleLabel(contact.role)})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Title" required>
          <input
            className={inputCls}
            value={form.title}
            maxLength={200}
            onChange={(e) => setField('title', e.target.value)}
            disabled={submitting}
          />
        </Field>

        <Field label="Description">
          <textarea
            className={inputCls}
            rows={3}
            value={form.description}
            maxLength={2000}
            onChange={(e) => setField('description', e.target.value)}
            disabled={submitting}
          />
        </Field>

        <Field label="Date" required>
          <input
            type="date"
            className={inputCls}
            min={todayKey}
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
            disabled={submitting}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" required>
            <input
              type="time"
              className={inputCls}
              value={form.startTime}
              onChange={(e) => setField('startTime', e.target.value)}
              disabled={submitting}
            />
          </Field>
          <Field label="End" required>
            <input
              type="time"
              className={inputCls}
              value={form.endTime}
              onChange={(e) => setField('endTime', e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>

        <Field label="Meeting link">
          <input
            className={inputCls}
            value={form.meetingLink}
            placeholder="https://"
            onChange={(e) => setField('meetingLink', e.target.value)}
            disabled={submitting}
          />
        </Field>

        {overlaps.length > 0 && (
          <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Overlaps {overlaps.length === 1 ? 'an accepted meeting' : `${overlaps.length} accepted meetings`} for the invitee: {overlaps.map((item) => item.title).join(', ')}.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Close</Button>
          <Button type="submit" loading={submitting}>Request meeting</Button>
        </div>
      </form>

      <ConfirmModal
        open={overlapOpen}
        title="Schedule overlap"
        message={overlapMessage}
        confirmLabel="Request anyway"
        variant="primary"
        loading={submitting}
        onConfirm={confirmOverlap}
        onCancel={() => { if (!submitting) setOverlapOpen(false); }}
      />
    </div>
  );
}
