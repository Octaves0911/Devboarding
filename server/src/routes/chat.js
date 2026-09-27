const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { allowedContacts, findAllowedContact } = require('../lib/contacts');
const { onNewChatMessage } = require('../lib/notify');

const router = express.Router();

const MAX_BODY = 2000;

function pairIds(a, b) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

function otherIdOf(conv, userId) {
  return conv.userAId === userId ? conv.userBId : conv.userAId;
}

async function loadAccessibleConversation(user, rawId) {
  const id = parseInt(rawId, 10);
  if (!Number.isInteger(id)) return { error: { status: 400, message: 'Invalid id' } };

  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv || (conv.userAId !== user.id && conv.userBId !== user.id)) {
    return { error: { status: 404, message: 'Conversation not found' } };
  }

  const other = await findAllowedContact(user, otherIdOf(conv, user.id));
  if (!other) return { error: { status: 403, message: 'You cannot access this conversation' } };
  return { conv, other };
}

// GET /api/chat/contacts — allowed contacts with unread counts
router.get('/chat/contacts', authenticate, async (req, res) => {
  try {
    const contacts = await allowedContacts(req.user);
    const ids = contacts.map((c) => c.id);
    if (ids.length === 0) return res.json({ contacts: [] });

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { userAId: req.user.id, userBId: { in: ids } },
          { userBId: req.user.id, userAId: { in: ids } },
        ],
      },
      include: {
        _count: {
          select: {
            messages: { where: { readAt: null, senderId: { not: req.user.id } } },
          },
        },
      },
    });

    const byOther = new Map();
    for (const conv of conversations) {
      byOther.set(otherIdOf(conv, req.user.id), conv);
    }

    const list = contacts.map((contact) => {
      const conv = byOther.get(contact.id);
      return {
        ...contact,
        unreadCount: conv?._count.messages ?? 0,
        conversationId: conv?.id ?? null,
        lastMessageAt: conv?.lastMessageAt ?? null,
      };
    });

    list.sort((a, b) => {
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name);
    });

    return res.json({ contacts: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/chat/conversations — open (get or create) a conversation with an allowed contact
router.post('/chat/conversations', authenticate, async (req, res) => {
  try {
    const other = await findAllowedContact(req.user, req.body?.userId);
    if (!other) return res.status(403).json({ error: 'You cannot message this user' });

    const pair = pairIds(req.user.id, other.id);
    let conversation = await prisma.conversation.findUnique({
      where: { userAId_userBId: pair },
    });
    if (!conversation) {
      try {
        conversation = await prisma.conversation.create({ data: pair });
      } catch (err) {
        if (err.code !== 'P2002') throw err;
        conversation = await prisma.conversation.findUnique({
          where: { userAId_userBId: pair },
        });
      }
    }

    return res.json({
      conversation: {
        id: conversation.id,
        lastMessageAt: conversation.lastMessageAt,
        otherUser: other,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/chat/conversations/:id/messages — participant + still an allowed contact
router.get('/chat/conversations/:id/messages', authenticate, async (req, res) => {
  try {
    const loaded = await loadAccessibleConversation(req.user, req.params.id);
    if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });

    await prisma.chatMessage.updateMany({
      where: {
        conversationId: loaded.conv.id,
        senderId: { not: req.user.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: loaded.conv.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        body: true,
        createdAt: true,
        readAt: true,
      },
    });

    return res.json({ messages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/chat/conversations/:id/messages
router.post('/chat/conversations/:id/messages', authenticate, async (req, res) => {
  try {
    const loaded = await loadAccessibleConversation(req.user, req.params.id);
    if (loaded.error) return res.status(loaded.error.status).json({ error: loaded.error.message });

    const text = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (!text) return res.status(400).json({ error: 'Message cannot be empty' });
    if (text.length > MAX_BODY) {
      return res.status(400).json({ error: `Message must be ${MAX_BODY} characters or fewer` });
    }

    const now = new Date();
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId: loaded.conv.id,
          senderId: req.user.id,
          body: text,
        },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          body: true,
          createdAt: true,
          readAt: true,
        },
      });
      await tx.conversation.update({
        where: { id: loaded.conv.id },
        data: { lastMessageAt: now },
      });
      return created;
    });

    await onNewChatMessage({
      recipientId: loaded.other.id,
      sender: { id: req.user.id, name: req.user.name },
      body: text,
    });

    return res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
