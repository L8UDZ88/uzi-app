// The splice engine's brain: from a transcribed library asset, pick the single best moment to
// cut for a given channel format, and draft a caption aligned to what's actually said.
// Intelligent auto-pick (Claude) with a deterministic sentence-aware heuristic fallback.

import { TranscriptWord } from "./transcribe";

// Ideal clip length per channel-native format (seconds). 0 = use the whole asset (long-form).
export function targetSecondsForFormat(format: string): number {
  const f = (format || "").toLowerCase();
  if (f === "story") return 15;
  if (f === "reel" || f === "short" || f === "video") return 25;
  if (f === "long") return 0; // full length, no trim
  if (f === "feed" || f === "post") return 12;
  return 20;
}

export type Moment = { start: number; end: number };

// Sentence-aware heuristic: a window ~targetSec that starts on a sentence boundary a little into
// the asset (skips cold intros) and, where possible, ends on a sentence boundary.
export function pickMomentHeuristic(words: TranscriptWord[], targetSec: number): Moment {
  if (!words.length) return { start: 0, end: targetSec > 0 ? targetSec : 0 };
  const total = words[words.length - 1].end;
  if (targetSec <= 0) return { start: 0, end: total };
  const starts: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i === 0 || /[.!?]$/.test(words[i - 1].text)) starts.push(i);
  }
  const preferAfter = Math.min(total * 0.1, 20);
  let best = starts[0] ?? 0;
  for (const s of starts) { if (words[s].start >= preferAfter) { best = s; break; } }
  const startT = words[best].start;
  let endT = Math.min(startT + targetSec, total);
  for (const w of words) { if (w.end >= startT && w.end <= startT + targetSec + 3 && /[.!?]$/.test(w.text)) endT = w.end; }
  endT = Math.min(endT, total);
  return { start: +Math.max(0, startT).toFixed(2), end: +endT.toFixed(2) };
}

// Group transcript words within [start,end] into short, timed caption phrases (timings RELATIVE
// to the clip start). Shared by the video-splice and audiogram renderers.
export function captionsInWindow(words: TranscriptWord[], start: number, end: number) {
  const inRange = words.filter((w) => w.end > start && w.start < end);
  const caps: { text: string; start: number; length: number }[] = [];
  let cur: TranscriptWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    const s = Math.max(0, cur[0].start - start);
    const e = Math.min(end, cur[cur.length - 1].end) - start;
    caps.push({ text: cur.map((x) => x.text).join(" ").replace(/\s+/g, " ").trim(), start: +s.toFixed(2), length: +Math.max(0.5, e - s).toFixed(2) });
    cur = [];
  };
  for (const w of inRange) {
    cur.push(w);
    const text = cur.map((x) => x.text).join(" ");
    if (/[.!?,]$/.test(w.text) || cur.length >= 7 || text.length > 42) flush();
  }
  flush();
  return caps;
}

export type SplicePlan = { start: number; end: number; caption: string; why: string; source: "ai" | "heuristic" };

// Intelligent pick via Claude, grounded in the timestamped transcript. Returns null on any failure.
export async function pickMomentAI(
  words: TranscriptWord[],
  targetSec: number,
  ctx: { beatJob?: string; pillar?: string; brand?: string } = {}
): Promise<SplicePlan | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !words.length || targetSec <= 0) return null;
  const total = words[words.length - 1].end;
  // Compact the transcript into timestamped lines (sentence- or length-bounded).
  const lines: string[] = [];
  let cur = "";
  let curStart = words[0].start;
  for (const w of words) {
    if (!cur) curStart = w.start;
    cur += (cur ? " " : "") + w.text;
    if (/[.!?]$/.test(w.text) || cur.length > 120) { lines.push(`[${curStart.toFixed(1)}s] ${cur}`); cur = ""; }
  }
  if (cur) lines.push(`[${curStart.toFixed(1)}s] ${cur}`);
  const transcriptBlock = lines.join("\n").slice(0, 8000);

  const system = `You are a senior social video editor. From a transcript, select the single most compelling, self-contained ~${targetSec}-second moment for a social clip — hook-first, no mid-thought starts.`;
  const user =
    `Transcript with start times:\n${transcriptBlock}\n\n` +
    `Total asset length: ${total.toFixed(1)}s. Target clip: ~${targetSec}s.` +
    (ctx.pillar ? `\nContent pillar: ${ctx.pillar}.` : "") +
    (ctx.beatJob ? `\nThis post's story job: ${ctx.beatJob}.` : "") +
    `\n\nReturn ONLY JSON: {"start": number seconds, "end": number seconds, "caption": string (punchy social caption aligned to what is actually said, <= 45 words), "why": string (one short line)}. ` +
    `end minus start should be close to ${targetSec}s; both within 0..${total.toFixed(1)}.`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, temperature: 0.5, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const text: string = (data.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    const j = JSON.parse(text);
    let start = Math.max(0, Number(j.start) || 0);
    let end = Math.min(total, Number(j.end) || start + targetSec);
    if (end <= start) end = Math.min(total, start + targetSec);
    return { start: +start.toFixed(2), end: +end.toFixed(2), caption: String(j.caption || ""), why: String(j.why || ""), source: "ai" };
  } catch {
    return null;
  }
}

// Full plan: try AI, fall back to the heuristic. Long-form formats use the whole asset.
export async function planSplice(
  words: TranscriptWord[],
  format: string,
  ctx: { beatJob?: string; pillar?: string; brand?: string } = {}
): Promise<SplicePlan> {
  const target = targetSecondsForFormat(format);
  const total = words.length ? words[words.length - 1].end : 0;
  if (target <= 0) return { start: 0, end: total, caption: "", why: "Full-length asset for long-form.", source: "heuristic" };
  const ai = await pickMomentAI(words, target, ctx);
  if (ai) return ai;
  const m = pickMomentHeuristic(words, target);
  return { ...m, caption: "", why: "Sentence-aware auto-pick.", source: "heuristic" };
}
