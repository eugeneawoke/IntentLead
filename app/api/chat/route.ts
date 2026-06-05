import { NextResponse } from "next/server";
import { ok } from "@/lib/utils/response";

// Stub — full implementation in Phase 4
export async function POST() {
  return NextResponse.json(ok({ message: "Chat not yet implemented" }), { status: 501 });
}
