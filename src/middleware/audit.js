import pool from '../config/database.js';

// Background queue for audit logs to avoid blocking requests
const auditQueue = [];
let isProcessing = false;
const QUEUE_PROCESS_DELAY = 1000; // Wait 1 second before processing queue

async function processAuditQueue() {
  if (isProcessing || auditQueue.length === 0) return;
  isProcessing = true;

  while (auditQueue.length > 0) {
    const auditData = auditQueue.shift();
    try {
      // Use setTimeout to avoid blocking, and let connection pool have time to release
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await pool.query(
        'INSERT INTO form_submissions (user_id, route, method, status, payload) VALUES (?, ?, ?, ?, ?)',
        [auditData.userId, auditData.route, auditData.method, auditData.statusCode, auditData.payload]
      );
    } catch (err) {
      // Silently log audit failures - they're not critical
      console.error('Failed to write audit log (non-critical):', err.code || err.message);
      // Don't re-queue failed audits to avoid infinite loops
    }
  }

  isProcessing = false;
}

export const auditSubmission = (req, res, next) => {
  // Only track non-GET requests (forms/submissions)
  if (req.method === 'GET') return next();

  const userId = req.user ? (req.user.userId || null) : null;
  const route = req.originalUrl;
  const method = req.method;
  const payload = req.body ? JSON.stringify(req.body) : null;

  res.on('finish', () => {
    // Queue the audit log instead of awaiting it
    auditQueue.push({
      userId,
      route,
      method,
      statusCode: res.statusCode,
      payload,
    });

    // Process queue after delay to allow connections to release
    setTimeout(processAuditQueue, QUEUE_PROCESS_DELAY);
  });

  next();
};
