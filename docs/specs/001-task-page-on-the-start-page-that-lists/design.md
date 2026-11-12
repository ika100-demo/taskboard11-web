# Design — 001 Task page on the start page

## Decisions

- **Server Component reads, Server Action writes.** `/` is an async Server Component that calls `GET /tasks` per request (`export const dynamic = "force-dynamic"`, `fetch(..., { cache: "no-store" })`). Creating goes through one Server Action (`app/actions.ts`), not a route handler: no extra public endpoint to secure or document, and the browser never sees `TASK_API_URL` (spec notes). Feature-local, so no ADR.
- **One server-only client module** (`lib/task-api.ts`) owns `TASK_API_URL`, the 5 s timeout (`AbortSignal.timeout(5000)`), response-shape checks and the one log line per failed call. Everything above it sees only `ok` / `error` results, never statuses or `detail` (spec Errors).
- **Controlled form, submitted with `onSubmit`, not `<form action>`.** React 19 resets a form after a form action completes; AC-001.4 and AC-001.6 require the entered values to stay. The client component keeps title and due date in `useState`, calls the action inside `startTransition`, and clears state only on success (AC-001.3).
- **Title rule is shared** (`lib/tasks.ts`, isomorphic): checked in the browser before any call (AC-001.4) and again in the action (defence; an invalid title returns `invalid` without calling the API). Length counts Unicode code points (`[...title].length`) to match the API's Python `len()`. The title is sent exactly as entered, never trimmed.
- **Due dates are rendered as the string the API returned.** No `Date` parsing, so no timezone shift (AC-001.1). An empty date input is sent as `null` (AC-001.3).
- **No retries, no `router.refresh()`.** A created task is appended to client state from the 201 body (AC-001.3).

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `lib/tasks.ts` | `Task` type, `isValidTitle`, the five user texts as constants | new |
| `lib/task-api.ts` | server-only `listTasks()` / `createTask()` against `TASK_API_URL` | new |
| `app/actions.ts` | `"use server"` `createTaskAction` | new |
| `app/_components/task-board.tsx` | `"use client"` list + create form, client state | new |
| `app/page.tsx` | async Server Component: loads tasks, renders `TaskBoard` | changed (starter page replaced) |
| `app/_components/feature-card.tsx`, `app/_components/icons.tsx` | starter-only | removed |
| `docs/env-vars.md` | documents `TASK_API_URL` | changed |

## Contract

### Upstream (binding, from the system plan)

`GET {TASK_API_URL}/tasks` → 200 `Task[]`; `POST {TASK_API_URL}/tasks` body `{"title": string, "due_date": "YYYY-MM-DD" | null}` → 201 `Task`. `Task = {"id": string (non-empty), "title": string, "due_date": string | null}`. Headers on POST: `Content-Type: application/json`. Anything else (other status, non-JSON or wrong-shape body, network error, timeout after 5 s, `TASK_API_URL` unset) is a failure. No retries.

### `lib/tasks.ts`

```ts
export type Task = { id: string; title: string; due_date: string | null };
export type NewTask = { title: string; due_date: string | null };
export function isValidTitle(title: string): boolean; // [...title].length in 1..200 && title.trim() !== ""
export const TEXT = {
  empty: "No tasks yet",
  noDueDate: "No due date",
  invalidTitle: "Title must be 1 to 200 characters",
  loadFailed: "Tasks could not be loaded. Try again later.",
  saveFailed: "Task could not be saved. Try again.",
} as const;
```

### `lib/task-api.ts` (server only)

```ts
export type ListResult = { ok: true; tasks: Task[] } | { ok: false };
export type CreateResult = { ok: true; task: Task } | { ok: false };
export async function listTasks(): Promise<ListResult>;           // ok only on 200 + Task[] body
export async function createTask(input: NewTask): Promise<CreateResult>; // ok only on 201 + Task body (422, 503, any other -> ok:false)
```

- Reads `process.env.TASK_API_URL` at call time; trailing `/` tolerated.
- Each failure logs once: `logger.warn("task api call failed", { op: "list" | "create", status?: number, error_kind: "http_status" | "bad_body" | "timeout" | "network" | "config" })`. Never the title or `detail`.

### `app/actions.ts`

```ts
"use server";
export type CreateTaskActionResult = { ok: true; task: Task } | { ok: false; error: "invalid" | "save_failed" };
export async function createTaskAction(input: { title: string; due_date: string }): Promise<CreateTaskActionResult>;
// due_date "" -> null; !isValidTitle -> {ok:false, error:"invalid"} without a call; createTask fails -> "save_failed"
```

### Page DOM (what acceptance tests select on)

`app/page.tsx` default export is `async function HomePage()`; Vitest renders it with `render(await HomePage())`, with `global.fetch` stubbed and `process.env.TASK_API_URL` set. `TaskBoard` props: `{ initialTasks: Task[]; loadFailed: boolean }`.

| Element | Markup |
|---|---|
| page heading | the only `<h1>`: "Tasks" |
| task list | `<ul aria-label="Tasks">`, one `<li>` per task in API order; inside: `<span className="task-title">{title}</span>` and `<span className="task-due">{due_date ?? "No due date"}</span>` (AC-001.1) |
| empty state | `<p>No tasks yet</p>` in place of the list when there are no tasks and loading succeeded (AC-001.2) |
| load error | `<p role="alert">Tasks could not be loaded. Try again later.</p>` in place of the list and the empty text (AC-001.5) |
| form | `<form aria-label="Create task" noValidate>`, always rendered (AC-001.2, AC-001.5) |
| title field | `<input type="text">` labelled "Title"; no `required`, no `maxLength` (so a 201-character title can be entered and rejected by our check) |
| due date field | `<input type="date">` labelled "Due date"; no `min` (past dates allowed) |
| submit | `<button type="submit">` "Add task"; disabled while a submit is pending |
| form error | `<p role="alert">` inside the form: "Title must be 1 to 200 characters" (AC-001.4) or "Task could not be saved. Try again." (AC-001.6); cleared on the next submit |

Behaviour: invalid title → form error, values kept, no action call (so no `POST /tasks`). Action `ok` → task appended to the end of the list (the list replaces "No tasks yet"), both fields cleared, no error. Action `save_failed` or `invalid` or the action throwing → "Task could not be saved. Try again." (for `invalid` the title message), values kept, list unchanged. After a load failure a successful create clears the form but the load error stays (the full list is unknown).

## Testing notes

- Acceptance tests are Vitest tests in `tests/` that stub `fetch` at the upstream boundary; the action runs in-process under Vitest, so one stub covers both `GET` and `POST` and the sent body can be asserted. Timeout cases can use fake timers or a fetch stub that rejects with `DOMException("TimeoutError")`.
- `tests/page.test.tsx` and `e2e/home.spec.ts` test the starter page and are rewritten by t3; the local e2e run has no Task API, so `/` shows the load error there, which is still a valid page with its `<h1>`.
- Smoke: keep the read-only `@smoke` check that `/` loads (h1 "Tasks" and the form visible); add a `@smoke @writes` test that creates `smoke-<uuid>` through the form and sees it in the list.
