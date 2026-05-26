// hifi-core.jsx — tokens, primitives, and shared data/helpers for the
// hi-fi Patch Selection prototype. Everything here is exported on `window`
// so the other Babel scripts can pick it up.

// ── tokens ───────────────────────────────────────────────────────────────
const T = {
  // light surfaces
  paper:      '#f6f7fa',
  surface:    '#ffffff',
  surface2:   '#f1f3f7',
  border:     '#e4e7ee',
  borderSoft: '#eef0f5',

  // ink
  ink:        '#0d1220',
  inkStrong:  '#05080f',
  inkMuted:   '#5b6478',
  inkFaint:   '#8b94a8',

  // dark rail
  navBg:      '#0a0f1e',
  navSurf:    '#141a2c',
  navSurfHi:  '#1d2540',
  navBorder:  '#212946',
  navText:    '#e9ecf4',
  navMuted:   '#7c869f',
  navIcon:    '#9ba5bd',

  // ultramarine accent
  accent:     '#3056e3',
  accentHi:   '#1f3fc9',
  accentSoft: '#e8edff',
  accentInk:  '#1c2c66',
  accentOnDk: '#5b7bff',

  // semantic
  danger:     '#d92d2d',
  dangerSoft: '#fdecec',
  warning:    '#d97706',
  success:    '#0d8a4d',

  // data viz
  ctrl:       '#0d8a8a',
  sema:       '#d96a3a',
  ctrlSoft:   '#dff3f2',
  semaSoft:   '#fbe7da',

  // shadows
  sh1: '0 1px 2px rgba(13,18,32,0.05), 0 1px 1px rgba(13,18,32,0.04)',
  sh2: '0 4px 12px rgba(13,18,32,0.08), 0 1px 2px rgba(13,18,32,0.04)',
  shInner: 'inset 0 0 0 1px rgba(13,18,32,0.06)',

  // type
  sans:   "'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono:   "'Geist Mono', ui-monospace, 'JetBrains Mono', monospace",
};

// ── icons (inline SVG) ───────────────────────────────────────────────────
function Icon({ name, size = 16, stroke = 1.5, color = 'currentColor' }) {
  const p = (d) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
  switch (name) {
    case 'scatter': return p(<>
      <circle cx="5" cy="18" r="1.4" /><circle cx="9" cy="13" r="1.4" />
      <circle cx="13" cy="9" r="1.4" /><circle cx="17" cy="6" r="1.4" />
      <circle cx="19" cy="14" r="1.4" /><circle cx="7" cy="9" r="1.4" />
      <circle cx="15" cy="16" r="1.4" /></>);
    case 'grid': return p(<>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>);
    case 'search': return p(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
    case 'coverage': return p(<>
      <path d="M3 12c5-9 13-9 18 0" /><path d="M3 12c5 9 13 9 18 0" /><circle cx="12" cy="12" r="3" /></>);
    case 'settings': return p(<>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65 1.7 1.7 0 0 0 10.04 3.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.05Z" /></>);
    case 'sparkle': return p(<>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></>);
    case 'arrow-right': return p(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>);
    case 'close': return p(<><path d="M6 6l12 12M18 6 6 18" /></>);
    case 'check': return p(<><path d="m5 12 5 5 9-11" /></>);
    case 'pin': return p(<>
      <path d="M12 17v5" /><path d="M9 4h6l-1 5 3.5 3.5L18 14H6l.5-1.5L10 9l-1-5Z" /></>);
    case 'reject': return p(<><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>);
    case 'plus': return p(<><path d="M12 5v14M5 12h14" /></>);
    case 'minus': return p(<><path d="M5 12h14" /></>);
    case 'chevron-down': return p(<path d="m6 9 6 6 6-6" />);
    case 'chevron-right': return p(<path d="m9 6 6 6-6 6" />);
    case 'dot': return p(<circle cx="12" cy="12" r="3" fill={color} />);
    case 'filter': return p(<path d="M3 5h18M6 12h12M10 19h4" />);
    case 'download': return p(<><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>);
    case 'eye': return p(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
    case 'brain': return p(<>
      <path d="M9.5 4a2.5 2.5 0 0 0-2.5 2.5v.3A3 3 0 0 0 4 9.5a3 3 0 0 0 1.6 2.6A3 3 0 0 0 4 14.5a3 3 0 0 0 3 3 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5V6.5A2.5 2.5 0 0 0 9.5 4Z" />
      <path d="M14.5 4a2.5 2.5 0 0 1 2.5 2.5v.3a3 3 0 0 1 3 2.7 3 3 0 0 1-1.6 2.6 3 3 0 0 1 1.6 2.6 3 3 0 0 1-3 3 2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-2.5-2.5V6.5A2.5 2.5 0 0 1 14.5 4Z" /></>);
    case 'tag': return p(<>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" /><circle cx="8" cy="8" r="1.5" /></>);
    default: return null;
  }
}

// ── primitives ───────────────────────────────────────────────────────────
function Chip({ children, variant = 'neutral', size = 'sm', leading, onClick, active }) {
  const palettes = {
    neutral: { bg: T.surface, border: T.border, color: T.ink, hover: T.surface2 },
    soft:    { bg: T.surface2, border: 'transparent', color: T.inkMuted, hover: T.borderSoft },
    accent:  { bg: T.accentSoft, border: 'transparent', color: T.accentInk, hover: '#dde4ff' },
    accentSolid: { bg: T.accent, border: T.accent, color: '#fff', hover: T.accentHi },
    danger:  { bg: T.dangerSoft, border: 'transparent', color: T.danger, hover: '#fbdcdc' },
    ctrl:    { bg: T.ctrlSoft, border: 'transparent', color: '#075959', hover: '#cfeeec' },
    sema:    { bg: T.semaSoft, border: 'transparent', color: '#8e3d18', hover: '#f6d8c4' },
  };
  const c = palettes[variant] || palettes.neutral;
  const padding = size === 'xs' ? '2px 8px' : size === 'sm' ? '4px 10px' : '6px 12px';
  const fontSize = size === 'xs' ? 11 : size === 'sm' ? 12 : 13;
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding, fontSize, fontFamily: T.sans, fontWeight: 500,
        background: active ? (palettes.accentSolid.bg) : c.bg,
        color: active ? '#fff' : c.color,
        border: `1px solid ${active ? palettes.accentSolid.border : c.border}`,
        borderRadius: 999, lineHeight: 1,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        transition: 'background .12s, color .12s, border-color .12s',
      }}
    >
      {leading}
      {children}
    </span>
  );
}

function Card({ children, style = {}, padding = 16, raised, accentLeft, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        boxShadow: raised ? T.sh2 : T.sh1,
        padding,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        ...(accentLeft ? { borderLeft: `3px solid ${T.accent}` } : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Button({ children, variant = 'primary', size = 'md', leading, trailing, onClick, fullWidth, style = {} }) {
  const palettes = {
    primary:   { bg: T.accent, color: '#fff', border: T.accent, hover: T.accentHi },
    secondary: { bg: T.surface, color: T.ink, border: T.border, hover: T.surface2 },
    ghost:     { bg: 'transparent', color: T.ink, border: 'transparent', hover: T.surface2 },
    danger:    { bg: T.surface, color: T.danger, border: T.border, hover: T.dangerSoft },
    dark:      { bg: T.ink, color: '#fff', border: T.ink, hover: '#1f2940' },
  };
  const c = palettes[variant] || palettes.primary;
  const sizes = {
    sm: { padding: '6px 10px', fontSize: 12, height: 28 },
    md: { padding: '8px 14px', fontSize: 13, height: 34 },
    lg: { padding: '10px 18px', fontSize: 14, height: 40 },
  };
  const s = sizes[size];
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: c.bg, color: c.color,
        border: `1px solid ${c.border}`,
        borderRadius: 7, padding: s.padding, fontSize: s.fontSize, height: s.height,
        fontFamily: T.sans, fontWeight: 500, lineHeight: 1, cursor: 'pointer',
        width: fullWidth ? '100%' : undefined,
        transition: 'background .12s, color .12s, border-color .12s',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = c.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = c.bg; }}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
}

function Segmented({ value, options, onChange, accent = T.accent }) {
  return (
    <div style={{
      display: 'inline-flex', background: T.surface2, borderRadius: 8,
      padding: 3, gap: 2, border: `1px solid ${T.border}`,
    }}>
      {options.map((opt) => {
        const v = typeof opt === 'object' ? opt.value : opt;
        const label = typeof opt === 'object' ? opt.label : opt;
        const on = v === value;
        return (
          <button
            key={v}
            onClick={() => onChange && onChange(v)}
            style={{
              background: on ? T.surface : 'transparent',
              color: on ? T.ink : T.inkMuted,
              border: 'none', borderRadius: 6,
              padding: '5px 12px', fontSize: 12, fontFamily: T.sans, fontWeight: 500,
              boxShadow: on ? T.sh1 : 'none', cursor: 'pointer',
              transition: 'background .12s, color .12s',
              minWidth: 44, textAlign: 'center',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, unit, delta, deltaTone = 'neutral', sub }) {
  const deltaCol = { positive: T.success, negative: T.danger, neutral: T.inkMuted }[deltaTone];
  return (
    <div>
      <div style={{ fontSize: 11, color: T.inkMuted, fontFamily: T.sans, fontWeight: 500, letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 28, fontFamily: T.sans, fontWeight: 600, color: T.ink, letterSpacing: -0.5 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 13, color: T.inkMuted, fontFamily: T.mono }}>{unit}</span>}
        {delta && (
          <span style={{ fontSize: 12, color: deltaCol, fontFamily: T.mono, fontWeight: 500, marginLeft: 4 }}>
            {delta}
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── microscopy patch ─────────────────────────────────────────────────────
// Renders a dark canvas with bright fluorescent puncta. seed varies the
// distribution so each patch looks distinct. size accepts a number (fixed
// px square) or a CSS string like "100%" — in the string case the tile
// fills its parent's width and uses aspect-ratio:1/1 to stay square.
function PatchTile({ size = 96, seed = 1, density = 1, blurry, artifact, label, badge, accent }) {
  const isFluid = typeof size === 'string';
  // pick an internal coord space — for fluid sizing we use a fixed viewBox
  // so the SVG generator below has stable numbers to work with.
  const innerSize = isFluid ? 120 : size;
  let s = (seed * 9973 + 1) % 2147483647;
  const r = () => { s = (s * 1664525 + 1013904223) % 2147483647; return s / 2147483647; };
  const N = Math.round(28 * density + r() * 14);
  const dots = [];
  for (let i = 0; i < N; i++) {
    const x = r() * innerSize, y = r() * innerSize;
    const rad = 0.6 + r() * 1.6 + (artifact && r() < 0.05 ? 6 : 0);
    const op = 0.35 + r() * 0.65;
    dots.push({ x, y, r: rad, o: op });
  }
  // a few small clusters for biological feel
  for (let c = 0; c < 2 + Math.floor(r() * 3); c++) {
    const cx = r() * innerSize, cy = r() * innerSize;
    const n = 4 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const rr = r() * 8;
      dots.push({
        x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr,
        r: 0.8 + r() * 1.4, o: 0.55 + r() * 0.45,
      });
    }
  }
  const filter = blurry ? 'blur(0.8px)' : undefined;
  return (
    <div style={{
      width: size,
      height: isFluid ? undefined : size,
      aspectRatio: isFluid ? '1 / 1' : undefined,
      position: 'relative',
      background: 'radial-gradient(120% 100% at 50% 50%, #0e1626 0%, #060912 100%)',
      borderRadius: 6, overflow: 'hidden', flexShrink: 0,
      boxShadow: accent ? `0 0 0 2px ${accent}, ${T.sh1}` : T.sh1,
    }}>
      <svg viewBox={`0 0 ${innerSize} ${innerSize}`} preserveAspectRatio="xMidYMid slice"
           style={{ width: '100%', height: '100%', display: 'block', filter }}>
        {/* faint background tissue */}
        <defs>
          <radialGradient id={`tissue${seed}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1a2740" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0a1020" stopOpacity="0" />
          </radialGradient>
          <filter id={`glow${seed}`}><feGaussianBlur stdDeviation="0.6" /></filter>
        </defs>
        <rect width={innerSize} height={innerSize} fill={`url(#tissue${seed})`} />
        {/* puncta */}
        <g filter={`url(#glow${seed})`}>
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r * 1.2}
              fill="#7fd1c4" opacity={d.o * 0.5} />
          ))}
        </g>
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r}
            fill="#aef0d6" opacity={d.o} />
        ))}
      </svg>
      {label && (
        <div style={{
          position: 'absolute', bottom: 4, left: 6, color: '#cfd6e5',
          fontFamily: T.mono, fontSize: 9, letterSpacing: 0.4, opacity: 0.75,
        }}>{label}</div>
      )}
      {badge && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          padding: '1px 5px', borderRadius: 3, fontSize: 9,
          fontFamily: T.mono, fontWeight: 500,
          background: badge.bg || 'rgba(0,0,0,0.55)',
          color: badge.color || '#fff',
        }}>{badge.text}</div>
      )}
    </div>
  );
}

// ── scatter (clean hi-fi UMAP) ───────────────────────────────────────────
const SCATTER_DATA = (() => {
  let s = 9011;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const blobs = [
    { cx: 180, cy: 220, rx: 90, ry: 70, n: 70, cond: 'C' },
    { cx: 420, cy: 290, rx: 100, ry: 65, n: 90, cond: 'S' },
    { cx: 590, cy: 170, rx: 70, ry: 80, n: 55, cond: 'C' },
    { cx: 290, cy: 100, rx: 55, ry: 45, n: 35, cond: 'S' },
    { cx: 650, cy: 350, rx: 55, ry: 55, n: 32, cond: 'S' },
    { cx: 120, cy: 360, rx: 45, ry: 30, n: 18, cond: 'C' },
  ];
  const pts = [];
  blobs.forEach((b) => {
    for (let i = 0; i < b.n; i++) {
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r());
      pts.push({
        x: b.cx + Math.cos(a) * b.rx * rr + (r() - 0.5) * 18,
        y: b.cy + Math.sin(a) * b.ry * rr + (r() - 0.5) * 18,
        c: b.cond,
      });
    }
  });
  const targets = [
    [180, 220], [430, 290], [590, 170], [290, 100], [650, 350], [120, 360],
    [240, 260], [380, 240], [510, 220], [330, 160], [560, 300], [220, 130],
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

function ScatterPlot({ width = '100%', height = 460, highlightIdx, onHover }) {
  const VB_W = 800, VB_H = 460;
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet"
         style={{ width, height, display: 'block', background: T.surface, borderRadius: 8 }}>
      <defs>
        <pattern id="grid-hifi" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#eef0f5" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={VB_W} height={VB_H} fill="url(#grid-hifi)" />
      {/* axis labels */}
      <text x={VB_W - 14} y={VB_H - 14} fontFamily={T.mono} fontSize="11" fill={T.inkFaint} textAnchor="end">umap-1 →</text>
      <text x={14} y={20} fontFamily={T.mono} fontSize="11" fill={T.inkFaint}>↑ umap-2</text>
      {/* hulls behind clusters */}
      {SCATTER_DATA.map((p, i) => p.sel ? null : (
        <circle key={i} cx={p.x} cy={p.y} r={3}
          fill={p.c === 'C' ? T.ctrl : T.sema} opacity={0.32} />
      ))}
      {/* selected on top */}
      {SCATTER_DATA.map((p, i) => p.sel ? (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={9} fill={T.accent} opacity={0.18} />
          <circle cx={p.x} cy={p.y} r={5.2} fill={T.accent} stroke="#fff" strokeWidth="1.4" />
          {i === highlightIdx && (
            <circle cx={p.x} cy={p.y} r={14} fill="none" stroke={T.accent} strokeWidth="1.4" strokeDasharray="3 3" />
          )}
        </g>
      ) : null)}
    </svg>
  );
}

// ── data fixtures (focused patch + selection) ───────────────────────────
const FOCUSED = {
  id: 'P-4218',
  brain: 'Brain 07',
  scan: '260219_AN0B7_G002_MB1',
  condition: 'Semaglutide',
  z: 842, y: 1456, x: 1023,
  cluster: 7,
  deltaNN: 0.12,
  weights: [
    { key: 'nucleus',    val: 0.86 },
    { key: 'sharpness',  val: 0.71 },
    { key: 'foreground', val: 0.62 },
    { key: 'snr',        val: 0.78 },
    { key: 'contrast',   val: 0.69 },
    { key: 'deviation',  val: 0.74, accent: true },
  ],
  tags: [
    { name: 'cluster-7 anchor', primary: true },
    { name: 'dense c-Fos signal', score: 0.31 },
    { name: 'cell body cluster', score: 0.22 },
  ],
};

const SELECTION = Array.from({ length: 50 }, (_, i) => ({
  id: `P-${(4000 + i * 31 + (i * i) % 87).toString()}`,
  c: (i * 7) % 5 < 2 ? 'C' : 'S',
  cluster: ((i * 3 + 1) % 11) + 1,
  density: 0.4 + ((i * 13) % 60) / 100,
  seed: i * 11 + 7,
}));

const TABS = [
  { id: 'embedding', label: 'Embedding',  icon: 'scatter' },
  { id: 'selection', label: 'Selection',  icon: 'grid' },
  { id: 'search',    label: 'Search',     icon: 'search' },
  { id: 'coverage',  label: 'Coverage',   icon: 'coverage' },
];

// ── export ───────────────────────────────────────────────────────────────
Object.assign(window, {
  T, Icon, Chip, Card, Button, Segmented, Stat,
  PatchTile, ScatterPlot, SCATTER_DATA,
  FOCUSED, SELECTION, TABS,
});
