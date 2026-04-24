from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.competition import router as competition_router
from app.routers.datasets import router as datasets_router
from app.routers.learning import router as learning_router
from app.routers.mina import router as mina_router
from app.routers.stocks import router as stocks_router
from app.routers.training import router as training_router


app = FastAPI(title="VisAIble API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets_router, prefix="/api")
app.include_router(training_router, prefix="/api")
app.include_router(competition_router, prefix="/api")
app.include_router(stocks_router, prefix="/api")
app.include_router(mina_router, prefix="/api")
app.include_router(learning_router, prefix="/api")
app.include_router(datasets_router)
app.include_router(training_router)
app.include_router(competition_router)
app.include_router(stocks_router)
app.include_router(mina_router)
app.include_router(learning_router)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
