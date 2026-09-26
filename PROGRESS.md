# PROGRESS — DevBoarding

## Current Phase: 1 (complete) | Next: Phase 2

## Done
- Monorepo scaffold: /client (React + Vite + Tailwind + React Router) and /server (Express)
- Prisma schema: User, Task, Subtask, Attachment, TaskActivity
- SQLite migration applied (dev.db created)
- Admin seed: admin@devboarding.com / Admin@123
- Auth routes: POST /api/login, POST /api/logout, GET /api/me
- JWT httpOnly cookie auth + role middleware (authenticate, authorize)
- Root `npm run dev` starts both client (5173) and server (5001) via concurrently

## Notes
- Server runs on port 5001 (macOS Control Center holds 5000)
- Login endpoint: POST /api/login
