import { fail, ok } from "@/lib/http";
import { createNote, listNotes } from "@/lib/store";
import { validateNoteCreate } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const notes = (await listNotes()).filter((note) => {
      if (!search) return true;
      return `${note.title} ${note.content}`.toLowerCase().includes(search);
    });
    return ok({ notes, count: notes.length });
  } catch (error) {
    return fail("Failed to list notes.", 500, [String(error)]);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const result = validateNoteCreate(body);
  if (!result.ok) {
    return fail("Note validation failed.", 400, result.errors);
  }

  try {
    const note = await createNote(result.value);
    return ok({ note }, 201);
  } catch (error) {
    return fail("Failed to create note.", 500, [String(error)]);
  }
}
