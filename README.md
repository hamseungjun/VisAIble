# VisAIble

2026 소프트웨어캡스톤 디자인 프로젝트

## Preview
| Main Interface | Competition Interface |
|--------|--------|
| <img width="1437" height="679" alt="KakaoTalk_Photo_2026-04-02-00-36-49" src="https://github.com/user-attachments/assets/26865023-812c-4741-96b9-84aacd9231f1" />| <img width="1473" height="692" alt="KakaoTalk_Photo_2026-04-02-00-36-53" src="https://github.com/user-attachments/assets/cc8a085a-f46a-4c18-aee3-525666b8db7e" />|

## Structure

- `frontend/`: Next.js UI
- `backend/`: local FastAPI + PyTorch training server
- `competition_backend/`: shared FastAPI competition server for room codes and leaderboard
- `visaible/`: shared Python virtual environment created at the project root

## Requirements

- Python `3.12`
- Node.js `18+`
- npm

## Environment Setup

Create the shared virtual environment once at the project root.

Important:
- use `python3.12`
- do not use `python3.13` for this project

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble
python3.12 -m venv --clear visaible
source visaible/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install -r competition_backend/requirements.txt
```

Install frontend dependencies:

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble/frontend
npm install
```

## Run Backend

The backend should use port `8000`.

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble
source visaible/bin/activate
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Run Frontend

Run the frontend in a separate terminal:

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble/frontend
npm run dev
```

If you want a fixed port:

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble/frontend
PORT=3001 npm run dev
```

## Frontend API Base URL

By default the frontend now uses:

```text
http://127.0.0.1:8000/api
```

If needed, override it with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

To split shared competition state onto a separate backend, set:

```bash
NEXT_PUBLIC_COMPETITION_API_BASE_URL=http://127.0.0.1:8001
```

In this mode:

- local backend (`NEXT_PUBLIC_API_BASE_URL`) handles training and local competition scoring
- competition backend (`NEXT_PUBLIC_COMPETITION_API_BASE_URL`) handles room codes, submissions, and leaderboard state

Run the local backend with:

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble
source visaible/bin/activate
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Run the competition backend separately with:

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble
source visaible/bin/activate
cd competition_backend
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

## Render Test Deploy

The repository root now includes [render.yaml](/Users/seungjunham/Desktop/hallym/26_1/capstone/render.yaml) for deploying only `competition_backend` to Render.

Important:

- deploy branch: `deploy`
- service root: `competition_backend`
- health check: `/health`
- local frontend can connect by setting `NEXT_PUBLIC_COMPETITION_API_BASE_URL` to the Render URL

After Render gives you a URL like `https://your-service.onrender.com`, run the frontend locally with:

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble/frontend
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 NEXT_PUBLIC_COMPETITION_API_BASE_URL=https://your-service.onrender.com npm run dev
```

For one-command local startup against the deployed Render competition backend:

- macOS/Linux: [run_local_with_render.sh](/Users/seungjunham/Desktop/hallym/26_1/capstone/run_local_with_render.sh)
- Windows: [run_local_with_render.bat](/Users/seungjunham/Desktop/hallym/26_1/capstone/run_local_with_render.bat)

Both scripts default to:

```text
http://210.115.229.161:8001
```

If needed, override the competition URL before running the script with `NEXT_PUBLIC_COMPETITION_API_BASE_URL`.

## MNIST Preparation

The training flow is currently implemented for `MNIST Digit Set`.

MNIST files are downloaded automatically when training starts, but you can also prepare them manually:

```bash
curl -X POST http://127.0.0.1:8000/api/datasets/mnist/prepare
```

## Full Local Startup

Terminal 1:

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble
source visaible/bin/activate
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2:

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble/frontend
npm run dev
```

Open:

- frontend: `http://localhost:3000`
- backend health: `http://127.0.0.1:8000/health`

## One-Command Local Run

For the basic local mode without the shared competition backend:

- macOS/Linux: [run.sh](/Users/seungjunham/Desktop/hallym/26_1/capstone/run.sh)
- Windows: [run.bat](/Users/seungjunham/Desktop/hallym/26_1/capstone/run.bat)

What these scripts do:

- create `visaible/` virtual environment if missing
- install `backend/requirements.txt`
- run `npm install` in `frontend/`
- start the local backend on `127.0.0.1:8000`
- start the frontend on `127.0.0.1:3000`

## Notes

- Device priority is `CUDA -> MPS -> CPU`
- The final layer must be a user-defined `Linear(n, class_num)` block
- The final layer outputs logits directly for `CrossEntropyLoss`
- Pooling blocks currently support `MaxPool`, `AvgPool`, and `AdaptiveAvgPool2d((1, 1))`
