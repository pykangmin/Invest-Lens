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

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Google</h1>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-semibold text-gray-900">102.36$</span>
            <span className="text-sm font-semibold text-green-600">
              +2.36$ (0.87%)
            </span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 flex-1 max-w-2xl">
          {sp500Cards.map((c, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm"
            >
              <div className="text-[11px] text-gray-500">S&P 500</div>
              <div className="text-sm font-semibold text-gray-900 mt-0.5">
                {c.value}
              </div>
              <div
                className={`text-xs font-semibold ${
                  c.isUp ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {c.delta}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div
              onMouseEnter={() => setActiveChart('fundamentals')}
              onClick={() => onNavigate('fundamentals')}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600 leading-tight">
                  기업 펀더멘털<br />& 평가
                </span>
                <span className="text-[10px] font-bold text-gray-400 hover:text-blue-600">
                  MORE »
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <span className="text-5xl font-bold text-yellow-500">60</span>
              </div>
            </div>

            <div
              onMouseEnter={() => setActiveChart('macro')}
              onClick={() => onNavigate('macro')}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600 leading-tight">
                  거시 경제 지표<br />& 유동성
                </span>
                <span className="text-[10px] font-bold text-gray-400 hover:text-blue-600">
                  MORE »
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center text-center">
                <span className="text-xl font-bold text-green-600 leading-tight">
                  Soft<br />Landing
                </span>
              </div>
            </div>

            <div
              onMouseEnter={() => setActiveChart('empty')}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition min-h-[150px]"
            />

            <div
              onMouseEnter={() => setActiveChart('technical')}
              onClick={() => onNavigate('technical')}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600 leading-tight">
                  기술적 지표<br />및 시장 심리
                </span>
                <span className="text-[10px] font-bold text-gray-400 hover:text-blue-600">
                  MORE »
                </span>
              </div>
              <div className="flex-1 flex items-end">
                <div className="w-full">
                  <FearGreedGauge value={23} label="Extreme Fear" color="#ef4444" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">관련 뉴스</h3>
            <ul className="space-y-2">
              {news.map((item, i) => (
                <li key={i} className="text-xs text-gray-500 leading-relaxed">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm h-full flex flex-col min-h-[600px]">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">차트</h3>
            <div className="flex-1">{renderChart()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
