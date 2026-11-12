import { listTasks } from "@/lib/task-api";
import { TaskBoard } from "./_components/task-board";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await listTasks();
  return (
    <section className="section">
      <h1>Tasks</h1>
      <TaskBoard initialTasks={result.ok ? result.tasks : []} loadFailed={!result.ok} />
    </section>
  );
}
