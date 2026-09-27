'use strict';

const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { authenticate, authorize } = require('../middleware/auth');
const { callLLM } = require('../lib/llm');
const prisma = require('../lib/prisma');
const { logActivity } = require('../lib/activity');
const { notify, taskLink } = require('../lib/notify');
const { randomUUID } = require('crypto');
const {
  copyWorkspaceForTask,
  removeTaskWorkspace,
} = require('./workspaces');

const router = express.Router();

// ── Validate and filter resource URLs ────────────────────────────────────────
async function checkUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const mod = parsed.protocol === 'https:' ? https : http;
    const reachable = await new Promise((resolve) => {
      const req = mod.request(rawUrl, { method: 'HEAD' }, (res) => {
        resolve(res.statusCode < 400 || res.statusCode === 405);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(5_000, () => { req.destroy(); resolve(false); });
      req.end();
    });
    if (reachable) return true;

    // Fallback: GET
    return await new Promise((resolve) => {
      const req = mod.request(rawUrl, { method: 'GET' }, (res) => {
        resolve(res.statusCode < 400);
        req.destroy(); // don't download body
      });
      req.on('error', () => resolve(false));
      req.setTimeout(5_000, () => { req.destroy(); resolve(false); });
      req.end();
    });
  } catch {
    return false;
  }
}

// Validate all resource URLs in parallel, drop unreachable ones
async function filterResources(resources) {
  if (!Array.isArray(resources) || resources.length === 0) return [];
  const results = await Promise.all(
    resources.slice(0, 3).map(async (r) => {
      const ok = await checkUrl(r.url);
      return ok ? r : null;
    })
  );
  return results.filter(Boolean);
}

// ── TASK_INCLUDE (same as tasks.js) ──────────────────────────────────────────
const TASK_INCLUDE = {
  createdBy: { select: { id: true, name: true, role: true } },
  assignee:  { select: { id: true, name: true, role: true } },
  subtasks:  { orderBy: { order: 'asc' } },
  attachments: { orderBy: { createdAt: 'asc' } },
  activities: {
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, role: true } } },
  },
};

// ── Validate assignee permission (same rules as tasks.js) ───────────────────
async function validateAssigneePermission(creatorRole, creatorId, assigneeId) {
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!assignee || !assignee.isActive) return 'Assignee not found or inactive';
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

// ── POST /api/ai/generate-tasks ──────────────────────────────────────────────
router.post(
  '/ai/generate-tasks',
  authenticate,
  authorize('HR', 'MENTOR'),
  async (req, res) => {
    try {
      const { roadmap, startDate, durationDays } = req.body;

      if (!roadmap || typeof roadmap !== 'string') {
        return res.status(400).json({ error: 'roadmap is required' });
      }
      const trimmed = roadmap.trim();
      if (trimmed.length < 20 || trimmed.length > 4000) {
        return res.status(400).json({ error: 'roadmap must be 20–4000 characters' });
      }

      const start = startDate ? new Date(startDate) : new Date();
      if (isNaN(start.getTime())) {
        return res.status(400).json({ error: 'startDate must be a valid date' });
      }

      const maxDays = durationDays ? parseInt(durationDays, 10) : null;

      // ── Prompt ──────────────────────────────────────────────────────────────
      const system = `You are an expert onboarding task planner. Given a developer roadmap, produce a structured onboarding task list in JSON.

Rules:
- Maximum 10 tasks. Each task must have: title (string, max 120 chars), description (string, min 10 chars), priority (LOW|MEDIUM|HIGH), estimatedDays (positive integer), subtasks (array of strings, max 6), resources (array of {title,url}, max 3, only real verifiable URLs).
- Distribute estimatedDays proportionally${maxDays ? ` so they sum to roughly ${maxDays} days` : ''}.
- Respond with valid JSON only: { "tasks": [...] }`;

      let generated;
      try {
        generated = await callLLM({
          system,
          messages: [{ role: 'user', content: `Roadmap:\n${trimmed}` }],
          json: true,
          userId: req.user.id,
        });
      } catch (llmErr) {
        const status = llmErr.status || 500;
        return res.status(status).json({ error: llmErr.message });
      }

      const rawTasks = Array.isArray(generated?.tasks) ? generated.tasks.slice(0, 10) : [];
      if (rawTasks.length === 0) {
        return res.status(502).json({ error: 'AI returned no tasks. Please try again.' });
      }

      // ── Normalise + URL-check each task ─────────────────────────────────────
      let cursor = new Date(start);
      const tasks = await Promise.all(
        rawTasks.map(async (t) => {
          const estDays = Math.max(1, parseInt(t.estimatedDays, 10) || 1);
          const dueDate = new Date(cursor);
          dueDate.setDate(dueDate.getDate() + estDays - 1);
          cursor = new Date(dueDate);
          cursor.setDate(cursor.getDate() + 1);

          const resources = await filterResources(t.resources);

          return {
            title: String(t.title ?? 'Task').slice(0, 120),
            description: String(t.description ?? '').trim() || 'No description provided.',
            priority: ['LOW', 'MEDIUM', 'HIGH'].includes(t.priority) ? t.priority : 'MEDIUM',
            estimatedDays: estDays,
            dueDate: dueDate.toISOString().split('T')[0],
            subtasks: (Array.isArray(t.subtasks) ? t.subtasks.slice(0, 6) : []).map(String),
            resources,
          };
        })
      );

      return res.json({ tasks });
    } catch (err) {
      console.error('AI generate-tasks error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── POST /api/ai/create-tasks — bulk-create the confirmed preview ─────────────
router.post(
  '/ai/create-tasks',
  authenticate,
  authorize('HR', 'MENTOR'),
  async (req, res) => {
    try {
      const { tasks: taskList, assigneeIds: rawAssigneeIds, templateId } = req.body;

      if (!Array.isArray(taskList) || taskList.length === 0) {
        return res.status(400).json({ error: 'tasks array is required' });
      }
      if (!Array.isArray(rawAssigneeIds) || rawAssigneeIds.length === 0) {
        return res.status(400).json({ error: 'assigneeIds array is required' });
      }

      // templateId only allowed for MENTOR
      if (templateId && req.user.role !== 'MENTOR') {
        return res.status(403).json({ error: 'Only MENTOR can attach a workspace' });
      }

      const assigneeIdInts = rawAssigneeIds.map((id) => parseInt(id, 10));

      // Validate all assignees
      for (const assigneeId of assigneeIdInts) {
        const permErr = await validateAssigneePermission(req.user.role, req.user.id, assigneeId);
        if (permErr) return res.status(403).json({ error: permErr });
      }

      const batchId = assigneeIdInts.length > 1 ? randomUUID() : null;

      const created = [];

      for (const t of taskList) {
        // Build description — append Resources section if any
        let description = String(t.description ?? '').trim() || 'No description provided.';
        if (Array.isArray(t.resources) && t.resources.length > 0) {
          const lines = t.resources.map((r) => `- [${r.title}](${r.url})`).join('\n');
          description += `\n\n## Resources\n${lines}`;
        }

        const due = new Date(t.dueDate);
        if (isNaN(due.getTime())) continue; // skip malformed tasks

        const subtaskData = (Array.isArray(t.subtasks) ? t.subtasks.slice(0, 6) : [])
          .map((s, i) => ({ title: String(s).trim() || `Subtask ${i + 1}`, order: i }));

        for (const assigneeId of assigneeIdInts) {
          const task = await prisma.task.create({
            data: {
              title: String(t.title ?? 'Task').slice(0, 120),
              description,
              priority: ['LOW', 'MEDIUM', 'HIGH'].includes(t.priority) ? t.priority : 'MEDIUM',
              dueDate: due,
              createdById: req.user.id,
              assigneeId,
              batchId,
              hasWorkspace: !!templateId,
              workspaceTemplateId: templateId ?? null,
              subtasks: subtaskData.length > 0 ? { create: subtaskData } : undefined,
            },
            include: TASK_INCLUDE,
          });
          await logActivity(task.id, req.user.id, 'CREATED');
          created.push(task);
        }
      }

      // Copy workspace per created task if templateId provided
      if (templateId && created.length > 0) {
        const copied = [];
        try {
          for (const t of created) {
            await copyWorkspaceForTask(templateId, t.id);
            copied.push(t.id);
          }
        } catch (copyErr) {
          console.error('Workspace copy failed in AI create-tasks, rolling back:', copyErr);
          for (const id of copied) await removeTaskWorkspace(id);
          await prisma.task.deleteMany({ where: { id: { in: created.map((t) => t.id) } } });
          return res.status(500).json({ error: 'Failed to copy workspace. No tasks were created.' });
        }
      }

      for (const task of created) {
        await notify([task.assigneeId], {
          type: 'TASK_ASSIGNED',
          title: 'New task assigned',
          body: task.title,
          link: (user) => taskLink(user, task),
        }, req.user.id);
      }

      return res.status(201).json({ tasks: created, batchId });
    } catch (err) {
      console.error('AI create-tasks error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
