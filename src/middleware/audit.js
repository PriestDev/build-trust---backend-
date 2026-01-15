import pool from '../config/database.js';

// Background queue for audit logs to avoid blocking requests
const auditQueue = [];
let isProcessing = false;
const QUEUE_PROCESS_DELAY = 2000; // Wait 2 seconds before processing queue

async function processAuditQueue() {
  if (isProcessing || auditQueue.length === 0) return;
  isProcessing = true;

  while (auditQueue.length > 0) {
    const auditData = auditQueue.shift();
    try {
      // Use delay to avoid blocking and let connection pool release
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await pool.query(
        'INSERT INTO form_submissions (user_id, route, method, status, payload) VALUES (?, ?, ?, ?, ?)',
        [auditData.userId, auditData.route, auditData.method, auditData.statusCode, null]
      );
    } catch (err) {
      // Silently log audit failures - they're not critical
      if (err.code !== 'ER_USER_LIMIT_REACHED') {
        console.error('Failed to write audit log:', err.message);
      }
    }
  }

  isProcessing = false;
}

export const auditSubmission = (req, res, next) => {
  // Only audit GET requests and successful responses to minimize DB load
  // Skip audit for POST/PUT/DELETE during heavy load to prevent connection exhaustion
  if (req.method === 'GET' || req.method === 'OPTIONS') return next();

  // For critical routes (auth, payments), skip audit to ensure they work
  const skipAuditRoutes = ['/api/auth/', '/api/users/documents'];
  if (skipAuditRoutes.some(route => req.originalUrl.includes(route))) {
    return next();
  }

  const userId = req.user ? (req.user.userId || null) : null;
  const route = req.originalUrl;
  const method = req.method;

  res.on('finish', () => {
    // Only queue on success (2xx status codes)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      auditQueue.push({
        userId,
        route,
        method,
        statusCode: res.statusCode,
      });

      // Process queue after delay
      setTimeout(processAuditQueue, QUEUE_PROCESS_DELAY);
    }
  });

  next();
};
