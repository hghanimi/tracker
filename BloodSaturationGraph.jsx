/**
 * BloodSaturationGraph.jsx
 *
 * Interactive pharmacokinetic blood concentration graph.
 * Models Test Cypionate, Masteron Enanthate, and Winstrol (oral)
 * simultaneously using first-order exponential decay accumulation.
 *
 * Usage (React + Recharts project):
 *   import BloodSaturationGraph from './BloodSaturationGraph';
 *   <BloodSaturationGraph />
 *
 * Or open blood-graph.html directly (CDN version, no build step needed).
 *
 * NOT MEDICAL ADVICE — educational/tracking approximation only.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';

// ─── CONFIG ─────────────────────────────────────────────────────

const CYCLE_START = new Date('2026-03-30T00:00:00');
const CYCLE_WEEKS = 12;
const WINNY_DAYS  = 28;   // Mar 30 → Apr 27 (4 weeks)
const GRAPH_DAYS  = 111;  // display window: Mar 30 → Jul 19
const STEP_H      = 6;    // calculation interval in hours
const MS_H        = 3_600_000;

const CLR = {
  test   : '#3b82f6',
  mast   : '#f5a623',
  winny  : '#ef4444',
  today  : '#22c55e',
  bg     : '#0a0a0a',
  panel  : '#111111',
  panel2 : '#181818',
  border : '#1c1c1c',
  border2: '#282828',
  muted  : '#6b7280',
  muted2 : '#9ca3af',
  text   : '#f3f3f3',
};

// ─── PHARMACOKINETICS ────────────────────────────────────────────

/** Mon + Thu injection schedule (hours from cycle start). March 30 = Monday. */
function buildInjectionHours(weeks) {
  const h = [];
  for (let w = 0; w < weeks; w++) {
    h.push(w * 7 * 24);          // Monday
    h.push((w * 7 + 3) * 24);   // Thursday
  }
  return h;
}

/** Winstrol oral: 3 fixed doses per day for WINNY_DAYS. */
function buildWinstrolDoses(days) {
  const d = [];
  for (let day = 0; day < days; day++) {
    d.push({ h: day * 24 + 7.5,  mg: 20 }); // 07:30
    d.push({ h: day * 24 + 16,   mg: 20 }); // 16:00
    d.push({ h: day * 24 + 20,   mg: 10 }); // 20:00
  }
  return d;
}

/**
 * Injectable ester concentration at time t (h from cycle start).
 *
 * Ester absorption model:
 *   [0, tLag]   → 0 (ester lag before any release)
 *   [tLag, tPeak] → linear ramp 0→Dose (trapezoid absorption)
 *   [tPeak, ∞]  → Dose × e^(−0.693 × (t−tPeak) / t½)
 *
 * Accumulates contributions from ALL past injections.
 */
function calcInj(t, injHours, dose, hlH, tLag = 36, tPeak = 84) {
  const k = 0.693147 / hlH;
  let sum = 0;
  for (const inj of injHours) {
    const dt = t - inj;
    if (dt <= tLag) continue;
    sum += dt < tPeak
      ? dose * (dt - tLag) / (tPeak - tLag)
      : dose * Math.exp(-k * (dt - tPeak));
  }
  return sum;
}

/**
 * Winstrol oral concentration at time t.
 * Immediate absorption, 17% oral bioavailability, 9 h half-life.
 * C(t) = Dose × 0.17 × e^(−0.693 × Δt / 9)
 */
function calcWin(t, doses) {
  const k = 0.693147 / 9;
  let sum = 0;
  for (const { h, mg } of doses) {
    const dt = t - h;
    if (dt <= 0) continue;
    sum += mg * 0.17 * Math.exp(-k * dt);
  }
  return sum;
}

// ─── DATA GENERATION ─────────────────────────────────────────────

function buildData() {
  const injH    = buildInjectionHours(CYCLE_WEEKS);
  const winD    = buildWinstrolDoses(WINNY_DAYS);
  const testHLH = 8  * 24; // Testosterone Cypionate: 8-day half-life
  const mastHLH = 10 * 24; // Masteron Enanthate: 10-day half-life
  const totalH  = GRAPH_DAYS * 24;
  const winEndH = WINNY_DAYS * 24;

  // Pass 1: compute raw mg concentrations and track maxima for normalisation
  let maxT = 1e-9, maxM = 1e-9, maxW = 1e-9;
  const raw = [];

  for (let h = 0; h <= totalH; h += STEP_H) {
    const t = calcInj(h, injH, 300, testHLH); // Test Cyp 300mg
    const m = calcInj(h, injH, 250, mastHLH); // Mast E 250mg
    const w = calcWin(h, winD);
    if (t > maxT) maxT = t;
    if (m > maxM) maxM = m;
    if (w > maxW) maxW = w;
    raw.push({ h, t, m, w });
  }

  // Pass 2: normalise to saturation % (cycle peak = 100%)
  const data = raw.map(({ h, t, m, w }) => {
    const testPct = +(t / maxT * 100).toFixed(2);
    const mastPct = +(m / maxM * 100).toFixed(2);
    const wRaw    = +(w / maxW * 100).toFixed(3);
    // Null out Winstrol line once effectively cleared (< 0.05% after dosing ends)
    const winPct  = (h > winEndH + STEP_H * 3 && wRaw < 0.05) ? null : wRaw;

    return {
      h,
      testPct,
      mastPct,
      winPct,
      testMg : +t.toFixed(1),
      mastMg : +m.toFixed(1),
      winMg  : +w.toFixed(3),
    };
  });

  return { data, maxT, maxM, maxW, injH };
}

// ─── HELPERS ─────────────────────────────────────────────────────

const hToDate  = (h) => new Date(CYCLE_START.getTime() + h * MS_H);
const fmtShort = (h) => hToDate(h).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtFull  = (h) => hToDate(h).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── SUB-COMPONENTS ───────────────────────────────────────────────

const XTick = ({ x, y, payload }) => {
  const h    = payload.value;
  const d    = hToDate(h);
  const week = Math.floor(h / (7 * 24)) + 1;
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={13} textAnchor="middle" fill="#484848" fontSize={9} fontFamily="Space Mono, monospace">
        {d.getMonth() + 1}/{d.getDate()}
      </text>
      {week <= CYCLE_WEEKS && (
        <text dy={24} textAnchor="middle" fill="#323232" fontSize={8} fontFamily="Space Mono, monospace">
          W{week}
        </text>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload, label, vis }) => {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;
  const day  = Math.floor(label / 24) + 1;
  const week = Math.ceil(day / 7);

  const row = (color, name, pct, mg, dec = 0) => (
    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 3 }}>
      <span style={{ color, fontSize: 11 }}>{name}</span>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11 }}>
        <b style={{ color }}>{pct != null ? pct.toFixed(1) + '%' : '—'}</b>
        {mg != null && <span style={{ color: '#444', marginLeft: 7 }}>{mg.toFixed(dec)} mg</span>}
      </span>
    </div>
  );

  return (
    <div style={{
      background: '#141414', border: `1px solid ${CLR.border2}`,
      borderRadius: 9, padding: '10px 14px', minWidth: 230,
      fontFamily: 'Barlow, system-ui', boxShadow: '0 8px 32px rgba(0,0,0,.7)',
    }}>
      <div style={{ color: CLR.muted2, fontSize: 10, marginBottom: 8 }}>
        {fmtFull(label)}
        <b style={{ color: CLR.text, marginLeft: 8 }}>Week {week}</b>
        <span style={{ color: CLR.muted, marginLeft: 6 }}>· Day {day}</span>
      </div>
      {vis.test  && row(CLR.test,  'Test Cyp', pt.testPct, pt.testMg, 0)}
      {vis.mast  && row(CLR.mast,  'Mast E',   pt.mastPct, pt.mastMg, 0)}
      {vis.winny && row(CLR.winny, 'Winstrol', pt.winPct,  pt.winMg,  2)}
    </div>
  );
};

const StatBadge = ({ label, value, sub, color = CLR.text }) => (
  <div style={{
    background: CLR.panel2, border: `1px solid ${CLR.border}`,
    borderRadius: 10, padding: '10px 14px', flex: '1 1 130px', minWidth: 110,
  }}>
    <div style={{
      color: CLR.muted, fontSize: 9, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
    }}>{label}</div>
    <div style={{ color, fontFamily: 'Space Mono, monospace', fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>
      {value}
    </div>
    {sub && <div style={{ color: CLR.muted, fontSize: 9, marginTop: 3 }}>{sub}</div>}
  </div>
);

const SummaryCard = ({ todayData, cycleDay, todayH, ssDays, winClearDays }) => (
  <div style={{
    background: CLR.panel, border: `1px solid ${CLR.border}`,
    borderRadius: 14, padding: 14, marginBottom: 14,
  }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <StatBadge label={`Cycle Day ${cycleDay}`} value={fmtFull(Math.max(0, todayH))} color={CLR.muted2} />
      <StatBadge label="Test Cyp" value={`${todayData.testPct.toFixed(1)}%`} sub={`~${todayData.testMg.toFixed(0)} mg in blood`} color={CLR.test} />
      <StatBadge label="Mast E"   value={`${todayData.mastPct.toFixed(1)}%`} sub={`~${todayData.mastMg.toFixed(0)} mg in blood`} color={CLR.mast} />
      <StatBadge
        label="Winstrol"
        value={todayData.winPct != null ? `${todayData.winPct.toFixed(1)}%` : '—'}
        sub={`${todayData.winMg.toFixed(2)} mg systemic`}
        color={CLR.winny}
      />
      <StatBadge
        label="Steady State In"
        value={ssDays != null && ssDays > 0 ? `${ssDays}d` : 'Reached'}
        sub="Test+Mast ≥ 95%"
        color={ssDays != null && ssDays > 0 ? CLR.muted2 : CLR.today}
      />
      <StatBadge
        label="Winstrol Clears"
        value={winClearDays > 0 ? `${winClearDays}d` : 'Cleared'}
        sub="10× t½ after last dose"
        color={winClearDays > 0 ? CLR.winny : CLR.today}
      />
    </div>
  </div>
);

const ToggleBar = ({ vis, setVis }) => {
  const toggle = (k) => setVis(v => ({ ...v, [k]: !v[k] }));
  const all    = Object.values(vis).every(Boolean);

  const chip = (k, label, color) => (
    <button
      key={k} onClick={() => toggle(k)}
      style={{
        background: vis[k] ? `${color}18` : 'transparent',
        border: `1px solid ${vis[k] ? color : CLR.border2}`,
        color: vis[k] ? color : CLR.muted,
        borderRadius: 20, padding: '5px 14px', fontSize: 12,
        fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
        fontFamily: 'Barlow, system-ui', display: 'flex', alignItems: 'center', gap: 7,
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: vis[k] ? color : CLR.border2,
        flexShrink: 0, transition: 'background .15s', display: 'inline-block',
      }} />
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
      <button
        onClick={() => setVis({ test: !all, mast: !all, winny: !all })}
        style={{
          background: 'transparent', border: `1px solid ${CLR.border2}`,
          color: CLR.muted, borderRadius: 20, padding: '5px 13px',
          fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, system-ui',
        }}
      >{all ? 'Hide all' : 'Show all'}</button>
      {chip('test',  'Test Cyp', CLR.test)}
      {chip('mast',  'Mast E',   CLR.mast)}
      {chip('winny', 'Winstrol', CLR.winny)}
    </div>
  );
};

const PhaseLabel = ({ viewBox, text, color }) => {
  if (!viewBox) return null;
  const { x, y, width } = viewBox;
  return (
    <text x={x + width / 2} y={y + 18} textAnchor="middle"
      fill={color} fontSize={9} fontFamily="Barlow, system-ui"
      fontWeight={700} opacity={0.5} pointerEvents="none" letterSpacing="0.07em">
      {text}
    </text>
  );
};

const ChartLegend = ({ todayData, vis }) => {
  const item = (color, name, pct, sub) => (
    <div key={name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 20, height: 2, background: color, borderRadius: 1, marginTop: 6, flexShrink: 0 }} />
      <div>
        <div style={{ color: CLR.muted, fontSize: 9 }}>{name}</div>
        <div style={{ color, fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700 }}>
          {pct != null ? pct.toFixed(1) + '%' : '—'}
        </div>
        {sub && <div style={{ color: CLR.muted, fontSize: 9 }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div style={{
      position: 'absolute', top: 12, right: 68,
      background: 'rgba(10,10,10,.9)', border: `1px solid ${CLR.border2}`,
      borderRadius: 8, padding: '10px 12px',
      backdropFilter: 'blur(8px)', zIndex: 10, pointerEvents: 'none',
    }}>
      <div style={{
        color: CLR.muted, fontSize: 8, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8, fontFamily: 'Space Mono, monospace',
      }}>TODAY</div>
      {vis.test  && item(CLR.test,  'Test Cyp', todayData.testPct, `${todayData.testMg.toFixed(0)} mg`)}
      {vis.mast  && item(CLR.mast,  'Mast E',   todayData.mastPct, `${todayData.mastMg.toFixed(0)} mg`)}
      {vis.winny && item(CLR.winny, 'Winstrol', todayData.winPct,  `${todayData.winMg.toFixed(2)} mg`)}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────

export default function BloodSaturationGraph() {
  const [vis,    setVis]    = useState({ test: true, mast: true, winny: true });
  const [chartH, setChartH] = useState(440);

  useEffect(() => {
    const update = () => setChartH(window.innerWidth < 480 ? 290 : 440);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { data, maxT, maxM, maxW, injH } = useMemo(buildData, []);

  const today    = new Date();
  const todayH   = (today - CYCLE_START) / MS_H;
  const cycleDay = Math.max(1, Math.floor(todayH / 24) + 1);
  const todayIdx = Math.max(0, Math.min(Math.round(todayH / STEP_H), data.length - 1));
  const todayData = data[todayIdx];

  const phase1H = WINNY_DAYS * 24;
  const phase2H = CYCLE_WEEKS * 7 * 24;
  const graphH  = GRAPH_DAYS  * 24;

  const ssDays = (() => {
    for (let i = todayIdx; i < data.length; i++) {
      if (data[i].testPct >= 95 && data[i].mastPct >= 95) {
        return Math.max(0, Math.ceil((data[i].h - todayH) / 24));
      }
    }
    return null;
  })();

  const WIN_LAST_H   = (WINNY_DAYS - 1) * 24 + 20;
  const WIN_CLEAR_H  = WIN_LAST_H + 90; // 10 × 9h half-lives
  const winClearDays = Math.max(0, Math.ceil((WIN_CLEAR_H - todayH) / 24));

  const xTicks = useMemo(() => {
    const t = [];
    for (let d = 0; d <= GRAPH_DAYS; d += 7) t.push(d * 24);
    return t;
  }, []);

  const injLines   = injH.filter(h => h <= phase2H);
  const rightFmt   = useCallback((pct) => Math.round(pct * maxT / 100), [maxT]);
  const tooltipEl  = useCallback((props) => <CustomTooltip {...props} vis={vis} />, [vis]);
  const todaySnapH = data[todayIdx]?.h ?? 0;

  return (
    <div style={{ background: CLR.bg, color: CLR.text, padding: 16, minHeight: '100vh', fontFamily: 'Barlow, system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontFamily: 'Barlow, system-ui', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em' }}>
            Blood Concentration Model
          </h1>
          <span style={{
            background: CLR.panel2, border: `1px solid ${CLR.border2}`,
            borderRadius: 6, padding: '2px 9px',
            color: CLR.muted, fontSize: 10, fontFamily: 'Space Mono, monospace',
          }}>Mar 30 – Jul 19, 2026</span>
        </div>
        <p style={{ color: CLR.muted, fontSize: 11, lineHeight: 1.5 }}>
          Estimated blood concentration model — <b style={{ color: CLR.muted2 }}>not medical advice.</b>{' '}
          Approximation only. Does not account for individual metabolic variation, bioavailability differences, or SHBG binding.
        </p>
      </div>

      <SummaryCard todayData={todayData} cycleDay={cycleDay} todayH={todayH} ssDays={ssDays} winClearDays={winClearDays} />
      <ToggleBar vis={vis} setVis={setVis} />

      {/* ── Chart ── */}
      <div style={{
        background: CLR.panel, border: `1px solid ${CLR.border}`,
        borderRadius: 14, padding: '8px 0 0', overflow: 'hidden', position: 'relative',
      }}>
        <ChartLegend todayData={todayData} vis={vis} />

        <ResponsiveContainer width="100%" height={chartH}>
          <ComposedChart data={data} margin={{ top: 10, right: 62, bottom: 40, left: 4 }}>

            <ReferenceArea x1={0} x2={phase1H} yAxisId="left"
              fill="rgba(250,204,21,0.055)"
              label={<PhaseLabel text="WINSTROL KICKSTART" color="#fbbf24" />}
            />
            <ReferenceArea x1={phase1H} x2={phase2H} yAxisId="left"
              fill="rgba(34,197,94,0.04)"
              label={<PhaseLabel text="TEST + MAST BASE" color="#22c55e" />}
            />

            <CartesianGrid stroke="#161616" strokeDasharray="1 5" vertical={false} />

            <XAxis dataKey="h" type="number" scale="linear"
              domain={[0, graphH]} ticks={xTicks} tick={<XTick />}
              tickLine={false} axisLine={{ stroke: CLR.border }} height={38}
            />

            <YAxis yAxisId="left" domain={[0, 100]}
              tickFormatter={v => v + '%'}
              tick={{ fill: CLR.muted, fontSize: 9, fontFamily: 'Space Mono, monospace' }}
              tickLine={false} axisLine={false} width={40}
              label={{ value: 'Saturation %', angle: -90, position: 'insideLeft', offset: 14, fill: CLR.muted, fontSize: 9, fontFamily: 'Space Mono, monospace' }}
            />

            <YAxis yAxisId="right" orientation="right" domain={[0, 100]}
              tickFormatter={rightFmt}
              tick={{ fill: CLR.test + 'aa', fontSize: 9, fontFamily: 'Space Mono, monospace' }}
              tickLine={false} axisLine={false} width={50}
              label={{ value: 'Est. mg in blood', angle: 90, position: 'insideRight', offset: 14, fill: CLR.test + '66', fontSize: 9, fontFamily: 'Space Mono, monospace' }}
            />

            <Tooltip content={tooltipEl} cursor={{ stroke: '#2a2a2a', strokeWidth: 1 }} />

            {injLines.map(h => (
              <ReferenceLine key={`inj-${h}`} x={h} yAxisId="left" stroke="#1e1e1e" strokeWidth={1} />
            ))}

            <ReferenceLine x={phase1H} yAxisId="left"
              stroke={CLR.winny} strokeDasharray="5 4" strokeWidth={1} strokeOpacity={0.65}
              label={{ value: 'WINNY ENDS', position: 'insideTopRight', fill: CLR.winny, fontSize: 8, fontFamily: 'Space Mono, monospace', opacity: 0.75 }}
            />

            {todayH >= 0 && todayH <= graphH && (
              <ReferenceLine x={todaySnapH} yAxisId="left"
                stroke={CLR.today} strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: 'TODAY', position: 'insideTopRight', fill: CLR.today, fontSize: 8, fontFamily: 'Space Mono, monospace' }}
              />
            )}

            {vis.test && (
              <Line yAxisId="left" type="monotone" dataKey="testPct"
                stroke={CLR.test} strokeWidth={2} dot={false}
                activeDot={{ r: 3, fill: CLR.test, strokeWidth: 0 }}
                connectNulls={false} isAnimationActive={false}
              />
            )}
            {vis.mast && (
              <Line yAxisId="left" type="monotone" dataKey="mastPct"
                stroke={CLR.mast} strokeWidth={2} dot={false}
                activeDot={{ r: 3, fill: CLR.mast, strokeWidth: 0 }}
                connectNulls={false} isAnimationActive={false}
              />
            )}
            {vis.winny && (
              <Line yAxisId="left" type="monotone" dataKey="winPct"
                stroke={CLR.winny} strokeWidth={2} dot={false}
                activeDot={{ r: 3, fill: CLR.winny, strokeWidth: 0 }}
                connectNulls={false} isAnimationActive={false}
              />
            )}

          </ComposedChart>
        </ResponsiveContainer>

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '1px 64px 8px 44px',
          color: CLR.muted, fontSize: 9, fontFamily: 'Space Mono, monospace', opacity: 0.6,
        }}>
          <span>← left axis: saturation %</span>
          <span style={{ color: CLR.test }}>est. mg in blood (Test Cyp ref) →</span>
        </div>
      </div>

      {/* ── Compound key ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16,
        marginTop: 12, padding: '10px 14px',
        background: CLR.panel, border: `1px solid ${CLR.border}`,
        borderRadius: 10, fontSize: 10,
        fontFamily: 'Space Mono, monospace', color: CLR.muted,
      }}>
        <span style={{ color: CLR.test }}>■ Test Cyp</span>
        <span>300 mg · Mon+Thu · 8d t½</span>
        <span style={{ color: CLR.mast }}>■ Mast E</span>
        <span>250 mg · Mon+Thu · 10d t½</span>
        <span style={{ color: CLR.winny }}>■ Winstrol</span>
        <span>50 mg/day oral · 17% bioavail · 9h t½ · 4 wks</span>
      </div>

      {/* ── Footer ── */}
      <div style={{
        marginTop: 10, color: '#262626', fontSize: 9,
        fontFamily: 'Space Mono, monospace', textAlign: 'center', lineHeight: 1.8,
      }}>
        C(t) = Dose × e^(−0.693×t/t½) · Ester lag 36h · Absorption peak 84h post-injection
        <br />
        Steady state ≈ 4–5 half-lives · 100% = peak cycle concentration · Not medical advice
      </div>

    </div>
  );
}
