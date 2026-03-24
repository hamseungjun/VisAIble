from fastapi import FastAPI

from app.routers.datasets import router as datasets_router


app = FastAPI(title="VisAIble API", version="0.1.0")

app.include_router(datasets_router, prefix="/api")


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
