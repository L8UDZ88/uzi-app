import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function GET() {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brand = await prisma.brand.findUnique({ where: { userId: uid } });
  return NextResponse.json({ brand });
}

export async function PUT(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { name, handle, tagline, region, voice, pillars, channels, inputs, cadence, onboarded } = body;
  const brand = await prisma.brand.update({
    where: { userId: uid },
    data: { name, handle, tagline, region, voice, pillars, channels, inputs, cadence, onboarded },
  });
  return NextResponse.json({ brand });
}
