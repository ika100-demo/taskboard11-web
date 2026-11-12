export type Task = { id: string; title: string; due_date: string | null };
export type NewTask = { title: string; due_date: string | null };

/** 1 to 200 characters (code points) and not only whitespace. */
export function isValidTitle(title: string): boolean {
  const length = [...title].length;
  return length >= 1 && length <= 200 && title.trim() !== "";
}

export const TEXT = {
  empty: "No tasks yet",
  noDueDate: "No due date",
  invalidTitle: "Title must be 1 to 200 characters",
  loadFailed: "Tasks could not be loaded. Try again later.",
  saveFailed: "Task could not be saved. Try again.",
} as const;
