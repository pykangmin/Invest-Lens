import { MacroOverlay } from '../visualization/MacroOverlay';

type Props = {
  onBack: () => void;
};

const metrics = [
  { label: 'Fed Rate', value: '4.25%', note: '동결 유지' },
  { label: '10Y Yield', value: '4.25%', note: '동결 유지' },
  { label: 'CPI (YoY)', value: '4.25%', note: '동결 유지' },
  { label: 'DXY', value: '4.25%', note: '동결 유지' },
];

const insights = [
  'Fed 금리와 S&P 500은 최근 6개월간 역상관(-0.74)이 뚜렷합니다.',
  '10Y Yield와 성장주 수익률의 상관관계가 약해지는 추세입니다.',
  'CPI가 3개월 연속 둔화되며 soft landing 시나리오가 강화됩니다.',
  'DXY 약세가 신흥국 주식의 유동성 유입을 견인하고 있습니다.',
];

export function MacroView({ onBack }: Props) {
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
            거시 경제 지표 & 유동성
          </h1>
        </div>
        <div className="px-4 py-2 rounded-full border-2 border-green-500 bg-green-50">
          <span className="text-sm font-bold text-green-600">Soft Landing</span>
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
          S&P 500 vs Fed Rate vs M2 — 상관관계 오버레이
        </h3>
        <div className="h-[500px]">
          <MacroOverlay />
        </div>
      </div>
    </div>
  );
}
