import requests
import time
from supabase import create_client, Client

# 1. Konfigurasi Supabase Milikmu
SUPABASE_URL = "https://hvabviryqfugsaovuxdh.supabase.co"
SUPABASE_KEY = "sb_publishable_7NwFyA3-A_KQlUg-d_FaVg_hrFOGaXh"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. URL Data Gempa BMKG Resmi
BMKG_URL = "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json"

# Variabel untuk menyimpan waktu gempa terakhir agar sirine tidak menyala berkali-kali
waktu_gempa_terakhir = ""

print("📡 Mengaktifkan Radar BMKG untuk Nexus Command...")

while True:
    try:
        # Menarik data dari server BMKG
        response = requests.get(BMKG_URL)
        data_bmkg = response.json()
        
        # Mengambil detail gempa
        gempa = data_bmkg["Infogempa"]["gempa"]
        tanggal = gempa["Tanggal"]
        jam = gempa["Jam"]
        magnitude = float(gempa["Magnitude"])
        wilayah = gempa["Wilayah"]
        potensi = gempa["Potensi"]
        
        waktu_sekarang = f"{tanggal} {jam}"
        
        # Mengecek apakah ini gempa baru yang belum pernah dicatat
        if waktu_sekarang != waktu_gempa_terakhir:
            waktu_gempa_terakhir = waktu_sekarang
            print(f"[{jam}] Terdeteksi Gempa: {magnitude} SR di {wilayah}")
            
            # LOGIKA SENSOR: Jika gempa di atas 5.0 SR, otomatis bunyikan sirine massal!
            if magnitude >= 5.0:
                print("🚨 BAHAYA! Skala gempa tinggi. Menembakkan sinyal ke Nexus Command!")
                
                pesan_darurat = f"🚨 PERINGATAN OTOMATIS (BMKG): Gempa {magnitude} SR terdeteksi di {wilayah}. {potensi}. Segera evakuasi!"
                
                # Memasukkan data ke tabel peringatan_dini di Supabase
                supabase.table("peringatan_dini").insert({
                    "status_level": "KRITIS",
                    "pesan": pesan_darurat
                }).execute()
                
                print("✅ Sinyal evakuasi massal berhasil disiarkan ke seluruh perangkat warga!")
            else:
                print("Gempa skala kecil, tidak perlu menyalakan sirine massal.")
                
        # Jeda 60 detik sebelum mengecek data BMKG lagi
        time.sleep(60)
        
    except Exception as e:
        print(f"Terjadi kesalahan saat membaca data: {e}")
        time.sleep(10)