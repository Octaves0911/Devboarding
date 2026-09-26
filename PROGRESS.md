# PROGRESS — DevBoarding

## Current Phase: 4 (complete) | Next: Phase 5

## Done
- Phase 1: scaffold, Prisma schema, migration, seed, auth routes, JWT middleware
- Phase 2: full REST API (users, tasks, subtasks, attachments, profile, activity logging)
- Phase 3: frontend shell — landing, login, DashboardLayout, ProtectedRoute, 22 routes wired
- Phase 4: Admin dashboard (all 7 tabs, fully functional)
  - Shared components: Button, ConfirmModal, StatusBadge
  - Overview: stat cards (users by role + tasks), recent-users table, click-to-navigate
  - Users: table with search/role filter, View/Edit/Deactivate/Activate/Delete actions + confirmation modals
  - Create User: form with conditional fields (designation for MENTOR, mentor dropdown for MENTEE), no-mentor warning + link
  - Edit User: prefilled form, mentor reassignment for MENTEE, role shown read-only
  - User Detail: profile info, mentor link for MENTEE, mentees list for MENTOR, tasks table
  - All Tasks: read-only table, filters by status/creator/assignee, overdue badge
  - My Profile: view info, edit name+phone, change password
  - Mentor-with-mentees block: clear error shown on deactivate/delete attempt

## Notes
- Server runs on port 5001 (macOS Control Center holds 5000)
- Uploads stored in /server/uploads, max 10 MB, types: pdf, docx, xlsx, png, jpg, zip
- Role colours: Admin=slate, HR=purple, Mentor=blue, Mentee=green
