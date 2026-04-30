import { listBuiltInSkillPacks } from "@ai/skills/registry";
import { apiOk } from "../_utils";

export const runtime = "nodejs";

export async function GET() {
  return apiOk({ skillPacks: listBuiltInSkillPacks() });
}
