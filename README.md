# Suara Studio (web)

Halaman web yang memanggil backend di Hugging Face Space (`KadekBoy/suara-audio`).
Tanpa build, tanpa Node.js: hanya `index.html`, `style.css`, `app.js`.

## Menjalankan di komputer
1. Buka folder ini di VS Code.
2. Pasang ekstensi **Live Server**, lalu klik kanan `index.html` > **Open with Live Server**.
   (Jangan klik dua kali filenya: browser menolak memuat modul dari alamat `file://`.)

## Isi folder
- `index.html`: kerangka halaman. `style.css`: tampilan. `app.js`: logika dan panggilan ke Space.
- `KONTRAK-API.md`: aturan komunikasi antar bagian (baca ini dulu bila bingung).
- `supabase/schema.sql`: skema database untuk fitur login dan suara tersimpan (nanti).

## Deploy
Vercel membaca repositori GitHub ini. Framework: **Other**, tanpa build command.
