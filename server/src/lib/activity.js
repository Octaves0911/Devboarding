const prisma = require('./prisma');

async function logActivity(taskId, userId, action, fromStatus = null, toStatus = null) {
  await prisma.taskActivity.create({
    data: { taskId, userId, action, fromStatus, toStatus },
  });
}

/**
 * Returns true if the requesting user is allowed to view this task.
 * Rules:
 *  ADMIN  – all tasks
 *  HR     – all tasks
 *  MENTOR – own created tasks + tasks assigned to them + all tasks of own mentees
 *  MENTEE – tasks assigned to them
 */
async function canViewTask(user, task) {
  if (user.role === 'ADMIN' || user.role === 'HR') return true;

  if (user.role === 'MENTOR') {
    if (task.createdById === user.id) return true;
    if (task.assigneeId === user.id) return true;
    // task assigned to one of my mentees?
    const mentee = await prisma.user.findFirst({
      where: { id: task.assigneeId, mentorId: user.id },
    });
    return !!mentee;
  }

  if (user.role === 'MENTEE') {
    return task.assigneeId === user.id;
  }

  return false;
}

module.exports = { logActivity, canViewTask };
