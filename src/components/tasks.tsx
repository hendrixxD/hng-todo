"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import type { Priority, Task } from "@/lib/types";
import { cardClass, inputClass, primaryBtn, secondaryBtn } from "./ui";

export interface TaskInput {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
}

const PRIORITY_BADGE: Record<Priority, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  high: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.completed) return false;
  return task.dueDate < todayISO();
}

function TaskFields({
  title,
  description,
  priority,
  dueDate,
  onTitle,
  onDescription,
  onPriority,
  onDueDate,
}: {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onPriority: (value: Priority) => void;
  onDueDate: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <input
        required
        value={title}
        onChange={(event) => onTitle(event.target.value)}
        placeholder="Task title"
        className={inputClass}
      />
      <textarea
        value={description}
        onChange={(event) => onDescription(event.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className={inputClass}
      />
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          Priority
          <select
            value={priority}
            onChange={(event) => onPriority(event.target.value as Priority)}
            className={`${inputClass} w-auto py-1.5`}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(event) => onDueDate(event.target.value)}
            className={`${inputClass} w-auto py-1.5`}
          />
        </label>
      </div>
    </div>
  );
}

export function TaskForm({
  onCreate,
}: {
  onCreate: (input: TaskInput) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const success = await onCreate({
      title: title.trim(),
      description,
      priority,
      dueDate: dueDate === "" ? null : dueDate,
    });
    setSaving(false);
    if (success) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-4 text-sm font-medium text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
      >
        + Add a task
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`${cardClass} space-y-3 p-4`}
      aria-label="New task"
    >
      <TaskFields
        title={title}
        description={description}
        priority={priority}
        dueDate={dueDate}
        onTitle={setTitle}
        onDescription={setDescription}
        onPriority={setPriority}
        onDueDate={setDueDate}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? "Saving…" : "Add task"}
        </button>
      </div>
    </form>
  );
}

function TaskCard({
  task,
  onToggle,
  onUpdate,
  onDelete,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onUpdate: (id: string, patch: Partial<TaskInput>) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    const success = await onUpdate(task.id, {
      title: title.trim(),
      description,
      priority,
      dueDate: dueDate === "" ? null : dueDate,
    });
    setSaving(false);
    if (success) setEditing(false);
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className={`${cardClass} space-y-3 p-4`}>
          <TaskFields
            title={title}
            description={description}
            priority={priority}
            dueDate={dueDate}
            onTitle={setTitle}
            onDescription={setDescription}
            onPriority={setPriority}
            onDueDate={setDueDate}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setTitle(task.title);
                setDescription(task.description);
                setPriority(task.priority);
                setDueDate(task.dueDate ?? "");
                setEditing(false);
              }}
              className={secondaryBtn}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggle(task)}
          aria-label={task.completed ? "Mark as active" : "Mark as completed"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition ${
            task.completed
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-slate-300 text-transparent hover:border-indigo-500 dark:border-slate-600"
          }`}
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`font-medium ${
                task.completed ? "text-slate-400 line-through dark:text-slate-500" : ""
              }`}
            >
              {task.title}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PRIORITY_BADGE[task.priority]}`}
            >
              {task.priority}
            </span>
            {task.dueDate && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  isOverdue(task)
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {isOverdue(task) ? "Overdue" : "Due"} {task.dueDate}
              </span>
            )}
          </div>
          {task.description && (
            <p className="mt-1 text-sm break-words text-slate-600 dark:text-slate-400">
              {task.description}
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            Updated {new Date(task.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 opacity-60 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit task"
            className="rounded-lg p-1.5 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete this task?")) onDelete(task.id);
            }}
            aria-label="Delete task"
            className="rounded-lg p-1.5 text-sm transition hover:bg-rose-100 dark:hover:bg-rose-500/15"
          >
            🗑️
          </button>
        </div>
      </div>
    </li>
  );
}

export function TaskList({
  tasks,
  totalCount,
  onToggle,
  onUpdate,
  onDelete,
}: {
  tasks: Task[];
  totalCount: number;
  onToggle: (task: Task) => void;
  onUpdate: (id: string, patch: Partial<TaskInput>) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  if (totalCount === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No tasks yet — add your first one above.
      </p>
    );
  }
  if (tasks.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No tasks match the current search or filters.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
