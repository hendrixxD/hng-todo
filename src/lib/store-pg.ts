import { randomUUID } from "node:crypto";

import { Pool, type QueryResultRow } from "pg";

import type { Note, Stats, Task } from "./types";
import type {
  NoteCreateInput,
  NoteUpdateInput,
  TaskCreateInput,
  TaskUpdateInput,
} from "./validation";
import { buildSeed } from "./seed";

/**
 * Postgres-backed implementation of the store, used in production when
 * DATABASE_URL is set (Neon). Same exported signatures as the file store —
 * the facade in store.ts picks one.
 *
 * Timestamps are stored as ISO TEXT (generated app-side, monotonic) so the
 * JSON round-trip shape of the API is byte-identical between modes.
 */

declare global {
  // Cached across invocations on the same serverless instance.
  // eslint-disable-next-line no-var
  var __hngTodoPgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__hngTodoPgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — Postgres store misconfigured.");
    }
    globalThis.__hngTodoPgPool = new Pool({
      connectionString,
      // Neon requires TLS; the connection string carries sslmode=require.
      ssl: connectionString.includes("sslmode=")
        ? { rejectUnauthorized: false }
        : undefined,
      max: 3,
    });
  }
  return globalThis.__hngTodoPgPool;
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

let readyPromise: Promise<void> | undefined;

/** Creates the schema if missing and seeds demo content exactly once per database. */
function ready(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          priority TEXT NOT NULL DEFAULT 'medium',
          due_date TEXT,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      const seeded = await pool.query(`SELECT 1 FROM app_meta WHERE key = 'seeded'`);
      if (seeded.rowCount === 0) {
        const seed = buildSeed();
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          for (const task of seed.tasks) {
            await client.query(
              `INSERT INTO tasks (id, title, description, priority, due_date, completed, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                task.id,
                task.title,
                task.description,
                task.priority,
                task.dueDate,
                task.completed,
                task.createdAt,
                task.updatedAt,
              ]
            );
          }
          for (const note of seed.notes) {
            await client.query(
              `INSERT INTO notes (id, title, content, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5)`,
              [note.id, note.title, note.content, note.createdAt, note.updatedAt]
            );
          }
          await client.query(
            `INSERT INTO app_meta (key, value) VALUES ('seeded', $1)
             ON CONFLICT (key) DO NOTHING`,
            [new Date().toISOString()]
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
    })().catch((error) => {
      readyPromise = undefined;
      throw error;
    });
  }
  return readyPromise;
}

function rowToTask(row: QueryResultRow): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    priority: row.priority as Task["priority"],
    dueDate: row.due_date === null || row.due_date === undefined ? null : String(row.due_date),
    completed: row.completed === true,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function byNewestFirst(a: { createdAt: string }, b: { createdAt: string }): number {
  return b.createdAt.localeCompare(a.createdAt);
}

// ---------- Tasks ----------

export async function listTasks(): Promise<Task[]> {
  await ready();
  const result = await getPool().query("SELECT * FROM tasks");
  return result.rows.map(rowToTask).sort(byNewestFirst);
}

export async function getTask(id: string): Promise<Task | null> {
  await ready();
  const result = await getPool().query("SELECT * FROM tasks WHERE id = $1", [id]);
  return result.rows[0] ? rowToTask(result.rows[0]) : null;
}

export async function createTask(input: TaskCreateInput): Promise<Task> {
  await ready();
  const now = timestamp();
  const result = await getPool().query(
    `INSERT INTO tasks (id, title, description, priority, due_date, completed, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      randomUUID(),
      input.title,
      input.description,
      input.priority,
      input.dueDate,
      input.completed,
      now,
      now,
    ]
  );
  return rowToTask(result.rows[0]);
}

export async function updateTask(
  id: string,
  patch: TaskUpdateInput
): Promise<Task | null> {
  await ready();
  const columns: Record<string, string> = {
    title: "title",
    description: "description",
    priority: "priority",
    dueDate: "due_date",
    completed: "completed",
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  let index = 1;
  for (const [key, column] of Object.entries(columns)) {
    if (key in patch) {
      sets.push(`${column} = $${index}`);
      values.push(patch[key as keyof TaskUpdateInput]);
      index += 1;
    }
  }
  sets.push(`updated_at = $${index}`);
  values.push(timestamp());
  index += 1;
  values.push(id);

  const result = await getPool().query(
    `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${index} RETURNING *`,
    values
  );
  return result.rows[0] ? rowToTask(result.rows[0]) : null;
}

export async function deleteTask(id: string): Promise<Task | null> {
  await ready();
  const result = await getPool().query(
    "DELETE FROM tasks WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0] ? rowToTask(result.rows[0]) : null;
}

// ---------- Notes ----------

export async function listNotes(): Promise<Note[]> {
  await ready();
  const result = await getPool().query("SELECT * FROM notes");
  return result.rows.map(rowToNote).sort(byNewestFirst);
}

export async function getNote(id: string): Promise<Note | null> {
  await ready();
  const result = await getPool().query("SELECT * FROM notes WHERE id = $1", [id]);
  return result.rows[0] ? rowToNote(result.rows[0]) : null;
}

export async function createNote(input: NoteCreateInput): Promise<Note> {
  await ready();
  const now = timestamp();
  const result = await getPool().query(
    `INSERT INTO notes (id, title, content, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [randomUUID(), input.title, input.content, now, now]
  );
  return rowToNote(result.rows[0]);
}

export async function updateNote(
  id: string,
  patch: NoteUpdateInput
): Promise<Note | null> {
  await ready();
  const columns: Record<string, string> = {
    title: "title",
    content: "content",
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  let index = 1;
  for (const [key, column] of Object.entries(columns)) {
    if (key in patch) {
      sets.push(`${column} = $${index}`);
      values.push(patch[key as keyof NoteUpdateInput]);
      index += 1;
    }
  }
  sets.push(`updated_at = $${index}`);
  values.push(timestamp());
  index += 1;
  values.push(id);

  const result = await getPool().query(
    `UPDATE notes SET ${sets.join(", ")} WHERE id = $${index} RETURNING *`,
    values
  );
  return result.rows[0] ? rowToNote(result.rows[0]) : null;
}

export async function deleteNote(id: string): Promise<Note | null> {
  await ready();
  const result = await getPool().query(
    "DELETE FROM notes WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0] ? rowToNote(result.rows[0]) : null;
}

// ---------- Stats ----------

export async function getStats(): Promise<Stats> {
  await ready();
  const pool = getPool();
  const tasks = await pool.query("SELECT completed, due_date FROM tasks");
  const notes = await pool.query("SELECT COUNT(*)::int AS count FROM notes");

  const today = new Date().toISOString().slice(0, 10);
  const rows = tasks.rows as Array<{ completed: boolean; due_date: string | null }>;
  const completed = rows.filter((row) => row.completed === true).length;
  const overdue = rows.filter(
    (row) => row.completed === false && row.due_date !== null && row.due_date < today
  ).length;
  const totalTasks = rows.length;
  const totalNotes = notes.rows[0] ? Number(notes.rows[0].count) : 0;

  return {
    totalTasks,
    activeTasks: totalTasks - completed,
    completedTasks: completed,
    overdueTasks: overdue,
    completionRate:
      totalTasks === 0 ? 0 : Math.round((completed / totalTasks) * 100),
    totalNotes,
  };
}
