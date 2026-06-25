import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { buildCalendar } from "@/lib/calendar";

// Regenerate the brand's 28-day schedule from its current config.
export async function POST() {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brand = await prisma.brand.findUnique({ where: { userId: uid } });
  if (!brand) return NextResponse.json({ error: "No brand" }, { status: 404 });
  const slots = buildCalendar(brand.pillars as any, brand.channels as any, brand.cadence);
  await prisma.scheduleItem.deleteMany({ where: { brandId: brand.id } });
  await prisma.scheduleItem.createMany({
    data: slots.map((s) => ({ brandId: brand.id, date: new Date(s.date), pillar: s.pillar, channel: s.channel })),
  });
  return NextResponse.json({ count: slots.length, slots });
}
