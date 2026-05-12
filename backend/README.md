# Backend — SEO Checklist API

FastAPI + SQLAlchemy 2.0 async + Postgres.

## Yêu cầu

- Python 3.11+ (đã test trên 3.14)
- Postgres 16 (qua `docker compose up -d postgres` ở root, hoặc Postgres local)

## Setup lần đầu

### Bước 1 — Postgres 16

Chọn **một** trong các cách dưới (đều nghe trên `localhost:5432`):

**A. Postgres.app — khuyến nghị cho macOS 12** (precompiled, không cần compile):
```bash
brew install --cask postgres-app
PG=/Applications/Postgres.app/Contents/Versions/16/bin
DATA="$HOME/Library/Application Support/Postgres/var-16"
"$PG/initdb" -D "$DATA" --encoding=UTF8 --locale=en_US.UTF-8 --auth=trust
"$PG/pg_ctl" -D "$DATA" -l "$DATA/server.log" start
"$PG/createuser" -h localhost -d -s seo
"$PG/psql" -h localhost -d postgres -c "ALTER USER seo WITH PASSWORD 'seo';"
"$PG/createdb" -h localhost -O seo seo_checklist
```
Dừng server sau: `"$PG/pg_ctl" -D "$DATA" stop`

**B. Docker compose** (macOS 13+ có Docker Desktop, hoặc Linux):
```bash
cd .. && docker compose up -d postgres && cd backend
```

**C. brew postgresql@16** (khi máy có bottle):
```bash
brew install postgresql@16 && brew services start postgresql@16
/usr/local/opt/postgresql@16/bin/createuser -s seo
/usr/local/opt/postgresql@16/bin/psql -d postgres -c "ALTER USER seo WITH PASSWORD 'seo';"
/usr/local/opt/postgresql@16/bin/createdb -O seo seo_checklist
```

### Bước 2 — Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e ".[dev]"
cp .env.example .env             # chỉnh JWT_SECRET, DATABASE_URL nếu cần
alembic upgrade head
```

## Chạy dev

```bash
source .venv/bin/activate
uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs (OpenAPI Swagger)
# → http://localhost:8000/health
```

## Database

**Connection mặc định (docker compose):**
```
postgresql+asyncpg://seo:seo@localhost:5432/seo_checklist
```

**Tạo migration mới (khi đổi model):**
```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

**Rollback:**
```bash
alembic downgrade -1
```

**Xem SQL sẽ chạy mà không apply (offline):**
```bash
alembic upgrade head --sql
```

## Cấu trúc

```
backend/
├── pyproject.toml          # deps + tool config
├── .env.example
├── alembic.ini
├── alembic/
│   ├── env.py              # async migration runner
│   ├── script.py.mako
│   └── versions/
│       └── 0001_initial.py # users + analyses
└── app/
    ├── main.py             # create_app(), CORS, include routers
    ├── core/
    │   └── config.py       # Settings (pydantic-settings)
    ├── db/
    │   ├── base.py         # DeclarativeBase
    │   └── session.py      # async engine + get_db dep
    ├── models/
    │   ├── user.py
    │   └── analysis.py
    └── api/
        ├── router.py       # gộp các router
        └── health.py
```

## Env vars

| Var | Mặc định | Ghi chú |
|---|---|---|
| `ENVIRONMENT` | `development` | `development` bật echo SQL |
| `DATABASE_URL` | `postgresql+asyncpg://seo:seo@localhost:5432/seo_checklist` | Async URL bắt buộc dùng `+asyncpg` |
| `JWT_SECRET` | `change-me` | Production phải đổi: `openssl rand -hex 32` |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | 7 ngày |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated |

## Test

```bash
pytest
```

(Sẽ có sau Phase 3+.)
