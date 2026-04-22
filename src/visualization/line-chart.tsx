import ReactECharts from 'echarts-for-react';
import type { TimePoint } from '../types/number';

export function LineChart({ data }: { data: TimePoint[] }) {
  const option = {
    xAxis: { type: 'category', data: data.map((d) => d.date) },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: data.map((d) => d.value) }],
  };
  return <ReactECharts option={option} style={{ height: 400 }} />;
}
