"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo, Btn } from "@/components/ui";

export default function Signup() {
  const r = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const submit = async () => {
    const res = await fetch("/api/auth/signup", { method: "POST", body: JSON.stringify(f) });
    if (res.ok) r.push("/dashboard"); else setErr((await res.json()).error || "Error");
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-8 w-full max-w-md">
        <Logo />
        <h2 className="text-2xl font-bold mt-6">Create your account</h2>
        <p className="text-zinc-400 text-sm mt-1">Spin up your content machine in minutes.</p>
        <div className="space-y-3 mt-6">
          {["name:Your name", "email:Email", "password:Password"].map((s) => {
            const [k, ph] = s.split(":");
            return <input key={k} type={k === "password" ? "password" : "text"} placeholder={ph}
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime-400"
              value={(f as any)[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
          })}
        </div>
        {err && <div className="text-red-400 text-sm mt-3">{err}</div>}
        <Btn onClick={submit} className="w-full mt-5 py-3">Create account</Btn>
        <div className="text-center text-sm text-zinc-400 mt-4">Already have an account? <a href="/login" className="text-accent font-semibold">Log in</a></div>
      </div>
    </div>
  );
}
