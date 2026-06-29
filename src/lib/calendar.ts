import { pillarsFor, activeOutputs, PillarCfg, ChannelCfg } from "./constants";

export type Slot = { date: string; day: string; pillar: string; channel: string; format: string; glyph: string; city?: string };

// pillars x outputs (channel+format) x cadence over a date range, for the campaign's pillar set.
// Range defaults to today..+28 days; caller can pass from/to (capped to 3 years, 3000 posts).
export function buildCalendar(pillars: PillarCfg, channels: ChannelCfg, cadence: string, campaignType?: string, fromISO?: string, toISO?: string): Slot[] {
  const active = pillarsFor(campaignType).filter((p) => pillars?.[p.id]?.on ?? true);
  const outs = activeOutputs(channels || {});
  const perDay = cadence === "machinegun" ? 3 : cadence === "chill" ? 1 : 2;
  // "Now in [city]" pillar: cycle through the cities the user entered, one post per city.
  const nowin = active.find((p) => /\[city\]/i.test(p.name));
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
    if (out.length >= 3000) break; // safety cap
    const date = new Date(start.getTime() + d * 86400000);
    if (cadence === "chill" && ![1, 3, 5].includes(date.getDay())) continue;
    for (let i = 0; i < perDay; i++) {
      const p = active[(d + i) % Math.max(1, active.length)];
      if (!p) continue;
      const o = outs.length ? outs[(d + i) % outs.length] : { channelName: "—", formatName: "", glyph: "·" };
      const city = nowin && p.id === nowin.id && cities.length ? cities[cityIdx++ % cities.length] : undefined;
      out.push({
        date: date.toISOString().slice(0, 10),
        day: date.toLocaleDateString(undefined, { weekday: "short" }),
        pillar: p.name, channel: o.channelName, format: o.formatName, glyph: o.glyph, city,
      });
    }
  }
  return out;
}
