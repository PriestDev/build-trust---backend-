import pool from '../config/database.js';

export const getUsers = async (req, res) => {
  try {
    const [results] = await pool.query('SELECT id, email, name, role, created_at FROM users');
    res.json(results);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'An error occurred while fetching users' });
  }
};

export default { getUsers };