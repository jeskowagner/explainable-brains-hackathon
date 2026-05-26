// Wireframes for the Explainable Brains patch-selection UI.
// Five "why this patch" surface treatments rendered side-by-side.

const wfInk = '#1f1d1a';
const wfPaper = '#fbfaf3';
const wfMuted = 'rgba(31,29,26,0.55)';
const wfFaint = 'rgba(31,29,26,0.22)';
const wfHighlight = '#ffe273';
const wfControl = '#3a78c2';
const wfSema = '#d9633f';
const wfReject = '#a52f1f';

// ---------- sketchy helpers ----------
function SketchBox({ children, style = {}, accent, dashed, tilt = 0, ...rest }) {
  // wobbly border-radius gives the hand-drawn box feel
  const radii = [
    '14px 5px 18px 8px / 8px 16px 6px 14px',
    '8px 14px 6px 18px / 16px 6px 14px 8px',
    '18px 8px 14px 5px / 6px 14px 8px 16px',
    '5px 18px 8px 14px / 14px 8px 16px 6px',
  ];
  // pick a stable radius per render (using children length as a weak hash)
  const idx = (String(children).length + (style.width || 0)) % radii.length;
  return (
    <div
      {...rest}
      style={{
        border: `1.6px ${dashed ? 'dashed' : 'solid'} ${accent || wfInk}`,
        borderRadius: radii[idx],
        background: 'transparent',
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Underline({ children, style = {} }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', ...style }}>
      {children}
      <svg
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: -4, width: '100%', height: 6 }}
      >
        <path d="M2 4 Q 25 1, 50 4 T 98 4" stroke={wfInk} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function ScribbleArrow({ from, to, color = wfInk, curve = 30, label, labelOffset = [0, -8] }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - curve;
  return (
    <g>
      <path
        d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      {/* arrowhead */}
      <path
        d={`M ${x2} ${y2} l -6 -2 m 6 2 l -4 5`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      {label && (
        <text
          x={mx + labelOffset[0]}
          y={my + labelOffset[1]}
          fontFamily="Caveat, cursive"
          fontSize="16"
          fill={color}
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// Deterministic scatter points — clustered, with some marked selected
const SCATTER_POINTS = (() => {
  // simple seeded rng
  let s = 9011;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const blobs = [
    { cx: 180, cy: 200, rx: 80, ry: 70, n: 40, cond: 'C' },
    { cx: 380, cy: 280, rx: 90, ry: 60, n: 55, cond: 'S' },
    { cx: 540, cy: 160, rx: 60, ry: 80, n: 35, cond: 'C' },
    { cx: 280, cy: 90, rx: 50, ry: 40, n: 22, cond: 'S' },
    { cx: 600, cy: 320, rx: 50, ry: 50, n: 20, cond: 'S' },
  ];
  const pts = [];
  blobs.forEach((b) => {
    for (let i = 0; i < b.n; i++) {
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r());
      pts.push({
        x: b.cx + Math.cos(a) * b.rx * rr + (r() - 0.5) * 12,
        y: b.cy + Math.sin(a) * b.ry * rr + (r() - 0.5) * 12,
        c: b.cond,
      });
    }
  });
  // mark some as selected (well-spread anchors)
  const targets = [
    [180, 200], [380, 280], [540, 160], [280, 90], [600, 320],
    [230, 250], [430, 240], [500, 230], [330, 160], [180, 140],
    [580, 280], [380, 330],
  ];
  targets.forEach(([tx, ty]) => {
    let best = -1, bd = Infinity;
    pts.forEach((p, i) => {
      const d = (p.x - tx) ** 2 + (p.y - ty) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) pts[best].sel = true;
  });
  return pts;
})();

function Scatter({ width = 720, height = 420, highlightId, accent }) {
  return (
    <svg
      viewBox={`0 0 720 420`}
      style={{ width, height, display: 'block' }}
    >
      {/* paper texture grid */}
      <defs>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke={wfFaint} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="720" height="420" fill="url(#grid)" />
      {/* axes */}
      <path d="M 30 380 L 700 380" stroke={wfInk} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M 30 380 L 30 20" stroke={wfInk} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <text x="700" y="400" fontFamily="Patrick Hand, cursive" fontSize="13" fill={wfMuted}>umap-1</text>
      <text x="10" y="20" fontFamily="Patrick Hand, cursive" fontSize="13" fill={wfMuted}>umap-2</text>
      {/* dots */}
      {SCATTER_POINTS.map((p, i) => {
        const fill = p.c === 'C' ? wfControl : wfSema;
        const sel = p.sel;
        return (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={sel ? 6 : 2.6}
              fill={sel ? (accent || wfInk) : fill}
              opacity={sel ? 1 : 0.55}
              stroke={sel ? wfInk : 'none'}
              strokeWidth={sel ? 1.2 : 0}
            />
            {sel && i === highlightId && (
              <circle cx={p.x} cy={p.y} r={12} fill="none" stroke={accent || wfInk} strokeWidth="1.4" strokeDasharray="3 3" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// histogram of deviation values, with threshold marker
function DeviationHist({ width = 420, height = 56, threshold = 0.42, accent }) {
  // deterministic bars
  const bars = [3, 6, 10, 14, 19, 24, 26, 22, 18, 14, 11, 8, 6, 4, 3, 2];
  const max = Math.max(...bars);
  // Internal coordinate space — keep numeric regardless of CSS width
  const VB_W = 420;
  const bw = VB_W / bars.length;
  const tx = threshold * VB_W;
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${height}`}
      preserveAspectRatio="none"
      style={{ width: typeof width === 'number' ? `${width}px` : width, height, display: 'block' }}
    >
      {bars.map((b, i) => {
        const h = (b / max) * (height - 14);
        const active = i * bw >= tx;
        return (
          <rect
            key={i}
            x={i * bw + 1}
            y={height - h - 2}
            width={bw - 2}
            height={h}
            fill={active ? (accent || wfInk) : wfFaint}
          />
        );
      })}
      {/* threshold marker */}
      <line x1={tx} x2={tx} y1={0} y2={height - 2} stroke={wfReject} strokeWidth="1.6" strokeDasharray="3 2" />
      <text x={tx + 4} y={12} fontFamily="Patrick Hand, cursive" fontSize="12" fill={wfReject}>
        ≥ {threshold.toFixed(2)}
      </text>
    </svg>
  );
}

// patch thumbnail — rendered as a sketch placeholder
function PatchThumb({ size = 90, label, condition = 'S', tone = 0.55, ringed }) {
  // generate "speckles" representing c-Fos signal
  let s = (label ? label.length : 7) * 11 + size;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const dots = Array.from({ length: 38 }, () => ({
    x: r() * size,
    y: r() * size,
    r: 0.8 + r() * 1.8,
    o: 0.35 + r() * 0.55,
  }));
  const color = condition === 'C' ? wfControl : wfSema;
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        background: '#0e0d0b',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: ringed ? `0 0 0 2px ${wfHighlight}, 0 0 0 3px ${wfInk}` : `0 0 0 1.4px ${wfInk}`,
        flexShrink: 0,
      }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%' }}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} opacity={d.o * tone * 1.6} />
        ))}
      </svg>
      {label && (
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            left: 4,
            color: '#fff',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 9,
            opacity: 0.85,
            letterSpacing: 0.4,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// quality bar
function QBar({ label, val, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Patrick Hand, cursive', fontSize: 14, color: wfInk }}>
      <span style={{ width: 88, color: wfMuted }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: wfFaint, borderRadius: 2, position: 'relative' }}>
        <div style={{ width: `${val * 100}%`, height: '100%', background: accent || wfInk, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: wfInk, width: 32, textAlign: 'right' }}>
        {val.toFixed(2)}
      </span>
    </div>
  );
}

// pill tag
function Tag({ children, color, filled }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        border: `1.3px solid ${color || wfInk}`,
        background: filled ? (color || wfInk) : 'transparent',
        color: filled ? wfPaper : (color || wfInk),
        borderRadius: 999,
        fontFamily: 'Patrick Hand, cursive',
        fontSize: 13,
        lineHeight: 1.4,
        marginRight: 6,
        marginBottom: 4,
      }}
    >
      {children}
    </span>
  );
}

// ============================================================
// SHELL — common to every variation
// ============================================================
function Shell({ children, activeTab = 'Embedding', accent, variant }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: wfPaper,
        color: wfInk,
        fontFamily: 'Patrick Hand, cursive',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 24px',
          borderBottom: `1.4px solid ${wfInk}`,
        }}
      >
        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
          explainable brains
        </div>
        <div style={{ width: 1, height: 22, background: wfFaint }} />
        <div style={{ fontSize: 14, color: wfMuted }}>patch selection workspace</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: wfMuted }}>variant</span>
          <SketchBox style={{ padding: '2px 10px', fontSize: 13 }} accent={accent}>
            {variant}
          </SketchBox>
        </div>
      </div>

      {/* tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 24px 0',
          gap: 28,
          borderBottom: `1px dashed ${wfFaint}`,
        }}
      >
        {['Embedding', 'Selection', 'Search', 'Coverage'].map((t) => {
          const on = t === activeTab;
          return (
            <div
              key={t}
              style={{
                padding: '6px 4px 10px',
                fontSize: 17,
                fontWeight: on ? 700 : 400,
                color: on ? wfInk : wfMuted,
                borderBottom: on ? `2.6px solid ${accent || wfInk}` : '2.6px solid transparent',
                marginBottom: -1,
              }}
            >
              {on ? <Underline>{t}</Underline> : t}
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: wfMuted, fontFamily: 'IBM Plex Mono, monospace' }}>
          7,512 patches · 12 brains · 6 control / 6 semaglutide
        </span>
      </div>

      {/* patch-count picker — front and centre */}
      <PatchCountPicker accent={accent} />

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

function PatchCountPicker({ accent, value = 50 }) {
  const options = [10, 25, 50, 100, 200];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '14px 24px',
        borderBottom: `1px dashed ${wfFaint}`,
        background: 'rgba(255,226,115,0.18)',
      }}
    >
      <div style={{ fontFamily: 'Caveat, cursive', fontSize: 22, lineHeight: 1, minWidth: 180 }}>
        how many patches?
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {options.map((n) => {
          const on = n === value;
          return (
            <div
              key={n}
              style={{
                padding: '8px 18px',
                fontFamily: 'Caveat, cursive',
                fontSize: 20,
                lineHeight: 1,
                border: `1.6px solid ${wfInk}`,
                background: on ? (accent || wfInk) : wfPaper,
                color: on ? wfPaper : wfInk,
                borderRadius: on ? '14px 5px 18px 8px / 8px 16px 6px 14px' : '8px 14px 6px 18px / 16px 6px 14px 8px',
                boxShadow: on ? `3px 3px 0 ${wfInk}` : 'none',
                cursor: 'pointer',
                minWidth: 64,
                textAlign: 'center',
              }}
            >
              top {n}
            </div>
          );
        })}
        <div
          style={{
            padding: '8px 14px',
            fontFamily: 'Patrick Hand, cursive',
            fontSize: 14,
            color: wfMuted,
            border: `1.4px dashed ${wfMuted}`,
            borderRadius: 8,
            marginLeft: 6,
          }}
        >
          custom…
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: wfMuted }}>
          showing
        </div>
        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 26, lineHeight: 1, color: accent || wfInk }}>
          {value} of 7,512
        </div>
      </div>
    </div>
  );
}

// reusable scatter pane (left side of embedding tab)
function ScatterPane({ accent, width, hint }) {
  return (
    <div style={{ padding: '18px 12px 12px 24px', display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <span style={{ fontFamily: 'Caveat, cursive', fontSize: 22 }}>UMAP projection</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: wfMuted }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: wfControl, display: 'inline-block' }} /> control
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: wfMuted }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: wfSema, display: 'inline-block' }} /> semaglutide
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: wfMuted }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: accent || wfInk, display: 'inline-block', border: `1.4px solid ${wfInk}` }} /> selected
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {['UMAP', 'PCA', 't-SNE'].map((m, i) => (
            <span key={m} style={{
              padding: '2px 8px', fontSize: 12, border: `1.2px solid ${wfMuted}`, borderRadius: 4,
              background: i === 0 ? wfInk : 'transparent', color: i === 0 ? wfPaper : wfMuted,
            }}>{m}</span>
          ))}
        </div>
      </div>
      <SketchBox style={{ padding: 0, overflow: 'hidden', flex: 1, background: '#fdfbf2' }}>
        <Scatter width="100%" height="100%" accent={accent} />
      </SketchBox>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, fontSize: 13, color: wfMuted }}>
        <span>distribution of patch deviation scores →</span>
        <div style={{ flex: 1 }}>
          <DeviationHist width="100%" height={42} threshold={0.42} accent={accent} />
        </div>
      </div>
      {hint && (
        <div style={{ position: 'absolute', bottom: 12, left: 24, fontFamily: 'Caveat, cursive', fontSize: 16, color: wfMuted }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ============================================================
// V0 — LEAD: grouping (12 grid) + single-patch detail + weights
// ============================================================
const FOCUSED_PATCH = {
  id: '#4218',
  brain: 'brain 07',
  scan: '260219_AN0B7_G002',
  condition: 'Semaglutide',
  z: 842, y: 1456, x: 1023,
  cluster: 7,
  deltaNearest: 0.12,
  tags: [
    { name: 'cluster anchor', sim: null, primary: true },
    { name: 'dense c-Fos signal', sim: 0.31 },
    { name: 'cell body cluster', sim: 0.22 },
  ],
  weights: [
    { label: 'nucleus score', val: 0.86 },
    { label: 'sharpness', val: 0.71 },
    { label: 'foreground', val: 0.62 },
    { label: 'SNR', val: 0.78 },
    { label: 'local contrast', val: 0.69 },
    { label: 'deviation', val: 0.74, special: true },
  ],
};

const SELECTION_12 = Array.from({ length: 12 }, (_, i) => ({
  id: `#${(4218 + i * 137) % 9999}`.padStart(5, '#'),
  c: [1, 4, 7, 9, 11].includes(i) ? 'C' : 'S',
  tone: 0.55 + ((i * 17) % 50) / 100,
  cluster: ((i * 3) % 11) + 1,
}));

function V0Combined({ accent }) {
  const FOCUS_INDEX = 3;
  return (
    <Shell variant="A+B · lead direction" accent={accent}>
      <ScatterPane accent={accent} />
      <div
        style={{
          width: 380,
          borderLeft: `1.4px solid ${wfInk}`,
          background: '#f6f3e8',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── grouping: thumbnails of all selected patches ── */}
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px dashed ${wfFaint}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: 'Caveat, cursive', fontSize: 22, lineHeight: 1 }}>
              the 50 picks
            </span>
            <span style={{ fontSize: 13, color: wfMuted }}>34 sema · 16 ctrl</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: wfMuted, fontFamily: 'IBM Plex Mono, monospace' }}>
              coverage 0.84
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {SELECTION_12.map((p, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <PatchThumb
                  size={72}
                  condition={p.c}
                  tone={p.tone}
                  ringed={i === FOCUS_INDEX}
                />
                <div style={{
                  position: 'absolute', top: 3, right: 4,
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#fff',
                  background: 'rgba(0,0,0,0.45)', padding: '0 4px', borderRadius: 2,
                }}>
                  c{p.cluster}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontSize: 12, color: wfMuted }}>+ 38 more · scroll →</span>
            <span style={{ fontSize: 12, color: wfMuted }}>click any → focus ↓</span>
          </div>
        </div>

        {/* ── focused-patch detail with weights ── */}
        <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <PatchThumb size={108} label={`${FOCUSED_PATCH.id} · z${FOCUSED_PATCH.z}`} condition="S" tone={0.85} ringed />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: 22, lineHeight: 1 }}>
                {FOCUSED_PATCH.id}
              </div>
              <div style={{ fontSize: 12, color: wfMuted, fontFamily: 'IBM Plex Mono, monospace', marginTop: 2 }}>
                {FOCUSED_PATCH.brain} · {FOCUSED_PATCH.condition.toLowerCase()}
              </div>
              <div style={{ fontSize: 11, color: wfMuted, fontFamily: 'IBM Plex Mono, monospace', marginTop: 2 }}>
                z {FOCUSED_PATCH.z} · y₀ {FOCUSED_PATCH.y} · x₀ {FOCUSED_PATCH.x}
              </div>
              <div style={{ marginTop: 8 }}>
                {FOCUSED_PATCH.tags.map((t, i) => (
                  <Tag key={i} color={t.primary ? accent : wfMuted} filled={t.primary}>
                    {t.name}{t.sim != null && <span style={{ opacity: 0.7, marginLeft: 4, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>{t.sim.toFixed(2)}</span>}
                  </Tag>
                ))}
              </div>
            </div>
          </div>

          {/* WEIGHTS — front and centre */}
          <div style={{
            background: wfPaper,
            border: `1.4px solid ${wfInk}`,
            borderRadius: '12px 4px 14px 6px / 6px 14px 4px 12px',
            padding: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Caveat, cursive', fontSize: 18, lineHeight: 1 }}>
                weights
              </span>
              <span style={{ marginLeft: 8, fontSize: 11, color: wfMuted }}>
                what makes this patch worth keeping
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {FOCUSED_PATCH.weights.map((w) => (
                <QBar key={w.label} label={w.label} val={w.val} accent={w.special ? wfReject : accent} />
              ))}
            </div>
          </div>

          {/* JUSTIFICATION */}
          <div>
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: 18, marginBottom: 4 }}>
              justification
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: wfInk }}>
              Densest member of cluster {FOCUSED_PATCH.cluster}. Removing it would leave its corner
              of the manifold the least-covered (Δ to nearest selected:{' '}
              <b>{FOCUSED_PATCH.deltaNearest.toFixed(2)}</b>).
            </div>
          </div>

          {/* ACTIONS */}
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <div style={{
              flex: 1, textAlign: 'center', padding: '8px 0',
              border: `1.6px solid ${wfReject}`, color: wfReject,
              borderRadius: '10px 4px 8px 6px / 6px 8px 4px 10px',
              fontSize: 14,
            }}>
              ✕ reject &amp; resample
            </div>
            <div style={{
              flex: 1, textAlign: 'center', padding: '8px 0',
              border: `1.6px solid ${wfInk}`, background: wfInk, color: wfPaper,
              borderRadius: '4px 10px 6px 8px / 8px 6px 10px 4px',
              fontSize: 14,
            }}>
              ★ pin this patch
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ============================================================
// V1 — Right rail (always-visible sidebar)
// ============================================================
function V1RightRail({ accent }) {
  return (
    <Shell variant="A · right rail" accent={accent}>
      <ScatterPane accent={accent} />
      <div
        style={{
          width: 340,
          borderLeft: `1.4px solid ${wfInk}`,
          padding: '18px 18px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          background: '#f6f3e8',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 24, lineHeight: 1 }}>
          why this patch?
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <PatchThumb size={100} label="#4218" condition="S" tone={0.8} ringed />
          <div style={{ flex: 1, fontSize: 13, color: wfInk, lineHeight: 1.5 }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: wfMuted, marginBottom: 2 }}>
              brain #07 · G002 · semaglutide
            </div>
            <div>z = 842 · y₀ 1456 · x₀ 1023</div>
            <div style={{ marginTop: 6 }}>
              <Tag color={accent} filled>cluster 7 anchor</Tag>
              <Tag color={wfMuted}>top: dense c-Fos</Tag>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: 18, marginBottom: 6 }}>quality</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <QBar label="nucleus score" val={0.86} accent={accent} />
            <QBar label="sharpness" val={0.71} accent={accent} />
            <QBar label="foreground" val={0.62} accent={accent} />
            <QBar label="SNR" val={0.78} accent={accent} />
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: 18, marginBottom: 6 }}>
            justification
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.45, color: wfInk }}>
            Anchor of cluster 7. Aligned with “dense c-Fos signal” (0.31).
            12% from nearest selected patch — high coverage contribution.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          <div style={{
            flex: 1, textAlign: 'center', padding: '8px 0',
            border: `1.6px solid ${wfReject}`, color: wfReject,
            borderRadius: '10px 4px 8px 6px / 6px 8px 4px 10px',
            fontSize: 14,
          }}>
            reject &amp; resample
          </div>
          <div style={{
            flex: 1, textAlign: 'center', padding: '8px 0',
            border: `1.6px solid ${wfInk}`, background: wfInk, color: wfPaper,
            borderRadius: '4px 10px 6px 8px / 8px 6px 10px 4px',
            fontSize: 14,
          }}>
            pin this patch
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ============================================================
// V2 — Anchored popover floating from the dot itself
// ============================================================
function V2Popover({ accent }) {
  return (
    <Shell variant="B · anchored popover" accent={accent}>
      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
        <ScatterPane accent={accent} hint="click any dot → bubble pops out" />
        {/* popover overlay positioned over the scatter */}
        <div
          style={{
            position: 'absolute',
            top: 110,
            left: 380,
            width: 320,
            zIndex: 4,
            pointerEvents: 'none',
          }}
        >
          {/* leader line from dot to popover */}
          <svg style={{ position: 'absolute', top: 70, left: -90, width: 120, height: 80, overflow: 'visible' }}>
            <ScribbleArrow from={[10, 70]} to={[100, 20]} color={accent || wfInk} curve={-20} />
          </svg>
          <SketchBox
            accent={accent}
            style={{
              background: wfPaper,
              padding: 14,
              boxShadow: `4px 4px 0 ${wfInk}`,
            }}
          >
            <div style={{ display: 'flex', gap: 12 }}>
              <PatchThumb size={88} label="#4218" condition="S" tone={0.85} ringed />
              <div style={{ flex: 1, fontSize: 13 }}>
                <div style={{ fontFamily: 'Caveat, cursive', fontSize: 18, lineHeight: 1 }}>
                  patch #4218
                </div>
                <div style={{ color: wfMuted, fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, marginTop: 2 }}>
                  brain 07 · semaglutide
                </div>
                <div style={{ marginTop: 8 }}>
                  <Tag color={accent} filled>anchor</Tag>
                  <Tag color={wfMuted}>dense c-Fos</Tag>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45, borderTop: `1px dashed ${wfFaint}`, paddingTop: 8 }}>
              Anchor of cluster 7. Nearest selected is 12% away.
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <span style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, border: `1.4px solid ${wfReject}`, color: wfReject, borderRadius: 4 }}>
                ✕ reject
              </span>
              <span style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, border: `1.4px solid ${wfInk}`, borderRadius: 4 }}>
                ⤢ open
              </span>
              <span style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, border: `1.4px solid ${wfInk}`, background: wfInk, color: wfPaper, borderRadius: 4 }}>
                ★ pin
              </span>
            </div>
          </SketchBox>
        </div>
        {/* slim right column with selection mini-grid */}
        <div
          style={{
            width: 156,
            borderLeft: `1.4px solid ${wfInk}`,
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: '#f6f3e8',
          }}
        >
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: 18, lineHeight: 1 }}>
            selection (12)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <PatchThumb
                key={i}
                size={56}
                condition={i % 3 === 0 ? 'C' : 'S'}
                tone={0.6 + (i % 4) * 0.1}
                ringed={i === 4}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: wfMuted, fontFamily: 'IBM Plex Mono, monospace', marginTop: 'auto' }}>
            coverage 0.84<br />
            held-out 0.12 max-min
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ============================================================
// V3 — Inline strip under the scatter
// ============================================================
function V3Inline({ accent }) {
  return (
    <Shell variant="C · inline filmstrip" accent={accent}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <ScatterPane accent={accent} />
        </div>
        {/* filmstrip */}
        <div
          style={{
            borderTop: `1.4px solid ${wfInk}`,
            background: '#f6f3e8',
            padding: '12px 24px',
            display: 'flex',
            gap: 12,
            alignItems: 'stretch',
            height: 196,
          }}
        >
          <div style={{ width: 130, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: 22, lineHeight: 1 }}>
                why these 12 →
              </div>
              <div style={{ fontSize: 12, color: wfMuted, marginTop: 4 }}>
                scroll horizontally · click any card to expand
              </div>
            </div>
            <div style={{ fontSize: 11, color: wfMuted, fontFamily: 'IBM Plex Mono, monospace' }}>
              ◀ 4 / 12 ▶
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 10, overflow: 'hidden' }}>
            {[
              { id: '#4218', tag: 'dense c-Fos', cluster: 7, dist: 0.12, q: 0.86, ringed: true, c: 'S' },
              { id: '#1903', tag: 'scattered', cluster: 3, dist: 0.18, q: 0.74, c: 'C' },
              { id: '#5520', tag: 'fiber tract', cluster: 1, dist: 0.21, q: 0.62, c: 'S' },
              { id: '#0712', tag: 'cell cluster', cluster: 4, dist: 0.16, q: 0.81, c: 'C' },
              { id: '#6044', tag: 'sparse activity', cluster: 9, dist: 0.24, q: 0.69, c: 'S' },
            ].map((p) => (
              <SketchBox
                key={p.id}
                accent={p.ringed ? accent : undefined}
                style={{
                  flex: '0 0 180px',
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  background: p.ringed ? '#fff' : wfPaper,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <PatchThumb size={56} condition={p.c} tone={0.8} ringed={p.ringed} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>
                      {p.id}
                    </div>
                    <div style={{ fontSize: 12, color: wfMuted, fontFamily: 'Patrick Hand, cursive' }}>
                      cluster {p.cluster}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.35, color: wfInk }}>
                  <Tag color={accent} filled>{p.tag}</Tag>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: wfMuted, fontFamily: 'IBM Plex Mono, monospace', marginTop: 'auto' }}>
                  <span>q {p.q.toFixed(2)}</span>
                  <span>Δ {p.dist.toFixed(2)}</span>
                  <span style={{ marginLeft: 'auto', color: wfReject }}>✕</span>
                </div>
              </SketchBox>
            ))}
            <div style={{
              flex: '0 0 100px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: wfMuted, fontFamily: 'Caveat, cursive', fontSize: 20,
              borderLeft: `1px dashed ${wfFaint}`,
            }}>
              + 7 more →
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ============================================================
// V4 — Bottom drawer (slides up on selection)
// ============================================================
function V4Drawer({ accent }) {
  return (
    <Shell variant="D · bottom drawer" accent={accent}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <ScatterPane accent={accent} hint="click a dot → drawer rises" />
        </div>
        <div
          style={{
            borderTop: `2px solid ${wfInk}`,
            background: wfPaper,
            boxShadow: `0 -6px 0 ${wfHighlight}`,
            padding: '12px 24px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            height: 268,
          }}
        >
          {/* drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: -4, marginBottom: 4 }}>
            <div style={{ width: 56, height: 5, background: wfMuted, borderRadius: 3, opacity: 0.5 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, borderBottom: `1px dashed ${wfFaint}`, paddingBottom: 6 }}>
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: 22, lineHeight: 1 }}>
              patch #4218
            </div>
            <div style={{ display: 'flex', gap: 18, fontSize: 14 }}>
              {['why', 'quality', 'position', 'brain context'].map((t, i) => (
                <span
                  key={t}
                  style={{
                    color: i === 0 ? wfInk : wfMuted,
                    fontWeight: i === 0 ? 700 : 400,
                    borderBottom: i === 0 ? `2px solid ${accent || wfInk}` : '2px solid transparent',
                    paddingBottom: 4,
                  }}
                >
                  {i === 0 ? <Underline>{t}</Underline> : t}
                </span>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 12 }}>
              <span style={{ padding: '4px 10px', border: `1.4px solid ${wfReject}`, color: wfReject, borderRadius: 4 }}>
                reject &amp; resample
              </span>
              <span style={{ padding: '4px 10px', border: `1.4px solid ${wfInk}`, background: wfInk, color: wfPaper, borderRadius: 4 }}>
                pin
              </span>
              <span style={{ padding: '4px 10px', border: `1.4px solid ${wfMuted}`, color: wfMuted, borderRadius: 4 }}>
                ⤢
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0 }}>
            <PatchThumb size={160} label="#4218 · z842" condition="S" tone={0.85} ringed />
            <div style={{ flex: 1, fontSize: 14, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <Tag color={accent} filled>cluster 7 anchor</Tag>
                <Tag color={wfMuted}>dense c-Fos (0.31)</Tag>
                <Tag color={wfMuted}>cell body cluster (0.22)</Tag>
              </div>
              <div style={{ color: wfInk }}>
                Picked because this point is the densest member of cluster 7 in PLIP space.
                Removing it would leave its neighbourhood the least-covered region of the
                semaglutide manifold (Δ to nearest selected: <b>0.12</b>).
              </div>
              <div style={{ fontSize: 12, color: wfMuted, fontFamily: 'IBM Plex Mono, monospace' }}>
                if rejected → next candidate: #4291 (Δ 0.14, q 0.82)
              </div>
            </div>
            <div style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: 16, color: wfMuted, marginBottom: 2 }}>
                quality
              </div>
              <QBar label="nucleus" val={0.86} accent={accent} />
              <QBar label="sharpness" val={0.71} accent={accent} />
              <QBar label="foreground" val={0.62} accent={accent} />
              <QBar label="SNR" val={0.78} accent={accent} />
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ============================================================
// V5 — Annotated callouts (hand-labeled selected dots)
// ============================================================
function V5Callouts({ accent }) {
  return (
    <Shell variant="E · annotated callouts" accent={accent}>
      <div style={{ flex: 1, display: 'flex', position: 'relative', minWidth: 0 }}>
        <div style={{ flex: 1, padding: '18px 12px 12px 24px', position: 'relative', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
            <span style={{ fontFamily: 'Caveat, cursive', fontSize: 22 }}>annotated UMAP</span>
            <span style={{ fontSize: 13, color: wfMuted }}>
              every selected dot is hand-labeled · hover to expand
            </span>
          </div>
          <SketchBox style={{ padding: 0, overflow: 'hidden', position: 'relative', height: 'calc(100% - 48px)', background: '#fdfbf2' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <Scatter width="100%" height="100%" accent={accent} />
              {/* hand-drawn callouts */}
              <svg
                viewBox="0 0 720 420"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              >
                <ScribbleArrow from={[180, 200]} to={[80, 110]} color={accent || wfInk} label="cluster 7 anchor" labelOffset={[0, -6]} />
                <ScribbleArrow from={[380, 280]} to={[280, 380]} color={wfInk} curve={-15} label="dense c-Fos" labelOffset={[0, 16]} />
                <ScribbleArrow from={[540, 160]} to={[680, 60]} color={wfInk} label="fiber tract" />
                <ScribbleArrow from={[280, 90]} to={[140, 40]} color={wfInk} curve={20} label="scattered" />
                <ScribbleArrow from={[600, 320]} to={[680, 390]} color={accent || wfInk} curve={20} label="hot spot" />
              </svg>
            </div>
          </SketchBox>
        </div>
        {/* right margin: focused callout for hover */}
        <div
          style={{
            width: 268,
            borderLeft: `1.4px solid ${wfInk}`,
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: '#f6f3e8',
          }}
        >
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: 20, lineHeight: 1 }}>
            hovered: cluster 7 anchor
          </div>
          <PatchThumb size={140} label="#4218 · z842" condition="S" tone={0.85} ringed />
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            Picked because it&apos;s the densest member of cluster 7 — removing it would leave
            this corner of the manifold the least-covered.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <QBar label="nucleus" val={0.86} accent={accent} />
            <QBar label="sharpness" val={0.71} accent={accent} />
            <QBar label="SNR" val={0.78} accent={accent} />
          </div>
          <div style={{ marginTop: 'auto', fontFamily: 'Caveat, cursive', fontSize: 16, color: wfMuted }}>
            ↑ all 12 picks have a tag.<br />
            print-friendly view too.
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ============================================================
// APP
// ============================================================
const ACCENTS = {
  rust: '#c5562d',
  forest: '#2f7a4f',
  cobalt: '#2a5fb8',
  ink: '#1f1d1a',
};

function App() {
  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "accent": "rust",
    "showSecondRow": true
  }/*EDITMODE-END*/);
  const accent = ACCENTS[t.accent] || ACCENTS.rust;

  return (
    <>
      <DesignCanvas>
        <DCSection
          id="lead"
          title="Patch selection workspace"
          subtitle="All 12 picks visible as a grouping, full detail and quality weights on whichever you focus."
        >
          <DCArtboard id="v0" label="grouping + detail + weights" width={1440} height={900}>
            <V0Combined accent={accent} />
          </DCArtboard>
        </DCSection>

        <DCPostIt top={40} left={40} rotate={-2} width={240}>
          Four tabs across the top — <b>Embedding · Selection · Search · Coverage</b>.
          Picker controls <i>how many patches</i> to surface (Top 10 / 25 / 50 / 100 / 200).
          Click any thumbnail in the right rail to inspect its weights below.
        </DCPostIt>
      </DesignCanvas>

      <TweaksPanel title="Wireframe tweaks">
        <TweakSection label="Look">
          <TweakColor
            label="Accent"
            value={ACCENTS[t.accent]}
            options={[ACCENTS.rust, ACCENTS.forest, ACCENTS.cobalt, ACCENTS.ink]}
            onChange={(hex) => {
              const key = Object.keys(ACCENTS).find((k) => ACCENTS[k] === hex) || 'rust';
              setTweak('accent', key);
            }}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
