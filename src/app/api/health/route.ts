import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({
    status: "ok",
    app: "hng-todo",
    timestamp: new Date().toISOString(),
  });
}
