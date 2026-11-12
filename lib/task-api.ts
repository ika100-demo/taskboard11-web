// Server only: reads TASK_API_URL; never import from a client component.
import { logger } from "@/lib/logger";
import type { NewTask, Task } from "@/lib/tasks";

export type ListResult = { ok: true; tasks: Task[] } | { ok: false };
export type CreateResult = { ok: true; task: Task } | { ok: false };

type Op = "list" | "create";
type ErrorKind = "http_status" | "bad_body" | "timeout" | "network" | "config";

const TIMEOUT_MS = 5000;

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id !== "" &&
    typeof v.title === "string" &&
    (typeof v.due_date === "string" || v.due_date === null)
  );
}

function fail(op: Op, error_kind: ErrorKind, status?: number): { ok: false } {
  logger.warn("task api call failed", {
    op,
    ...(status === undefined ? {} : { status }),
    error_kind,
  });
  return { ok: false };
}

/** Calls the Task API; returns the parsed body on the expected status, else logs and returns null. */
async function call(op: Op, expected: number, init: RequestInit): Promise<{ body: unknown } | null> {
  const base = process.env.TASK_API_URL;
  if (!base) {
    fail(op, "config");
    return null;
  }
  const url = `${base.replace(/\/+$/, "")}/tasks`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    fail(op, name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
    return null;
  }
  if (response.status !== expected) {
    fail(op, "http_status", response.status);
    return null;
  }
  try {
    return { body: (await response.json()) as unknown };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    fail(op, name === "TimeoutError" || name === "AbortError" ? "timeout" : "bad_body");
    return null;
  }
}

export async function listTasks(): Promise<ListResult> {
  const result = await call("list", 200, { method: "GET" });
  if (!result) return { ok: false };
  if (!Array.isArray(result.body) || !result.body.every(isTask)) return fail("list", "bad_body");
  return { ok: true, tasks: result.body };
}

export async function createTask(input: NewTask): Promise<CreateResult> {
  const result = await call("create", 201, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: input.title, due_date: input.due_date }),
  });
  if (!result) return { ok: false };
  if (!isTask(result.body)) return fail("create", "bad_body");
  return { ok: true, task: result.body };
}
