"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PersonnelModal({ onClose }: { onClose: () => void }) {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPersonnel = async () => {
      // Mengambil data aktor sekaligus nama shelter tempat mereka bertugas (Relasi FK)
      const { data, error } = await supabase
        .from("aktor_sistem")
        .select(`
          *,
          master_shelter ( nama_shelter )
        `)
        .order('id_aktor', { ascending: true });

      if (data) setPersonnel(data);
      setLoading(false);
    };
    fetchPersonnel();
  }, []);

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl bg-[#04040d] border border-white/10 rounded-4xl p-6 shadow-2xl flex flex-col gap-6 relative overflow-hidden">
        {/* Efek Pendaran Cahaya (Glow) di atas modal */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/20 blur-3xl rounded-full pointer-events-none"></div>

        <div className="flex justify-between items-center z-10 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-widest uppercase">Personnel Roster</h2>
            <p className="text-xs text-gray-400 font-mono mt-1">Data Aktor & Hak Akses Sistem</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors cursor-pointer shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto z-10 flex flex-col gap-3 min-h-62.5 max-h-[60vh] pr-2">
          {loading ? (
            <div className="text-center text-cyan-500 text-sm font-mono animate-pulse mt-10">Mengunduh data personel tersandi...</div>
          ) : (
            personnel.map((p) => (
              <div key={p.id_aktor} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-gray-100">{p.nama_lengkap}</h3>
                  <p className="text-[10px] font-mono text-gray-400">{p.nomor_telepon}</p>
                  
                  {/* Hanya tampilkan nama posko jika aktor tersebut bukan Admin Pusat */}
                  {p.master_shelter && (
                    <p className="text-[10px] text-emerald-400/80 font-mono mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      {p.master_shelter.nama_shelter}
                    </p>
                  )}
                </div>
                
                {/* Lencana (Badge) Peran Aktor Dinamis */}
                <div className={`px-3 py-1 rounded-full text-[9px] font-bold tracking-widest border uppercase ${
                  p.peran === 'Admin Pusat' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                  p.peran === 'Tim Medis' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                  'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                }`}>
                  {p.peran}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}