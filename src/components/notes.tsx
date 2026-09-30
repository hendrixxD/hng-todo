"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import type { Note } from "@/lib/types";
import { cardClass, inputClass, primaryBtn, secondaryBtn } from "./ui";

export interface NoteInput {
  title: string;
  content: string;
}

export function NoteForm({
  onCreate,
}: {
  onCreate: (input: NoteInput) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const success = await onCreate({ title: title.trim(), content });
    setSaving(false);
    if (success) {
      setTitle("");
      setContent("");
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
        + Add a note
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`${cardClass} space-y-3 p-4`}
      aria-label="New note"
    >
      <input
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Note title"
        className={inputClass}
      />
      <textarea
        required
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Write your note…"
        rows={4}
        className={inputClass}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? "Saving…" : "Add note"}
        </button>
      </div>
    </form>
  );
}

function NoteCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: Note;
  onUpdate: (id: string, patch: Partial<NoteInput>) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    const success = await onUpdate(note.id, {
      title: title.trim(),
      content,
    });
    setSaving(false);
    if (success) setEditing(false);
  }

  if (editing) {
    return (
      <li className={cardClass}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-3 p-4"
        >
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
          <textarea
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            className={inputClass}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setTitle(note.title);
                setContent(note.content);
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
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium break-words">{note.title}</h3>
        <div className="flex shrink-0 gap-1 opacity-60 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit note"
            className="rounded-lg p-1.5 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirming) {
                onDelete(note.id);
                return;
              }
              setConfirming(true);
              setTimeout(() => setConfirming(false), 3000);
            }}
            aria-label={confirming ? "Confirm delete note" : "Delete note"}
            title={confirming ? "Click again to delete" : "Delete note"}
            className={`rounded-lg p-1.5 text-[11px] font-semibold transition ${
              confirming
                ? "bg-rose-500 text-white"
                : "hover:bg-rose-100 dark:hover:bg-rose-500/15"
            }`}
          >
            {confirming ? "Sure?" : "🗑️"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm whitespace-pre-wrap break-words text-slate-600 dark:text-slate-400">
        {note.content}
      </p>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        Updated {new Date(note.updatedAt).toLocaleString()}
      </p>
    </li>
  );
}

export function NoteList({
  notes,
  totalCount,
  onUpdate,
  onDelete,
}: {
  notes: Note[];
  totalCount: number;
  onUpdate: (id: string, patch: Partial<NoteInput>) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  if (totalCount === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No notes yet — add your first one above.
      </p>
    );
  }
  if (notes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No notes match your search.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </ul>
  );
}
