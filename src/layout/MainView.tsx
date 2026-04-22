import { useState } from 'react';
import { SectorTreemap } from '../visualization/SectorTreemap';
import { MacroOverlay } from '../visualization/MacroOverlay';
import { MovingAverageChart } from '../visualization/MovingAverageChart';
import { FearGreedGauge } from '../visualization/FearGreedGauge';

export type SubView = 'fundamentals' | 'macro' | 'technical';
type ChartKey = 'fundamentals' | 'macro' | 'technical' | 'empty';

type Props = {
  onNavigate: (view: SubView) => void;
};

const sp500Cards = [
  { value: '35.301 $', delta: '-1.6%', isUp: false },
  { value: '35.301 $', delta: '+3.2%', isUp: true },
  { value: '35.301 $', delta: '-1.6%', isUp: false },
  { value: '35.301 $', delta: '+3.2%', isUp: true },
];

const news = [
  'Fed, 기준금리 4.25% 동결 결정',
  'S&P 500 사상 최고치 경신',
  'Google 3분기 실적 발표 예정',
  '반도체 섹터 상승세 지속',
];

function MoreButton({ onClick }: { onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] font-bold text-white bg-slate-600 hover:bg-slate-800 rounded-full px-2.5 py-0.5 tracking-wide"
    >
      MORE »
    </button>
  );
}

function CardHeader({
  title,
  showMore = true,
  onMore,
}: {
  title: string;
  showMore?: boolean;
  onMore?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-100/70 px-4 py-2 border-b border-gray-200">
      <span className="text-xs font-semibold text-gray-700">{title}</span>
      {showMore && <MoreButton onClick={onMore} />}
    </div>
  );
}

export function MainView({ onNavigate }: Props) {
  const [activeChart, setActiveChart] = useState<ChartKey>('fundamentals');

  function renderChart() {
    switch (activeChart) {
      case 'fundamentals':
        return <SectorTreemap />;
      case 'macro':
        return <MacroOverlay />;
      case 'technical':
        return <MovingAverageChart />;
      case 'empty':
        return (
          <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
            표시할 차트가 없습니다
          </div>
        );
    }
  }

  const handleNav = (sub: SubView) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(sub);
  };

  return (
    <div className="max-w-7xl mx-auto px-8 pt-6 pb-8">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <div className="text-3xl font-semibold text-gray-900 leading-tight">
            Google
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-4xl font-bold text-green-500 leading-none">
              102.36$
            </span>
            <span className="text-lg font-semibold text-green-500">
              +2.36$ (0.87%)
            </span>
          </div>
        </div>
        <div className="flex items-start gap-10 pt-2">
          {sp500Cards.map((c, i) => (
            <div key={i} className="text-right">
              <div className="text-[11px] text-gray-500 font-medium">
                S&P 500
              </div>
              <div className="text-base font-semibold text-gray-900 mt-0.5">
                {c.value}
              </div>
              <div
                className={`text-xs font-semibold mt-0.5 ${
                  c.isUp ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {c.delta}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-1 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div
              onMouseEnter={() => setActiveChart('fundamentals')}
              onClick={() => onNavigate('fundamentals')}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden flex flex-col h-[180px]"
            >
              <CardHeader
                title="기업 펀더멘털 & 평가"
                onMore={handleNav('fundamentals')}
              />
              <div className="flex-1 flex items-center justify-center bg-white">
                <span className="text-5xl font-bold text-yellow-500">60</span>
              </div>
            </div>

            <div
              onMouseEnter={() => setActiveChart('macro')}
              onClick={() => onNavigate('macro')}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden flex flex-col h-[180px]"
            >
              <CardHeader
                title="거시 경제 지표 & 유동성"
                onMore={handleNav('macro')}
              />
              <div className="flex-1 flex items-center justify-center bg-white text-center">
                <span className="text-2xl font-bold text-green-600 leading-tight">
                  Soft<br />Landing
                </span>
              </div>
            </div>

            <div
              onMouseEnter={() => setActiveChart('empty')}
              className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-[180px]"
            >
              <div className="bg-gray-100/70 px-4 py-2 border-b border-gray-200 h-[34px]" />
              <div className="flex-1 bg-white" />
            </div>

            <div
              onMouseEnter={() => setActiveChart('technical')}
              onClick={() => onNavigate('technical')}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden flex flex-col h-[180px]"
            >
              <CardHeader
                title="기술적 지표 및 시장 심리"
                onMore={handleNav('technical')}
              />
              <div className="flex-1 flex items-center justify-center bg-white">
                <FearGreedGauge value={23} label="Extreme Fear" color="#ef4444" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-gray-100/70 px-4 py-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">관련 뉴스</span>
            </div>
            <ul className="p-4 space-y-3 bg-white">
              {news.map((item, i) => (
                <li
                  key={i}
                  className="text-xs text-gray-500 leading-relaxed border-b border-gray-100 pb-2 last:border-b-0 last:pb-0"
                >
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden h-full flex flex-col min-h-[620px]">
            <div className="bg-gray-100/70 px-4 py-2 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700">차트</span>
            </div>
            <div className="flex-1 p-2">{renderChart()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
