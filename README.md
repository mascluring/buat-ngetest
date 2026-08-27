# ERA SUPER LEAGUE V5.5 — Data Fix

FPL Classic League dashboard untuk League ID **134820**.

## V5.5 fixes
- Server-side FPL proxy dengan retry 3x dan request headers.
- League standings menggunakan official FPL endpoint dengan pagination.
- Analytics mengambil seluruh halaman league (hingga 20 halaman / 1.000 manager).
- Ranking movement hanya aktif mulai GW2.
- Biggest Riser/Faller tidak dihitung pada GW1.
- Error API ditampilkan di UI, tidak lagi disembunyikan sebagai klasemen kosong.
- Health check tersedia di `/api/health`.
- Link official league: `https://fantasy.premierleague.com/en/leagues/134820/standings/c`
- Next.js 15.4.10.

## Deploy
Upload seluruh isi folder ini ke repository GitHub yang terhubung ke Vercel. Setelah deployment selesai, buka `/api/health` terlebih dahulu. Respons `ok: true` dan `rows` > 0 berarti data FPL sudah berhasil masuk ke server proxy.

## V5.5.2 GW1 Movement Fix
- GW1 never shows Move, Biggest Riser, or Biggest Faller data.
- Biggest Riser only accepts positive movement.
- Biggest Faller only accepts negative movement.
- GW2+ movement is `last_rank - rank`.
