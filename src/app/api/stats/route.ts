import { fail, ok } from "@/lib/http";
import { getStats } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(getStats());
  } catch (error) {
    return fail("Failed to load stats.", 500, [String(error)]);
  }
}
