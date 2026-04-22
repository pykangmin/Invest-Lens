import ReactECharts from 'echarts-for-react';

type Props = {
  value: number;
  label: string;
  color: string;
};

export function FearGreedGauge({ value, label, color }: Props) {
  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        radius: '95%',
        center: ['50%', '75%'],
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [0.25, '#ef4444'],
              [0.5, '#f97316'],
              [0.75, '#eab308'],
              [1, '#22c55e'],
            ],
          },
        },
        pointer: {
          length: '55%',
          width: 4,
          itemStyle: { color: '#374151' },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 22,
          fontWeight: 'bold',
          offsetCenter: [0, '-15%'],
          formatter: `{value}`,
          color: color,
        },
        title: {
          show: true,
          offsetCenter: [0, '15%'],
          fontSize: 11,
          color: color,
          fontWeight: 'bold',
        },
        data: [{ value, name: label }],
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 120, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  );
}
