import { SectorTreemap } from '../visualization/SectorTreemap';
import { SectorYtdBarChart } from '../visualization/SectorYtdBarChart';
import { BackButton } from './BackButton';
import { IndicatorCard } from './IndicatorCard';
import { InsightPanel } from './InsightPanel';

type Props = {
  onBack: () => void;
};

const metrics = [
  { label: 'S&P PER', value: '4.25%', note: '동결 유지' },
  { label: 'EPS Growth', value: '+11.7%', note: '동결 유지' },
  { label: 'PBR', value: '22.4x', note: '동결 유지' },
  { label: '배당 수익률', value: '4.25%', note: '역대 최저', noteRed: true },
];

const insights = [
  'Google의 PER이 섹터 평균 대비 낮아 밸류에이션 매력 구간입니다.',
  'EPS 성장률 +11.7%로 3분기 연속 개선 흐름입니다.',
  'PBR 22.4배는 업종 평균을 상회하며 주가 프리미엄이 존재합니다.',
  '배당 수익률 4.25%는 5년 평균을 하회하는 수준입니다.',
];

export function FundamentalsView({ onBack }: Props) {
  return (
    <div className="container">
      <div className="sub-top-bar">
        <div className="sub-title-row">
          <BackButton onClick={onBack} />
          <h1 className="sub-title">기업 펀더멘털 &amp; 평가</h1>
        </div>
        <div className="badge-circle">20</div>
      </div>

      <div className="sub-split">
        <div className="indicator-grid">
          {metrics.map((m, i) => (
            <IndicatorCard
              key={i}
              label={m.label}
              value={m.value}
              note={m.note}
              noteRed={m.noteRed}
            />
          ))}
        </div>
        <InsightPanel items={insights} />
      </div>

      <div className="card sub-chart-card">
        <div className="card-header">
          <span className="card-header-title">
            섹터 트리맵 — 면적:시가총액 비중 / 색상:YTD 수익률 / 클릭:상세
          </span>
        </div>
        <div className="chart-card-body">
          <div className="chart-box-tall">
            <SectorTreemap />
          </div>
        </div>
      </div>

      <div className="card sub-chart-card">
        <div className="card-header">
          <span className="card-header-title">섹터별 YTD 수익률 비교</span>
        </div>
        <div className="chart-card-body">
          <div className="chart-box">
            <SectorYtdBarChart />
          </div>
        </div>
      </div>
    </div>
  );
}
