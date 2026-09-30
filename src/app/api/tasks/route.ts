import { fail, ok } from "@/lib/http";
import { createTask, listTasks } from "@/lib/store";
import type { Task } from "@/lib/types";
import { validateTaskCreate } from "@/lib/validation";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["all", "active", "completed"]);
const PRIORITIES = new Set(["all", "low", "medium", "high"]);

function matchesFilters(
  task: Task,
  search: string,
  status: string,
  priority: string
): boolean {
  if (status === "active" && task.completed) return false;
  if (status === "completed" && !task.completed) return false;
  if (priority !== "all" && task.priority !== priority) return false;
  if (search) {
    const needle = search.toLowerCase();
    const haystack = `${task.title} ${task.description}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status") ?? "all";
    const priority = searchParams.get("priority") ?? "all";

    if (!STATUSES.has(status)) {
      return fail("status must be one of: all, active, completed.", 400);
    }
    if (!PRIORITIES.has(priority)) {
      return fail("priority must be one of: all, low, medium, high.", 400);
    }

    const tasks = (await listTasks()).filter((task) =>
      matchesFilters(task, search, status, priority)
    );
    return ok({ tasks, count: tasks.length });
  } catch (error) {
    return fail("Failed to list tasks.", 500, [String(error)]);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const result = validateTaskCreate(body);
  if (!result.ok) {
    return fail("Task validation failed.", 400, result.errors);
  }

  try {
    const task = await createTask(result.value);
    return ok({ task }, 201);
  } catch (error) {
    return fail("Failed to create task.", 500, [String(error)]);
  }
}
