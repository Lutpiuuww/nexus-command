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
  
  const [disasterInfo, setDisasterInfo] = useState<{ jenis: string, lat: number, lon: number, radius: number } | null>(null);
  const [userDist, setUserDist] = useState<number | null>(null);

  const [dialog, setDialog] = useState<{
    show: boolean; title: string; message: string; theme: 'red' | 'emerald' | 'blue'; isProcessing: boolean;
  }>({ show: false, title: '', message: '', theme: 'blue', isProcessing: false });
  
  const [swipeValue, setSwipeValue] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);
  const [amanSwipeValue, setAmanSwipeValue] = useState(0);
  const [isAmanTriggered, setIsAmanTriggered] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'scanning' | 'verified' | 'rejected'>('idle');

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  const generateFallbackLocation = (callback: (lat: number, lon: number) => void) => {
    const fallbackLat = 5.1812 + (Math.random() * 0.005);
    const fallbackLon = 97.1415 + (Math.random() * 0.005);
    callback(fallbackLat, fallbackLon);
  };

  const checkUserDistance = (disasterLat: number, disasterLon: number) => {
    const calcAndSet = (lat: number, lon: number) => {
      const dist = calculateDistance(lat, lon, disasterLat, disasterLon);
      setUserDist(dist);
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => calcAndSet(pos.coords.latitude, pos.coords.longitude),
        (err) => generateFallbackLocation(calcAndSet),
        { timeout: 5000 }
      );
    } else { generateFallbackLocation(calcAndSet); }
  };

  useEffect(() => {
    const saved = localStorage.getItem('nexus_warga_profile');
    let profile = null;
    if (saved) { profile = JSON.parse(saved); setWargaProfile(profile); } 
    else { router.push('/'); return; }

    const fetchData = async () => {
      try {
        const { data: statusData, error: statusErr } = await supabase.from('peringatan_dini').select('*').order('id', { ascending: false }).limit(1);
        if (statusErr) throw statusErr; 
        
        if (statusData && statusData.length > 0) {
          setGlobalStatus(statusData[0].status_level);
          setPesanStatus(statusData[0].pesan);
          if (statusData[0].status_level === 'KRITIS') {
            setDisasterInfo({
              jenis: statusData[0].jenis_bencana || 'ANCAMAN',
              lat: statusData[0].lat_bencana, lon: statusData[0].lon_bencana, radius: statusData[0].radius_km
            });
            checkUserDistance(statusData[0].lat_bencana, statusData[0].lon_bencana);
          }
        }
        const { data: shelterData, error: shelterErr } = await supabase.from('master_shelter').select('*');
        if (shelterErr) throw shelterErr; 
        if (shelterData) setShelterList(shelterData);
      } catch (error) {
        setGlobalStatus('AMAN');
        setPesanStatus('Tidak ada anomali terdeteksi (Mode Offline).');
      }
    };
    fetchData();

    const statusChannel = supabase.channel('warga_status')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'peringatan_dini' }, (payload) => {
        setGlobalStatus(payload.new.status_level);
        setPesanStatus(payload.new.pesan);
        if (payload.new.status_level === 'KRITIS') {
          setDisasterInfo({
            jenis: payload.new.jenis_bencana || 'ANCAMAN',
            lat: payload.new.lat_bencana, lon: payload.new.lon_bencana, radius: payload.new.radius_km
          });
          checkUserDistance(payload.new.lat_bencana, payload.new.lon_bencana);
        } else {
          setDisasterInfo(null); setUserDist(null);
        }
      }).subscribe();

    const tugasChannel = supabase.channel('warga_tugas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'penugasan_relawan' }, (payload) => {
        if (profile && payload.new.nama_pelapor === profile.nama) {
          setTimeout(() => {
            setBantuanData(payload.new);
            setDialog({ show: true, title: 'UNIT RESCUE DIKERAHKAN!', message: `Tim evakuasi sedang bergerak ke titik GPS Anda.`, theme: 'blue', isProcessing: false });
            if (navigator.vibrate) navigator.vibrate([500, 200, 500]); 
          }, 3500); 
        }
      }).subscribe();

    return () => { supabase.removeChannel(statusChannel); supabase.removeChannel(tugasChannel); };
  }, [router]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const handleLogout = () => { localStorage.removeItem('nexus_warga_profile'); router.push('/'); };

  const handleSwipe = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setSwipeValue(value);
    if (value > 95 && !isTriggered) { setIsTriggered(true); setSwipeValue(100); if (cameraInputRef.current) cameraInputRef.current.click(); }
  };

  const handleAmanSwipe = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setAmanSwipeValue(value);
    if (value > 95 && !isAmanTriggered) { setIsAmanTriggered(true); setAmanSwipeValue(100); handleAman(); }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { resetSlider(); return; }
    setPhotoPreview(URL.createObjectURL(file));
    processAIVision(file);
  };

  const processAIVision = async (file: File) => {
    setAiStatus('scanning');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    try {
      const formData = new FormData(); formData.append("image", file);
      const response = await fetch('/api/vision-scan', { method: 'POST', body: formData });
      if (!response.ok) throw new Error("Gagal menghubungi server AI");
      const data = await response.json();
      
      if (data.status === "PRANK") {
        setAiStatus('rejected');
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
        setTimeout(() => { setDialog({ show: true, title: 'VERIFIKASI AI GAGAL', message: 'Sistem AI menolak foto ini. Pastikan foto relevan.', theme: 'red', isProcessing: false }); resetSlider(); }, 3000);
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
        } catch (uploadErr) { setTimeout(() => { handleSOS(null); }, 1500); }
      }
    } catch (error) {
      setAiStatus('rejected');
      setDialog({ show: true, title: 'KONEKSI GAGAL', message: 'Sistem gagal menghubungi server AI.', theme: 'red', isProcessing: false });
      resetSlider();
    }
  };

  const resetSlider = () => { setIsTriggered(false); setSwipeValue(0); setIsAmanTriggered(false); setAmanSwipeValue(0); setPhotoPreview(null); setAiStatus('idle'); if (cameraInputRef.current) cameraInputRef.current.value = ''; };

  const handleSOS = async (photoUrl: string | null = null) => {
    if (!wargaProfile) return; 
    const executeSOS = async (lat: number, lon: number) => {
      try {
        const { error } = await supabase.from('laporan_darurat').insert([{ nama_korban: wargaProfile.nama, kontak_korban: wargaProfile.hp, latitude: lat, longitude: lon, status: 'darurat', photo_url: photoUrl }]);
        if (error) throw error;
        resetSlider(); setDialog({ show: true, title: 'SOS TERKIRIM', message: 'Sinyal darurat dan lokasi Anda telah diterima oleh Pusat Komando.', theme: 'red', isProcessing: false });
      } catch (err: any) { alert("Gagal kirim data: " + err.message); resetSlider(); }
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) { navigator.geolocation.getCurrentPosition((pos) => executeSOS(pos.coords.latitude, pos.coords.longitude), (err) => generateFallbackLocation(executeSOS), { timeout: 3000 });
    } else { generateFallbackLocation(executeSOS); }
  };

  const handleAman = () => {
    if (navigator.vibrate) navigator.vibrate(100);
    if (!wargaProfile) return;
    resetSlider();
    setDialog({ show: true, title: 'VERIFIKASI SISTEM...', message: 'Menetapkan lokasi zona aman Anda ke dalam database...', theme: 'blue', isProcessing: true });
    const executeAman = async (lat: number, lon: number) => {
      await sleep(1500); 
      const { error: err1 } = await supabase.from('warga_aman').insert([{ latitude: lat, longitude: lon }]);
      const { error: err2 } = await supabase.from('laporan_darurat').update({ status: 'selesai' }).eq('nama_korban', wargaProfile.nama);
      if (err1 || err2) { setDialog({ show: true, title: 'SISTEM ERROR', message: 'Gagal melakukan sinkronisasi data.', theme: 'red', isProcessing: false }); } 
      else { setBantuanData(null); setDialog({ show: true, title: 'STATUS AMAN TERKONFIRMASI', message: 'Pusat Komando mencatat Anda di zona aman. Tetap waspada.', theme: 'emerald', isProcessing: false }); }
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) { navigator.geolocation.getCurrentPosition((pos) => executeAman(pos.coords.latitude, pos.coords.longitude), (err) => generateFallbackLocation(executeAman), { timeout: 3000 });
    } else { generateFallbackLocation(executeAman); }
  };

  const getDisasterInstruction = (jenis: string) => {
    switch (jenis) {
      case 'TSUNAMI': return 'Jauhi pesisir laut Lhokseumawe. Segera evakuasi ke dataran tinggi seperti Bukit Indah Unimal.';
      case 'GEMPA BUMI': return 'Waspada gempa susulan. Jauhi bangunan tinggi. Segera menuju lapangan terbuka terdekat.';
      case 'BANJIR BANDANG': return 'Hindari bantaran Krueng Cunda. Bergeraklah ke posko pengungsian di dataran yang lebih tinggi.';
      case 'TANAH LONGSOR': return 'Jauhi lereng perbukitan. Segera berpindah ke dataran stabil dan laporkan posisi Anda.';
      case 'KEBAKARAN BESAR': return 'Gunakan masker/kain basah. Jauhi area padat penduduk dekat titik api. Beri jalan untuk Pemadam!';
      default: return 'Segera evakuasi diri Anda ke tempat yang lebih aman mengikuti instruksi petugas resmi.';
    }
  };

  if (!wargaProfile) return null;

  return (
    <main className="min-h-100dvh bg-slate-900 text-slate-100 flex flex-col items-center py-8 px-5 font-sans relative overflow-x-hidden overflow-y-auto">
      {/* Semi-Dark Premium Background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-30 z-0"></div>
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-900/20 blur-[100px] rounded-full z-0 pointer-events-none"></div>
      
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handlePhotoCapture} className="hidden" />
      
      {/* HEADER */}
      <div className="w-full max-w-sm flex justify-between items-center z-10 mt-2">
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/50 shadow-sm px-4 py-2 rounded-full flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          <p className="text-[10px] text-slate-300 font-bold tracking-widest truncate max-w-[120px]">
            ID: <span className="text-sky-400 uppercase">{wargaProfile.nama}</span>
          </p>
        </div>
        <button onClick={handleLogout} className="bg-slate-800/80 backdrop-blur-md hover:bg-slate-700 border border-slate-700/50 text-slate-400 hover:text-white px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all shadow-sm cursor-pointer">
          Ganti Akun
        </button>
      </div>

      <div className="text-center mt-8 mb-10 z-10">
        {/* DESAIN BARU: RADAR REALISTIS */}
        <div className="relative w-16 h-16 mx-auto mb-5 bg-slate-900 rounded-full border border-slate-700 shadow-[0_0_20px_rgba(14,165,233,0.15)] overflow-hidden flex items-center justify-center">
          {/* Garis Crosshair Radar */}
          <div className="absolute w-full h-[1px] bg-sky-500/20"></div>
          <div className="absolute h-full w-[1px] bg-sky-500/20"></div>
          
          {/* Lingkaran Konsentris (Grid Radar) */}
          <div className="absolute w-12 h-12 border border-sky-500/10 rounded-full"></div>
          <div className="absolute w-7 h-7 border border-sky-500/10 rounded-full"></div>
          
          {/* Sapuan Scanner Radar (Conic Gradient Animasi Spin) */}
          <div className="absolute inset-0 rounded-full animate-[spin_2s_linear_infinite]" style={{ background: 'conic-gradient(from 0deg, transparent 75%, rgba(14, 165, 233, 0.5) 100%)' }}></div>
          
          {/* Echo Ping di tengah */}
          <div className="w-2.5 h-2.5 bg-sky-400 rounded-full absolute animate-ping opacity-60"></div>
          
          {/* Titik Pusat (Dot Node) */}
          <div className="w-2.5 h-2.5 bg-sky-500 rounded-full relative z-10 shadow-[0_0_10px_#38bdf8]"></div>
        </div>

        <h1 className="text-3xl font-black tracking-[0.2em] uppercase text-white">
          PORTAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">SIAGA</span>
        </h1>
        <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-2 uppercase">Layanan Evakuasi Darurat Terpadu</p>
      </div>
      
      {/* RADAR EPISENTRUM & INDIKATOR ZONA MERAH */}
      {globalStatus === 'KRITIS' && disasterInfo ? (
        <div className="w-full max-w-sm rounded-[24px] p-6 mb-8 flex flex-col gap-4 bg-slate-800/80 backdrop-blur-md border border-rose-900/50 shadow-[0_15px_40px_rgba(225,29,72,0.1)] z-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
          
          <h2 className="text-sm font-black tracking-widest text-rose-500 flex items-center gap-2 uppercase">
            <span className="text-lg">🚨</span> PERINGATAN {disasterInfo.jenis}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">{pesanStatus}</p>

          <div className="bg-slate-900/50 border-l-4 border-rose-500 p-4 rounded-r-xl mt-1">
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              <span className="font-bold text-rose-500 block mb-1 uppercase tracking-widest text-[10px]">Instruksi Otoritas:</span> 
              {getDisasterInstruction(disasterInfo.jenis)}
            </p>
          </div>

          {userDist !== null && (
            <div className="mt-1 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Jarak ke Pusat Ancaman</span>
                <span className="text-[14px] font-black text-rose-500">{userDist.toFixed(2)} KM</span>
              </div>
              
              {userDist <= disasterInfo.radius ? (
                <div className="bg-rose-950/40 text-rose-400 text-[11px] px-3 py-3 rounded-lg font-bold tracking-wide text-center border border-rose-900/50 animate-pulse">
                  ⚠️ ANDA BERADA DI ZONA MERAH!
                </div>
              ) : (
                <div className="bg-amber-950/30 text-amber-400 text-[11px] px-3 py-3 rounded-lg font-bold tracking-wide text-center border border-amber-900/50">
                  Di luar zona utama. Tetap waspada.
                </div>
              )}
            </div>
          )}

          <a 
            href={`https://www.google.com/maps/search/?api=1&query=${disasterInfo.lat},${disasterInfo.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full mt-2 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white text-[11px] font-bold tracking-widest py-4 rounded-xl flex justify-center items-center gap-2 transition-all cursor-pointer shadow-[0_8px_20px_rgba(225,29,72,0.2)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            LIHAT PUSAT BENCANA (MAPS)
          </a>
        </div>
      ) : (
        <div className="w-full max-w-sm rounded-[24px] p-6 mb-8 flex flex-col gap-2 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 shadow-[0_15px_40px_rgba(0,0,0,0.1)] transition-colors duration-500 z-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-bl-full pointer-events-none"></div>
          <h2 className="text-sm font-black tracking-widest flex items-center gap-2 text-emerald-500 uppercase">
            <span className="text-lg">🛡️</span> STATUS REGIONAL: AMAN
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">{pesanStatus}</p>
        </div>
      )}

      {/* BANTUAN EN ROUTE */}
      {bantuanData && (
        <div className="w-full max-w-sm rounded-[24px] p-6 border border-sky-800/50 bg-slate-800/90 shadow-[0_15px_40px_rgba(14,165,233,0.1)] mb-8 flex flex-col gap-4 z-10 animate-in zoom-in duration-500">
          <div className="flex justify-between items-center border-b border-slate-700 pb-4">
            <h2 className="text-[11px] font-black tracking-widest text-sky-400 flex items-center gap-2 uppercase">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]"></div> TIM MENUJU LOKASI
            </h2>
            <span className="text-[9px] bg-sky-500/20 text-sky-400 font-black px-3 py-1 rounded-full uppercase tracking-wider border border-sky-500/30">EN ROUTE</span>
          </div>
          <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-2xl flex flex-col gap-4 shadow-inner">
            <div className="border-b border-slate-800 pb-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><span className="text-sky-500 text-sm">🛡️</span> TIM LAPANGAN</p>
              <p className="text-sm font-black text-slate-200 mt-1">{bantuanData.kontak_petugas === 'Ops-Center Nexus' ? bantuanData.nama_petugas : 'Ashwa Arfika Bashari (Koord. Relawan)'}</p>
              <p className="text-[11px] text-sky-400 font-bold mt-1 bg-sky-950/50 w-max px-2 py-0.5 rounded">📞 {bantuanData.kontak_petugas === 'Ops-Center Nexus' ? '0813-0000-3333' : 'Menunggu Update...'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><span className="text-emerald-500 text-sm">🚑</span> UNIT MEDIS</p>
              <p className="text-sm font-black text-slate-200 mt-1">{bantuanData.kontak_petugas === 'RS Darurat Lhokseumawe' ? bantuanData.nama_petugas : 'Tim Triase Medis (Dr. Raffa & Dr. Aini)'}</p>
              <p className="text-[11px] text-emerald-400 font-bold mt-1 bg-emerald-950/50 w-max px-2 py-0.5 rounded">📞 {bantuanData.kontak_petugas === 'RS Darurat Lhokseumawe' ? '0812-9999-8888' : 'Siaga Medis Posko'}</p>
            </div>
          </div>
        </div>
      )}

      {/* AREA SLIDER INTERAKTIF (PRO MAX LOOK) */}
      <div className="flex flex-col items-center gap-6 mb-12 z-10 w-full mt-2">
        {bantuanData ? (
          <div className="relative w-[320px] h-[80px] rounded-full p-2 bg-slate-800 border border-slate-700 shadow-inner flex items-center transition-all overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className={`font-bold text-xs tracking-widest transition-all duration-500 ${isAmanTriggered ? 'opacity-0 scale-95' : 'text-slate-500 ml-8'}`}>GESER JIKA AMAN</span>
              <span className={`absolute font-black text-sm tracking-widest text-emerald-500 transition-all duration-500 delay-100 ${isAmanTriggered ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>MENGIRIM STATUS...</span>
            </div>
            
            <div className="absolute left-2 top-2 bottom-2 rounded-full bg-emerald-500/20 z-10 transition-all duration-75" style={{ width: isAmanTriggered ? 'calc(100% - 16px)' : `calc(64px + ${(amanSwipeValue / 100) * 240}px)` }} />
            
            <div className={`absolute left-2 z-20 h-[64px] w-[64px] rounded-full flex items-center justify-center transition-all duration-75 shadow-[0_4px_15px_rgba(16,185,129,0.3)] ${isAmanTriggered ? 'bg-emerald-500' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'}`} style={{ transform: `translateX(${isAmanTriggered ? 240 : (amanSwipeValue / 100) * 240}px)` }}>
              <div className={`transition-all duration-300 text-white`}>
                {isAmanTriggered ? <span className="text-2xl font-black">✓</span> : (<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>)}
              </div>
            </div>
            <input type="range" min="0" max="100" value={amanSwipeValue} onChange={handleAmanSwipe} disabled={isAmanTriggered} className="absolute z-30 w-full h-full opacity-0 cursor-pointer" />
          </div>
        ) : (
          <>
            {/* TAMPILAN SLIDER SOS PRO MAX */}
            <div className="relative w-[320px] h-[80px] rounded-full p-2 bg-slate-800 border border-slate-700 shadow-inner flex items-center transition-all overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className={`font-bold text-xs tracking-widest transition-all duration-500 ${isTriggered ? 'opacity-0 scale-95' : 'text-slate-500 ml-8'}`}>GESER UNTUK SOS</span>
                <span className={`absolute font-black text-sm tracking-widest text-rose-500 transition-all duration-500 delay-100 ${isTriggered ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>MEMBUKA KAMERA...</span>
              </div>
              
              {/* Latar Belakang Track */}
              <div className="absolute left-2 top-2 bottom-2 rounded-full bg-rose-500/20 z-10 transition-all duration-75" style={{ width: isTriggered ? 'calc(100% - 16px)' : `calc(64px + ${(swipeValue / 100) * 240}px)` }} />
              
              {/* Kenop Solid Glow */}
              <div className={`absolute left-2 z-20 h-[64px] w-[64px] rounded-full flex items-center justify-center transition-all duration-75 shadow-[0_4px_15px_rgba(225,29,72,0.4)] ${isTriggered ? 'bg-rose-500' : 'bg-gradient-to-br from-rose-500 to-rose-600'}`} style={{ transform: `translateX(${isTriggered ? 240 : (swipeValue / 100) * 240}px)` }}>
                <div className={`transition-all duration-300 text-white`}>
                  {isTriggered ? <span className="text-2xl font-black">📷</span> : (<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>)}
                </div>
              </div>
              <input type="range" min="0" max="100" value={swipeValue} onChange={handleSwipe} disabled={isTriggered} className="absolute z-30 w-full h-full opacity-0 cursor-pointer" />
            </div>
            
            <button onClick={handleAman} className="relative z-20 px-8 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-full text-[10px] font-bold tracking-widest text-slate-400 transition-all cursor-pointer uppercase shadow-sm">Batalkan / Lapor Aman</button>
          </>
        )}
      </div>

      {/* DAFTAR SHELTER */}
      <div className="w-full max-w-sm flex flex-col gap-4 z-10 mb-8">
        <div className="flex justify-between items-center px-1 border-b border-slate-800 pb-2">
          <h3 className="text-[11px] font-black tracking-widest text-slate-400 uppercase">KAPASITAS POSKO</h3>
          <span className="text-[9px] bg-sky-900/40 text-sky-400 border border-sky-800 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">Live Sync</span>
        </div>
        <div className="flex flex-col gap-3">
          {shelterList.map(s => {
            const pct = (s.kapasitas_terisi / s.kapasitas_maksimal) * 100;
            const color = pct >= 90 ? 'bg-gradient-to-r from-rose-500 to-rose-600' : pct >= 60 ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-500';
            return (
              <div key={s.id_shelter} className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-[20px] p-5 shadow-sm hover:bg-slate-800 transition-all">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-slate-200 text-xs">{s.nama_shelter}</h4>
                  <span className="text-[10px] font-bold bg-slate-900 text-slate-400 px-2.5 py-1 rounded-lg tracking-wide border border-slate-800">{s.kapasitas_terisi}/{s.kapasitas_maksimal}</span>
                </div>
                <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden shadow-inner border border-slate-800">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI VISION MODAL (PRO MAX LOOK) */}
      {photoPreview && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm flex flex-col items-center relative bg-slate-900 border border-slate-700 p-6 rounded-[32px] shadow-2xl">
            <h2 className="text-sky-400 font-black tracking-widest uppercase text-sm mb-5 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]"></div> Nexus AI Vision
            </h2>
            <div className="relative w-full aspect-[3/4] bg-slate-950 rounded-[24px] overflow-hidden shadow-inner border border-slate-800">
              <img src={photoPreview} alt="Darurat" className="w-full h-full object-cover opacity-80" />
              {aiStatus === 'scanning' && (<><div className="absolute top-0 left-0 w-full h-1.5 bg-sky-500 shadow-[0_0_25px_#0ea5e9] animate-[scan_2s_ease-in-out_infinite]"></div><div className="absolute inset-0 bg-sky-500/10 animate-pulse"></div></>)}
              {aiStatus === 'verified' && ( <div className="absolute inset-0 bg-emerald-900/40 flex items-center justify-center backdrop-blur-sm"><div className="bg-emerald-500 p-5 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-in zoom-in"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div></div> )}
              {aiStatus === 'rejected' && ( <div className="absolute inset-0 bg-rose-900/40 flex items-center justify-center backdrop-blur-sm"><div className="bg-rose-500 p-5 rounded-full shadow-[0_0_30px_rgba(225,29,72,0.4)] animate-in zoom-in"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div></div> )}
            </div>
            <div className="mt-6 text-center h-14">
              {aiStatus === 'scanning' && (<><p className="text-sky-400 font-black text-sm mb-1 uppercase tracking-wide">MEMPROSES GAMBAR...</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Mendeteksi anomali darurat</p></>)}
              {aiStatus === 'verified' && (<><p className="text-emerald-400 font-black text-sm mb-1 uppercase tracking-wide">ANCAMAN TERDETEKSI</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Prioritas tinggi. Mengirim laporan...</p></>)}
              {aiStatus === 'rejected' && (<><p className="text-rose-500 font-black text-sm mb-1 uppercase tracking-wide">TIDAK ADA BAHAYA / PRANK</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Laporan ditolak oleh sistem AI.</p></>)}
            </div>
          </div>
        </div>
      )}

      {/* DIALOG POPUPS */}
      {dialog.show && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-xs p-7 shadow-2xl transform transition-all text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${dialog.theme === 'red' ? 'bg-rose-950/50 text-rose-500 border border-rose-900' : dialog.theme === 'emerald' ? 'bg-emerald-950/50 text-emerald-500 border border-emerald-900' : 'bg-sky-950/50 text-sky-400 border border-sky-900'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className={`text-sm font-black tracking-widest uppercase mb-2 ${dialog.theme === 'red' ? 'text-rose-500' : dialog.theme === 'emerald' ? 'text-emerald-500' : 'text-sky-400'}`}>{dialog.title}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium mb-6">{dialog.message}</p>
            {dialog.isProcessing ? ( <div className="flex justify-center mt-4"><div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin ${dialog.theme === 'red' ? 'border-rose-500' : dialog.theme === 'emerald' ? 'border-emerald-500' : 'border-sky-500'}`}></div></div> ) : ( <div className="flex justify-center mt-4"><button onClick={() => setDialog({ ...dialog, show: false })} className={`w-full py-4 rounded-2xl text-[11px] font-black tracking-widest text-white transition-all shadow-md cursor-pointer ${dialog.theme === 'red' ? 'bg-rose-600 hover:bg-rose-500' : dialog.theme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'}`}>MENGERTI</button></div> )}
          </div>
        </div>
      )}
      <style jsx global>{`@keyframes scan { 0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; } }`}</style>
    </main>
  );
}