"use client";
import Link from "next/link";
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2 font-black tracking-tight" style={{ fontSize: size }}>
      <span className="bg-accent text-zinc-950 rounded-lg px-2 py-1 leading-none">UZI</span>
      <span className="text-zinc-500 text-xs font-medium hidden sm:block">content machine</span>
    </div>
  );
}
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" | "soft" };
export function Btn({ kind = "primary", className = "", ...p }: BtnProps) {
  const base = "px-5 py-2.5 rounded-xl font-semibold text-sm transition active:scale-[.98] disabled:opacity-50";
  const kinds: Record<string, string> = {
    primary: "bg-accent text-zinc-950 hover:brightness-110",
    ghost: "bg-zinc-900 text-zinc-200 border border-zinc-800 hover:border-zinc-600",
    soft: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
  };
  return <button className={`${base} ${kinds[kind]} ${className}`} {...p} />;
}
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-zinc-900/70 border border-zinc-800 rounded-2xl ${className}`}>{children}</div>;
}
export { Link };
