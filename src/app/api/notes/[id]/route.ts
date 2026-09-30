import { fail, ok } from "@/lib/http";
import { deleteNote, getNote, updateNote } from "@/lib/store";
import { validateNoteUpdate } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const note = await getNote(id);
    if (!note) {
      return fail("Note not found.", 404);
    }
    return ok({ note });
  } catch (error) {
    return fail("Failed to load note.", 500, [String(error)]);
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

  const result = validateNoteUpdate(body);
  if (!result.ok) {
    return fail("Note validation failed.", 400, result.errors);
  }

  try {
    const note = await updateNote(id, result.value);
    if (!note) {
      return fail("Note not found.", 404);
    }
    return ok({ note });
  } catch (error) {
    return fail("Failed to update note.", 500, [String(error)]);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const note = await deleteNote(id);
    if (!note) {
      return fail("Note not found.", 404);
    }
    return ok({ note });
  } catch (error) {
    return fail("Failed to delete note.", 500, [String(error)]);
  }
}
