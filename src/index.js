require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectMongo = require('./config/mongo');
const { connectPostgres } = require('./config/postgres');
const { generalLimiter } = require('./middleware/rateLimiter');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & Middleware ──────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://vitto-lending.netlify.app',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(morgan('dev'));
app.use(generalLimiter);

// ── Routes ────────────────────────────────────
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Vitto backend is working',
  });
});

// ── 404 Handler ───────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ── Global Error Handler ─────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
});

// ── Start Server ──────────────────────────────
const start = async () => {
  await connectMongo();
  await connectPostgres();
  app.listen(PORT, () => {
    console.log(`\n🚀 Vitto Lending API running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
};

start();
