"use server";

import { createTask } from "@/lib/task-api";
import { isValidTitle } from "@/lib/tasks";
import type { Task } from "@/lib/tasks";

export type CreateTaskActionResult =
  | { ok: true; task: Task }
  | { ok: false; error: "invalid" | "save_failed" };

export async function createTaskAction(input: {
  title: string;
  due_date: string;
}): Promise<CreateTaskActionResult> {
  const title = typeof input?.title === "string" ? input.title : "";
  const due = typeof input?.due_date === "string" ? input.due_date : "";
  if (!isValidTitle(title)) return { ok: false, error: "invalid" };
  const result = await createTask({ title, due_date: due === "" ? null : due });
  return result.ok ? { ok: true, task: result.task } : { ok: false, error: "save_failed" };
}
