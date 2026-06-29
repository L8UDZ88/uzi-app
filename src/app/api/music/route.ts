import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { submitMusic, musicResult, musicEnabled } from "@/lib/music";

export const maxDuration = 60;

// POST: start a score (derived from the brand's mood). GET: poll status (?requestId=).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!musicEnabled()) return NextResponse.json({ error: "Music isn't enabled — add FAL_KEY in Vercel.", notEnabled: true }, { status: 400 });
  const { campaignId, mood } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const voice = c.voice || "warm, confident, modern";
  const moodStr = String(mood || voice);
  // Sonauto wants a list of style tags. Force instrumental (empty lyrics) in the lib.
  const tags = ["instrumental", "cinematic", "background score", ...moodStr.split(/[,/]/).map((t) => t.trim()).filter(Boolean)].slice(0, 8);
  const r = await submitMusic(tags);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ requestId: r.requestId });
}

export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  return NextResponse.json(await musicResult(sp.get("requestId") || ""));
}
