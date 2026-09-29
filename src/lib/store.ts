import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Note, Priority, Stats, Task } from "./types";
import type {
  NoteCreateInput,
  NoteUpdateInput,
  TaskCreateInput,
  TaskUpdateInput,
} from "./validation";

interface DbShape {
  tasks: Task[];
  notes: Note[];
}

const DB_FILE = "db.json";

/**
 * JSON-file-backed store for tasks and notes.
 *
 * Every read goes to disk (the file is tiny) and every write is serialized
 * through a promise queue, so concurrent requests never clobber each other.
 * Routes must talk to the store instead of touching the filesystem directly.
 */

function resolveDataDir(): string {
  const candidates = [
    process.env.DATA_DIR,
    path.join(process.cwd(), "data"),
  ].filter((dir): dir is string => typeof dir === "string" && dir.length > 0);

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // Read-only filesystem (e.g. serverless) — fall through to the next candidate.
    }
  }
  // Last resort: the OS temp directory is always writable.
  return path.join(os.tmpdir(), "hng-todo-data");
}

let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => T): Promise<T> {
  const run = writeQueue.then(operation, operation);
  writeQueue = run.catch(() => undefined);
  return run;
}

function dbFilePath(): string {
  return path.join(resolveDataDir(), DB_FILE);
}

function seedDb(): DbShape {
  const now = new Date().toISOString();
  const inDays = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  return {
    tasks: [
      {
        id: randomUUID(),
        title: "Explore the app",
        description:
          "Create a task, tick it off, edit it and delete it to see how everything behaves.",
        priority: "medium",
        dueDate: inDays(3),
        completed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        title: "Deploy this app",
        description:
          "Push to GitHub, connect the repo to Vercel, then submit the live URL on Zedu.",
        priority: "high",
        dueDate: inDays(1),
        completed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        title: "Set up AGENTS.md",
        description: "AI agent rules for this repository — already done.",
        priority: "low",
        dueDate: null,
        completed: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    notes: [
      {
        id: randomUUID(),
        title: "Welcome to Notes",
        content:
          "Notes are for anything that does not belong to a single task — ideas, links, checklists.",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        title: "Stage 1 checklist",
        content:
          "Join team · AGENTS.md created · tests for every endpoint · push to GitHub · deploy to Vercel · submit live URL.",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

// Production seeds demo content on first run; the test suite opts out.
let seedOnEmpty = true;

function readDb(): DbShape {
  const file = dbFilePath();
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    // Missing or corrupt file — start from a fresh database.
    const seeded = seedOnEmpty ? seedDb() : { tasks: [], notes: [] };
    try {
      fs.writeFileSync(file, JSON.stringify(seeded, null, 2), "utf8");
    } catch {
      // Read-only filesystem: serve the seed without persisting.
    }
    return seeded;
  }
}

function writeDb(db: DbShape): void {
  fs.writeFileSync(dbFilePath(), JSON.stringify(db, null, 2), "utf8");
}

let lastTimestamp = "";

/** Monotonic ISO timestamp — never repeats, so createdAt/updatedAt ordering is stable. */
function timestamp(): string {
  let now = new Date().toISOString();
  if (now <= lastTimestamp) {
    now = new Date(Date.parse(lastTimestamp) + 1).toISOString();
  }
  lastTimestamp = now;
  return now;
}

function byNewestFirst(a: { createdAt: string }, b: { createdAt: string }): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function snapshot<T extends { id: string }>(item: T): T {
  return { ...item };
}

// ---------- Tasks ----------

export function listTasks(): Task[] {
  return readDb()
    .tasks.slice()
    .sort(byNewestFirst)
    .map(snapshot);
}

export function getTask(id: string): Task | null {
  const task = readDb().tasks.find((task) => task.id === id);
  return task ? snapshot(task) : null;
}

export async function createTask(input: TaskCreateInput): Promise<Task> {
  return enqueue((): Task => {
    const db = readDb();
    const now = timestamp();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueDate: input.dueDate,
      completed: input.completed,
      createdAt: now,
      updatedAt: now,
    };
    db.tasks.push(task);
    writeDb(db);
    return snapshot(task);
  });
}

export async function updateTask(
  id: string,
  patch: TaskUpdateInput
): Promise<Task | null> {
  return enqueue((): Task | null => {
    const db = readDb();
    const task = db.tasks.find((task) => task.id === id);
    if (!task) return null;
    Object.assign(task, patch, { updatedAt: timestamp() });
    writeDb(db);
    return snapshot(task);
  });
}

export async function deleteTask(id: string): Promise<Task | null> {
  return enqueue((): Task | null => {
    const db = readDb();
    const index = db.tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;
    const [removed] = db.tasks.splice(index, 1);
    writeDb(db);
    return snapshot(removed);
  });
}

// ---------- Notes ----------

export function listNotes(): Note[] {
  return readDb()
    .notes.slice()
    .sort(byNewestFirst)
    .map(snapshot);
}

export function getNote(id: string): Note | null {
  const note = readDb().notes.find((note) => note.id === id);
  return note ? snapshot(note) : null;
}

export async function createNote(input: NoteCreateInput): Promise<Note> {
  return enqueue((): Note => {
    const db = readDb();
    const now = timestamp();
    const note: Note = {
      id: randomUUID(),
      title: input.title,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    };
    db.notes.push(note);
    writeDb(db);
    return snapshot(note);
  });
}

export async function updateNote(
  id: string,
  patch: NoteUpdateInput
): Promise<Note | null> {
  return enqueue((): Note | null => {
    const db = readDb();
    const note = db.notes.find((note) => note.id === id);
    if (!note) return null;
    Object.assign(note, patch, { updatedAt: timestamp() });
    writeDb(db);
    return snapshot(note);
  });
}

export async function deleteNote(id: string): Promise<Note | null> {
  return enqueue((): Note | null => {
    const db = readDb();
    const index = db.notes.findIndex((note) => note.id === id);
    if (index === -1) return null;
    const [removed] = db.notes.splice(index, 1);
    writeDb(db);
    return snapshot(removed);
  });
}

// ---------- Stats ----------

export function getStats(): Stats {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const completed = db.tasks.filter((task) => task.completed).length;
  const overdue = db.tasks.filter(
    (task) => !task.completed && task.dueDate !== null && task.dueDate < today
  ).length;

  return {
    totalTasks: db.tasks.length,
    activeTasks: db.tasks.length - completed,
    completedTasks: completed,
    overdueTasks: overdue,
    completionRate:
      db.tasks.length === 0
        ? 0
        : Math.round((completed / db.tasks.length) * 100),
    totalNotes: db.notes.length,
  };
}

// ---------- Test support ----------

/** Wipes the database file and disables seeding. Only for the test suite. */
export async function resetForTests(): Promise<void> {
  seedOnEmpty = false;
  return enqueue(() => {
    try {
      fs.rmSync(dbFilePath(), { force: true });
    } catch {
      // Nothing to reset.
    }
  });
}

export type { Priority };
