import { pillarsFor, outputsForPillar, PillarCfg, ChannelCfg } from "./constants";
import { arcFor, pillarForBeat } from "./beats";

export type Slot = {
  date: string; day: string; pillar: string; channel: string; format: string; glyph: string; city?: string;
  beat?: string; beatName?: string; phase?: string; loop?: number;
};

// The calendar walks the STORY ARC (Hero Frame beats). Each posting slot advances ONE beat;
// the beat picks the pillar (which produces the post) and the copy angle; the pillar fans out
// to its channels. The arc cycles and escalates each loop (spiral). Physical = 6-beat, Digital = 12.
export function buildCalendar(pillars: PillarCfg, channels: ChannelCfg, cadence: string, campaignType?: string, fromISO?: string, toISO?: string): Slot[] {
  const arc = arcFor(campaignType);
  const allPillars = pillarsFor(campaignType);
  const byName = new Map(allPillars.map((p) => [p.name, p]));
  const perDay = cadence === "machinegun" ? 3 : cadence === "chill" ? 1 : 2;

  // Each pillar's channel×format outputs (user overrides win), cached by pillar name.
  const outsCache = new Map<string, ReturnType<typeof outputsForPillar>>();
  const outsForName = (name: string) => {
    if (outsCache.has(name)) return outsCache.get(name)!;
    const p = byName.get(name);
    let res: ReturnType<typeof outputsForPillar> = [];
    if (p) {
      const cfg = (pillars as any)?.[p.id] || {};
      const format = cfg.format || p.format;
      const chans = Array.isArray(cfg.channels) && cfg.channels.length ? cfg.channels : p.channels;
      res = outputsForPillar(format, chans);
    }
    outsCache.set(name, res);
    return res;
  };

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

  let bi = 0; // global beat index across the whole calendar
  for (let d = 0; d < days; d++) {
    if (out.length >= 3000) break;
    const date = new Date(start.getTime() + d * 86400000);
    if (cadence === "chill" && ![1, 3, 5].includes(date.getDay())) continue;
    for (let i = 0; i < perDay; i++) {
      if (!arc.length) continue;
      const beat = arc[bi % arc.length];
      const loop = Math.floor(bi / arc.length);
      bi++;
      const pillarName = pillarForBeat(beat, loop);
      const isCity = /\[city\]/i.test(pillarName);
      const city = isCity && cities.length ? cities[cityIdx++ % cities.length] : undefined;
      const list = outsForName(pillarName);
      const targets = list.length ? list : [{ channelName: "—", formatName: "", glyph: "·" } as any];
      for (const o of targets) {
        if (out.length >= 3000) break;
        out.push({
          date: date.toISOString().slice(0, 10),
          day: date.toLocaleDateString(undefined, { weekday: "short" }),
          pillar: pillarName, channel: o.channelName, format: o.formatName, glyph: o.glyph, city,
          beat: beat.id, beatName: beat.name, phase: beat.phase, loop,
        });
      }
    }
  }
  return out;
}
