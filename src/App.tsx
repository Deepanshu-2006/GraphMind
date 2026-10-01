import { useState, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { OverviewView } from './components/overview/OverviewView';
import { KnowledgeGraphWorkspace } from './components/graph/KnowledgeGraphWorkspace';
import { CreateGraphModal } from './components/modals/CreateGraphModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { ExploreGraphModal } from './components/graph/ExploreGraphModal';
import { 
  mockProjectWorkspace, 
  mockRecentMaterials, 
  mockConnectedConcepts, 
  mockLearningPaths 
} from './data/mockData';
import type { NavSection } from './types';
import { 
  UploadCloud, 
  ArrowRight,
  Cpu,
  Zap
} from 'lucide-react';

export function App() {
  const getInitialSection = (): NavSection => {
    const path = window.location.pathname.replace(/^\//, '');
    if (path === 'graph') return 'graph';
    if (path === 'paths') return 'paths';
    if (path === 'sources') return 'sources';
    if (path === 'settings') return 'settings';
    return 'overview';
  };

  const [currentSection, setCurrentSection] = useState<NavSection>(getInitialSection);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchPaletteOpen, setSearchPaletteOpen] = useState(false);
  const [exploreGraphOpen, setExploreGraphOpen] = useState(false);

  const navigateToSection = (section: NavSection) => {
    setCurrentSection(section);
    const targetPath = section === 'overview' ? '/' : `/${section}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  // Sync route on browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      setCurrentSection(getInitialSection());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global hotkeys (Cmd+K / Ctrl+K and Cmd+,)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchPaletteOpen(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        navigateToSection('settings');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateSuccess = () => {
    navigateToSection('graph');
  };

  return (
    <>
      <AppShell
        currentSection={currentSection}
        onSelectSection={navigateToSection}
        project={mockProjectWorkspace}
        recentMaterials={mockRecentMaterials}
        onOpenSearch={() => setSearchPaletteOpen(true)}
        onOpenCreateModal={() => setCreateModalOpen(true)}
      >
        {/* Overview View */}
        {currentSection === 'overview' && (
          <OverviewView
            onCreateGraph={() => setCreateModalOpen(true)}
            onExploreDemo={() => navigateToSection('graph')}
          />
        )}

        {/* Dedicated Knowledge Graph Workspace (/graph) */}
        {currentSection === 'graph' && (
          <KnowledgeGraphWorkspace />
        )}

        {/* Learning Paths View */}
        {currentSection === 'paths' && (
          <div className="overview-container">
            <div className="section-title-wrap">
              <span className="section-label">Synthesized Curricula</span>
              <h1 className="section-heading" style={{ fontSize: '32px' }}>Algorithmic Learning Paths</h1>
              <p className="section-subtext">
                Dynamic progression tracks automatically synthesized from dependency linkages across your papers.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {mockLearningPaths.map((path) => (
                <div key={path.id} className="metric-card" style={{ gap: '18px' }}>
                  <div className="metric-header">
                    <span className="metric-telemetry">{path.status}</span>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
                      {path.progress}% COMPLETE
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{path.title}</h3>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>{path.nodeCount} Concepts</span>
                      <span>•</span>
                      <span>{path.estimatedHours}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: '4px', background: 'var(--bg-inset)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${path.progress}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-indigo))' 
                      }} 
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => setExploreGraphOpen(true)}
                    >
                      <span>Traverse Path</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources View */}
        {currentSection === 'sources' && (
          <div className="overview-container">
            <div className="section-title-wrap">
              <span className="section-label">Knowledge Corpus</span>
              <h1 className="section-heading" style={{ fontSize: '32px' }}>Ingested Materials</h1>
              <p className="section-subtext">
                Unstructured educational materials indexed into semantic knowledge representations.
              </p>
            </div>

            <div className="metric-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  ACTIVE CORPUS ({mockRecentMaterials.length} DOCUMENTS)
                </span>
                <button 
                  className="btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => setCreateModalOpen(true)}
                >
                  <UploadCloud size={13} />
                  <span>Ingest Document</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {mockRecentMaterials.map((mat) => (
                  <div 
                    key={mat.id}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease'
                    }}
                    className="sidebar-nav-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span className="material-badge">{mat.format}</span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 550, color: 'var(--text-primary)' }}>{mat.title}</div>
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Size: {mat.size} • {mat.timestamp}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span className="synapse-count-pill">
                        {mat.conceptsExtracted} Concepts Extracted
                      </span>
                      <span className="status-pill" style={{ fontSize: '10px' }}>
                        <span className="status-pill-dot" style={{ background: 'var(--accent-emerald)' }} />
                        <span>Indexed</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings View */}
        {currentSection === 'settings' && (
          <div className="overview-container">
            <div className="section-title-wrap">
              <span className="section-label">Engine Configuration</span>
              <h1 className="section-heading" style={{ fontSize: '32px' }}>System Settings</h1>
              <p className="section-subtext">
                Graph layout parameters, extraction confidence thresholds, and hotkey configurations.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              <div className="metric-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Cpu size={18} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Graph Synthesis Engine</h3>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Configured for semantic entity resolution with bi-directional relational extraction.
                </p>
                <div className="telemetry-item" style={{ marginTop: '8px' }}>
                  <span>Confidence Threshold: <strong style={{ color: 'var(--accent-cyan)' }}>0.85</strong></span>
                </div>
              </div>

              <div className="metric-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={18} style={{ color: 'var(--accent-emerald)' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Renderer Acceleration</h3>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Hardware-accelerated SVG and Canvas matrix with sub-millisecond synapse edge physics.
                </p>
                <div className="telemetry-item" style={{ marginTop: '8px' }}>
                  <span>Renderer: <strong>High DPI Vector Pipeline</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </AppShell>

      {/* Ingestion Modal */}
      <CreateGraphModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Global Command Palette (Cmd + K) */}
      <CommandPalette
        isOpen={searchPaletteOpen}
        onClose={() => setSearchPaletteOpen(false)}
        concepts={mockConnectedConcepts}
        onSelectConcept={() => {
          navigateToSection('graph');
        }}
      />

      {/* Interactive Fullscreen / Explorer Graph Drawer */}
      <ExploreGraphModal
        isOpen={exploreGraphOpen}
        onClose={() => setExploreGraphOpen(false)}
        concepts={mockConnectedConcepts}
      />
    </>
  );
}

export default App;
