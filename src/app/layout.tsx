import type { Metadata, Viewport } from "next";
import SmoothScroll from "./SmoothScroll";
import "./globals.css"; 

export const metadata: Metadata = {
  title: "Nexus Command Center",
  description: "Sistem Mitigasi Bencana",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#22d3ee",
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