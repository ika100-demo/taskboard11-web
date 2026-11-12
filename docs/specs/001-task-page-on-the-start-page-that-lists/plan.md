---
spec_id: 001-task-page-on-the-start-page-that-lists
shape: web-nextjs
spec_hash: 3ab38daa9544
summary: Replace the starter page at / with a task page that lists and creates tasks through the Task API (server-side only)
tasks:
  - id: t1
    title: Add task types, title rule and the server-only Task API client
    files: [lib/tasks.ts, lib/task-api.ts, docs/env-vars.md]
    covers: [AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6]
    parallel_safe: true
    depends_on: []
  - id: t2
    title: Add the create-task server action and the TaskBoard client component
    files: [app/actions.ts, app/_components/task-board.tsx, app/globals.css]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6]
    parallel_safe: true
    depends_on: [t1]
  - id: t3
    title: Replace the starter page at / with the dynamic task page
    files: [app/page.tsx, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts]
    covers: [AC-001.1, AC-001.2, AC-001.5]
    parallel_safe: true
    depends_on: [t1, t2]
---

# Plan — 001 Task page on the start page

Contract, module boundaries and the DOM the acceptance tests select on: [design.md](design.md). The system wires `TASK_API_URL` (spec "Provided by the system"), so there is no gitops task.

## t1 — Add task types, title rule and the server-only Task API client

**Files:** lib/tasks.ts, lib/task-api.ts, docs/env-vars.md
**Covers:** AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6
**Goal:** one module the browser may import (types, title rule, the five user texts) and one server-only module that talks to the Task API exactly per the contract and turns every non-contract outcome into a plain failure.

**Implementation notes:**
- `lib/tasks.ts`: `Task`, `NewTask`, `isValidTitle`, `TEXT` exactly as in design.md. `isValidTitle`: `[...title].length` between 1 and 200 and `title.trim() !== ""`. No Node-only imports (the client component imports it).
- `lib/task-api.ts`: `listTasks()` and `createTask(input)` with the result types from design.md. Read `process.env.TASK_API_URL` inside each call (not at module load); unset or empty is a failure (`error_kind: "config"`).
- `fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000), ... })`; POST sends `Content-Type: application/json` and `JSON.stringify({ title, due_date })` with the title untouched.
- Success only on `200` + array of valid Task objects (list) and `201` + one valid Task object (create); a small type guard checks `id` non-empty string, `title` string, `due_date` string or null. Everything else, including 422 and 503, is `{ ok: false }`.
- Classify failures for the log: `TimeoutError`/`AbortError` → `timeout`, other thrown errors → `network`, unexpected status → `http_status` (with `status`), JSON parse or shape failure → `bad_body`. One `logger.warn("task api call failed", { op, status?, error_kind })` per failed call; never log the title or the response body. No retries.
- `docs/env-vars.md`: add `TASK_API_URL` under Core: no default (page shows the load error when unset), base URL of the Task API, server-only, never `NEXT_PUBLIC_*`, dev value `http://taskboard11-api` set by the system.

**Done when:** `devbox run quality` is clean; the client behaviour the covered criteria need (ordering preserved, `null` due date sent, 5 s timeout, non-200/non-201 as failure) is in place for t2 and t3; the acceptance tests pass once t3 lands.

## t2 — Add the create-task server action and the TaskBoard client component

**Files:** app/actions.ts, app/_components/task-board.tsx, app/globals.css
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6
**Goal:** the interactive part of the page: list rendering, empty and load-error states, and a create form that validates locally, saves through the server action and keeps or clears its values per the criteria.

**Implementation notes:**
- `app/actions.ts`: `"use server"`; `createTaskAction({ title, due_date })` maps `""` to `null`, returns `{ ok: false, error: "invalid" }` without calling the API when `!isValidTitle(title)`, else calls `createTask` and returns `{ ok: true, task }` or `{ ok: false, error: "save_failed" }`.
- `app/_components/task-board.tsx`: `"use client"`; props `{ initialTasks: Task[]; loadFailed: boolean }`; markup, labels and texts exactly as the design.md DOM table (texts from `TEXT`).
- Controlled `title` and `dueDate` state; `<form noValidate onSubmit>` with `preventDefault`; do not use `<form action>` (React 19 would reset the fields on AC-001.4/AC-001.6).
- On submit: clear the form error; if `!isValidTitle(title)` show `TEXT.invalidTitle` and stop (no action call); otherwise call `createTaskAction` inside `startTransition`, button disabled while pending.
- On `ok`: append `task` to the list state, clear both fields. On `save_failed`, on a thrown action error: show `TEXT.saveFailed`, keep values, list unchanged. On `invalid`: show `TEXT.invalidTitle`.
- `loadFailed`: render the load-error alert instead of the list / empty text; the form stays; a later successful create clears the form and keeps the load error.
- `app/globals.css`: styles for the task list, form and alerts using the existing tokens; keep the 375 px no-horizontal-scroll property (long titles wrap with `overflow-wrap: anywhere`).

**Done when:** `devbox run quality` is clean and the component-level acceptance tests for AC-001.3, AC-001.4 and AC-001.6 pass; AC-001.1, AC-001.2 and AC-001.5 pass after t3.

## t3 — Replace the starter page at / with the dynamic task page

**Files:** app/page.tsx, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts
**Covers:** AC-001.1, AC-001.2, AC-001.5
**Goal:** `/` loads the tasks on the server per request and renders the task page; the starter content and its tests go.

**Implementation notes:**
- `app/page.tsx`: `export const dynamic = "force-dynamic"`; `export default async function HomePage()` calls `listTasks()` and renders the single `<h1>Tasks</h1>` plus `<TaskBoard initialTasks={...} loadFailed={!result.ok} />`.
- Delete `app/_components/feature-card.tsx` and `app/_components/icons.tsx` (only the starter page used them; they would also drag `app/**` coverage down).
- `tests/page.test.tsx`: drop the starter-page assertions; keep only non-criterion checks that still hold (single `<h1>` "Tasks", form present), rendering `await HomePage()` with `fetch` stubbed. Do not duplicate the acceptance tests.
- `e2e/home.spec.ts`: h1 name becomes "Tasks"; replace the "Check health" link test with a request to `/api/health` (the header nav still links it); keep landmarks, 404 and phone-width tests. No Task API runs locally, so these must not depend on the list.
- `e2e/smoke.spec.ts`: keep the read-only `@smoke` test (`/` loads, h1 "Tasks" and the "Create task" form visible); add a `@smoke @writes` test that submits title `smoke-<uuid>` with an empty due date and expects it in the "Tasks" list with "No due date".

**Done when:** all acceptance tests for AC-001.1 to AC-001.6 pass, `devbox run ci` is green (coverage thresholds included), and `devbox run e2e` passes without a Task API.
