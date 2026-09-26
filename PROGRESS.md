# PROGRESS — DevBoarding

## Current Phase: 3 (complete) | Next: Phase 4

## Done
- Phase 1: scaffold, Prisma schema, migration, seed, auth routes, JWT middleware
- Phase 2: full REST API (users, tasks, subtasks, attachments, profile, activity logging)
- Phase 3: frontend shell
  - AuthContext + useAuth hook; axios client (withCredentials)
  - Landing page: navbar, hero, 6 feature cards, how-it-works, contact form+toast, footer
  - Login page: validation, role-based redirect, deactivated-user error
  - DashboardLayout: role-coloured sidebar (all tabs routed), topbar, profile dropdown, mobile hamburger
  - ProtectedRoute: unauthenticated → /login; wrong role → /unauthorized
  - All 22 dashboard routes wired (Admin 7, HR 6, Mentor 6, Mentee 5) — placeholders for Phase 4+
  - /unauthorized and 404 pages

## Notes
- Server runs on port 5001 (macOS Control Center holds 5000)
- Uploads stored in /server/uploads, max 10 MB, types: pdf, docx, xlsx, png, jpg, zip
- Role colours: Admin=slate, HR=purple, Mentor=blue, Mentee=green
