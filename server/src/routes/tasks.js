const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { logActivity, canViewTask } = require('../lib/activity');

const router = express.Router();

const TASK_INCLUDE = {
  createdBy: { select: { id: true, name: true, role: true } },
  assignee: { select: { id: true, name: true, role: true } },
  subtasks: { orderBy: { order: 'asc' } },
  attachments: { orderBy: { createdAt: 'asc' } },
  activities: {
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, role: true } } },
  },
};

// Build a Prisma `where` clause scoped to what this user can see.
async function taskWhereForUser(user, overrides = {}) {
  if (user.role === 'ADMIN' || user.role === 'HR') {
    return overrides;
  }

  if (user.role === 'MENTOR') {
    const mentees = await prisma.user.findMany({
      where: { mentorId: user.id },
      select: { id: true },
    });
    const menteeIds = mentees.map((m) => m.id);
    return {
      ...overrides,
      OR: [
        { createdById: user.id },
        { assigneeId: user.id },
        { assigneeId: { in: menteeIds } },
      ],
    };
  }

  // MENTEE
  return { ...overrides, assigneeId: user.id };
}

// GET /api/tasks
router.get('/tasks', authenticate, authorize('ADMIN', 'HR', 'MENTOR', 'MENTEE'), async (req, res) => {
  try {
    const { status, assigneeId, createdById, scope } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (assigneeId) filters.assigneeId = parseInt(assigneeId, 10);
    if (createdById) filters.createdById = parseInt(createdById, 10);

    // scope=created|assigned overrides default visibility for HR/MENTOR tabs
    if (scope === 'created') filters.createdById = req.user.id;
    if (scope === 'assigned') filters.assigneeId = req.user.id;

    const where = await taskWhereForUser(req.user, filters);
    const tasks = await prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ tasks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/:id
router.get('/tasks/:id', authenticate, authorize('ADMIN', 'HR', 'MENTOR', 'MENTEE'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (!(await canViewTask(req.user, task))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({ task });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks — HR: any active HR/MENTOR/MENTEE; MENTOR: own mentees only; ADMIN/MENTEE: 403
router.post('/tasks', authenticate, authorize('HR', 'MENTOR'), async (req, res) => {
  try {
    const { title, description, priority, dueDate, assigneeId, subtasks } = req.body;

    if (!title || !description || !priority || !dueDate || !assigneeId) {
      return res.status(400).json({ error: 'title, description, priority, dueDate, and assigneeId are required' });
    }
    if (title.length > 120) return res.status(400).json({ error: 'title must be 120 chars or fewer' });
    if (description.length < 10) return res.status(400).json({ error: 'description must be at least 10 chars' });
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
      return res.status(400).json({ error: 'priority must be LOW, MEDIUM, or HIGH' });
    }
    const due = new Date(dueDate);
    if (isNaN(due.getTime()) || due < new Date()) {
      return res.status(400).json({ error: 'dueDate must be a valid future date' });
    }

    const assigneeIdInt = parseInt(assigneeId, 10);
    const assignee = await prisma.user.findUnique({ where: { id: assigneeIdInt } });
    if (!assignee || !assignee.isActive) {
      return res.status(400).json({ error: 'Assignee not found or inactive' });
    }

    if (req.user.role === 'HR') {
      if (!['HR', 'MENTOR', 'MENTEE'].includes(assignee.role)) {
        return res.status(403).json({ error: 'HR can only assign tasks to HR, MENTOR, or MENTEE users' });
      }
    }

    if (req.user.role === 'MENTOR') {
      if (!['MENTEE'].includes(assignee.role) || assignee.mentorId !== req.user.id) {
        return res.status(403).json({ error: 'MENTOR can only assign tasks to their own mentees' });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority,
        dueDate: due,
        createdById: req.user.id,
        assigneeId: assigneeIdInt,
        subtasks: subtasks && subtasks.length > 0
          ? { create: subtasks.map((s, i) => ({ title: s.title, order: i })) }
          : undefined,
      },
      include: TASK_INCLUDE,
    });

    await logActivity(task.id, req.user.id, 'CREATED');
    return res.status(201).json({ task });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tasks/:id — creator only
router.put('/tasks/:id', authenticate, authorize('HR', 'MENTOR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const task = await prisma.task.findUnique({ where: { id }, include: { subtasks: true } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.createdById !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, priority, dueDate, subtasks } = req.body;

    if (title !== undefined && title.length > 120) {
      return res.status(400).json({ error: 'title must be 120 chars or fewer' });
    }
    if (description !== undefined && description.length < 10) {
      return res.status(400).json({ error: 'description must be at least 10 chars' });
    }
    if (priority !== undefined && !['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
      return res.status(400).json({ error: 'priority must be LOW, MEDIUM, or HIGH' });
    }
    let due;
    if (dueDate !== undefined) {
      due = new Date(dueDate);
      if (isNaN(due.getTime()) || due < new Date()) {
        return res.status(400).json({ error: 'dueDate must be a valid future date' });
      }
    }

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = priority;
    if (due !== undefined) data.dueDate = due;

    // Replace subtasks if provided
    if (subtasks !== undefined) {
      await prisma.subtask.deleteMany({ where: { taskId: id } });
      data.subtasks = { create: subtasks.map((s, i) => ({ title: s.title, order: i })) };
    }

    const updated = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });
    return res.json({ task: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id — creator only
router.delete('/tasks/:id', authenticate, authorize('HR', 'MENTOR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.createdById !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.task.delete({ where: { id } });
    return res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id/status — assignee only
router.patch('/tasks/:id/status', authenticate, authorize('HR', 'MENTOR', 'MENTEE'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const task = await prisma.task.findUnique({ where: { id }, include: { subtasks: true } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.assigneeId !== req.user.id) return res.status(403).json({ error: 'Forbidden: only the assignee can change status' });

    const { status, completionNote } = req.body;
    const validTransitions = { TODO: ['IN_PROGRESS'], IN_PROGRESS: ['TODO', 'DONE'], DONE: ['IN_PROGRESS'] };
    if (!validTransitions[task.status] || !validTransitions[task.status].includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${task.status} to ${status}` });
    }

    if (status === 'DONE') {
      const undone = task.subtasks.filter((s) => !s.isDone);
      if (undone.length > 0) {
        return res.status(400).json({ error: `Cannot mark DONE: ${undone.length} subtask(s) not completed` });
      }
    }

    const data = { status };
    if (status === 'DONE') {
      data.completedAt = new Date();
      if (completionNote !== undefined) data.completionNote = completionNote;
    }
    if (status === 'IN_PROGRESS' && task.status === 'DONE') {
      data.completedAt = null;
      data.completionNote = null;
    }

    const updated = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });
    await logActivity(id, req.user.id, 'STATUS_CHANGED', task.status, status);
    return res.json({ task: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
