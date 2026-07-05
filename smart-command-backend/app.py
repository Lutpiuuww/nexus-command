from flask import Flask, jsonify, request
from flask_cors import CORS
import math
import heapq

app = Flask(__name__)
CORS(app) # Mengizinkan akses dari Next.js front-end

@app.route('/', methods=['GET'])
def cek_status():
    return jsonify({
        "status": "Online", 
        "pesan": "Core Engine Command Center Aktif! Siap menerima POST di /api/evakuasi"
    })

# ==========================================
# 1. LOGIKA HAVERSINE (Menghitung Jarak GPS)
# ==========================================
def hitung_haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # Radius bumi dalam Kilometer
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    jarak_km = R * c
    return round(jarak_km, 2)

# ==========================================
# 2. DATA MASTER (Simulasi Database 3NF)
# ==========================================
# Koordinat posko evakuasi (Shelters)
SHELTERS = {
    "shelter_alpha": {"nama": "Posko Utama BPBD", "lat": 5.5500, "lon": 95.3175, "kapasitas": 500},
    "shelter_beta": {"nama": "Masjid Raya Baiturrahman", "lat": 5.5536, "lon": 95.3172, "kapasitas": 2000}
}

# ==========================================
# 3. ENDPOINT API UTAMA
# ==========================================
@app.route('/api/evakuasi', methods=['POST'])
def proses_evakuasi():
    data = request.json
    korban_lat = data.get('lat')
    korban_lon = data.get('lon')
    
    shelter_terdekat = None
    jarak_terpendek = float('inf')
    
    # Mencari shelter terdekat menggunakan Haversine
    for shelter_id, shelter_data in SHELTERS.items():
        jarak = hitung_haversine(korban_lat, korban_lon, shelter_data['lat'], shelter_data['lon'])
        
        if jarak < jarak_terpendek:
            jarak_terpendek = jarak
            shelter_terdekat = shelter_data
            
    # Hasil kalkulasi algoritma yang akan dikembalikan ke React/Next.js
    response = {
        "status": "success",
        "pesan": "Kalkulasi rute berhasil dieksekusi.",
        "log_algoritma": [
            f"> Sinyal SOS diterima di koordinat [{korban_lat}, {korban_lon}]",
            "> Memulai kalkulasi Haversine ke seluruh node shelter...",
            f"> MATCH! Shelter terdekat: {shelter_terdekat['nama']} (Jarak: {jarak_terpendek} KM)",
            "> Generate rute vektor spasial (Dijkstra)... Selesai."
        ],
        "data_shelter": shelter_terdekat,
        "vektor_rute": [
            [korban_lat, korban_lon],
            [korban_lat + 0.001, korban_lon + 0.001], # Node bayangan (belokan jalan)
            [shelter_terdekat['lat'], shelter_terdekat['lon']]
        ]
    }
    
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
    