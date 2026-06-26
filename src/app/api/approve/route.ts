import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, status } = await req.json();
  const item = await prisma.scheduleItem.findUnique({ where: { id }, include: { brand: true } });
  if (!item || item.brand.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.scheduleItem.update({ where: { id }, data: { status: status || "approved" } });
  return NextResponse.json({ item: updated });
}
