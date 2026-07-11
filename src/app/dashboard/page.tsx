"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function CommandCenter() {
  const [targetLoc, setTargetLoc] = useState({ lat: 5.1812, lon: 97.1415 });
  const [logs, setLogs] = useState<{id: number, type: string, msg: string, time: string}[]>([]);
  const [safeCount, setSafeCount] = useState(0);
  const [showPersonnel, setShowPersonnel] = useState(false);
  const [showShelter, setShowShelter] = useState(false);
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [shelterList, setShelterList] = useState<any[]>([]);
  
  // Array untuk menyimpan BANYAK laporan sekaligus
  const [laporanList, setLaporanList] = useState<any[]>([]);

  const [dialog, setDialog] = useState<{
    show: boolean; type: 'alert' | 'confirm'; theme: 'red' | 'emerald' | 'cyan'; title: string; message: string;
    onConfirm?: () => void;
  }>({ show: false, type: 'alert', theme: 'cyan', title: '', message: '' });

  // Status Peta sekarang OTOMATIS mendeteksi keseluruhan data
  const adaDarurat = laporanList.some(l => l.status === 'darurat');
  const adaAman = laporanList.some(l => l.status === 'selesai');
  const mapStatus = adaDarurat ? 'SOS' : (adaAman ? 'SAFE' : 'IDLE');

  const addLog = (type: string, msg: string) => {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    setLogs(prev => [{ id: Date.now() + Math.random(), type, msg, time }, ...prev].slice(0, 10));
  };

  const fetchDashboardData = async () => {
    const { data: pData } = await supabase.from("aktor_sistem").select("*");
    if (pData) setPersonnelList(pData);
    
    const { data: sData } = await supabase.from("master_shelter").select("*");
    if (sData) setShelterList(sData);
    
    const { count } = await supabase.from("warga_aman").select('*', { count: 'exact', head: true });
    if (count !== null) setSafeCount(count);

    // Ambil SEMUA data Laporan
    const { data: lapData } = await supabase.from("laporan_darurat").select("*").order('id_laporan', { ascending: false });
    if (lapData) {
      setLaporanList(lapData);
      // Geser kamera peta ke lokasi SOS paling baru, jika kosong kembalikan ke Lhokseumawe default
      if (lapData.length > 0) {
        setTargetLoc({ lat: Number(lapData[0].latitude), lon: Number(lapData[0].longitude) });
      } else {
        setTargetLoc({ lat: 5.1812, lon: 97.1415 });
      }
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const laporanChannel = supabase.channel('listen_laporan')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laporan_darurat' }, (payload) => {
        fetchDashboardData(); // Tarik ulang data agar semua titik ter-refresh
        
        if (payload.eventType === 'INSERT') {
          new Audio('/siren.mp3').play().catch(e => console.log("Audio autoplay blocked"));
          addLog('SOS', `Sinyal MASUK dari ${payload.new.nama_korban}`);
        } else if (payload.eventType === 'UPDATE' && payload.new.status === 'selesai') {
          addLog('SAFE', `Warga ${payload.new.nama_korban} konfirmasi AMAN.`);
        }
      }).subscribe();

    const safeChannel = supabase.channel('listen_safe')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'warga_aman' }, (payload) => {
        setSafeCount(prev => prev + 1);
      }).subscribe();

    return () => { 
      supabase.removeChannel(laporanChannel); 
      supabase.removeChannel(safeChannel); 
    };
  }, []);

  const handleDispatch = async () => {
    addLog('DISPATCH', 'Menganalisis unit lapangan terdekat...');

    const petugas = personnelList.find(p => p.peran?.toLowerCase().includes('lapangan') || p.peran?.toLowerCase().includes('relawan'))
      || { nama_lengkap: "Salman Al-Farisi (Koord. Relawan)", nomor_telepon: "0813-0000-3333" };
    
    // Dispatch untuk korban darurat terbaru
    const daruratList = laporanList.filter(l => l.status === 'darurat');
    let namaPelapor = "Warga (Sinyal GPS)";
    let kontakPelapor = "Anonim";

    if (daruratList.length > 0) {
      namaPelapor = daruratList[0].nama_korban || "Warga (Sinyal GPS)";
      kontakPelapor = daruratList[0].kontak_korban || "Anonim";
    }

    const { error } = await supabase.from("penugasan_relawan").insert([{
      nama_petugas: petugas.nama_lengkap, kontak_petugas: petugas.nomor_telepon,
      nama_pelapor: namaPelapor, kontak_pelapor: kontakPelapor
    }]);

    if (error) { setDialog({ show: true, type: 'alert', theme: 'red', title: 'DISPATCH GAGAL', message: error.message }); return; }

    setTimeout(() => {
      setDialog({
        show: true, type: 'alert', theme: 'cyan', title: 'UNIT BERHASIL DIKERAHKAN',
        message: `Petugas: ${petugas.nama_lengkap} (Kontak: ${petugas.nomor_telepon}) telah menerima instruksi evakuasi.`
      });
      addLog('SYSTEM', `Unit diberangkatkan: ${petugas.nama_lengkap}.`);
    }, 1500);
  };

  const executeMassBroadcast = async () => {
    setDialog({ ...dialog, show: false }); addLog('SYSTEM', 'Mengaktifkan Sirine...');
    const { error } = await supabase.from("peringatan_dini").insert([{ status_level: 'KRITIS', pesan: '🚨 PERINGATAN DARURAT: Anomali terdeteksi. Lakukan evakuasi SEKARANG!' }]);
    if (error) setDialog({ show: true, type: 'alert', theme: 'red', title: 'BROADCAST GAGAL', message: error.message });
    else setDialog({ show: true, type: 'alert', theme: 'red', title: 'ALARM AKTIF', message: 'Seluruh layar portal warga sekarang berubah menjadi Peringatan Merah.' });
  };

  const handleMassBroadcast = () => setDialog({ show: true, type: 'confirm', theme: 'red', title: '⚠️ OTORISASI TINGGI', message: 'Anda akan menyalakan Sirine Evakuasi Massal ke perangkat warga. Lanjutkan?', onConfirm: executeMassBroadcast });

  const executeDeactivateSiren = async () => {
    setDialog({ ...dialog, show: false }); addLog('SYSTEM', 'Mencabut peringatan...');
    const { error } = await supabase.from("peringatan_dini").insert([{ status_level: 'AMAN', pesan: 'Tidak ada anomali terdeteksi. Kondisi aman terkendali.' }]);
    if (error) setDialog({ show: true, type: 'alert', theme: 'red', title: 'RESET GAGAL', message: error.message });
    else { setDialog({ show: true, type: 'alert', theme: 'emerald', title: 'SISTEM KEMBALI AMAN', message: 'Layar warga di-reset kembali aman.' }); }
  };

  const handleDeactivateSiren = () => setDialog({ show: true, type: 'confirm', theme: 'emerald', title: 'CABUT PERINGATAN?', message: 'Cabut peringatan darurat dan kembalikan sistem ke mode AMAN?', onConfirm: executeDeactivateSiren });

  // ==========================================
  // FITUR BARU: RESET DEMO (MENGHAPUS RIWAYAT)
  // ==========================================
  const executeResetData = async () => {
    setDialog({ ...dialog, show: false });
    addLog('SYSTEM', 'Membersihkan riwayat radar...');
    
    // Hapus semua data simulasi sebelumnya dari database
    await supabase.from('laporan_darurat').delete().neq('id_laporan', 0); // asumsi id_laporan > 0
    await supabase.from('penugasan_relawan').delete().neq('id_tugas', 0);
    
    fetchDashboardData();
    setDialog({ show: true, type: 'alert', theme: 'emerald', title: 'RADAR BERSIH', message: 'Semua data riwayat sebelumnya telah dihapus. Peta kembali bersih untuk presentasi.' });
  };

  const handleResetData = () => setDialog({ show: true, type: 'confirm', theme: 'red', title: '⚠️ RESET DATA SIMULASI?', message: 'Tindakan ini akan menghapus permanen SEMUA riwayat titik SOS dan Aman di database agar peta bersih kembali. Gunakan ini sebelum memulai demo presentasi. Lanjutkan?', onConfirm: executeResetData });


  // MATEMATIKA KOORDINAT MULTI-MARKER
  const MAP_SPAN = 0.06; // Radius pandangan diperluas menjadi sekitar 6-8 Kilometer
  const minLon = targetLoc.lon - MAP_SPAN;
  const maxLon = targetLoc.lon + MAP_SPAN;
  const minLat = targetLoc.lat - MAP_SPAN;
  const maxLat = targetLoc.lat + MAP_SPAN;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon},${minLat},${maxLon},${maxLat}&layer=mapnik`;

  return (
    <main className="h-screen w-full bg-[#06060c] text-white p-4 lg:p-6 font-sans flex flex-col lg:flex-row items-stretch gap-6 overflow-hidden relative">

      <section className="w-full lg:w-1/4 flex flex-col gap-3 z-10">
        <div className="flex-1 min-h-200px lg:min-h-0 border border-white/10 bg-black/40 rounded-2xl p-4 lg:p-5 flex flex-col shadow-lg">
          <h2 className="text-cyan-400 font-bold tracking-widest flex items-center gap-2 mb-4"><div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div> ANALYTICS</h2>
          <div className="flex-1 text-xs text-gray-400 flex flex-col gap-2 overflow-y-auto pr-2">
            <p className="text-emerald-400 font-bold">{'>'} Total Selamat: {safeCount} Jiwa</p>
            {mapStatus === 'SOS' ? <p className="text-red-500 animate-pulse font-bold">{'>'} WARNING: SOS Aktif!</p> : mapStatus === 'SAFE' ? 
            <p className="text-emerald-400">{'>'} Memantau zona aman terkonfirmasi...</p> : <p>{'>'} ZONA AMAN: Menunggu pergerakan sinyal...</p>}
          </div>
        </div>
        <button onClick={() => { fetchDashboardData(); setShowPersonnel(true); }} className="w-full py-3 border border-white/10 bg-white/5 rounded-xl text-[10px] sm:text-[11px] tracking-widest transition-colors hover:bg-white/10 cursor-pointer">ACTIVE PERSONNEL ROSTER</button>
        <button onClick={() => { fetchDashboardData(); setShowShelter(true); }} className="w-full py-3 border border-white/10 bg-white/5 rounded-xl text-[10px] sm:text-[11px] tracking-widest transition-colors hover:bg-white/10 cursor-pointer">SHELTER CAPACITY MONITOR</button>
        <div className="flex flex-col gap-2 mt-2">
          <button onClick={handleMassBroadcast} className="w-full py-3 border border-red-500/50 bg-red-950/30 rounded-xl text-[10px] sm:text-[11px] text-red-400 font-bold flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)] cursor-pointer"><div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div> ACTIVATE MASS SIREN</button>
          <button onClick={handleDeactivateSiren} className="w-full py-3 border border-emerald-500/30 bg-emerald-950/20 rounded-xl text-[10px] text-emerald-500 font-bold cursor-pointer">DEACTIVATE ALARM (SET SAFE)</button>
          
          {/* TOMBOL RESET DEMO (BARU) */}
          <button onClick={handleResetData} className="w-full py-2 mt-2 border border-gray-500/30 bg-gray-900/50 hover:bg-gray-800 rounded-xl text-[9px] text-gray-400 font-bold cursor-pointer transition-colors">
            🔄 RESET RADAR (BERSIHKAN PETA)
          </button>
        </div>
      </section>

      <section className="w-full lg:w-2/4 min-h-400px lg:min-h-0 relative border border-white/10 rounded-2xl overflow-hidden bg-black/50 shadow-2xl z-10 flex-1">
        <div className="absolute top-4 left-4 z-30">
          {mapStatus === 'SOS' ? (
            <div className="bg-red-950/80 border border-red-500 text-red-400 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-2 animate-pulse backdrop-blur-md">ZONA KRITIS: SOS AKTIF</div>
          ) : mapStatus === 'SAFE' ? (
            <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-2 backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.3)]">ZONA TERKONFIRMASI AMAN</div>
          ) : (
            <div className="bg-black/80 border border-white/20 text-gray-400 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-2 backdrop-blur-md">ZONA PANTAUAN STANDBY</div>
          )}
        </div>
        
        <div className="w-full h-full absolute inset-0 pointer-events-none">
          <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={mapUrl} className="w-full h-full" style={{ filter: "invert(100%) hue-rotate(180deg) brightness(80%) contrast(120%)" }}></iframe>
          
          {/* RENDERING BANYAK TITIK BERDASARKAN LATITUDE & LONGITUDE */}
          {laporanList.map((lap, index) => {
            const lat = Number(lap.latitude);
            const lon = Number(lap.longitude);
            const isAman = lap.status === 'selesai';

            // Jangan gambar titik jika di luar radius pandangan kamera
            if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return null;

            // Terjemahkan Lat/Lon ke Persentase X/Y Layar
            const xPos = ((lon - minLon) / (MAP_SPAN * 2)) * 100;
            const yPos = 100 - (((lat - minLat) / (MAP_SPAN * 2)) * 100);

            return (
              <div key={lap.id_laporan || index} style={{ left: `${xPos}%`, top: `${yPos}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center">
                {isAman ? (
                  <>
                    <div className="absolute inset-0 border-2 border-emerald-500 rounded-full animate-ping opacity-30 duration-1000 w-12 h-12 -left-4 -top-4 pointer-events-none"></div>
                    <div className="w-4 h-4 bg-emerald-400 rounded-full shadow-[0_0_15px_#10b981] z-10 border-2 border-black"></div>
                    <span className="bg-black/80 text-emerald-400 text-[8px] px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap mt-2 z-20 font-bold">AMAN: {lap.nama_korban}</span>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 border-2 border-red-500 rounded-full animate-ping opacity-75 w-16 h-16 -left-6 -top-6 pointer-events-none"></div>
                    <div className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_20px_#ef4444] z-10 border-2 border-black"></div>
                    <span className="bg-black/80 text-red-400 text-[8px] px-2 py-0.5 rounded border border-red-500/30 whitespace-nowrap mt-2 z-20 font-bold">SOS: {lap.nama_korban}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="w-full lg:w-1/4 flex flex-col gap-3 z-10">
        <div className="flex-1 min-h-300px lg:min-h-0 border border-white/10 bg-black/40 rounded-2xl p-4 lg:p-5 flex flex-col shadow-lg">
          <div className="flex items-center justify-between mb-4"><h2 className="text-white font-bold tracking-widest">EMERGENCY LOG</h2><span className="text-[9px] bg-red-950/50 border border-red-500/50 text-red-400 px-2 py-0.5 rounded-full animate-pulse">LIVE</span></div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col gap-1 border-b border-white/5 pb-2"><span className="text-[10px] text-gray-500">{log.time}</span><p className={`text-xs ${log.type === 'SOS' ? 'text-red-400' : log.type === 'SAFE' ? 'text-emerald-400' : 'text-cyan-400'}`}>{log.msg}</p></div>
            ))}
          </div>
        </div>
        {mapStatus === 'SOS' ? <button onClick={handleDispatch} className="w-full py-4 bg-red-600 border border-red-400 text-white font-black tracking-widest animate-pulse rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.5)] cursor-pointer">DISPATCH PERSONNEL</button> : <button className="w-full py-4 bg-cyan-950/20 text-cyan-500 font-bold opacity-50 rounded-xl cursor-not-allowed">INITIALIZE PROTOCOL</button>}
      </section>

      {/* DIALOG POPUP */}
      {dialog.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`bg-[#0a0a14] border-2 rounded-2xl w-full max-w-sm p-6 shadow-2xl transform transition-all ${dialog.theme === 'red' ? 'border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : dialog.theme === 'emerald' ? 'border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 'border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.2)]'}`}>
            <h3 className={`text-sm font-black tracking-widest uppercase mb-3 ${dialog.theme === 'red' ? 'text-red-400' : dialog.theme === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'}`}>{dialog.title}</h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans mb-6">{dialog.message}</p>
            <div className="flex gap-3 justify-end mt-4">
              {dialog.type === 'confirm' && (<button onClick={() => setDialog({ ...dialog, show: false })} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-gray-400 border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">BATAL</button>)}
              <button onClick={() => { if (dialog.type === 'confirm' && dialog.onConfirm) { dialog.onConfirm(); } else { setDialog({ ...dialog, show: false }); } }} className={`px-5 py-2 rounded-xl text-xs font-bold tracking-widest text-white cursor-pointer ${dialog.theme === 'red' ? 'bg-red-600 hover:bg-red-500 border border-red-400/50' : dialog.theme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50' : 'bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/50'}`}>
                {dialog.type === 'confirm' ? 'LANJUTKAN' : 'MENGERTI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL PETUGAS & POSKO TETAP SAMA */}
      {showPersonnel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-90 flex items-center justify-center p-4">
          <div className="bg-[#0b0b16] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col relative shadow-2xl">
            <h3 className="text-sm font-bold text-cyan-400 tracking-widest uppercase mb-4 border-b border-white/10 pb-2">📋 DAFTAR PETUGAS AKTIF</h3>
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 text-xs">
              {personnelList.map((p) => (
                <div key={p.id_aktor} className="bg-white/5 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                  <div><h4 className="font-bold text-gray-200">{p.nama_lengkap}</h4><p className="text-[10px] text-gray-400 font-sans mt-0.5">📞 {p.nomor_telepon || '-'}</p></div>
                  <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{p.peran}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowPersonnel(false)} className="mt-5 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-400 cursor-pointer">TUTUP PANEL</button>
          </div>
        </div>
      )}

      {showShelter && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-90 flex items-center justify-center p-4">
          <div className="bg-[#0b0b16] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col relative shadow-2xl">
            <h3 className="text-sm font-bold text-indigo-400 tracking-widest uppercase mb-4 border-b border-white/10 pb-2">🏢 KAPASITAS POSKO</h3>
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1 text-xs">
              {shelterList.map((s) => {
                const pct = (s.kapasitas_terisi / s.kapasitas_maksimal) * 100;
                const color = pct >= 90 ? 'bg-red-500 text-red-400' : pct >= 60 ? 'bg-amber-400 text-amber-400' : 'bg-emerald-500 text-emerald-400';
                return (
                  <div key={s.id_shelter} className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-gray-200">{s.nama_shelter}</h4><span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/40 border border-white/10 ${color.split(' ')[1]}`}>{s.kapasitas_terisi} / {s.kapasitas_maksimal} Jiwa</span></div>
                    <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden"><div className={`h-full ${color.split(' ')[0]}`} style={{ width: `${pct}%` }}></div></div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowShelter(false)} className="mt-5 w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-400 cursor-pointer">TUTUP PANEL</button>
          </div>
        </div>
      )}
    </main>
  );
}