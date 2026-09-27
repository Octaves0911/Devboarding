# PROGRESS — DevBoarding

## Current Phase: 7 (complete) | Next: Phase 8

## Done
- Phase 1: scaffold, Prisma schema, migration, seed, auth routes, JWT middleware
- Phase 2: full REST API (users, tasks, subtasks, attachments, profile, activity logging)
- Phase 3: frontend shell — landing, login, DashboardLayout, ProtectedRoute, 22 routes wired
- Phase 4: Admin dashboard (all 7 tabs, fully functional)
- Phase 5: Shared components + HR dashboard (fully functional)
- Phase 6: Mentor dashboard (all tabs, fully functional)
- Phase 7: Mentee dashboard (all tabs, fully functional)
  - MenteeOverview: SVG progress ring (% done), status stat cards (todo/inprogress/done), next 3 upcoming due dates, overdue banner
  - MenteeTasks: sub-tabs (All / Assigned by HR / Assigned by Mentor), status filter, table with subtask progress (e.g. 2/5), overdue badge, click → detail
  - MenteeTaskDetail: TaskDetail with prevId/nextId navigation (Previous/Next buttons cycle through assigned tasks)
  - MenteeMentor: mentor card (name, email, phone, designation, department)
  - New API: GET /users/my-mentor (MENTEE only — returns own assigned mentor's details)

## Notes
- Server runs on port 5001 (macOS Control Center holds 5000)
- Uploads stored in /server/uploads, max 10 MB, types: pdf, docx, xlsx, png, jpg, zip
- Role colours: Admin=slate, HR=purple, Mentor=blue, Mentee=green
