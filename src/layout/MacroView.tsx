import { MacroOverlay } from '../visualization/MacroOverlay';
import { BackButton } from './BackButton';
import { IndicatorCard } from './IndicatorCard';
import { InsightPanel } from './InsightPanel';

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
    <div className="container">
      <div className="sub-top-bar">
        <div className="sub-title-row">
          <BackButton onClick={onBack} />
          <h1 className="sub-title">거시 경제 지표 &amp; 유동성</h1>
        </div>
        <div className="badge-pill badge-pill-green">Soft Landing</div>
      </div>

      <div className="sub-split">
        <div className="indicator-grid">
          {metrics.map((m, i) => (
            <IndicatorCard
              key={i}
              label={m.label}
              value={m.value}
              note={m.note}
            />
          ))}
        </div>
        <InsightPanel items={insights} />
      </div>

      <div className="card sub-chart-card">
        <div className="card-header">
          <span className="card-header-title">
            S&amp;P 500 vs Fed Rate vs M2 — 상관관계 오버레이
          </span>
        </div>
        <div className="chart-card-body">
          <div className="chart-box-tall">
            <MacroOverlay />
          </div>
        </div>
      </div>
    </div>
  );
}
