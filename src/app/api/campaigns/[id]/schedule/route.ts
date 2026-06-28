import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { buildCalendar } from "@/lib/calendar";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await prisma.brand.findUnique({ where: { id: params.id } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const slots = buildCalendar(c.pillars as any, c.channels as any, c.cadence, (c as any).campaignType);
  await prisma.scheduleItem.deleteMany({ where: { brandId: c.id } });
  await prisma.scheduleItem.createMany({
    data: slots.map((s) => ({ brandId: c.id, date: new Date(s.date), pillar: s.pillar, channel: s.channel, format: s.format, city: s.city || null })),
  });
  return NextResponse.json({ count: slots.length, slots });
}
