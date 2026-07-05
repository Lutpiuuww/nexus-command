"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccessGateway() {
  const router = useRouter();
  const [view, setView] = useState<'MENU' | 'REGISTER_WARGA' | 'LOGIN_STAFF'>('MENU');
  const [selectedRole, setSelectedRole] = useState<{name: string, path: string, theme: string, icon: string} | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [wargaForm, setWargaForm] = useState({ nama: '', hp: '', alamat: '' });

  const roles = [
    { id: 'warga', name: 'PORTAL WARGA', desc: 'Akses publik & darurat', path: '/warga', theme: 'cyan', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'pusat', name: 'COMMAND CENTER', desc: 'Pusat radar utama', path: '/dashboard', theme: 'indigo', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
    { id: 'medis', name: 'TIM MEDIS', desc: 'Triase & pantauan', path: '/medis', theme: 'emerald', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { id: 'koordinator', name: 'KOORD. LAPANGAN', desc: 'Manajemen relawan', path: '/lapangan', theme: 'red', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
  ];

  const handleRoleSelect = (role: any) => {
    if (role.id === 'warga') {
      const savedProfile = localStorage.getItem('nexus_warga_profile');
      if (savedProfile) router.push(role.path);
      else setView('REGISTER_WARGA');
    } else {
      setSelectedRole(role);
      setView('LOGIN_STAFF');
      setErrorMsg("");
      setPinInput("");
    }
  };

  const handleStaffLogin = () => {
    if (pinInput === "1234") router.push(selectedRole!.path);
    else setErrorMsg("Otorisasi ditolak. PIN salah.");
  };

  const handleWargaRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wargaForm.nama || !wargaForm.hp) return;
    localStorage.setItem('nexus_warga_profile', JSON.stringify(wargaForm));
    router.push('/warga');
  };

  return (
    // PERBAIKAN: Mengganti min-h-screen dengan min-h-[100dvh], overflow-x-hidden, dan overflow-y-auto
    <main className="min-h-[100dvh] bg-[#04040a] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-mono relative overflow-x-hidden overflow-y-auto py-10">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] bg-cyan-900/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="z-10 w-full max-w-4xl flex flex-col items-center my-auto">
        
        {/* HEADER */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 mt-4">
          <div className="flex justify-center gap-2 sm:gap-3 mb-3">
             <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 animate-pulse"></div>
             <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-cyan-500 animate-pulse delay-75"></div>
             <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 animate-pulse delay-150"></div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[0.2em] sm:tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 mb-2">
            NEXUS <span className="text-cyan-400">COMMAND</span>
          </h1>
          <p className="text-[10px] sm:text-xs text-gray-400 tracking-widest uppercase px-4">Sistem Informasi Mitigasi & Evakuasi</p>
        </div>

        {/* LAYAR 1: MENU (Grid diubah jadi responsif) */}
        {view === 'MENU' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl animate-in zoom-in-95 duration-500 pb-8">
            {roles.map((role) => (
              <button key={role.id} onClick={() => handleRoleSelect(role)} className={`group relative overflow-hidden bg-white/5 border border-white/10 hover:border-${role.theme}-500/50 rounded-2xl p-5 sm:p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] active:scale-95`}>
                <div className={`absolute inset-0 bg-gradient-to-br from-${role.theme}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                <div className="flex items-center gap-4 sm:block">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center sm:mb-4 group-hover:border-${role.theme}-400 transition-colors shrink-0`}>
                    <svg className={`w-5 h-5 sm:w-6 sm:h-6 text-${role.theme}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={role.icon}></path></svg>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-lg font-bold tracking-widest text-white mb-0.5 sm:mb-1">{role.name}</h3>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-sans">{role.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* LAYAR 2: REGISTER WARGA (Touch-Friendly Input) */}
        {view === 'REGISTER_WARGA' && (
          <form onSubmit={handleWargaRegister} className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl animate-in slide-in-from-right-12 duration-500 shadow-2xl mb-8">
            <h2 className="text-lg sm:text-xl font-bold tracking-widest text-cyan-400 mb-2">REGISTRASI WARGA</h2>
            <p className="text-[10px] sm:text-xs text-gray-400 font-sans mb-6">Data ini akan mempercepat proses identifikasi dan evakuasi Anda saat kondisi darurat.</p>
            
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-[9px] sm:text-[10px] text-gray-400 tracking-widest mb-1.5 uppercase">Nama Lengkap</label>
                <input required type="text" value={wargaForm.nama} onChange={e => setWargaForm({...wargaForm, nama: e.target.value})} placeholder="Contoh: Budi Santoso" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors" />
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] text-gray-400 tracking-widest mb-1.5 uppercase">Nomor HP (Aktif)</label>
                <input required type="tel" value={wargaForm.hp} onChange={e => setWargaForm({...wargaForm, hp: e.target.value})} placeholder="08..." className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors" />
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] text-gray-400 tracking-widest mb-1.5 uppercase">Alamat Domisili</label>
                <textarea required value={wargaForm.alamat} onChange={e => setWargaForm({...wargaForm, alamat: e.target.value})} placeholder="Kecamatan, Kelurahan..." className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors resize-none h-20" />
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button type="button" onClick={() => setView('MENU')} className="px-4 sm:px-6 py-3 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] sm:text-xs font-bold tracking-widest text-gray-400 transition-colors">KEMBALI</button>
              <button type="submit" className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/50 rounded-xl text-[10px] sm:text-xs font-bold tracking-widest text-white transition-all shadow-lg shadow-cyan-900/50">SIMPAN & MASUK</button>
            </div>
          </form>
        )}

        {/* LAYAR 3: LOGIN STAFF */}
        {view === 'LOGIN_STAFF' && (
          <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl animate-in slide-in-from-left-12 duration-500 shadow-2xl mb-8">
            <div className="flex items-center gap-3 sm:gap-4 mb-6 border-b border-white/10 pb-5">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-${selectedRole?.theme}-900/30 border border-${selectedRole?.theme}-500/30 flex items-center justify-center shrink-0`}>
                <svg className={`w-6 h-6 sm:w-7 sm:h-7 text-${selectedRole?.theme}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={selectedRole?.icon || ''}></path></svg>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-widest text-white uppercase">{selectedRole?.name}</h2>
                <span className={`text-[9px] sm:text-[10px] text-${selectedRole?.theme}-400 tracking-wider`}>SECURITY CLEARANCE REQUIRED</span>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-[9px] sm:text-[10px] text-gray-400 tracking-widest mb-3 uppercase text-center">Masukkan PIN Otorisasi</label>
              <input 
                type="tel" // Berubah jadi "tel" agar numpad angka otomatis muncul di HP
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                className={`w-full bg-black/60 border ${errorMsg ? 'border-red-500' : 'border-white/20'} rounded-2xl px-4 py-3 sm:py-4 text-white text-center tracking-[0.5em] sm:tracking-[1em] text-xl sm:text-2xl focus:outline-none focus:border-${selectedRole?.theme}-400 transition-colors shadow-inner`}
                maxLength={4}
                placeholder="••••"
                autoFocus
              />
              {errorMsg && <p className="text-[10px] text-red-400 mt-3 tracking-wider text-center animate-pulse">{errorMsg}</p>}
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button onClick={() => setView('MENU')} className="px-4 sm:px-6 py-3 sm:py-4 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] sm:text-xs font-bold tracking-widest text-gray-400 transition-colors">KEMBALI</button>
              <button onClick={handleStaffLogin} className={`flex-1 py-3 sm:py-4 border border-${selectedRole?.theme}-500/50 bg-${selectedRole?.theme}-600/20 hover:bg-${selectedRole?.theme}-600/40 rounded-xl text-[10px] sm:text-xs font-bold tracking-widest text-${selectedRole?.theme}-400 transition-colors`}>AKSES SISTEM</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}