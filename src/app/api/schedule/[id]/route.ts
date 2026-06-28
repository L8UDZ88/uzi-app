import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

// Delete a single calendar post.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const item = await prisma.scheduleItem.findUnique({ where: { id: params.id }, include: { brand: true } });
  if (!item || item.brand.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.scheduleItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
