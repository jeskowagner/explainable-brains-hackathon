// hifi-app.jsx — wires the shell + tabs into a single interactive prototype,
// hosted inside one big DesignCanvas artboard.

function App() {
  const [activeTab, setActiveTab] = React.useState('embedding');
  const [patchCount, setPatchCount] = React.useState(50);
  const [focusIndex, setFocusIndex] = React.useState(3);

  const titles = {
    embedding: { title: 'Embedding space',  subtitle: 'Explore the patch manifold and the selected anchors.' },
    selection: { title: 'Selection',        subtitle: 'Label and curate the patches before training.' },
    search:    { title: 'Search',           subtitle: 'Find patches by describing them in plain language.' },
    coverage:  { title: 'Coverage',         subtitle: 'How well the selection generalises across brains.' },
  };

  const actions = (() => {
    if (activeTab === 'embedding') return (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="md" leading={<Icon name="download" size={13} />}>Export</Button>
        <Button variant="primary" size="md" leading={<Icon name="sparkle" size={13} color="#fff" />}>Re-run selection</Button>
      </div>
    );
    if (activeTab === 'selection') return (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="md" leading={<Icon name="filter" size={13} />}>Saved views</Button>
        <Button variant="primary" size="md" leading={<Icon name="check" size={13} color="#fff" stroke={2.2} />}>Mark labeling complete</Button>
      </div>
    );
    if (activeTab === 'search') return (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="md" leading={<Icon name="filter" size={13} />}>History</Button>
      </div>
    );
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="md" leading={<Icon name="download" size={13} />}>Download report</Button>
      </div>
    );
  })();

  const { title, subtitle } = titles[activeTab];

  return (
    <DesignCanvas>
      <DCSection
        id="patch-workbench"
        title="Patch Selection Workbench — interactive"
        subtitle="Click any tab in the dark left rail to switch view. All four tabs are live."
      >
        <DCArtboard id="prototype" label="Patch workbench · live prototype" width={1440} height={900}>
          <PageShell
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            title={title}
            subtitle={subtitle}
            actions={actions}
          >
            {activeTab === 'embedding' && (
              <EmbeddingTab
                patchCount={patchCount}
                setPatchCount={setPatchCount}
                focusIndex={focusIndex}
                setFocusIndex={setFocusIndex}
              />
            )}
            {activeTab === 'selection' && <SelectionTab />}
            {activeTab === 'search' && <SearchTab />}
            {activeTab === 'coverage' && <CoverageTab patchCount={patchCount} />}
          </PageShell>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
