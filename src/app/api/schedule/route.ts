import { NextResponse } from "next/server";
// Deprecated — replaced by /api/campaigns/[id]/schedule. Kept as a stub.
export async function POST() { return NextResponse.json({ error: "Use /api/campaigns/[id]/schedule" }, { status: 410 }); }
