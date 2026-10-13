import { NextResponse } from "next/server";
import { ok } from "@/lib/utils/response";

export async function GET() {
  return NextResponse.json(ok({ status: "ok", timestamp: new Date().toISOString() }));
}
