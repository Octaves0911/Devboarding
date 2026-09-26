const express = require('express');
const bcrypt = require('bcrypt');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

const SAFE_USER_SELECT = {
  id: true, name: true, email: true, role: true,
  phone: true, department: true, designation: true,
  joiningDate: true, mentorId: true, isActive: true, createdAt: true,
};

// PUT /api/profile — update own name and phone
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, phone: phone || null },
      select: SAFE_USER_SELECT,
    });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/profile/password — change own password
router.put('/profile/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'currentPassword, newPassword, and confirmPassword are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'newPassword and confirmPassword do not match' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    return res.json({ message: 'Password updated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
