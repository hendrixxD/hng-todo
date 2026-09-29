"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Note, Priority, Stats, Task } from "@/lib/types";
import { NoteForm, NoteList, type NoteInput } from "./notes";
import { TaskForm, TaskList, type TaskInput } from "./tasks";

type Tab = "tasks" | "notes";
type StatusFilter = "all" | "active" | "completed";
type PriorityFilter = "all" | Priority;

interface ApiErrorBody {
  error?: unknown;
  details?: unknown;
}

/** Calls the API and unwraps the { data } envelope; throws readable errors. */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response — fall through to the generic error below.
  }

  if (!response.ok) {
    const body = (payload ?? {}) as ApiErrorBody;
    const details = Array.isArray(body.details)
      ? body.details.filter((item): item is string => typeof item === "string")
      : [];
    const message =
      details.length > 0
        ? details.join(" ")
        : typeof body.error === "string"
          ? body.error
          : undefined;
    throw new Error(message ?? `Request failed with status ${response.status}.`);
  }

  return (payload as { data: T }).data;
}

export default function TodoApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<Tab>("tasks");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  const handleError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await api<Stats>("/api/stats"));
    } catch {
      // Stats are decorative; a transient failure here is not worth a banner.
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, noteData] = await Promise.all([
        api<{ tasks: Task[]; count: number }>("/api/tasks"),
        api<{ notes: Note[]; count: number }>("/api/notes"),
      ]);
      setTasks(taskData.tasks);
      setNotes(noteData.notes);
      setError(null);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
    void refreshStats();
  }, [handleError, refreshStats]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private mode etc. — theme simply won't persist.
    }
  }

  // ---------- Task handlers ----------

  async function handleCreateTask(input: TaskInput): Promise<boolean> {
    try {
      const { task } = await api<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setTasks((prev) => [task, ...prev]);
      setError(null);
      void refreshStats();
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  }

  async function handleUpdateTask(
    id: string,
    patch: Partial<TaskInput> & { completed?: boolean }
  ): Promise<boolean> {
    try {
      const { task } = await api<{ task: Task }>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
      setError(null);
      void refreshStats();
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  }

  function handleToggleTask(task: Task) {
    void handleUpdateTask(task.id, { completed: !task.completed });
  }

  async function handleDeleteTask(id: string): Promise<boolean> {
    try {
      await api<{ task: Task }>(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((item) => item.id !== id));
      setError(null);
      void refreshStats();
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  }

  // ---------- Note handlers ----------

  async function handleCreateNote(input: NoteInput): Promise<boolean> {
    try {
      const { note } = await api<{ note: Note }>("/api/notes", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setNotes((prev) => [note, ...prev]);
      setError(null);
      void refreshStats();
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  }

  async function handleUpdateNote(
    id: string,
    patch: Partial<NoteInput>
  ): Promise<boolean> {
    try {
      const { note } = await api<{ note: Note }>(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setNotes((prev) => prev.map((item) => (item.id === note.id ? note : item)));
      setError(null);
      void refreshStats();
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  }

  async function handleDeleteNote(id: string): Promise<boolean> {
    try {
      await api<{ note: Note }>(`/api/notes/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((item) => item.id !== id));
      setError(null);
      void refreshStats();
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  }

  // ---------- Derived (client-side filters mirror the API query filters) ----------

  const visibleTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter === "active" && task.completed) return false;
      if (statusFilter === "completed" && !task.completed) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (needle) {
        const haystack = `${task.title} ${task.description}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const visibleNotes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter((note) =>
      `${note.title} ${note.content}`.toLowerCase().includes(needle)
    );
  }, [notes, search]);

  const statChips = stats
    ? [
        { label: "Tasks", value: stats.totalTasks },
        { label: "Active", value: stats.activeTasks },
        { label: "Done", value: stats.completedTasks },
        {
          label: "Overdue",
          value: stats.overdueTasks,
          danger: stats.overdueTasks > 0,
        },
        { label: "Notes", value: stats.totalNotes },
      ]
    : [];

  const tabButton = (target: Tab) =>
    `rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
      tab === target
        ? "bg-indigo-600 text-white shadow-sm"
        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
    }`;

  const filterInput =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-indigo-600 uppercase dark:text-indigo-400">
            HNG Internship 15 · Stage 1
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">To-Do &amp; Notes</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Tasks, notes, priorities and due dates — coded entirely with an AI coding
            agent.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="font-semibold hover:text-rose-900 dark:hover:text-rose-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {statChips.map((chip) => (
            <div
              key={chip.label}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div
                className={`text-lg font-bold ${
                  chip.danger ? "text-rose-600 dark:text-rose-400" : ""
                }`}
              >
                {chip.value}
              </div>
              <div className="text-[11px] font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {chip.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button type="button" onClick={() => setTab("tasks")} className={tabButton("tasks")}>
            Tasks
          </button>
          <button type="button" onClick={() => setTab("notes")} className={tabButton("notes")}>
            Notes
          </button>
        </div>

        {tab === "tasks" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
              {(["all", "active", "completed"] as StatusFilter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatusFilter(option)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                    statusFilter === option
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              aria-label="Filter by priority"
              className={filterInput}
            >
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        )}

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={tab === "tasks" ? "Search tasks…" : "Search notes…"}
          aria-label="Search"
          className={`${filterInput} ml-auto min-w-40 flex-1 sm:max-w-56`}
        />
      </div>

      {loading ? (
        <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </p>
      ) : tab === "tasks" ? (
        <div className="mt-4 space-y-4">
          <TaskForm onCreate={handleCreateTask} />
          <TaskList
            tasks={visibleTasks}
            totalCount={tasks.length}
            onToggle={handleToggleTask}
            onUpdate={handleUpdateTask}
            onDelete={(id) => void handleDeleteTask(id)}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <NoteForm onCreate={handleCreateNote} />
          <NoteList
            notes={visibleNotes}
            totalCount={notes.length}
            onUpdate={handleUpdateNote}
            onDelete={(id) => void handleDeleteNote(id)}
          />
        </div>
      )}

      <footer className="mt-12 text-center text-xs text-slate-400 dark:text-slate-500">
        Coded entirely with an AI coding agent · HNG Internship 15 — Stage 1 ·{" "}
        <a href="/api/health" className="underline hover:text-indigo-600 dark:hover:text-indigo-400">
          /api/health
        </a>{" "}
        ·{" "}
        <a href="/api/stats" className="underline hover:text-indigo-600 dark:hover:text-indigo-400">
          /api/stats
        </a>
      </footer>
    </main>
  );
}
