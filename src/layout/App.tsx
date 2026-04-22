import { loadMockTimeseries } from '../data-loader/mock-timeseries';
import { analyzeTimeseries } from '../analysis/identity';
import { LineChart } from '../visualization/line-chart';

export default function App() {
  const raw = loadMockTimeseries();
  const analyzed = analyzeTimeseries(raw);
  return (
    <div style={{ padding: 24 }}>
      <h1>파이프라인 검증용 허수아비 대시보드</h1>
      <LineChart data={analyzed} />
    </div>
  );
}
