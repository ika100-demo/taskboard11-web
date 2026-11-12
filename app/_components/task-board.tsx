"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { createTaskAction } from "@/app/actions";
import { TEXT, isValidTitle } from "@/lib/tasks";
import type { Task } from "@/lib/tasks";

export type TaskBoardProps = { initialTasks: Task[]; loadFailed: boolean };

export function TaskBoard({ initialTasks, loadFailed }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isValidTitle(title)) {
      setError(TEXT.invalidTitle);
      return;
    }
    startTransition(async () => {
      try {
        const result = await createTaskAction({ title, due_date: dueDate });
        if (result.ok) {
          setTasks((current) => [...current, result.task]);
          setTitle("");
          setDueDate("");
        } else {
          setError(result.error === "invalid" ? TEXT.invalidTitle : TEXT.saveFailed);
        }
      } catch {
        setError(TEXT.saveFailed);
      }
    });
  }

  return (
    <div className="task-board">
      {loadFailed ? (
        <p role="alert" className="task-alert">
          {TEXT.loadFailed}
        </p>
      ) : tasks.length === 0 ? (
        <p className="task-empty">{TEXT.empty}</p>
      ) : (
        <ul aria-label="Tasks" className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className="task-item">
              <span className="task-title">{task.title}</span>
              <span className="task-due">{task.due_date ?? TEXT.noDueDate}</span>
            </li>
          ))}
        </ul>
      )}
      <form aria-label="Create task" noValidate onSubmit={onSubmit} className="task-form">
        <div className="task-field">
          <label htmlFor="task-title">Title</label>
          <input id="task-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="task-field">
          <label htmlFor="task-due">Due date</label>
          <input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Add task
        </button>
        {error ? (
          <p role="alert" className="task-alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
