import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default async function DashboardPage() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const brand = await prisma.brand.findUnique({
    where: { userId: uid },
    include: { schedule: { orderBy: { date: "asc" } } },
  });
  if (!brand) redirect("/login");
  if (!brand.onboarded) redirect("/onboarding");
  const slots = brand.schedule.map((s) => ({
    date: s.date.toISOString().slice(0, 10),
    day: s.date.toLocaleDateString(undefined, { weekday: "short" }),
    pillar: s.pillar, channel: s.channel,
    glyph: ({ LinkedIn: "in", YouTube: "▶", Instagram: "◎", Facebook: "f", TikTok: "♪", Podcast: "🎙" } as any)[s.channel] || "·",
    status: s.status,
  }));
  return <Dashboard brand={brand} slots={slots} />;
}
