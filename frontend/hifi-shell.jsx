// hifi-shell.jsx — dark left rail + light top bar + container.

function LeftNav({ activeTab, onChange }) {
  return (
    <div style={{
      width: 220,
      background: T.navBg,
      borderRight: `1px solid ${T.navBorder}`,
      display: 'flex', flexDirection: 'column',
      flexShrink: 0,
      fontFamily: T.sans,
      color: T.navText,
    }}>
      {/* brand */}
      <div style={{
        padding: '20px 20px 18px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${T.navBorder}`,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accentHi} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 0 1px ${T.accentHi}, inset 0 1px 0 rgba(255,255,255,0.18)`,
        }}>
          <Icon name="brain" size={17} color="#fff" stroke={1.7} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2, lineHeight: 1.1 }}>
            Vibraint
          </div>
          <div style={{ fontSize: 11, color: T.navMuted, marginTop: 1 }}>
            Patch workbench
          </div>
        </div>
      </div>

      {/* workspace selector */}
      <div style={{ padding: '12px 16px 4px' }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
          color: T.navMuted, textTransform: 'uppercase', marginBottom: 6, marginLeft: 6,
        }}>
          Workspace
        </div>
        <div style={{
          padding: '8px 10px',
          background: T.navSurf,
          border: `1px solid ${T.navBorder}`,
          borderRadius: 7,
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 5, background: '#2a3354',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: T.accentOnDk,
          }}>
            cF
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>
              c-Fos · semaglutide
            </div>
            <div style={{ fontSize: 10, color: T.navMuted, fontFamily: T.mono, marginTop: 1 }}>
              12 brains · 7,512 patches
            </div>
          </div>
          <Icon name="chevron-down" size={14} color={T.navMuted} />
        </div>
      </div>

      {/* nav items */}
      <nav style={{ padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
          color: T.navMuted, textTransform: 'uppercase', margin: '6px 12px 6px',
        }}>
          Analysis
        </div>
        {TABS.map((t) => {
          const on = t.id === activeTab;
          return (
            <button
              key={t.id}
              onClick={() => onChange && onChange(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 7,
                background: on ? T.navSurfHi : 'transparent',
                color: on ? T.navText : T.navIcon,
                border: 'none', cursor: 'pointer',
                fontFamily: T.sans, fontSize: 13, fontWeight: on ? 600 : 500,
                textAlign: 'left',
                position: 'relative',
                transition: 'background .12s, color .12s',
              }}
            >
              {on && (
                <span style={{
                  position: 'absolute', left: -10, top: 8, bottom: 8, width: 3,
                  background: T.accentOnDk, borderRadius: '0 3px 3px 0',
                }} />
              )}
              <Icon name={t.icon} size={16} color={on ? T.accentOnDk : T.navIcon} />
              <span>{t.label}</span>
              {t.id === 'selection' && on && (
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontFamily: T.mono,
                  background: T.navBg, padding: '1px 6px', borderRadius: 4, color: T.navMuted,
                }}>
                  50
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* selection summary at bottom */}
      <div style={{
        margin: 12, padding: 12,
        background: T.navSurf, border: `1px solid ${T.navBorder}`, borderRadius: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Icon name="dot" size={8} color={T.accentOnDk} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, color: T.navText, textTransform: 'uppercase' }}>
            Active selection
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: T.navText, fontFamily: T.sans, lineHeight: 1 }}>
              50
            </div>
            <div style={{ fontSize: 10, color: T.navMuted, marginTop: 3 }}>patches</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: T.accentOnDk, fontFamily: T.sans, lineHeight: 1 }}>
              0.84
            </div>
            <div style={{ fontSize: 10, color: T.navMuted, marginTop: 3 }}>coverage</div>
          </div>
        </div>
        <button style={{
          width: '100%', marginTop: 10, padding: '6px 8px',
          background: T.accent, color: '#fff', border: 'none',
          borderRadius: 6, fontSize: 12, fontFamily: T.sans, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="download" size={13} color="#fff" />
          Export selection
        </button>
      </div>

      {/* user */}
      <div style={{
        padding: '10px 16px', borderTop: `1px solid ${T.navBorder}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', background: '#2a3354',
          color: T.accentOnDk, fontSize: 11, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          MA
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.navText, lineHeight: 1.1 }}>
            Dr. M. Andersen
          </div>
          <div style={{ fontSize: 10, color: T.navMuted, marginTop: 1 }}>
            Neuroinformatics Lab
          </div>
        </div>
        <Icon name="settings" size={14} color={T.navMuted} />
      </div>
    </div>
  );
}

function TopBar({ title, subtitle, actions }) {
  return (
    <div style={{
      height: 60, padding: '0 28px',
      borderBottom: `1px solid ${T.border}`,
      background: T.surface,
      display: 'flex', alignItems: 'center', gap: 16,
      flexShrink: 0,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 18, fontFamily: T.sans, fontWeight: 600,
          color: T.ink, letterSpacing: -0.3, lineHeight: 1.1,
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ flex: 1 }} />
      {actions}
    </div>
  );
}

function PageShell({ activeTab, setActiveTab, title, subtitle, actions, children }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: T.paper, color: T.ink,
      fontFamily: T.sans, display: 'flex', overflow: 'hidden',
    }}>
      <LeftNav activeTab={activeTab} onChange={setActiveTab} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar title={title} subtitle={subtitle} actions={actions} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LeftNav, TopBar, PageShell });
