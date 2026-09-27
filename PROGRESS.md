# PROGRESS — DevBoarding

## Current Phase: 12 (complete) | Next: Phase 13

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
- Phase 11: AI Code Review + Guarded Assistant
  - Review model + migration (verdict, summary, issuesJson, cascades on Task delete)
  - POST /workspaces/:taskId/submit: unified diff vs template, 40k-char cap, callLLM temperature=0, strict verdict validation (PASS/FAIL), in-memory concurrent-submit lock; PASS ticks subtasks + marks DONE + completionNote; FAIL logs AI_REVIEW_FAILED; 502 on invalid JSON
  - POST /workspaces/:taskId/approve (creator only): ticks subtasks, marks DONE, logs APPROVED_BY_MENTOR
  - GET /workspaces/:taskId/reviews: review history endpoint
  - POST /workspaces/:taskId/assistant (assignee only): classifier pre-flight (temperature=0, isSolveRequest), fixed refusal string + hint on true; tutor system prompt with untrusted-data guardrail + refusal rule; last 10 messages; 30k-char file context with open-file priority
  - Prompt injection: reviewer + assistant system prompts label file contents as untrusted data; file contents wrapped in <<<FILE:>>> delimiters
  - WorkspacePage: Submit for review button (disabled when not IN_PROGRESS or submitting), review result panel (PASS/FAIL, issues list, click-to-navigate to file+line), assistant chat (Enter to send, history in component state, read-only mode hides chat)
  - TaskDetail: Review History section (assignee + creator), Approve anyway button (creator + workspace + not DONE), new activityLabel entries
  - callLLM: temperature param added
- Phase 12: Notifications
  - Notification model + migration (userId, type, title, body, link, isRead, createdAt; cascade on user delete)
  - notify(userIds, payload, exceptId) in server/src/lib/notify.js; failures are logged and do not fail the action
  - Triggers: task assigned (tasks.js, ai.js), reassigned, status change (tasks.js, subtasks.js, workspaces.js first save + approve), subtask ticked, submission (attachments + workspace submit), AI review (creator and the mentee's mentor)
  - No-op hooks for Phases 13–14: onNewChatMessage, onMeetingRequest, onMeetingResponse, onMeetingCancel
  - GET /notifications, GET /notifications/unread-count, PATCH /notifications/:id/read, PATCH /notifications/read-all (own rows only)
  - Bell in dashboard top bar: unread badge, latest 10, click marks read and navigates, Mark all read, poll every 15s

## Notes
- Server runs on port 5001 (macOS Control Center holds 5000)
- Uploads stored in /server/uploads, max 10 MB, types: pdf, docx, xlsx, png, jpg, zip
- Workspaces stored in /server/workspaces/templates/ and /server/workspaces/tasks/
- Role colours: Admin=slate, HR=purple, Mentor=blue, Mentee=green
