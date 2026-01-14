import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import authRoutes from './routes/auth.js';
import userDocumentsRoutes from './routes/userDocuments.js';
import { initializeDatabase } from './config/dbInit.js';
import fs from 'fs';
import path from 'path';


const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3002',
  'http://localhost:3001',
  'http://localhost:8080',
  'https://buildtrust.vercel.app',
  'https://build-trust-frontend.vercel.app',
  // other allowed origins...
];

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists and serve it statically
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Initialize database
initializeDatabase().catch(console.error);

import { auditSubmission } from './middleware/audit.js';
// Audit submissions (non-GET requests)
app.use(auditSubmission);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userDocumentsRoutes);

// Multer / Upload error handler
app.use((err, req, res, next) => {
  if (err) {
    console.error('Upload or server error:', err.message || err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max size is 10 MB' });
    }
    if (err.message === 'Invalid file type') {
      return res.status(400).json({ error: 'Invalid file type. Allowed: PDF, JPG, PNG' });
    }
  }
  next(err);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'BuildTrust API is running' });
});

// Start server only when not running tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  });
}

export default app;
