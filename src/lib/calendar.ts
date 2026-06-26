import { pillarsFor, CHANNELS, PillarCfg, ChannelCfg } from "./constants";

export type Slot = { date: string; day: string; pillar: string; channel: string; glyph: string };

// pillars x channels x cadence -> 28-day schedule, for the campaign's pillar set.
export function buildCalendar(pillars: PillarCfg, channels: ChannelCfg, cadence: string, campaignType?: string): Slot[] {
  const active = pillarsFor(campaignType).filter((p) => pillars?.[p.id]?.on ?? true);
  const chans = CHANNELS.filter((c) => channels?.[c.id]);
  const perDay = cadence === "machinegun" ? 3 : cadence === "chill" ? 1 : 2;
  const out: Slot[] = [];
  const today = new Date();
  for (let d = 0; d < 28; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    if (cadence === "chill" && ![1, 3, 5].includes(date.getDay())) continue;
    for (let i = 0; i < perDay; i++) {
      const p = active[(d + i) % Math.max(1, active.length)];
      if (!p) continue;
      const c = chans.length ? chans[(d + i) % chans.length] : { name: "—", glyph: "·" };
      out.push({
        date: date.toISOString().slice(0, 10),
        day: date.toLocaleDateString(undefined, { weekday: "short" }),
        pillar: p.name, channel: c.name, glyph: c.glyph,
      });
    }
  }
  return out;
}
