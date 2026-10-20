# ERP Keuangan (Vue 3 + Vite)

Aplikasi ERP sederhana untuk keuangan usaha kecil. Tanpa dependency tambahan — hanya Vue 3 dan Vite.

## Menjalankan

```bash
npm install
npm run dev      # development
npm run build    # produksi
```

## Modul

| Halaman | Fitur |
| --- | --- |
| Dashboard | Saldo, pemasukan/pengeluaran + tren, grafik arus kas, donut kategori, tagihan, stok menipis |
| Transaksi | CRUD, pencarian, filter jenis/kategori, sortir, paginasi, ekspor CSV |
| Invoice | Buat/edit invoice multi-item + PPN, status otomatis (jatuh tempo), tandai lunas → otomatis jadi pemasukan, cetak |
| Laporan | Laba rugi per periode (1/3/6 bulan), grafik tren, ekspor CSV |
| Inventori | CRUD produk, penyesuaian stok cepat, margin, indikator stok menipis |
| Pelanggan & Vendor | CRUD kontak, piutang per pelanggan |
| Impor Excel | Tombol **Impor Excel** di Dashboard, Transaksi, Inventori, Kontak: upload .xlsx/.csv, template siap unduh, preview + validasi sebelum disimpan, duplikat otomatis dilewati |
| Login | Halaman masuk, sesi tersimpan, logout, kunci 30 detik setelah 5x salah, 2 peran (Pemilik / Kasir) |
| Pengaturan | Nama usaha, PPN, saldo awal, tema terang/gelap, backup/restore JSON, reset data demo |

## Login

Akun demo (ganti username, nama, dan password lewat **Pengaturan → Akun Saya**):

| Username | Password | Peran |
| --- | --- | --- |
| `admin` | `admin123` | Pemilik (akses penuh) |
| `kasir` | `kasir123` | Kasir (tanpa Laporan, profil usaha, dan data) |

> Login ini murni sisi browser (password di-hash SHA-256, disimpan di localStorage), cocok untuk demo atau satu perangkat.
> Untuk dipakai sungguhan oleh banyak orang, verifikasi harus dipindah ke backend (JWT / cookie sesi).

Data disimpan di `localStorage` browser (key `erp-finance-v2`). Saat pertama dibuka, data demo dimuat otomatis;
kosongkan lewat **Pengaturan → Kosongkan semua** untuk mulai dari nol.

## Struktur

```
src/
  importer.js     skema + validasi impor (transaksi, produk, kontak)
  xlsx.js         baca/tulis .xlsx tanpa dependency
  auth.js         login, sesi, peran, hash password
  store.js        state + localStorage + helper turunan (saldo, total invoice, dll.)
  utils.js        format rupiah/tanggal, CSV
  style.css       design system (token warna, tema gelap, komponen dasar)
  components/     Icon, Modal, DataTable, BarChart, DonutChart, StatCard, InvoiceBadge
  views/          Dashboard, Transactions, Invoices, Inventory, Contacts, Reports, Settings, Login
```
