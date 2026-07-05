"use client";

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  isEmergency: boolean;
  routeReady: boolean;
  startLat: number;
  startLon: number;
  targetLat: number;
  targetLon: number;
}

export default function Map3D({ isEmergency, routeReady, startLat, startLon, targetLat, targetLon }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const markerRef = useRef<L.Marker | null>(null);
  const shelterRef = useRef<L.Marker | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const impactZoneRef = useRef<L.Circle | null>(null); // State baru untuk zona merah

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      wheelPxPerZoomLevel: 120
    }).setView([startLat, startLon], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
    setTimeout(() => { mapRef.current?.invalidateSize(); }, 100);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); 

  useEffect(() => {
    if (!mapRef.current) return;

    if (isEmergency) {
      // 1. Gambar Marker Warga
      if (!markerRef.current) {
        const redIcon = L.divIcon({
          className: 'custom-icon',
          html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; box-shadow: 0 0 15px #ef4444; border: 2px solid white;"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        markerRef.current = L.marker([startLat, startLon], { icon: redIcon }).addTo(mapRef.current);
      }

      // 2. GAMBAR ZONA MERAH TERDAMPAK (Radius 800 meter)
      if (!impactZoneRef.current) {
        impactZoneRef.current = L.circle([startLat, startLon], {
          color: '#ef4444',
          weight: 1,
          dashArray: '5, 10',
          fillColor: '#ef4444',
          fillOpacity: 0.1,
          radius: 800 
        }).addTo(mapRef.current);
      }

      // 3. Gambar Rute OSRM & Posko
      if (routeReady && targetLat !== 0 && !shelterRef.current && !routeRef.current) {
        const greenIcon = L.divIcon({
          className: 'custom-icon',
          html: '<div style="background-color: #10b981; width: 22px; height: 22px; border-radius: 50%; box-shadow: 0 0 20px #10b981; border: 2px solid white;"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        
        shelterRef.current = L.marker([targetLat, targetLon], { icon: greenIcon })
          .bindPopup(`
            <div style="background: #04040d; border: 1px solid #10b981; padding: 10px; border-radius: 6px; color: white; font-family: monospace;">
              <div style="color: #10b981; font-weight: bold; margin-bottom: 2px; font-size: 11px;">TARGET SHELTER</div>
              <div style="font-size: 9px; color: #9ca3af;">Koordinat Terkunci</div>
            </div>
          `, { autoClose: false, closeButton: false, className: 'custom-popup' })
          .addTo(mapRef.current);
        shelterRef.current.openPopup();

        const fetchRealRoute = async () => {
          try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${targetLon},${targetLat}?geometries=geojson`);
            const data = await response.json();
            
            if (data.routes && data.routes[0]) {
              const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
              
              routeRef.current = L.polyline(coordinates, {
                color: '#06b6d4',
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 10',
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(mapRef.current!);

              mapRef.current!.flyToBounds(routeRef.current.getBounds(), { 
                padding: [60, 60], 
                duration: 2.2,
                easeLinearity: 0.2
              });
            }
          } catch (error) {
            console.error("Gagal mengambil rute OSRM:", error);
          }
        };

        fetchRealRoute();
      }

    } else {
      if (markerRef.current) { mapRef.current.removeLayer(markerRef.current); markerRef.current = null; }
      if (shelterRef.current) { mapRef.current.removeLayer(shelterRef.current); shelterRef.current = null; }
      if (routeRef.current) { mapRef.current.removeLayer(routeRef.current); routeRef.current = null; }
      
      // Hapus Zona Merah saat tombol Resolve ditekan
      if (impactZoneRef.current) { 
        mapRef.current.removeLayer(impactZoneRef.current); 
        impactZoneRef.current = null; 
      }
      
      mapRef.current.flyTo([startLat, startLon], 15, { duration: 2.0, easeLinearity: 0.2 });
    }
  }, [isEmergency, routeReady, startLat, startLon, targetLat, targetLon]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full z-0 cursor-crosshair" />
      <div className="absolute inset-0 pointer-events-none border-[3px] border-emerald-500/10 rounded-4xl z-[400]"></div>
    </div>
  );
}