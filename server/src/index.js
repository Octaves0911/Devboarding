require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const taskRoutes = require('./routes/tasks');
const subtaskRoutes = require('./routes/subtasks');
const attachmentRoutes = require('./routes/attachments');
const profileRoutes = require('./routes/profile');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Routes
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', taskRoutes);
app.use('/api', subtaskRoutes);
app.use('/api', attachmentRoutes);
app.use('/api', profileRoutes);
app.use('/api', aiRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
