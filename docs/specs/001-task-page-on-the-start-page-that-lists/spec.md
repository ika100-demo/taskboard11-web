---
spec_id: 001-task-page-on-the-start-page-that-lists
title: Task page on the start page that lists tasks and creates them through the Task API
status: approved
priority: P1
shape: web-nextjs
parent: ika100-demo/taskboard11-gitops:001-persistent-tasks-with-web-ui
---

# 001 — Task page on the start page that lists tasks and creates them through the Task API

## Problem

The Task API keeps tasks in memory, so every restart or redeploy of the API loses every task, and the API is the only way to see or record one. People who are not API clients cannot use the taskboard at all, and the web component shows only a starter page. Storing tasks in a Postgres database makes them survive restarts, and a task page in the web UI lets people list and create tasks without calling the API by hand.

## System context

Slice of the system plan `001-persistent-tasks-with-web-ui` in `ika100-demo/taskboard11-gitops` for `taskboard11-web` (web-nextjs). The system criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(system AC-<NNN>.<n>)`.

### System criteria

- **AC-001.3** Given tasks A, B and C were created in that order (through the API or the web UI), when a user opens the task page of the web UI, then the page lists the three tasks, A before B before C, each with its title and its due date as `YYYY-MM-DD`, or "No due date" for a task without one.
- **AC-001.4** Given no task exists, when a user opens the task page, then the page shows "No tasks yet" and the create form.
- **AC-001.5** Given the task page is open, when a user enters the title "Buy milk" and the due date 2026-12-01 (or leaves the due date empty) and submits the form, then "Buy milk" with that due date (or "No due date") appears at the end of the list without a manual page reload, the form is cleared, and `GET /tasks` contains the task.
- **AC-001.6** Given the task page is open, when a user submits the form with an empty or whitespace-only title, or a title longer than 200 characters, then the page shows "Title must be 1 to 200 characters", keeps the entered values, and no task is created.
- **AC-001.7** Given the Task API cannot be reached or answers with an error, when a user opens the task page, then the page shows "Tasks could not be loaded. Try again later." instead of the list; and when a user submits the form in that state, then the page shows "Task could not be saved. Try again." and keeps the entered values.

### Contract

The Task API keeps the format of its spec `001-create-and-list-tasks-in-memory` unchanged; this spec adds only 503 and the readiness behaviour. Base URL for the web UI: `TASK_API_URL` (dev: `http://taskboard11-api`), called from the web server only. JSON, UTF-8, `Content-Type: application/json`.

**Task object**

| Field | Type | Notes |
|---|---|---|
| `id` | string | server-assigned, opaque, non-empty; never sent by the client (ignored if sent) |
| `title` | string | 1 to 200 characters, at least one non-whitespace character, stored and returned exactly as sent |
| `due_date` | string or null | calendar date `YYYY-MM-DD`; past dates allowed; `null` when there is none |

**`POST /tasks`** — create a task. Request body `{"title": "<title>", "due_date": "YYYY-MM-DD" | null}` (`due_date` may be omitted, which equals `null`).

| Status | Body | Meaning |
|---|---|---|
| 201 | the Task object | created and stored in the database |
| 422 | FastAPI validation body `{"detail": [...]}` | title or due date invalid; nothing created |
| 503 | `{"detail": "database unavailable"}` | database unreachable; nothing created, the task never appears later |

**`GET /tasks`** — list all tasks, oldest first (creation order), no paging.

| Status | Body | Meaning |
|---|---|---|
| 200 | JSON array of Task objects (`[]` when none) | |
| 503 | `{"detail": "database unavailable"}` | database unreachable |

**Probes** (platform, not the web UI): `GET /health` 200 `{"status": "ok"}` while the process runs, independent of the database; `GET /ready` 200 `{"status": "ready"}` when the database answers, else 503 `{"status": "unavailable"}`.

**Web UI to user** (inside the web repo, listed for completeness): the task page is `/`; texts exactly "No tasks yet", "No due date", "Title must be 1 to 200 characters", "Tasks could not be loaded. Try again later.", "Task could not be saved. Try again."

### Errors

- Error bodies of the Task API are JSON with a `detail` field: a string for 503, the FastAPI validation list for 422. The web UI never shows `detail` to the user; it maps outcomes to its fixed texts.
- The web UI treats any response the contract does not list for a call (other 4xx, 5xx, a 200 to `POST`, a 201 to `GET`, a body that is not the expected JSON shape), a connection error and a timeout the same as 503: on `GET /tasks` it shows "Tasks could not be loaded. Try again later."; on `POST /tasks` it shows "Task could not be saved. Try again." and keeps the entered values. A 422 on `POST` (which the client-side check should prevent) is also shown as "Task could not be saved. Try again."
- The web UI logs each failed call once (`@/lib/logger`, with status or error kind, never the task title), and does not retry automatically.

### Timeouts

- Web server to Task API, `GET /tasks` and `POST /tasks`: 5 seconds total per call; on expiry the call is aborted and handled as an error above. No retries.
- Task API to Postgres: connect timeout 3 seconds, statement timeout 3 seconds, so a task endpoint answers 503 within 5 seconds when the database is down or hangs; the readiness check uses the same bound and answers within 5 seconds.
- Database down at API start: the API starts anyway (liveness 200, readiness 503) and reconnects on the next request or readiness check; once the database is back `/ready` turns 200 within 10 seconds without a restart.
- Task API down or not ready: Kubernetes removes it from the Service, so the web UI gets a connection error or timeout and shows its error texts; the web UI's own readiness does not depend on the Task API.

### Provided by the system

The gitops part of this plan wires these for this repo; rely on them, do not ask for them again:

- env `TASK_API_URL=http://taskboard11-api`

### Notes for this repo

The task page replaces the starter page at `/`. The web server calls the Task API (server components and a
server action or a same-origin route handler); the browser never calls the Task API directly, so there is no
CORS and TASK_API_URL stays server-only (never NEXT_PUBLIC_*). Read TASK_API_URL at request time and render
the list dynamically (no static caching of GET /tasks). Document TASK_API_URL in docs/env-vars.md.
The smoke test that creates a task is tagged @smoke @writes (dev only); keep a read-only @smoke check that `/` loads.

## Stories

<!-- As a <persona>, I want <goal>, so that <benefit>. -->

## Acceptance criteria

- **AC-001.1** Given the Task API's `GET /tasks` returns tasks A, B and C in that order, when a user opens `/`, then the page lists A before B before C, each with its `title` and its `due_date` as `YYYY-MM-DD`, or "No due date" when `due_date` is null (system AC-001.3)
- **AC-001.2** Given `GET /tasks` returns `[]`, when a user opens `/`, then the page shows "No tasks yet" and the create form with a title field, a due date field (calendar date, may be empty or in the past) and a submit button (system AC-001.4)
- **AC-001.3** Given the page is open, when a user enters the title "Buy milk" and the due date 2026-12-01 (or leaves the due date empty) and submits, then `POST /tasks` is sent with `{"title": "Buy milk", "due_date": "2026-12-01"}` (or `"due_date": null`), and on 201 "Buy milk" with 2026-12-01 (or "No due date") appears at the end of the list without a page reload and the form is cleared (system AC-001.5)
- **AC-001.4** Given the page is open, when a user submits a title that is empty, only whitespace, or longer than 200 characters, then the page shows "Title must be 1 to 200 characters", keeps the entered title and due date, and no `POST /tasks` is sent (system AC-001.6)
- **AC-001.5** Given the Task API is unreachable, does not answer within 5 seconds, or answers `GET /tasks` with any status other than 200, when a user opens `/`, then the page shows "Tasks could not be loaded. Try again later." instead of the list, and the create form is still shown (system AC-001.7)
- **AC-001.6** Given the Task API is unreachable, does not answer within 5 seconds, or answers `POST /tasks` with any status other than 201 (including 422 and 503), when a user submits a valid form, then the page shows "Task could not be saved. Try again.", keeps the entered title and due date, and the list is unchanged (system AC-001.7)

## Non-goals

## Assumptions

<!-- Spec 149: decisions taken by default, approved with the spec. One bullet each: - **A1** <the decision> (other option: <…>; affects AC-…). A revised one is struck through (~~…~~), never deleted. -->

## Open questions

<!-- Only what may not be decided by default (spec 149): security or access, money, destroying or migrating data, or a request too ambiguous to build. Approval is refused while any is open. Strike answered ones (~~…~~) and fold the answer into the criteria. -->

## Changelog

- 2026-11-12 created from the system plan, with its criteria (spec 147)
- 2026-11-12 approved
