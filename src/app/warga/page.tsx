"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function PortalWarga() {
  const router = useRouter();
  const [wargaProfile, setWargaProfile] = useState<{nama: string, hp: string, alamat: string} | null>(null);
  const [globalStatus, setGlobalStatus] = useState<'AMAN' | 'KRITIS'>('AMAN');
  const [pesanStatus, setPesanStatus] = useState('Tidak ada anomali terdeteksi.');
  const [shelterList, setShelterList] = useState<any[]>([]);
  
  const [bantuanData, setBantuanData] = useState<any>(null);
  const [dialog, setDialog] = useState<{
    show: boolean; title: string; message: string; theme: 'red' | 'emerald' | 'cyan'; isProcessing: boolean;
  }>({ show: false, title: '', message: '', theme: 'cyan', isProcessing: false });

  // STATE BARU: Untuk fitur Swipe to SOS
  const [swipeValue, setSwipeValue] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);
  
  useEffect(() => {
    const saved = localStorage.getItem('nexus_warga_profile');
    let profile = null;
    if (saved) {
      profile = JSON.parse(saved);
      setWargaProfile(profile);
    } else {
      router.push('/');
      return;
    }
    const fetchData = async () => {
      const { data: statusData } = await supabase.from('peringatan_dini').select('*').order('id', { ascending: false }).limit(1);
      if (statusData && statusData.length > 0) {
        setGlobalStatus(statusData[0].status_level);
        setPesanStatus(statusData[0].pesan);
      }
      const { data: shelterData } = await supabase.from('master_shelter').select('*');
      if (shelterData) setShelterList(shelterData);
    };
    fetchData();
    const statusChannel = supabase.channel('warga_status')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'peringatan_dini' }, (payload) => {
        setGlobalStatus(payload.new.status_level);
        setPesanStatus(payload.new.pesan);
      }).subscribe();
    const tugasChannel = supabase.channel('warga_tugas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'penugasan_relawan' }, (payload) => {
        if (profile && payload.new.nama_pelapor === profile.nama) {
          setTimeout(() => {
            setBantuanData(payload.new);
            setDialog({ 
              show: true, 
              title: 'UNIT RESCUE DIKERAHKAN!', 
              message: `Tim evakuasi dan medis telah menerima instruksi dan sedang bergerak menuju ke titik GPS Anda saat ini.`, 
              theme: 'cyan', 
              isProcessing: false 
            });
            if (navigator.vibrate) navigator.vibrate([500, 200, 500]); 
          }, 3500); 
        }
      }).subscribe();
    return () => { 
      supabase.removeChannel(statusChannel); 
      supabase.removeChannel(tugasChannel); 
    };
  }, [router]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const generateFallbackLocation = (callback: (lat: number, lon: number) => void) => {
    const fallbackLat = 5.1812 + (Math.random() * 0.005);
    const fallbackLon = 97.1415 + (Math.random() * 0.005);
    callback(fallbackLat, fallbackLon);
  };

  // FUNGSI BARU: Mengontrol geseran slider
  const handleSwipe = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setSwipeValue(value);

    // Jika digeser sampai ujung (lebih dari 95%)
    if (value > 95 && !isTriggered) {
      setIsTriggered(true);
      setSwipeValue(100); // Kunci mentok di kanan
      handleSOS(); // Panggil fungsi database milikmu
    }
  };

  const handleSOS = () => {
    if (!wargaProfile) return;
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setDialog({ show: true, title: 'MEMANCARKAN SINYAL...', message: 'Mencari dan mengunci koordinat satelit...', theme: 'cyan', isProcessing: true });
    
    const executeSOS = async (lat: number, lon: number) => {
      await sleep(1500);
      const { error } = await supabase.from('laporan_darurat').insert([{ 
        latitude: lat, longitude: lon, nama_korban: wargaProfile.nama, kontak_korban: wargaProfile.hp, alamat_korban: wargaProfile.alamat, status: 'darurat'
      }]);
      if (error) {
        setDialog({ show: true, title: 'DATABASE ERROR', message: error.message, theme: 'red', isProcessing: false });
        // Jika gagal, reset slider
        setIsTriggered(false);
        setSwipeValue(0);
      } else {
        setDialog({ show: true, title: 'SOS TERKIRIM (KRITIS)', message: `Sinyal darurat berhasil dipancarkan! Menunggu respons dari Command Center...`, theme: 'red', isProcessing: false });
      }
    };
    
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executeSOS(pos.coords.latitude, pos.coords.longitude),
        (err) => generateFallbackLocation(executeSOS),
        { timeout: 3000 }
      );
    } else {
      generateFallbackLocation(executeSOS);
    }
  };

  const handleAman = () => {
    if (navigator.vibrate) navigator.vibrate(100);
    if (!wargaProfile) return;
    
    // Reset status Slider jika warga melaporkan aman
    setIsTriggered(false);
    setSwipeValue(0);

    setDialog({ show: true, title: 'VERIFIKASI SISTEM...', message: 'Menetapkan lokasi zona aman Anda ke dalam database pusat...', theme: 'cyan', isProcessing: true });
    
    const executeAman = async (lat: number, lon: number) => {
      await sleep(1500); 
      const { error: err1 } = await supabase.from('warga_aman').insert([{ latitude: lat, longitude: lon }]);
      
      const { error: err2 } = await supabase.from('laporan_darurat')
        .update({ status: 'selesai' })
        .eq('nama_korban', wargaProfile.nama);
      
      if (err1 || err2) {
        const errorMsg = err1 ? err1.message : err2?.message;
        setDialog({ show: true, title: 'DATABASE ERROR', message: errorMsg || 'Gagal sinkronisasi data', theme: 'red', isProcessing: false });
      } else {
        setBantuanData(null); 
        setDialog({ show: true, title: 'STATUS AMAN TERKONFIRMASI', message: 'Pusat Komando mencatat Anda di zona aman. Tetap waspada dan ikuti arahan selanjutnya.', theme: 'emerald', isProcessing: false });
      }
    };
    
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executeAman(pos.coords.latitude, pos.coords.longitude),
        (err) => generateFallbackLocation(executeAman),
        { timeout: 3000 }
      );
    } else {
      generateFallbackLocation(executeAman);
    }
  };

  if (!wargaProfile) return null;

  return (
    <main className="min-h-100dvh bg-[#04060c] text-white flex flex-col items-center py-8 px-5 font-mono relative overflow-x-hidden overflow-y-auto">
      
      <div className="w-full flex justify-between items-start z-10">
        <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <p className="text-[9px] text-gray-300 tracking-widest truncate max-w-120px">
            ID: <span className="text-cyan-400 font-bold uppercase">{wargaProfile.nama}</span>
          </p>
        </div>
      </div>

      <div className="text-center mt-2 mb-6 z-10">
        <div className="w-2 h-2 bg-cyan-500 rounded-full mx-auto mb-2 animate-ping"></div>
        <h1 className="text-2xl font-black tracking-widest uppercase">PORTAL <span className="text-cyan-400">SIAGA</span></h1>
        <p className="text-[9px] text-gray-500 tracking-widest mt-1">Layanan Evakuasi Cepat</p>
      </div>
      
      <div className={`w-full max-w-sm rounded-xl p-4 border mb-6 flex flex-col gap-2 transition-colors duration-500 z-10
        ${globalStatus === 'KRITIS' ? 'bg-red-950/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-emerald-950/10 border-emerald-900/50'}`}
      >
        <h2 className={`text-xs font-bold tracking-widest flex items-center gap-2 ${globalStatus === 'KRITIS' ? 'text-red-500' : 'text-emerald-500'}`}>
          {globalStatus === 'KRITIS' ? '🚨 STATUS REGIONAL: KRITIS' : '🛡️ STATUS REGIONAL: AMAN'}
        </h2>
        <p className="text-[10px] text-gray-400 leading-relaxed font-sans">{pesanStatus}</p>
      </div>

      {/* KARTU STATUS PENJEMPUTAN */}
      {bantuanData && (
        <div className="w-full max-w-sm rounded-xl p-4 border border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_30px_rgba(34,211,238,0.2)] mb-8 flex flex-col gap-3 z-10 animate-in zoom-in duration-500">
          <div className="flex justify-between items-center border-b border-cyan-500/30 pb-2">
            <h2 className="text-xs font-bold tracking-widest text-cyan-400 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
              BANTUAN DALAM PERJALANAN
            </h2>
            <span className="text-[8px] bg-cyan-500 text-black font-bold px-2 py-0.5 rounded-full animate-pulse">EN ROUTE</span>
          </div>
          
          <div className="bg-black/50 border border-cyan-900 p-3 rounded-lg flex flex-col gap-3">
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Koordinator Lapangan</p>
              <p className="text-sm font-bold text-white">{bantuanData.nama_petugas}</p>
              <p className="text-[10px] text-cyan-400 font-sans mt-0.5">📞 {bantuanData.kontak_petugas}</p>
            </div>
            
            <div className="border-t border-white/10 pt-3">
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Unit Medis Pendamping</p>
              <p className="text-xs font-bold text-white">Tim Triase Medis (Dr. Raffa & Dr. Aini)</p>
              <p className="text-[10px] text-emerald-400 font-sans mt-0.5 flex items-center gap-1">
                <span>🚑</span> Bergerak menuju koordinat Anda
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AREA TOMBOL SWIPE TO SOS - LUXURY EDITION */}
      <div className="flex flex-col items-center gap-6 mb-12 z-10 w-full mt-2">
        <div className={`relative w-[300px] h-[72px] rounded-full p-1.5 overflow-hidden transition-all duration-500 flex items-center font-sans
          ${isTriggered 
            ? 'bg-red-950/20 border border-red-500/50 shadow-[inset_0_0_30px_rgba(220,38,38,0.15)]' 
            : 'bg-[#06090e] border border-white/5 shadow-[inset_0_8px_20px_rgba(0,0,0,0.9)]'}`}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className={`font-semibold text-xs tracking-[0.25em] transition-all duration-500 ${isTriggered ? 'opacity-0 scale-95' : 'text-gray-600 ml-6'}`}>
              GESER UNTUK SOS
            </span>
            <span className={`absolute font-black text-sm tracking-widest text-red-500 transition-all duration-500 delay-100 ${isTriggered ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>
              🚨 DARURAT AKTIF
            </span>
          </div>

          <div 
            className="absolute left-1.5 top-1.5 bottom-1.5 rounded-full bg-gradient-to-r from-red-600/10 to-red-600/40 z-10 transition-all duration-75"
            style={{ width: isTriggered ? 'calc(100% - 12px)' : `calc(60px + ${(swipeValue / 100) * 228}px)` }}
          />

          <div 
            className={`absolute left-1.5 z-20 h-[60px] w-[60px] rounded-full flex items-center justify-center transition-all duration-75
              ${isTriggered 
                ? 'bg-red-600 border border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.6)]' 
                : 'bg-gradient-to-b from-[#1a2235] to-[#0f1523] border-t border-slate-600/50 shadow-2xl'}`}
            style={{ transform: `translateX(${isTriggered ? 228 : (swipeValue / 100) * 228}px)` }}
          >
            <div className={`transition-all duration-300 ${isTriggered ? 'text-white' : 'text-red-500'}`}>
              {isTriggered ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 drop-shadow-md" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              )}
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={swipeValue}
            onChange={handleSwipe}
            disabled={isTriggered}
            className="absolute z-30 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <button 
          onClick={handleAman} 
          className="relative z-20 px-8 py-2.5 border border-white/10 hover:border-white/30 rounded-full text-[10px] font-bold tracking-[0.2em] text-gray-500 hover:text-gray-300 transition-all cursor-pointer uppercase font-sans mt-2"
        >
          Lapor saya Aman
        </button>
      </div>

      {/* LIVE RADAR POSKO */}
      <div className="w-full max-w-sm flex flex-col gap-3 z-10 mb-6">
        <div className="flex justify-between items-center border-b border-white/10 pb-2">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-300">LIVE RADAR POSKO</h3>
          <span className="text-[8px] bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded-full">SYNC</span>
        </div>
        
        <div className="flex flex-col gap-3">
          {shelterList.map(s => {
            const pct = (s.kapasitas_terisi / s.kapasitas_maksimal) * 100;
            const color = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-500';
            return (
              <div key={s.id_shelter} className="bg-black/30 border border-white/5 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-200 text-[11px]">{s.nama_shelter}</h4>
                  <span className="text-[9px] bg-black/50 text-gray-300 px-1.5 py-0.5 rounded">{s.kapasitas_terisi}/{s.kapasitas_maksimal}</span>
                </div>
                <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }}></div></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KONTAK MEDIS DARURAT */}
      <div className="w-full max-w-sm flex flex-col gap-3 z-10 mb-8">
        <div className="flex justify-between items-center border-b border-white/10 pb-2">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-300">KONTAK MEDIS DARURAT</h3>
          <span className="text-[8px] bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full animate-pulse">24/7</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <a href="tel:119" className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform hover:border-emerald-500/50 cursor-pointer">
            <span className="text-xl mb-1">🚑</span>
            <span className="text-[9px] font-bold text-gray-200 mt-1">AMBULANS / IGD</span>
            <span className="text-[10px] font-mono font-bold text-emerald-400">119</span>
          </a>
          <a href="tel:08112233445" className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform hover:border-emerald-500/50 cursor-pointer">
            <span className="text-xl mb-1">🏥</span>
            <span className="text-[9px] font-bold text-gray-200 mt-1">RS KESDAM</span>
            <span className="text-[10px] font-mono font-bold text-emerald-400">0811-2233-445</span>
          </a>
        </div>
      </div>

      <button onClick={() => { localStorage.removeItem('nexus_warga_profile'); router.push('/'); }} className="z-20 mt-auto text-[9px] text-gray-500 hover:text-red-400 tracking-widest transition-colors cursor-pointer border-b border-transparent hover:border-red-400 pb-0.5 relative">
        HAPUS DATA SAYA (GANTI AKUN)
      </button>

      {globalStatus === 'KRITIS' && <div className="absolute inset-0 bg-red-900/10 animate-pulse pointer-events-none z-0"></div>}

      {/* CUSTOM UI MODAL */}
      {dialog.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`bg-[#0a0a14] border-2 rounded-2xl w-full max-w-xs p-6 shadow-2xl transform transition-all 
            ${dialog.theme === 'red' ? 'border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : 
              dialog.theme === 'emerald' ? 'border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 
              'border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.2)]'}`}
          >
            <h3 className={`text-sm font-black tracking-widest uppercase mb-3 ${dialog.theme === 'red' ? 'text-red-400' : dialog.theme === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'}`}>
              {dialog.title}
            </h3>
            
            <p className="text-xs text-gray-300 leading-relaxed font-sans mb-6">
              {dialog.message}
            </p>

            {dialog.isProcessing ? (
              <div className="flex justify-center mt-4">
                <div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin 
                  ${dialog.theme === 'red' ? 'border-red-500' : dialog.theme === 'emerald' ? 'border-emerald-500' : 'border-cyan-500'}`}>
                </div>
              </div>
            ) : (
              <div className="flex justify-end mt-4">
                <button 
                  onClick={() => setDialog({ ...dialog, show: false })}
                  className={`w-full py-3 rounded-xl text-xs font-bold tracking-widest text-white transition-all shadow-lg cursor-pointer
                    ${dialog.theme === 'red' ? 'bg-red-600 hover:bg-red-500 border border-red-400/50 shadow-red-900/50' : 
                      dialog.theme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 shadow-emerald-900/50' : 
                      'bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/50 shadow-cyan-900/50'}`}
                >
                  MENGERTI
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}