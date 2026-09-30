import { randomUUID } from "node:crypto";

import type { Note, Task } from "./types";

/**
 * Demo content created on first run only — once per database (Postgres mode)
 * or per data directory (file mode). Deleting all items afterwards stays
 * permanent; the seed never comes back.
 */
export function buildSeed(): { tasks: Task[]; notes: Note[] } {
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
          "Push to GitHub, connect the repo to Vercel, then submit the live URL.",
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
