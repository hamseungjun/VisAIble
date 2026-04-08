from __future__ import annotations

from datetime import datetime, timedelta
from importlib import import_module
from math import sqrt

import numpy as np
import requests
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from app.schemas.stocks import StockNodePayload, StockTrainingRequest


STOCK_PRESETS = [
    {
        "ticker": "AAPL",
        "label": "Apple",
        "sector": "Consumer Tech",
        "description": "아이폰, 서비스 매출, 하드웨어 사이클이 함께 움직여서 추세 관찰 연습에 자주 쓰이는 대표 종목입니다.",
    },
    {
        "ticker": "MSFT",
        "label": "Microsoft",
        "sector": "Cloud Software",
        "description": "클라우드와 엔터프라이즈 소프트웨어 수요가 반영되어 비교적 매끈한 중장기 흐름을 보이는 편입니다.",
    },
    {
        "ticker": "NVDA",
        "label": "NVIDIA",
        "sector": "AI Semiconductors",
        "description": "AI 반도체 기대감이 가격에 빠르게 반영되어 변동성과 모멘텀이 함께 큰 주가 패턴을 보여줍니다.",
    },
    {
        "ticker": "TSLA",
        "label": "Tesla",
        "sector": "EV Mobility",
        "description": "고변동 성장주 성격이 강해서 예측 난도가 높고, 시계열 모델의 한계를 체감하기 좋은 종목입니다.",
    },
]

STOCK_HISTORY_CACHE: dict[tuple[str, str], tuple[list[str], np.ndarray]] = {}


class StockLSTM(nn.Module):
    def __init__(self, lstm_layers: list[dict[str, int]], head_layers: list[nn.Module]) -> None:
        super().__init__()
        self.sequence_layers = nn.ModuleList(
            [
                nn.LSTM(
                    input_size=layer["input_size"],
                    hidden_size=layer["hidden_size"],
                    num_layers=layer["num_layers"],
                    batch_first=True,
                )
                for layer in lstm_layers
            ]
        )
        self.head = nn.Sequential(*head_layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        sequence = x
        for layer in self.sequence_layers:
            sequence, _ = layer(sequence)
        features = sequence[:, -1, :]
        return self.head(features)


def list_stock_presets() -> list[dict[str, str]]:
    return STOCK_PRESETS


def search_stocks(query: str) -> list[dict[str, str]]:
    normalized_query = query.strip()
    if not normalized_query:
        return STOCK_PRESETS

    local_matches = [
        item
        for item in STOCK_PRESETS
        if normalized_query.lower() in item["ticker"].lower()
        or normalized_query.lower() in item["label"].lower()
        or normalized_query.lower() in item["sector"].lower()
    ]

    try:
        response = requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={
                "q": normalized_query,
                "quotesCount": 8,
                "newsCount": 0,
                "listsCount": 0,
                "enableFuzzyQuery": False,
                "quotesQueryId": "tss_match_phrase_query",
                "multiQuoteQueryId": "multi_quote_single_token_query",
                "region": "US",
                "lang": "en-US",
            },
            timeout=8,
            headers={
                "User-Agent": "Mozilla/5.0 VisAIble Playground",
            },
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return local_matches[:8]

    quotes = payload.get("quotes", []) if isinstance(payload, dict) else []
    results: list[dict[str, str]] = []
    seen_tickers: set[str] = set()

    for quote in quotes:
        if not isinstance(quote, dict):
            continue
        symbol = str(quote.get("symbol") or "").upper().strip()
        if not symbol or symbol in seen_tickers:
            continue
        if quote.get("quoteType") not in {"EQUITY", "ETF"}:
            continue

        short_name = str(quote.get("shortname") or quote.get("longname") or symbol).strip()
        sector = str(quote.get("sector") or quote.get("exchangeDisp") or "Market").strip()
        results.append(
            {
                "ticker": symbol,
                "label": short_name,
                "sector": sector,
                "description": f"{short_name} ({symbol}) 종목을 Yahoo Finance 검색 결과에서 불러왔습니다.",
            }
        )
        seen_tickers.add(symbol)

    for item in local_matches:
        ticker = item["ticker"]
        if ticker in seen_tickers:
            continue
        results.append(item)
        seen_tickers.add(ticker)

    return results[:8]


def train_stock_lstm(payload: StockTrainingRequest) -> dict[str, object]:
    period = "2y"
    dates, prices = _load_stock_history(payload.ticker, period=period)
    sample_count = len(prices) - payload.lookbackWindow
    validation_samples = max(24, payload.forecastDays + 10)

    if sample_count <= validation_samples + 24:
        raise ValueError(
            "주가 이력이 너무 짧아서 LSTM 학습에 필요한 윈도우를 만들 수 없습니다. 다른 종목이나 더 짧은 lookback을 시도해 주세요."
        )

    training_samples = sample_count - validation_samples
    training_prices = prices[: training_samples + payload.lookbackWindow]
    min_price = float(training_prices.min())
    max_price = float(training_prices.max())
    scale = max(max_price - min_price, 1e-6)
    normalized = (prices - min_price) / scale

    windows: list[np.ndarray] = []
    targets: list[float] = []
    target_dates: list[str] = []
    target_prices: list[float] = []

    for index in range(payload.lookbackWindow, len(normalized)):
        windows.append(normalized[index - payload.lookbackWindow:index].astype(np.float32))
        targets.append(float(normalized[index]))
        target_dates.append(dates[index])
        target_prices.append(float(prices[index]))

    train_x = np.stack(windows[:training_samples]).reshape(training_samples, payload.lookbackWindow, 1)
    train_y = np.asarray(targets[:training_samples], dtype=np.float32)
    val_x = np.stack(windows[training_samples:]).reshape(validation_samples, payload.lookbackWindow, 1)
    val_y = np.asarray(targets[training_samples:], dtype=np.float32)
    val_dates = target_dates[training_samples:]
    val_actuals = np.asarray(target_prices[training_samples:], dtype=np.float32)

    train_dataset = TensorDataset(torch.tensor(train_x), torch.tensor(train_y))
    train_loader = DataLoader(
        train_dataset,
        batch_size=min(payload.batchSize, training_samples),
        shuffle=True,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.manual_seed(42)
    model, architecture = _build_stock_model(payload.nodes, payload.hiddenSize)
    model = model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=payload.learningRate)
    loss_fn = nn.MSELoss()

    val_x_tensor = torch.tensor(val_x, dtype=torch.float32, device=device)
    val_y_tensor = torch.tensor(val_y, dtype=torch.float32, device=device)
    val_last_input_tensor = val_x_tensor[:, -1, 0]
    losses: list[dict[str, float | int]] = []
    batch_metrics: list[dict[str, float | int]] = []
    batch_step = 0

    for epoch in range(payload.epochs):
        model.train()
        running_loss = 0.0
        running_direction_accuracy = 0.0

        for batch_index, (batch_x, batch_y) in enumerate(train_loader, start=1):
            batch_x = batch_x.to(device)
            batch_y = batch_y.to(device)
            optimizer.zero_grad()
            predictions = model(batch_x).squeeze(-1)
            loss = loss_fn(predictions, batch_y)
            loss.backward()
            optimizer.step()
            running_loss += float(loss.item()) * batch_x.size(0)
            batch_step += 1

            last_input = batch_x[:, -1, 0]
            direction_accuracy = _direction_accuracy(predictions.detach(), batch_y, last_input)
            running_direction_accuracy += direction_accuracy * batch_x.size(0)
            batch_metrics.append(
                {
                    "step": batch_step,
                    "epoch": epoch + 1,
                    "batch": batch_index,
                    "trainLoss": round(float(loss.item()), 6),
                    "directionAccuracy": round(direction_accuracy, 4),
                }
            )

        train_loss = running_loss / training_samples
        train_direction_accuracy = running_direction_accuracy / training_samples

        model.eval()
        with torch.no_grad():
            validation_predictions = model(val_x_tensor).squeeze(-1)
            validation_loss = float(loss_fn(validation_predictions, val_y_tensor).item())
            validation_direction_accuracy = _direction_accuracy(
                validation_predictions,
                val_y_tensor,
                val_last_input_tensor,
            )

        losses.append(
            {
                "epoch": epoch + 1,
                "trainLoss": round(train_loss, 6),
                "validationLoss": round(validation_loss, 6),
                "trainDirectionAccuracy": round(train_direction_accuracy, 4),
                "validationDirectionAccuracy": round(validation_direction_accuracy, 4),
            }
        )

    model.eval()
    with torch.no_grad():
        train_predictions = (
            model(torch.tensor(train_x, dtype=torch.float32, device=device)).squeeze(-1).cpu().numpy()
        )
        validation_predictions = model(val_x_tensor).squeeze(-1).cpu().numpy()

    train_predictions_price = _inverse_scale(train_predictions, min_price, scale)
    train_actual_price = _inverse_scale(train_y, min_price, scale)
    validation_predictions_price = _inverse_scale(validation_predictions, min_price, scale)
    validation_actual_price = _inverse_scale(val_y, min_price, scale)

    forecast_prices = _roll_forward_forecast(
        model=model,
        normalized_history=normalized,
        lookback_window=payload.lookbackWindow,
        forecast_days=payload.forecastDays,
        min_price=min_price,
        scale=scale,
        device=device,
    )
    forecast_dates = _future_business_days(dates[-1], payload.forecastDays)
    selected_preset = next((item for item in STOCK_PRESETS if item["ticker"] == payload.ticker.upper()), None)
    last_close = float(prices[-1])
    forecast_return_pct = ((forecast_prices[-1] - last_close) / last_close) * 100 if last_close else 0.0

    history_window = min(220, len(dates))
    history = [
        {
            "date": dates[index],
            "actual": round(float(prices[index]), 2),
        }
        for index in range(len(dates) - history_window, len(dates))
    ]

    backtest = [
        {
            "date": val_dates[index],
            "actual": round(float(val_actuals[index]), 2),
            "predicted": round(float(validation_predictions_price[index]), 2),
        }
        for index in range(len(val_dates))
    ]

    forecast = [
        {
            "date": forecast_dates[index],
            "predicted": round(float(forecast_prices[index]), 2),
        }
        for index in range(len(forecast_dates))
    ]

    return {
        "ticker": payload.ticker.upper(),
        "companyName": selected_preset["label"] if selected_preset else payload.ticker.upper(),
        "sector": selected_preset["sector"] if selected_preset else "Market Data",
        "period": period,
        "lookbackWindow": payload.lookbackWindow,
        "forecastDays": payload.forecastDays,
        "batchSize": payload.batchSize,
        "trainingSamples": training_samples,
        "validationSamples": validation_samples,
        "architecture": architecture,
        "losses": losses,
        "batchMetrics": batch_metrics,
        "history": history,
        "backtest": backtest,
        "forecast": forecast,
        "metrics": {
            "trainRmse": round(_rmse(train_predictions_price, train_actual_price), 4),
            "validationRmse": round(_rmse(validation_predictions_price, validation_actual_price), 4),
            "lastClose": round(last_close, 2),
            "forecastReturnPct": round(float(forecast_return_pct), 2),
        },
    }


def _build_stock_model(
    nodes: list[StockNodePayload],
    fallback_hidden_size: int,
) -> tuple[StockLSTM, list[str]]:
    resolved_nodes = nodes or [
        StockNodePayload(
            id="stock-lstm-default",
            type="lstm",
            title="LSTM Layer",
            fields=[
                {"label": "Input Size", "value": "1"},
                {"label": "Hidden Size", "value": str(fallback_hidden_size)},
                {"label": "Num Layers", "value": "1"},
            ],
            activation="None",
        ),
        StockNodePayload(
            id="stock-dropout-default",
            type="dropout",
            title="Dropout Layer",
            fields=[{"label": "Probability", "value": "0.15"}],
            activation="None",
        ),
        StockNodePayload(
            id="stock-linear-default",
            type="linear",
            title="Linear Layer",
            fields=[
                {"label": "Input", "value": str(fallback_hidden_size)},
                {"label": "Output", "value": "1"},
            ],
            activation="None",
        ),
    ]

    current_sequence_size = 1
    current_head_size: int | None = None
    seen_dense_head = False
    lstm_layers: list[dict[str, int]] = []
    head_layers: list[nn.Module] = []
    architecture: list[str] = []

    for node in resolved_nodes:
        node_type = node.type.lower()
        if node_type == "lstm":
            if seen_dense_head:
                raise ValueError("LSTM 블럭은 Dense Head 이전에만 둘 수 있습니다.")

            expected_input = current_sequence_size
            input_size = _field_int(node, "Input Size", expected_input)
            hidden_size = _field_int(node, "Hidden Size", fallback_hidden_size)
            num_layers = _field_int(node, "Num Layers", 1)

            if input_size != expected_input:
                raise ValueError(f"{node.title}의 Input Size는 이전 출력 차원인 {expected_input}과 맞아야 합니다.")
            if hidden_size <= 0 or num_layers <= 0:
                raise ValueError("LSTM Hidden Size와 Num Layers는 1 이상이어야 합니다.")

            lstm_layers.append(
                {
                    "input_size": input_size,
                    "hidden_size": hidden_size,
                    "num_layers": num_layers,
                }
            )
            current_sequence_size = hidden_size
            current_head_size = hidden_size
            architecture.append(f"LSTM({input_size}->{hidden_size}, layers={num_layers})")
            continue

        if node_type == "dropout":
            probability = _field_float(node, "Probability", 0.15)
            if not 0 <= probability < 1:
                raise ValueError("Dropout Probability는 0 이상 1 미만이어야 합니다.")
            head_layers.append(nn.Dropout(p=probability))
            seen_dense_head = True
            current_head_size = current_head_size or current_sequence_size
            architecture.append(f"Dropout(p={probability:.2f})")
            continue

        if node_type == "linear":
            seen_dense_head = True
            expected_input = current_head_size or current_sequence_size
            input_size = _field_int(node, "Input", expected_input)
            output_size = _field_int(node, "Output", 1)
            if input_size != expected_input:
                raise ValueError(f"{node.title}의 Input은 이전 출력 차원인 {expected_input}과 맞아야 합니다.")
            if output_size <= 0:
                raise ValueError("Linear Output은 1 이상이어야 합니다.")

            head_layers.append(nn.Linear(input_size, output_size))
            current_head_size = output_size
            architecture.append(f"Linear({input_size}->{output_size})")

            activation_layer = _activation_layer(node.activation)
            if activation_layer is not None:
                head_layers.append(activation_layer)
                architecture.append(node.activation)
            continue

        raise ValueError(f"지원하지 않는 Playground 블럭 타입입니다: {node.type}")

    if not lstm_layers:
        raise ValueError("주식 Playground는 최소 1개의 LSTM 블럭이 필요합니다.")

    final_output_size = current_head_size or current_sequence_size
    if not head_layers:
        head_layers.append(nn.Linear(final_output_size, 1))
        architecture.append(f"Linear({final_output_size}->1)")
        final_output_size = 1

    if final_output_size != 1:
        raise ValueError("마지막 Linear 블럭의 Output은 1이어야 다음 거래일 종가를 예측할 수 있습니다.")

    return StockLSTM(lstm_layers=lstm_layers, head_layers=head_layers), architecture


def _load_yfinance():
    try:
        return import_module("yfinance")
    except ImportError as error:
        raise ValueError(
            "주식 Playground를 사용하려면 backend 환경에 `yfinance`가 설치되어 있어야 합니다. `pip install -r backend/requirements.txt` 후 다시 시도해 주세요."
        ) from error


def _load_stock_history(ticker: str, period: str) -> tuple[list[str], np.ndarray]:
    normalized_ticker = ticker.upper()
    cache_key = (normalized_ticker, period)
    cached = STOCK_HISTORY_CACHE.get(cache_key)
    if cached is not None:
        cached_dates, cached_prices = cached
        return list(cached_dates), cached_prices.copy()

    yf = _load_yfinance()

    try:
        history = yf.Ticker(normalized_ticker).history(period=period, interval="1d", auto_adjust=False)
    except Exception as error:
        raise ValueError(f"{normalized_ticker} 데이터를 가져오지 못했습니다: {error}") from error

    if history is None or history.empty or "Close" not in history:
        raise ValueError(f"{normalized_ticker} 주가 데이터를 찾지 못했습니다. 다른 티커를 선택해 주세요.")

    close_series = history["Close"].dropna()
    if close_series.empty:
        raise ValueError(f"{normalized_ticker} 종가 데이터가 비어 있습니다.")

    dates = [index.strftime("%Y-%m-%d") for index in close_series.index.to_pydatetime()]
    prices = close_series.to_numpy(dtype=np.float32)
    STOCK_HISTORY_CACHE[cache_key] = (dates, prices.copy())
    return dates, prices


def _inverse_scale(values: np.ndarray, min_price: float, scale: float) -> np.ndarray:
    return values * scale + min_price


def _rmse(predictions: np.ndarray, actuals: np.ndarray) -> float:
    return float(sqrt(np.mean((predictions - actuals) ** 2)))


def _field_value(node: StockNodePayload, label: str, fallback: str) -> str:
    return next((field.value for field in node.fields if field.label == label), fallback)


def _field_int(node: StockNodePayload, label: str, fallback: int) -> int:
    try:
        return int(float(_field_value(node, label, str(fallback))))
    except ValueError as error:
        raise ValueError(f"{node.title}의 {label} 값을 숫자로 입력해 주세요.") from error


def _field_float(node: StockNodePayload, label: str, fallback: float) -> float:
    try:
        return float(_field_value(node, label, str(fallback)))
    except ValueError as error:
        raise ValueError(f"{node.title}의 {label} 값을 숫자로 입력해 주세요.") from error


def _activation_layer(name: str) -> nn.Module | None:
    normalized = name.strip().lower()
    if normalized in {"", "none"}:
        return None
    if normalized == "relu":
        return nn.ReLU()
    if normalized == "tanh":
        return nn.Tanh()
    if normalized == "sigmoid":
        return nn.Sigmoid()
    if normalized == "gelu":
        return nn.GELU()
    raise ValueError(f"지원하지 않는 활성화 함수입니다: {name}")


def _direction_accuracy(
    predictions: torch.Tensor,
    targets: torch.Tensor,
    last_input: torch.Tensor,
) -> float:
    predicted_direction = predictions - last_input
    target_direction = targets - last_input
    correct = ((predicted_direction >= 0) == (target_direction >= 0)).float().mean()
    return float(correct.item())


def _roll_forward_forecast(
    model: StockLSTM,
    normalized_history: np.ndarray,
    lookback_window: int,
    forecast_days: int,
    min_price: float,
    scale: float,
    device: torch.device,
) -> list[float]:
    rolling_window = normalized_history[-lookback_window:].astype(np.float32).copy()
    forecast_values: list[float] = []

    for _ in range(forecast_days):
        input_tensor = torch.tensor(rolling_window.reshape(1, lookback_window, 1), dtype=torch.float32, device=device)
        with torch.no_grad():
            next_value = float(model(input_tensor).squeeze().item())
        rolling_window = np.concatenate([rolling_window[1:], np.asarray([next_value], dtype=np.float32)])
        forecast_values.append(float(next_value * scale + min_price))

    return forecast_values


def _future_business_days(last_date: str, count: int) -> list[str]:
    cursor = datetime.fromisoformat(last_date)
    dates: list[str] = []

    while len(dates) < count:
        cursor += timedelta(days=1)
        if cursor.weekday() >= 5:
            continue
        dates.append(cursor.strftime("%Y-%m-%d"))

    return dates
