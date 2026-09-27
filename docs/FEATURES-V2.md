# DevBoarding v2 Features

Same OUTPUT RULES as docs/SPEC.md. Build ONLY the named phase, then stop.
SPEC.md Phase 8 (verification) is replaced by Phase 15 below.
Never read or print .env values. Use process.env only.

## Shared LLM helper (build in Phase 9, reuse in all AI phases)
- server/src/lib/llm.js: callLLM({ system, messages, json })
- POST `${AIMLAPI_BASE_URL}/chat/completions` (OpenAI-compatible), header `Authorization: Bearer ${AIMLAPI_KEY}`, model = AIMLAPI_MODEL. Defaults in .env.example: AIMLAPI_BASE_URL=https://api.aimlapi.com/v1
- 60s timeout. If json=true: instruct JSON-only, strip ``` fences, JSON.parse, retry once on parse failure.
- Key never sent to the client. In-memory rate limit: 10 AI calls/min per user. Friendly error messages on failure.

## Phase 9 — AI Task Generator (HR + Mentor)
- TaskForm create mode gets two tabs: "Manual" (existing) and "AI Assistant".
- Inputs: roadmap text (required, 20–4000 chars), start date (default today), optional total duration in days.
- POST /api/ai/generate-tasks { roadmap, startDate, durationDays? } — HR and MENTOR only.
- LLM JSON: { tasks: [{ title, description, priority, estimatedDays, subtasks: [string], resources: [{ title, url }] }] }. Max 10 tasks, 6 subtasks, 3 resources each.
- Server checks each resource URL (HEAD, fallback GET, 5s timeout) and drops unreachable ones. Due dates computed sequentially: startDate + cumulative estimatedDays.
- Editable preview: each task card editable (title, description, priority, due date, add/remove subtasks, remove resources), remove task, "Regenerate" button.
- One assignee checkbox selection (existing component) applies to all generated tasks. "Create all" reuses the existing task-creation service function (no HTTP loop). Resources stored in description under a "Resources" heading; TaskDetail renders links clickable.
- Nothing is created until "Create all". Loading state and error toast.

## Phase 10 — Code Workspace
- TaskForm (MENTOR only): toggle "Include code workspace" + .zip upload (max 5 MB).
- Server extracts with adm-zip into workspaces/templates/<batchId>/. Skip node_modules, .git, binaries, files > 200 KB; max 300 files; reject path traversal (zip-slip).
- Add Task.hasWorkspace (migration). Each assignee copy gets its own workspaces/tasks/<taskId>/ copied from the template; template kept for diffing.
- TaskDetail shows "Open in Code Workspace" when hasWorkspace → /mentee/workspace/:taskId (mentor/HR/admin get a read-only version via their own route).
- Workspace page: left file tree; center Monaco editor (@monaco-editor/react) with file tabs, unsaved dot, Ctrl/Cmd+S save; top bar with task title and collapsible task panel (description, subtasks, resources); right panel reserved for the assistant (Phase 11); "Download as zip" button.
- API: GET /workspaces/:taskId/tree, GET and PUT /workspaces/:taskId/file?path=, GET /workspaces/:taskId/download. Only the assignee writes; assignee, creator, HR, admin can read. Path traversal protection on every route.
- First save on a TODO task moves it to IN_PROGRESS.

## Phase 11 — AI Code Review + Guarded Assistant
Submit for review:
- Workspace "Submit for review" button. POST /workspaces/:taskId/submit (assignee only, task IN_PROGRESS).
- Build unified diff vs template (npm `diff`). Send task title, description, subtasks, diff, and full content of changed files (cap 40k chars). If no changes → 400 "No changes to review."
- LLM JSON: { verdict: "PASS" | "FAIL", summary, issues: [{ file, line?, severity: "error" | "warning", message }] }.
- New model Review(id, taskId, verdict, summary, issuesJson, createdAt).
- PASS: tick all subtasks, status DONE, completedAt, completionNote = summary, activity "AI_REVIEW_PASSED".
- FAIL: stays IN_PROGRESS, activity "AI_REVIEW_FAILED", issues listed in workspace; clicking an issue opens the file at that line.
- Review history shown in TaskDetail for mentee and mentor. Mentor sees "Approve anyway" to mark DONE.
Assistant:
- Right panel chat. POST /workspaces/:taskId/assistant { messages } — assignee only.
- Context: task description + file tree + currently open file + other files up to 30k chars total.
- System prompt: patient tutor. Explains concepts, errors, and code the mentee points at; gives hints and small generic examples. NEVER writes the solution or completes the assigned task or subtasks. If asked to do, solve, complete, or write the task/subtask, or to give full fixed code, reply exactly: "This particular question won't be entertained. You need to fix it yourself." then offer one conceptual hint.
- History kept in component state only.

## Phase 12 — Notifications (includes keeping the mentor updated)
- Model Notification(id, userId, type, title, body, link, isRead, createdAt).
- Helper notify(userIds, payload). Trigger on: task assigned (assignee), task reassigned, status change, subtask ticked, submission, AI review result (task creator AND the mentee's mentor for any mentee task), meeting request/response and new chat message (hook points for Phases 13–14).
- API: GET /notifications, GET /notifications/unread-count, PATCH /notifications/:id/read, PATCH /notifications/read-all.
- Bell in top bar: unread badge, dropdown with latest 10, click marks read and navigates to link, "Mark all read". Poll unread count every 15s. No websockets.

## Phase 13 (stretch) — Chat
- Shared helper allowedContacts(user): mentee ↔ own mentor; HR and Admin ↔ everyone; mentor ↔ HR and Admin.
- Models Conversation(id, userAId, userBId, lastMessageAt), ChatMessage(id, conversationId, senderId, body, createdAt, readAt).
- "Chat" tab in every sidebar: contact list (allowed contacts, unread counts) + thread view + input. Poll every 5s while open. Notify recipient on new message.

## Phase 14 (stretch) — Calendar
- Uses allowedContacts (create it here if Phase 13 was skipped).
- Model Meeting(id, organizerId, inviteeId, title, description?, meetingLink?, startAt, endAt, status [PENDING | ACCEPTED | DECLINED | CANCELLED]).
- "Calendar" tab for all roles: simple month grid (no extra library) + upcoming list. "Request meeting" modal: invitee, title, date, start/end time, optional link.
- Invitee sees pending requests with Accept/Decline. Accepted meetings appear on both calendars. Organizer can cancel. Overlap warning against the invitee's accepted meetings. Notifications on request, response, cancel.

## Phase 15 — Final verification (no new features)
- Rerun scripts/test-phase2.mjs and fix failures.
- Walk every tab and button for every role; fix broken links only.
- README following the hackathon template: problem, features, architecture, setup, env vars (placeholders), test credentials, Bob features used.
