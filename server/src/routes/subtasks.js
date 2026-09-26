const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { logActivity } = require('../lib/activity');

const router = express.Router();

// PATCH /api/subtasks/:id/toggle — assignee only
router.patch('/subtasks/:id/toggle', authenticate, authorize('HR', 'MENTOR', 'MENTEE'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const subtask = await prisma.subtask.findUnique({
      where: { id },
      include: { task: { include: { subtasks: true } } },
    });
    if (!subtask) return res.status(404).json({ error: 'Subtask not found' });
    if (subtask.task.assigneeId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: only the task assignee can toggle subtasks' });
    }

    const newIsDone = !subtask.isDone;
    const updated = await prisma.subtask.update({ where: { id }, data: { isDone: newIsDone } });

    await logActivity(
      subtask.taskId,
      req.user.id,
      newIsDone ? 'SUBTASK_COMPLETED' : 'SUBTASK_UNCHECKED',
    );

    // If a subtask is unticked on a DONE task, revert task status to IN_PROGRESS
    if (!newIsDone && subtask.task.status === 'DONE') {
      await prisma.task.update({
        where: { id: subtask.taskId },
        data: { status: 'IN_PROGRESS', completedAt: null, completionNote: null },
      });
      await logActivity(subtask.taskId, req.user.id, 'STATUS_CHANGED', 'DONE', 'IN_PROGRESS');
    }

    return res.json({ subtask: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
