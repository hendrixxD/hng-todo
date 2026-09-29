import type { Priority, ValidationResult } from "./types";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

export const LIMITS = {
  titleMax: 200,
  descriptionMax: 2000,
  noteContentMax: 5000,
} as const;

export interface TaskCreateInput {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  completed: boolean;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  priority?: Priority;
  dueDate?: string | null;
  completed?: boolean;
}

export interface NoteCreateInput {
  title: string;
  content: string;
}

export interface NoteUpdateInput {
  title?: string;
  content?: string;
}

const PROTECTED_FIELDS = ["id", "createdAt", "updatedAt"] as const;

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function validateTitle(
  body: Record<string, unknown>,
  errors: string[]
): string | null {
  const raw = body.title;
  if (typeof raw !== "string") {
    errors.push("title is required and must be a string.");
    return null;
  }
  const title = raw.trim();
  if (title.length === 0) {
    errors.push("title cannot be empty.");
    return null;
  }
  if (title.length > LIMITS.titleMax) {
    errors.push(`title must be at most ${LIMITS.titleMax} characters.`);
    return null;
  }
  return title;
}

function validateDescription(
  body: Record<string, unknown>,
  key: string,
  max: number,
  errors: string[]
): string | null {
  const raw = body[key];
  if (raw === undefined) return "";
  if (typeof raw !== "string") {
    errors.push(`${key} must be a string.`);
    return null;
  }
  if (raw.length > max) {
    errors.push(`${key} must be at most ${max} characters.`);
    return null;
  }
  return raw.trim();
}

/** Accepts "YYYY-MM-DD" (a real calendar date); null, undefined or "" mean "no date". */
export function isValidDueDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  );
}

function validateDueDate(
  body: Record<string, unknown>,
  errors: string[]
): string | null | undefined {
  const raw = body.dueDate;
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string" || !isValidDueDate(raw)) {
    errors.push('dueDate must be a valid calendar date in "YYYY-MM-DD" format.');
    return null;
  }
  return raw;
}

function validatePriority(
  body: Record<string, unknown>,
  errors: string[]
): Priority | undefined {
  const raw = body.priority;
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || !PRIORITIES.includes(raw as Priority)) {
    errors.push(`priority must be one of: ${PRIORITIES.join(", ")}.`);
    return undefined;
  }
  return raw as Priority;
}

function rejectProtectedFields(
  body: Record<string, unknown>,
  errors: string[]
): void {
  for (const field of PROTECTED_FIELDS) {
    if (field in body) {
      errors.push(`Field "${field}" cannot be set or updated.`);
    }
  }
}

export function validateTaskCreate(input: unknown): ValidationResult<TaskCreateInput> {
  const body = asObject(input);
  if (!body) {
    return { ok: false, errors: ["Request body must be a JSON object."] };
  }

  const errors: string[] = [];
  const title = validateTitle(body, errors);
  const description = validateDescription(body, "description", LIMITS.descriptionMax, errors);
  const dueDate = validateDueDate(body, errors);
  const priority = validatePriority(body, errors);
  rejectProtectedFields(body, errors);

  const completed = body.completed;
  if (completed !== undefined && typeof completed !== "boolean") {
    errors.push("completed must be a boolean.");
  }

  if (errors.length > 0 || title === null || description === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title,
      description: description ?? "",
      priority: priority ?? "medium",
      dueDate: dueDate === undefined ? null : dueDate,
      completed: completed === true,
    },
  };
}

export function validateTaskUpdate(input: unknown): ValidationResult<TaskUpdateInput> {
  const body = asObject(input);
  if (!body) {
    return { ok: false, errors: ["Request body must be a JSON object."] };
  }

  const errors: string[] = [];
  rejectProtectedFields(body, errors);

  const update: TaskUpdateInput = {};

  if ("title" in body) {
    const title = validateTitle(body, errors);
    if (title !== null) update.title = title;
  }
  if ("description" in body) {
    const description = validateDescription(body, "description", LIMITS.descriptionMax, errors);
    if (description !== null) update.description = description;
  }
  if ("dueDate" in body) {
    const dueDate = validateDueDate(body, errors);
    if (dueDate !== undefined) update.dueDate = dueDate;
  }
  if ("priority" in body) {
    const priority = validatePriority(body, errors);
    if (priority !== undefined) update.priority = priority;
  }
  if ("completed" in body) {
    if (typeof body.completed !== "boolean") {
      errors.push("completed must be a boolean.");
    } else {
      update.completed = body.completed;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (Object.keys(update).length === 0) {
    return {
      ok: false,
      errors: [
        "Provide at least one updatable field: title, description, priority, dueDate or completed.",
      ],
    };
  }
  return { ok: true, value: update };
}

export function validateNoteCreate(input: unknown): ValidationResult<NoteCreateInput> {
  const body = asObject(input);
  if (!body) {
    return { ok: false, errors: ["Request body must be a JSON object."] };
  }

  const errors: string[] = [];
  const title = validateTitle(body, errors);
  const content = validateDescription(body, "content", LIMITS.noteContentMax, errors);
  if (content !== null && content.length === 0) {
    errors.push("content cannot be empty.");
  }
  rejectProtectedFields(body, errors);

  if (errors.length > 0 || title === null || content === null) {
    return { ok: false, errors };
  }
  return { ok: true, value: { title, content } };
}

export function validateNoteUpdate(input: unknown): ValidationResult<NoteUpdateInput> {
  const body = asObject(input);
  if (!body) {
    return { ok: false, errors: ["Request body must be a JSON object."] };
  }

  const errors: string[] = [];
  rejectProtectedFields(body, errors);

  const update: NoteUpdateInput = {};

  if ("title" in body) {
    const title = validateTitle(body, errors);
    if (title !== null) update.title = title;
  }
  if ("content" in body) {
    const content = validateDescription(body, "content", LIMITS.noteContentMax, errors);
    if (content !== null) update.content = content;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (Object.keys(update).length === 0) {
    return {
      ok: false,
      errors: ["Provide at least one updatable field: title or content."],
    };
  }
  return { ok: true, value: update };
}
