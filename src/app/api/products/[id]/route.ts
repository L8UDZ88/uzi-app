import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

// Return one product image as a data URL, so the browser can composite the REAL product
// (pixel-perfect label) onto an AI-generated background. Ownership-checked.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = await prisma.productImage.findUnique({ where: { id: params.id }, include: { brand: true } });
  if (!p || p.brand.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: p.id, name: p.name, kind: p.kind, data: `data:image/png;base64,${p.data}` });
}
