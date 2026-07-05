"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ShelterModal({ onClose }: { onClose: () => void }) {
  const [shelters, setShelters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShelters = async () => {
      const { data, error } = await supabase
        .from("master_shelter")
        .select("*")
        .order('id_shelter', { ascending: true });
      if (data) setShelters(data);
      setLoading(false);
    };
    fetchShelters();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl bg-[#04040d] border border-white/10 rounded-4xl p-6 shadow-2xl flex flex-col gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-64 h-32 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none"></div>

        <div className="flex justify-between items-center z-10 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-widest uppercase">Capacity Monitor</h2>
            <p className="text-xs text-gray-400 font-mono mt-1">Real-time Shelter Load Balancing</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors cursor-pointer shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto z-10 flex flex-col gap-4 min-h-62.5 max-h-[60vh] pr-2">
          {loading ? (
            <div className="text-center text-emerald-500 text-sm font-mono animate-pulse mt-10">Sinkronisasi data posko...</div>
          ) : (
            shelters.map((s) => {
              const fillPercentage = (s.kapasitas_terisi / s.kapasitas_maksimal) * 100;
              const isFull = fillPercentage >= 90;
              const isWarning = fillPercentage >= 60 && !isFull;
              
              const barColor = isFull ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-500';
              const textColor = isFull ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';

              return (
                <div key={s.id_shelter} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-100">{s.nama_shelter}</h3>
                    <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-md bg-black/50 border border-white/5 ${textColor}`}>
                      {s.kapasitas_terisi} / {s.kapasitas_maksimal} Jiwa
                    </span>
                  </div>
                  
                  {/* Visualisasi Progress Bar Kapasitas */}
                  <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5 relative">
                    <div 
                      className={`h-full ${barColor} transition-all duration-1000 ease-out`} 
                      style={{ width: `${fillPercentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}