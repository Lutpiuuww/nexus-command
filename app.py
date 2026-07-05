from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import math

app = Flask(__name__)
CORS(app)

# Database Statis Posko (Node) di Kawasan Lhokseumawe
SHELTERS = [
    {"id": "S1", "nama": "Posko Utama Islamic Center", "lat": 5.1780, "lon": 97.1350},
    {"id": "S2", "nama": "Shelter RS Kesdam", "lat": 5.1815, "lon": 97.1410},
    {"id": "S3", "nama": "Posko Evakuasi Bukit Rata", "lat": 5.1650, "lon": 97.1520}
]

# Fungsi Kalkulasi Jarak Haversine Asli
def hitung_haversine(lat1, lon1, lat2, lon2):
    R = 6371.0  # Radius bumi dalam kilometer
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    jarak = R * c
    return round(jarak, 2) # Dibulatkan 2 angka di belakang koma

@app.route('/', methods=['GET'])
def home():
    return "Core Engine Flask Smart Command Center Aktif dan Berjalan!"

@app.route('/api/evakuasi', methods=['POST', 'GET'])
def kalkulasi_evakuasi():
    if request.method == 'GET':
        return jsonify({"pesan": "Gunakan metode POST dari dashboard Next.js"})
        
    data = request.json or {}
    korban_lat = data.get('lat', 5.1852)
    korban_lon = data.get('lon', 97.1492)
    
    print(f"\n[!] ALARM SOS DITERIMA: [{korban_lat}, {korban_lon}]")
    
    log_proses = ["> Memulai kalkulasi Haversine ke seluruh node shelter..."]
    posko_terdekat = None
    jarak_terpendek = float('inf')
    
    time.sleep(0.5) # Efek jeda agar UI terlihat sedang memproses
    
    # 1. Menghitung jarak ke setiap posko yang ada
    for shelter in SHELTERS:
        jarak = hitung_haversine(korban_lat, korban_lon, shelter['lat'], shelter['lon'])
        log_proses.append(f"> Node {shelter['id']} ({shelter['nama']}): {jarak} km")
        
        # 2. Filter posko yang paling dekat
        if jarak < jarak_terpendek:
            jarak_terpendek = jarak
            posko_terdekat = shelter
            
    time.sleep(0.5)
    
    # 3. Kunci target posko
    log_proses.append(f"> MATCH! Posko terdekat ditetapkan: {posko_terdekat['nama']} dengan jarak {jarak_terpendek} km.")
    log_proses.append("> Memproses Analisis AI untuk protokol evakuasi...")
    
    # 4. GENERASI AI CRISIS BRIEF (Simulasi LLM Prompt)
    # Nanti bagian ini bisa kamu ganti dengan request POST sungguhan ke API Groq / Gemini
    ai_brief = (
        f"PERINGATAN TINGGI. Jarak evakuasi: {jarak_terpendek} km menuju {posko_terdekat['nama']}. "
        "Instruksikan unit lapangan untuk memandu korban mengikuti rute utama menjauhi garis pantai. "
        "Prioritaskan jalur aspal dan hindari area dataran rendah yang rawan genangan."
    )
    
    log_proses.append("> Rute optimal dikunci. Mengirim data ke Dashboard!")
    
    return jsonify({
        "status": "success",
        "posko_tujuan": posko_terdekat,
        "log_algoritma": log_proses,
        "ai_instruction": ai_brief # Data AI dilempar ke Next.js
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)