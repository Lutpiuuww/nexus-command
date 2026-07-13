"use client";
import { useState, useEffect, useRef } from "react";
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

  const [swipeValue, setSwipeValue] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);

  const [amanSwipeValue, setAmanSwipeValue] = useState(0);
  const [isAmanTriggered, setIsAmanTriggered] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'scanning' | 'verified' | 'rejected'>('idle');

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
      try {
        const { data: statusData, error: statusErr } = await supabase.from('peringatan_dini').select('*').order('id', { ascending: false }).limit(1);
        if (statusErr) throw statusErr; 
        
        if (statusData && statusData.length > 0) {
          setGlobalStatus(statusData[0].status_level);
          setPesanStatus(statusData[0].pesan);
        }

        const { data: shelterData, error: shelterErr } = await supabase.from('master_shelter').select('*');
        if (shelterErr) throw shelterErr; 
        if (shelterData) setShelterList(shelterData);
      } catch (error) {
        console.warn("⚠️ SUPABASE DOWN: Mengaktifkan Mode Offline Simulasi");
        setGlobalStatus('AMAN');
        setPesanStatus('Tidak ada anomali terdeteksi (Sistem Berjalan di Mode Offline).');
        setShelterList([
          { id_shelter: 1, nama_shelter: "RS Kesdam Lhokseumawe", kapasitas_terisi: 120, kapasitas_maksimal: 500 },
          { id_shelter: 2, nama_shelter: "Masjid Islamic Center", kapasitas_terisi: 750, kapasitas_maksimal: 1000 },
          { id_shelter: 3, nama_shelter: "Stadion Tunas Bangsa", kapasitas_terisi: 1950, kapasitas_maksimal: 2000 }
        ]);
      }
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
              show: true, title: 'UNIT RESCUE DIKERAHKAN!', 
              message: `Tim evakuasi atau bantuan medis sedang bergerak ke titik GPS Anda.`, theme: 'cyan', isProcessing: false 
            });
            if (navigator.vibrate) navigator.vibrate([500, 200, 500]); 
          }, 3500); 
        }
      }).subscribe();

    return () => { supabase.removeChannel(statusChannel); supabase.removeChannel(tugasChannel); };
  }, [router]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const generateFallbackLocation = (callback: (lat: number, lon: number) => void) => {
    const fallbackLat = 5.1812 + (Math.random() * 0.005);
    const fallbackLon = 97.1415 + (Math.random() * 0.005);
    callback(fallbackLat, fallbackLon);
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_warga_profile');
    router.push('/');
  };

  const handleSwipe = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setSwipeValue(value);
    if (value > 95 && !isTriggered) {
      setIsTriggered(true);
      setSwipeValue(100);
      if (cameraInputRef.current) cameraInputRef.current.click();
    }
  };

  const handleAmanSwipe = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setAmanSwipeValue(value);
    if (value > 95 && !isAmanTriggered) {
      setIsAmanTriggered(true);
      setAmanSwipeValue(100);
      handleAman(); 
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      resetSlider();
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    setPhotoPreview(imageUrl);
    processAIVision(file);
  };

  const processAIVision = async (file: File) => {
    setAiStatus('scanning');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch('/api/vision-scan', { method: 'POST', body: formData });

      if (!response.ok) throw new Error("Gagal menghubungi server AI");

      const data = await response.json();
      const isPrank = data.status === "PRANK";

      if (isPrank) {
        setAiStatus('rejected');
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
        setTimeout(() => {
          setDialog({ show: true, title: 'VERIFIKASI AI GAGAL (PRANK)', message: 'Sistem AI mendeteksi gambar tidak relevan dengan situasi darurat.', theme: 'red', isProcessing: false });
          resetSlider();
        }, 3000);
      } else {
        setAiStatus('verified');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `sos-${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('emergency_photos').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data: publicUrlData } = supabase.storage.from('emergency_photos').getPublicUrl(fileName);
          
          setTimeout(() => { handleSOS(publicUrlData.publicUrl); }, 1500);
        } catch (uploadErr) {
          setTimeout(() => { handleSOS(null); }, 1500);
        }
      }
    } catch (error) {
      setAiStatus('rejected');
      setDialog({ show: true, title: 'KONEKSI AI GAGAL', message: 'Sistem gagal menghubungi server AI.', theme: 'red', isProcessing: false });
      resetSlider();
    }
  };

  const resetSlider = () => {
    setIsTriggered(false);
    setSwipeValue(0);
    setIsAmanTriggered(false);
    setAmanSwipeValue(0);
    setPhotoPreview(null);
    setAiStatus('idle');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSOS = async (photoUrl: string | null = null) => {
    if (!wargaProfile) return; 

    const executeSOS = async (lat: number, lon: number) => {
      try {
        const { error } = await supabase.from('laporan_darurat').insert([
          { nama_korban: wargaProfile.nama, kontak_korban: wargaProfile.hp, latitude: lat, longitude: lon, status: 'darurat', photo_url: photoUrl }
        ]);
        if (error) throw error;
        resetSlider(); 
        setDialog({ show: true, title: 'SOS TERKIRIM!', message: 'Sinyal darurat dan bukti visual telah diterima oleh Pusat Komando.', theme: 'red', isProcessing: false });
      } catch (err: any) {
        alert("Gagal kirim ke database: " + (err.message || JSON.stringify(err)));
        resetSlider();
      }
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executeSOS(pos.coords.latitude, pos.coords.longitude),
        (err) => generateFallbackLocation(executeSOS), { timeout: 3000 }
      );
    } else { generateFallbackLocation(executeSOS); }
  };

  const handleAman = () => {
    if (navigator.vibrate) navigator.vibrate(100);
    if (!wargaProfile) return;
    resetSlider();
    setDialog({ show: true, title: 'VERIFIKASI SISTEM...', message: 'Menetapkan lokasi zona aman Anda ke dalam database pusat...', theme: 'cyan', isProcessing: true });
    
    const executeAman = async (lat: number, lon: number) => {
      await sleep(1500); 
      const { error: err1 } = await supabase.from('warga_aman').insert([{ latitude: lat, longitude: lon }]);
      const { error: err2 } = await supabase.from('laporan_darurat').update({ status: 'selesai' }).eq('nama_korban', wargaProfile.nama);
      
      if (err1 || err2) {
        setDialog({ show: true, title: 'DATABASE ERROR', message: 'Gagal sinkronisasi data', theme: 'red', isProcessing: false });
      } else {
        setBantuanData(null); 
        setDialog({ show: true, title: 'STATUS AMAN TERKONFIRMASI', message: 'Pusat Komando mencatat Anda di zona aman. Tetap waspada.', theme: 'emerald', isProcessing: false });
      }
    };
    
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executeAman(pos.coords.latitude, pos.coords.longitude),
        (err) => generateFallbackLocation(executeAman), { timeout: 3000 }
      );
    } else { generateFallbackLocation(executeAman); }
  };

  if (!wargaProfile) return null;

  return (
    <main className="min-h-100dvh bg-[#04060c] text-white flex flex-col items-center py-8 px-5 font-mono relative overflow-x-hidden overflow-y-auto">
      
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handlePhotoCapture} className="hidden" />

      <div className="w-full max-w-sm flex justify-between items-center z-10 mt-4">
        <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <p className="text-[9px] text-gray-300 tracking-widest truncate max-w-120px">
            ID: <span className="text-cyan-400 font-bold uppercase">{wargaProfile.nama}</span>
          </p>
        </div>
        
        <button onClick={handleLogout} className="bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-full text-[9px] font-bold tracking-widest uppercase transition-all duration-300 backdrop-blur-md cursor-pointer">
          Ganti Akun
        </button>
      </div>

      <div className="text-center mt-2 mb-6 z-10">
        <div className="w-2 h-2 bg-cyan-500 rounded-full mx-auto mb-2 animate-ping"></div>
        <h1 className="text-2xl font-black tracking-widest uppercase">PORTAL <span className="text-cyan-400">SIAGA</span></h1>
        <p className="text-[9px] text-gray-500 tracking-widest mt-1">Layanan Evakuasi Cepat</p>
      </div>
      
      <div className={`w-full max-w-sm rounded-xl p-4 border mb-6 flex flex-col gap-2 transition-colors duration-500 z-10
        ${globalStatus === 'KRITIS' ? 'bg-red-950/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-emerald-950/10 border-emerald-900/50'}`}>
        <h2 className={`text-xs font-bold tracking-widest flex items-center gap-2 ${globalStatus === 'KRITIS' ? 'text-red-500' : 'text-emerald-500'}`}>
          {globalStatus === 'KRITIS' ? '🚨 STATUS REGIONAL: KRITIS' : '🛡️ STATUS REGIONAL: AMAN'}
        </h2>
        <p className="text-[10px] text-gray-400 leading-relaxed font-sans">{pesanStatus}</p>
      </div>

      {bantuanData && (
        <div className="w-full max-w-sm rounded-xl p-4 border border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_30px_rgba(34,211,238,0.2)] mb-8 flex flex-col gap-3 z-10 animate-in zoom-in duration-500">
          <div className="flex justify-between items-center border-b border-cyan-500/30 pb-2">
            <h2 className="text-xs font-bold tracking-widest text-cyan-400 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div> BANTUAN DALAM PERJALANAN
            </h2>
            <span className="text-[8px] bg-cyan-500 text-black font-bold px-2 py-0.5 rounded-full animate-pulse">EN ROUTE</span>
          </div>
          <div className="bg-black/50 border border-cyan-900 p-4 rounded-lg flex flex-col gap-4">
            
            {/* UI BARU: KOORDINATOR LAPANGAN */}
            <div className="border-b border-white/5 pb-3">
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><span className="text-cyan-500 text-sm">🛡️</span> KOORDINATOR LAPANGAN</p>
              <p className="text-xs font-bold text-white mt-1">{bantuanData.kontak_petugas === 'Ops-Center Nexus' ? bantuanData.nama_petugas : 'Ashwa Arfika Bashari (Koord. Relawan)'}</p>
              <p className="text-[10px] text-cyan-400 font-sans mt-0.5">📞 {bantuanData.kontak_petugas === 'Ops-Center Nexus' ? '0813-0000-3333' : 'Menunggu Update Lapangan...'}</p>
            </div>
            
            {/* UI BARU: UNIT MEDIS PENDAMPING */}
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><span className="text-emerald-500 text-sm">🚑</span> UNIT MEDIS PENDAMPING</p>
              <p className="text-xs font-bold text-white mt-1">{bantuanData.kontak_petugas === 'RS Darurat Lhokseumawe' ? bantuanData.nama_petugas : 'Tim Triase Medis (Dr. Raffa & Dr. Aini)'}</p>
              <p className="text-[10px] text-emerald-400 font-sans mt-0.5">📞 {bantuanData.kontak_petugas === 'RS Darurat Lhokseumawe' ? '0812-9999-8888' : 'Siaga Medis Posko'}</p>
            </div>

          </div>
        </div>
      )}

      {/* CONDITIONAL RENDERING AREA TOMBOL SWIPE */}
      <div className="flex flex-col items-center gap-6 mb-12 z-10 w-full mt-2">
        {bantuanData ? (
          <div className={`relative w-[300px] h-[72px] rounded-full p-1.5 overflow-hidden transition-all duration-500 flex items-center font-sans
            ${isAmanTriggered ? 'bg-emerald-950/20 border border-emerald-500/50 shadow-[inset_0_0_30px_rgba(16,185,129,0.15)]' : 'bg-[#06090e] border border-emerald-900/30 shadow-[inset_0_8px_20px_rgba(0,0,0,0.9)]'}`}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className={`font-semibold text-xs tracking-[0.25em] transition-all duration-500 ${isAmanTriggered ? 'opacity-0 scale-95' : 'text-emerald-500/70 ml-6'}`}>GESER JIKA AMAN</span>
              <span className={`absolute font-black text-sm tracking-widest text-emerald-500 transition-all duration-500 delay-100 ${isAmanTriggered ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>MENGIRIM STATUS...</span>
            </div>
            <div className="absolute left-1.5 top-1.5 bottom-1.5 rounded-full bg-gradient-to-r from-emerald-600/10 to-emerald-600/40 z-10 transition-all duration-75" style={{ width: isAmanTriggered ? 'calc(100% - 12px)' : `calc(60px + ${(amanSwipeValue / 100) * 228}px)` }} />
            <div className={`absolute left-1.5 z-20 h-[60px] w-[60px] rounded-full flex items-center justify-center transition-all duration-75
                ${isAmanTriggered ? 'bg-emerald-600 border border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.6)]' : 'bg-gradient-to-b from-[#1a2235] to-[#0f1523] border-t border-emerald-600/50 shadow-2xl'}`}
              style={{ transform: `translateX(${isAmanTriggered ? 228 : (amanSwipeValue / 100) * 228}px)` }}
            >
              <div className={`transition-all duration-300 ${isAmanTriggered ? 'text-white' : 'text-emerald-500'}`}>
                {isAmanTriggered ? <span className="text-2xl">✓</span> : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </div>
            <input type="range" min="0" max="100" value={amanSwipeValue} onChange={handleAmanSwipe} disabled={isAmanTriggered} className="absolute z-30 w-full h-full opacity-0 cursor-pointer" />
          </div>
        ) : (
          <>
            <div className={`relative w-[300px] h-[72px] rounded-full p-1.5 overflow-hidden transition-all duration-500 flex items-center font-sans
              ${isTriggered ? 'bg-red-950/20 border border-red-500/50 shadow-[inset_0_0_30px_rgba(220,38,38,0.15)]' : 'bg-[#06090e] border border-white/5 shadow-[inset_0_8px_20px_rgba(0,0,0,0.9)]'}`}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className={`font-semibold text-xs tracking-[0.25em] transition-all duration-500 ${isTriggered ? 'opacity-0 scale-95' : 'text-gray-600 ml-6'}`}>GESER UNTUK SOS</span>
                <span className={`absolute font-black text-sm tracking-widest text-red-500 transition-all duration-500 delay-100 ${isTriggered ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>MEMBUKA KAMERA...</span>
              </div>
              <div className="absolute left-1.5 top-1.5 bottom-1.5 rounded-full bg-gradient-to-r from-red-600/10 to-red-600/40 z-10 transition-all duration-75" style={{ width: isTriggered ? 'calc(100% - 12px)' : `calc(60px + ${(swipeValue / 100) * 228}px)` }} />
              <div className={`absolute left-1.5 z-20 h-[60px] w-[60px] rounded-full flex items-center justify-center transition-all duration-75
                  ${isTriggered ? 'bg-red-600 border border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.6)]' : 'bg-gradient-to-b from-[#1a2235] to-[#0f1523] border-t border-slate-600/50 shadow-2xl'}`}
                style={{ transform: `translateX(${isTriggered ? 228 : (swipeValue / 100) * 228}px)` }}
              >
                <div className={`transition-all duration-300 ${isTriggered ? 'text-white' : 'text-red-500'}`}>
                  {isTriggered ? <span className="text-xl">📷</span> : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
              <input type="range" min="0" max="100" value={swipeValue} onChange={handleSwipe} disabled={isTriggered} className="absolute z-30 w-full h-full opacity-0 cursor-pointer" />
            </div>
            
            <button onClick={handleAman} className="relative z-20 px-8 py-2.5 border border-white/10 hover:border-white/30 rounded-full text-[10px] font-bold tracking-[0.2em] text-gray-500 hover:text-gray-300 transition-all cursor-pointer uppercase font-sans mt-2">
              Batalkan / Lapor Aman
            </button>
          </>
        )}
      </div>

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

      {photoPreview && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm flex flex-col items-center relative">
            <h2 className="text-cyan-400 font-black tracking-[0.3em] uppercase text-sm mb-6 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></div> Nexus AI Vision
            </h2>
            <div className="relative w-full aspect-[3/4] bg-gray-900 border-2 border-cyan-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.15)]">
              <img src={photoPreview} alt="Darurat" className="w-full h-full object-cover opacity-60 mix-blend-screen" />
              {aiStatus === 'scanning' && (
                <>
                  <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_20px_#22d3ee] animate-[scan_2s_ease-in-out_infinite]"></div>
                  <div className="absolute inset-0 bg-cyan-500/10 animate-pulse"></div>
                  <div className="absolute inset-0 border-[1px] border-cyan-500/20 bg-[linear-gradient(rgba(34,211,238,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                </>
              )}
              {aiStatus === 'verified' && (
                <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center backdrop-blur-sm">
                  <div className="bg-emerald-600 p-4 rounded-full shadow-[0_0_30px_#10b981] animate-in zoom-in">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
              )}
              {aiStatus === 'rejected' && (
                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center backdrop-blur-sm">
                  <div className="bg-red-600 p-4 rounded-full shadow-[0_0_30px_#ef4444] animate-in zoom-in">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-8 font-mono text-center h-16">
              {aiStatus === 'scanning' && (<><p className="text-cyan-400 font-bold text-sm mb-1">MEMPROSES GAMBAR...</p><p className="text-[10px] text-gray-500">Mendeteksi anomali struktural & termal</p></>)}
              {aiStatus === 'verified' && (<><p className="text-emerald-400 font-bold text-sm mb-1">ANCAMAN TERDETEKSI</p><p className="text-[10px] text-gray-500">Prioritas tinggi. Mengirim laporan...</p></>)}
              {aiStatus === 'rejected' && (<><p className="text-red-500 font-bold text-sm mb-1">TIDAK ADA BAHAYA / PRANK</p><p className="text-[10px] text-gray-500">Laporan ditolak otomatis oleh sistem.</p></>)}
            </div>
          </div>
        </div>
      )}

      {dialog.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`bg-[#0a0a14] border-2 rounded-2xl w-full max-w-xs p-6 shadow-2xl transform transition-all ${dialog.theme === 'red' ? 'border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : dialog.theme === 'emerald' ? 'border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.2)]'}`}>
            <h3 className={`text-sm font-black tracking-widest uppercase mb-3 ${dialog.theme === 'red' ? 'text-red-400' : dialog.theme === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'}`}>{dialog.title}</h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans mb-6">{dialog.message}</p>
            {dialog.isProcessing ? (
              <div className="flex justify-center mt-4">
                <div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin ${dialog.theme === 'red' ? 'border-red-500' : dialog.theme === 'emerald' ? 'border-emerald-500' : 'border-cyan-500'}`}></div>
              </div>
            ) : (
              <div className="flex justify-end mt-4">
                <button onClick={() => setDialog({ ...dialog, show: false })} className={`w-full py-3 rounded-xl text-xs font-bold tracking-widest text-white transition-all shadow-lg cursor-pointer ${dialog.theme === 'red' ? 'bg-red-600 hover:bg-red-500 border-red-400/50' : dialog.theme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50' : 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400/50'}`}>MENGERTI</button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scan { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }
      `}</style>
    </main>
  );
}