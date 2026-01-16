import fs from 'fs';
import path from 'path';
import pool from '../config/database.js';

export const uploadDocument = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    // Ensure authenticated user is uploading their own documents
    if (!req.user || req.user.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const file = req.file;
    const { type } = req.body;

    const allowedTypes = ['license', 'certification', 'testimonial', 'identity'];

    if (!file) return res.status(400).json({ error: 'File is required' });
    if (!type) {
      // remove uploaded file if present
      try {
        const filePath = file && file.destination ? path.join(file.destination, file.filename) : path.join(process.cwd(), 'uploads', file.filename);
        fs.unlinkSync(filePath);
      } catch (e) {}
      return res.status(400).json({ error: 'Document type is required' });
    }
    if (!allowedTypes.includes(type)) {
      // remove uploaded file if present
      try {
        const filePath = file && file.destination ? path.join(file.destination, file.filename) : path.join(process.cwd(), 'uploads', file.filename);
        fs.unlinkSync(filePath);
      } catch (e) {}
      return res.status(400).json({ error: 'Invalid document type' });
    }

    const uploadsBase = process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/uploads` : `${req.protocol}://${req.get('host')}/uploads`;
    const url = `${uploadsBase}/${type}/${file.filename}`;

    const metadata = JSON.stringify({ originalName: file.originalname, mimeType: file.mimetype });

    const [result] = await pool.query(
      'INSERT INTO user_documents (user_id, type, filename, url, size, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, type, file.filename, url, file.size, metadata]
    );

    res.status(201).json({ id: result.insertId, user_id: userId, type, filename: file.filename, url, size: file.size, metadata: JSON.parse(metadata) });
  } catch (error) {

    res.status(500).json({ error: 'An error occurred while uploading document' });
  }
};

export const listDocuments = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // Only allow owners (or admins, later) to list
    if (!req.user || req.user.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [rows] = await pool.query('SELECT id, type, filename, url, size, metadata, verified, created_at FROM user_documents WHERE user_id = ?', [userId]);

    // Parse metadata JSON
    const docs = rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null }));

    res.json({ documents: docs });
  } catch (error) {

    res.status(500).json({ error: 'An error occurred while listing documents' });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const docId = parseInt(req.params.docId, 10);

    // Allow owners or admins to delete
    if (!req.user || (req.user.userId !== userId && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [rows] = await pool.query('SELECT filename, user_id, type FROM user_documents WHERE id = ?', [docId]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filename = rows[0].filename;
    const ownerId = rows[0].user_id;
    const docType = rows[0].type;
    const filePath = path.join(process.cwd(), 'uploads', docType || '', filename);

    // Delete DB row
    await pool.query('DELETE FROM user_documents WHERE id = ?', [docId]);

    // Remove file from disk
    fs.unlink(filePath, (err) => {
      if (err) console.warn('Failed to delete file:', filePath, err.message);
    });

    res.json({ message: 'Document deleted' });
  } catch (error) {

    res.status(500).json({ error: 'An error occurred while deleting document' });
  }
};

export const listAllDocuments = async (req, res) => {
  try {
    // Only admins may access all documents
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [rows] = await pool.query(`SELECT d.id, d.user_id, u.email as user_email, d.type, d.filename, d.url, d.size, d.metadata, d.verified, d.created_at
      FROM user_documents d
      JOIN users u ON u.id = d.user_id
      ORDER BY d.created_at DESC`);

    const docs = rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null }));
    res.json({ documents: docs });
  } catch (error) {
    console.error('List all documents error:', error);
    res.status(500).json({ error: 'An error occurred while listing documents' });
  }
};

export const verifyDocument = async (req, res) => {
  try {
    // Only admins can verify
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const docId = parseInt(req.params.docId, 10);
    const { verified } = req.body;

    if (typeof verified !== 'boolean') return res.status(400).json({ error: 'verified must be boolean' });

    await pool.query('UPDATE user_documents SET verified = ? WHERE id = ?', [verified ? 1 : 0, docId]);

    const [rows] = await pool.query('SELECT id, user_id, type, filename, url, size, metadata, verified, created_at FROM user_documents WHERE id = ?', [docId]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const row = rows[0];
    row.metadata = row.metadata ? JSON.parse(row.metadata) : null;

    res.json({ document: row });
  } catch (error) {
    console.error('Verify document error:', error);
    res.status(500).json({ error: 'An error occurred while verifying document' });
  }
};