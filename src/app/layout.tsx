import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Uzi — One input. Every channel. On repeat.",
  description: "The content machine. Connect inputs, set your content pillars, ship every channel automatically.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
