import pool from '../config/database.js';

export const auditSubmission = (req, res, next) => {
  // Only track non-GET requests (forms/submissions)
  if (req.method === 'GET') return next();

  const userId = req.user ? (req.user.userId || null) : null;
  const route = req.originalUrl;
  const method = req.method;
  const payload = req.body ? JSON.stringify(req.body) : null;

  res.on('finish', async () => {
    try {
      await pool.query('INSERT INTO form_submissions (user_id, route, method, status, payload) VALUES (?, ?, ?, ?, ?)', [
        userId,
        route,
        method,
        res.statusCode,
        payload,
      ]);
    } catch (err) {
      console.error('Failed to write audit log', err);
    }
  });

  next();
};
