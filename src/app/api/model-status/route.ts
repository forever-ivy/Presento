import { NextResponse } from "next/server";
import { getModelRuntimeStatus } from "@/lib/model-config";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    modelStatus: getModelRuntimeStatus(),
  });
}
