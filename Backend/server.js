const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db/connection');
const { initializeDatabase } = require('./db/init');
const authRoutes = require('./routes/authRoutes');
const queueRoutes = require('./routes/queueRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/queues', queueRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'QueueX API is running',
    status: 'ok'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT 1 AS ok');

    res.status(200).json({
      status: 'ok',
      message: 'Database connected successfully',
      db: rows[0]?.ok === 1 ? 'connected' : 'unknown'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

async function startServer() {
  try {
    await db.query('SELECT 1');
    await initializeDatabase();
    console.log('MySQL connection successful');

    app.listen(PORT, () => {
      console.log(`QueueX backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MySQL:', error.message);
    process.exit(1);
  }
}

startServer();
