import { useState, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { OverviewView } from './components/overview/OverviewView';
import { KnowledgeGraphWorkspace } from './components/graph/KnowledgeGraphWorkspace';
import { CreateGraphModal } from './components/modals/CreateGraphModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { 
  mockProjectWorkspace, 
  mockRecentMaterials, 
  mockConnectedConcepts, 
  mockLearningPaths 
} from './data/mockData';
import type { NavSection } from './types';
import { 
  UploadCloud, 
  ArrowRight
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
  const [hasGraphContent, setHasGraphContent] = useState(true);

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
    setHasGraphContent(true);
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
            onExploreDemo={() => {
              setHasGraphContent(true);
            }}
            hasContent={hasGraphContent}
            onToggleContent={() => setHasGraphContent(prev => !prev)}
          />
        )}

        {/* Dedicated Knowledge Graph Workspace (/graph) */}
        {currentSection === 'graph' && (
          <KnowledgeGraphWorkspace onOpenUpload={() => setCreateModalOpen(true)} />
        )}

        {/* Learning Paths View (Section 14) */}
        {currentSection === 'paths' && (
          <div className="overview-page" style={{ paddingBottom: '96px' }}>
            <div className="overview-hero">
              <span className="overview-hero-label">Curriculum</span>
              <h1 className="overview-hero-title" style={{ fontSize: '36px' }}>Learning paths</h1>
              <p className="overview-hero-desc">
                Generated from the relationships in your knowledge graph.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
              {mockLearningPaths.map((path) => (
                <div
                  key={path.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px 0',
                    borderBottom: '1px solid var(--border-default)',
                    gap: '16px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {path.title.replace('to', '→')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>{path.nodeCount} concepts</span>
                      <span>·</span>
                      <span>{path.estimatedHours}</span>
                      {path.progress > 0 && (
                        <>
                          <span>·</span>
                          <span style={{ color: 'var(--accent)' }}>{path.progress}% complete</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                    onClick={() => navigateToSection('graph')}
                  >
                    <span>{path.progress > 0 ? 'Continue' : 'Start'}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources View (Section 13) */}
        {currentSection === 'sources' && (
          <div className="overview-page" style={{ paddingBottom: '96px' }}>
            <div className="overview-hero">
              <span className="overview-hero-label">Library</span>
              <h1 className="overview-hero-title" style={{ fontSize: '36px' }}>Sources</h1>
              <p className="overview-hero-desc">
                Your learning material
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
              {mockRecentMaterials.map((mat) => (
                <div
                  key={mat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 0',
                    borderBottom: '1px solid var(--border-default)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {mat.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      <span>{mat.format}</span>
                      <span>·</span>
                      <span>{mat.conceptsExtracted} concepts</span>
                      <span>·</span>
                      <span>{mat.size}</span>
                    </div>
                  </div>

                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                    <span>Indexed</span>
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                className="btn-primary"
                onClick={() => setCreateModalOpen(true)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <UploadCloud size={14} />
                <span>+ Add source</span>
              </button>
            </div>
          </div>
        )}

        {/* Settings View */}
        {currentSection === 'settings' && (
          <div className="overview-page" style={{ paddingBottom: '96px' }}>
            <div className="overview-hero">
              <span className="overview-hero-label">Preferences</span>
              <h1 className="overview-hero-title" style={{ fontSize: '36px' }}>Settings</h1>
              <p className="overview-hero-desc">
                Knowledge graph preferences and keyboard shortcuts.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
              <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--text-primary)' }}>Concept extraction sensitivity</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Semantic confidence threshold for automatic node creation</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>0.85</span>
              </div>

              <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--text-primary)' }}>Default graph layout</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Force-directed hierarchical knowledge arrangement</div>
                </div>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Hierarchical</span>
              </div>

              <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--text-primary)' }}>Keyboard shortcuts</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Global hotkeys for navigation</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: '2px 6px', borderRadius: '4px' }}>⌘K Search</kbd>
                  <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: '2px 6px', borderRadius: '4px' }}>⌘, Settings</kbd>
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
    </>
  );
}

export default App;
