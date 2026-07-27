"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NexusGateway() {
  const router = useRouter();
  const [showWargaModal, setShowWargaModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({ nama: '', hp: '', alamat: '', password: '' });
  const [dialog, setDialog] = useState<{ show: boolean; title: string; message: string; theme: 'red' | 'emerald' | 'sky' }>({ show: false, title: '', message: '', theme: 'sky' });

  useEffect(() => {
    const saved = localStorage.getItem('nexus_warga_profile');
    if (saved) {
      const profile = JSON.parse(saved);
      setFormData({ nama: profile.nama || '', hp: profile.hp || '', alamat: profile.alamat || '', password: '' });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      if (authMode === 'register') {
        const { error } = await supabase.from('profil_warga').insert([{ nama: formData.nama, no_hp: formData.hp, alamat: formData.alamat, kata_sandi: formData.password }]);
        if (error) {
          if (error.code === '23505') {
            setDialog({ show: true, title: 'REGISTRASI GAGAL', message: 'Nomor HP ini sudah terdaftar di sistem. Silakan gunakan menu LOGIN.', theme: 'red' });
            setIsProcessing(false); return; 
          }
          throw error;
        }
        localStorage.setItem('nexus_warga_profile', JSON.stringify({ nama: formData.nama, hp: formData.hp, alamat: formData.alamat }));
        setDialog({ show: true, title: 'REGISTRASI BERHASIL', message: 'Akun Anda berhasil dibuat. Mengalihkan ke Portal Siaga...', theme: 'emerald' });
        setTimeout(() => router.push('/warga'), 2000);
      } else {
        const { data, error } = await supabase.from('profil_warga').select('*').eq('no_hp', formData.hp).eq('kata_sandi', formData.password).maybeSingle();
        if (error) throw error;
        if (!data) {
          setDialog({ show: true, title: 'LOGIN GAGAL', message: 'Nomor HP atau Kata Sandi salah. Silakan periksa kembali.', theme: 'red' });
          setIsProcessing(false); return;
        }
        localStorage.setItem('nexus_warga_profile', JSON.stringify({ nama: data.nama, hp: data.no_hp, alamat: data.alamat }));
        setDialog({ show: true, title: 'LOGIN BERHASIL', message: `Selamat datang kembali, ${data.nama}. Mengalihkan ke Portal...`, theme: 'sky' });
        setTimeout(() => router.push('/warga'), 2000);
      }
    } catch (error: any) {
      setDialog({ show: true, title: 'KONEKSI GAGAL', message: error.message || 'Terjadi kesalahan server.', theme: 'red' });
      setIsProcessing(false);
    }
  };

  const resetForm = () => setFormData({ nama: '', hp: '', alamat: '', password: '' });

  return (
    <main className="min-h-100dvh bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-6 relative overflow-hidden">
      {/* Semi-Dark Premium Background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 z-0"></div>
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-sky-900/10 blur-[120px] rounded-full z-0 pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[120px] rounded-full z-0 pointer-events-none"></div>

      <div className="w-full max-w-4xl relative z-10 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.3)] flex items-center justify-center border border-slate-800">
              <div className="w-4 h-4 bg-sky-500 rounded-full animate-ping absolute opacity-40"></div>
              <div className="w-4 h-4 bg-gradient-to-br from-sky-400 to-blue-600 rounded-full relative z-10 shadow-lg"></div>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-[0.25em] uppercase text-white mb-2 drop-shadow-sm">
            NEXUS <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">CENTRAL</span>
          </h1>
          <p className="text-[11px] md:text-xs text-slate-400 font-medium tracking-[0.2em] uppercase">Sistem Manajemen Evakuasi Terpadu</p>
        </div>

        {/* Pilihan Portal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl">
          
          <button onClick={() => { setShowWargaModal(true); setAuthMode('login'); }} className="group relative bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-sky-500/50 hover:bg-slate-800/80 rounded-3xl p-6 text-left transition-all duration-300 shadow-sm hover:shadow-[0_10px_30px_rgba(14,165,233,0.1)] cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-bl-full pointer-events-none group-hover:bg-sky-500/10 transition-all"></div>
            <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-sky-400 mb-5 group-hover:scale-110 transition-transform shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <h2 className="text-sm font-black tracking-widest text-slate-100 mb-1.5 uppercase">Portal Warga</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Akses layanan darurat, lapor SOS, dan panduan evakuasi wilayah.</p>
          </button>

          <button onClick={() => router.push('/medis')} className="group relative bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-emerald-500/50 hover:bg-slate-800/80 rounded-3xl p-6 text-left transition-all duration-300 shadow-sm hover:shadow-[0_10px_30px_rgba(16,185,129,0.1)] cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:bg-emerald-500/10 transition-all"></div>
            <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
            <h2 className="text-sm font-black tracking-widest text-slate-100 mb-1.5 uppercase">Unit Medis</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Akses khusus tim kesehatan untuk triase dan pengerahan ambulans.</p>
          </button>

          <button onClick={() => router.push('/lapangan')} className="group relative bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800/80 rounded-3xl p-6 text-left transition-all duration-300 shadow-sm hover:shadow-[0_10px_30px_rgba(245,158,11,0.1)] cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:bg-amber-500/10 transition-all"></div>
            <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h2 className="text-sm font-black tracking-widest text-slate-100 mb-1.5 uppercase">Ops Lapangan</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Akses koordinator relawan untuk manajemen pergerakan evakuasi.</p>
          </button>

          <button onClick={() => router.push('/dashboard')} className="group relative bg-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-violet-500/50 hover:bg-slate-800/80 rounded-3xl p-6 text-left transition-all duration-300 shadow-sm hover:shadow-[0_10px_30px_rgba(139,92,246,0.1)] cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-bl-full pointer-events-none group-hover:bg-violet-500/10 transition-all"></div>
            <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-violet-400 mb-5 group-hover:scale-110 transition-transform shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-sm font-black tracking-widest text-slate-100 mb-1.5 uppercase">Command Center</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Akses otoritas tertinggi untuk pemantauan radar & sirine massal.</p>
          </button>

        </div>
      </div>

      {/* MODAL REGISTRASI & LOGIN WARGA */}
      {showWargaModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl relative">
            <div className="p-7">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black tracking-widest text-sky-400 uppercase">IDENTIFIKASI WARGA</h3>
                <button onClick={() => { setShowWargaModal(false); resetForm(); }} className="text-slate-500 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors text-sm">✕</button>
              </div>

              <div className="flex bg-slate-950 border border-slate-800 rounded-2xl p-1.5 mb-6 shadow-inner">
                <button type="button" onClick={() => { setAuthMode('login'); resetForm(); }} className={`flex-1 py-2.5 text-[10px] font-bold tracking-widest rounded-xl transition-all ${authMode === 'login' ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>LOGIN</button>
                <button type="button" onClick={() => { setAuthMode('register'); resetForm(); }} className={`flex-1 py-2.5 text-[10px] font-bold tracking-widest rounded-xl transition-all ${authMode === 'register' ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>REGISTRASI</button>
              </div>
              
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">
                {authMode === 'register' && (
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1.5 block">Nama Lengkap</label>
                    <input required type="text" value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500/50 focus:bg-slate-900 transition-colors shadow-inner" placeholder="Masukkan nama..." />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1.5 block">Nomor HP Aktif</label>
                  <input required type="tel" value={formData.hp} onChange={(e) => setFormData({...formData, hp: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500/50 focus:bg-slate-900 transition-colors shadow-inner" placeholder="Contoh: 081234567890" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1.5 block">Kata Sandi</label>
                  <input required type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500/50 focus:bg-slate-900 transition-colors shadow-inner" placeholder="••••••••" />
                </div>
                {authMode === 'register' && (
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1.5 block">Alamat Domisili</label>
                    <textarea required value={formData.alamat} onChange={(e) => setFormData({...formData, alamat: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500/50 focus:bg-slate-900 transition-colors resize-none h-20 shadow-inner custom-scrollbar" placeholder="Alamat tinggal saat ini..." />
                  </div>
                )}
                
                <button type="submit" disabled={isProcessing} className="w-full mt-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-[11px] font-black tracking-widest rounded-2xl transition-all shadow-[0_8px_20px_rgba(14,165,233,0.2)] cursor-pointer flex justify-center items-center h-[52px]">
                  {isProcessing ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : (authMode === 'login' ? "MASUK PORTAL" : "BUAT AKUN BARU")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG POP-UP */}
      {dialog.show && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-xs p-7 shadow-2xl transform transition-all text-center">
             <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${dialog.theme === 'red' ? 'bg-rose-950/50 text-rose-500 border border-rose-900' : dialog.theme === 'emerald' ? 'bg-emerald-950/50 text-emerald-500 border border-emerald-900' : 'bg-sky-950/50 text-sky-400 border border-sky-900'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className={`text-sm font-black tracking-widest uppercase mb-2 ${dialog.theme === 'red' ? 'text-rose-500' : dialog.theme === 'emerald' ? 'text-emerald-500' : 'text-sky-400'}`}>{dialog.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium mb-6">{dialog.message}</p>
            <div className="flex justify-center mt-4">
              <button onClick={() => setDialog({ ...dialog, show: false })} className={`w-full py-4 rounded-2xl text-[11px] font-black tracking-widest text-white transition-all shadow-md cursor-pointer ${dialog.theme === 'red' ? 'bg-rose-600 hover:bg-rose-500' : dialog.theme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'}`}>MENGERTI</button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; } `}</style>
    </main>
  );
}