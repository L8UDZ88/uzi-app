import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

async function owns(uid: string, campaignId: string) {
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  return c && c.userId === uid ? c : null;
}

// List a campaign's uploaded product images.
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaignId = new URL(req.url).searchParams.get("campaignId") || "";
  if (!(await owns(uid, campaignId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const products = await prisma.productImage.findMany({ where: { brandId: campaignId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  return NextResponse.json({ products });
}

// Upload a transparent product PNG (sent as a data URL).
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId, name, dataUrl } = await req.json();
  if (!(await owns(uid, campaignId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b64 = String(dataUrl || "").split(",")[1] || "";
  if (!b64) return NextResponse.json({ error: "No image data" }, { status: 400 });
  const p = await prisma.productImage.create({ data: { brandId: campaignId, name: name || "product", data: b64 } });
  return NextResponse.json({ id: p.id, name: p.name });
}

// Delete a product image.
export async function DELETE(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const p = await prisma.productImage.findUnique({ where: { id }, include: { brand: true } });
  if (!p || p.brand.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.productImage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
