from fastapi import APIRouter

from app.api import analysis, auth, health, sources

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(analysis.router)
api_router.include_router(sources.router)
