from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, engine
from routes.auth import router as auth_router
from routes.webhook import router as webhook_router
from routes.messages import router as messages_router
from routes.pages import router as pages_router
from routes.ai import router as ai_router
from admin.admin import setup_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run on startup: create all DB tables."""
    await init_db()
    print("✅ Database tables created / verified")
    yield


app = FastAPI(title="FB Messenger AI Bot", lifespan=lifespan)

# ── CORS ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging + ngrok header ─────────────────────────────────────
@app.middleware("http")
async def request_logger(request: Request, call_next):
    print(f"\n→ {request.method} {request.url.path}")
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "69420"
    return response

# ── Routers ─────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(webhook_router)
app.include_router(messages_router)
app.include_router(pages_router)
app.include_router(ai_router)

# ── Admin panel at /admin ────────────────────────────────────────────────
setup_admin(app, engine)


@app.get("/")
def root():
    return {"message": "FB Messenger AI Bot — Admin at /admin"}

@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
