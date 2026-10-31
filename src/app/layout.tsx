import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bella-dominoes",
  description: "4-Player Live Block Dominoes Club",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 overflow-hidden">{children}</body>
    </html>
  );
}