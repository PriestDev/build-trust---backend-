# Backend Conversion to JavaScript TODO

- [x] Update package.json: Remove TypeScript devDependencies and adjust scripts
- [x] Convert src/server.ts to src/server.js
- [x] Convert src/config/database.ts to src/config/database.js
- [x] Convert src/config/dbInit.ts to src/config/dbInit.js
- [x] Convert src/middleware/auth.ts to src/middleware/auth.js
- [x] Convert src/routes/auth.ts to src/routes/auth.js
- [x] Convert src/services/email.ts to src/services/email.js
- [x] Delete tsconfig.json
- [ ] Test the server to ensure it runs without errors



# BuildTrust — Next Tasks (prioritized)

## Critical (blockers)
1. Fix api client exports & methods
   - Ensure `apiClient.login`, `apiClient.getCurrentUser` and `apiClient.updateProfile` are implemented as class methods and exported from:
     - frontend/src/lib/api.ts
   - Remove mixed/duplicate base URL logic and let apiClient handle base & auth header.

2. Fix auth hooks & redirects
   - Ensure ProtectedRoute returns `<Navigate to="/login" state={{ from: location }} replace />` when unauthenticated.
     - frontend/src/components/ProtectedRoute.tsx or equivalent.
   - After login, navigate to saved location:
     - frontend/src/components/Auth.tsx: `const from = (location.state as any)?.from?.pathname || '/developer-dashboard';` then `navigate(from, { replace: true })`.
   - Ensure useAuth.refreshUser uses `apiClient.getCurrentUser()` (and that method exists).

3. Backend route mismatch / 500 errors
   - Inspect backend route used when updating profile (error shows client calling PUT /api/auth/me).
   - Align client updateProfile to the correct backend path & method (`/api/profile` PATCH or PUT as implemented).
     - backend/src/routes/auth.js (or profile route) — confirm method and body handling.
   - Add better error logging in backend to capture stack trace.

4. Ensure `bio` column exists
   - Confirm `DESCRIBE users;` shows `bio` column.
   - If missing, add via XAMPP mysql or phpMyAdmin:
     - `ALTER TABLE users ADD COLUMN bio TEXT;`
   - Make sure backend runs `initializeDatabase()` on startup (backend/src/config/dbInit.js).

## Frontend fixes
1. Replace manual fetches with `apiClient` calls
   - ClientSetup.tsx, PortfolioSetup.tsx: use `await apiClient.updateProfile(profileData)` (apiClient handles base and auth).
2. Step/save flow in setup components
   - Save personal info immediately after step 1 (handleStepComplete).
   - Incrementally save identity/credentials/projects or ensure final aggregated save works.
   - Fix types: `projects` initial state must be `Project[]` (avoid `unknown[]`): update FormData and updateFormData typings.
   - Fix ProjectGallery prop types: accept `Project[]` or properly map unknown -> Project.
3. Avoid `process` in browser code
   - Use `import.meta.env.VITE_API_URL` or relative `/api/...`.
4. Fix redirects back to home
   - Remove any global useEffect that navigates to `'/'` on auth changes.
   - Use saved `from` state for post-login redirect; fallback only when `from` is empty.

## Backend fixes
1. dbInit and migrations
   - Ensure dbInit adds new columns only if missing. Add explicit `ALTER TABLE users ADD COLUMN bio TEXT` guarded by duplicate-column handling.
   - Consider Sequelize/migration scripts for repeatable schema changes.
2. Profile route
   - Create/verify `/api/profile` route supporting PATCH (or make client call the exact route the server expects).
   - Ensure auth middleware reads token correctly (Authorization header) and `user.id` is available.
3. Fix auth/me route if used
   - If `getCurrentUser` hits `/api/auth/me`, ensure route exists and returns user or change client to call the actual endpoint.

## Developer ergonomics & tests
1. Add API integration tests for:
   - login → refreshUser → protected route access
   - profile update endpoint
2. Add frontend unit tests for setup flows (ClientSetup/PortfolioSetup).
3. Add logging and better error messages in both client & server for failed requests.

## Commands / quick checks
- Start backend (from backend folder):
  - npm run dev OR npm start
- Start frontend:
  - npm start OR npm run dev
- Verify DB schema (PowerShell using XAMPP):
  - & 'C:\xampp\mysql\bin\mysql.exe' -u root -p your_database_name -e "DESCRIBE users;"
- Add bio column manually (if needed) via phpMyAdmin or PowerShell:
  - & 'C:\xampp\mysql\bin\mysql.exe' -u root -p your_database_name -e "ALTER TABLE users ADD COLUMN bio TEXT;"
- Test endpoints with curl/Postman:
  - GET /api/profile (auth)
  - PATCH /api/profile (auth) with JSON body

## Files to inspect / edit (high value)
- frontend/src/lib/api.ts
- frontend/src/hooks/useAuth.tsx
- frontend/src/components/Auth.tsx
- frontend/src/components/ProtectedRoute.tsx
- frontend/src/components/ClientSetup.tsx
- frontend/src/components/PortfolioSetup.tsx
- backend/src/routes/auth.js (and any profile routes)
- backend/src/config/dbInit.js
- package.json (proxy) or Vite config (VITE_API_URL)

## Acceptance criteria (how to confirm completion)
- Login redirects to intended page (not always home).
- `apiClient.login`, `getCurrentUser`, `updateProfile` callable without errors.
- Profile updates succeed (no SQL Unknown column).
- Setup flows persist each step correctly.
- No `process is not defined` errors in browser console.
- No 500s for profile update; server logs show successful SQL update.
