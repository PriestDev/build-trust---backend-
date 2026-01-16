import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const createProject = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.userId || decoded.id;

    const { title, type, location, budget, description, client_id } = req.body;

    // Use client_id from request or fall back to authenticated user ID
    const projectClientId = client_id || userId;

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({ 
        error: 'Project title and description are required',
        received: { title, description }
      });
    }

    // Insert project into database
    const [insertResult] = await pool.query(
      `INSERT INTO projects (client_id, title, type, location, budget, description, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [projectClientId, title, type || '', location || '', budget || '', description, 'active']
    );

    const projectId = insertResult.insertId;

    // Fetch the created project
    const [projects] = await pool.query(
      'SELECT id, client_id, title, type, location, budget, description, status, created_at, updated_at FROM projects WHERE id = ?',
      [projectId]
    );

    const project = Array.isArray(projects) && projects[0] ? projects[0] : null;

    res.json({ 
      message: 'Project created successfully', 
      id: projectId,
      project 
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'An error occurred while creating the project', details: error.message });
  }
};

export const uploadProjectMedia = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.userId || decoded.id;
    const { projectId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Verify project belongs to user
    const [projects] = await pool.query(
      'SELECT client_id FROM projects WHERE id = ?',
      [projectId]
    );

    if (!projects || !projects[0] || projects[0].client_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized: Project does not belong to this user' });
    }

    // Store media reference (assuming multer handles file upload to /uploads)
    const mediaUrl = `/uploads/${req.file.filename}`;
    const [insertResult] = await pool.query(
      `INSERT INTO project_media (project_id, type, url, filename, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [projectId, 'media', mediaUrl, req.file.filename]
    );

    res.json({
      message: 'Media uploaded successfully',
      id: insertResult.insertId,
      url: mediaUrl
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'An error occurred while uploading media' });
  }
};

export const getProjects = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.userId || decoded.id;

    const [projects] = await pool.query(
      'SELECT id, client_id, title, type, location, budget, description, status, created_at, updated_at FROM projects WHERE client_id = ?',
      [userId]
    );

    res.json({ 
      projects: Array.isArray(projects) ? projects : [] 
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'An error occurred while fetching projects' });
  }
};

export const updateProject = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.userId || decoded.id;
    const { projectId } = req.params;
    const { title, type, location, budget, description, status } = req.body;

    // Verify project belongs to user
    const [projects] = await pool.query(
      'SELECT client_id FROM projects WHERE id = ?',
      [projectId]
    );

    if (!projects || !projects[0] || projects[0].client_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized: Project does not belong to this user' });
    }

    // Update project
    await pool.query(
      `UPDATE projects SET title = ?, type = ?, location = ?, budget = ?, description = ?, status = ?, updated_at = NOW() 
       WHERE id = ?`,
      [title || '', type || '', location || '', budget || '', description || '', status || 'active', projectId]
    );

    const [updatedProjects] = await pool.query(
      'SELECT id, client_id, title, type, location, budget, description, status, created_at, updated_at FROM projects WHERE id = ?',
      [projectId]
    );

    const project = Array.isArray(updatedProjects) && updatedProjects[0] ? updatedProjects[0] : null;

    res.json({ 
      message: 'Project updated successfully', 
      project 
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'An error occurred while updating the project' });
  }
};

export const deleteProject = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.userId || decoded.id;
    const { projectId } = req.params;

    // Verify project belongs to user
    const [projects] = await pool.query(
      'SELECT client_id FROM projects WHERE id = ?',
      [projectId]
    );

    if (!projects || !projects[0] || projects[0].client_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized: Project does not belong to this user' });
    }

    // Delete project
    await pool.query('DELETE FROM projects WHERE id = ?', [projectId]);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'An error occurred while deleting the project' });
  }
};
