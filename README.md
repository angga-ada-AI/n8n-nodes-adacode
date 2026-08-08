# n8n-nodes-adacode

Community node n8n untuk [adaCODE](https://adacode.ai) — satu API key adaCODE untuk
semua model di katalog Anda (adaCODE 2.0, Claude, GPT, GLM, Qwen, MiniMax, Gemini,
DeepSeek, Kimi …), dipakai langsung di dalam workflow n8n.

[n8n](https://n8n.io/) adalah platform otomatisasi workflow [fair-code](https://docs.n8n.io/reference/license/).

## Isi paket

| Node | Fungsi |
|---|---|
| **adaCODE** | Node biasa: kirim pesan ke sebuah model (`Chat → Message a Model`) atau ambil daftar model (`Model → Get Many`) |
| **adaCODE Chat Model** | Sub-node AI: dipasang ke konektor **Chat Model** milik AI Agent, Basic LLM Chain, Summarization Chain, dsb. |

Dropdown model diisi **live** dari katalog API key Anda, jadi model baru langsung
muncul tanpa update paket. Model yang termasuk kuota plan diberi tanda
`(coding plan)` dan diurutkan paling atas; sisanya ditagih tarif pasar dari saldo
Token Recharge.

## Instalasi

### n8n Cloud / n8n self-host (lewat UI)

1. Buka **Settings → Community Nodes → Install**
2. Isi **npm package name**: `n8n-nodes-adacode`
3. Centang persetujuan risiko, klik **Install**

### Self-host (manual)

```bash
cd ~/.n8n/nodes          # buat folder ini bila belum ada
npm install n8n-nodes-adacode
# lalu restart n8n
```

### Docker

```bash
docker exec -u node -it n8n npm install n8n-nodes-adacode -g
docker restart n8n
```

## Kredensial

1. Ambil API key di <https://adacode.ai/api-keys> (formatnya `sk-adacode-…`)
2. Di n8n: **Credentials → New → adaCODE API**
3. Isi **API Key**. **Base URL** biarkan `https://api.adacode.ai` kecuali Anda
   memakai gateway adaCODE self-host — tulis tanpa akhiran `/v1`.
4. Klik **Test** — n8n akan memanggil `GET /v1/models` dengan key tersebut.

Satu kredensial dipakai bersama oleh kedua node.

## Cara pakai

### Sebagai node biasa

`adaCODE → Chat → Message a Model`

- **Model** — pilih dari dropdown (atau isi ID model lewat expression)
- **Input** — `Prompt` (satu pesan + system message opsional) atau `Messages`
  (susun sendiri urutan system/user/assistant)
- **Simplify** (default aktif) — keluaran diringkas jadi:

```json
{
  "content": "Ibu kota Indonesia adalah Jakarta.",
  "model": "adacode-2.0",
  "finishReason": "stop",
  "usage": { "prompt_tokens": 477, "completion_tokens": 53, "total_tokens": 530 },
  "id": "393e467ed284480882da6efa99dda710"
}
```

Matikan **Simplify** untuk mendapat respons API apa adanya.

**Options** yang tersedia: Temperature, Max Tokens, Top P, Frequency/Presence
Penalty, Seed, Stop Sequences, Timeout, Output Content as JSON (memaksa
`response_format: json_object` lalu mem-parse hasilnya), dan Custom Body Fields
untuk field yang belum punya kolom sendiri.

### Sebagai otak AI Agent

Tambahkan node **AI Agent**, klik konektor **Chat Model** di bawahnya, pilih
**adaCODE Chat Model**, lalu tentukan modelnya. Tool calling dan streaming
didukung, jadi Agent + Tools berjalan seperti dengan provider bawaan n8n.

## Coding Plan vs tarif pasar

Katalog tiap API key ditentukan server:

- Model bertanda **(coding plan)** dibayar dari kuota plan Anda.
- Model lain ditagih **tarif pasar** dari saldo Token Recharge. Kalau saldonya
  kosong, permintaan ditolak `402` dan node menampilkan pesan aslinya lengkap
  dengan tautan pengisian saldo — bukan error generik n8n.

## Kompatibilitas

- n8n 1.x dan 2.x (diuji dengan `n8n-workflow` 2.16)
- Node.js ≥ 20.15

## Pengembangan

```bash
git clone https://github.com/angga-ada-AI/n8n-nodes-adacode.git
cd n8n-nodes-adacode
npm install
npm run build
npm run lint

# coba di n8n lokal
mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes && npm install /path/ke/n8n-nodes-adacode
```

## Sumber

- adaCODE: <https://adacode.ai>
- Dokumentasi: <https://adacode.ai/docs>
- API key: <https://adacode.ai/api-keys>
- Panduan community node n8n: <https://docs.n8n.io/integrations/#community-nodes>

## Lisensi

[MIT](LICENSE.md)
