const express = require('express');
const db = require('../db/connection');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { generateQueueTokenNumber, calculateEstimatedWait } = require('../utils/queue');

const router = express.Router();

async function requireQueueAdmin(queueId, adminId) {
  const [rows] = await db.execute(
    `SELECT qa.queue_id FROM queue_admins qa
     JOIN users u ON u.id = qa.admin_id
     JOIN queues q ON q.id = qa.queue_id
     WHERE qa.queue_id = ? AND qa.admin_id = ? AND u.department_id = q.department_id`,
    [queueId, adminId]
  );
  return rows.length > 0;
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? `SELECT q.id, q.name, q.description, q.location, q.status, q.average_service_time, q.department_id, q.created_at
         FROM queues q JOIN queue_admins qa ON qa.queue_id = q.id
         WHERE qa.admin_id = ? AND q.department_id = (SELECT department_id FROM users WHERE id = ?)
         ORDER BY q.created_at DESC`
      : 'SELECT id, name, description, location, status, average_service_time, department_id, created_at FROM queues ORDER BY created_at DESC';
    const [rows] = await db.execute(query, req.user.role === 'admin' ? [req.user.id, req.user.id] : []);

    return res.status(200).json({ queues: rows });
  } catch (error) {
    console.error('List queues error:', error);
    return res.status(500).json({ message: 'Server error fetching queues', error: error.message });
  }
});

router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { name, description, location, average_service_time = 5 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Queue name is required' });
    }

    if (!req.user.department_id) {
      return res.status(400).json({ message: 'Admin must be assigned to a department before creating queues' });
    }

    const [result] = await db.execute(
      'INSERT INTO queues (name, description, location, average_service_time, department_id) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), description || '', location || '', Number(average_service_time) || 5, req.user.department_id]
    );

    await db.execute(
      'INSERT INTO queue_admins (queue_id, admin_id) VALUES (?, ?)',
      [result.insertId, req.user.id]
    );

    const [rows] = await db.execute(
      'SELECT id, name, description, location, status, average_service_time, department_id, created_at FROM queues WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({ message: 'Queue created successfully', queue: rows[0] });
  } catch (error) {
    console.error('Create queue error:', error);
    return res.status(500).json({ message: 'Server error creating queue', error: error.message });
  }
});

router.post('/:id/admins', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const queueId = Number(req.params.id);
    const { email } = req.body;

    if (!await requireQueueAdmin(queueId, req.user.id)) {
      return res.status(403).json({ message: 'You are not assigned to this queue' });
    }

    const [users] = await db.execute(
      'SELECT id, name, email FROM users WHERE email = ? AND role = "admin" AND department_id = (SELECT department_id FROM queues WHERE id = ?)',
      [String(email || '').toLowerCase().trim(), queueId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    await db.execute(
      'INSERT IGNORE INTO queue_admins (queue_id, admin_id) VALUES (?, ?)',
      [queueId, users[0].id]
    );

    return res.status(201).json({ message: 'Admin assigned to queue', admin: users[0] });
  } catch (error) {
    console.error('Assign queue admin error:', error);
    return res.status(500).json({ message: 'Server error assigning queue admin', error: error.message });
  }
});

router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.id, t.queue_id, t.user_id, t.token_number, t.status, t.joined_at,
              t.started_at, t.completed_at, q.name AS queue_name, q.location,
              q.department_id, q.average_service_time
       FROM tokens t
       JOIN queues q ON q.id = t.queue_id
       WHERE t.user_id = ?
       ORDER BY t.id DESC`,
      [req.user.id]
    );

    const tickets = await Promise.all(rows.map(async (ticket) => {
      if (ticket.status !== 'WAITING') {
        return { ...ticket, people_ahead: 0, estimated_wait_minutes: 0 };
      }

      const [aheadRows] = await db.execute(
        'SELECT COUNT(*) AS people_ahead FROM tokens WHERE queue_id = ? AND status = "WAITING" AND id < ?',
        [ticket.queue_id, ticket.id]
      );
      const peopleAhead = Number(aheadRows[0].people_ahead) || 0;

      return {
        ...ticket,
        people_ahead: peopleAhead,
        estimated_wait_minutes: calculateEstimatedWait(peopleAhead, ticket.average_service_time)
      };
    }));

    return res.status(200).json({
      active_ticket: tickets.find((ticket) => ['WAITING', 'SERVING'].includes(ticket.status)) || null,
      active_tickets: tickets.filter((ticket) => ['WAITING', 'SERVING'].includes(ticket.status)),
      history: tickets
    });
  } catch (error) {
    console.error('Get my tickets error:', error);
    return res.status(500).json({ message: 'Server error fetching your tickets', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const queueId = Number(req.params.id);

    const [queueRows] = await db.execute(
      'SELECT id, name, description, location, status, average_service_time, department_id, created_at FROM queues WHERE id = ?',
      [queueId]
    );

    if (queueRows.length === 0) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    if (req.headers.authorization) {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        const { verifyToken } = require('../utils/auth');
        const viewer = verifyToken(token);
        if (viewer.role === 'admin' && !await requireQueueAdmin(queueId, viewer.id)) {
          return res.status(403).json({ message: 'You are not assigned to this queue' });
        }
      } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
    }

    const queue = queueRows[0];
    const [tokenRows] = await db.execute(
      `SELECT t.id, t.queue_id, t.user_id, t.token_number, t.status, t.joined_at, t.started_at, t.completed_at,
              u.name AS user_name, u.email
       FROM tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.queue_id = ?
       ORDER BY t.id ASC`,
      [queueId]
    );

    return res.status(200).json({ queue, tokens: tokenRows });
  } catch (error) {
    console.error('Get queue error:', error);
    return res.status(500).json({ message: 'Server error fetching queue', error: error.message });
  }
});

router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const queueId = Number(req.params.id);
    const userId = req.user.id;

    const [queueRows] = await db.execute(
      'SELECT id, name, average_service_time, department_id FROM queues WHERE id = ?',
      [queueId]
    );

    if (queueRows.length === 0) {
      return res.status(404).json({ message: 'Queue not found' });
    }

    const queue = queueRows[0];

    const [userRows] = await db.execute('SELECT department_id FROM users WHERE id = ?', [userId]);
    const userDepartmentId = userRows[0]?.department_id;
    if (userDepartmentId && Number(userDepartmentId) !== Number(queue.department_id)) {
      return res.status(403).json({ message: 'This queue belongs to another department' });
    }

    const [existingRows] = await db.execute(
      'SELECT id FROM tokens WHERE queue_id = ? AND user_id = ? AND status IN ("WAITING", "SERVING")',
      [queueId, userId]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({ message: 'You have already joined this queue' });
    }

    const [countRows] = await db.execute(
      'SELECT COUNT(*) AS total FROM tokens WHERE queue_id = ?',
      [queueId]
    );

    const sequence = Number(countRows[0].total) + 1;
    const tokenNumber = generateQueueTokenNumber(queue.name, sequence);

    const [result] = await db.execute(
      'INSERT INTO tokens (queue_id, user_id, token_number, status) VALUES (?, ?, ?, "WAITING")',
      [queueId, userId, tokenNumber]
    );

    const [tokenRows] = await db.execute(
      'SELECT id, queue_id, user_id, token_number, status, joined_at FROM tokens WHERE id = ?',
      [result.insertId]
    );

    const token = tokenRows[0];
    const [waitingRows] = await db.execute(
      'SELECT COUNT(*) AS people_ahead FROM tokens WHERE queue_id = ? AND status = "WAITING" AND id < ?',
      [queueId, token.id]
    );

    const peopleAhead = Number(waitingRows[0].people_ahead) || 0;

    return res.status(201).json({
      message: 'You joined the queue successfully',
      token,
      people_ahead: peopleAhead,
      estimated_wait_minutes: calculateEstimatedWait(peopleAhead, queue.average_service_time)
    });
  } catch (error) {
    console.error('Join queue error:', error);
    return res.status(500).json({ message: 'Server error while joining queue', error: error.message });
  }
});

router.post('/:id/next', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const queueId = Number(req.params.id);

    if (!await requireQueueAdmin(queueId, req.user.id)) {
      return res.status(403).json({ message: 'You are not assigned to this queue' });
    }

    const [tokens] = await db.execute(
      'SELECT id, token_number, user_id, status FROM tokens WHERE queue_id = ? AND status = "WAITING" ORDER BY id ASC LIMIT 1',
      [queueId]
    );

    if (tokens.length === 0) {
      return res.status(404).json({ message: 'No waiting token found in this queue' });
    }

    const nextToken = tokens[0];

    await db.execute(
      'UPDATE tokens SET status = "SERVING", started_at = NOW() WHERE id = ? AND queue_id = ?',
      [nextToken.id, queueId]
    );

    return res.status(200).json({
      message: 'Next token is now being served',
      token: {
        id: nextToken.id,
        token_number: nextToken.token_number,
        user_id: nextToken.user_id,
        status: 'SERVING'
      }
    });
  } catch (error) {
    console.error('Next token error:', error);
    return res.status(500).json({ message: 'Server error while serving next token', error: error.message });
  }
});

router.post('/:id/tokens/:tokenId/skip', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const queueId = Number(req.params.id);
    const tokenId = Number(req.params.tokenId);

    if (!await requireQueueAdmin(queueId, req.user.id)) {
      return res.status(403).json({ message: 'You are not assigned to this queue' });
    }

    const [result] = await db.execute(
      'UPDATE tokens SET status = "SKIPPED", completed_at = NOW() WHERE id = ? AND queue_id = ?',
      [tokenId, queueId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Token not found in this queue' });
    }

    return res.status(200).json({ message: 'Token skipped successfully' });
  } catch (error) {
    console.error('Skip token error:', error);
    return res.status(500).json({ message: 'Server error while skipping token', error: error.message });
  }
});

router.post('/:id/tokens/:tokenId/complete', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const queueId = Number(req.params.id);
    const tokenId = Number(req.params.tokenId);

    if (!await requireQueueAdmin(queueId, req.user.id)) {
      return res.status(403).json({ message: 'You are not assigned to this queue' });
    }

    const [result] = await db.execute(
      'UPDATE tokens SET status = "COMPLETED", completed_at = NOW() WHERE id = ? AND queue_id = ?',
      [tokenId, queueId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Token not found in this queue' });
    }

    return res.status(200).json({ message: 'Token completed successfully' });
  } catch (error) {
    console.error('Complete token error:', error);
    return res.status(500).json({ message: 'Server error while completing token', error: error.message });
  }
});

module.exports = router;
