import { SectorTreemap } from '../visualization/SectorTreemap';

type Props = {
  onBack: () => void;
};

const metrics = [
  { label: 'S&P PER', value: '4.25%', note: '동결 유지' },
  { label: 'EPS Growth', value: '+11.7%', note: '동결 유지' },
  { label: 'PBR', value: '22.4x', note: '동결 유지' },
  { label: '배당 수익률', value: '4.25%', note: '역대 최저' },
];

const insights = [
  'Google의 PER이 섹터 평균 대비 낮아 밸류에이션 매력 구간입니다.',
  'EPS 성장률 +11.7%로 3분기 연속 개선 흐름입니다.',
  'PBR 22.4배는 업종 평균을 상회하며 주가 프리미엄이 존재합니다.',
  '배당 수익률 4.25%는 5년 평균을 하회하는 수준입니다.',
];

export function FundamentalsView({ onBack }: Props) {
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
          <h1 className="text-2xl font-bold text-gray-900">기업 펀더멘털 & 평가</h1>
        </div>
        <div className="w-16 h-16 rounded-full border-4 border-red-500 flex items-center justify-center bg-white">
          <span className="text-2xl font-bold text-red-500">20</span>
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
          섹터 트리맵 — 면적:시가총액 비중 / 색상:YTD 수익률 / 클릭:상세
        </h3>
        <div className="h-[500px]">
          <SectorTreemap />
        </div>
      </div>
    </div>
  );
}
