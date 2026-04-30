import { listBuiltInSkillCatalog } from "@/lib/skills-runtime";
import { apiOk } from "../_utils";

export const runtime = "nodejs";

export async function GET() {
  return apiOk({ skills: listBuiltInSkillCatalog() });
}
