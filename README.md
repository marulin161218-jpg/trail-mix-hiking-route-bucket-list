# Trail Mix

Katalog trail hiking: catat rute impian, tandai yang selesai, pantau agregat jarak. Vite + TypeScript vanilla, data di `localStorage` key `trailmix-data`.

    npm install && npm run dev   # http://localhost:5173
    npm test                     # domain + storage

## Struktur

- `src/domain.ts` fungsi murni (validasi, sort, agregat), tanpa DOM/storage.
- `src/storage.ts` `loadTrails()` dan `saveTrails()` independen, try/catch masing-masing.
- `index.html` kerangka statis, `src/main.ts` render dinamis. Empat aksi tulis lewat satu `commit()`: save gagal berarti state tidak berubah, pesan muncul di slot aksi itu.

## Memicu error state

Read failure, jalankan di console lalu reload:

    localStorage.setItem('trailmix-data', '{bukan json[')

Entri rusak sebagian (pesan menyebut jumlahnya): simpan `'[{"name":""}]'` lalu reload.

Write failure, lalu coba keempat aksi tulis:

    Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError') }

Validasi: submit form kosong, atau isi jarak `abc`, `0`, `-4`.
