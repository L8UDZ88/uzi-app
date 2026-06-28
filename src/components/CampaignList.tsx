"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo, Btn, Card } from "./ui";
import { CAMPAIGN_TYPES } from "@/lib/constants";

type C = { id: string; name: string; campaignType: string; onboarded: boolean; scheduled: number };

export default function CampaignList({ campaigns }: { campaigns: C[] }) {
  const r = useRouter();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<C[]>(campaigns);

  const del = async (id: string, name: string, e: any) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name || "Untitled"}"? This permanently removes the campaign and its calendar.`)) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    setList((l) => l.filter((c) => c.id !== id));
  };

  const create = async (campaignType: string) => {
    setBusy(true);
    const res = await fetch("/api/campaigns", { method: "POST", body: JSON.stringify({ campaignType }) });
    const d = await res.json();
    setBusy(false);
    if (d.id) r.push(`/campaign/${d.id}/setup`);
  };
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); r.push("/"); };

  return (
    <div>
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Logo />
        <div className="flex items-center gap-3">
          <Btn onClick={() => setPicking(true)}>+ New campaign</Btn>
          <Btn kind="soft" onClick={logout}>Log out</Btn>
        </div>
      </nav>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-black">Your campaigns</h1>
        <p className="text-zinc-400 text-sm mt-1">Each campaign is its own brand, type, and calendar. Run as many as you like.</p>

        {list.length === 0 && !picking && (
          <Card className="p-10 mt-8 text-center">
            <div className="text-zinc-300 font-semibold">No campaigns yet</div>
            <div className="text-zinc-500 text-sm mt-1">Spin up your first one — it takes a couple of minutes.</div>
            <Btn className="mt-5" onClick={() => setPicking(true)}>+ New campaign</Btn>
          </Card>
        )}

        {list.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {list.map((c) => (
              <div key={c.id} onClick={() => r.push(c.onboarded ? `/campaign/${c.id}` : `/campaign/${c.id}/setup`)}
                className="text-left cursor-pointer">
                <Card className="p-5 hover:border-zinc-600 transition h-full">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-lg truncate">{c.name || "Untitled"}</div>
                    <span className="text-xs bg-zinc-800 text-zinc-300 rounded-full px-2 py-0.5 capitalize shrink-0">{c.campaignType}</span>
                  </div>
                  <div className="text-zinc-500 text-sm mt-2">{c.onboarded ? `${c.scheduled} posts scheduled` : "Setup not finished"}</div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-accent text-sm font-semibold">{c.onboarded ? "Open →" : "Finish setup →"}</div>
                    <button onClick={(e) => del(c.id, c.name, e)} className="text-xs text-zinc-600 hover:text-red-400" title="Delete campaign">Delete</button>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New campaign type chooser */}
      {picking && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6" onClick={() => !busy && setPicking(false)}>
          <Card className="p-7 w-full max-w-lg" >
            <div onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold">New campaign — what are you launching?</h3>
              <p className="text-zinc-400 text-sm mt-1">This sets the 7-pillar map.</p>
              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                {CAMPAIGN_TYPES.map((t) => (
                  <button key={t.id} disabled={busy} onClick={() => create(t.id)}
                    className="text-left p-5 rounded-xl border border-zinc-800 bg-zinc-800/40 hover:border-lime-400 transition disabled:opacity-50">
                    <div className="font-bold">{t.name}</div>
                    <div className="text-zinc-400 text-sm mt-1">{t.blurb}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => !busy && setPicking(false)} className="text-zinc-500 text-sm mt-5 hover:text-zinc-300">Cancel</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
