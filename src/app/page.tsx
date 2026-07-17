"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NexusGateway() {
  const router = useRouter();
  const [showWargaModal, setShowWargaModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login'); // STATE BARU: Mode Login atau Registrasi
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Menambahkan field kata_sandi
  const [formData, setFormData] = useState({ nama: '', hp: '', alamat: '', password: '' });
  const [dialog, setDialog] = useState<{ show: boolean; title: string; message: string; theme: 'red' | 'emerald' | 'cyan' }>({ show: false, title: '', message: '', theme: 'cyan' });

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
        // --- LOGIKA REGISTRASI BARU ---
        const { error } = await supabase.from('profil_warga').insert([
          { nama: formData.nama, no_hp: formData.hp, alamat: formData.alamat, kata_sandi: formData.password }
        ]);

        if (error) {
          if (error.code === '23505') { // Error Duplikat Nomor HP
            setDialog({ 
              show: true, title: 'REGISTRASI GAGAL', 
              message: 'Nomor HP ini sudah terdaftar di sistem. Silakan gunakan menu LOGIN jika Anda sudah memiliki akun.', theme: 'red' 
            });
            setIsProcessing(false);
            return; 
          }
          throw error;
        }

        localStorage.setItem('nexus_warga_profile', JSON.stringify({ nama: formData.nama, hp: formData.hp, alamat: formData.alamat }));
        setDialog({ show: true, title: 'REGISTRASI BERHASIL', message: 'Akun Anda berhasil dibuat. Mengalihkan ke Portal Siaga...', theme: 'emerald' });
        
        setTimeout(() => router.push('/warga'), 2000);

      } else {
        // --- LOGIKA LOGIN (SUDAH PUNYA AKUN) ---
        const { data, error } = await supabase.from('profil_warga')
          .select('*')
          .eq('no_hp', formData.hp)
          .eq('kata_sandi', formData.password)
          .maybeSingle();

        if (error) throw error;

        // Jika data tidak ditemukan (No HP atau Password salah)
        if (!data) {
          setDialog({ 
            show: true, title: 'LOGIN GAGAL', 
            message: 'Nomor HP atau Kata Sandi yang Anda masukkan salah. Silakan periksa kembali.', theme: 'red' 
          });
          setIsProcessing(false);
          return;
        }

        // Jika berhasil Login
        localStorage.setItem('nexus_warga_profile', JSON.stringify({ nama: data.nama, hp: data.no_hp, alamat: data.alamat }));
        setDialog({ show: true, title: 'LOGIN BERHASIL', message: `Selamat datang kembali, ${data.nama}. Mengalihkan ke Portal...`, theme: 'cyan' });
        
        setTimeout(() => router.push('/warga'), 2000);
      }
    } catch (error: any) {
      setDialog({ show: true, title: 'KONEKSI GAGAL', message: error.message || 'Terjadi kesalahan server.', theme: 'red' });
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFormData({ nama: '', hp: '', alamat: '', password: '' });
  };

  return (
    <main className="min-h-100dvh bg-[#04060c] text-white font-mono flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Ornamen */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(34,211,238,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full z-0 pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[120px] rounded-full z-0 pointer-events-none"></div>

      <div className="w-full max-w-4xl relative z-10 flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping"></div>
            <div className="w-3 h-3 bg-cyan-500 rounded-full shadow-[0_0_15px_#22d3ee] absolute"></div>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-[0.3em] uppercase text-white mb-2">
            NEXUS <span className="text-cyan-400">CENTRAL</span>
          </h1>
          <p className="text-xs md:text-sm text-gray-500 tracking-[0.2em] uppercase">Sistem Manajemen Evakuasi Terpadu</p>
        </div>

        {/* Pilihan Portal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          
          <button onClick={() => { setShowWargaModal(true); setAuthMode('login'); }} className="group relative bg-[#0a0f18] border border-cyan-900/50 hover:border-cyan-400 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-bl-full blur-xl group-hover:bg-cyan-500/20 transition-all"></div>
            <div className="w-12 h-12 bg-cyan-950/50 border border-cyan-500/50 rounded-xl flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <h2 className="text-lg font-black tracking-widest text-white mb-1">PORTAL WARGA</h2>
            <p className="text-[10px] text-gray-400 tracking-wider">Akses layanan darurat, lapor SOS, dan panduan evakuasi wilayah.</p>
          </button>

          <button onClick={() => router.push('/medis')} className="group relative bg-[#0a0f18] border border-emerald-900/50 hover:border-emerald-400 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
            <div className="w-12 h-12 bg-emerald-950/50 border border-emerald-500/50 rounded-xl flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
            <h2 className="text-lg font-black tracking-widest text-white mb-1">UNIT MEDIS</h2>
            <p className="text-[10px] text-gray-400 tracking-wider">Akses khusus tim kesehatan untuk triase dan pengerahan ambulans.</p>
          </button>

          <button onClick={() => router.push('/lapangan')} className="group relative bg-[#0a0f18] border border-amber-900/50 hover:border-amber-400 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
            <div className="w-12 h-12 bg-amber-950/50 border border-amber-500/50 rounded-xl flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h2 className="text-lg font-black tracking-widest text-white mb-1">OPS LAPANGAN</h2>
            <p className="text-[10px] text-gray-400 tracking-wider">Akses koordinator relawan untuk manajemen pergerakan evakuasi.</p>
          </button>

          <button onClick={() => router.push('/dashboard')} className="group relative bg-[#0a0f18] border border-purple-900/50 hover:border-purple-400 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full blur-xl group-hover:bg-purple-500/20 transition-all"></div>
            <div className="w-12 h-12 bg-purple-950/50 border border-purple-500/50 rounded-xl flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-lg font-black tracking-widest text-white mb-1">COMMAND CENTER</h2>
            <p className="text-[10px] text-gray-400 tracking-wider">Akses otoritas tertinggi untuk pemantauan radar & sirine massal.</p>
          </button>

        </div>
      </div>

      {/* MODAL REGISTRASI & LOGIN WARGA */}
      {showWargaModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0a0a14] border border-cyan-500/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.15)] relative">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black tracking-widest text-cyan-400 uppercase">IDENTIFIKASI WARGA</h3>
                <button onClick={() => { setShowWargaModal(false); resetForm(); }} className="text-gray-500 hover:text-white cursor-pointer transition-colors text-lg">✕</button>
              </div>

              {/* Toggle Menu Login / Register */}
              <div className="flex bg-black/50 border border-white/5 rounded-xl p-1 mb-6">
                <button 
                  type="button"
                  onClick={() => { setAuthMode('login'); resetForm(); }}
                  className={`flex-1 py-2 text-[10px] font-bold tracking-widest rounded-lg transition-all ${authMode === 'login' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
                >
                  LOGIN
                </button>
                <button 
                  type="button"
                  onClick={() => { setAuthMode('register'); resetForm(); }}
                  className={`flex-1 py-2 text-[10px] font-bold tracking-widest rounded-lg transition-all ${authMode === 'register' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
                >
                  REGISTRASI
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">
                {/* Field Nama hanya muncul saat Registrasi */}
                {authMode === 'register' && (
                  <div>
                    <label className="text-[10px] text-gray-400 tracking-widest uppercase mb-1.5 block">Nama Lengkap</label>
                    <input required type="text" value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors" placeholder="Masukkan nama Anda..." />
                  </div>
                )}
                
                {/* Field HP muncul di keduanya */}
                <div>
                  <label className="text-[10px] text-gray-400 tracking-widest uppercase mb-1.5 block">Nomor HP Aktif</label>
                  <input required type="tel" value={formData.hp} onChange={(e) => setFormData({...formData, hp: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors" placeholder="Contoh: 081234567890" />
                </div>

                {/* Field Kata Sandi muncul di keduanya */}
                <div>
                  <label className="text-[10px] text-gray-400 tracking-widest uppercase mb-1.5 block">Kata Sandi</label>
                  <input required type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors" placeholder="••••••••" />
                </div>

                {/* Field Alamat hanya muncul saat Registrasi */}
                {authMode === 'register' && (
                  <div>
                    <label className="text-[10px] text-gray-400 tracking-widest uppercase mb-1.5 block">Alamat Domisili</label>
                    <textarea required value={formData.alamat} onChange={(e) => setFormData({...formData, alamat: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none h-20 custom-scrollbar" placeholder="Alamat tempat tinggal saat ini..." />
                  </div>
                )}
                
                <button type="submit" disabled={isProcessing} className="w-full py-4 mt-2 bg-cyan-600/90 hover:bg-cyan-500 text-white text-[11px] font-black tracking-[0.3em] rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)] border border-cyan-400/50 cursor-pointer flex justify-center items-center h-[52px]">
                  {isProcessing ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : (authMode === 'login' ? "MASUK PORTAL" : "BUAT AKUN BARU")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG POP-UP (SUKSES & GAGAL) */}
      {dialog.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`bg-[#0a0a14] border-2 rounded-2xl w-full max-w-sm p-6 shadow-2xl transform transition-all ${dialog.theme === 'red' ? 'border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : dialog.theme === 'emerald' ? 'border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.2)]'}`}>
            <h3 className={`text-sm font-black tracking-widest uppercase mb-3 ${dialog.theme === 'red' ? 'text-red-400' : dialog.theme === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'}`}>{dialog.title}</h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans mb-6">{dialog.message}</p>
            <div className="flex justify-end mt-4">
              <button onClick={() => setDialog({ ...dialog, show: false })} className={`w-full py-3 rounded-xl text-xs font-bold tracking-widest text-white transition-all shadow-lg cursor-pointer ${dialog.theme === 'red' ? 'bg-red-600 hover:bg-red-500 border-red-400/50' : dialog.theme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50' : 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400/50'}`}>MENGERTI</button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34,211,238,0.3); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34,211,238,0.6); } `}</style>
    </main>
  );
}