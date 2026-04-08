import type { StockPreset } from '@/types/builder';

export const stockPlaygroundPresets: StockPreset[] = [
  {
    ticker: 'AAPL',
    label: 'Apple',
    sector: 'Consumer Tech',
    description:
      '제품 사이클과 서비스 매출이 함께 움직여서, 상대적으로 읽기 쉬운 중기 추세를 관찰하기 좋은 대표 종목입니다.',
  },
  {
    ticker: 'MSFT',
    label: 'Microsoft',
    sector: 'Cloud Software',
    description:
      'Azure와 엔터프라이즈 소프트웨어 흐름이 반영되어 완만한 장기 추세와 이벤트성 변동을 함께 살펴보기 좋습니다.',
  },
  {
    ticker: 'NVDA',
    label: 'NVIDIA',
    sector: 'AI Semiconductors',
    description:
      'AI 기대감이 가격에 강하게 반영되어 고변동 모멘텀 구간이 많아서 시계열 모델의 강점과 한계를 잘 드러냅니다.',
  },
  {
    ticker: 'TSLA',
    label: 'Tesla',
    sector: 'EV Mobility',
    description:
      '뉴스 민감도가 크고 추세 전환 폭이 커서 예측 난도가 높은 사례로 실험하기 좋은 종목입니다.',
  },
];
