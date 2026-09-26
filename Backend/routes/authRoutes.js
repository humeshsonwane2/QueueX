const express = require('express');
const db = require('../db/connection');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department_id: user.department_id,
    created_at: user.created_at
  };
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'user', department_id = null } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role must be either user or admin' });
    }

    if (role === 'admin' && !department_id) {
      return res.status(400).json({ message: 'Admin accounts must have a department ID' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password_hash, role, department_id) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), normalizedEmail, passwordHash, role, department_id || null]
    );

    if (role === 'admin') {
      await db.execute(
        `INSERT IGNORE INTO queue_admins (queue_id, admin_id)
         SELECT id, ? FROM queues WHERE department_id = ?`,
        [result.insertId, department_id]
      );
    }

    const [rows] = await db.execute(
      'SELECT id, name, email, role, department_id, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = rows[0];
    const token = generateToken({ id: user.id, email: user.email, role: user.role, department_id: user.department_id });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const [rows] = await db.execute(
      'SELECT id, name, email, password_hash, role, department_id, created_at FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];
    const isPasswordMatch = await comparePassword(password, user.password_hash);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role, department_id: user.department_id });

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, role, department_id, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user: sanitizeUser(rows[0]) });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ message: 'Server error fetching user', error: error.message });
  }
});

module.exports = router;
