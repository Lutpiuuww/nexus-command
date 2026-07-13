import type { Metadata, Viewport } from "next";
import SmoothScroll from "./SmoothScroll";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Command Center",
  description: "Sistem Mitigasi Bencana",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#04060c", // 👈 Ubah dari cyan ke warna background gelap
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased"> 
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}