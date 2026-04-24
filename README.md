# VisAIble

2026 소프트웨어캡스톤 디자인 프로젝트

## Preview
| Main Interface | Competition Interface |
|--------|--------|
| <img width="1437" height="679" alt="KakaoTalk_Photo_2026-04-02-00-36-49" src="https://github.com/user-attachments/assets/26865023-812c-4741-96b9-84aacd9231f1" />| <img width="1473" height="692" alt="KakaoTalk_Photo_2026-04-02-00-36-53" src="https://github.com/user-attachments/assets/cc8a085a-f46a-4c18-aee3-525666b8db7e" />|

## Structure

- `frontend/`: Next.js UI
- `backend/`: FastAPI + PyTorch training server
- `visaible/`: shared Python virtual environment created at the project root
- `gemma4`: Folder for storing gemma4-e2b-it-edge

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
```

Install frontend dependencies:

```bash
cd /Users/seungjunham/Desktop/hallym/26_1/VisAIble/frontend
npm install
```

Download Gemma4 Here : 
- Put it in gemma4 folder
```
https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/tree/main
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

## Notes

- Device priority is `CUDA -> MPS -> CPU`
- The final layer must be a user-defined `Linear(n, class_num)` block
- The final layer outputs logits directly for `CrossEntropyLoss`
- Pooling blocks currently support `MaxPool`, `AvgPool`, and `AdaptiveAvgPool2d((1, 1))`
