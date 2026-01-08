# BuildTrust Backend

Node.js/Express backend API with MySQL database.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory:
```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=buildtrust

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:8080
```

3. Create the MySQL database:
```sql
CREATE DATABASE buildtrust;
```

4. Run the server:
```bash
npm run dev
```

The server will automatically create the required tables on first run.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create a new account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Sign out

### Health Check
- `GET /api/health` - Check API status

## Database Schema

### Users Table
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `email` (VARCHAR(255), UNIQUE, NOT NULL)
- `password` (VARCHAR(255), NOT NULL)
- `name` (VARCHAR(255))
- `role` (ENUM('client', 'developer'), DEFAULT 'client')
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Sessions Table
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `user_id` (INT, FOREIGN KEY)
- `token` (VARCHAR(500), NOT NULL)
- `expires_at` (TIMESTAMP, NOT NULL)
- `created_at` (TIMESTAMP)


# buildtrust_backend
