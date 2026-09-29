# HNG To-Do — Tasks & Notes

Stage 1 To-Do List application for **HNG Internship 15 (AI Product Builder /
Engineer track)**, coded **entirely with an AI coding agent**.

Built with **Next.js 16 + TypeScript + Tailwind CSS**, storing data in a
zero-config JSON file store, with an API endpoint test suite in **Vitest**.

## Features

**Required**

- ✅ To-Do list — create, view, edit/update and delete tasks
- ✅ Notes feature — separate notes section with create, edit and delete
- ✅ Coded entirely using AI (one agent, iterating with short instructions)

**Additional features (assignment asks for at least one)**

- 🚩 Task priorities (low / medium / high) with filters
- 📅 Due dates with automatic **overdue** highlighting
- 🔎 Instant search across tasks and notes
- 📊 Stats dashboard (total, active, done, overdue, notes count)
- 🌙 Dark mode (toggle, persisted, respects OS preference)

**Advanced requirements**

- ✅ [`AGENTS.md`](./AGENTS.md) — structured rules that guide the AI coding agent
- ✅ Testing/validation rules — 27 endpoint tests in `tests/api.test.ts`

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm run test       # run the endpoint test suite
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
```

## API reference

All endpoints answer with the envelope `{ "data": ... }` on success and
`{ "error": string, "details"?: string[] }` on failure.

| Method | Endpoint            | Purpose                                        |
| ------ | ------------------- | ---------------------------------------------- |
| GET    | `/api/health`       | Liveness check                                 |
| GET    | `/api/stats`        | Task/note counters incl. overdue               |
| GET    | `/api/tasks`        | List tasks — `?search=&status=&priority=`      |
| POST   | `/api/tasks`        | Create task — `{ title, description?, priority?, dueDate?, completed? }` |
| GET    | `/api/tasks/[id]`   | Get one task                                   |
| PATCH  | `/api/tasks/[id]`   | Update task (any subset of fields)             |
| DELETE | `/api/tasks/[id]`   | Delete task                                    |
| GET    | `/api/notes`        | List notes — `?search=`                        |
| POST   | `/api/notes`        | Create note — `{ title, content }`             |
| GET    | `/api/notes/[id]`   | Get one note                                   |
| PATCH  | `/api/notes/[id]`   | Update note                                    |
| DELETE | `/api/notes/[id]`   | Delete note                                    |

Try it:

```bash
curl http://localhost:3000/api/health

curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Submit Stage 1","priority":"high","dueDate":"2026-10-01"}'
```

## Testing

Every endpoint created in this repo has tests that validate it works —
success, validation failures, unknown ids and persisted side effects:

```bash
npm run test
```

## Deploying (Vercel)

1. Push the repository to GitHub (see below).
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Framework preset: Next.js (auto-detected). No env vars needed. **Deploy**.
4. Open the live URL and test the app — a green build is not proof the app
   works.

> **Note on storage:** the JSON file store keeps data in `data/db.json`.
> Serverless hosts have ephemeral filesystems, so data resets between
> instances/cold starts. To persist data on a hosted database (e.g. Neon,
> Turso), replace the function bodies in `src/lib/store.ts` — nothing else
> changes (see `AGENTS.md` §4).

## Pushing to GitHub (beginner-friendly)

```bash
git init                        # if not already a repo
git add .
git commit -m "feat: HNG Stage 1 to-do app"
git branch -M main
git remote add origin https://github.com/<you>/hng-todo.git
git push -u origin main
```

## Project structure

```
src/
  app/
    api/            REST endpoints (tasks, notes, health, stats)
    page.tsx        Renders the client app
  components/       UI: todo-app, tasks, notes, shared primitives
  lib/
    store.ts        JSON-file data store (swap this for a real DB later)
    validation.ts   All input validation
    types.ts        Shared types
tests/              Vitest endpoint tests
AGENTS.md           Rules for AI coding agents — read before changing code
```
