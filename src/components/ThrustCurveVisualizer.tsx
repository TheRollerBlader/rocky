"use client";

import { useId, useMemo, useState } from "react";
import { parseEngFile, type MotorThrustCurve } from "../lib/physicsTypes";

const SAMPLE_ENG_CURVES: Record<string, string> = {
  "AeroTech F32-8W": [
    "; AeroTech F32W 24mm composite motor",
    "F32 24 124 4-6-8 0.036 0.078 AeroTech",
    "0.00 0.0",
    "0.05 38.4",
    "0.15 44.2",
    "0.40 37.5",
    "0.90 33.8",
    "1.40 30.1",
    "1.70 16.5",
    "1.85 0.0",
  ].join("\n"),
  "Cesaroni G54-RL": [
    "; Cesaroni Pro29 G54 Red Lightning",
    "G54 29 149 6-8-10 0.064 0.145 Cesaroni",
    "0.00 0.0",
    "0.04 68.0",
    "0.18 72.5",
    "0.60 61.2",
    "1.25 53.0",
    "1.75 46.8",
    "2.05 14.2",
    "2.18 0.0",
  ].join("\n"),
};

export interface ThrustCurveVisualizerProps {
  curve?: MotorThrustCurve;
  engContent?: string;
  className?: string;
}

function classifyImpulse(totalImpulseNs: number): string {
  if (totalImpulseNs <= 40) return "E";
  if (totalImpulseNs <= 80) return "F";
  if (totalImpulseNs <= 160) return "G";
  if (totalImpulseNs <= 320) return "H";
  return "I+";
}

export function ThrustCurveVisualizer({
  curve,
  engContent,
  className = "",
}: ThrustCurveVisualizerProps) {
  const uid = useId().replace(/:/g, "");
  const presetKeys = Object.keys(SAMPLE_ENG_CURVES);
  const [selectedPreset, setSelectedPreset] = useState<string>(presetKeys[0]);

  const activeCurve = useMemo(() => {
    if (curve) return curve;
    const raw = engContent ?? SAMPLE_ENG_CURVES[selectedPreset];
    return parseEngFile(raw);
  }, [curve, engContent, selectedPreset]);

  const width = 760;
  const height = 340;
  const pad = { left: 58, right: 24, top: 24, bottom: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxTime = Math.max(0.1, activeCurve.burnTimeSec);
  const maxThrust = Math.max(10, Math.ceil((activeCurve.peakThrustN * 1.15) / 10) * 10);

  const xAt = (t: number) => pad.left + (t / maxTime) * innerW;
  const yAt = (n: number) => pad.top + (1 - n / maxThrust) * innerH;

  const points = activeCurve.points.map((pt) => ({
    x: xAt(pt.timeSec),
    y: yAt(pt.thrustNewtons),
    raw: pt,
  }));

  const polyline = points
    .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${polyline} L ${points[points.length - 1].x.toFixed(2)} ${(pad.top + innerH).toFixed(2)} L ${points[0].x.toFixed(2)} ${(pad.top + innerH).toFixed(2)} Z`
      : "";

  const peakPoint = points.reduce(
    (best, cur) => (cur.raw.thrustNewtons > best.raw.thrustNewtons ? cur : best),
    points[0] ?? { x: pad.left, y: pad.top + innerH, raw: { timeSec: 0, thrustNewtons: 0 } },
  );

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxThrust * f));
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Number((maxTime * f).toFixed(2)));
  const impulseClass = classifyImpulse(activeCurve.totalImpulseNs);

  return (
    <figure className={`plot ${className}`}>
      <figcaption>
        <strong>
          {activeCurve.manufacturer} {activeCurve.motorName} ({impulseClass}-Class)
        </strong>
        <span>
          Total impulse {activeCurve.totalImpulseNs.toFixed(1)} N·s · Burn{" "}
          {activeCurve.burnTimeSec.toFixed(2)} s · Peak {activeCurve.peakThrustN.toFixed(1)} N
        </span>
      </figcaption>

      {!curve && !engContent ? (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Select motor preset">
          {presetKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedPreset(key)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedPreset === key
                  ? "border-[#0083E0] bg-[#0083E0]/15 text-[#7cc4ff]"
                  : "border-white/15 bg-white/5 text-white/70 hover:text-white"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Motor thrust curve for ${activeCurve.motorName}`}
      >
        <defs>
          <linearGradient id={`${uid}-thrust-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0083E0" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#0083E0" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="plot-rule"
              x1={pad.left}
              x2={pad.left + innerW}
              y1={yAt(tick)}
              y2={yAt(tick)}
            />
            <text className="plot-tick" x={pad.left - 10} y={yAt(tick) + 4} textAnchor="end">
              {tick} N
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <g key={tick}>
            <line
              className="plot-rule plot-rule-faint"
              x1={xAt(tick)}
              x2={xAt(tick)}
              y1={pad.top}
              y2={pad.top + innerH}
            />
            <text
              className="plot-tick"
              x={xAt(tick)}
              y={pad.top + innerH + 20}
              textAnchor="middle"
            >
              {tick.toFixed(2)}s
            </text>
          </g>
        ))}

        {activeCurve.avgThrustN > 0 ? (
          <g>
            <line
              className="plot-guide"
              x1={pad.left}
              x2={pad.left + innerW}
              y1={yAt(activeCurve.avgThrustN)}
              y2={yAt(activeCurve.avgThrustN)}
            />
            <text
              className="plot-band-label"
              x={pad.left + innerW - 6}
              y={yAt(activeCurve.avgThrustN) - 6}
              textAnchor="end"
            >
              Avg {activeCurve.avgThrustN.toFixed(1)} N
            </text>
          </g>
        ) : null}

        {areaPath ? <path d={areaPath} fill={`url(#${uid}-thrust-fill)`} /> : null}
        {polyline ? (
          <path d={polyline} fill="none" stroke="#4aa6f0" strokeWidth={2.5} />
        ) : null}

        {points.length > 0 ? (
          <g>
            <circle
              cx={peakPoint.x}
              cy={peakPoint.y}
              r={4.5}
              fill="#ffffff"
              stroke="#0083E0"
              strokeWidth={2}
            />
            <text
              className="plot-tick"
              x={Math.min(pad.left + innerW - 40, peakPoint.x + 8)}
              y={Math.max(pad.top + 12, peakPoint.y - 8)}
            >
              Peak {peakPoint.raw.thrustNewtons.toFixed(1)} N
            </text>
          </g>
        ) : null}
      </svg>
    </figure>
  );
}
