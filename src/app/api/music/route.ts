import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { submitMusic, musicResult, musicEnabled } from "@/lib/music";

export const maxDuration = 60;

// POST: start a score (derived from the brand's mood). GET: poll status (?statusUrl=&responseUrl=).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!musicEnabled()) return NextResponse.json({ error: "Music isn't enabled — add FAL_KEY in Vercel.", notEnabled: true }, { status: 400 });
  const { campaignId, mood } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const voice = c.voice || "warm, confident, modern";
  const region = c.region ? `, evoking ${c.region}` : "";
  const prompt = `Instrumental background score for a social ad${region}. Mood: ${mood || voice}. No vocals, no lead voice. Clean, premium, loopable, leaves room for a voiceover on top.`;
  const tags = `instrumental, background, ${mood || voice}, cinematic, no vocals`;
  const r = await submitMusic(prompt, tags);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ statusUrl: r.statusUrl, responseUrl: r.responseUrl });
}

export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  return NextResponse.json(await musicResult(sp.get("statusUrl") || "", sp.get("responseUrl") || ""));
}
