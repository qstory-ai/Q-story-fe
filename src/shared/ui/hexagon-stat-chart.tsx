import { storybookTheme } from './theme';

export type HexagonStatChartDatum = { label: string; value: number };

type HexagonStatChartProps = {
  /** 정확히 6개를 기대하지만, 축이 N개인 다각형으로도 그대로 동작한다. */
  data: readonly HexagonStatChartDatum[];
  size?: number;
};

const GRID_STEPS = [0.25, 0.5, 0.75, 1];

function pointAt(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function angleFor(index: number, count: number) {
  // 12시 방향에서 시작해 시계 방향으로 배치.
  return (Math.PI * 2 * index) / count - Math.PI / 2;
}

function polygonPoints(cx: number, cy: number, radius: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const { x, y } = pointAt(cx, cy, radius, angleFor(i, count));
    return `${x},${y}`;
  }).join(' ');
}

/**
 * 종합 리포트 상단의 육각형 스탯 - Figma 목업 없이 웹 전용 앱이라 react-native-svg 없이 순수
 * <svg>로 그린다(icon.tsx가 lucide-react svg를 RN View 자식으로 그대로 렌더링하는 것과 같은
 * 이유). value는 0~100 - HexStat 정규화 규칙은 comprehensive-report.ts 참고.
 */
export function HexagonStatChart({ data, size = 300 }: HexagonStatChartProps) {
  const count = data.length;
  const center = size / 2;
  // 라벨이 두 줄로 접힐 공간까지 포함한 여백 - 좁으면 좌우 축 라벨이 뷰박스 밖으로 잘린다.
  const labelBand = size * 0.29;
  const radius = center - labelBand;

  const valuePoints = data
    .map((d, i) => pointAt(center, center, (radius * Math.max(0, Math.min(100, d.value))) / 100, angleFor(i, count)))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  const summary = data.map((d) => `${d.label} ${Math.round(d.value)}점`).join(', ');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`종합 스탯 육각형: ${summary}`}
    >
      {/* 배경 그리드 - 25/50/75/100% 링 + 축 스포크, 모두 hairline. */}
      {GRID_STEPS.map((step) => (
        <polygon
          key={step}
          points={polygonPoints(center, center, radius * step, count)}
          fill="none"
          stroke={storybookTheme.color.lightCardBorder}
          strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const outer = pointAt(center, center, radius, angleFor(i, count));
        return (
          <line
            key={d.label}
            x1={center}
            y1={center}
            x2={outer.x}
            y2={outer.y}
            stroke={storybookTheme.color.lightCardBorder}
            strokeWidth={1}
          />
        );
      })}

      {/* 데이터 다각형 - 골드 10~20% 워시 + 2px 스트로크, 지침의 area-fill 스펙. */}
      <polygon
        points={valuePoints}
        fill={storybookTheme.color.gold}
        fillOpacity={0.18}
        stroke={storybookTheme.color.gold}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {data.map((d, i) => {
        const p = pointAt(center, center, (radius * Math.max(0, Math.min(100, d.value))) / 100, angleFor(i, count));
        return (
          <circle
            key={d.label}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={storybookTheme.color.gold}
            stroke={storybookTheme.color.surfaceCard}
            strokeWidth={2}
          >
            <title>{`${d.label}: ${Math.round(d.value)}점`}</title>
          </circle>
        );
      })}

      {/* 축 라벨 - 단어 단위 + 값을 별도 줄로 접어, hover 없이도 값이 그대로 읽히면서 뷰박스
          밖으로는 잘리지 않게 한다(가로로 길게 한 줄로 쓰면 좌우 축에서 넘친다). */}
      {data.map((d, i) => {
        const angle = angleFor(i, count);
        const labelPoint = pointAt(center, center, radius + 16, angle);
        const cos = Math.cos(angle);
        const anchor = cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle';
        const lines = [...d.label.split(' '), `${Math.round(d.value)}점`];
        return (
          <text key={d.label} textAnchor={anchor} fontSize={storybookTheme.type.xs} fill={storybookTheme.color.onCardBody}>
            {lines.map((line, li) => (
              <tspan
                key={line}
                x={labelPoint.x}
                y={labelPoint.y}
                dy={(li - (lines.length - 1) / 2) * 14}
                fontWeight={
                  li === lines.length - 1 ? storybookTheme.type.weight.bold : storybookTheme.type.weight.semibold
                }
                fill={li === lines.length - 1 ? storybookTheme.color.onCardTitle : storybookTheme.color.onCardBody}
              >
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}
