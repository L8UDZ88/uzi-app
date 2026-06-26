import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Account already exists" }, { status: 409 });
  const user = await prisma.user.create({
    data: { email, name: name || email.split("@")[0], passwordHash: await bcrypt.hash(password, 10) },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
