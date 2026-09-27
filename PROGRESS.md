# PROGRESS — DevBoarding

## Current Phase: 10 (complete) | Next: Phase 11

## Done
- Phase 1: scaffold, Prisma schema, migration, seed, auth routes, JWT middleware
- Phase 2: full REST API (users, tasks, subtasks, attachments, profile, activity logging)
- Phase 3: frontend shell — landing, login, DashboardLayout, ProtectedRoute, 22 routes wired
- Phase 4: Admin dashboard (all 7 tabs, fully functional)
- Phase 5: Shared components + HR dashboard (fully functional)
- Phase 6: Mentor dashboard (all tabs, fully functional)
- Phase 7: Mentee dashboard (all tabs, fully functional)
- Phase 9: AI Task Generator (HR + Mentor) — LLM helper, generate-tasks, create-tasks, AI tab in TaskForm, DescriptionWithResources
- Phase 10: Code Workspace
  - POST /api/workspaces/templates (MENTOR only) — zip upload, adm-zip extraction, skip traversal/symlinks/binaries/node_modules/.git, max 5 MB / 300 files / 200 KB per file
  - Task.hasWorkspace + Task.workspaceTemplateId migration; workspace copied per assignee on task create (manual + AI bulk); rolls back all tasks on copy failure
  - On reassign: workspace replaced with fresh template copy
  - On task delete: workspace folder removed; template cleaned up when no tasks reference it
  - GET /tree, GET /file, PUT /file (assignee write; read: assignee/creator/HR/admin/mentor), GET /download (zip stream)
  - PUT blocked when task.status === DONE; first PUT on TODO task → IN_PROGRESS
  - TaskForm: MENTOR-only "Include code workspace" toggle + .zip upload in both Manual and AI tabs
  - TaskDetail: "Open in Code Workspace" button when hasWorkspace
  - WorkspacePage: file tree, Monaco editor (local package, no CDN), file tabs, unsaved dot, Ctrl/Cmd+S, top bar, collapsible task panel, right assistant placeholder
  - Routes: /mentee/workspace/:taskId (writable), /mentor/workspace/:taskId, /hr/workspace/:taskId, /admin/workspace/:taskId (all read-only)

## Notes
- Server runs on port 5001 (macOS Control Center holds 5000)
- Uploads stored in /server/uploads, max 10 MB, types: pdf, docx, xlsx, png, jpg, zip
- Workspaces stored in /server/workspaces/templates/ and /server/workspaces/tasks/
- Role colours: Admin=slate, HR=purple, Mentor=blue, Mentee=green
