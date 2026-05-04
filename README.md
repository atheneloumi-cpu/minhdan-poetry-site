# 🌿 Minh Đan Poetry Site

Website thơ song ngữ Việt-Anh của nhà thơ Minh Đan, sử dụng Notion làm CMS và Cloudflare Pages để host.

## Architecture

```
Notion (CMS) → sync-notion.js → JSON → build-pages.js → HTML → Cloudflare Pages
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Mở .env và điền NOTION_TOKEN
```

### 3. Test sync
```bash
npm run sync
```

Kết quả thành công sẽ tạo các file:
- `data/poems.json`
- `data/collections.json`
- `data/author.json`
- `data/manifest.json`

### 4. Build HTML pages
```bash
npm run build
```

### 5. Preview locally
```bash
npm run dev
```

Mở http://localhost:3000

## Scripts

| Command | Description |
|---------|-------------|
| `npm run sync` | Fetch data từ Notion, lưu vào `data/*.json` |
| `npm run build` | Generate HTML từ JSON vào `public/` |
| `npm run all` | Chạy cả sync và build |
| `npm run dev` | Build + serve local preview |
| `npm run clean` | Xóa data và public folder |

## Project Structure

```
minhdan-poetry-site/
├── .github/workflows/    # GitHub Actions auto-deploy
├── scripts/              # Sync & build engines
├── templates/            # HTML templates
├── styles/               # Shared CSS
├── data/                 # Generated JSON (gitignored)
├── public/               # Generated HTML (gitignored)
└── .env                  # Local secrets (gitignored)
```

## Deployment

Mỗi lần push lên `main`, GitHub Actions sẽ:
1. Sync data từ Notion
2. Build HTML
3. Deploy lên Cloudflare Pages

## License

MIT — © 2026 Minh Đan