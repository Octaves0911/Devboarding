const express = require('express');
const bcrypt = require('bcrypt');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

const SAFE_USER_SELECT = {
  id: true, name: true, email: true, role: true,
  phone: true, department: true, designation: true,
  joiningDate: true, mentorId: true, isActive: true, createdAt: true,
};

// GET /api/users/mentors — active mentors list (used by admin create-user form)
router.get('/users/mentors', authenticate, authorize('ADMIN', 'HR', 'MENTOR', 'MENTEE'), async (req, res) => {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: 'MENTOR', isActive: true },
      select: SAFE_USER_SELECT,
      orderBy: { name: 'asc' },
    });
    return res.json({ mentors });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/my-mentor — MENTEE: own assigned mentor
router.get('/users/my-mentor', authenticate, authorize('MENTEE'), async (req, res) => {
  try {
    if (!req.user.mentorId) return res.status(404).json({ error: 'No mentor assigned' });
    const mentor = await prisma.user.findUnique({
      where: { id: req.user.mentorId },
      select: { id: true, name: true, email: true, phone: true, department: true, designation: true },
    });
    if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
    return res.json({ mentor });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/my-mentees — MENTOR: own mentees
router.get('/users/my-mentees', authenticate, authorize('MENTOR'), async (req, res) => {
  try {
    const mentees = await prisma.user.findMany({
      where: { mentorId: req.user.id, isActive: true },
      select: SAFE_USER_SELECT,
      orderBy: { name: 'asc' },
    });
    return res.json({ mentees });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users — ADMIN & HR: all users; MENTOR: own mentees only
router.get('/users', authenticate, authorize('ADMIN', 'HR', 'MENTOR'), async (req, res) => {
  try {
    let where = {};
    if (req.user.role === 'MENTOR') {
      where = { mentorId: req.user.id };
    }

    const { role, search } = req.query;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        ...SAFE_USER_SELECT,
        mentor: { select: { id: true, name: true, email: true } },
        mentees: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id — ADMIN & HR: any user; MENTOR: own mentees only
router.get('/users/:id', authenticate, authorize('ADMIN', 'HR', 'MENTOR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...SAFE_USER_SELECT,
        mentor: { select: { id: true, name: true, email: true, designation: true, department: true } },
        mentees: { select: { id: true, name: true, email: true } },
        tasksAssigned: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { id: true, name: true, role: true } } },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // MENTOR can only view own mentees
    if (req.user.role === 'MENTOR' && user.mentorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users — ADMIN only
router.post('/users', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, email, password, role, phone, department, designation, joiningDate, mentorId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }
    if (!['HR', 'MENTOR', 'MENTEE'].includes(role)) {
      return res.status(400).json({ error: 'role must be HR, MENTOR, or MENTEE' });
    }
    if (role === 'MENTEE' && !mentorId) {
      return res.status(400).json({ error: 'mentorId is required for MENTEE' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    if (mentorId) {
      const mentor = await prisma.user.findUnique({ where: { id: parseInt(mentorId, 10) } });
      if (!mentor || mentor.role !== 'MENTOR' || !mentor.isActive) {
        return res.status(400).json({ error: 'Invalid or inactive mentor' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const data = {
      name, email, passwordHash, role,
      phone: phone || null,
      department: department || null,
      designation: role === 'MENTOR' ? (designation || null) : null,
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      mentorId: role === 'MENTEE' ? parseInt(mentorId, 10) : null,
    };

    const user = await prisma.user.create({ data, select: SAFE_USER_SELECT });
    return res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id — ADMIN only
router.put('/users/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const { name, email, phone, department, designation, joiningDate, mentorId } = req.body;

    if (email && email !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email } });
      if (dup) return res.status(409).json({ error: 'Email already in use' });
    }

    if (mentorId && existing.role === 'MENTEE') {
      const mentor = await prisma.user.findUnique({ where: { id: parseInt(mentorId, 10) } });
      if (!mentor || mentor.role !== 'MENTOR' || !mentor.isActive) {
        return res.status(400).json({ error: 'Invalid or inactive mentor' });
      }
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (department !== undefined) data.department = department;
    if (designation !== undefined && existing.role === 'MENTOR') data.designation = designation;
    if (joiningDate !== undefined) data.joiningDate = joiningDate ? new Date(joiningDate) : null;
    if (mentorId !== undefined && existing.role === 'MENTEE') data.mentorId = parseInt(mentorId, 10);

    const user = await prisma.user.update({ where: { id }, data, select: SAFE_USER_SELECT });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id/status — ADMIN only: activate/deactivate
router.patch('/users/:id/status', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive (boolean) is required' });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own status' });
    }

    // Block deactivate (and enforced also for delete below) when mentor has mentees
    if (!isActive && existing.role === 'MENTOR') {
      const menteeCount = await prisma.user.count({ where: { mentorId: id, isActive: true } });
      if (menteeCount > 0) {
        return res.status(409).json({ error: `Cannot deactivate: this mentor has ${menteeCount} active mentee(s). Reassign them first.` });
      }
    }

    const user = await prisma.user.update({ where: { id }, data: { isActive }, select: SAFE_USER_SELECT });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id — ADMIN only
router.delete('/users/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });
    if (existing.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    if (existing.role === 'MENTOR') {
      const menteeCount = await prisma.user.count({ where: { mentorId: id } });
      if (menteeCount > 0) {
        return res.status(409).json({ error: `Cannot delete: this mentor has ${menteeCount} mentee(s). Reassign them first.` });
      }
    }

    await prisma.user.delete({ where: { id } });
    return res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
