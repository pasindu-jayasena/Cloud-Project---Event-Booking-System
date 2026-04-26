require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bookingRoutes = require('./routes/bookingRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ======================
// Middlewares
// ======================
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// Health Check Routes
// ======================
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'Booking Service',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  const { pool } = require('./config/db');
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({
      service: 'Booking Service',
      status: 'healthy',
      database: 'connected',
      dbTime: result.rows[0].now,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      service: 'Booking Service',
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ======================
// API Routes
// ======================
app.use('/api/bookings', bookingRoutes);

// ======================
// 404 Handler
// ======================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// ======================
// Global Error Handler
// ======================
app.use(errorHandler);

module.exports = app;
