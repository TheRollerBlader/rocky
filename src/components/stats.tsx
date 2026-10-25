"use client";

import { useEffect, useId, useRef } from "react";

const WINDS = [0, 5, 10, 15, 20];

const TEMPS = [
  { id: "40", label: "40 °F", color: "rgba(186, 214, 236, 0.72)" },
  { id: "50", label: "50 °F", color: "rgba(126, 186, 224, 0.85)" },
  { id: "60", label: "60 °F", color: "#4aa6f0", emphasis: true },
  { id: "70", label: "70 °F", color: "#0083E0" },
  { id: "80", label: "80 °F", color: "rgba(92, 124, 214, 0.9)" },
  { id: "90", label: "90 °F", color: "rgba(176, 184, 198, 0.7)" },
] as const;

const BALLAST: Record<string, number[]> = {
  "40": [64.5, 62, 57, 49.5, 41],
  "50": [66.5, 64, 59, 52.5, 43.5],
  "60": [68.5, 66.5, 61, 53.5, 46],
  "70": [70.5, 68.5, 63, 55.5, 46.5],
  "80": [72.5, 70.5, 65, 57, 48.5],
  "90": [74.5, 72.5, 67, 59.5, 52.5],
};

const TIME: Record<string, number[]> = {
  "40": [39.51, 39.74, 39.64, 39.71, 40.1],
  "50": [39.18, 39.41, 39.28, 39.28, 39.54],
  "60": [38.85, 39.0, 38.95, 39.0, 39.26],
  "70": [38.52, 38.69, 38.63, 38.8, 39.11],
  "80": [38.19, 38.37, 38.31, 38.58, 38.94],
  "90": [37.86, 38.04, 38.0, 38.1, 38.39],
};

const RAIL: Record<string, number[]> = {
  "40": [68.0, 68.3, 68.9, 70.0, 71.3],
  "50": [67.7, 68.0, 68.7, 69.6, 70.9],
  "60": [67.4, 67.7, 68.4, 69.4, 70.5],
  "70": [67.1, 67.4, 68.1, 69.2, 70.5],
  "80": [66.8, 67.1, 67.9, 69.0, 70.2],
  "90": [66.6, 66.8, 67.6, 68.6, 69.6],
};

const STABILITY = [2.06, 1.65, 1.37, 1.17, 1.04];
const DRIFT = [9, 153, 295, 463, 650];

type Series = {
  id: string;
  label: string;
  color: string;
  values: number[];
  emphasis?: boolean;
};

type ChartProps = {
  title: string;
  caption: string;
  series: Series[];
  min: number;
  max: number;
  ticks: number[];
  format: (value: number) => string;
  band?: [number, number];
  bandLabel?: string;
  guide?: { value: number; label: string };
  wide?: boolean;
  labelPoints?: boolean;
};

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const commands = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    commands.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    );
  }
  return commands.join(" ");
}

function Chart({
  title,
  caption,
  series,
  min,
  max,
  ticks,
  format,
  band,
  bandLabel,
  guide,
  wide,
  labelPoints = true,
}: ChartProps) {
  const uid = useId().replace(/:/g, "");
  const width = 760;
  const height = 380;
  const pad = { left: 58, right: 22, top: 22, bottom: 46 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xAt = (index: number) => pad.left + (index / (WINDS.length - 1)) * innerW;
  const yAt = (value: number) => pad.top + (1 - (value - min) / (max - min)) * innerH;

  const drawn = series.map((line) => {
    const points = line.values.map((value, index) => ({ x: xAt(index), y: yAt(value) }));
    return { line, points, d: smoothPath(points) };
  });
  const featured = drawn.find((entry) => entry.line.emphasis) ?? drawn[0];
  const area = featured
    ? `${featured.d} L ${featured.points[featured.points.length - 1].x.toFixed(2)} ${(pad.top + innerH).toFixed(2)} L ${featured.points[0].x.toFixed(2)} ${(pad.top + innerH).toFixed(2)} Z`
    : "";

  return (
    <figure className={wide ? "plot plot-wide" : "plot"}>
      <figcaption>
        <strong>{title}</strong>
        <span>{caption}</span>
      </figcaption>
      <ul className="plot-legend">
        {series.map((line) => (
          <li key={line.id}>
            <i style={{ background: line.color }} />
            {line.label}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0083E0" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0083E0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line className="plot-rule" x1={pad.left} x2={pad.left + innerW} y1={yAt(tick)} y2={yAt(tick)} />
            <text className="plot-tick" x={pad.left - 10} y={yAt(tick) + 4} textAnchor="end">
              {format(tick)}
            </text>
          </g>
        ))}
        {WINDS.map((wind, index) => (
          <line
            key={wind}
            className="plot-rule plot-rule-faint"
            x1={xAt(index)}
            x2={xAt(index)}
            y1={pad.top}
            y2={pad.top + innerH}
          />
        ))}

        {band ? (
          <rect
            className="plot-band"
            x={pad.left}
            y={yAt(Math.min(max, band[1]))}
            width={innerW}
            height={Math.max(0, yAt(Math.max(min, band[0])) - yAt(Math.min(max, band[1])))}
          />
        ) : null}
        {band && bandLabel ? (
          <text className="plot-band-label" x={pad.left + 10} y={yAt(Math.min(max, band[1])) + 16}>
            {bandLabel}
          </text>
        ) : null}
        {guide ? (
          <g>
            <line
              className="plot-guide"
              x1={pad.left}
              x2={pad.left + innerW}
              y1={yAt(guide.value)}
              y2={yAt(guide.value)}
            />
            <text className="plot-band-label" x={pad.left + innerW - 8} y={yAt(guide.value) - 8} textAnchor="end">
              {guide.label}
            </text>
          </g>
        ) : null}

        {area ? <path d={area} fill={`url(#${uid}-fill)`} className="plot-area" /> : null}
        {drawn.map(({ line, d, points }) => (
          <g key={line.id}>
            <path
              d={d}
              className={line.emphasis ? "series-line series-emphasis" : "series-line"}
              stroke={line.color}
              pathLength={1}
            />
            {points.map((point, index) => (
              <circle
                key={WINDS[index]}
                cx={point.x}
                cy={point.y}
                r={line.emphasis ? 4.2 : 2.4}
                className={line.emphasis ? "plot-dot" : "plot-dot plot-dot-quiet"}
                stroke={line.color}
              />
            ))}
          </g>
        ))}
        {labelPoints
          ? featured?.points.map((point, index) => {
              const first = index === 0;
              const last = index === featured.points.length - 1;
              return (
                <text
                  key={WINDS[index]}
                  className="plot-value"
                  x={first ? point.x + 12 : last ? point.x - 10 : point.x}
                  y={point.y - 12}
                  textAnchor={first ? "start" : last ? "end" : "middle"}
                >
                  {format(featured.line.values[index])}
                </text>
              );
            })
          : null}
        {WINDS.map((wind, index) => (
          <text key={wind} className="plot-axis" x={xAt(index)} y={height - 14} textAnchor="middle">
            {wind === 0 ? "Calm" : `${wind} mph`}
          </text>
        ))}
      </svg>
    </figure>
  );
}

const tempSeries = (table: Record<string, number[]>): Series[] =>
  TEMPS.map((temp) => ({
    id: temp.id,
    label: temp.label,
    color: temp.color,
    values: table[temp.id],
    emphasis: "emphasis" in temp ? temp.emphasis : false,
  }));

export function Stats() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const reveal = () => node.classList.add("is-in");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reveal();
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    const check = () => {
      if (node.getBoundingClientRect().top < window.innerHeight * 0.92) reveal();
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", check);
    };
  }, []);

  return (
    <section className="panel numbers" id="stats" ref={rootRef} aria-labelledby="stats-title">
      <p className="eyebrow">OpenRocket · 18.5 in chute · six-foot rod</p>
      <h2 id="stats-title">800 feet, in any wind.</h2>
      <p className="numbers-lead">
        Six temperatures, one wind axis. The bright line is a 60 °F launch day.
      </p>

      <div className="plot-grid">
        <Chart
          wide
          title="Ballast card"
          caption="Grams of clay. Warmer air wants more. Wind wants less."
          series={tempSeries(BALLAST)}
          min={36}
          max={80}
          ticks={[40, 50, 60, 70, 80]}
          format={(value) => value.toFixed(1)}
        />
        <Chart
          wide
          title="Flight time"
          caption="Seconds. Every scored day has to stay inside 37 to 40."
          series={tempSeries(TIME)}
          min={37}
          max={40.6}
          ticks={[37, 38, 39, 40]}
          format={(value) => value.toFixed(2)}
          band={[37, 40]}
          bandLabel="37–40 s"
        />
        <Chart
          title="Rail exit"
          caption="Feet per second. The ribbon is 40 °F through 90 °F."
          series={tempSeries(RAIL)}
          min={64}
          max={74}
          ticks={[66, 68, 70, 72]}
          format={(value) => value.toFixed(1)}
          labelPoints={false}
        />
        <Chart
          title="Off the rail, 60 °F"
          caption="Stability in calibers falls as the wind tilts the airflow."
          series={[
            {
              id: "stab",
              label: "Rail-exit stability",
              color: "#4aa6f0",
              values: STABILITY,
              emphasis: true,
            },
          ]}
          min={0.8}
          max={2.3}
          ticks={[1, 1.5, 2]}
          format={(value) => value.toFixed(2)}
          guide={{ value: 1.5, label: "1.5 cal" }}
        />
        <Chart
          wide
          title="Drift"
          caption="Feet downrange at 60 °F, from calm air out to a 20 mph limit."
          series={[
            {
              id: "drift",
              label: "Mean drift",
              color: "#0083E0",
              values: DRIFT,
              emphasis: true,
            },
          ]}
          min={0}
          max={720}
          ticks={[0, 150, 300, 450, 600]}
          format={(value) => String(Math.round(value))}
        />
      </div>
    </section>
  );
}
