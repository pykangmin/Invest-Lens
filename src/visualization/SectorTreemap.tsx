import ReactECharts from 'echarts-for-react';

const sectorData = [
  {
    name: 'Tech',
    children: [
      { name: 'AAPL', value: 320, ytd: 18.4 },
      { name: 'MSFT', value: 290, ytd: 14.2 },
      { name: 'GOOGL', value: 210, ytd: 22.6 },
      { name: 'NVDA', value: 260, ytd: 41.3 },
      { name: 'META', value: 160, ytd: 9.8 },
    ],
  },
  {
    name: 'Healthcare',
    children: [
      { name: 'JNJ', value: 130, ytd: -2.1 },
      { name: 'UNH', value: 140, ytd: 5.4 },
      { name: 'LLY', value: 180, ytd: 27.9 },
      { name: 'PFE', value: 90, ytd: -8.7 },
    ],
  },
  {
    name: 'Financials',
    children: [
      { name: 'JPM', value: 150, ytd: 12.3 },
      { name: 'BAC', value: 110, ytd: 4.8 },
      { name: 'V', value: 140, ytd: 8.1 },
      { name: 'MA', value: 120, ytd: 10.5 },
    ],
  },
  {
    name: 'Energy',
    children: [
      { name: 'XOM', value: 140, ytd: -4.6 },
      { name: 'CVX', value: 110, ytd: -6.2 },
      { name: 'SLB', value: 70, ytd: 3.1 },
    ],
  },
  {
    name: 'Consumer',
    children: [
      { name: 'AMZN', value: 240, ytd: 16.7 },
      { name: 'TSLA', value: 180, ytd: -12.4 },
      { name: 'HD', value: 90, ytd: 6.3 },
      { name: 'NKE', value: 70, ytd: -3.8 },
    ],
  },
  {
    name: 'Industrials',
    children: [
      { name: 'CAT', value: 80, ytd: 7.4 },
      { name: 'BA', value: 90, ytd: -5.1 },
      { name: 'UPS', value: 70, ytd: 2.8 },
    ],
  },
];

function colorForYtd(ytd: number): string {
  const clamped = Math.max(-30, Math.min(30, ytd));
  if (clamped >= 0) {
    const intensity = clamped / 30;
    const r = Math.round(220 - intensity * 180);
    const g = Math.round(252 - intensity * 50);
    const b = Math.round(231 - intensity * 90);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const intensity = -clamped / 30;
    const r = Math.round(254 - intensity * 10);
    const g = Math.round(226 - intensity * 130);
    const b = Math.round(226 - intensity * 130);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

function toTreemapData(sectors: typeof sectorData) {
  return sectors.map((sector) => ({
    name: sector.name,
    value: sector.children.reduce((sum, c) => sum + c.value, 0),
    children: sector.children.map((item) => ({
      name: `${item.name}\n${item.ytd >= 0 ? '+' : ''}${item.ytd.toFixed(1)}%`,
      value: item.value,
      itemStyle: { color: colorForYtd(item.ytd) },
    })),
  }));
}

export function SectorTreemap() {
  const option = {
    series: [
      {
        type: 'treemap',
        data: toTreemapData(sectorData),
        roam: false,
        breadcrumb: { show: false },
        label: {
          show: true,
          formatter: '{b}',
          fontSize: 12,
          color: '#1f2937',
        },
        upperLabel: {
          show: true,
          height: 22,
          color: '#374151',
          fontWeight: 'bold',
          fontSize: 13,
        },
        levels: [
          {
            itemStyle: {
              borderColor: '#ffffff',
              borderWidth: 2,
              gapWidth: 2,
            },
          },
          {
            itemStyle: {
              borderColor: '#e5e7eb',
              borderWidth: 1,
              gapWidth: 1,
            },
            upperLabel: { show: true, height: 22 },
          },
        ],
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
