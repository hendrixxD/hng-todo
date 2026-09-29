import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate every test run in its own throwaway data directory so tests never
// touch (or depend on) the developer's real database file.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hng-todo-test-"));
