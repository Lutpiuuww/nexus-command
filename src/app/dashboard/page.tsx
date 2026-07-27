"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function CommandCenter() {
  const [targetLoc, setTargetLoc] = useState({ lat: 5.1812, lon: 97.1415 });
  const [logs, setLogs] = useState<{id: number, type: string, msg: string, time: string, photo_url?: string, nama?: string}[]>([]);
  const [safeCount, setSafeCount] = useState(0);
  const [showPersonnel, setShowPersonnel] = useState(false);
  const [showShelter, setShowShelter] = useState(false);
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [shelterList, setShelterList] = useState<any[]>([]);
  const [evidenceModal, setEvidenceModal] = useState({ isOpen: false, url: '', senderName: '' });
  const [laporanList, setLaporanList] = useState<any[]>([]);
  
  const [showDisasterModal, setShowDisasterModal] = useState(false);
  const [disasterData, setDisasterData] = useState({ jenis: 'TSUNAMI', lat: 5.1812, lon: 97.1415, radius: 5 });

  const [dialog, setDialog] = useState<{ show: boolean; type: 'alert' | 'confirm'; theme: 'red' | 'emerald' | 'sky'; title: string; message: string; onConfirm?: () => void; }>({ show: false, type: 'alert', theme: 'sky', title: '', message: '' });

  const adaDarurat = laporanList.some(l => l.status === 'darurat');
  const adaAman = laporanList.some(l => l.status === 'selesai');
  const mapStatus = adaDarurat ? 'SOS' : (adaAman ? 'SAFE' : 'IDLE');

  const addLog = (type: string, msg: string, photo_url?: string, nama?: string) => {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    setLogs(prev => {
      const isDuplicate = prev.some(log => log.msg === msg);
      if (isDuplicate) return prev;
      return [{ id: Date.now() + Math.random(), type, msg, time, photo_url, nama }, ...prev].slice(0, 10);
    });
  };

  const fetchDashboardData = async () => {
    const { data: pData } = await supabase.from("aktor_sistem").select("*");
    if (pData) setPersonnelList(pData);
    const { data: sData } = await supabase.from("master_shelter").select("*");
    if (sData) setShelterList(sData);
    const { count } = await supabase.from("warga_aman").select('*', { count: 'exact', head: true });
    if (count !== null) setSafeCount(count);

    const { data: lapData } = await supabase.from("laporan_darurat").select("*").order('id_laporan', { ascending: false });
    if (lapData) {
      setLaporanList(lapData);
      if (lapData.length > 0) setTargetLoc({ lat: Number(lapData[0].latitude), lon: Number(lapData[0].longitude) });
      else setTargetLoc({ lat: 5.1812, lon: 97.1415 });
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const laporanChannel = supabase.channel('listen_laporan')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laporan_darurat' }, (payload) => {
        fetchDashboardData();
        if (payload.eventType === 'INSERT') {
          new Audio('/siren.mp3').play().catch(e => console.log("Audio autoplay blocked"));
          addLog('SOS', `Sinyal MASUK dari ${payload.new.nama_korban}`, payload.new.photo_url, payload.new.nama_korban);
        } else if (payload.eventType === 'UPDATE' && payload.new.status === 'selesai') {
          addLog('SAFE', `Warga ${payload.new.nama_korban} konfirmasi AMAN.`);
        }
      }).subscribe();

    const safeChannel = supabase.channel('listen_safe')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'warga_aman' }, (payload) => {
        setSafeCount(prev => prev + 1);
      }).subscribe();

    return () => { supabase.removeChannel(laporanChannel); supabase.removeChannel(safeChannel); };
  }, []);

  const handleDispatch = async () => {
    addLog('DISPATCH', 'Menganalisis unit lapangan terdekat...');
    const petugas = personnelList.find(p => p.peran?.toLowerCase().includes('lapangan') || p.peran?.toLowerCase().includes('relawan')) || { nama_lengkap: "Tim URC", nomor_telepon: "0811" };
    const daruratList = laporanList.filter(l => l.status === 'darurat');
    let namaPelapor = "Warga (GPS)"; let kontakPelapor = "Anonim";
    if (daruratList.length > 0) { namaPelapor = daruratList[0].nama_korban || "Warga (GPS)"; kontakPelapor = daruratList[0].kontak_korban || "Anonim"; }

    const { error } = await supabase.from("penugasan_relawan").insert([{ nama_petugas: petugas.nama_lengkap, kontak_petugas: petugas.nomor_telepon, nama_pelapor: namaPelapor, kontak_pelapor: kontakPelapor }]);
    if (error) { setDialog({ show: true, type: 'alert', theme: 'red', title: 'DISPATCH GAGAL', message: error.message }); return; }
    
    setTimeout(() => {
      setDialog({ show: true, type: 'alert', theme: 'sky', title: 'UNIT BERHASIL DIKERAHKAN', message: `Petugas: ${petugas.nama_lengkap} menuju lokasi.` });
      addLog('SYSTEM', `Unit diberangkatkan: ${petugas.nama_lengkap}.`);
    }, 1500);
  };

  const executeMassBroadcast = async () => {
    setShowDisasterModal(false); 
    addLog('SYSTEM', `Mengaktifkan Peringatan ${disasterData.jenis}...`);
    const { error } = await supabase.from("peringatan_dini").insert([{ 
      status_level: 'KRITIS', pesan: `🚨 PERINGATAN DARURAT: Ancaman ${disasterData.jenis} terdeteksi! Jauhi area pusat bahaya!`, jenis_bencana: disasterData.jenis, lat_bencana: disasterData.lat, lon_bencana: disasterData.lon, radius_km: disasterData.radius
    }]);
    if (error) setDialog({ show: true, type: 'alert', theme: 'red', title: 'BROADCAST GAGAL', message: error.message });
    else setDialog({ show: true, type: 'alert', theme: 'red', title: 'ALARM MASSAL AKTIF', message: `Radar Episentrum ${disasterData.jenis} telah dikirim ke perangkat warga.` });
  };
  
  const executeDeactivateSiren = async () => {
    setDialog({ ...dialog, show: false }); addLog('SYSTEM', 'Mencabut peringatan...');
    const { error } = await supabase.from("peringatan_dini").insert([{ status_level: 'AMAN', pesan: 'Tidak ada anomali terdeteksi. Kondisi aman terkendali.' }]);
    if (error) setDialog({ show: true, type: 'alert', theme: 'red', title: 'RESET GAGAL', message: error.message });
    else { setDialog({ show: true, type: 'alert', theme: 'emerald', title: 'SISTEM KEMBALI AMAN', message: 'Layar warga di-reset kembali aman.' }); }
  };

  const handleDeactivateSiren = () => setDialog({ show: true, type: 'confirm', theme: 'emerald', title: 'CABUT PERINGATAN?', message: 'Cabut peringatan darurat dan kembalikan sistem ke mode AMAN?', onConfirm: executeDeactivateSiren });
  
  const executeResetData = async () => {
    setDialog({ ...dialog, show: false }); addLog('SYSTEM', 'Membersihkan riwayat radar...');
    await supabase.from('laporan_darurat').delete().neq('id_laporan', 0); await supabase.from('penugasan_relawan').delete().neq('id_tugas', 0);
    fetchDashboardData(); setDialog({ show: true, type: 'alert', theme: 'emerald', title: 'RADAR BERSIH', message: 'Semua data riwayat sebelumnya telah dihapus.' });
  };

  const handleResetData = () => setDialog({ show: true, type: 'confirm', theme: 'red', title: '⚠️ RESET DATA SIMULASI?', message: 'Hapus permanen SEMUA riwayat titik SOS dan Aman di database? Lanjutkan?', onConfirm: executeResetData });
  
  const MAP_SPAN = 0.06; 
  const minLon = targetLoc.lon - MAP_SPAN; const maxLon = targetLoc.lon + MAP_SPAN;
  const minLat = targetLoc.lat - MAP_SPAN; const maxLat = targetLoc.lat + MAP_SPAN;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon},${minLat},${maxLon},${maxLat}&layer=mapnik`;
  
  return (
    <main className="h-screen w-full bg-slate-950 text-slate-100 p-4 lg:p-6 font-sans flex flex-col lg:flex-row items-stretch gap-6 overflow-hidden relative">
      {/* Background Texture Premium */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 z-0"></div>
      
      {/* Kolom Kiri */}
      <section className="w-full lg:w-1/4 flex flex-col gap-4 z-10">
        <div className="flex-1 min-h-[200px] lg:min-h-0 border border-slate-800/80 bg-slate-900/60 backdrop-blur-md rounded-[24px] p-6 flex flex-col shadow-lg">
          <h2 className="text-sky-400 font-black tracking-widest flex items-center gap-3 mb-5 uppercase text-[11px]">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse shadow-[0_0_10px_#0ea5e9]"></div> ANALYTICS
          </h2>
          <div className="flex-1 text-xs text-slate-300 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar font-medium">
            <div className="bg-emerald-950/30 px-4 py-3 rounded-xl border border-emerald-900/50 flex flex-col gap-1">
              <span className="text-[10px] text-emerald-500/70 tracking-widest uppercase">Total Selamat</span>
              <span className="text-xl font-black text-emerald-400">{safeCount} Jiwa</span>
            </div>
            
            {mapStatus === 'SOS' ? (
              <div className="bg-rose-950/30 px-4 py-3 rounded-xl border border-rose-900/50 animate-pulse">
                <span className="text-[10px] text-rose-500/70 tracking-widest uppercase block mb-1">Status Radar</span>
                <span className="text-sm font-bold text-rose-400">WARNING: SOS Aktif!</span>
              </div>
            ) : mapStatus === 'SAFE' ? (
              <div className="bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-500 tracking-widest uppercase block mb-1">Status Radar</span>
                <span className="text-xs text-emerald-400">Memantau zona aman terkonfirmasi...</span>
              </div>
            ) : (
              <div className="bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-700/50">
                <span className="text-[10px] text-slate-500 tracking-widest uppercase block mb-1">Status Radar</span>
                <span className="text-xs text-slate-400">Menunggu pergerakan sinyal...</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button onClick={() => { fetchDashboardData(); setShowPersonnel(true); }} className="w-full py-4 border border-slate-700 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] sm:text-[11px] font-bold tracking-widest text-slate-300 transition-colors shadow-sm cursor-pointer uppercase">Active Personnel Roster</button>
          <button onClick={() => { fetchDashboardData(); setShowShelter(true); }} className="w-full py-4 border border-slate-700 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] sm:text-[11px] font-bold tracking-widest text-slate-300 transition-colors shadow-sm cursor-pointer uppercase">Shelter Capacity Monitor</button>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <button onClick={() => setShowDisasterModal(true)} className="w-full py-4 border border-rose-600/50 bg-gradient-to-r from-rose-600 to-red-700 rounded-2xl text-[11px] text-white font-black tracking-widest flex justify-center items-center gap-3 shadow-[0_8px_20px_rgba(225,29,72,0.3)] cursor-pointer hover:shadow-[0_8px_25px_rgba(225,29,72,0.5)] hover:scale-[1.02] transition-all uppercase">
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></div> ACTIVATE MASS SIREN
          </button>
          <button onClick={handleDeactivateSiren} className="w-full py-3.5 border border-emerald-800/50 bg-emerald-950/30 rounded-xl text-[10px] font-bold text-emerald-500 tracking-widest cursor-pointer hover:bg-emerald-900/40 transition-all uppercase mt-1">Deactivate Alarm (Set Safe)</button>
          <button onClick={handleResetData} className="w-full py-3 mt-1 bg-transparent hover:bg-slate-900 rounded-xl text-[9px] text-slate-500 hover:text-slate-400 font-bold tracking-widest cursor-pointer transition-colors uppercase">🔄 Reset Radar Peta</button>
        </div>
      </section>

      {/* Peta Tengah */}
      <section className="w-full lg:w-2/4 min-h-[400px] lg:min-h-0 relative border border-slate-800 rounded-[32px] overflow-hidden bg-slate-900 shadow-2xl z-10 flex-1">
        <div className="absolute top-5 left-5 z-30">
          {mapStatus === 'SOS' ? ( <div className="bg-rose-950/90 backdrop-blur-md border border-rose-500/50 text-rose-400 px-5 py-2.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-2.5 animate-pulse shadow-[0_4px_15px_rgba(225,29,72,0.2)]"><span className="w-2 h-2 rounded-full bg-rose-500"></span> ZONA KRITIS: SOS AKTIF</div>
          ) : mapStatus === 'SAFE' ? ( <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-500/50 text-emerald-400 px-5 py-2.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-2.5 shadow-[0_4px_15px_rgba(16,185,129,0.1)]"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> ZONA TERKONFIRMASI AMAN</div>
          ) : ( <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-400 px-5 py-2.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-2.5 shadow-sm"><span className="w-2 h-2 rounded-full bg-slate-600"></span> ZONA PANTAUAN STANDBY</div> )}
        </div>
        
        <div className="w-full h-full absolute inset-0 pointer-events-none">
          {/* Tweak map filter untuk Semi-Dark Premium iOS Style */}
          <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={mapUrl} className="w-full h-full" style={{ filter: "invert(90%) hue-rotate(180deg) brightness(85%) contrast(110%) sepia(10%)" }}></iframe>
          
          {laporanList.map((lap, index) => {
            const lat = Number(lap.latitude); const lon = Number(lap.longitude); const isAman = lap.status === 'selesai';
            if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return null;
            const xPos = ((lon - minLon) / (MAP_SPAN * 2)) * 100; const yPos = 100 - (((lat - minLat) / (MAP_SPAN * 2)) * 100);
            return (
              <div key={lap.id_laporan || index} style={{ left: `${xPos}%`, top: `${yPos}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center">
                {isAman ? (
                  <>
                    <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-full animate-ping opacity-50 duration-1000 w-10 h-10 -left-3 -top-3 pointer-events-none"></div>
                    <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_15px_#10b981] z-10 border-2 border-slate-900"></div>
                    <span className="bg-slate-900/90 backdrop-blur text-emerald-400 text-[9px] px-3 py-1.5 rounded-lg border border-emerald-900/50 whitespace-nowrap mt-3 z-20 font-bold shadow-lg">AMAN: {lap.nama_korban}</span>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 border-2 border-rose-500/70 rounded-full animate-ping opacity-80 w-16 h-16 -left-6 -top-6 pointer-events-none"></div>
                    <div className="absolute inset-0 bg-rose-500/20 rounded-full animate-pulse w-8 h-8 -left-2 -top-2 pointer-events-none"></div>
                    <div className="w-4 h-4 bg-rose-500 rounded-full shadow-[0_0_20px_#e11d48] z-10 border-2 border-slate-900"></div>
                    <span className="bg-slate-900/90 backdrop-blur text-rose-400 text-[9px] px-3 py-1.5 rounded-lg border border-rose-900/50 whitespace-nowrap mt-3 z-20 font-bold shadow-lg flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span> SOS: {lap.nama_korban}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Kolom Kanan */}
      <section className="w-full lg:w-1/4 flex flex-col gap-4 z-10">
        <div className="flex-1 min-h-[300px] lg:min-h-0 border border-slate-800/80 bg-slate-900/60 backdrop-blur-md rounded-[24px] p-6 flex flex-col shadow-lg">
          <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-4">
            <h2 className="text-slate-200 font-black tracking-widest text-[11px] uppercase">EMERGENCY LOG</h2>
            <span className="text-[9px] bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-1 rounded-full animate-pulse font-bold tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span> LIVE
            </span>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2 custom-scrollbar">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col gap-2 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                <span className="text-[9px] font-bold text-slate-500 tracking-widest">{log.time}</span>
                <p className={`text-xs font-semibold leading-relaxed ${log.type === 'SOS' ? 'text-rose-400' : log.type === 'SAFE' ? 'text-emerald-400' : 'text-sky-400'}`}>{log.msg}</p>
                {log.photo_url && ( 
                  <button onClick={() => setEvidenceModal({ isOpen: true, url: log.photo_url!, senderName: log.nama || 'Warga' })} className="mt-1 flex items-center justify-center gap-2 text-[9px] font-bold tracking-widest text-sky-400 hover:text-white transition-colors border border-sky-900/50 bg-sky-950/30 px-4 py-2 rounded-xl cursor-pointer w-max uppercase">
                    👁️ Verifikasi Visual
                  </button> 
                )}
              </div>
            ))}
          </div>
        </div>
        
        {mapStatus === 'SOS' ? (
          <button onClick={handleDispatch} className="w-full py-4 bg-rose-600 hover:bg-rose-500 border border-rose-500/50 text-white font-black tracking-widest rounded-2xl shadow-[0_8px_25px_rgba(225,29,72,0.3)] cursor-pointer text-[11px] uppercase transition-all flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            DISPATCH PERSONNEL
          </button>
        ) : (
          <button className="w-full py-4 bg-slate-800 border border-slate-700 text-slate-500 font-bold tracking-widest rounded-2xl cursor-not-allowed text-[11px] uppercase flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            STANDBY PROTOCOL
          </button>
        )}
      </section>
      
      {/* MODAL: RADAR EPISENTRUM BENCANA (PRO MAX) */}
      {showDisasterModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in zoom-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-2xl rounded-bl-full pointer-events-none"></div>
            
            <div className="p-7 border-b border-slate-800 flex justify-between items-center relative z-10">
              <h3 className="text-sm font-black tracking-widest text-white flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse"></span> SETUP EPISENTRUM
              </h3>
              <button onClick={() => setShowDisasterModal(false)} className="text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors">✕</button>
            </div>
            
            <div className="p-7 flex flex-col gap-6 relative z-10">
              <div>
                <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-2.5 block">KLASIFIKASI ANCAMAN</label>
                <select value={disasterData.jenis} onChange={(e) => setDisasterData({...disasterData, jenis: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-rose-500/50 cursor-pointer shadow-inner appearance-none">
                  <option value="TSUNAMI">POTENSI TSUNAMI</option>
                  <option value="GEMPA BUMI">GEMPA BUMI</option>
                  <option value="BANJIR BANDANG">BANJIR BANDANG</option>
                  <option value="TANAH LONGSOR">TANAH LONGSOR</option>
                  <option value="KEBAKARAN BESAR">KEBAKARAN BESAR</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-2.5 block">Lat (Titik Nol)</label>
                  <input type="number" step="any" value={disasterData.lat} onChange={(e) => setDisasterData({...disasterData, lat: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/50 shadow-inner" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-2.5 block">Lon (Titik Nol)</label>
                  <input type="number" step="any" value={disasterData.lon} onChange={(e) => setDisasterData({...disasterData, lon: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-rose-500/50 shadow-inner" />
                </div>
              </div>

              <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 mt-1">
                <label className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-4 flex justify-between items-center">
                  <span>RADIUS BAHAYA (ZONA MERAH)</span>
                  <span className="text-rose-400 font-black bg-rose-950/50 px-2 py-1 rounded">{disasterData.radius} KM</span>
                </label>
                <input type="range" min="1" max="20" value={disasterData.radius} onChange={(e) => setDisasterData({...disasterData, radius: parseInt(e.target.value)})} className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none" />
              </div>

              <button onClick={executeMassBroadcast} className="w-full py-4 mt-2 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white text-[11px] font-black tracking-widest rounded-2xl transition-all shadow-[0_8px_20px_rgba(225,29,72,0.3)] cursor-pointer uppercase">
                TRANSMISIKAN RADAR SEKARANG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG & PANEL LAINNYA */}
      {dialog.show && ( <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"><div className={`bg-slate-900 border rounded-[32px] w-full max-w-sm p-8 shadow-2xl text-center ${dialog.theme === 'red' ? 'border-rose-900/50' : dialog.theme === 'emerald' ? 'border-emerald-900/50' : 'border-sky-900/50'}`}><div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5 ${dialog.theme === 'red' ? 'bg-rose-950/50 text-rose-500' : dialog.theme === 'emerald' ? 'bg-emerald-950/50 text-emerald-500' : 'bg-sky-950/50 text-sky-400'}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><h3 className={`text-sm font-black tracking-widest uppercase mb-3 ${dialog.theme === 'red' ? 'text-rose-500' : dialog.theme === 'emerald' ? 'text-emerald-500' : 'text-sky-400'}`}>{dialog.title}</h3><p className="text-xs text-slate-400 mb-7 leading-relaxed font-medium">{dialog.message}</p><div className="flex gap-3 justify-center"><button onClick={() => { if (dialog.type === 'confirm' && dialog.onConfirm) { dialog.onConfirm(); } else { setDialog({ ...dialog, show: false }); } }} className={`w-full py-3.5 rounded-xl text-[11px] font-black tracking-widest text-white cursor-pointer shadow-md uppercase ${dialog.theme === 'red' ? 'bg-rose-600 hover:bg-rose-500' : dialog.theme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'}`}>{dialog.type === 'confirm' ? 'LANJUTKAN' : 'MENGERTI'}</button></div></div></div> )}
      {showPersonnel && ( <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[90] flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-lg p-7 max-h-[80vh] flex flex-col shadow-2xl"><h3 className="text-sm font-black text-sky-400 tracking-widest uppercase mb-5 border-b border-slate-800 pb-4 flex items-center gap-3"><span className="text-xl">📋</span> DAFTAR PETUGAS AKTIF</h3><div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2 custom-scrollbar text-xs">{personnelList.map((p) => (<div key={p.id_aktor} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex justify-between items-center hover:bg-slate-800 transition-colors"><div><h4 className="font-bold text-slate-200 text-sm">{p.nama_lengkap}</h4><p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1.5">📞 {p.nomor_telepon || '-'}</p></div><span className="text-[9px] font-bold tracking-widest px-3 py-1.5 rounded-lg bg-sky-950/50 text-sky-400 border border-sky-900/50 uppercase">{p.peran}</span></div>))}</div><button onClick={() => setShowPersonnel(false)} className="mt-6 w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-[11px] font-bold tracking-widest text-slate-300 cursor-pointer uppercase">Tutup Panel</button></div></div> )}
      {showShelter && ( <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[90] flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-lg p-7 max-h-[80vh] flex flex-col shadow-2xl"><h3 className="text-sm font-black text-emerald-400 tracking-widest uppercase mb-5 border-b border-slate-800 pb-4 flex items-center gap-3"><span className="text-xl">🏢</span> KAPASITAS POSKO</h3><div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2 custom-scrollbar text-xs">{shelterList.map((s) => { const pct = (s.kapasitas_terisi / s.kapasitas_maksimal) * 100; const color = pct >= 90 ? 'bg-gradient-to-r from-rose-500 to-rose-600' : pct >= 60 ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'; return (<div key={s.id_shelter} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800 transition-colors"><div className="flex justify-between items-center mb-4"><h4 className="font-bold text-slate-200 text-sm">{s.nama_shelter}</h4><span className="text-[10px] font-bold tracking-widest px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">{s.kapasitas_terisi} / {s.kapasitas_maksimal}</span></div><div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden shadow-inner"><div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }}></div></div></div>); })}</div><button onClick={() => setShowShelter(false)} className="mt-6 w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-[11px] font-bold tracking-widest text-slate-300 cursor-pointer uppercase">Tutup Panel</button></div></div> )}
      {evidenceModal.isOpen && ( <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4"><div className="bg-slate-900 border border-slate-700 rounded-[32px] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col"><div className="px-7 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50"><div><h3 className="text-sky-400 font-black tracking-widest text-sm uppercase flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_10px_#0ea5e9] animate-pulse"></span> VERIFIKASI VISUAL</h3><p className="text-slate-400 font-medium text-[10px] mt-2 uppercase tracking-widest">Pengirim: <span className="text-white font-bold">{evidenceModal.senderName}</span></p></div><button onClick={() => setEvidenceModal({ isOpen: false, url: '', senderName: '' })} className="text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 w-10 h-10 rounded-full flex justify-center items-center cursor-pointer transition-colors">✕</button></div><div className="relative p-8 flex justify-center items-center bg-slate-950 min-h-[300px] shadow-inner"><img src={evidenceModal.url} alt="Bukti" className="max-h-[50vh] object-contain rounded-2xl border border-slate-800 shadow-lg" /></div><div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end gap-3"><button onClick={() => setEvidenceModal({ isOpen: false, url: '', senderName: '' })} className="px-6 py-4 rounded-xl text-[11px] font-bold tracking-widest text-slate-400 bg-slate-800 hover:bg-slate-700 cursor-pointer uppercase">Abaikan</button><button onClick={() => { setEvidenceModal({ isOpen: false, url: '', senderName: '' }); handleDispatch(); }} className="px-6 py-4 rounded-xl text-[11px] font-black tracking-widest bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-md uppercase">Confirm & Dispatch</button></div></div></div> )}
      
      <style jsx global>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; } `}</style>
    </main>
  );
}