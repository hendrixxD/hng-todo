import { beforeEach, describe, expect, it } from "vitest";

import { GET as getHealth } from "@/app/api/health/route";
import {
  DELETE as deleteNoteById,
  GET as getNoteById,
  PATCH as patchNoteById,
} from "@/app/api/notes/[id]/route";
import { GET as listNotesRoute, POST as createNoteRoute } from "@/app/api/notes/route";
import { GET as getStatsRoute } from "@/app/api/stats/route";
import {
  DELETE as deleteTaskById,
  GET as getTaskById,
  PATCH as patchTaskById,
} from "@/app/api/tasks/[id]/route";
import { GET as listTasksRoute, POST as createTaskRoute } from "@/app/api/tasks/route";
import { resetForTests } from "@/lib/store";
import type { Note, Stats, Task } from "@/lib/types";

type Payload = Record<string, unknown>;

const routeCtx = (id: string) => ({ params: Promise.resolve({ id }) });

function request(url: string, method = "GET", bodyData?: unknown): Request {
  return new Request(url, {
    method,
    ...(bodyData === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyData),
        }),
  });
}

function listUrl(base: string, query?: Record<string, string>): string {
  const search = query ? `?${new URLSearchParams(query).toString()}` : "";
  return `http://localhost${base}${search}`;
}

async function payload(response: Response): Promise<Payload> {
  return (await response.json()) as Payload;
}

function unwrapTask(bodyData: Payload): Task {
  return (bodyData.data as { task: Task }).task;
}

function unwrapNote(bodyData: Payload): Note {
  return (bodyData.data as { note: Note }).note;
}

async function makeTask(input: Record<string, unknown>): Promise<Task> {
  const response = await createTaskRoute(
    request("http://localhost/api/tasks", "POST", input)
  );
  expect(response.status).toBe(201);
  return unwrapTask(await payload(response));
}

async function makeNote(input: Record<string, unknown>): Promise<Note> {
  const response = await createNoteRoute(
    request("http://localhost/api/notes", "POST", input)
  );
  expect(response.status).toBe(201);
  return unwrapNote(await payload(response));
}

beforeEach(async () => {
  await resetForTests();
});

describe("GET /api/health", () => {
  it("responds 200 with an ok status", async () => {
    const response = await getHealth();
    expect(response.status).toBe(200);
    const bodyData = await payload(response);
    expect((bodyData.data as { status: string }).status).toBe("ok");
  });
});

describe("POST /api/tasks", () => {
  it("creates a task and applies defaults", async () => {
    const response = await createTaskRoute(
      request("http://localhost/api/tasks", "POST", { title: "Buy milk" })
    );
    expect(response.status).toBe(201);
    const task = unwrapTask(await payload(response));
    expect(task.title).toBe("Buy milk");
    expect(task.description).toBe("");
    expect(task.priority).toBe("medium");
    expect(task.dueDate).toBeNull();
    expect(task.completed).toBe(false);
    expect(task.id).toBeTruthy();
    expect(task.createdAt).toBeTruthy();
  });

  it("creates a task with every field supplied", async () => {
    const task = await makeTask({
      title: "Submit Stage 1",
      description: "Live URL on Zedu",
      priority: "high",
      dueDate: "2030-01-31",
      completed: true,
    });
    expect(task.description).toBe("Live URL on Zedu");
    expect(task.priority).toBe("high");
    expect(task.dueDate).toBe("2030-01-31");
    expect(task.completed).toBe(true);
  });

  it("rejects a missing or blank title", async () => {
    const missing = await createTaskRoute(
      request("http://localhost/api/tasks", "POST", {})
    );
    expect(missing.status).toBe(400);

    const blank = await createTaskRoute(
      request("http://localhost/api/tasks", "POST", { title: "   " })
    );
    expect(blank.status).toBe(400);

    const bodyData = await payload(blank);
    expect(typeof bodyData.error).toBe("string");
  });

  it("rejects an invalid priority", async () => {
    const response = await createTaskRoute(
      request("http://localhost/api/tasks", "POST", { title: "X", priority: "urgent" })
    );
    expect(response.status).toBe(400);
    const bodyData = await payload(response);
    expect(Array.isArray(bodyData.details)).toBe(true);
  });

  it("rejects an invalid due date", async () => {
    for (const dueDate of ["2020-13-01", "not-a-date", 42]) {
      const response = await createTaskRoute(
        request("http://localhost/api/tasks", "POST", { title: "X", dueDate })
      );
      expect(response.status).toBe(400);
    }
  });

  it("rejects invalid JSON bodies", async () => {
    const response = await createTaskRoute(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      })
    );
    expect(response.status).toBe(400);
  });

  it("rejects protected fields", async () => {
    const response = await createTaskRoute(
      request("http://localhost/api/tasks", "POST", { title: "X", id: "nope" })
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/tasks", () => {
  it("lists tasks newest first with a count", async () => {
    await makeTask({ title: "First" });
    await makeTask({ title: "Second" });

    const response = await listTasksRoute(request(listUrl("/api/tasks")));
    expect(response.status).toBe(200);
    const bodyData = await payload(response);
    const tasks = (bodyData.data as { tasks: Task[] }).tasks;
    expect((bodyData.data as { count: number }).count).toBe(tasks.length);
    expect(tasks.map((task) => task.title)).toEqual(["Second", "First"]);
  });

  it("filters by status", async () => {
    const done = await makeTask({ title: "Done one" });
    await makeTask({ title: "Open one" });
    const patch = await patchTaskById(
      request(`http://localhost/api/tasks/${done.id}`, "PATCH", { completed: true }),
      routeCtx(done.id)
    );
    expect(patch.status).toBe(200);

    const completedResponse = await listTasksRoute(
      request(listUrl("/api/tasks", { status: "completed" }))
    );
    const completed = (await payload(completedResponse)).data as { tasks: Task[] };
    expect(completed.tasks.map((task) => task.title)).toEqual(["Done one"]);

    const activeResponse = await listTasksRoute(
      request(listUrl("/api/tasks", { status: "active" }))
    );
    const active = (await payload(activeResponse)).data as { tasks: Task[] };
    expect(active.tasks.map((task) => task.title)).toEqual(["Open one"]);
  });

  it("filters by priority", async () => {
    await makeTask({ title: "Low", priority: "low" });
    await makeTask({ title: "High", priority: "high" });

    const response = await listTasksRoute(
      request(listUrl("/api/tasks", { priority: "high" }))
    );
    const data = (await payload(response)).data as { tasks: Task[] };
    expect(data.tasks.map((task) => task.title)).toEqual(["High"]);
  });

  it("searches title and description", async () => {
    await makeTask({ title: "Buy oat milk", description: "from the corner store" });
    await makeTask({ title: "Walk the dog" });

    const byTitle = await listTasksRoute(
      request(listUrl("/api/tasks", { search: "milk" }))
    );
    expect(((await payload(byTitle)).data as { count: number }).count).toBe(1);

    const byDescription = await listTasksRoute(
      request(listUrl("/api/tasks", { search: "CORNER" }))
    );
    expect(((await payload(byDescription)).data as { count: number }).count).toBe(1);
  });

  it("rejects invalid filter values", async () => {
    const response = await listTasksRoute(
      request(listUrl("/api/tasks", { status: "archived" }))
    );
    expect(response.status).toBe(400);
  });
});

describe("/api/tasks/[id]", () => {
  it("returns a task by id", async () => {
    const task = await makeTask({ title: "Find me" });
    const response = await getTaskById(
      request(`http://localhost/api/tasks/${task.id}`),
      routeCtx(task.id)
    );
    expect(response.status).toBe(200);
    expect(unwrapTask(await payload(response)).title).toBe("Find me");
  });

  it("responds 404 for an unknown id", async () => {
    const response = await getTaskById(
      request("http://localhost/api/tasks/does-not-exist"),
      routeCtx("does-not-exist")
    );
    expect(response.status).toBe(404);
  });

  it("updates a task via PATCH and persists the change", async () => {
    const task = await makeTask({ title: "Before", priority: "low" });
    const response = await patchTaskById(
      request(`http://localhost/api/tasks/${task.id}`, "PATCH", {
        title: "After",
        priority: "high",
        completed: true,
      }),
      routeCtx(task.id)
    );
    expect(response.status).toBe(200);
    const updated = unwrapTask(await payload(response));
    expect(updated.title).toBe("After");
    expect(updated.priority).toBe("high");
    expect(updated.completed).toBe(true);

    const refetched = await getTaskById(
      request(`http://localhost/api/tasks/${task.id}`),
      routeCtx(task.id)
    );
    expect(unwrapTask(await payload(refetched)).title).toBe("After");
  });

  it("rejects an empty PATCH body", async () => {
    const task = await makeTask({ title: "Untouched" });
    const response = await patchTaskById(
      request(`http://localhost/api/tasks/${task.id}`, "PATCH", {}),
      routeCtx(task.id)
    );
    expect(response.status).toBe(400);
  });

  it("rejects invalid PATCH values and protected fields", async () => {
    const task = await makeTask({ title: "Guarded" });

    const badTitle = await patchTaskById(
      request(`http://localhost/api/tasks/${task.id}`, "PATCH", { title: "" }),
      routeCtx(task.id)
    );
    expect(badTitle.status).toBe(400);

    const protectedField = await patchTaskById(
      request(`http://localhost/api/tasks/${task.id}`, "PATCH", { id: "nope" }),
      routeCtx(task.id)
    );
    expect(protectedField.status).toBe(400);
  });

  it("responds 404 when PATCHing an unknown id", async () => {
    const response = await patchTaskById(
      request("http://localhost/api/tasks/nope", "PATCH", { title: "X" }),
      routeCtx("nope")
    );
    expect(response.status).toBe(404);
  });

  it("deletes a task and then cannot find it", async () => {
    const task = await makeTask({ title: "Doomed" });
    const response = await deleteTaskById(
      request(`http://localhost/api/tasks/${task.id}`, "DELETE"),
      routeCtx(task.id)
    );
    expect(response.status).toBe(200);

    const refetched = await getTaskById(
      request(`http://localhost/api/tasks/${task.id}`),
      routeCtx(task.id)
    );
    expect(refetched.status).toBe(404);
  });

  it("responds 404 when DELETEing an unknown id", async () => {
    const response = await deleteTaskById(
      request("http://localhost/api/tasks/nope", "DELETE"),
      routeCtx("nope")
    );
    expect(response.status).toBe(404);
  });
});

describe("Notes API", () => {
  it("creates a note with defaults and lists it", async () => {
    const response = await createNoteRoute(
      request("http://localhost/api/notes", "POST", {
        title: "Ideas",
        content: "Build a notes feature",
      })
    );
    expect(response.status).toBe(201);
    const note = unwrapNote(await payload(response));
    expect(note.title).toBe("Ideas");
    expect(note.content).toBe("Build a notes feature");

    const list = await listNotesRoute(request(listUrl("/api/notes")));
    const data = (await payload(list)).data as { notes: Note[]; count: number };
    expect(data.count).toBe(data.notes.length);
    expect(data.notes.some((item) => item.id === note.id)).toBe(true);
  });

  it("rejects a note without content", async () => {
    const response = await createNoteRoute(
      request("http://localhost/api/notes", "POST", { title: "No body" })
    );
    expect(response.status).toBe(400);
  });

  it("searches notes", async () => {
    await makeNote({ title: "Recipes", content: "jollof rice steps" });
    await makeNote({ title: "Reading list", content: "books for October" });

    const response = await listNotesRoute(
      request(listUrl("/api/notes", { search: "jollof" }))
    );
    const data = (await payload(response)).data as { notes: Note[]; count: number };
    expect(data.count).toBe(1);
    expect(data.notes[0].title).toBe("Recipes");
  });

  it("updates and deletes a note", async () => {
    const note = await makeNote({ title: "Draft", content: "v1" });

    const patched = await patchNoteById(
      request(`http://localhost/api/notes/${note.id}`, "PATCH", {
        content: "v2 — improved",
      }),
      routeCtx(note.id)
    );
    expect(patched.status).toBe(200);
    expect(unwrapNote(await payload(patched)).content).toBe("v2 — improved");

    const deleted = await deleteNoteById(
      request(`http://localhost/api/notes/${note.id}`, "DELETE"),
      routeCtx(note.id)
    );
    expect(deleted.status).toBe(200);

    const refetched = await getNoteById(
      request(`http://localhost/api/notes/${note.id}`),
      routeCtx(note.id)
    );
    expect(refetched.status).toBe(404);
  });

  it("responds 404 for unknown note ids", async () => {
    const got = await getNoteById(
      request("http://localhost/api/notes/nope"),
      routeCtx("nope")
    );
    expect(got.status).toBe(404);

    const deleted = await deleteNoteById(
      request("http://localhost/api/notes/nope", "DELETE"),
      routeCtx("nope")
    );
    expect(deleted.status).toBe(404);
  });
});

describe("GET /api/stats", () => {
  it("counts tasks, completion and overdue correctly", async () => {
    const before = (await payload(await getStatsRoute())).data as Stats;

    await makeTask({ title: "Overdue and open", dueDate: "2020-01-01" });
    const finished = await makeTask({ title: "Overdue but done", dueDate: "2020-01-01" });
    await patchTaskById(
      request(`http://localhost/api/tasks/${finished.id}`, "PATCH", { completed: true }),
      routeCtx(finished.id)
    );
    await makeNote({ title: "A note", content: "counts too" });

    const after = (await payload(await getStatsRoute())).data as Stats;

    expect(after.totalTasks).toBe(before.totalTasks + 2);
    expect(after.completedTasks).toBe(before.completedTasks + 1);
    expect(after.activeTasks).toBe(before.activeTasks + 1);
    // The finished task's due date must not count as overdue; the open one must.
    expect(after.overdueTasks).toBe(before.overdueTasks + 1);
    expect(after.totalNotes).toBe(before.totalNotes + 1);
  });
});

describe("storage (production-like)", () => {
  it("creates and lists with DATA_DIR unset, like on Vercel", async () => {
    const original = process.env.DATA_DIR;
    delete process.env.DATA_DIR;
    try {
      const created = await createTaskRoute(
        request("http://localhost/api/tasks", "POST", { title: "Production-like create" })
      );
      expect(created.status).toBe(201);

      const list = await listTasksRoute(request("http://localhost/api/tasks"));
      const data = (await payload(list)).data as { count: number };
      expect(data.count).toBe(1);
    } finally {
      if (original === undefined) {
        delete process.env.DATA_DIR;
      } else {
        process.env.DATA_DIR = original;
      }
      await resetForTests();
    }
  });
});
