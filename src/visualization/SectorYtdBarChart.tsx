import ReactECharts from 'echarts-for-react';

const sectors = [
  { name: 'Tech', ytd: 22.4 },
  { name: 'Healthcare', ytd: 5.8 },
  { name: 'Financials', ytd: 9.1 },
  { name: 'Energy', ytd: -5.6 },
  { name: 'Consumer', ytd: 4.3 },
  { name: 'Industrials', ytd: 1.7 },
  { name: 'Utilities', ytd: -2.4 },
  { name: 'Materials', ytd: 6.9 },
];

export function SectorYtdBarChart() {
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
    },
    grid: { left: 90, right: 30, top: 20, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
    },
    yAxis: {
      type: 'category',
      data: sectors.map((s) => s.name).reverse(),
      axisLabel: { fontSize: 12, color: '#374151' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: sectors
          .slice()
          .reverse()
          .map((s) => ({
            value: s.ytd,
            itemStyle: { color: s.ytd >= 0 ? '#22c55e' : '#ef4444' },
          })),
        barWidth: '55%',
        label: {
          show: true,
          position: 'right',
          formatter: (p: { value: number }) =>
            `${p.value >= 0 ? '+' : ''}${p.value.toFixed(1)}%`,
          fontSize: 11,
          color: '#374151',
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%', minHeight: 380 }}
    />
  );
}
