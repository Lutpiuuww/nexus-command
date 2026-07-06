"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function MedisDashboard() {
  const router = useRouter();
  const [sosList, setSosList] = useState<any[]>([]);
  const [shelterList, setShelterList] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState("");
  const [selectedKorban, setSelectedKorban] = useState<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('id-ID')), 1000);
    const fetchData = async () => {
      const { data: sosData } = await supabase.from('laporan_darurat').select('*').order('id_laporan', { ascending: false }).limit(10);
      if (sosData) setSosList(sosData);
      const { data: sData } = await supabase.from("master_shelter").select("*");
      if (sData) setShelterList(sData);
    };
    fetchData();

    // PERBAIKAN 1: Ubah event: 'INSERT' menjadi event: '*' agar mendeteksi UPDATE juga
    const sosChannel = supabase.channel('medis_sos').on('postgres_changes', { event: '*', schema: 'public', table: 'laporan_darurat' }, (payload) => {
        // Memanggil ulang fetchData() adalah cara paling aman untuk memastikan data ter-update
        fetchData(); 
      }).subscribe();

    return () => { clearInterval(timer); supabase.removeChannel(sosChannel); };
  }, []);

  return (
    <main className="min-h-100dvh bg-[#040605] text-white p-4 lg:p-6 font-mono flex flex-col gap-6 relative overflow-x-hidden overflow-y-auto pb-10">
      
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-emerald-900/50 pb-4 gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-900/30 border border-emerald-500/30 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-widest text-emerald-400">UNIT MEDIS</h1>
            <p className="text-[10px] sm:text-xs text-gray-400">Dr. Raffa dan Dr. Aini | Otorisasi Aktif</p>
          </div>
        </div>
        <button onClick={() => router.push('/')} className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-xs tracking-widest w-full sm:w-auto">LOGOUT</button>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 h-full flex-1">
        
        {/* KIRI (Atas di HP) */}
        <section className="w-full lg:w-1/2 flex flex-col gap-4">
          <h2 className="text-sm font-bold tracking-widest text-gray-300 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div> RADAR KORBAN</h2>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            
            {sosList.map((sos, idx) => {
              // PERBAIKAN 2: Logika pengecekan status
              const isAman = sos.status === 'selesai';

              return (
                <div key={idx} className={`${isAman ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-red-950/20 border-red-900/30'} border rounded-xl p-4 flex flex-col gap-3 relative transition-all duration-500`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${isAman ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  <div>
                    <h3 className={`font-bold text-sm mb-1 uppercase ${isAman ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sos.nama_korban || 'KORBAN TERDETEKSI'}
                    </h3>
                    <p className="text-[10px] text-gray-400">Koordinat: {sos.latitude}, {sos.longitude}</p>
                  </div>

                  {/* PERBAIKAN 3: Tombol berubah jadi teks hijau jika status selesai */}
                  {isAman ? (
                     <div className="w-full py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold text-center flex items-center justify-center gap-2 animate-pulse">
                        <span className="text-xs">✅</span> WARGA BERHASIL DIEVAKUASI
                     </div>
                  ) : (
                    <button onClick={() => setSelectedKorban(sos)} className="w-full py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-red-600/30">
                      TINDAK LANJUTI
                    </button>
                  )}
                </div>
              );
            })}

          </div>
        </section>

        {/* KANAN (Bawah di HP) */}
        <section className="w-full lg:w-1/2 flex flex-col gap-4">
          <h2 className="text-sm font-bold tracking-widest text-gray-300 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> KAPASITAS POSKO</h2>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
            {shelterList.map((s) => {
              const pct = (s.kapasitas_terisi / s.kapasitas_maksimal) * 100;
              const color = pct >= 90 ? 'bg-red-500' : 'bg-emerald-500';
              return (
                <div key={s.id_shelter} className="bg-black/30 border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-gray-200 text-xs sm:text-sm">{s.nama_shelter}</h4><span className="text-[9px] sm:text-[10px] bg-black/50 text-gray-300 px-2 py-1 rounded">{s.kapasitas_terisi}/{s.kapasitas_maksimal}</span></div>
                  <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }}></div></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* POP-UP DETAIL TRIASE */}
      {selectedKorban && (
        <div className="fixed inset-0 bg-black/90 z-100 flex items-center justify-center p-4">
          <div className="bg-[#0a0f0d] border-2 border-emerald-500/50 rounded-2xl w-full max-w-md p-5 flex flex-col">
            <h3 className="text-sm font-black text-emerald-400 mb-5">DETAIL TRIASE PASIEN</h3>
            <div className="bg-white/5 p-4 rounded-xl mb-3"><p className="text-[9px] text-gray-500">NAMA PASIEN</p><p className="text-sm font-bold">{selectedKorban.nama_korban}</p></div>
            <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-xl mb-6"><p className="text-[9px] text-red-400/80 mb-2">KELUHAN MEDIS</p><p className="text-sm font-bold">{selectedKorban.kondisi_medis || 'Kondisi belum diketahui'}</p></div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedKorban(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 cursor-pointer rounded-xl text-xs font-bold text-gray-400">TUTUP</button>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedKorban.latitude},${selectedKorban.longitude}`} target="_blank" className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2">RUTE MAPS</a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}