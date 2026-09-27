# Phase 5 Plan — Shared TaskForm, Shared TaskDetail, ProfilePage & HR Dashboard

## Overview

Phase 5 delivers two cross-role shared components (TaskForm and TaskDetail), converts the existing AdminProfile into a reusable ProfilePage component used by all four roles, and then wires up the full HR dashboard using those shared pieces. All placeholder pages for HR are replaced with real functionality.

---

## Sub-Task 1 — Shared `TaskForm` component

**Intent:** Build a single `client/src/components/TaskForm.jsx` that is used by HR (assign to any active user), Mentor (assign to own mentees only), and any future role. The assignee list is passed in as a prop so the component stays role-agnostic.

**Expected Outcomes:**
- `TaskForm` renders: Title, Description, Priority, Due Date, Assignee (dropdown), dynamic Subtask list (add / remove / reorder), and a drag-and-drop multi-file upload for REFERENCE attachments.
- Submitting creates the task, subtasks, and attachments in one flow and logs a `CREATED` TaskActivity entry (handled server-side by existing Phase 2 API).
- The component accepts an optional `task` prop for edit mode; when present, fields are pre-filled and submission calls `PUT /tasks/:id`.
- Validation: title ≤ 120 chars, description ≥ 10 chars, due date not in the past, assignee required.

**Todo List:**
- [ ] Create `client/src/components/TaskForm.jsx` with all fields, validation, subtask list, and file-upload UI.
- [ ] Implement file upload via `POST /tasks/:id/attachments` after task creation; show file name + size + remove button before submit.
- [ ] Export `TaskForm` as default; accept props: `assignees` (array), `task` (optional for edit), `onSuccess` (callback).

**Relevant Context:**
- Existing shared components to reuse: `Button`, `StatusBadge`, `ConfirmModal` — all in `client/src/components/`.
- Form pattern from `AdminProfile.jsx` (local state, field-level errors, toast on success).
- API: `POST /tasks`, `PUT /tasks/:id`, `POST /tasks/:id/attachments`.
- File constraints: max 10 MB, types pdf/docx/xlsx/png/jpg/zip (enforce client-side too).

**Status:** [ ] pending

---

## Sub-Task 2 — Shared `TaskDetail` component

**Intent:** Build a single `client/src/components/TaskDetail.jsx` that all roles render when viewing a task. Role-specific logic (status control, subtask ticking, edit/delete buttons) is driven by comparing `currentUser` against `task.createdById` and `task.assigneeId`.

**Expected Outcomes:**
- Displays: title, description, priority badge, due date, overdue badge (if past due and not DONE), status badge, creator (name + role badge), assignee.
- Reference attachments list with download links; submission attachments shown after DONE.
- Subtask checklist: assignee sees checkboxes (calls `PATCH /subtasks/:id/toggle`); others see read-only.
- Status control strip (assignee only): TODO → IN_PROGRESS → DONE and DONE → IN_PROGRESS; cannot mark DONE unless all subtasks are checked — shows inline message.
- On marking DONE: modal for optional completion note + optional submission file upload.
- Activity timeline from `TaskActivity` records (action, user name, timestamp).
- Creator sees Edit (opens TaskForm in edit mode) and Delete (ConfirmModal) buttons.
- Accept optional `prevId` / `nextId` props so Mentee dashboard can add Previous/Next navigation.

**Todo List:**
- [ ] Create `client/src/components/TaskDetail.jsx` with all display sections.
- [ ] Implement subtask toggle via `PATCH /subtasks/:id/toggle`.
- [ ] Implement status transitions via `PATCH /tasks/:id/status`; enforce all-subtasks-done rule client-side.
- [ ] Implement DONE flow: completion note + optional submission file upload.
- [ ] Implement Delete with `ConfirmModal`, then call `DELETE /tasks/:id` and invoke `onDelete` callback.
- [ ] Render activity timeline sorted by `createdAt` ascending.
- [ ] Accept and render `prevId`/`nextId` navigation links when provided.

**Relevant Context:**
- `StatusBadge` supports `status`, `priority`, and `role` types.
- `ConfirmModal` and `Button` already exist.
- API: `PATCH /tasks/:id/status`, `PATCH /subtasks/:id/toggle`, `POST /tasks/:id/attachments`, `DELETE /tasks/:id`, `GET /tasks/:id`.
- Overdue logic: `dueDate < today && status !== 'DONE'`.

**Status:** [ ] pending

---

## Sub-Task 3 — Shared `ProfilePage` component (convert AdminProfile)

**Intent:** Extract `AdminProfile.jsx` into `client/src/components/ProfilePage.jsx` so all four roles (Admin, HR, Mentor, Mentee) share one implementation. Each role-specific profile page becomes a thin wrapper that renders `<ProfilePage />`.

**Expected Outcomes:**
- `ProfilePage` component contains the full edit-name/phone and change-password forms currently in `AdminProfile.jsx`.
- `AdminProfile.jsx`, `HRProfile.jsx`, `MentorProfile.jsx`, and `MenteeProfile.jsx` each render only `<ProfilePage />` — no duplicated form logic.
- Behaviour is identical to the existing Admin My Profile tab.

**Todo List:**
- [ ] Create `client/src/components/ProfilePage.jsx` by moving the full implementation from `AdminProfile.jsx`.
- [ ] Replace `AdminProfile.jsx` body with `<ProfilePage />`.
- [ ] Replace `HRProfile.jsx`, `MentorProfile.jsx`, `MenteeProfile.jsx` bodies with `<ProfilePage />`.

**Relevant Context:**
- Source file: `client/src/pages/admin/AdminProfile.jsx` (204 lines).
- Profile pages currently at: `client/src/pages/hr/HRProfile.jsx`, `client/src/pages/mentor/MentorProfile.jsx`, `client/src/pages/mentee/MenteeProfile.jsx` — all currently placeholders.
- API calls used: `PUT /profile`, `PUT /profile/password`.
- `useAuth()` hook from `client/src/context/AuthContext.jsx`.

**Status:** [ ] pending

---

## Sub-Task 4 — HR Dashboard (all tabs)

**Intent:** Wire up all five HR dashboard tabs using the shared components built above. Replace all HR placeholder pages with real functionality.

**Expected Outcomes:**
- **Overview** (`/hr`): stat cards (my tasks: total, To Do, In Progress, Done, overdue) + list of recently completed tasks.
- **Assign Task** (`/hr/tasks/new`): renders `TaskForm`; assignee dropdown lists all active HR, Mentor, and Mentee users grouped by role and searchable; on success redirects to `/hr/tasks`.
- **Tasks Assigned by Me** (`/hr/tasks`): table with filters (status, assignee, priority) and search; actions View (→ task detail route), Edit (TaskForm in edit mode), Delete (ConfirmModal).
- **My Tasks** (`/hr/my-tasks`): table of tasks assigned to the current HR user; each row links to task detail; status updates via TaskDetail.
- **Users** (`/hr/users`): read-only directory of all users; click a user to view their profile and tasks (can reuse `AdminUserDetail` or a lightweight read-only variant).
- **My Profile** (`/hr/profile`): renders `ProfilePage`.

**Todo List:**
- [ ] Build `HROverview.jsx` with stat cards and recent-completions list.
- [ ] Build `HRAssignTask.jsx`: fetch all active HR+Mentor+Mentee users, group by role, pass as `assignees` to `TaskForm`.
- [ ] Add route `/hr/tasks/:id` for task detail and build `HRTaskDetail.jsx` (thin wrapper around `TaskDetail`).
- [ ] Build `HRTasks.jsx`: task table with filters/search, View/Edit/Delete actions.
- [ ] Build `HRMyTasks.jsx`: tasks assigned to me, each row navigates to task detail.
- [ ] Build `HRUsers.jsx`: user directory, click → user detail view.
- [ ] Update `HRProfile.jsx` to render `<ProfilePage />` (covered by Sub-Task 3).
- [ ] Verify all new HR routes are registered in `App.jsx` (add `/hr/tasks/:id` if missing).

**Relevant Context:**
- HR assignee scope: all active users with role HR, MENTOR, or MENTEE — `GET /users` then filter client-side, or use query params if supported.
- `AdminUserDetail.jsx` already exists and can be referenced for the Users tab user-detail view.
- Role colour for HR sidebar: `bg-purple-800` (already set in `DashboardLayout`).
- Existing HR route stubs in `App.jsx`: `/hr`, `/hr/tasks/new`, `/hr/tasks`, `/hr/my-tasks`, `/hr/users`, `/hr/profile`.

**Status:** [ ] pending
