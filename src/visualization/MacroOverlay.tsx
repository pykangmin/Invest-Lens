import ReactECharts from 'echarts-for-react';

function buildDates(months: number): string[] {
  const out: string[] = [];
  const now = new Date(2026, 3, 1);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

const dates = buildDates(24);

const spx = [
  4150, 4200, 4240, 4310, 4280, 4350, 4420, 4480, 4510, 4560, 4620, 4680,
  4720, 4760, 4820, 4890, 4930, 4980, 5040, 5080, 5120, 5180, 5220, 5280,
];

const fedRate = [
  4.50, 4.75, 5.00, 5.25, 5.25, 5.25, 5.25, 5.25, 5.25, 5.25, 5.00, 4.75,
  4.75, 4.50, 4.50, 4.25, 4.25, 4.25, 4.25, 4.25, 4.25, 4.25, 4.25, 4.25,
];

const m2 = [
  20.8, 20.7, 20.6, 20.5, 20.4, 20.3, 20.3, 20.4, 20.5, 20.6, 20.7, 20.9,
  21.0, 21.2, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 22.0, 22.1, 22.2, 22.3,
];

export function MacroOverlay() {
  const option = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['S&P 500', 'Fed Rate', 'M2 (조$)'],
      top: 0,
    },
    grid: { left: 60, right: 60, top: 40, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 10, interval: 2 },
    },
    yAxis: [
      {
        type: 'value',
        name: '지수/M2',
        position: 'left',
        axisLabel: { fontSize: 10 },
      },
      {
        type: 'value',
        name: '금리(%)',
        position: 'right',
        axisLabel: { fontSize: 10, formatter: '{value}%' },
        max: 6,
        min: 3,
      },
    ],
    series: [
      {
        name: 'S&P 500',
        type: 'line',
        yAxisIndex: 0,
        data: spx,
        smooth: true,
        lineStyle: { color: '#2563eb', width: 2 },
        itemStyle: { color: '#2563eb' },
        symbol: 'none',
      },
      {
        name: 'Fed Rate',
        type: 'line',
        yAxisIndex: 1,
        data: fedRate,
        smooth: true,
        lineStyle: { color: '#dc2626', width: 2 },
        itemStyle: { color: '#dc2626' },
        symbol: 'none',
      },
      {
        name: 'M2 (조$)',
        type: 'line',
        yAxisIndex: 0,
        data: m2.map((v) => v * 230),
        smooth: true,
        lineStyle: { color: '#16a34a', width: 2, type: 'dashed' },
        itemStyle: { color: '#16a34a' },
        symbol: 'none',
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%', minHeight: 400 }}
    />
  );
}
