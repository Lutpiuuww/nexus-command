"use client";
import { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';

// INI DIA BARIS SAKTI YANG KEMBALI MENGAKTIFKAN TAILWIND CSS-MU! 🔥
import "./globals.css"; 

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }, []);

  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <body className="bg-[#050505] text-white">
        {children}
      </body>
    </html>
  );
}