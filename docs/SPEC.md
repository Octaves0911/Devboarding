# ROLE
You are a senior full-stack engineer. Build a working prototype called "DevBorading": a developer onboarding platform with a public landing page and role-based dashboards for Admin, HR, Mentor, and Mentee.

# OUTPUT RULES (strict)
- Write code directly to files. Do NOT print code in chat.
- No explanations or summaries. After each phase reply only:
  "Phase N done. Files: <list>. Run: <command>. Test: <what to click>."
- When editing, change only the needed lines. Never rewrite whole files.
- Reuse components (Button, Input, Modal, Table, StatusBadge, TaskCard, FileUpload). No duplicate code.
- Build ONLY the current phase, then stop and wait for "next".
- Maintain PROGRESS.md (max 15 lines): current phase, done items, known issues. Update it at the end of every phase.

# TECH STACK
- Frontend: React + Vite + Tailwind CSS + React Router
- Backend: Node.js + Express REST API
- DB: SQLite + Prisma
- Auth: JWT (httpOnly cookie) + bcrypt
- File uploads: multer, stored in /server/uploads, max 10 MB, types: pdf, docx, xlsx, png, jpg, zip
- Monorepo: /client and /server, single root command to run both

# ROLES & PERMISSIONS (enforce on BACKEND and FRONTEND)
- ADMIN: create, edit, deactivate, delete users; view all users and all tasks (read-only on tasks).
- HR: view all users; create tasks and assign to any HR, MENTOR, or MENTEE; edit/delete own tasks.
- MENTOR: view ONLY own assigned mentees; create tasks ONLY for own mentees; edit/delete own tasks; also receives tasks from HR.
- MENTEE: cannot create tasks; views tasks assigned to them (from HR and mentor); updates status of own tasks and subtasks.
- Only the ASSIGNEE can change a task's status or tick subtasks.
- Only the CREATOR can edit or delete a task.
- Any API request outside these rules returns 403. Frontend hides actions the user can't perform.
- Unauthenticated access to any dashboard route redirects to /login. Wrong-role access shows /unauthorized.

# DATA MODEL
User(id, name, email unique, passwordHash, role[ADMIN|HR|MENTOR|MENTEE], phone?, department?, designation?, joiningDate?, mentorId? -> User, isActive default true, createdAt)
Task(id, title, description, priority[LOW|MEDIUM|HIGH], dueDate, status[TODO|IN_PROGRESS|DONE] default TODO, createdById -> User, assigneeId -> User, completionNote?, completedAt?, batchId? (shared UUID when task is created for multiple assignees at once), createdAt, updatedAt)
Subtask(id, taskId -> Task cascade, title, isDone default false, order)
Attachment(id, taskId -> Task cascade, fileName, filePath, mimeType, size, uploadedById -> User, kind[REFERENCE|SUBMISSION], createdAt)
TaskActivity(id, taskId -> Task cascade, userId -> User, action, fromStatus?, toStatus?, createdAt)

# SEED DATA
Create ONLY one user:
Admin — email: admin@devboarding.com, password: 123456

# PUBLIC PAGES

## Landing page ( / )
- Navbar: logo "DevBorading", links (Features, Contact) that smooth-scroll to sections, "Sign in" button -> /login
- Hero: headline, subheadline about faster developer onboarding, "Get Started" button -> /login
- Features section: 6 cards with icon, title, one-line description:
  Role-based dashboards, Structured task assignment, Subtasks & progress tracking, Document attachments, Mentor–mentee pairing, Real-time status updates
- How it works: 3 steps (Admin creates users -> HR & Mentors assign tasks -> Mentees complete & track)
- Contact section: email, phone, office address (placeholder values), simple contact form (name, email, message) that shows a success toast on submit
- Footer: copyright, links
- Modern, clean, responsive design. Use lucide-react icons.

## Login ( /login )
- Email + password, validation, error message on failure
- On success redirect by role: ADMIN -> /admin, HR -> /hr, MENTOR -> /mentor, MENTEE -> /mentee
- Deactivated users cannot log in (show message)

# SHARED DASHBOARD LAYOUT
- Sidebar with role-specific tabs (below), active tab highlighted
- Top bar: page title, user name, role badge, profile dropdown (My Profile, Logout)
- Role colors: Admin=slate, HR=purple, Mentor=blue, Mentee=green
- Responsive: sidebar collapses to hamburger on mobile
- Toast notifications for every create/update/delete action
- Confirmation modal before any delete or deactivate
- Empty states with a helpful message and action button
- Loading and error states on every data view

# ADMIN DASHBOARD
Tabs: Overview | Users | Create User | All Tasks | My Profile

- Overview (/admin): stat cards (total users, HR, Mentors, Mentees, total tasks), table of 5 most recently created users
- Users (/admin/users): table (name, email, role, assigned mentor, status, created date), search by name/email, filter by role, actions: View, Edit, Deactivate/Activate, Delete
- Create User (/admin/users/new): form fields:
  - Common: full name*, email*, temporary password*, role* (dropdown: HR, Mentor, Mentee), phone, department, joining date
  - If role = MENTOR: designation
  - If role = MENTEE: "Assigned Mentor"* dropdown listing active mentors only (show message + link to create a mentor if none exist)
  - Field-level validation, duplicate-email error, success toast, redirect to Users
- Edit User (/admin/users/:id/edit): same form prefilled; admin can reassign a mentee's mentor
- User detail (/admin/users/:id): profile info; for mentees show assigned mentor; for mentors list their mentees; list of tasks assigned to this user
- Rule: a mentor with assigned mentees cannot be deleted or deactivated until mentees are reassigned (show clear message)
- All Tasks (/admin/tasks): read-only table of every task with filters (status, creator, assignee)

# HR DASHBOARD
Tabs: Overview | Assign Task | Tasks Assigned by Me | My Tasks | Users | My Profile

- Overview (/hr): stat cards (tasks created by me: total, To Do, In Progress, Done, overdue), list of recently completed tasks
- Assign Task (/hr/tasks/new): shared TaskForm (see below). Assignee dropdown lists all active HR, MENTOR, and MENTEE users, grouped by role, searchable
- Tasks Assigned by Me (/hr/tasks): table with filters (status, assignee, priority), search, actions: View, Edit, Delete
- My Tasks (/hr/my-tasks): tasks assigned to me by other HR users
- Users (/hr/users): directory of all users (view-only), click to view profile + tasks

# MENTOR DASHBOARD
Tabs: Overview | My Mentees | Assign Task | Tasks Assigned by Me | My Tasks | My Profile

- Overview (/mentor): mentee count, stat cards for my created tasks by status, per-mentee progress bars (% tasks done)
- My Mentees (/mentor/mentees): cards for assigned mentees only (name, email, department, joining date, progress %); click -> mentee detail with all their tasks (from HR and me)
- Assign Task (/mentor/tasks/new): shared TaskForm, assignee dropdown shows ONLY my mentees
- Tasks Assigned by Me (/mentor/tasks): same as HR version, scoped to my tasks
- My Tasks (/mentor/my-tasks): tasks assigned to me by HR, with status updates

# MENTEE DASHBOARD
Tabs: Overview | My Tasks | My Mentor | My Profile

- Overview (/mentee): progress ring (% done), counts by status, next 3 upcoming due dates, overdue warning
- My Tasks (/mentee/tasks): sub-tabs "All", "Assigned by HR", "Assigned by Mentor"; filter by status; each TaskCard shows title, creator name + role badge, priority, due date, status, subtask progress (e.g., 2/5)
- Task Detail (/mentee/tasks/:id): see shared Task Detail below, plus "Previous task" / "Next task" buttons to move through tasks one by one
- My Mentor (/mentee/mentor): mentor's name, email, designation, department

# SHARED TASK COMPONENTS

## TaskForm (create and edit)
- Title* (max 120 chars), Description* (multiline, min 10 chars), Priority* (Low/Medium/High), Due date* (not in the past), Assignee*
- Pressing Enter in any input field except the description textarea does NOT submit the form; submission is only via the Create / Save Changes button.
- **Create mode — Assignees field:** scrollable checkbox list grouped by role (HR / Mentor / Mentee), with a search input above it. Each role group shows a "Select all / Deselect all" toggle. A count badge above the list shows how many assignees are selected. Clicking a name toggles it. At least one assignee must be selected.
- **Edit mode — Assignee field:** same grouped layout but with radio buttons (single selection only).
- **Multi-assign (create mode):** when more than one assignee is selected, `POST /tasks` sends `assigneeIds` (array of ints). The server validates every assignee against the creator's permission rules; if any fails all are rejected (403, nothing is created). On success, one task copy is created per assignee inside a single transaction, all sharing a `batchId` UUID. The response is `{ tasks, batchId }` for multi-assign and `{ task }` (backward-compatible) for single-assign. Any uploaded reference files are stored once on disk; one Attachment row per task copy points to the same `filePath`.
- Subtasks: dynamic list, add/remove/reorder, each with a title
- Attachments: drag-and-drop multi-file upload (kind = REFERENCE), show file name + size, remove before submit. On multi-assign, a single upload call (with the `batchId` in the form body) creates Attachment rows for every task copy without duplicating the file on disk.
- Submit creates task(s) + subtasks + attachments in one flow, logs TaskActivity "CREATED" per task.
- **Reassign (edit mode):** if the saved assigneeId differs from the current one the server resets `status` to TODO, unticks all subtasks, clears `completionNote` and `completedAt`, and logs a "REASSIGNED" TaskActivity entry.

## Task Detail (all roles)
- Title, description, priority, due date, status badge, creator (name + role), assignee
- Reference attachments with download links
- Subtask checklist: assignee can tick/untick; others see read-only
- Status control (assignee only): TODO -> IN_PROGRESS -> DONE, and back from DONE to IN_PROGRESS
- Rule: task cannot be marked DONE until all subtasks are done (show message)
- On marking DONE: optional completion note + optional submission file upload (kind = SUBMISSION); set completedAt
- Activity timeline from TaskActivity (created, status changes, subtask completions, with user and time)
- Creator sees Edit and Delete buttons; creator sees the updated status, completion note, and submission files immediately on their task list and detail view
- Overdue badge if dueDate passed and status != DONE

# MY PROFILE (all roles)
View own details; edit name and phone; change password (current + new + confirm).

# API (prefix /api)
auth: POST /login, POST /logout, GET /me
users: GET /users, GET /users/:id, POST /users, PUT /users/:id, PATCH /users/:id/status, DELETE /users/:id, GET /users/mentors, GET /users/my-mentees
tasks: GET /tasks?scope=created|assigned|all&status=&assigneeId=, GET /tasks/:id, POST /tasks, PUT /tasks/:id, DELETE /tasks/:id, PATCH /tasks/:id/status
subtasks: PATCH /subtasks/:id/toggle
attachments: POST /tasks/:id/attachments, GET /attachments/:id/download, DELETE /attachments/:id
profile: PUT /profile, PUT /profile/password
All routes apply role checks from the PERMISSIONS section. Validate all input. Return consistent JSON errors: { error: "message" }.

# BUILD PHASES
Phase 1: Scaffold, Prisma schema, migration, admin seed, Express server, auth (login/logout/me) + role middleware.
Phase 2: Users, tasks, subtasks, attachments, profile APIs with full permission checks.
Phase 3: Landing page, login page, shared layout, protected routing, /unauthorized and 404 pages.
Phase 4: Admin dashboard (all tabs).
Phase 5: Shared TaskForm + Task Detail components, then HR dashboard.
Phase 6: Mentor dashboard.
Phase 7: Mentee dashboard.
Phase 8: Verification pass — walk every route and every button for every role, fix anything broken or unlinked, confirm permission rules with test requests (mentor accessing another mentor's mentee must get 403), write README with setup steps and test credentials. Reply with a checklist of verified flows.

Start with Phase 1 now.