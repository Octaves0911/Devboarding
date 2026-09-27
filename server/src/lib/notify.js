const prisma = require('./prisma');

const STATUS_LABEL = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

/**
 * Create one notification per user. Link may be a string or (user) => string.
 * Failures are logged and swallowed so the calling action still succeeds.
 * exceptId is never notified (the actor).
 */
async function notify(userIds, payload, exceptId = null) {
  try {
    const skip = exceptId == null ? null : parseInt(exceptId, 10);
    const ids = [...new Set(
      (Array.isArray(userIds) ? userIds : [userIds])
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0 && id !== skip),
    )];
    if (ids.length === 0 || !payload?.type || !payload?.title) return;

    const users = await prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, role: true },
    });
    if (users.length === 0) return;

    await prisma.notification.createMany({
      data: users.map((user) => {
        const link = typeof payload.link === 'function' ? payload.link(user) : payload.link;
        return {
          userId: user.id,
          type: String(payload.type).slice(0, 50),
          title: String(payload.title).slice(0, 200),
          body: String(payload.body ?? '').slice(0, 500),
          link: link || null,
          isRead: false,
        };
      }),
    });
  } catch (err) {
    console.error('notify failed:', err);
  }
}

function taskLink(user, task) {
  const id = task.id;
  if (user.role === 'ADMIN') return '/admin/tasks';
  if (user.role === 'HR') return `/hr/tasks/${id}`;
  if (user.role === 'MENTEE') return `/mentee/tasks/${id}`;
  if (user.role === 'MENTOR') {
    if (task.assigneeId === user.id && task.createdById !== user.id) {
      return `/mentor/my-tasks/${id}`;
    }
    return `/mentor/tasks/${id}`;
  }
  return null;
}

function workspaceLink(user, task) {
  if (!task.hasWorkspace) return taskLink(user, task);
  const prefix = { ADMIN: 'admin', HR: 'hr', MENTOR: 'mentor', MENTEE: 'mentee' }[user.role];
  return prefix ? `/${prefix}/workspace/${task.id}` : taskLink(user, task);
}

function listLink(user) {
  if (user.role === 'MENTEE') return '/mentee/tasks';
  if (user.role === 'MENTOR') return '/mentor/my-tasks';
  if (user.role === 'HR') return '/hr/my-tasks';
  if (user.role === 'ADMIN') return '/admin/tasks';
  return null;
}

function statusLabel(status) {
  return STATUS_LABEL[status] || status;
}

/** Task creator plus the assignee's mentor when the assignee is a mentee. Excludes actorId. */
async function aiReviewRecipientIds(task, actorId) {
  const ids = [];
  if (task.createdById && task.createdById !== actorId) ids.push(task.createdById);
  const assignee = await prisma.user.findUnique({
    where: { id: task.assigneeId },
    select: { role: true, mentorId: true },
  });
  if (assignee?.role === 'MENTEE' && assignee.mentorId && assignee.mentorId !== actorId) {
    ids.push(assignee.mentorId);
  }
  return [...new Set(ids)];
}

function chatLink(user, otherUserId) {
  const prefix = { ADMIN: 'admin', HR: 'hr', MENTOR: 'mentor', MENTEE: 'mentee' }[user.role];
  return prefix ? `/${prefix}/chat?with=${otherUserId}` : null;
}

function calendarLink(user) {
  const prefix = { ADMIN: 'admin', HR: 'hr', MENTOR: 'mentor', MENTEE: 'mentee' }[user.role];
  return prefix ? `/${prefix}/calendar` : null;
}

function formatRange(startAt, endAt) {
  if (!startAt || !endAt) return '';
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time(start)} – ${time(end)}`;
}

/** Notify the recipient of a new chat message. No-op if the payload is incomplete. */
async function onNewChatMessage(event) {
  if (!event?.recipientId || !event?.sender?.id || !event?.sender?.name) return;
  const preview = String(event.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
  await notify([event.recipientId], {
    type: 'CHAT_MESSAGE',
    title: `New message from ${event.sender.name}`,
    body: preview,
    link: (user) => chatLink(user, event.sender.id),
  }, event.sender.id);
}

async function onMeetingRequest(event) {
  if (!event?.inviteeId || !event?.organizer?.id || !event?.organizer?.name || !event?.title) return;
  const when = formatRange(event.startAt, event.endAt);
  await notify([event.inviteeId], {
    type: 'MEETING_REQUEST',
    title: `Meeting request from ${event.organizer.name}`,
    body: when ? `${event.title} · ${when}` : event.title,
    link: (user) => calendarLink(user),
  }, event.organizer.id);
}

async function onMeetingResponse(event) {
  if (!event?.organizerId || !event?.invitee?.id || !event?.invitee?.name || !event?.title) return;
  const accepted = event.status === 'ACCEPTED';
  const when = formatRange(event.startAt, event.endAt);
  await notify([event.organizerId], {
    type: 'MEETING_RESPONSE',
    title: `${event.invitee.name} ${accepted ? 'accepted' : 'declined'} your meeting`,
    body: when ? `${event.title} · ${when}` : event.title,
    link: (user) => calendarLink(user),
  }, event.invitee.id);
}

async function onMeetingCancel(event) {
  if (!event?.recipientId || !event?.actor?.id || !event?.actor?.name || !event?.title) return;
  const when = formatRange(event.startAt, event.endAt);
  await notify([event.recipientId], {
    type: 'MEETING_CANCELLED',
    title: `${event.actor.name} cancelled a meeting`,
    body: when ? `${event.title} · ${when}` : event.title,
    link: (user) => calendarLink(user),
  }, event.actor.id);
}

module.exports = {
  notify,
  taskLink,
  workspaceLink,
  listLink,
  statusLabel,
  aiReviewRecipientIds,
  onNewChatMessage,
  onMeetingRequest,
  onMeetingResponse,
  onMeetingCancel,
};
