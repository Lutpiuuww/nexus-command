"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LapanganDashboard() {
  const router = useRouter();
  const [tugasList, setTugasList] = useState<any[]>([]);
  const [globalStatus, setGlobalStatus] = useState("AMAN");
  
  const [latestSos, setLatestSos] = useState<{lat: string, lon: string} | null>(null);
  const [selectedTugas, setSelectedTugas] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: tugasData } = await supabase.from('penugasan_relawan').select('*').order('id_tugas', { ascending: false }).limit(10);
      if (tugasData) setTugasList(tugasData);

      const { data: pData } = await supabase.from('peringatan_dini').select('*').order('id', { ascending: false }).limit(1);
      if (pData && pData.length > 0) setGlobalStatus(pData[0].status_level);

      const { data: sosData } = await supabase.from('laporan_darurat').select('*').order('id_laporan', { ascending: false }).limit(1);
      if (sosData && sosData.length > 0) setLatestSos({ lat: sosData[0].latitude, lon: sosData[0].longitude });
    };

    fetchData();

    const tugasChannel = supabase.channel('lapangan_tugas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'penugasan_relawan' }, (payload) => {
        setTugasList(prev => [payload.new, ...prev].slice(0, 10));
      }).subscribe();

    const statusChannel = supabase.channel('lapangan_status')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'peringatan_dini' }, (payload) => {
        setGlobalStatus(payload.new.status_level);
      }).subscribe();

    const sosChannel = supabase.channel('lapangan_sos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'laporan_darurat' }, (payload) => {
        setLatestSos({ lat: payload.new.latitude, lon: payload.new.longitude });
      }).subscribe();

    return () => { 
      supabase.removeChannel(tugasChannel); 
      supabase.removeChannel(statusChannel); 
      supabase.removeChannel(sosChannel); 
    };
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[#070404] text-white p-4 sm:p-6 font-mono flex flex-col gap-6 relative overflow-x-hidden overflow-y-auto pb-10">
      {/* HEADER */}
      <header className="flex justify-between items-center border-b border-red-900/50 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-900/30 border border-red-500/30 rounded-xl flex items-center justify-center">
             <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-widest text-red-400">KOMANDO LAPANGAN</h1>
            <p className="text-xs text-gray-400">Otorisasi Aktif | Unit Operasional</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-xs tracking-widest transition-colors cursor-pointer">LOGOUT</button>
        </div>
      </header>

      {/* STATUS GLOBAL (BANNER BESAR) */}
      <div className={`w-full p-6 rounded-2xl border-2 flex items-center justify-between transition-colors duration-500
        ${globalStatus === 'KRITIS' ? 'bg-red-950/40 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-emerald-950/40 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]'}`}
      >
        <div>
          <h2 className="text-[10px] tracking-widest text-gray-400 uppercase mb-1">STATUS OPERASI GLOBAL</h2>
          <p className={`text-3xl font-black tracking-widest ${globalStatus === 'KRITIS' ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
            {globalStatus === 'KRITIS' ? 'EVAKUASI MASSAL AKTIF' : 'KONDISI AMAN TERKENDALI'}
          </p>
        </div>
        {globalStatus === 'KRITIS' && (
          <div className="w-16 h-16 rounded-full bg-red-500/20 border-4 border-red-500 border-t-transparent animate-spin"></div>
        )}
      </div>

      {/* DAFTAR PENUGASAN (DIUBAH SESUAI IDE BRILIANMU) */}
      <div className="flex-1 flex flex-col gap-4">
         <h2 className="text-sm font-bold tracking-widest text-gray-300 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></div>
            LOG PANGGILAN DARURAT
          </h2>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 overflow-y-auto flex flex-col gap-3">
             {tugasList.length === 0 ? <p className="text-xs text-gray-500 italic">Menunggu instruksi dari Pusat Komando...</p> : null}
             
             {tugasList.map((tugas) => (
                <div key={tugas.id_tugas} className="bg-black/40 border border-white/10 hover:border-red-500/50 rounded-xl p-4 flex justify-between items-center transition-all group">
                  <div>
                    {/* Sekarang List menampilkan data KORBAN/PELAPOR */}
                    <h3 className="font-bold text-red-400 text-sm mb-1 uppercase">PELAPOR: {tugas.nama_pelapor || 'Warga (Sinyal Darurat GPS)'}</h3>
                    <p className="text-[10px] text-gray-400 font-sans">
                      Kontak: {tugas.kontak_pelapor || 'Anonim (Satelit)'} | Waktu Dispatch: {new Date(tugas.waktu_berangkat).toLocaleTimeString('id-ID')}
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedTugas(tugas)}
                    className="px-4 py-2 bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-400 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.1)] group-hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                  >
                    DETAIL / RUTE MAPS
                  </button>
                </div>
             ))}
          </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL POP-UP DETAIL (MENGGABUNGKAN KORBAN & PETUGAS) */}
      {/* ======================================================== */}
      {selectedTugas && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0a0a14] border-2 border-cyan-500/50 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(34,211,238,0.2)] flex flex-col">
            <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-5">
              <h3 className="text-sm font-black tracking-widest text-cyan-400">PROTOKOL PENYELAMATAN</h3>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
            </div>

            <div className="flex flex-col gap-3 mb-8">
              
              {/* KOTAK 1: INFO KORBAN (MERAH) */}
              <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-xl relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                <p className="text-[9px] text-red-400/80 uppercase tracking-widest mb-1">INFO PELAPOR & TITIK SASARAN</p>
                <p className="text-sm font-bold text-white font-sans mb-1">{selectedTugas.nama_pelapor || 'Warga Sipil (Sinyal GPS)'}</p>
                {latestSos ? (
                  <p className="text-xs font-bold text-red-400 font-sans">KOORDINAT: {latestSos.lat}, {latestSos.lon}</p>
                ) : (
                  <p className="text-xs italic text-gray-500">Menunggu koordinat satelit...</p>
                )}
              </div>

              {/* KOTAK 2: INFO PETUGAS (CYAN) */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl mt-2">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">PETUGAS DIKERAHKAN</p>
                <p className="text-sm font-bold text-cyan-400 mb-1">{selectedTugas.nama_petugas}</p>
                <p className="text-[10px] font-bold text-gray-400 font-sans">📞 {selectedTugas.kontak_petugas}</p>
              </div>

            </div>

            <div className="flex gap-3 mt-auto">
              <button 
                onClick={() => setSelectedTugas(null)} 
                className="flex-1 py-3 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold tracking-widest text-gray-400 transition-colors cursor-pointer"
              >
                TUTUP
              </button>
              
              {latestSos ? (
                <a
                  /* KODE YANG BENAR (LANGSUNG BUKA RUTE NAVIGASI) */
                  href={`https://www.google.com/maps/dir/?api=1&destination=${latestSos.lat},${latestSos.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/50 text-white rounded-xl text-xs font-bold tracking-widest text-center shadow-lg shadow-cyan-900/50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  BUKA MAPS
                </a>
              ) : (
                <button disabled className="flex-1 py-3 bg-gray-800 text-gray-500 rounded-xl text-xs font-bold tracking-widest cursor-not-allowed">
                  NO DATA
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}