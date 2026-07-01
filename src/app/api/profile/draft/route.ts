import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export const maxDuration = 60;

// Draft the Brand profile fields from the connected Drive folder's ingested text ("master brain").
// Fill-only-blanks: fields the user already wrote are kept.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, current } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ profile: {}, error: "Add ANTHROPIC_API_KEY in Vercel to auto-draft." });

  const inputs = (c.inputs as any) || {};
  const src = String(inputs.sourceText || "").trim();
  const cur = current || {};
  const bk = cur.brandKit || {};
  const mark = (v: any) => (v && String(v).trim() ? `[KEEP: ${v}]` : "[BLANK — draft this]");

  const system =
    "You are a brand strategist drafting a brand profile from the brand's real source material. " +
    "Draft ONLY the [BLANK] fields; keep [KEEP] fields as-is and stay consistent with them. Be concrete and specific to this brand — never generic.";
  const user =
    `Brand name: ${c.name || cur.name || "the brand"}.` +
    (src ? `\n\nBRAND MASTER BRAIN (real source material — ground every field in these facts):\n<brain>\n${src.slice(0, 9000)}\n</brain>` : " (No source material connected yet — infer sensibly from the name.)") +
    `\n\nCurrent fields:\n- tagline: ${mark(cur.tagline)}\n- region: ${mark(cur.region)}\n- voice: ${mark(cur.voice)}\n- product: ${mark(bk.product)}\n- donts: ${mark(bk.donts)}\n- phrases: ${mark(bk.phrases)}\n\n` +
    `Return ONLY valid JSON (no markdown) with keys: {"tagline","region","voice","product","donts","phrases"}. ` +
    `tagline = one short line; region = market/region served; voice = 3-5 adjectives; product = what it is in one sentence; donts = things to never do/say; phrases = comma-separated signature phrases.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 700, temperature: 0.6, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) {
      let d = `HTTP ${res.status}`; try { const e: any = await res.json(); d = e?.error?.message || d; } catch {}
      return NextResponse.json({ profile: {}, error: d });
    }
    const data: any = await res.json();
    const text: string = (data.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    const j = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
    return NextResponse.json({
      profile: {
        tagline: String(j.tagline || ""), region: String(j.region || ""), voice: String(j.voice || ""),
        product: String(j.product || ""), donts: String(j.donts || ""), phrases: String(j.phrases || ""),
      },
      usedAI: true,
    });
  } catch (e: any) {
    return NextResponse.json({ profile: {}, error: String(e?.message || e) });
  }
}
