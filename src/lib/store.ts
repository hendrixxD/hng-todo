import * as fileStore from "./store-file";
import * as pgStore from "./store-pg";

/**
 * Store facade — the only module routes and UI import.
 *
 * Production (DATABASE_URL set) uses the Postgres implementation, which
 * persists across serverless instances and cold starts. Local development and
 * the test suite fall back to the JSON-file implementation, keeping the suite
 * hermetic and zero-config. Both implementations share identical signatures.
 */
const usePostgres = Boolean(process.env.DATABASE_URL);
const impl = usePostgres ? pgStore : fileStore;

export const listTasks = impl.listTasks;
export const getTask = impl.getTask;
export const createTask = impl.createTask;
export const updateTask = impl.updateTask;
export const deleteTask = impl.deleteTask;

export const listNotes = impl.listNotes;
export const getNote = impl.getNote;
export const createNote = impl.createNote;
export const updateNote = impl.updateNote;
export const deleteNote = impl.deleteNote;

export const getStats = impl.getStats;

export async function resetForTests(): Promise<void> {
  // Postgres mode has nothing to reset (the test suite never runs in this mode).
  if (!usePostgres) await fileStore.resetForTests();
}

export type { Priority } from "./types";
