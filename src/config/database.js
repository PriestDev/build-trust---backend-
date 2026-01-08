import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'buildtrust',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test database connection
pool.getConnection()
  .then((connection) => {
    console.log('✅ MySQL database connected successfully');
    connection.release();
  })
  .catch((error) => {
    console.error('❌ MySQL database connection failed:', error.message);
  });

export default pool;
