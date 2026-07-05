"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function CommandCenter() {
  const [mapStatus, setMapStatus] = useState<'IDLE' | 'SAFE' | 'SOS'>('IDLE');
  const [targetLoc, setTargetLoc] = useState({ lat: 5.1812, lon: 97.1415 }); 
  const [logs, setLogs] = useState<{id: number, type: string, msg: string, time: string}[]>([]);
  const [safeCount, setSafeCount] = useState(0);

  const [showPersonnel, setShowPersonnel] = useState(false);
  const [showShelter, setShowShelter] = useState(false);
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [shelterList, setShelterList] = useState<any[]>([]);

  const [dialog, setDialog] = useState<{
    show: boolean; type: 'alert' | 'confirm'; theme: 'red' | 'emerald' | 'cyan'; title: string; message: string; onConfirm?: () => void;
  }>({ show: false, type: 'alert', theme: 'cyan', title: '', message: '' });

  const addLog = (type: string, msg: string) => {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    setLogs(prev => [{ id: Date.now() + Math.random(), type, msg, time }, ...prev].slice(0, 7));
  };

  const fetchDashboardData = async () => {
    const { data: pData } = await supabase.from("aktor_sistem").select("*");
    if (pData) setPersonnelList(pData);
    const { data: sData } = await supabase.from("master_shelter").select("*");
    if (sData) setShelterList(sData);
    const { count } = await supabase.from("warga_aman").select('*', { count: 'exact', head: true });
    if (count !== null) setSafeCount(count);
  };

  useEffect(() => {
    fetchDashboardData();
    const sosChannel = supabase.channel('listen_sos').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'laporan_darurat' }, (payload) => {
        const data = payload.new; setMapStatus('SOS');
        new Audio('/siren.mp3').play().catch(e => console.log("Audio autoplay blocked"));
        if (data.latitude && data.longitude) setTargetLoc({ lat: Number(data.latitude), lon: Number(data.longitude) });
        addLog('SOS', `Sinyal MASUK koordinat: ${data.latitude}, ${data.longitude}`);
      }).subscribe();

    const safeChannel = supabase.channel('listen_safe').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'warga_aman' }, (payload) => {
        const data = payload.new; setSafeCount(prev => prev + 1);
        addLog('SAFE', `Warga konfirmasi status AMAN.`);
        if (data.latitude && data.longitude) { setTargetLoc({ lat: Number(data.latitude), lon: Number(data.longitude) }); setMapStatus(prev => prev === 'SOS' ? 'SOS' : 'SAFE'); }
      }).subscribe();

    return () => { supabase.removeChannel(sosChannel); supabase.removeChannel(safeChannel); };
  }, []);

  // =======================================================
  // PERBAIKAN: DISPATCH SEKARANG MENAMPILKAN INFO PETUGAS
  // =======================================================
  const handleDispatch = async () => {
    addLog('DISPATCH', 'Menganalisis unit lapangan terdekat...');
    
    // 1. Ambil data petugas dari database, atau gunakan nilai default jika kosong
    const petugas = personnelList.find(p => p.peran?.toLowerCase().includes('lapangan') || p.peran?.toLowerCase().includes('relawan')) 
      || { nama_lengkap: "Salman Al-Farisi (Koord. Relawan)", nomor_telepon: "0813-0000-3333" };

    // 2. Ambil data korban terakhir untuk diteruskan ke Lapangan
    const { data: sosData } = await supabase.from('laporan_darurat').select('*').order('id_laporan', { ascending: false }).limit(1);
    let namaPelapor = "Warga (Sinyal GPS)";
    let kontakPelapor = "Anonim";
    
    if (sosData && sosData.length > 0) {
      namaPelapor = sosData[0].nama_korban || "Warga (Sinyal GPS)";
      kontakPelapor = sosData[0].kontak_korban || "Anonim";
    }

    // 3. Kirim instruksi ke Koordinator Lapangan
    const { error } = await supabase.from("penugasan_relawan").insert([{ 
      nama_petugas: petugas.nama_lengkap, 
      kontak_petugas: petugas.nomor_telepon,
      nama_pelapor: namaPelapor,
      kontak_pelapor: kontakPelapor
    }]);

    if (error) { setDialog({ show: true, type: 'alert', theme: 'red', title: 'DISPATCH GAGAL', message: error.message }); return; }
    
    setTimeout(() => {
      // POP-UP SEKARANG MENAMPILKAN DATA PETUGAS YANG DIKERAHKAN
      setDialog({ 
        show: true, 
        type: 'alert', 
        theme: 'cyan', 
        title: 'UNIT BERHASIL DIKERAHKAN', 
        message: `Petugas: ${petugas.nama_lengkap} (Kontak: ${petugas.nomor_telepon}) telah menerima instruksi evakuasi dan sedang menuju lokasi.` 
      });
      setMapStatus('IDLE'); 
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
    else { setMapStatus('IDLE'); setDialog({ show: true, type: 'alert', theme: 'emerald', title: 'SISTEM KEMBALI AMAN', message: 'Layar warga di-reset kembali hijau.' }); }
  };

  const handleDeactivateSiren = () => setDialog({ show: true, type: 'confirm', theme: 'emerald', title: 'CABUT PERINGATAN?', message: 'Cabut peringatan darurat dan kembalikan sistem ke mode AMAN?', onConfirm: executeDeactivateSiren });

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${targetLoc.lon - 0.01},${targetLoc.lat - 0.01},${targetLoc.lon + 0.01},${targetLoc.lat + 0.01}&layer=mapnik&marker=${targetLoc.lat},${targetLoc.lon}`;

  return (
    <main className="min-h-[100dvh] bg-[#06060c] text-white p-4 lg:p-6 pb-10 font-mono flex flex-col lg:flex-row items-stretch gap-6 overflow-x-hidden overflow-y-auto relative">
      
      <section className="w-full lg:w-1/4 flex flex-col gap-3 z-10">
        <div className="flex-1 min-h-[200px] lg:min-h-0 border border-white/10 bg-black/40 rounded-2xl p-4 lg:p-5 flex flex-col shadow-lg">
          <h2 className="text-cyan-400 font-bold tracking-widest flex items-center gap-2 mb-4"><div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div> ANALYTICS</h2>
          <div className="flex-1 text-xs text-gray-400 flex flex-col gap-2 overflow-y-auto pr-2">
            <p className="text-emerald-400 font-bold">{'>'} Total Selamat: {safeCount} Jiwa</p>
            {mapStatus === 'SOS' ? <p className="text-red-500 animate-pulse font-bold">{'>'} WARNING: SOS Aktif!</p> : mapStatus === 'SAFE' ? <p className="text-emerald-400">{'>'} Memantau zona aman terkonfirmasi...</p> : <p>{'>'} Menunggu pergerakan sinyal...</p>}
          </div>
        </div>
        <button onClick={() => { fetchDashboardData(); setShowPersonnel(true); }} className="w-full py-3 border border-white/10 bg-white/5 rounded-xl text-[10px] sm:text-[11px] tracking-widest transition-colors hover:bg-white/10 cursor-pointer">ACTIVE PERSONNEL ROSTER</button>
        <button onClick={() => { fetchDashboardData(); setShowShelter(true); }} className="w-full py-3 border border-white/10 bg-white/5 rounded-xl text-[10px] sm:text-[11px] tracking-widest transition-colors hover:bg-white/10 cursor-pointer">SHELTER CAPACITY MONITOR</button>
        <div className="flex flex-col gap-2 mt-2">
          <button onClick={handleMassBroadcast} className="w-full py-3 border border-red-500/50 bg-red-950/30 rounded-xl text-[10px] sm:text-[11px] text-red-400 font-bold flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)] cursor-pointer"><div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div> ACTIVATE MASS SIREN</button>
          <button onClick={handleDeactivateSiren} className="w-full py-3 border border-emerald-500/30 bg-emerald-950/20 rounded-xl text-[10px] text-emerald-500 font-bold cursor-pointer">DEACTIVATE ALARM (SET SAFE)</button>
        </div>
      </section>

      <section className="w-full lg:w-2/4 min-h-[400px] lg:min-h-0 relative border border-white/10 rounded-2xl overflow-hidden bg-black/50 shadow-2xl z-10 flex-1">
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
        </div>
        {mapStatus === 'SOS' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 pointer-events-none z-20">
            <div className="absolute inset-0 border-2 border-red-500 rounded-full animate-ping opacity-75"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_20px_#ef4444]"></div>
          </div>
        )}
        {mapStatus === 'SAFE' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 pointer-events-none z-20 flex flex-col items-center justify-center">
            <div className="absolute inset-0 border-2 border-emerald-500 rounded-full animate-ping opacity-50 duration-1000"></div>
            <div className="w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_20px_#10b981] mb-2"></div>
            <span className="bg-black/80 text-emerald-400 text-[9px] px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap translate-y-4">LOKASI AMAN</span>
          </div>
        )}
      </section>

      <section className="w-full lg:w-1/4 flex flex-col gap-3 z-10">
        <div className="flex-1 min-h-[300px] lg:min-h-0 border border-white/10 bg-black/40 rounded-2xl p-4 lg:p-5 flex flex-col shadow-lg">
          <div className="flex items-center justify-between mb-4"><h2 className="text-white font-bold tracking-widest">EMERGENCY LOG</h2><span className="text-[9px] bg-red-950/50 border border-red-500/50 text-red-400 px-2 py-0.5 rounded-full animate-pulse">LIVE</span></div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col gap-1 border-b border-white/5 pb-2"><span className="text-[10px] text-gray-500">{log.time}</span><p className={`text-xs ${log.type === 'SOS' ? 'text-red-400' : log.type === 'SAFE' ? 'text-emerald-400' : 'text-cyan-400'}`}>{log.msg}</p></div>
            ))}
          </div>
        </div>
        {mapStatus === 'SOS' ? <button onClick={handleDispatch} className="w-full py-4 bg-red-600 border border-red-400 text-white font-black tracking-widest animate-pulse rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.5)] cursor-pointer">DISPATCH PERSONNEL</button> : <button className="w-full py-4 bg-cyan-950/20 text-cyan-500 font-bold opacity-50 rounded-xl cursor-not-allowed">INITIALIZE PROTOCOL</button>}
      </section>

      {dialog.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`bg-[#0a0a14] border-2 rounded-2xl w-full max-w-sm p-6 shadow-2xl transform transition-all 
            ${dialog.theme === 'red' ? 'border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : 
              dialog.theme === 'emerald' ? 'border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 
              'border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.2)]'}`}
          >
            <h3 className={`text-sm font-black tracking-widest uppercase mb-3 ${dialog.theme === 'red' ? 'text-red-400' : dialog.theme === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'}`}>{dialog.title}</h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans mb-6">{dialog.message}</p>
            <div className="flex gap-3 justify-end mt-4">
              {dialog.type === 'confirm' && (
                <button onClick={() => setDialog({ ...dialog, show: false })} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-gray-400 border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">BATAL</button>
              )}
              <button 
                onClick={() => { if (dialog.type === 'confirm' && dialog.onConfirm) { dialog.onConfirm(); } else { setDialog({ ...dialog, show: false }); } }}
                className={`px-5 py-2 rounded-xl text-xs font-bold tracking-widest text-white cursor-pointer
                  ${dialog.theme === 'red' ? 'bg-red-600 hover:bg-red-500 border border-red-400/50' : 
                    dialog.theme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50' : 
                    'bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/50'}`}
              >
                {dialog.type === 'confirm' ? 'LANJUTKAN' : 'MENGERTI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPersonnel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[90] flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[90] flex items-center justify-center p-4">
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