import ReactECharts from 'echarts-for-react';

function buildDates(count: number): string[] {
  const out: string[] = [];
  const now = new Date(2026, 3, 20);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(
      `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return out;
}

const dates = buildDates(90);

function buildRsi(): number[] {
  const out: number[] = [];
  let v = 45;
  for (let i = 0; i < dates.length; i++) {
    const swing = Math.sin(i * 0.18) * 10 + Math.cos(i * 0.09) * 6;
    const drift = i * 0.15;
    v = 45 + swing + drift;
    v = Math.max(15, Math.min(92, v));
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

const rsiSeries = buildRsi();

export function RsiChart() {
  const option = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => v.toFixed(2),
    },
    grid: { left: 50, right: 30, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 10, interval: 10 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      interval: 25,
      axisLabel: { fontSize: 10 },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [
      {
        name: 'RSI (14D)',
        type: 'line',
        data: rsiSeries,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#6366f1', width: 2 },
        itemStyle: { color: '#6366f1' },
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            position: 'end',
            fontSize: 10,
            color: '#64748b',
          },
          lineStyle: { type: 'dashed' },
          data: [
            {
              yAxis: 70,
              lineStyle: { color: '#ef4444' },
              label: { formatter: '과매수 70', color: '#ef4444' },
            },
            {
              yAxis: 30,
              lineStyle: { color: '#22c55e' },
              label: { formatter: '과매도 30', color: '#22c55e' },
            },
          ],
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
