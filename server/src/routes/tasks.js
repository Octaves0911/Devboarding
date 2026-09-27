const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { logActivity, canViewTask } = require('../lib/activity');
const { randomUUID } = require('crypto');

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

/**
 * Validate that `assigneeId` satisfies the creator's permission rules.
 * Returns an error string, or null if valid.
 */
async function validateAssigneePermission(creatorRole, creatorId, assigneeId) {
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!assignee || !assignee.isActive) {
    return 'Assignee not found or inactive';
  }

  if (creatorRole === 'HR') {
    if (!['HR', 'MENTOR', 'MENTEE'].includes(assignee.role)) {
      return 'HR can only assign tasks to HR, MENTOR, or MENTEE users';
    }
  }

  if (creatorRole === 'MENTOR') {
    if (assignee.role !== 'MENTEE' || assignee.mentorId !== creatorId) {
      return 'MENTOR can only assign tasks to their own mentees';
    }
  }

  return null;
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

// POST /api/tasks — HR: any active HR/MENTOR/MENTEE; MENTOR: own mentees only
// Accepts assigneeId (single, backward compat) or assigneeIds (array).
// When multiple assignees: creates one task copy per assignee in a transaction,
// all sharing a new batchId. If any assignee fails permission → 403, nothing created.
router.post('/tasks', authenticate, authorize('HR', 'MENTOR'), async (req, res) => {
  try {
    const { title, description, priority, dueDate, subtasks } = req.body;

    // Normalise assignee list
    let rawIds = req.body.assigneeIds ?? (req.body.assigneeId ? [req.body.assigneeId] : []);
    if (!Array.isArray(rawIds)) rawIds = [rawIds];
    const assigneeIdInts = rawIds.map((id) => parseInt(id, 10));

    if (!title || !description || !priority || !dueDate || assigneeIdInts.length === 0) {
      return res.status(400).json({ error: 'title, description, priority, dueDate, and assigneeId(s) are required' });
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

    // Validate all assignees before creating anything
    for (const assigneeId of assigneeIdInts) {
      const permErr = await validateAssigneePermission(req.user.role, req.user.id, assigneeId);
      if (permErr) {
        return res.status(403).json({ error: permErr });
      }
    }

    // Single batchId for multi-assign (null for single)
    const batchId = assigneeIdInts.length > 1 ? randomUUID() : null;

    // Build create operations for all task copies
    const taskOps = assigneeIdInts.map((assigneeId) =>
      prisma.task.create({
        data: {
          title,
          description,
          priority,
          dueDate: due,
          createdById: req.user.id,
          assigneeId,
          batchId,
          subtasks: subtasks && subtasks.length > 0
            ? { create: subtasks.map((s, i) => ({ title: s.title, order: i })) }
            : undefined,
        },
        include: TASK_INCLUDE,
      })
    );

    const createdTasks = await prisma.$transaction(taskOps);

    // Log CREATED activity for each task
    await prisma.$transaction(
      createdTasks.map((t) =>
        prisma.taskActivity.create({
          data: { taskId: t.id, userId: req.user.id, action: 'CREATED' },
        })
      )
    );

    // Return single task for single-assignee (backward compat), array for multi
    if (createdTasks.length === 1) {
      return res.status(201).json({ task: createdTasks[0] });
    }
    return res.status(201).json({ tasks: createdTasks, batchId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tasks/:id — creator only
// Accepts optional assigneeId to reassign. On reassign: status→TODO, subtasks unticked,
// completionNote/completedAt cleared, logs REASSIGNED activity.
router.put('/tasks/:id', authenticate, authorize('HR', 'MENTOR'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const task = await prisma.task.findUnique({ where: { id }, include: { subtasks: true } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.createdById !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, priority, dueDate, subtasks, assigneeId } = req.body;

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

    let reassigned = false;

    // Handle reassignment
    if (assigneeId !== undefined) {
      const newAssigneeId = parseInt(assigneeId, 10);
      if (newAssigneeId !== task.assigneeId) {
        const permErr = await validateAssigneePermission(req.user.role, req.user.id, newAssigneeId);
        if (permErr) return res.status(403).json({ error: permErr });

        data.assigneeId = newAssigneeId;
        data.status = 'TODO';
        data.completionNote = null;
        data.completedAt = null;
        reassigned = true;
      }
    }

    // Replace subtasks if provided
    if (subtasks !== undefined) {
      await prisma.subtask.deleteMany({ where: { taskId: id } });
      data.subtasks = { create: subtasks.map((s, i) => ({ title: s.title, order: i })) };
    } else if (reassigned && task.subtasks.length > 0) {
      // Untick all subtasks on reassign
      await prisma.subtask.updateMany({ where: { taskId: id }, data: { isDone: false } });
    }

    const updated = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });

    if (reassigned) {
      await logActivity(id, req.user.id, 'REASSIGNED');
    }

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
