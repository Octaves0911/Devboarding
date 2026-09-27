const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { canViewTask } = require('../lib/activity');
const { notify, taskLink } = require('../lib/notify');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'application/zip',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('File type not allowed'));
  },
});

// POST /api/tasks/:id/attachments
// REFERENCE: task creator only; SUBMISSION: task assignee only.
// Optional body field `batchId`: when present, the uploaded files are stored once
// on disk and one Attachment row is created per task that shares that batchId
// (REFERENCE only). The task in :id is used for permission checking.
router.post(
  '/tasks/:id/attachments',
  authenticate,
  authorize('HR', 'MENTOR', 'MENTEE'),
  (req, res, next) => {
    upload.array('files', 10)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.id, 10);
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const { kind, batchId } = req.body;
      if (!kind || !['REFERENCE', 'SUBMISSION'].includes(kind)) {
        return res.status(400).json({ error: 'kind must be REFERENCE or SUBMISSION' });
      }

      if (kind === 'REFERENCE' && task.createdById !== req.user.id) {
        return res.status(403).json({ error: 'Only the task creator can upload REFERENCE attachments' });
      }
      if (kind === 'SUBMISSION' && task.assigneeId !== req.user.id) {
        return res.status(403).json({ error: 'Only the task assignee can upload SUBMISSION attachments' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Determine which tasks to attach to (batch or single)
      let targetTaskIds = [taskId];
      if (batchId && kind === 'REFERENCE') {
        const batchTasks = await prisma.task.findMany({
          where: { batchId, createdById: req.user.id },
          select: { id: true },
        });
        if (batchTasks.length > 0) {
          targetTaskIds = batchTasks.map((t) => t.id);
        }
      }

      // One Attachment row per file per target task; all rows for the same file
      // share the same filePath so the physical file is stored only once.
      const ops = [];
      for (const f of req.files) {
        for (const tid of targetTaskIds) {
          ops.push(
            prisma.attachment.create({
              data: {
                taskId: tid,
                fileName: f.originalname,
                filePath: f.filename,
                mimeType: f.mimetype,
                size: f.size,
                uploadedById: req.user.id,
                kind,
              },
            }),
          );
        }
      }

      const created = await prisma.$transaction(ops);

      if (kind === 'SUBMISSION') {
        const names = req.files.map((f) => f.originalname).join(', ');
        await notify([task.createdById], {
          type: 'SUBMISSION',
          title: 'New submission',
          body: `${names} on ${task.title}`,
          link: (user) => taskLink(user, task),
        }, req.user.id);
      }

      return res.status(201).json({ attachments: created });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// GET /api/attachments/:id/download — only users who can view the task
router.get('/attachments/:id/download', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { task: true },
    });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    if (!(await canViewTask(req.user, attachment.task))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const filePath = path.join(UPLOAD_DIR, attachment.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    return res.download(filePath, attachment.fileName);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/attachments/:id — uploader only
// Only removes the file from disk when no other Attachment row still references it.
router.delete('/attachments/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    if (attachment.uploadedById !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: only the uploader can delete this attachment' });
    }

    await prisma.attachment.delete({ where: { id } });

    // Only unlink the physical file when no other Attachment row references the same path
    const remaining = await prisma.attachment.count({ where: { filePath: attachment.filePath } });
    if (remaining === 0) {
      const filePath = path.join(UPLOAD_DIR, attachment.filePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    return res.json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
