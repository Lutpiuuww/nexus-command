"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function UnitMedis() {
  const router = useRouter();
  const [laporanList, setLaporanList] = useState<any[]>([]);
  const [riwayatList, setRiwayatList] = useState<any[]>([]); 
  const [shelterList, setShelterList] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<string>("");
  
  // STATE BARU: Radar Peringatan & Episentrum
  const [globalStatus, setGlobalStatus] = useState<'AMAN' | 'KRITIS'>('AMAN');
  const [disasterInfo, setDisasterInfo] = useState<{ jenis: string, lat: number, lon: number, radius: number } | null>(null);

  const [selectedLaporan, setSelectedLaporan] = useState<any | null>(null);
  const [triageLevel, setTriageLevel] = useState<'MERAH' | 'KUNING' | 'HIJAU' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dialog, setDialog] = useState({ show: false, title: '', message: '' });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour12: false }) + " WIB");
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      // 1. Tarik Data Radar Bencana
      const { data: statusData } = await supabase.from('peringatan_dini').select('*').order('id', { ascending: false }).limit(1);
      if (statusData && statusData.length > 0) {
        setGlobalStatus(statusData[0].status_level);
        if (statusData[0].status_level === 'KRITIS') {
          setDisasterInfo({
            jenis: statusData[0].jenis_bencana || 'ANCAMAN',
            lat: statusData[0].lat_bencana,
            lon: statusData[0].lon_bencana,
            radius: statusData[0].radius_km
          });
        }
      }

      // 2. Tarik Laporan Korban
      const { data: dataLaporan } = await supabase.from('laporan_darurat').select('*');
      const { data: dataPenugasan } = await supabase.from('penugasan_relawan').select('*');
      const allLaporan = dataLaporan || [];
      const allPenugasan = dataPenugasan || [];
      const handledByMedis = allPenugasan.filter(p => p.kontak_petugas === 'RS Darurat Lhokseumawe').map(p => p.nama_pelapor);
      
      const activeRadar = allLaporan.filter(l => l.status !== 'selesai' && !handledByMedis.includes(l.nama_korban));
      setLaporanList(activeRadar.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
      
      const myRiwayat = allLaporan.filter(l => handledByMedis.includes(l.nama_korban));
      setRiwayatList(myRiwayat.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 10)); 
      
      const { data: shelterData } = await supabase.from('master_shelter').select('*').order('id_shelter', { ascending: true });
      if (shelterData) setShelterList(shelterData);
    } catch (error) {
      console.error("Gagal menarik data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const channelLaporan = supabase.channel('medis_laporan')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laporan_darurat' }, () => { fetchData(); if (navigator.vibrate) navigator.vibrate([300, 100, 300]); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'penugasan_relawan' }, () => { fetchData(); })
      .subscribe();

    // CHANNEL BARU: Mendengarkan Alarm Bencana
    const channelStatus = supabase.channel('medis_status')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'peringatan_dini' }, (payload) => {
        setGlobalStatus(payload.new.status_level);
        if (payload.new.status_level === 'KRITIS') {
          setDisasterInfo({
            jenis: payload.new.jenis_bencana || 'ANCAMAN',
            lat: payload.new.lat_bencana,
            lon: payload.new.lon_bencana,
            radius: payload.new.radius_km
          });
          if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
        } else {
          setDisasterInfo(null);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channelLaporan); supabase.removeChannel(channelStatus); };
  }, []);

  const handleTriage = async () => {
    if (!selectedLaporan || !triageLevel) return;
    setIsProcessing(true);
    
    try {
      if (selectedLaporan.nama_korban.includes("SIMULASI")) {
        setLaporanList(laporanList.filter(l => l.id !== selectedLaporan.id));
        setRiwayatList([{ ...selectedLaporan, status: 'diproses' }, ...riwayatList]);
      } else {
        const { error: insErr } = await supabase.from('penugasan_relawan').insert([{
          nama_pelapor: selectedLaporan.nama_korban,
          nama_petugas: `Tim Medis (Kategori ${triageLevel})`,
          kontak_petugas: 'RS Darurat Lhokseumawe'
        }]);
        if (insErr) {
          alert(`❌ ERROR DARI SUPABASE:\n${insErr.message}\n\nDetail: ${insErr.details || 'Tidak ada detail'}\nKode: ${insErr.code}`);
          setIsProcessing(false);
          return; 
        }
        await supabase.from('laporan_darurat').update({ status: 'diproses' }).eq('nama_korban', selectedLaporan.nama_korban);
      }
      
      const namaTarget = selectedLaporan.nama_korban;
      const kategoriTriage = triageLevel;
      
      setSelectedLaporan(null); setTriageLevel(null);
      fetchData();
      setDialog({
        show: true,
        title: 'AMBULANS DIKERAHKAN!',
        message: `Tim medis darurat (Triase ${kategoriTriage}) sedang dalam perjalanan menuju lokasi ${namaTarget}. Sinyal GPS telah dikirim ke perangkat korban.`
      });
    } catch (error) { console.error("Error eksekusi medis:", error); } 
    finally { setIsProcessing(false); }
  };

  return (
    <main className="min-h-100dvh bg-[#04060c] text-white font-mono relative overflow-x-hidden pb-12">
      {/* Background Dinamis */}
      <div className="fixed inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(16,185,129,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.1)_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
      <div className={`fixed top-[-20%] right-[-10%] w-[50%] h-[50%] blur-[120px] rounded-full z-0 pointer-events-none transition-colors duration-1000 ${globalStatus === 'KRITIS' ? 'bg-red-900/20' : 'bg-emerald-900/10'}`}></div>
      
      <nav className={`w-full backdrop-blur-md border-b sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-colors duration-500 ${globalStatus === 'KRITIS' ? 'bg-red-950/40 border-red-900/50' : 'bg-black/40 border-emerald-900/50'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${globalStatus === 'KRITIS' ? 'bg-red-950/50 border border-red-500/50 text-red-400' : 'bg-emerald-950/50 border border-emerald-500/50 text-emerald-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.2em] uppercase text-white">UNIT <span className={globalStatus === 'KRITIS' ? 'text-red-400' : 'text-emerald-400'}>MEDIS</span></h1>
            <p className="text-[9px] text-gray-400 tracking-widest mt-0.5">DR. RAFFA & DR. AINI | OTORISASI AKTIF</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end border-r border-white/10 pr-6">
            <span className="text-[10px] text-gray-500 tracking-widest">WAKTU OPERASIONAL</span>
            <span className={`text-sm font-bold ${globalStatus === 'KRITIS' ? 'text-red-400' : 'text-emerald-400'}`}>{currentTime || "SYNCING..."}</span>
          </div>
          <button onClick={() => router.push('/')} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all cursor-pointer">LOGOUT</button>
        </div>
      </nav>

      <div className="w-full max-w-[1400px] mx-auto px-6 mt-8 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2">
          
          {/* PANEL BARU: PERINGATAN DARURAT MEDIS */}
          {globalStatus === 'KRITIS' && disasterInfo && (
            <div className="mb-6 bg-red-950/20 border-2 border-red-500 rounded-xl p-5 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-in slide-in-from-top-2 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-sm font-black tracking-widest text-red-500 uppercase flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-ping inline-block"></span>
                  PERINGATAN {disasterInfo.jenis}
                </h2>
                <p className="text-xs text-red-300 mt-1">
                  Pusat bencana berada di koordinat <span className="font-bold text-white">{disasterInfo.lat}, {disasterInfo.lon}</span>. <br/>
                  <span className="font-bold">Siagakan peralatan trauma & triase medis sesuai dengan profil ancaman!</span>
                </p>
              </div>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${disasterInfo.lat},${disasterInfo.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-red-600 hover:bg-red-500 text-white border border-red-400/50 px-6 py-3 rounded-lg text-[10px] font-bold tracking-widest cursor-pointer shadow-lg whitespace-nowrap"
              >
                🗺️ LOKASI PUSAT BENCANA
              </a>
            </div>
          )}

          <div className="mb-4 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${globalStatus === 'KRITIS' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
            <h2 className="text-xs font-bold tracking-[0.2em] text-white">PANGGILAN DARURAT MEDIS</h2>
            <div className={`flex-1 h-px bg-gradient-to-r to-transparent ${globalStatus === 'KRITIS' ? 'from-red-900/50' : 'from-emerald-900/50'}`}></div>
          </div>

          {laporanList.length === 0 ? (
            <div className={`w-full h-64 bg-black/30 border rounded-2xl flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-sm transition-colors duration-500 ${globalStatus === 'KRITIS' ? 'border-red-500/30' : 'border-white/5'}`}>
              <div className={`${globalStatus === 'KRITIS' ? 'text-red-500/30' : 'text-emerald-500/30'} text-5xl mb-4`}>🏥</div>
              <p className={`text-sm font-black tracking-[0.3em] uppercase ${globalStatus === 'KRITIS' ? 'text-red-400' : 'text-emerald-400'}`}>TIDAK ADA PASIEN DARURAT</p>
              <p className="text-[10px] text-gray-500 tracking-widest mt-2 uppercase">Tim medis dalam posisi siaga penuh.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {laporanList.map((laporan, idx) => (
                <div key={idx} className="bg-[#0a0f18] border border-emerald-500/20 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-full blur-xl pointer-events-none"></div>
                  <div className="flex justify-between items-start z-10">
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-widest">{laporan.nama_korban}</h3>
                      <p className="text-[10px] text-gray-400 font-sans mt-1">📞 {laporan.kontak_korban || 'Tidak tersedia'}</p>
                    </div>
                    <span className="text-[9px] font-bold tracking-widest bg-red-900/30 border border-red-500 text-red-400 px-2 py-1 rounded animate-pulse">TRIASE DIBUTUHKAN</span>
                  </div>
                  {laporan.photo_url && (
                    <div className="w-full h-24 rounded-lg border border-white/10 overflow-hidden relative z-10">
                      <img src={laporan.photo_url} alt="Kondisi Pasien" className="w-full h-full object-cover opacity-80" />
                    </div>
                  )}
                  <button onClick={() => setSelectedLaporan(laporan)} className="w-full py-3 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-[10px] font-black tracking-[0.2em] rounded-lg transition-all border border-emerald-500/50 mt-2 cursor-pointer z-10">
                    TINDAKAN MEDIS
                  </button>
                </div>
              ))}
            </div>
          )}

          {riwayatList.length > 0 && (
            <div className="mt-10">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-xs font-bold tracking-[0.2em] text-gray-500">LOG TINDAKAN MEDIS</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-800 to-transparent"></div>
              </div>
              <div className="flex flex-col gap-3">
                {riwayatList.map((riwayat, idx) => (
                  <div key={idx} className="bg-black/40 border border-white/5 p-4 rounded-xl flex justify-between items-center hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${riwayat.status === 'selesai' ? 'bg-emerald-950/50 border border-emerald-500/50 text-emerald-400' : 'bg-amber-950/50 border border-amber-500/50 text-amber-400'}`}>
                        {riwayat.status === 'selesai' ? '✓' : '🚑'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white uppercase">{riwayat.nama_korban}</p>
                        <p className="text-[10px] text-gray-500 font-sans mt-0.5">
                          {riwayat.created_at ? new Date(riwayat.created_at).toLocaleString('id-ID') : 'Baru saja'}
                        </p>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded text-[9px] font-bold tracking-widest ${riwayat.status === 'selesai' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-amber-900/30 text-amber-400 border border-amber-500/30 animate-pulse'}`}>
                      {riwayat.status === 'selesai' ? 'PASIEN BERHASIL DIEVAKUASI' : 'AMBULANS DALAM PERJALANAN'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="mb-4 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <h2 className="text-xs font-bold tracking-[0.2em] text-white">KAPASITAS POSKO</h2>
          </div>
          <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-4 flex flex-col gap-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {shelterList.map(s => {
              const pct = (s.kapasitas_terisi / s.kapasitas_maksimal) * 100;
              const color = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-500';
              return (
                <div key={s.id_shelter} className="bg-black/40 border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-gray-200 text-[11px] leading-relaxed">{s.nama_shelter}</h4>
                    <span className="text-[9px] font-sans bg-black/50 border border-white/10 text-gray-300 px-2 py-1 rounded-md">{s.kapasitas_terisi}/{s.kapasitas_maksimal}</span>
                  </div>
                  <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedLaporan && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0a0a14] border border-emerald-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)]">
            <div className="bg-emerald-950/40 p-5 border-b border-emerald-500/30 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black tracking-widest text-emerald-400">PROTOKOL TRIASE</h3>
                <p className="text-[10px] text-gray-400 mt-1 uppercase">Pasien: {selectedLaporan.nama_korban}</p>
              </div>
              <button onClick={() => { setSelectedLaporan(null); setTriageLevel(null); }} className="text-gray-400 hover:text-white cursor-pointer w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 transition-all">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLaporan.latitude},${selectedLaporan.longitude}`} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-blue-900/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-400 rounded-xl text-[10px] font-bold tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer">LOKASI PASIEN (GOOGLE MAPS)</a>
              <div>
                <p className="text-[10px] text-gray-400 tracking-widest mb-3">KLASIFIKASI PRIORITAS (TRIASE):</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => setTriageLevel('MERAH')} className={`p-4 rounded-xl border flex items-center gap-4 transition-all cursor-pointer ${triageLevel === 'MERAH' ? 'bg-red-900/40 border-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.3)]' : 'bg-black/40 border-white/10 hover:border-red-500/30'}`}>
                    <div className="w-4 h-4 rounded-full bg-red-600 shadow-[0_0_10px_#ef4444]"></div>
                    <div className="text-left"><p className="text-xs font-bold text-white tracking-widest">KATEGORI MERAH (KRITIS)</p><p className="text-[9px] text-gray-400 mt-1">Ancaman jiwa. Kirim Ambulans segera.</p></div>
                  </button>
                  <button onClick={() => setTriageLevel('KUNING')} className={`p-4 rounded-xl border flex items-center gap-4 transition-all cursor-pointer ${triageLevel === 'KUNING' ? 'bg-amber-900/40 border-amber-500 shadow-[inset_0_0_20px_rgba(245,158,11,0.3)]' : 'bg-black/40 border-white/10 hover:border-amber-500/30'}`}>
                    <div className="w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_10px_#f59e0b]"></div>
                    <div className="text-left"><p className="text-xs font-bold text-white tracking-widest">KATEGORI KUNING (BERAT)</p><p className="text-[9px] text-gray-400 mt-1">Butuh pertolongan, tapi tidak mengancam nyawa seketika.</p></div>
                  </button>
                  <button onClick={() => setTriageLevel('HIJAU')} className={`p-4 rounded-xl border flex items-center gap-4 transition-all cursor-pointer ${triageLevel === 'HIJAU' ? 'bg-emerald-900/40 border-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.3)]' : 'bg-black/40 border-white/10 hover:border-emerald-500/30'}`}>
                    <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
                    <div className="text-left"><p className="text-xs font-bold text-white tracking-widest">KATEGORI HIJAU (RINGAN)</p><p className="text-[9px] text-gray-400 mt-1">Cidera ringan. Bisa diarahkan ke P3K Shelter.</p></div>
                  </button>
                </div>
              </div>
              <button disabled={!triageLevel || isProcessing} onClick={handleTriage} className={`w-full py-4 rounded-xl text-[11px] font-black tracking-[0.3em] transition-all flex items-center justify-center gap-2 mt-2 border cursor-pointer ${!triageLevel ? 'bg-gray-900/50 text-gray-600 border-white/5 cursor-not-allowed' : 'bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}>
                {isProcessing ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : <>KIRIM TIM MEDIS</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0a0a14] border-2 border-emerald-500/50 rounded-2xl w-full max-w-xs p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)] transform transition-all">
            <h3 className="text-sm font-black tracking-widest uppercase mb-3 text-emerald-400">{dialog.title}</h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans mb-6">{dialog.message}</p>
            <div className="flex justify-end mt-4">
              <button onClick={() => setDialog({ show: false, title: '', message: '' })} className="w-full py-3 rounded-xl text-xs font-bold tracking-widest text-white transition-all shadow-lg cursor-pointer bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50">MENGERTI</button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.3); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.6); } `}</style>
    </main>
  );
}