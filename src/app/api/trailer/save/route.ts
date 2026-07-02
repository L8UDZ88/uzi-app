import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

// Persist edited trailer beats (copy + shot prompts).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId, beats } = await req.json();
  if (!jobId) return NextResponse.json({ error: "Missing job" }, { status: 400 });
  const job = await prisma.trailerJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = await prisma.brand.findUnique({ where: { id: job.brandId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.trailerJob.update({ where: { id: jobId }, data: { beats: (Array.isArray(beats) ? beats : []) as any } });
  return NextResponse.json({ ok: true });
}
