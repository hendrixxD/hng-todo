import { fail, ok } from "@/lib/http";
import { deleteTask, getTask, updateTask } from "@/lib/store";
import { validateTaskUpdate } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const task = await getTask(id);
    if (!task) {
      return fail("Task not found.", 404);
    }
    return ok({ task });
  } catch (error) {
    return fail("Failed to load task.", 500, [String(error)]);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const result = validateTaskUpdate(body);
  if (!result.ok) {
    return fail("Task validation failed.", 400, result.errors);
  }

  try {
    const task = await updateTask(id, result.value);
    if (!task) {
      return fail("Task not found.", 404);
    }
    return ok({ task });
  } catch (error) {
    return fail("Failed to update task.", 500, [String(error)]);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const task = await deleteTask(id);
    if (!task) {
      return fail("Task not found.", 404);
    }
    return ok({ task });
  } catch (error) {
    return fail("Failed to delete task.", 500, [String(error)]);
  }
}
