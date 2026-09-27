# PROGRESS — DevBoarding

## Current Phase: 9 (complete) | Next: Phase 10

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

- Phase 9: AI Task Generator (HR + Mentor)
  - Shared LLM helper: server/src/lib/llm.js — callLLM({ system, messages, json }), 60s timeout, in-memory rate limit 10 calls/min per user, JSON mode with fence-stripping, retry once on parse failure
  - POST /api/ai/generate-tasks — HR + MENTOR only; validates roadmap (20–4000 chars); calls LLM for up to 10 tasks; parallel HEAD/GET URL-checks each resource (5s timeout, drops unreachable); computes sequential due dates from startDate + cumulative estimatedDays
  - POST /api/ai/create-tasks — bulk-creates confirmed preview tasks for all selected assignees; resources appended to description under a "## Resources" heading
  - TaskForm create mode: two tabs — "Manual" (unchanged) and "AI Assistant"; AI tab has roadmap textarea (char counter), start date, optional duration; Generate button → editable preview cards (title, description, priority, due date, add/remove subtasks, remove resources, remove task); Regenerate button; assignee checkbox selection applies to all tasks; "Create all (N)" button
  - TaskDetail: DescriptionWithResources renderer parses "## Resources" markdown links and renders them as clickable anchors with ExternalLink icon

## Notes
- Server runs on port 5001 (macOS Control Center holds 5000)
- Uploads stored in /server/uploads, max 10 MB, types: pdf, docx, xlsx, png, jpg, zip
- Role colours: Admin=slate, HR=purple, Mentor=blue, Mentee=green
