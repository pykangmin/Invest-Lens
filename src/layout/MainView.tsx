import { useState } from 'react';
import { SectorTreemap } from '../visualization/SectorTreemap';
import { MacroOverlay } from '../visualization/MacroOverlay';
import { MovingAverageChart } from '../visualization/MovingAverageChart';
import { FearGreedGauge } from '../visualization/FearGreedGauge';

export type SubView = 'fundamentals' | 'macro' | 'technical';
type ChartKey = 'fundamentals' | 'macro' | 'technical';

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

function MoreButton(props: { onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button type="button" className="more-button" onClick={props.onClick}>
      MORE »
    </button>
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
    }
  }

  const stopPropNav = (sub: SubView) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(sub);
  };

  return (
    <div className="container">
      <div className="hero-band">
        <div>
          <div className="hero-symbol">Google</div>
          <div className="hero-price-row">
            <span className="hero-price">102.36$</span>
            <span className="hero-delta">+2.36$ (0.87%)</span>
          </div>
        </div>
        <div className="sp-strip">
          {sp500Cards.map((c, i) => (
            <div key={i} className="sp-cell">
              <div className="sp-label">S&amp;P 500</div>
              <div className="sp-value">{c.value}</div>
              <div className={c.isUp ? 'sp-delta-up' : 'sp-delta-down'}>
                {c.delta}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="main-grid">
        <div className="main-left">
          <div className="metric-grid">
            <div
              className="card card-interactive metric-card"
              onMouseEnter={() => setActiveChart('fundamentals')}
              onClick={() => onNavigate('fundamentals')}
            >
              <div className="card-header">
                <span className="card-header-title">기업 펀더멘털 &amp; 평가</span>
                <MoreButton onClick={stopPropNav('fundamentals')} />
              </div>
              <div className="card-body">
                <span className="metric-display-big">60</span>
              </div>
            </div>

            <div
              className="card card-interactive metric-card"
              onMouseEnter={() => setActiveChart('macro')}
              onClick={() => onNavigate('macro')}
            >
              <div className="card-header">
                <span className="card-header-title">거시 경제 지표 &amp; 유동성</span>
                <MoreButton onClick={stopPropNav('macro')} />
              </div>
              <div className="card-body">
                <span className="metric-display-phrase">
                  Soft
                  <br />
                  Landing
                </span>
              </div>
            </div>

            <div
              className="card card-interactive metric-card"
              onMouseEnter={() => setActiveChart('fundamentals')}
              onClick={() => onNavigate('fundamentals')}
            >
              <div className="card-header">
                <span className="card-header-title">기업 펀더멘털 &amp; 평가</span>
                <MoreButton onClick={stopPropNav('fundamentals')} />
              </div>
              <div className="card-body">
                <span className="metric-display-big">60</span>
              </div>
            </div>

            <div
              className="card card-interactive metric-card"
              onMouseEnter={() => setActiveChart('technical')}
              onClick={() => onNavigate('technical')}
            >
              <div className="card-header">
                <span className="card-header-title">기술적 지표 및 시장 심리</span>
                <MoreButton onClick={stopPropNav('technical')} />
              </div>
              <div className="card-body">
                <FearGreedGauge value={23} label="Extreme Fear" color="#ef4444" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-header-title">관련 뉴스</span>
            </div>
            <div className="card-body-plain">
              <ul className="news-list">
                {news.map((item, i) => (
                  <li key={i} className="news-item">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div>
          <div className="card chart-card">
            <div className="card-header">
              <span className="card-header-title">차트</span>
            </div>
            <div className="chart-card-body">{renderChart()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
