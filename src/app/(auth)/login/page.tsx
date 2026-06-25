"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo, Btn } from "@/components/ui";

export default function Login() {
  const r = useRouter();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const submit = async () => {
    const res = await fetch("/api/auth/login", { method: "POST", body: JSON.stringify(f) });
    if (res.ok) r.push("/dashboard"); else setErr((await res.json()).error || "Error");
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-8 w-full max-w-md">
        <Logo />
        <h2 className="text-2xl font-bold mt-6">Welcome back</h2>
        <div className="space-y-3 mt-6">
          <input placeholder="Email" className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime-400" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input type="password" placeholder="Password" className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime-400" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        {err && <div className="text-red-400 text-sm mt-3">{err}</div>}
        <Btn onClick={submit} className="w-full mt-5 py-3">Log in</Btn>
        <div className="text-center text-sm text-zinc-400 mt-4">New here? <a href="/signup" className="text-accent font-semibold">Sign up</a></div>
      </div>
    </div>
  );
}
