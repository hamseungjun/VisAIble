# VisAIble

> 블록코딩으로 딥러닝 모델을 설계하고, 학습 결과를 시각화로 해석하는 AI 교육 플랫폼

VisAIble은 딥러닝 입문자가 코드 문법보다 먼저 **모델 구조, 데이터 흐름, 학습 결과**를 이해하도록 만든 교육용 플랫폼입니다.  
사용자는 Linear, CNN, Pooling, Dropout 같은 블록을 직접 조립하고, 학습 지표와 Feature Map, Decision Boundary를 보며 모델이 어떻게 판단하는지 확인합니다.

## 프로젝트 핵심

딥러닝을 처음 배우는 사람에게 가장 어려운 지점은 모델이 실제로 무엇을 보고, 어떤 구조로 판단하며, 왜 성능이 달라지는지 연결해서 이해하는 것입니다.  
VisAIble은 이 과정을 하나의 학습 루프로 묶습니다.

1. **블록으로 설계합니다.**  
   레이어를 코드가 아니라 조립 가능한 블록으로 다루며, 모델 구조를 눈으로 만들게 합니다.

2. **결과를 바로 봅니다.**  
   학습 Loss, Accuracy, Decision Boundary, Feature Map을 같은 화면에서 확인해 모델의 변화를 즉시 해석합니다.

3. **이론과 실습을 끊지 않습니다.**  
   Docs에서 배운 DNN, CNN 개념을 Tutorial과 Lab으로 바로 이어가며, Mina에게 질문할 수 있습니다.

4. **비교와 경쟁으로 학습을 마무리합니다.**  
   Competition에서 같은 문제를 다른 구조와 하이퍼파라미터로 풀며 성능 개선 과정을 경험합니다.

## 서비스 철학

VisAIble의 메인은 **블록코딩 기반 모델 빌더**입니다.  
코드를 감추기 위한 블록코딩이 아니라, 딥러닝의 구조적 사고를 먼저 익히게 하기 위한 블록코딩입니다.

- **Structure First**: 모델은 레이어의 나열이 아니라 정보가 변환되는 흐름입니다.
- **Visible Learning**: 좋은 성능보다 중요한 것은 왜 좋아졌는지 설명할 수 있는 능력입니다.
- **Guided Practice**: 초보자는 빈 화면보다 시나리오, 미션, 피드백이 있을 때 더 빠르게 배웁니다.
- **Experiment Loop**: 읽고, 따라 만들고, 바꾸고, 비교하는 반복이 진짜 학습입니다.

## 화면 미리보기

| Lab | Docs |
| --- | --- |
| ![Lab block builder](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/lab-builder.png) | ![Docs learning viewer](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/docs-learning.png) |

| Feature Map | Decision Boundary |
| --- | --- |
| ![Feature map visualization](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/feature-map.png) | ![Decision boundary visualization](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/decision-boundary.png) |

| Playground | Model Preview |
| --- | --- |
| ![Stock playground](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/stock-playground.png) | ![Model preview](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/model-preview.png) |

## 영상 데모

GitHub README에서는 영상 파일이 환경에 따라 바로 재생되지 않을 수 있어, 아래 썸네일을 누르면 각 데모 영상으로 이동하도록 구성했습니다.

| Flow | Demo |
| --- | --- |
| Lab에서 블록을 쌓고 학습 결과를 확인하는 흐름 | [![Lab demo](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/lab-builder.png)](https://github.com/hamseungjun/VisAIble/blob/main/frontend/public/showcase/videos/1.mov) |
| Docs에서 PDF를 읽고 Mina에게 질문하는 흐름 | [![Docs demo](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/docs-cnn-chat.png)](https://github.com/hamseungjun/VisAIble/blob/main/frontend/public/showcase/videos/2.mp4) |
| Playground에서 AI 출력을 먼저 체험하는 흐름 | [![Playground demo](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/stock-playground.png)](https://github.com/hamseungjun/VisAIble/blob/main/frontend/public/showcase/videos/3.mov) |
| 카메라 기반 미니게임으로 CNN 인식을 체험하는 흐름 | [![Mini game demo](https://raw.githubusercontent.com/hamseungjun/VisAIble/main/frontend/public/showcase/rps-playground.png)](https://github.com/hamseungjun/VisAIble/blob/main/frontend/public/showcase/videos/4.mov) |

## 주요 워크스페이스

### Lab: 블록코딩 모델 빌더

VisAIble의 중심 공간입니다.  
사용자는 블록 라이브러리에서 레이어를 끌어와 모델을 만들고, 학습을 실행하며 결과를 시각적으로 확인합니다.

- Linear, CNN, Pooling, Dropout 블록 조립
- 입력/출력 shape와 activation 설정
- Optimizer, Learning Rate, Batch Size, Epoch 조절
- Train Loss, Validation Loss, Accuracy 추적
- Feature Map으로 Conv 레이어가 잡은 특징 확인
- Decision Boundary로 분류 경계 확인
- Mina가 현재 모델 구조를 보고 개선 방향 제안

### Tutorial: 시나리오 기반 단계 학습

Tutorial은 사용자가 아무것도 모르는 상태에서도 모델을 완성할 수 있도록 안내하는 공간입니다.  
각 튜토리얼은 단순 설명이 아니라, 이미지 분류 미션을 통과하는 흐름으로 설계되어 있습니다.

- **DNN 처음 해보기**: MNIST 손글씨 숫자를 Linear 구조로 처음 분류
- **DNN 표현력 올리기**: 은닉층을 추가해 표현력이 어떻게 달라지는지 확인
- **CNN 처음 해보기**: 이미지의 공간 정보를 살리는 Conv와 Pooling 도입
- **CNN 표현력 올리기**: Conv를 더 깊게 쌓아 Feature Map과 성능 변화 비교
- **데이터증강 해보기**: 자동 앨범 분류 시나리오에서 일반화 성능 개선

### Docs: 이론과 질문이 붙어 있는 학습 문서

Docs는 PDF를 단순히 보여주는 뷰어가 아니라, 이론을 읽다가 바로 실습으로 넘어갈 수 있는 학습 공간입니다.

- AI Basic, DNN, CNN 강의 PDF 제공
- PDF 비율에 맞춘 학습용 Viewer
- DNN/CNN 문서에서 관련 Tutorial로 바로 이동
- 궁금한 부분은 Mina에게 질문하며 이어서 학습

### Playground: AI를 먼저 체험하는 공간

Playground는 사용자가 이론을 배우기 전에 AI가 실제로 어떤 입출력을 만드는지 먼저 경험하게 합니다.

- 주식 예측 Playground로 시계열 모델의 결과 체험
- 카메라 기반 가위바위보 미니게임으로 실시간 CNN 인식 경험
- 흥미를 만든 뒤 Docs, Tutorial, Lab으로 자연스럽게 연결

### Competition: 실험을 비교하는 클래스룸

Competition은 모델을 잘 만들었는지 혼자 보는 데서 끝내지 않고, 같은 조건에서 다른 사람과 비교하도록 만든 공간입니다.

- 방 생성 및 참가
- 동일 데이터셋 기준 제출
- Public / Private Score 기반 리더보드
- 튜닝 결과, 검증 성능, 제출 기록 비교
- 수업용 실습과 평가 흐름에 맞춘 경쟁 구조

## 기능 요약

| 영역 | 핵심 기능 | 학습 의도 |
| --- | --- | --- |
| Block Builder | 레이어 블록 조립, 파라미터 수정, 모델 미리보기 | 모델 구조를 직접 설계 |
| Training | PyTorch 기반 학습 실행, 실시간 지표 표시 | 구조 변경이 성능에 미치는 영향 관찰 |
| Visualization | Feature Map, Decision Boundary, 학습 곡선 | 모델 판단 과정을 눈으로 해석 |
| Mina Assistant | Gemini 기반 모델 코칭, 블록/파라미터 추천 | 막히는 순간에 다음 실험 방향 제시 |
| Docs Viewer | AI Basic, DNN, CNN PDF 학습 자료 | 이론과 실습을 같은 플랫폼 안에서 연결 |
| Tutorial Mission | 손글씨/패션/앨범 분류 미션 | 따라 만드는 학습을 실제 문제 해결로 전환 |
| Competition | 클래스룸, 제출, 리더보드 | 비교와 반복을 통한 모델 개선 |

## 기술 스택

### Frontend

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- react-pdf / pdfjs-dist

### Backend

- FastAPI
- PyTorch / TorchVision
- scikit-learn
- NumPy
- yfinance
- Gemini API for Mina

## 프로젝트 구조

```text
.
├── frontend/                  # Next.js 기반 사용자 인터페이스
│   ├── app/                   # App Router 진입점
│   ├── features/model-builder # Lab, Tutorial, Docs, Playground, Competition UI
│   ├── lib/                   # API client, 모델 코드/조언, 상수 데이터
│   └── public/                # PDF, showcase 이미지, 튜토리얼 이미지, 데이터셋 샘플
├── backend/                   # FastAPI + PyTorch 학습 서버
│   ├── app/routers            # training, datasets, mina, learning, competition score prepare API
│   ├── app/services           # 학습, 데이터셋, Mina, competition score 계산
│   └── data/                  # 로컬 학습/샘플 데이터
├── competition_backend/       # Competition 방/참가자/제출/리더보드 저장 서버
└── visaible/                  # 로컬 Python 가상환경
```

## 실행 방법

### 1. Python 환경 준비

Python은 `3.12` 사용을 권장합니다.

```bash
python3.12 -m venv --clear visaible
source visaible/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
pip install -r competition_backend/requirements.txt
```

### 2. Frontend 의존성 설치

```bash
cd frontend
npm install
```

### 3. Backend 실행

```bash
source visaible/bin/activate
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok"}
```

### 4. Competition Backend 실행

새 터미널에서 실행합니다.

```bash
source visaible/bin/activate
cd competition_backend
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Health check:

```bash
curl http://127.0.0.1:8001/health
```

### 5. Frontend 실행

새 터미널에서 실행합니다.

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 \
NEXT_PUBLIC_COMPETITION_API_BASE_URL=http://127.0.0.1:8001 \
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8000`
- Competition Backend: `http://127.0.0.1:8001`

한 번에 로컬 전체를 실행하려면:

```bash
./run.sh
```

## Windows 설치 EXE 만들기

Windows 배포판은 `frontend`와 `backend`만 포함합니다. `competition_backend`는 설치 파일에 넣지 않고,
처음 실행할 때 사용자가 이미 호스팅된 Competition Backend URL을 입력해 연결합니다.

GitHub Actions에서 `Build Windows Installer` 워크플로를 실행하면 아래 파일이 artifact로 생성됩니다.

```txt
VisAIble_Setup.exe
```

설치 후 첫 실행 시 입력값:

```txt
Gemini API Key
Competition Backend URL
```

설치 위치:

```txt
C:\Users\<사용자>\AppData\Local\VisAIble
```

실행 시 자동 처리:

- Python 3.12 확인 및 설치 시도
- Node.js LTS 확인 및 설치 시도
- `backend/.env.local` 생성
- `frontend/.env.local` 생성
- backend `127.0.0.1:8000` 실행
- frontend `127.0.0.1:3000` 실행
- 브라우저 자동 열기

## 환경 변수

Frontend는 기본적으로 `http://127.0.0.1:8000/api`를 API 서버로 사용합니다.  
Competition API는 기본적으로 일반 API와 같은 주소를 쓰지만, 분리 배포 시 다음 값으로 나눌 수 있습니다.

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_COMPETITION_API_BASE_URL=http://127.0.0.1:8001
```

Mina Assistant는 Gemini 기반으로 동작합니다.  
`backend/.env.local` 또는 backend 실행 환경에 아래 값을 설정합니다.

```bash
GOOGLE_API_KEY=your_google_api_key
# optional
GEMINI_MODEL=gemini-3-flash-preview
```

Gateway를 사용할 경우 아래 값도 지원합니다.

```bash
HAI_GPT_API_KEY=your_gateway_key
HAI_GPT_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway
HAI_GPT_MODEL=gemini-3-flash-preview
```

## 학습 데이터와 모델

- 기본 Lab/Tutorial 학습은 MNIST, Fashion-MNIST, CIFAR-10 흐름을 중심으로 설계되어 있습니다.
- MNIST는 학습 시작 시 자동으로 준비되며, 필요하면 API로 직접 준비할 수 있습니다.

```bash
curl -X POST http://127.0.0.1:8000/api/datasets/mnist/prepare
```

## 개발 메모

- 최종 Linear Layer는 분류 클래스 수에 맞는 logits를 출력해야 합니다.
- `CrossEntropyLoss`를 사용하므로 마지막 출력에는 별도 softmax를 붙이지 않습니다.
- CNN 실험에서는 Conv, Pooling, Dropout, Linear의 순서와 shape 변화를 함께 확인하는 것이 중요합니다.
- 학습 장치는 가능한 경우 `CUDA -> MPS -> CPU` 순서로 선택됩니다.

## License

GPL-3.0 License
