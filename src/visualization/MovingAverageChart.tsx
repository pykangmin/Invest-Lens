import ReactECharts from 'echarts-for-react';

function buildDates(days: number): string[] {
  const out: string[] = [];
  const now = new Date(2026, 3, 20);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 3);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  return out;
}

const dates = buildDates(80);

function buildPrice(): number[] {
  const prices: number[] = [];
  let price = 85;
  for (let i = 0; i < dates.length; i++) {
    const drift = 0.3;
    const noise = (Math.sin(i * 0.4) + Math.cos(i * 0.17)) * 1.2;
    price += drift + noise;
    prices.push(Number(price.toFixed(2)));
  }
  return prices;
}

function movingAverage(series: number[], period: number): (number | null)[] {
  return series.map((_, i) => {
    if (i < period - 1) return null;
    const slice = series.slice(i - period + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    return Number((sum / period).toFixed(2));
  });
}

const price = buildPrice();
const ma20 = movingAverage(price, 20);
const ma50 = movingAverage(price, 50);
const ma200 = movingAverage(price, 80);

export function MovingAverageChart() {
  const option = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['종가', 'MA20', 'MA50', 'MA200'],
      top: 0,
    },
    grid: { left: 50, right: 30, top: 40, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 10, interval: 10 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        name: '종가',
        type: 'line',
        data: price,
        lineStyle: { color: '#111827', width: 2.5 },
        itemStyle: { color: '#111827' },
        symbol: 'none',
      },
      {
        name: 'MA20',
        type: 'line',
        data: ma20,
        lineStyle: { color: '#2563eb', width: 1.5 },
        itemStyle: { color: '#2563eb' },
        symbol: 'none',
      },
      {
        name: 'MA50',
        type: 'line',
        data: ma50,
        lineStyle: { color: '#f59e0b', width: 1.5 },
        itemStyle: { color: '#f59e0b' },
        symbol: 'none',
      },
      {
        name: 'MA200',
        type: 'line',
        data: ma200,
        lineStyle: { color: '#dc2626', width: 1.5, type: 'dashed' },
        itemStyle: { color: '#dc2626' },
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
