"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState("admin");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulasi loading 1.5 detik
    setTimeout(() => {
  router.push("/dashboard"); // Mengarahkan admin ke ruang komando
}, 1500);
  };

  return (
    <main className="h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Efek Cahaya Latar Belakang */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Indikator Keamanan Sistem (Kiri Bawah) */}
      <div className="absolute bottom-6 left-6 flex items-center gap-2 text-xs font-mono text-emerald-500/70 pointer-events-none">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        SECURE CONNECTION: AES-256 ENCRYPTED
      </div>

      {/* Panel Kaca Login */}
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 z-10 shadow-2xl shadow-cyan-900/20 border border-white/10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-widest text-white mb-2">COMMAND <span className="text-cyan-400">CENTER</span></h1>
          <p className="text-sm text-gray-400 tracking-widest uppercase">Portal Mitigasi Bencana</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          
          {/* Input: Hak Akses */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-cyan-500 tracking-widest font-semibold">OTORITAS AKSES</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all appearance-none cursor-pointer"
            >
              <option value="admin">Admin Pusat Komando</option>
              <option value="relawan">Kordinator Relawan</option>
              <option value="medis">Tim Medis Darurat</option>
            </select>
          </div>

          {/* Input: ID Petugas */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-cyan-500 tracking-widest font-semibold">ID PETUGAS</label>
            <input 
              type="text" 
              required
              placeholder="Masukkan ID..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-gray-600"
            />
          </div>

          {/* Input: Password */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-cyan-500 tracking-widest font-semibold">KATA SANDI SECURE</label>
            <input 
              type="password" 
              required
              placeholder="••••••••"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-gray-600"
            />
          </div>

          {/* Opsi Tambahan: Remember Me & Forgot Password */}
          <div className="flex justify-between items-center mt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-gray-600 text-cyan-500 bg-black/50 focus:ring-cyan-500 focus:ring-offset-gray-900" />
              <span className="text-xs text-gray-400 group-hover:text-cyan-300 transition-colors">Tahan Sesi Login</span>
            </label>
            <button type="button" className="text-xs text-gray-400 hover:text-red-400 transition-colors border-b border-transparent hover:border-red-400">
              Lupa Sandi Darurat?
            </button>
          </div>

          {/* Tombol Eksekusi */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full mt-4 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold tracking-widest transition-all shadow-lg shadow-cyan-900/50 flex items-center justify-center border border-cyan-400/30"
          >
            {isLoading ? (
              <span className="animate-pulse">MEMVERIFIKASI...</span>
            ) : (
              "OTORISASI AKSES"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}