# MindGate — SEO Content Reviewer

**🚀 Live demo:** https://frontend-production-98c9.up.railway.app
**🔧 API:** https://backend-production-9610.up.railway.app
**📊 API docs:** https://backend-production-9610.up.railway.app/docs

Monorepo:

- `frontend/` — Next.js 14 (App Router, TypeScript, Tailwind). UI nhập bài, hiển thị điểm SEO, checklist, lịch sử, settings, dark mode.
- `backend/` — FastAPI (Python 3.11+). Auth, lưu lịch sử, chạy 43 tiêu chí SEO (gồm category "Tin cậy & Kiểm chứng AI"), so sánh outline, fetch Google Docs / URL, AI proofread + fact-check (Google Gemini, free tier), export Markdown/HTML.
- `docker-compose.yml` — Postgres 16 chạy local cho dev.

## Yêu cầu môi trường

- Node.js 20+ (qua nvm khuyến nghị)
- Python 3.11+
- Postgres 16 — chọn 1 trong các cách dưới (xem `backend/README.md` để biết chi tiết)

## Quickstart

```bash
# 1. Postgres
#    macOS 13+: docker compose up -d postgres
#    macOS 12 / bất kỳ macOS: brew install --cask postgres-app  (xem backend/README.md)

# 2. Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env             # chỉnh JWT_SECRET / DATABASE_URL nếu cần
alembic upgrade head
uvicorn app.main:app --reload    # → http://localhost:8000
# OpenAPI docs: http://localhost:8000/docs

# 3. Frontend (terminal khác)
cd frontend
nvm use 20
npm install
cp .env.local.example .env.local # API_URL=http://localhost:8000
npm run dev                       # → http://localhost:3000
```

## Cấu trúc

```
seo-checklist/
├── docker-compose.yml
├── frontend/
│   ├── app/ components/ lib/ types/
│   ├── package.json
│   └── ...
└── backend/
    ├── Dockerfile           # cho Railway / docker build
    ├── pyproject.toml
    ├── app/
    │   ├── main.py
    │   ├── core/      # config, security, deps
    │   ├── db/        # engine, session, base
    │   ├── models/    # SQLAlchemy
    │   ├── schemas/   # Pydantic
    │   ├── api/       # auth, analysis, sources
    │   └── services/  # seo_analyzer, google_docs
    └── alembic/
```

## Deploy production

### Backend → Railway

1. **Tạo project + Postgres add-on:**
   ```bash
   # Hoặc dùng GUI: railway.app → New Project → Postgres
   railway init
   railway add --plugin postgresql
   ```

2. **Deploy backend service:**
   - Push repo lên GitHub, connect Railway → chỉ định root directory là `backend/`
   - Railway sẽ tự build qua `Dockerfile` (đã có sẵn).
   - Migration chạy tự động ở `CMD` của Dockerfile (`alembic upgrade head && uvicorn ...`).

3. **Set environment variables** (Railway dashboard → Variables):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | (tự nối từ Postgres add-on, dạng `postgresql://...`) |
   | `JWT_SECRET` | sinh ngẫu nhiên: `openssl rand -hex 32` |
   | `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 ngày) |
   | `CORS_ORIGINS` | `https://<frontend-tên>.vercel.app` (cập nhật sau khi Vercel deploy) |
   | `GEMINI_API_KEY` | (optional, FREE) key Google Gemini để bật AI proofread + phân tích outline + fact-check. Lấy free tại https://aistudio.google.com/apikey. Để trống = 3 check heuristic vẫn chạy, các tính năng AI bị disable. |
   | `ENVIRONMENT` | `production` |

   *Không cần `PORT` — Railway tự cung cấp.*

   *Lưu ý:* Backend tự rewrite `postgres://` / `postgresql://` → `postgresql+asyncpg://` ở `app/core/config.py`. Nếu URL Railway có `?sslmode=require` thì xoá phần đó (asyncpg dùng `?ssl=require` khác cú pháp); SSL Railway enforce server-side, không cần thêm trong URL.

4. **Generate public domain** (Railway dashboard → Settings → Networking → Generate Domain) → ghi nhớ URL để dùng cho frontend.

### Frontend → Vercel

1. **Push repo + connect Vercel:**
   - vercel.com → New Project → import repo → **Root Directory:** `frontend/`
   - Framework Preset: Next.js (tự nhận)
   - Build / Output: default

2. **Environment variable:**

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<backend-tên>.up.railway.app` |

3. **Sau khi deploy:** copy URL Vercel (`https://<frontend-tên>.vercel.app`) → quay lại Railway → cập nhật `CORS_ORIGINS`.

### Checklist trước khi go-live

- [ ] `JWT_SECRET` đã random, không phải `change-me`
- [ ] `CORS_ORIGINS` chỉ liệt kê domain Vercel production (không có `*`)
- [ ] Railway Postgres backup enabled (Add-on → Settings)
- [ ] Test register → login → analyze → history end-to-end trên domain production
- [ ] (Optional) Set `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` ngắn hơn nếu cần (mặc định 7 ngày)
