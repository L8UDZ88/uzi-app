import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { shotstackStatus } from "@/lib/render";

// Poll a Shotstack render: returns { status, url } (status: queued|fetching|rendering|saving|done|failed).
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  return NextResponse.json(await shotstackStatus(id));
}
