import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Task = { id: string; title: string; due_date: string | null };

const A: Task = { id: "a", title: "Task A", due_date: "2026-01-02" };
const B: Task = { id: "b", title: "Task B", due_date: null };
const C: Task = { id: "c", title: "Task C", due_date: "2025-12-31" };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Handler = (url: string, init?: RequestInit) => Promise<Response> | Response;
let fetchMock: ReturnType<typeof vi.fn>;

function stubApi(handler: Handler) {
  fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal("fetch", fetchMock);
}

const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST");

async function openPage() {
  const { default: HomePage } = await import("@/app/page");
  render(await HomePage());
}

const form = () => screen.getByRole("form", { name: "Create task" });
const titleField = () => within(form()).getByLabelText("Title") as HTMLInputElement;
const dueField = () => within(form()).getByLabelText("Due date") as HTMLInputElement;
const submit = () => fireEvent.click(within(form()).getByRole("button", { name: "Add task" }));
const fill = (title: string, due = "") => {
  fireEvent.change(titleField(), { target: { value: title } });
  fireEvent.change(dueField(), { target: { value: due } });
};
const items = () => within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");

beforeEach(() => {
  process.env.TASK_API_URL = "http://task-api.test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HomePage task list", () => {
  it("AC-001.1 lists tasks in API order with title and due date or No due date", async () => {
    stubApi(() => json(200, [A, B, C]));
    await openPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    const li = items();
    expect(li.map((x) => x.textContent)).toEqual([
      expect.stringContaining("Task A"),
      expect.stringContaining("Task B"),
      expect.stringContaining("Task C"),
    ]);
    expect(li[0]).toHaveTextContent("2026-01-02");
    expect(li[1]).toHaveTextContent("No due date");
    expect(li[2]).toHaveTextContent("2025-12-31");
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://task-api.test/tasks");
  });

  it("AC-001.2 shows No tasks yet and the create form when the list is empty", async () => {
    stubApi(() => json(200, []));
    await openPage();
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    expect(titleField()).toHaveAttribute("type", "text");
    expect(dueField()).toHaveAttribute("type", "date");
    expect(within(form()).getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });
});

describe("HomePage create form", () => {
  it("AC-001.3 posts title and due date and appends the new task without reload", async () => {
    const created: Task = { id: "n1", title: "Buy milk", due_date: "2026-12-01" };
    stubApi((_url, init) => (init?.method === "POST" ? json(201, created) : json(200, [A])));
    await openPage();
    fill("Buy milk", "2026-12-01");
    submit();
    await waitFor(() => expect(items()).toHaveLength(2));
    expect(items()[0]).toHaveTextContent("Task A");
    expect(items()[1]).toHaveTextContent("Buy milk");
    expect(items()[1]).toHaveTextContent("2026-12-01");
    expect(posts()).toHaveLength(1);
    const [url, init] = posts()[0] as [unknown, RequestInit];
    expect(String(url)).toBe("http://task-api.test/tasks");
    expect(JSON.parse(String(init.body))).toEqual({ title: "Buy milk", due_date: "2026-12-01" });
    await waitFor(() => expect(titleField().value).toBe(""));
    expect(dueField().value).toBe("");
  });

  it("AC-001.3 posts due_date null when the due date is empty and shows No due date", async () => {
    const created: Task = { id: "n2", title: "Buy milk", due_date: null };
    stubApi((_url, init) => (init?.method === "POST" ? json(201, created) : json(200, [])));
    await openPage();
    fill("Buy milk");
    submit();
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(items()[0]).toHaveTextContent("Buy milk");
    expect(items()[0]).toHaveTextContent("No due date");
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
    const [, init] = posts()[0] as [unknown, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ title: "Buy milk", due_date: null });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["longer than 200 characters", "x".repeat(201)],
  ])("AC-001.4 rejects a title that is %s without sending POST", async (_name, title) => {
    stubApi(() => json(200, [A]));
    await openPage();
    fill(title, "2026-05-05");
    submit();
    expect(await screen.findByText("Title must be 1 to 200 characters")).toBeInTheDocument();
    expect(titleField().value).toBe(title);
    expect(dueField().value).toBe("2026-05-05");
    expect(posts()).toHaveLength(0);
    expect(items()).toHaveLength(1);
  });

  it("AC-001.4 accepts a title of exactly 200 characters", async () => {
    const title = "y".repeat(200);
    stubApi((_url, init) => (init?.method === "POST" ? json(201, { id: "n", title, due_date: null }) : json(200, [])));
    await openPage();
    fill(title);
    submit();
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(screen.queryByText("Title must be 1 to 200 characters")).not.toBeInTheDocument();
  });

  it.each([
    ["422", () => json(422, { detail: "bad" })],
    ["503", () => json(503, {})],
    ["200 instead of 201", () => json(200, { id: "x", title: "Buy milk", due_date: null })],
    ["network error", () => Promise.reject(new TypeError("fetch failed"))],
    ["timeout", () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
  ])("AC-001.6 shows the save error and keeps values when POST fails with %s", async (_name, onPost) => {
    stubApi((_url, init) => (init?.method === "POST" ? (onPost() as Promise<Response>) : json(200, [A])));
    await openPage();
    fill("Buy milk", "2026-12-01");
    submit();
    expect(await screen.findByText("Task could not be saved. Try again.")).toBeInTheDocument();
    expect(titleField().value).toBe("Buy milk");
    expect(dueField().value).toBe("2026-12-01");
    expect(items()).toHaveLength(1);
    expect(items()[0]).toHaveTextContent("Task A");
  });
});

describe("HomePage when the Task API is down", () => {
  it.each([
    ["status 500", () => json(500, {})],
    ["status 404", () => json(404, {})],
    ["network error", () => Promise.reject(new TypeError("fetch failed"))],
    ["timeout", () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
  ])("AC-001.5 shows the load error and still the form on %s", async (_name, onGet) => {
    stubApi(() => onGet() as Promise<Response>);
    await openPage();
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByText("Tasks could not be loaded. Try again later.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
    expect(titleField()).toBeInTheDocument();
    expect(dueField()).toBeInTheDocument();
  });

  it("AC-001.5 shows the load error when TASK_API_URL is unset", async () => {
    delete process.env.TASK_API_URL;
    stubApi(() => json(200, [A]));
    await openPage();
    expect(screen.getByText("Tasks could not be loaded. Try again later.")).toBeInTheDocument();
    expect(form()).toBeInTheDocument();
  });
});
