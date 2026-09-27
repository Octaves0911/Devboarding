const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { allowedContacts, findAllowedContact } = require('../lib/contacts');
const { onMeetingRequest, onMeetingResponse, onMeetingCancel } = require('../lib/notify');

const router = express.Router();

const PERSON = { id: true, name: true, role: true };
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

function parseInstant(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseRange(fromRaw, toRaw) {
  const from = parseInstant(fromRaw);
  const to = parseInstant(toRaw);
  if (!from || !to || from >= to) return null;
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) return null;
  return { from, to };
}

function normalizeLink(value) {
  if (value == null || value === '') return { link: null };
  if (typeof value !== 'string') return { error: 'Meeting link must be a valid URL' };
  const trimmed = value.trim();
  if (!trimmed) return { link: null };
  if (trimmed.length > 500) return { error: 'Meeting link must be a valid URL' };
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { error: 'Meeting link must be a valid URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'Meeting link must be a valid URL' };
  }
  if (!url.hostname || !url.hostname.includes('.')) {
    return { error: 'Meeting link must be a valid URL' };
  }
  return { link: url.toString() };
}

function shape(meeting, userId) {
  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    meetingLink: meeting.meetingLink,
    startAt: meeting.startAt,
    endAt: meeting.endAt,
    status: meeting.status,
    organizer: meeting.organizer,
    invitee: meeting.invitee,
    isOrganizer: meeting.organizerId === userId,
  };
}

const includePeople = {
  organizer: { select: PERSON },
  invitee: { select: PERSON },
};

async function inviteeOverlaps(inviteeId, startAt, endAt) {
  return prisma.meeting.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ organizerId: inviteeId }, { inviteeId }],
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true, title: true, startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
  });
}

async function loadMeeting(user, rawId) {
  const id = parseInt(rawId, 10);
  if (!Number.isInteger(id)) return { error: { status: 400, message: 'Invalid id' } };

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: includePeople,
  });
  if (!meeting || (meeting.organizerId !== user.id && meeting.inviteeId !== user.id)) {
    return { error: { status: 404, message: 'Meeting not found' } };
  }
  return { meeting };
}

function readSchedule(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: 'Title is required' };
  if (title.length > MAX_TITLE) return { error: `Title must be ${MAX_TITLE} characters or fewer` };

  let description = null;
  if (body.description != null && body.description !== '') {
    if (typeof body.description !== 'string') return { error: 'Invalid description' };
    description = body.description.trim();
    if (description.length > MAX_DESCRIPTION) {
      return { error: `Description must be ${MAX_DESCRIPTION} characters or fewer` };
    }
    if (!description) description = null;
  }

  const link = normalizeLink(body.meetingLink);
  if (link.error) return { error: link.error };

  const startAt = parseInstant(body.startAt);
  const endAt = parseInstant(body.endAt);
  if (!startAt || !endAt) return { error: 'Invalid date or time' };
  if (endAt <= startAt) return { error: 'End time must be after the start time' };
  if (startAt.getTime() < Date.now()) return { error: 'Meetings cannot be in the past' };

  return { title, description, meetingLink: link.link, startAt, endAt };
}

// GET /api/meetings/contacts — people the user may invite
router.get('/meetings/contacts', authenticate, async (req, res) => {
  try {
    const contacts = await allowedContacts(req.user);
    return res.json({ contacts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/meetings/conflicts — accepted meetings on the invitee's calendar that overlap
router.get('/meetings/conflicts', authenticate, async (req, res) => {
  try {
    const invitee = await findAllowedContact(req.user, req.query.inviteeId);
    if (!invitee) {
      return res.status(403).json({ error: 'You cannot request a meeting with this user' });
    }

    const startAt = parseInstant(req.query.startAt);
    const endAt = parseInstant(req.query.endAt);
    if (!startAt || !endAt) return res.status(400).json({ error: 'Invalid date or time' });
    if (endAt <= startAt) return res.status(400).json({ error: 'End time must be after the start time' });

    const overlaps = await inviteeOverlaps(invitee.id, startAt, endAt);
    return res.json({ overlaps });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/meetings?from=&to= — month grid, upcoming, and requests waiting on this user
router.get('/meetings', authenticate, async (req, res) => {
  try {
    let from;
    let to;
    if (req.query.from || req.query.to) {
      const range = parseRange(req.query.from, req.query.to);
      if (!range) return res.status(400).json({ error: 'Invalid date range' });
      from = range.from;
      to = range.to;
    } else {
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const participant = {
      OR: [{ organizerId: req.user.id }, { inviteeId: req.user.id }],
    };
    const visible = { status: { in: ['PENDING', 'ACCEPTED'] } };
    const now = new Date();

    const [monthRows, upcomingRows, pendingRows] = await Promise.all([
      prisma.meeting.findMany({
        where: {
          AND: [participant, visible, { startAt: { lt: to } }, { endAt: { gt: from } }],
        },
        include: includePeople,
        orderBy: { startAt: 'asc' },
      }),
      prisma.meeting.findMany({
        where: { AND: [participant, visible, { endAt: { gt: now } }] },
        include: includePeople,
        orderBy: { startAt: 'asc' },
      }),
      prisma.meeting.findMany({
        where: { inviteeId: req.user.id, status: 'PENDING', endAt: { gt: now } },
        include: includePeople,
        orderBy: { startAt: 'asc' },
      }),
    ]);

    return res.json({
      meetings: monthRows.map((row) => shape(row, req.user.id)),
      upcoming: upcomingRows
        .filter((row) => row.status === 'ACCEPTED' || row.organizerId === req.user.id)
        .map((row) => shape(row, req.user.id)),
      pending: pendingRows.map((row) => shape(row, req.user.id)),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/meetings — organizer requests a meeting with an allowed contact
router.post('/meetings', authenticate, async (req, res) => {
  try {
    const invitee = await findAllowedContact(req.user, req.body?.inviteeId);
    if (!invitee) {
      return res.status(403).json({ error: 'You cannot request a meeting with this user' });
    }

    const schedule = readSchedule(req.body);
    if (schedule.error) return res.status(400).json({ error: schedule.error });

    const meeting = await prisma.meeting.create({
      data: {
        organizerId: req.user.id,
        inviteeId: invitee.id,
        title: schedule.title,
        description: schedule.description,
        meetingLink: schedule.meetingLink,
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        status: 'PENDING',
      },
      include: includePeople,
    });

    await onMeetingRequest({
      inviteeId: invitee.id,
      organizer: { id: req.user.id, name: req.user.name },
      title: meeting.title,
      startAt: meeting.startAt,
      endAt: meeting.endAt,
    });

    return res.status(201).json({ meeting: shape(meeting, req.user.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function respond(req, res, status) {
  const loaded = await loadMeeting(req.user, req.params.id);
  if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });

  const { meeting } = loaded;
  if (meeting.inviteeId !== req.user.id) {
    return res.status(403).json({ error: 'Only the invitee can accept or decline' });
  }
  if (meeting.status !== 'PENDING') {
    return res.status(400).json({ error: 'This request is no longer pending' });
  }
  if (status === 'ACCEPTED' && meeting.startAt.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Meetings cannot be in the past' });
  }

  const result = await prisma.meeting.updateMany({
    where: { id: meeting.id, status: 'PENDING', inviteeId: req.user.id },
    data: { status },
  });
  if (result.count === 0) {
    return res.status(400).json({ error: 'This request is no longer pending' });
  }

  const updated = await prisma.meeting.findUnique({
    where: { id: meeting.id },
    include: includePeople,
  });

  await onMeetingResponse({
    organizerId: updated.organizerId,
    invitee: { id: req.user.id, name: req.user.name },
    title: updated.title,
    status,
    startAt: updated.startAt,
    endAt: updated.endAt,
  });

  return res.json({ meeting: shape(updated, req.user.id) });
}

// POST /api/meetings/:id/accept — invitee only
router.post('/meetings/:id/accept', authenticate, (req, res) => respond(req, res, 'ACCEPTED').catch((err) => {
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}));

// POST /api/meetings/:id/decline — invitee only
router.post('/meetings/:id/decline', authenticate, (req, res) => respond(req, res, 'DECLINED').catch((err) => {
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}));

// POST /api/meetings/:id/cancel — organizer only
router.post('/meetings/:id/cancel', authenticate, async (req, res) => {
  try {
    const loaded = await loadMeeting(req.user, req.params.id);
    if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });

    const { meeting } = loaded;
    if (meeting.organizerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the organizer can cancel' });
    }
    if (meeting.status !== 'PENDING' && meeting.status !== 'ACCEPTED') {
      return res.status(400).json({ error: 'This meeting cannot be cancelled' });
    }

    const result = await prisma.meeting.updateMany({
      where: {
        id: meeting.id,
        organizerId: req.user.id,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      data: { status: 'CANCELLED' },
    });
    if (result.count === 0) {
      return res.status(400).json({ error: 'This meeting cannot be cancelled' });
    }

    const updated = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: includePeople,
    });

    await onMeetingCancel({
      recipientId: updated.inviteeId,
      actor: { id: req.user.id, name: req.user.name },
      title: updated.title,
      startAt: updated.startAt,
      endAt: updated.endAt,
    });

    return res.json({ meeting: shape(updated, req.user.id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
