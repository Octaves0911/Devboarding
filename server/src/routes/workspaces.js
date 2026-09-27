'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { randomUUID } = require('crypto');
const multer = require('multer');
const AdmZip = require('adm-zip');
const archiver = require('archiver');

const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

// ── Constants ────────────────────────────────────────────────────────────────
const WORKSPACES_DIR = path.resolve(__dirname, '../../../workspaces');
const TEMPLATES_DIR  = path.join(WORKSPACES_DIR, 'templates');
const TASKS_DIR      = path.join(WORKSPACES_DIR, 'tasks');

const MAX_ZIP_SIZE   = 5 * 1024 * 1024;    // 5 MB upload limit
const MAX_FILE_SIZE  = 200 * 1024;          // 200 KB per extracted file
const MAX_FILES      = 300;

const SKIP_DIRS = new Set(['node_modules', '.git']);
const BINARY_EXTS = new Set([
  'png','jpg','jpeg','gif','bmp','ico','svg','webp',
  'woff','woff2','ttf','eot','otf',
  'mp3','mp4','wav','ogg','webm',
  'zip','tar','gz','7z','rar',
  'exe','dll','so','dylib','bin','dat',
  'pdf','doc','docx','xls','xlsx','ppt','pptx',
]);

// ── Multer (zip only, max 5 MB) ──────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ZIP_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are accepted'));
    }
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve and verify path stays inside baseDir. Returns null on traversal. */
function safeResolve(baseDir, relPath) {
  const resolved = path.resolve(baseDir, relPath);
  if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) return null;
  return resolved;
}

/** Recursively copy a directory. */
async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

/** Remove a directory tree, ignoring ENOENT. */
async function removeDir(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch { /* ignored */ }
}

/** Build a JSON tree from a directory path. */
async function buildTree(dir, relBase) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const nodes = [];
  for (const entry of entries) {
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'dir',
        children: await buildTree(path.join(dir, entry.name), relPath),
      });
    } else {
      nodes.push({ name: entry.name, path: relPath, type: 'file' });
    }
  }
  return nodes;
}

/** Count all files under a directory. */
async function countFiles(dir) {
  let count = 0;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) count += await countFiles(path.join(dir, e.name));
    else count++;
  }
  return count;
}

// ── POST /api/workspaces/templates ────────────────────────────────────────────
// MENTOR only. Uploads a zip, extracts to workspaces/templates/<templateId>/.
// Returns { templateId }.
router.post(
  '/workspaces/templates',
  authenticate,
  authorize('MENTOR'),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'zip file is required' });

    const templateId = randomUUID();
    const destDir    = path.join(TEMPLATES_DIR, templateId);

    try {
      let zip;
      try {
        zip = new AdmZip(req.file.buffer);
      } catch {
        return res.status(400).json({ error: 'Invalid or corrupt zip file' });
      }

      const entries = zip.getEntries();
      let fileCount = 0;

      // Validate all entries before extracting anything
      for (const entry of entries) {
        const entryName = entry.entryName.replace(/\\/g, '/');

        // Reject symlinks
        const attr = entry.attr >>> 16;
        const isSymlink = (attr & 0o170000) === 0o120000;
        if (isSymlink) {
          return res.status(400).json({ error: `Symlinks not allowed: ${entryName}` });
        }

        if (entry.isDirectory) continue;

        // Reject path traversal
        const parts = entryName.split('/');
        if (parts.some((p) => p === '..' || p === '')) {
          return res.status(400).json({ error: `Path traversal detected: ${entryName}` });
        }

        // Skip forbidden directories
        if (parts.some((p) => SKIP_DIRS.has(p))) continue;

        // Skip files > 200 KB
        if (entry.header.size > MAX_FILE_SIZE) continue;

        // Skip binary extensions
        const ext = parts[parts.length - 1].split('.').pop().toLowerCase();
        if (BINARY_EXTS.has(ext)) continue;

        fileCount++;
        if (fileCount > MAX_FILES) {
          return res.status(400).json({ error: `Zip exceeds ${MAX_FILES} file limit` });
        }
      }

      // Extract valid entries
      await fsp.mkdir(destDir, { recursive: true });

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        const entryName = entry.entryName.replace(/\\/g, '/');
        const parts     = entryName.split('/');

        if (parts.some((p) => p === '..' || p === '')) continue;
        if (parts.some((p) => SKIP_DIRS.has(p))) continue;
        if (entry.header.size > MAX_FILE_SIZE) continue;

        const ext = parts[parts.length - 1].split('.').pop().toLowerCase();
        if (BINARY_EXTS.has(ext)) continue;

        // Reject symlinks
        const attr = entry.attr >>> 16;
        const isSymlink = (attr & 0o170000) === 0o120000;
        if (isSymlink) continue;

        const destPath = safeResolve(destDir, entryName);
        if (!destPath) continue; // extra safety

        await fsp.mkdir(path.dirname(destPath), { recursive: true });
        await fsp.writeFile(destPath, entry.getData());
      }

      return res.status(201).json({ templateId });
    } catch (err) {
      await removeDir(destDir);
      console.error('workspaces/templates error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── GET /api/workspaces/:taskId/tree ─────────────────────────────────────────
router.get('/workspaces/:taskId/tree', authenticate, authorize('ADMIN', 'HR', 'MENTOR', 'MENTEE'), async (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  const { task, errRes } = await loadTaskAndCheck(req, taskId, 'read', res);
  if (errRes) return errRes;

  const taskDir = path.join(TASKS_DIR, String(taskId));
  if (!fs.existsSync(taskDir)) return res.json({ tree: [] });

  const tree = await buildTree(taskDir, '');
  return res.json({ tree });
});

// ── GET /api/workspaces/:taskId/file ─────────────────────────────────────────
router.get('/workspaces/:taskId/file', authenticate, authorize('ADMIN', 'HR', 'MENTOR', 'MENTEE'), async (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  const { errRes } = await loadTaskAndCheck(req, taskId, 'read', res);
  if (errRes) return errRes;

  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'path query param required' });

  const taskDir  = path.join(TASKS_DIR, String(taskId));
  const filePath = safeResolve(taskDir, relPath);
  if (!filePath) return res.status(400).json({ error: 'Invalid path' });

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ error: 'File not found' });
  }

  const content = await fsp.readFile(filePath, 'utf8');
  return res.json({ content });
});

// ── PUT /api/workspaces/:taskId/file ─────────────────────────────────────────
router.put('/workspaces/:taskId/file', authenticate, authorize('MENTEE'), async (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  const { task, errRes } = await loadTaskAndCheck(req, taskId, 'write', res);
  if (errRes) return errRes;

  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'path query param required' });

  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'content (string) required' });

  const buf = Buffer.from(content, 'utf8');
  if (buf.length > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File exceeds 200 KB limit' });
  }

  const taskDir  = path.join(TASKS_DIR, String(taskId));
  const filePath = safeResolve(taskDir, relPath);
  if (!filePath) return res.status(400).json({ error: 'Invalid path' });

  // File must already exist (no new file creation via PUT)
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Check total file count hasn't grown beyond limit (defensive)
  const totalFiles = await countFiles(taskDir);
  if (totalFiles > MAX_FILES) {
    return res.status(400).json({ error: 'Workspace exceeds 300-file limit' });
  }

  await fsp.writeFile(filePath, content, 'utf8');

  // First save on a TODO task → IN_PROGRESS
  if (task.status === 'TODO') {
    await prisma.task.update({ where: { id: taskId }, data: { status: 'IN_PROGRESS' } });
    const { logActivity } = require('../lib/activity');
    await logActivity(taskId, req.user.id, 'STATUS_CHANGED', 'TODO', 'IN_PROGRESS');
  }

  return res.json({ ok: true });
});

// ── GET /api/workspaces/:taskId/download ────────────────────────────────────
router.get('/workspaces/:taskId/download', authenticate, authorize('ADMIN', 'HR', 'MENTOR', 'MENTEE'), async (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  const { task, errRes } = await loadTaskAndCheck(req, taskId, 'read', res);
  if (errRes) return errRes;

  const taskDir = path.join(TASKS_DIR, String(taskId));
  if (!fs.existsSync(taskDir)) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="workspace-${taskId}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    res.destroy();
  });
  archive.pipe(res);
  archive.directory(taskDir, false);
  await archive.finalize();
});

// ── Shared access-check helper ───────────────────────────────────────────────
/**
 * Load a task and verify the user has 'read' or 'write' access.
 * Returns { task, errRes } — errRes is a sent response on failure or null on success.
 */
async function loadTaskAndCheck(req, taskId, mode, res) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });

  if (!task) {
    return { task: null, errRes: res.status(404).json({ error: 'Task not found' }) };
  }

  if (!task.hasWorkspace) {
    return { task, errRes: res.status(404).json({ error: 'No workspace for this task' }) };
  }

  const { user } = req;

  if (mode === 'write') {
    // Only assignee writes
    if (task.assigneeId !== user.id) {
      return { task, errRes: res.status(403).json({ error: 'Forbidden' }) };
    }
    // Block writes when DONE
    if (task.status === 'DONE') {
      return { task, errRes: res.status(403).json({ error: 'Task is DONE — workspace is read-only' }) };
    }
  } else {
    // Read: assignee, creator, HR, admin, or mentor of the assignee
    const canRead = task.assigneeId === user.id ||
                    task.createdById === user.id ||
                    user.role === 'ADMIN' ||
                    user.role === 'HR';

    if (!canRead && user.role === 'MENTOR') {
      // Check if this mentor's mentee is the assignee
      const assignee = await prisma.user.findUnique({ where: { id: task.assigneeId } });
      if (assignee?.mentorId !== user.id) {
        return { task, errRes: res.status(403).json({ error: 'Forbidden' }) };
      }
    } else if (!canRead) {
      return { task, errRes: res.status(403).json({ error: 'Forbidden' }) };
    }
  }

  return { task, errRes: null };
}

// ── Exported helpers used by tasks.js ────────────────────────────────────────
module.exports = router;
module.exports.copyWorkspaceForTask = copyWorkspaceForTask;
module.exports.removeTaskWorkspace   = removeTaskWorkspace;
module.exports.removeTemplateIfOrphaned = removeTemplateIfOrphaned;

/**
 * Copy template to a task's workspace directory.
 * @param {string} templateId
 * @param {number} taskId
 */
async function copyWorkspaceForTask(templateId, taskId) {
  const src  = path.join(TEMPLATES_DIR, templateId);
  const dest = path.join(TASKS_DIR, String(taskId));
  if (!fs.existsSync(src)) throw new Error(`Template ${templateId} not found`);
  await copyDir(src, dest);
}

/** Remove a task's workspace directory. */
async function removeTaskWorkspace(taskId) {
  await removeDir(path.join(TASKS_DIR, String(taskId)));
}

/**
 * Remove template directory if no remaining tasks reference it.
 * @param {string} templateId
 */
async function removeTemplateIfOrphaned(templateId) {
  const count = await prisma.task.count({ where: { workspaceTemplateId: templateId } });
  if (count === 0) {
    await removeDir(path.join(TEMPLATES_DIR, templateId));
  }
}
