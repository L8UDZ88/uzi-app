import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, status } = await req.json();
  // Make sure the item belongs to this user's brand before updating.
  const brand = await prisma.brand.findUnique({ where: { userId: uid } });
  if (!brand) return NextResponse.json({ error: "No brand" }, { status: 404 });
  const item = await prisma.scheduleItem.findUnique({ where: { id } });
  if (!item || item.brandId !== brand.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.scheduleItem.update({ where: { id }, data: { status: status || "approved" } });
  return NextResponse.json({ item: updated });
}
