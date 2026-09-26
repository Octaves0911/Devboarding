# PROGRESS — DevBoarding

## Current Phase: 2 (complete) | Next: Phase 3

## Done
- Phase 1: scaffold, Prisma schema, migration, seed, auth routes, JWT middleware
- Phase 2: full REST API (users, tasks, subtasks, attachments, profile)
  - Users: CRUD + status toggle, mentor-has-mentees guard (blocks deactivate AND delete)
  - Tasks: role-scoped visibility (ADMIN/HR all; MENTOR own+assigned+mentees; MENTEE assigned only)
  - POST /tasks: HR→any HR/MENTOR/MENTEE; MENTOR→own mentees only; ADMIN/MENTEE→403
  - Subtask toggle: assignee only; unticking on DONE task reverts to IN_PROGRESS
  - Attachments: REFERENCE upload = creator only; SUBMISSION = assignee only; download = view-permitted users
  - Profile: edit name/phone + change password (bcrypt re-hash)
  - Activity logging on create, status change, subtask tick/untick
  - isActive checked on every authenticated request (existing middleware)

## Notes
- Server runs on port 5001 (macOS Control Center holds 5000)
- Uploads stored in /server/uploads, max 10 MB, types: pdf, docx, xlsx, png, jpg, zip
