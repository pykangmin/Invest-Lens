import { MovingAverageChart } from '../visualization/MovingAverageChart';

type Props = {
  onBack: () => void;
};

const metrics = [
  { label: 'VIX', value: '13.4', note: '동결 유지' },
  { label: 'RSI (14D)', value: '71.4', note: '동결 유지' },
  { label: 'MACD', value: '+2.80', note: '동결 유지' },
  { label: '거래량', value: '112%', note: '역대 최저' },
];

const insights = [
  'RSI 71.4로 과매수 구간 진입, 단기 조정 가능성이 높아집니다.',
  'VIX 13.4는 역사적 저점 수준으로 변동성이 억눌려 있습니다.',
  'MACD +2.80은 상승 모멘텀 강화 신호로 해석됩니다.',
  '거래량 112%는 20일 평균 대비 소폭 증가한 수준입니다.',
];

export function TechnicalView({ onBack }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 text-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            기술적 지표 및 시장 심리
          </h1>
        </div>
        <div className="px-4 py-2 rounded-full border-2 border-blue-500 bg-blue-50">
          <span className="text-sm font-bold text-blue-600">Extreme Greed</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((m, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs font-semibold text-gray-600">
                  {m.label}
                </span>
                <span className="text-xs text-gray-400">ⓘ</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {m.value}
              </div>
              <div className="text-xs text-blue-500 font-medium">{m.note}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">AI 인사이트</h3>
          <ul className="space-y-3">
            {insights.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="text-sm text-gray-600 leading-relaxed">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          가격 & 이동평균선 (MA20 / MA50 / MA200)
        </h3>
        <div className="h-[500px]">
          <MovingAverageChart />
        </div>
      </div>
    </div>
  );
}
