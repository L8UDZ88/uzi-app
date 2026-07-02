import { pillarsFor, outputsForPillar, PillarCfg, ChannelCfg } from "./constants";
import { arcFor } from "./beats";

export type Slot = {
  date: string; day: string; pillar: string; channel: string; format: string; glyph: string; city?: string; time?: string;
  beat?: string; beatName?: string; phase?: string; loop?: number;
};

// Fixed weekly rotation: one pillar per weekday, at a set ET time.
//   Mon→P1 · Tue→P2 · Wed→P3 · Thu→P4 · Fri→P5 · Sat→P6  — all 8am ET
//   Sun→P7 (8am ET) + P8 (12pm ET)
// weekday: 0=Sun … 6=Sat.
const DAY_PLAN: Record<number, { id: number; hour: number }[]> = {
  1: [{ id: 1, hour: 8 }],
  2: [{ id: 2, hour: 8 }],
  3: [{ id: 3, hour: 8 }],
  4: [{ id: 4, hour: 8 }],
  5: [{ id: 5, hour: 8 }],
  6: [{ id: 6, hour: 8 }],
  0: [{ id: 7, hour: 8 }, { id: 8, hour: 12 }],
};
// Rough US-Eastern offset (EDT ~ Mar–Oct, else EST). Good enough for post scheduling.
function etOffset(d: Date): string { const m = d.getUTCMonth(); return m >= 2 && m <= 10 ? "-04:00" : "-05:00"; }
function timeLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${hour < 12 ? "AM" : "PM"} ET`;
}

export function buildCalendar(pillars: PillarCfg, channels: ChannelCfg, cadence: string, campaignType?: string, fromISO?: string, toISO?: string, omni?: boolean): Slot[] {
  const arc = arcFor(campaignType);
  const allPillars = pillarsFor(campaignType);
  const byId = new Map(allPillars.map((p) => [p.id, p]));
  // The story beat that owns a pillar (for the beat badge + beat-conditioned copy).
  const beatForPillar = (name: string) => arc.find((b) => b.pillar === name || (b.alts || []).includes(name));

  // "Now in [city]" — cycle through the cities the user entered.
  const nowin = allPillars.find((p) => /\[city\]/i.test(p.name));
  const cities = nowin ? String((pillars as any)?.[nowin.id]?.cities || "").split(",").map((s) => s.trim()).filter(Boolean) : [];
  let cityIdx = 0;

  const out: Slot[] = [];
  const start = fromISO ? new Date(fromISO + "T00:00:00") : new Date();
  start.setHours(0, 0, 0, 0);
  let end = toISO ? new Date(toISO + "T00:00:00") : new Date(start.getTime() + 27 * 86400000);
  const maxEnd = new Date(start); maxEnd.setFullYear(maxEnd.getFullYear() + 3);
  if (end > maxEnd) end = maxEnd;
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  for (let d = 0; d < days; d++) {
    if (out.length >= 3000) break;
    const date = new Date(start.getTime() + d * 86400000);
    const plan = DAY_PLAN[date.getDay()] || [];
    const loop = Math.floor(d / 7); // week index — the story escalates each week (spiral)
    const ymd = date.toISOString().slice(0, 10);
    for (const entry of plan) {
      const p = byId.get(entry.id);
      if (!p) continue;
      const cfg = (pillars as any)?.[p.id] || {};
      if (cfg.on === false) continue; // pillar switched off → skip its day
      const format = cfg.format || p.format;
      const chans = Array.isArray(cfg.channels) && cfg.channels.length ? cfg.channels : p.channels;
      const outs = outputsForPillar(format, chans, omni);
      const beat = beatForPillar(p.name);
      const isCity = /\[city\]/i.test(p.name);
      const city = isCity && cities.length ? cities[cityIdx++ % cities.length] : undefined;
      const iso = `${ymd}T${String(entry.hour).padStart(2, "0")}:00:00${etOffset(date)}`;
      const targets = outs.length ? outs : [{ channelName: "—", formatName: "", glyph: "·" } as any];
      for (const o of targets) {
        if (out.length >= 3000) break;
        out.push({
          date: iso,
          day: date.toLocaleDateString(undefined, { weekday: "short" }),
          pillar: p.name, channel: o.channelName, format: o.formatName, glyph: o.glyph, city,
          time: timeLabel(entry.hour),
          beat: beat?.id, beatName: beat?.name, phase: beat?.phase, loop,
        });
      }
    }
  }
  return out;
}
