// hifi-tabs.jsx — content for the four tabs: Embedding, Selection, Search, Coverage.

// ── shared bits ──────────────────────────────────────────────────────────
function WeightBar({ label, val, accent }) {
  const color = accent ? T.accent : T.ink;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: T.sans, fontSize: 12 }}>
      <span style={{ width: 90, color: T.inkMuted, textTransform: 'capitalize' }}>{label}</span>
      <div style={{
        flex: 1, height: 6, background: T.surface2, borderRadius: 3, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          width: `${val * 100}%`, height: '100%',
          background: accent
            ? `linear-gradient(90deg, ${T.accent}, ${T.accentHi})`
            : T.ink,
          borderRadius: 3,
        }} />
      </div>
      <span style={{ width: 36, textAlign: 'right', color: T.ink, fontFamily: T.mono, fontSize: 11, fontWeight: 500 }}>
        {val.toFixed(2)}
      </span>
    </div>
  );
}

function ConditionDot({ c, size = 8 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: c === 'C' ? T.ctrl : T.sema, display: 'inline-block',
    }} />
  );
}

// ── EMBEDDING TAB ─────────────────────────────────────────────────────────
function EmbeddingTab({ patchCount, setPatchCount, focusIndex, setFocusIndex }) {
  const focused = SELECTION[focusIndex] || SELECTION[3];
  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{
        flex: 1, minWidth: 0, padding: 24, gap: 16,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* control row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: 14, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: T.inkMuted, fontWeight: 500 }}>Select</span>
            <Segmented
              value={patchCount}
              options={[
                { value: 10, label: 'Top 10' },
                { value: 25, label: 'Top 25' },
                { value: 50, label: 'Top 50' },
                { value: 100, label: 'Top 100' },
                { value: 200, label: 'Top 200' },
              ]}
              onChange={setPatchCount}
            />
            <Chip variant="soft" size="xs">custom…</Chip>
          </div>
          <div style={{ width: 1, height: 22, background: T.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: T.inkMuted, fontWeight: 500 }}>Projection</span>
            <Segmented value="umap" options={['umap', 'pca', 't-sne']} onChange={() => {}} />
          </div>
          <div style={{ width: 1, height: 22, background: T.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: T.inkMuted, fontWeight: 500 }}>Color</span>
            <Chip variant="accent" size="sm" leading={<Icon name="dot" size={10} color={T.accent} />}>
              condition
            </Chip>
            <Chip variant="soft" size="sm">cluster</Chip>
            <Chip variant="soft" size="sm">quality</Chip>
          </div>
          <div style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" leading={<Icon name="filter" size={13} />}>
            Filters
          </Button>
        </div>

        {/* scatter card */}
        <Card padding={0} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: `1px solid ${T.borderSoft}`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>
              UMAP projection
            </div>
            <span style={{ fontSize: 11, color: T.inkMuted, fontFamily: T.mono }}>
              cosine · n_neighbors 15 · min_dist 0.10
            </span>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: T.inkMuted }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ConditionDot c="C" /> Control
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ConditionDot c="S" /> Semaglutide
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.accent, border: '1.5px solid #fff', boxShadow: `0 0 0 1px ${T.accent}` }} />
                Selected ({patchCount})
              </span>
            </div>
          </div>
          <div style={{ flex: 1, padding: 12, minHeight: 0 }}>
            <ScatterPlot width="100%" height="100%" highlightIdx={focusIndex} />
          </div>
        </Card>
      </div>

      {/* right rail */}
      <div style={{
        width: 380, flexShrink: 0, background: T.surface,
        borderLeft: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* grouping header */}
        <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${T.borderSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>
              The {patchCount} picks
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: T.inkMuted, fontFamily: T.mono }}>
              cov 0.84 · {Math.round(patchCount * 0.68)} sema · {Math.round(patchCount * 0.32)} ctrl
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
            {SELECTION.slice(0, Math.min(patchCount, 12)).map((p, i) => (
              <div
                key={p.id}
                onClick={() => setFocusIndex(i)}
                style={{ cursor: 'pointer', position: 'relative' }}
              >
                <PatchTile
                  size={72}
                  seed={p.seed}
                  density={p.density}
                  imgSrc={p.img}
                  accent={i === focusIndex ? T.accent : undefined}
                  badge={{ text: `c${p.cluster}`, bg: 'rgba(0,0,0,0.55)', color: '#fff' }}
                />
                <div style={{
                  position: 'absolute', bottom: 4, right: 4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: p.c === 'C' ? T.ctrl : T.sema,
                  boxShadow: '0 0 0 1.5px #0c1422',
                }} />
              </div>
            ))}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 10, fontSize: 11, color: T.inkMuted,
          }}>
            <span>
              {patchCount > 12
                ? `Showing 12 of ${patchCount} · scroll for all`
                : `All ${patchCount} picks shown`}
            </span>
            <a style={{ color: T.accent, fontWeight: 500, cursor: 'pointer' }}>View grid →</a>
          </div>
        </div>

        {/* focused detail */}
        <div style={{
          padding: 18, overflowY: 'auto', flex: 1,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <PatchTile size={120} seed={focused.seed} density={focused.density} imgSrc={focused.img} accent={T.accent} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: T.ink, letterSpacing: -0.3 }}>
                  {focused.id}
                </span>
                <ConditionDot c={focused.c} size={9} />
              </div>
              <div style={{ fontSize: 11, color: T.inkMuted, fontFamily: T.mono, marginTop: 2 }}>
                {focused.brain} · {focused.condition.toLowerCase()}
              </div>
              <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.mono, marginTop: 2 }}>
                z {focused.z} · y₀ {focused.y} · x₀ {focused.x}
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(focused.tags || []).map((t, i) => (
                  <Chip key={i} variant={t.primary ? 'accent' : 'soft'} size="xs">
                    {t.name}
                    {t.score != null && (
                      <span style={{ marginLeft: 5, opacity: 0.7, fontFamily: T.mono }}>
                        {t.score.toFixed(2)}
                      </span>
                    )}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {/* weights card */}
          <div style={{
            border: `1px solid ${T.border}`, borderRadius: 10, padding: 14,
            background: T.paper,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12, gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>
                Weights
              </span>
              <span style={{ fontSize: 11, color: T.inkMuted }}>
                why this patch was kept
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(focused.weights || []).map((w) => (
                <WeightBar key={w.key} label={w.key} val={w.val} accent={w.accent} />
              ))}
            </div>
          </div>

          {/* justification */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, letterSpacing: -0.2, marginBottom: 6 }}>
              Justification
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: T.ink }}>
              {focused.justification || (
                <>Densest member of cluster {focused.cluster}. Removing this patch would leave
                  its corner of the embedding manifold the least-covered (Δ to nearest
                  selected: <b style={{ fontFamily: T.mono }}>{(focused.deltaNN ?? 0).toFixed(2)}</b>).</>
              )}
            </div>
          </div>

          {/* actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
            <Button variant="danger" leading={<Icon name="reject" size={14} color={T.danger} />} fullWidth>
              Reject &amp; resample
            </Button>
            <Button variant="dark" leading={<Icon name="pin" size={14} color="#fff" />} fullWidth>
              Pin patch
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SELECTION TAB (labeling app) ──────────────────────────────────────────
const VOCAB = [
  { id: 'dense',     label: 'Dense c-Fos',       group: 'signal',  color: T.accent },
  { id: 'scattered', label: 'Scattered neurons', group: 'signal',  color: T.accent },
  { id: 'sparse',    label: 'Sparse activity',   group: 'signal',  color: T.accent },
  { id: 'fiber',     label: 'Fiber tract',       group: 'anatomy', color: T.ctrl },
  { id: 'edge',      label: 'Tissue edge',       group: 'anatomy', color: T.ctrl },
  { id: 'cluster',   label: 'Cell cluster',      group: 'anatomy', color: T.ctrl },
  { id: 'blurry',    label: 'Out of focus',      group: 'quality', color: T.danger },
  { id: 'artifact',  label: 'Artifact',          group: 'quality', color: T.danger },
  { id: 'edge-tear', label: 'Edge tear',         group: 'quality', color: T.danger },
];

const LABELS_INITIAL = {
  0: ['dense', 'cluster'],
  1: ['scattered'],
  2: ['fiber'],
  3: ['dense'],
  5: ['blurry', 'artifact'],
  7: ['sparse'],
  8: ['cluster'],
  10: ['edge'],
};

function SelectionTab() {
  const [labels, setLabels] = React.useState(LABELS_INITIAL);
  const [activeIdx, setActiveIdx] = React.useState(3);
  const [freeText, setFreeText] = React.useState('');
  const active = SELECTION[activeIdx];
  const activeLabels = labels[activeIdx] || [];

  const toggle = (idx, vocabId) => {
    setLabels((prev) => {
      const curr = prev[idx] || [];
      const next = curr.includes(vocabId)
        ? curr.filter((x) => x !== vocabId)
        : [...curr, vocabId];
      return { ...prev, [idx]: next };
    });
  };

  const labeledCount = Object.values(labels).filter((l) => l.length).length;

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {/* filters */}
      <div style={{
        width: 220, flexShrink: 0, background: T.surface,
        borderRight: `1px solid ${T.border}`, padding: 18,
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 14, letterSpacing: -0.2 }}>
          Filters
        </div>
        <FilterGroup label="Condition" items={[
          { label: 'All conditions', n: 50, on: true },
          { label: <span><ConditionDot c="C" /> Control</span>, n: 16 },
          { label: <span><ConditionDot c="S" /> Semaglutide</span>, n: 34 },
        ]} />
        <FilterGroup label="Label status" items={[
          { label: 'Unlabeled', n: 50 - labeledCount },
          { label: 'Labeled', n: labeledCount, on: true },
          { label: 'Conflicting', n: 2 },
        ]} />
        <FilterGroup label="Cluster" items={[
          { label: 'c1 · prefrontal',   n: 5 },
          { label: 'c4 · hippocampus',  n: 7 },
          { label: 'c7 · amygdala',     n: 6 },
          { label: 'c9 · cerebellum',   n: 4 },
          { label: 'Show all 11…', muted: true },
        ]} />
      </div>

      {/* main grid */}
      <div style={{
        flex: 1, minWidth: 0, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 12, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
        }}>
          <div style={{
            fontSize: 12, color: T.inkMuted, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              padding: '2px 8px', background: T.accentSoft, color: T.accentInk,
              borderRadius: 4, fontWeight: 600, fontFamily: T.mono, fontSize: 11,
            }}>
              {labeledCount}
            </span>
            of {SELECTION.length} labeled
          </div>
          <div style={{
            flex: 1, height: 6, background: T.surface2, borderRadius: 3, marginLeft: 4,
          }}>
            <div style={{
              width: `${(labeledCount / SELECTION.length) * 100}%`,
              height: '100%', background: T.accent, borderRadius: 3,
            }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="secondary" size="sm" leading={<Icon name="sparkle" size={13} />}>
              Suggest labels
            </Button>
            <Button variant="secondary" size="sm" leading={<Icon name="tag" size={13} />}>
              Bulk apply
            </Button>
            <Button variant="primary" size="sm" leading={<Icon name="download" size={13} color="#fff" />}>
              Export CSV
            </Button>
          </div>
        </div>

        {/* grid */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14,
          }}>
            {SELECTION.slice(0, 20).map((p, i) => {
              const ls = labels[i] || [];
              const sel = i === activeIdx;
              return (
                <div
                  key={p.id}
                  onClick={() => setActiveIdx(i)}
                  style={{
                    cursor: 'pointer',
                    border: `1.5px solid ${sel ? T.accent : T.border}`,
                    borderRadius: 10, padding: 8, background: T.surface,
                    boxShadow: sel ? `0 0 0 3px ${T.accentSoft}` : 'none',
                    transition: 'box-shadow .12s, border-color .12s',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <PatchTile size="100%" seed={p.seed} density={p.density} imgSrc={p.img} />
                    <div style={{
                      position: 'absolute', top: 6, left: 6,
                      width: 18, height: 18, borderRadius: 4,
                      background: sel ? T.accent : 'rgba(255,255,255,0.85)',
                      border: `1.5px solid ${sel ? T.accent : '#fff'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: T.sh1,
                    }}>
                      {sel && <Icon name="check" size={12} color="#fff" stroke={2.5} />}
                    </div>
                    <div style={{
                      position: 'absolute', bottom: 6, right: 6,
                      padding: '1px 6px', fontSize: 9, fontFamily: T.mono,
                      background: p.c === 'C' ? T.ctrl : T.sema, color: '#fff',
                      borderRadius: 3, fontWeight: 600,
                    }}>
                      {p.c === 'C' ? 'CTRL' : 'SEMA'}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: T.mono, color: T.inkMuted }}>
                    {p.id} · c{p.cluster}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, minHeight: 22 }}>
                    {ls.length === 0 && (
                      <span style={{ fontSize: 11, color: T.inkFaint, fontStyle: 'italic' }}>
                        unlabeled
                      </span>
                    )}
                    {ls.slice(0, 2).map((id) => {
                      const v = VOCAB.find((x) => x.id === id);
                      return v && (
                        <span key={id} style={{
                          fontSize: 10, padding: '1px 6px',
                          background: 'transparent', color: v.color,
                          border: `1px solid ${v.color}40`, borderRadius: 999, fontWeight: 500,
                        }}>
                          {v.label}
                        </span>
                      );
                    })}
                    {ls.length > 2 && (
                      <span style={{ fontSize: 10, color: T.inkMuted, padding: '1px 4px' }}>
                        +{ls.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* right labeling rail */}
      <div style={{
        width: 340, flexShrink: 0, background: T.surface,
        borderLeft: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: 18, borderBottom: `1px solid ${T.borderSoft}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <PatchTile size={70} seed={active.seed} density={active.density} imgSrc={active.img} accent={T.accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>
              {active.id}
            </div>
            <div style={{ fontSize: 11, color: T.inkMuted, fontFamily: T.mono, marginTop: 2 }}>
              cluster {active.cluster} · {active.c === 'C' ? 'control' : 'semaglutide'}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={{
                padding: '2px 6px', borderRadius: 4, border: `1px solid ${T.border}`,
                background: T.surface, fontSize: 11, color: T.inkMuted, cursor: 'pointer',
                fontFamily: T.sans, display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="eye" size={11} /> open
              </button>
              <button style={{
                padding: '2px 6px', borderRadius: 4, border: `1px solid ${T.border}`,
                background: T.surface, fontSize: 11, color: T.inkMuted, cursor: 'pointer',
                fontFamily: T.sans, display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="arrow-right" size={11} /> next
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {['signal', 'anatomy', 'quality'].map((group) => (
            <div key={group}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
                color: T.inkMuted, textTransform: 'uppercase', marginBottom: 8,
              }}>
                {group}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {VOCAB.filter((v) => v.group === group).map((v) => {
                  const on = activeLabels.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      onClick={() => toggle(activeIdx, v.id)}
                      style={{
                        padding: '5px 11px', fontSize: 12, fontFamily: T.sans, fontWeight: 500,
                        borderRadius: 999, lineHeight: 1, cursor: 'pointer',
                        border: `1px solid ${on ? v.color : T.border}`,
                        background: on ? v.color : T.surface,
                        color: on ? '#fff' : T.ink,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        transition: 'background .12s, color .12s, border-color .12s',
                      }}
                    >
                      {on && <Icon name="check" size={11} color="#fff" stroke={2.5} />}
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* free text */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
              color: T.inkMuted, textTransform: 'uppercase', marginBottom: 8,
            }}>
              Custom label
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 8, background: T.surface,
            }}>
              <Icon name="plus" size={14} color={T.inkMuted} />
              <input
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="add a free-text label…"
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13, fontFamily: T.sans, color: T.ink,
                }}
              />
              <span style={{ fontSize: 10, color: T.inkFaint, fontFamily: T.mono }}>↵</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: T.inkFaint }}>
              Free-text labels are kept alongside the controlled vocabulary.
            </div>
          </div>

          {/* notes */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
              color: T.inkMuted, textTransform: 'uppercase', marginBottom: 8,
            }}>
              Notes
            </div>
            <textarea
              placeholder="biologist notes (markdown ok)…"
              style={{
                width: '100%', minHeight: 70, padding: 10,
                border: `1px solid ${T.border}`, borderRadius: 8,
                fontFamily: T.sans, fontSize: 13, color: T.ink, background: T.surface,
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{
          padding: 14, borderTop: `1px solid ${T.borderSoft}`, display: 'flex', gap: 8,
        }}>
          <button
            aria-label="Clear labels"
            style={{
              width: 38, height: 34, borderRadius: 7,
              background: T.surface, border: `1px solid ${T.border}`,
              color: T.ink, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="minus" size={14} />
          </button>
          <Button variant="primary" fullWidth trailing={<Icon name="arrow-right" size={14} color="#fff" />}>
            Save &amp; next
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, items }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
        color: T.inkMuted, textTransform: 'uppercase', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
            background: it.on ? T.accentSoft : 'transparent',
            color: it.muted ? T.inkFaint : T.ink,
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: it.on ? 500 : 400 }}>
              {it.label}
            </span>
            {it.n != null && (
              <span style={{
                fontSize: 11, color: it.on ? T.accentInk : T.inkMuted,
                fontFamily: T.mono,
              }}>
                {it.n}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SEARCH TAB ────────────────────────────────────────────────────────────
function SearchTab() {
  const [query, setQuery] = React.useState('patches with dense c-Fos signal near the hippocampus');
  const examples = [
    'sparse activity in the cerebellum',
    'out-of-focus or blurry patches',
    'fiber tracts at tissue edges',
    'control mice with cell body clusters',
    'high-contrast signal in the amygdala',
  ];
  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: 24, gap: 16, flexDirection: 'column' }}>
      {/* prompt */}
      <Card padding={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Icon name="sparkle" size={16} color={T.accent} />
          <span style={{ fontSize: 14, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>
            Describe what you're looking for
          </span>
          <span style={{ flex: 1 }} />
          <Chip variant="soft" size="xs">
            <Icon name="dot" size={6} color={T.success} /> PLIP · 512-d
          </Chip>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          background: T.paper, border: `1.5px solid ${T.accent}`, borderRadius: 12,
          boxShadow: `0 0 0 4px ${T.accentSoft}`,
        }}>
          <Icon name="search" size={20} color={T.accent} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. patches with dense c-Fos signal near the hippocampus"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 16, fontFamily: T.sans, color: T.ink, fontWeight: 500,
            }}
          />
          <Button variant="primary" trailing={<Icon name="arrow-right" size={14} color="#fff" />}>
            Search
          </Button>
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: T.inkMuted, fontWeight: 500, marginRight: 4 }}>Try:</span>
          {examples.map((e) => (
            <Chip key={e} variant="soft" size="xs" onClick={() => setQuery(e)}>
              {e}
            </Chip>
          ))}
        </div>
      </Card>

      {/* results header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>
            247 matches
          </div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>
            Cosine similarity against PLIP text embedding · sorted by relevance
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <Chip variant="soft" size="sm" leading={<Icon name="filter" size={12} />}>
          all conditions
        </Chip>
        <Chip variant="soft" size="sm">quality ≥ 0.5</Chip>
        <Segmented value="rel" options={[
          { value: 'rel', label: 'Relevance' },
          { value: 'qual', label: 'Quality' },
          { value: 'div', label: 'Diverse' },
        ]} onChange={() => {}} />
      </div>

      {/* results grid */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16,
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14,
        }}>
          {SELECTION.slice(0, 18).map((p, i) => {
            const sim = 0.92 - i * 0.013 - ((i * 17) % 5) * 0.004;
            const inSelection = i < 8;
            return (
              <div key={p.id} style={{
                border: `1px solid ${T.border}`, borderRadius: 10, padding: 8, background: T.surface,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ position: 'relative' }}>
                  <PatchTile size="100%" seed={p.seed} density={p.density} />
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    padding: '2px 7px', borderRadius: 999, fontSize: 11, fontFamily: T.mono,
                    background: 'rgba(13,18,32,0.78)', color: '#fff', fontWeight: 600,
                  }}>
                    {sim.toFixed(2)}
                  </div>
                  {inSelection && (
                    <div style={{
                      position: 'absolute', bottom: 6, left: 6,
                      padding: '2px 7px', borderRadius: 4, fontSize: 9, fontFamily: T.mono,
                      background: T.accent, color: '#fff', fontWeight: 600, letterSpacing: 0.3,
                    }}>
                      IN SELECTION
                    </div>
                  )}
                </div>
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                    color: T.ink, fontWeight: 500,
                  }}>
                    <ConditionDot c={p.c} />
                    {p.id}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkMuted, fontFamily: T.mono, marginTop: 2 }}>
                    cluster {p.cluster} · q {(0.6 + (i % 4) * 0.08).toFixed(2)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{
                    flex: 1, padding: '4px 8px', fontSize: 11, fontFamily: T.sans,
                    border: `1px solid ${T.border}`, background: T.surface, color: T.ink,
                    borderRadius: 5, cursor: 'pointer', fontWeight: 500,
                  }}>
                    Inspect
                  </button>
                  <button style={{
                    flex: 1, padding: '4px 8px', fontSize: 11, fontFamily: T.sans,
                    border: `1px solid ${T.accent}`, background: T.accentSoft, color: T.accentInk,
                    borderRadius: 5, cursor: 'pointer', fontWeight: 500,
                  }}>
                    + Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── COVERAGE TAB ──────────────────────────────────────────────────────────
function CoverageTab({ patchCount = 50 }) {
  const semaCount = Math.round(patchCount * 0.68);
  const ctrlCount = patchCount - semaCount;
  const semaPct = Math.round((semaCount / patchCount) * 100);
  const ctrlPct = 100 - semaPct;
  // held-out brains table data
  const heldOut = [
    { name: 'AN0B7 · sema',  ours: 0.11, kmeans: 0.18, random50: 0.22, random500: 0.14 },
    { name: 'AN0C2 · ctrl',  ours: 0.14, kmeans: 0.21, random50: 0.26, random500: 0.17 },
    { name: 'AN0D9 · sema',  ours: 0.10, kmeans: 0.16, random50: 0.21, random500: 0.13 },
    { name: 'AN0E3 · ctrl',  ours: 0.13, kmeans: 0.19, random50: 0.24, random500: 0.15 },
    { name: 'AN0F1 · sema',  ours: 0.12, kmeans: 0.17, random50: 0.23, random500: 0.14 },
    { name: 'AN0G5 · ctrl',  ours: 0.15, kmeans: 0.22, random50: 0.27, random500: 0.18 },
  ];
  return (
    <div style={{
      flex: 1, padding: 24, overflowY: 'auto', minHeight: 0,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      {/* hero stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Card padding={18} accentLeft>
          <Stat label="Coverage score" value="0.84" delta="+0.21 vs k-means" deltaTone="positive" sub="higher is better · selected vs full distribution" />
        </Card>
        <Card padding={18}>
          <Stat label="Max-min Δ" value="0.12" unit="cos" delta="−0.06 vs random ×4" deltaTone="positive" sub="worst-case distance to nearest selected" />
        </Card>
        <Card padding={18}>
          <Stat label="Mean NN Δ" value="0.07" unit="cos" sub="across all unselected patches" />
        </Card>
        <Card padding={18}>
          <Stat label="Vendi score" value="38.4" sub="effective number of distinct items (of 50)" />
        </Card>
      </div>

      {/* the headline */}
      <Card padding={20}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>
              Leave-one-brain-out coverage
            </div>
            <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>
              For each of the 12 brains, we train selection on the other 11 and measure how well the picks cover the held-out brain. Lower max-min Δ means better coverage.
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <Segmented value="50" options={['10', '25', '50', '100', '200']} onChange={() => {}} />
        </div>

        {/* table */}
        <div style={{
          border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden',
          fontFamily: T.sans, fontSize: 13,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr',
            padding: '10px 14px', background: T.surface2, fontWeight: 600, color: T.inkMuted,
            fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase',
          }}>
            <span>Held-out brain</span>
            <span style={{ textAlign: 'right' }}>Ours @ 50 ↓</span>
            <span style={{ textAlign: 'right' }}>k-means @ 50</span>
            <span style={{ textAlign: 'right' }}>Random @ 50</span>
            <span style={{ textAlign: 'right' }}>Random @ 500</span>
          </div>
          {heldOut.map((row, i) => (
            <div key={row.name} style={{
              display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr',
              padding: '11px 14px', borderTop: `1px solid ${T.borderSoft}`,
              alignItems: 'center',
            }}>
              <span style={{ color: T.ink, fontWeight: 500, fontFamily: T.mono, fontSize: 12 }}>
                {row.name}
              </span>
              <span style={{
                textAlign: 'right', fontFamily: T.mono,
                color: T.accent, fontWeight: 600,
              }}>
                {row.ours.toFixed(2)}
              </span>
              <span style={{ textAlign: 'right', fontFamily: T.mono, color: T.inkMuted }}>
                {row.kmeans.toFixed(2)}
              </span>
              <span style={{ textAlign: 'right', fontFamily: T.mono, color: T.inkMuted }}>
                {row.random50.toFixed(2)}
              </span>
              <span style={{ textAlign: 'right', fontFamily: T.mono, color: T.inkMuted }}>
                {row.random500.toFixed(2)}
              </span>
            </div>
          ))}
          {/* aggregate row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr',
            padding: '12px 14px', borderTop: `1.5px solid ${T.ink}`, background: T.paper,
            alignItems: 'center', fontWeight: 600,
          }}>
            <span style={{ color: T.ink }}>Mean (12 brains)</span>
            <span style={{ textAlign: 'right', fontFamily: T.mono, color: T.accent, fontSize: 14 }}>
              0.12 ± 0.02
            </span>
            <span style={{ textAlign: 'right', fontFamily: T.mono, color: T.inkMuted }}>
              0.19 ± 0.02
            </span>
            <span style={{ textAlign: 'right', fontFamily: T.mono, color: T.inkMuted }}>
              0.24 ± 0.02
            </span>
            <span style={{ textAlign: 'right', fontFamily: T.mono, color: T.inkMuted }}>
              0.15 ± 0.02
            </span>
          </div>
        </div>

        <div style={{
          marginTop: 14, padding: 12, background: T.accentSoft,
          border: `1px solid ${T.accent}30`, borderRadius: 8, fontSize: 13, color: T.accentInk,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <Icon name="check" size={16} color={T.accent} stroke={2.2} />
          <div>
            Our 50 picks cover every held-out brain better than k-means at 50
            <i> and</i> random at 500 — fewer labels, better generalisation.
          </div>
        </div>
      </Card>

      {/* per-condition + per-brain rollups */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card padding={18}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: T.ink, letterSpacing: -0.2 }}>
            Selection by condition
          </div>
          <CoverageRow label="Control" pct={ctrlPct} count={ctrlCount} total={patchCount} color={T.ctrl} />
          <CoverageRow label="Semaglutide" pct={semaPct} count={semaCount} total={patchCount} color={T.sema} />
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 10 }}>
            Sampling is proportional to representation in the pool (33% ctrl / 67% sema).
          </div>
        </Card>
        <Card padding={18}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: T.ink, letterSpacing: -0.2 }}>
            Picks per brain
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {[5, 4, 5, 3, 4, 5, 4, 4, 5, 3, 4, 4].map((n, i) => (
              <div key={i} style={{
                background: T.paper, border: `1px solid ${T.border}`, borderRadius: 6,
                padding: '8px 6px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: T.ink, fontFamily: T.sans }}>
                  {n}
                </div>
                <div style={{ fontSize: 10, color: T.inkMuted, fontFamily: T.mono, marginTop: 2 }}>
                  b{i + 1}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 12 }}>
            No brain is starved — minimum 3 per brain, maximum 5.
          </div>
        </Card>
      </div>
    </div>
  );
}

function CoverageRow({ label, pct, count, total = 50, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>{label}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.mono }}>
          {count} / {total} · {pct}%
        </span>
      </div>
      <div style={{ height: 8, background: T.surface2, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

Object.assign(window, { EmbeddingTab, SelectionTab, SearchTab, CoverageTab });
