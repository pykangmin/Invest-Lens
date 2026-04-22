import { MovingAverageChart } from '../visualization/MovingAverageChart';
import { RsiChart } from '../visualization/RsiChart';
import { BackButton } from './BackButton';
import { IndicatorCard } from './IndicatorCard';
import { InsightPanel } from './InsightPanel';

type Props = {
  onBack: () => void;
};

const metrics = [
  { label: 'VIX', value: '13.4', note: '동결 유지' },
  { label: 'RSI (14D)', value: '71.4', note: '동결 유지' },
  { label: 'MACD', value: '+2.80', note: '동결 유지' },
  { label: '거래량', value: '112%', note: '역대 최저', noteRed: true },
];

const insights = [
  'RSI 71.4로 과매수 구간 진입, 단기 조정 가능성이 높아집니다.',
  'VIX 13.4는 역사적 저점 수준으로 변동성이 억눌려 있습니다.',
  'MACD +2.80은 상승 모멘텀 강화 신호로 해석됩니다.',
  '거래량 112%는 20일 평균 대비 소폭 증가한 수준입니다.',
];

export function TechnicalView({ onBack }: Props) {
  return (
    <div className="container">
      <div className="sub-top-bar">
        <div className="sub-title-row">
          <BackButton onClick={onBack} />
          <h1 className="sub-title">기술적 지표 및 시장 심리</h1>
        </div>
        <div className="badge-pill badge-pill-blue">Extreme Greed</div>
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
            가격 &amp; 이동평균선 (MA20 / MA50 / MA200)
          </span>
        </div>
        <div className="chart-card-body">
          <div className="chart-box-tall">
            <MovingAverageChart />
          </div>
        </div>
      </div>

      <div className="card sub-chart-card">
        <div className="card-header">
          <span className="card-header-title">
            RSI (14D) — 과매수(70) / 과매도(30)
          </span>
        </div>
        <div className="chart-card-body">
          <div className="chart-box">
            <RsiChart />
          </div>
        </div>
      </div>
    </div>
  );
}
