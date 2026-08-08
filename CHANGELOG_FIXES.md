# CHANGELOG_FIXES — n8n-nodes-adacode

Catatan perbaikan & rilis paket community node n8n untuk adaCODE.
Urutan: terbaru → terlama.

---

### Fix #1 — Rilis Awal 0.1.0: Dua Node + Kredensial, dan Empat Jebakan yang Menghabiskan Waktu (**✅ LIVE 2026-08-08**)

| | |
|---|---|
| **Tanggal** | 2026-08-08 |
| **File** | Seluruh paket baru: `credentials/AdaCodeApi.credentials.ts`, `nodes/AdaCode/AdaCode.node.ts`, `nodes/LmChatAdaCode/LmChatAdaCode.node.ts`, `nodes/shared/GenericFunctions.ts` |
| **Masalah** | Belum ada jalan memakai API key adaCODE di n8n. Node bawaan "OpenAI Chat Model" bisa diarahkan lewat base URL, tapi daftar modelnya tidak mengikuti katalog per-key dan error gateway (402 dompet Token Recharge kosong) muncul sebagai pesan generik n8n. |
| **Akar** | n8n hanya memuat paket npm yang **namanya berawalan `n8n-nodes-`** dan punya blok `n8n` di `package.json`; paket itu di-install ke `node_modules` milik n8n sendiri. Karena itu node ini **tidak bisa** dititipkan ke paket CLI `adacode` — harus paket + repo terpisah. |
| **Fix** | Kredensial `adaCodeApi` (API key + Base URL, credential test ke `GET /v1/models`); node **adaCODE** (`Chat → Message a Model`, `Model → Get Many`); sub-node **adaCODE Chat Model** yang mengeluarkan `ai_languageModel` dengan `ChatOpenAI` diarahkan ke `<baseUrl>/v1` dan `useResponsesApi:false`. Dropdown model diisi live dari `/v1/models`; label memakai `display_name` server (di sanalah penanda "(coding plan)" hidup) dan alias ber-nama kembar dibedakan dengan ID-nya. Error gateway diangkat apa adanya ke UI n8n. |
| **Verifikasi** | Di **n8n 2.33.7 sungguhan**: kedua node + kredensial terdaftar (dari 905 node type); workflow `Manual Trigger → adaCODE` sukses **202 ms**; `Basic LLM Chain` sukses **302 ms**; `AI Agent` + Calculator → 1234×5678 = **7006652** (benar); `Chat Trigger → AI Agent` + Simple Memory → 3 giliran berurutan 200 OK dengan memori nyambung; tombol Test kredensial: key benar "Connection successful!", key salah ditolak. Dropdown: 58 model live (10 coding plan / 48 tarif pasar). Registry: `npm view n8n-nodes-adacode version` → **0.1.0**. |
| **Pelajaran** | Empat jebakan yang masing-masing memakan waktu: (1) **Ikon di-cache browser `max-age=86400`** — mengganti isi berkas SVG tidak pernah terlihat di UI; yang berhasil adalah mengganti NAMA berkasnya (`adacode.svg` → `adacode-icon.svg`) sehingga URL-nya baru. (2) `NodeConnectionType` di n8n-workflow 2.x hanya **tipe**, bukan enum — pakai string literal `'main'` / `'ai_languageModel'` agar kompatibel n8n 1.x maupun 2.x. (3) Aturan `eslint-plugin-n8n-nodes-base` menolak sub-node AI (`inputs: []`) — matikan per baris; kalau diubah jadi `['main']` node hilang dari daftar Chat Model. (4) `package.json` jangan dimasukkan ke `include` tsconfig — tsc ikut menyalinnya ke `dist/`. |
| **Log Keyword** | `n8n-nodes-adacode`, `lmChatAdaCode`, `adaCodeApi`, `ai_languageModel`, `adacode-icon.svg`, handoff `n8n-nodes-adacode` |
| **Deploy** | `npm publish --access public` (paket npm, bukan service). Repo: <https://github.com/angga-ada-AI/n8n-nodes-adacode> |