"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function KoordinatorLapangan() {
  const router = useRouter();
  const [laporanList, setLaporanList] = useState<any[]>([]);
  const [riwayatList, setRiwayatList] = useState<any[]>([]); 
  const [shelterList, setShelterList] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [globalStatus, setGlobalStatus] = useState<'AMAN' | 'KRITIS'>('AMAN');
  
  const [selectedLaporan, setSelectedLaporan] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'SHELTER' | 'RUMAH' | null>(null);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour12: false }) + " WIB");
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // MESIN FETCH DATA TANGGUH (ANTI-BLANK)
  const fetchData = async () => {
    try {
      const { data: statusData } = await supabase.from('peringatan_dini').select('*').order('id', { ascending: false }).limit(1);
      if (statusData && statusData.length > 0) setGlobalStatus(statusData[0].status_level);

      // Tarik semua data tanpa takut error menghentikan aplikasi
      const { data: dataLaporan } = await supabase.from('laporan_darurat').select('*');
      const { data: dataPenugasan } = await supabase.from('penugasan_relawan').select('*');

      const allLaporan = dataLaporan || [];
      const allPenugasan = dataPenugasan || [];

      // Cari siapa saja yang SUDAH DITANGANI oleh Ops-Center
      const handledByLapangan = allPenugasan.filter(p => p.kontak_petugas === 'Ops-Center Nexus').map(p => p.nama_pelapor);

      // RADAR: Tampilkan yang BUKAN 'selesai' DAN BELUM ditangani Ops-Center
      const activeRadar = allLaporan.filter(l => l.status !== 'selesai' && !handledByLapangan.includes(l.nama_korban));
      setLaporanList(activeRadar.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));

      // RIWAYAT: Tampilkan yang SUDAH ditangani Ops-Center
      const myRiwayat = allLaporan.filter(l => handledByLapangan.includes(l.nama_korban));
      setRiwayatList(myRiwayat.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 10)); 

      const { data: shelterData } = await supabase.from('master_shelter').select('*').order('id_shelter', { ascending: true });
      if (shelterData) setShelterList(shelterData);
    } catch (error) {
      console.error("Gagal menarik data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const channelLaporan = supabase.channel('realtime_laporan')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laporan_darurat' }, () => { fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'penugasan_relawan' }, () => { fetchData(); })
      .subscribe();
      
    const channelStatus = supabase.channel('realtime_status')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'peringatan_dini' }, (payload) => {
        setGlobalStatus(payload.new.status_level);
        if (payload.new.status_level === 'KRITIS' && navigator.vibrate) navigator.vibrate([500, 200, 500]);
      }).subscribe();

    return () => { supabase.removeChannel(channelLaporan); supabase.removeChannel(channelStatus); };
  }, []);

  const injectDummyData = () => {
    const dummy = { id: Math.random(), nama_korban: "SIMULASI KORBAN " + Math.floor(Math.random() * 100), kontak_korban: "08123456789", latitude: (5.1812 + Math.random() * 0.01).toFixed(4), longitude: (97.1415 + Math.random() * 0.01).toFixed(4), status: 'darurat', photo_url: null, created_at: new Date().toISOString() };
    setLaporanList([dummy, ...laporanList]);
  };

  const handleEksekusi = async () => {
    if (!selectedLaporan || !actionType) return;
    if (actionType === 'SHELTER' && !selectedShelterId) { alert("Pilih shelter!"); return; }
    
    setIsProcessing(true);
    try {
      if (actionType === 'SHELTER') {
        const targetShelter = shelterList.find(s => s.id_shelter === selectedShelterId);
        if (targetShelter) await supabase.from('master_shelter').update({ kapasitas_terisi: targetShelter.kapasitas_terisi + 1 }).eq('id_shelter', selectedShelterId);
      }
      
      if (selectedLaporan.nama_korban.includes("SIMULASI")) {
        setLaporanList(laporanList.filter(l => l.id !== selectedLaporan.id));
        setRiwayatList([{ ...selectedLaporan, status: 'diproses' }, ...riwayatList]); 
      } else {
        // CEGAH SILENT ERROR!
        const { error: insErr } = await supabase.from('penugasan_relawan').insert([{
          nama_pelapor: selectedLaporan.nama_korban,
          nama_petugas: actionType === 'SHELTER' ? 'Tim Evakuasi Darat' : 'Unit Reaksi Cepat (URC)',
          kontak_petugas: 'Ops-Center Nexus'
        }]);
        
        if (insErr) {
          alert("GAGAL MENYIMPAN KE DATABASE! Pastikan tabel 'penugasan_relawan' sudah ada.");
          throw insErr;
        }

        await supabase.from('laporan_darurat').update({ status: 'diproses' }).eq('nama_korban', selectedLaporan.nama_korban);
      }

      setSelectedLaporan(null); setActionType(null); setSelectedShelterId(null);
      fetchData();
    } catch (error) { console.error("Error eksekusi:", error); } 
    finally { setIsProcessing(false); }
  };

  return (
    <main className="min-h-100dvh bg-[#04060c] text-white font-mono relative overflow-x-hidden pb-12">
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(34,211,238,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
      <div className={`fixed top-[-20%] left-[-10%] w-[50%] h-[50%] blur-[120px] rounded-full z-0 pointer-events-none transition-colors duration-1000 ${globalStatus === 'KRITIS' ? 'bg-red-900/20' : 'bg-cyan-900/20'}`}></div>

      <nav className="w-full bg-black/40 backdrop-blur-md border-b border-cyan-900/50 sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          <div className="relative flex h-4 w-4">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${globalStatus === 'KRITIS' ? 'bg-red-500' : 'bg-cyan-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-4 w-4 ${globalStatus === 'KRITIS' ? 'bg-red-600 shadow-[0_0_15px_#ef4444]' : 'bg-cyan-500 shadow-[0_0_15px_#22d3ee]'}`}></span>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.2em] uppercase text-white">NEXUS <span className="text-cyan-400">OPS-CENTER</span></h1>
            <p className="text-[9px] text-gray-400 tracking-widest mt-0.5">MANAJEMEN EVAKUASI TERPADU</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end border-r border-white/10 pr-6">
            <span className="text-[10px] text-gray-500 tracking-widest">LOCAL TIME (WIB)</span>
            <span className="text-sm font-bold text-cyan-400">{currentTime || "SYNCING..."}</span>
          </div>
          <button onClick={() => router.push('/')} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer">KELUAR OPS</button>
        </div>
      </nav>

      <div className="w-full max-w-6xl mx-auto px-6 mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/40 border border-white/10 p-4 rounded-xl backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-red-500/10 rounded-bl-full"></div>
            <p className="text-[10px] text-gray-500 tracking-widest">ACTIVE SOS</p>
            <p className="text-3xl font-black text-red-500 mt-1">{laporanList.length}</p>
          </div>
          <div className="bg-black/40 border border-white/10 p-4 rounded-xl backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-cyan-500/10 rounded-bl-full"></div>
            <p className="text-[10px] text-gray-500 tracking-widest">SHELTER TERSEDIA</p>
            <p className="text-3xl font-black text-cyan-400 mt-1">{shelterList.length}</p>
          </div>
          <div className="col-span-2 bg-black/40 border border-white/10 p-4 rounded-xl backdrop-blur-sm flex justify-between items-center">
            <div>
              <p className="text-[10px] text-gray-500 tracking-widest mb-1">SYSTEM STATUS</p>
              <p className={`text-xs font-bold flex items-center gap-2 ${globalStatus === 'KRITIS' ? 'text-red-500' : 'text-emerald-400'}`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${globalStatus === 'KRITIS' ? 'bg-red-500' : 'bg-emerald-500'}`}></span> 
                {globalStatus === 'KRITIS' ? 'CRITICAL ALERT ACTIVE' : 'ONLINE & SECURE'}
              </p>
            </div>
            <button onClick={injectDummyData} className="px-3 py-1.5 border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-white rounded text-[9px] tracking-widest transition-all cursor-pointer">+ SIMULASI SOS</button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-xs font-bold tracking-[0.2em] text-white">RADAR MONITORING</h2>
          <div className={`flex-1 h-px bg-gradient-to-r to-transparent ${globalStatus === 'KRITIS' ? 'from-red-900/50' : 'from-cyan-900/50'}`}></div>
        </div>

        {laporanList.length === 0 ? (
          <div className={`w-full h-80 bg-black/30 border rounded-2xl flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-sm transition-colors duration-500 ${globalStatus === 'KRITIS' ? 'border-red-500/30 shadow-[inset_0_0_50px_rgba(239,68,68,0.1)]' : 'border-white/5'}`}>
            <div className="relative w-48 h-48 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full border ${globalStatus === 'KRITIS' ? 'border-red-900/40' : 'border-cyan-900/30'}`}></div>
              <div className={`absolute w-32 h-32 rounded-full border ${globalStatus === 'KRITIS' ? 'border-red-800/40' : 'border-cyan-800/30'}`}></div>
              <div className={`absolute w-16 h-16 rounded-full border animate-ping ${globalStatus === 'KRITIS' ? 'border-red-500/60' : 'border-cyan-500/50'}`}></div>
              <div className={`absolute w-full h-full rounded-full border-t animate-[spin_3s_linear_infinite] opacity-50 ${globalStatus === 'KRITIS' ? 'border-red-500 shadow-[0_0_15px_#ef4444]' : 'border-cyan-400 shadow-[0_0_15px_#22d3ee]'}`}></div>
              <div className={`w-2 h-2 rounded-full ${globalStatus === 'KRITIS' ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]'}`}></div>
            </div>
            <div className="mt-8 text-center z-10">
              <p className={`text-sm font-black tracking-[0.3em] uppercase ${globalStatus === 'KRITIS' ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>{globalStatus === 'KRITIS' ? 'ANCAMAN TERDETEKSI' : 'ZONA AMAN TERKENDALI'}</p>
              <p className={`text-[10px] tracking-widest mt-2 uppercase ${globalStatus === 'KRITIS' ? 'text-red-400' : 'text-gray-500'}`}>{globalStatus === 'KRITIS' ? 'PERINGATAN DARURAT AKTIF. SIAGA EVAKUASI!' : 'Sistem radar memindai anomali...'}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {laporanList.map((laporan, idx) => (
              <div key={idx} className="bg-[#0a0f18] border border-red-500/30 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-bl-full blur-2xl pointer-events-none group-hover:bg-red-600/20 transition-all"></div>
                <div className="flex justify-between items-start z-10">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-500/50 flex items-center justify-center"><span className="text-xl">⚠️</span></div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-widest">{laporan.nama_korban}</h3>
                      <p className="text-[11px] text-gray-400 font-sans mt-0.5">Kontak: <span className="text-red-400">{laporan.kontak_korban || 'Tidak tersedia'}</span></p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold tracking-widest border border-red-500 text-red-400 px-2 py-1 rounded bg-red-950/30 animate-pulse">URGENT</span>
                </div>
                <div className="grid grid-cols-2 gap-3 z-10">
                  <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-gray-500 tracking-widest mb-1 uppercase">Koordinat Lintang</p>
                    <p className="text-xs text-cyan-400 font-sans font-bold">{laporan.latitude}</p>
                  </div>
                  <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                    <p className="text-[9px] text-gray-500 tracking-widest mb-1 uppercase">Koordinat Bujur</p>
                    <p className="text-xs text-cyan-400 font-sans font-bold">{laporan.longitude}</p>
                  </div>
                </div>
                {laporan.photo_url && (
                  <div className="w-full h-32 rounded-xl border border-white/10 overflow-hidden relative z-10 group-hover:border-red-500/50 transition-all">
                    <img src={laporan.photo_url} alt="Bukti Visual" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-500" />
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur border border-white/20 px-2 py-0.5 rounded text-[8px] tracking-widest text-white">AI VISION LOG</div>
                  </div>
                )}
                <button onClick={() => setSelectedLaporan(laporan)} className="w-full py-3.5 bg-red-600/90 hover:bg-red-500 text-white text-[11px] font-black tracking-[0.3em] rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] mt-2 cursor-pointer z-10 border border-red-400/50">
                  INISIASI PENYELAMATAN
                </button>
              </div>
            ))}
          </div>
        )}

        {/* LOG RIWAYAT */}
        {riwayatList.length > 0 && (
          <div className="mt-12">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xs font-bold tracking-[0.2em] text-gray-500">LOG RIWAYAT PENYELAMATAN</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-800 to-transparent"></div>
            </div>
            <div className="flex flex-col gap-3">
              {riwayatList.map((riwayat, idx) => (
                <div key={idx} className="bg-black/40 border border-white/5 p-4 rounded-xl flex justify-between items-center hover:bg-white/5 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${riwayat.status === 'selesai' ? 'bg-emerald-950/50 border border-emerald-500/50 text-emerald-400' : 'bg-amber-950/50 border border-amber-500/50 text-amber-400'}`}>
                      {riwayat.status === 'selesai' ? '✓' : '⚡'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white uppercase">{riwayat.nama_korban}</p>
                      <p className="text-[10px] text-gray-500 font-sans mt-0.5">
                        {new Date(riwayat.created_at || Date.now()).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded text-[9px] font-bold tracking-widest ${riwayat.status === 'selesai' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-amber-900/30 text-amber-400 border border-amber-500/30 animate-pulse'}`}>
                    {riwayat.status === 'selesai' ? 'KORBAN BERHASIL DIEVAKUASI' : 'UNIT DALAM PERJALANAN'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedLaporan && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0a0a14] border border-cyan-500/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.15)] animate-in zoom-in duration-200">
            <div className="bg-cyan-950/40 p-5 border-b border-cyan-500/30 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black tracking-widest text-cyan-400">PROTOKOL PENYELAMATAN</h3>
                <p className="text-[10px] text-gray-400 mt-1 uppercase">Target: {selectedLaporan.nama_korban}</p>
              </div>
              <button onClick={() => { setSelectedLaporan(null); setActionType(null); setSelectedShelterId(null); }} className="text-gray-400 hover:text-white cursor-pointer w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 transition-all">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLaporan.latitude},${selectedLaporan.longitude}`} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-blue-900/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-400 rounded-xl text-[10px] font-bold tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> BUKA RUTE GOOGLE MAPS
              </a>
              <div>
                <p className="text-[10px] text-gray-400 tracking-widest mb-3 mt-[-10px]">METODE PENANGANAN:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setActionType('SHELTER')} className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all cursor-pointer ${actionType === 'SHELTER' ? 'bg-cyan-900/40 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                    <span className="text-2xl">🏥</span><span className="text-[10px] font-bold tracking-widest text-center">EVAKUASI SHELTER</span>
                  </button>
                  <button onClick={() => { setActionType('RUMAH'); setSelectedShelterId(null); }} className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all cursor-pointer ${actionType === 'RUMAH' ? 'bg-emerald-900/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                    <span className="text-2xl">🏠</span><span className="text-[10px] font-bold tracking-widest text-center">BANTUAN DI TEMPAT</span>
                  </button>
                </div>
              </div>
              {actionType === 'SHELTER' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <p className="text-[10px] text-gray-400 tracking-widest mb-3">PILIH SHELTER TUJUAN:</p>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {shelterList.map(s => {
                      const pct = (s.kapasitas_terisi / s.kapasitas_maksimal) * 100;
                      return (
                        <button key={s.id_shelter} disabled={pct >= 100} onClick={() => setSelectedShelterId(s.id_shelter)} className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-2 cursor-pointer ${pct >= 100 ? 'opacity-50 cursor-not-allowed bg-black/50 border-red-900' : selectedShelterId === s.id_shelter ? 'bg-cyan-950/50 border-cyan-400 shadow-[inset_0_0_20px_rgba(34,211,238,0.2)]' : 'bg-black/40 border-white/10 hover:border-cyan-500/30'}`}>
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-white">{s.nama_shelter}</span><span className="text-[10px] font-sans text-gray-400">{s.kapasitas_terisi} / {s.kapasitas_maksimal}</span></div>
                          <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden"><div className={`h-full ${pct >= 100 ? 'bg-red-600' : selectedShelterId === s.id_shelter ? 'bg-cyan-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }}></div></div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <button disabled={!actionType || isProcessing} onClick={handleEksekusi} className={`w-full py-4 rounded-xl text-[11px] font-black tracking-[0.3em] transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer border ${!actionType ? 'bg-gray-900/50 text-gray-600 border-white/5 cursor-not-allowed' : actionType === 'RUMAH' ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-cyan-600/90 hover:bg-cyan-500 text-white border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]'}`}>
                {isProcessing ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : <>EKSEKUSI SEKARANG</>}
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34,211,238,0.3); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34,211,238,0.6); } `}</style>
    </main>
  );
}