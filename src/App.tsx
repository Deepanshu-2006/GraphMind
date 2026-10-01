import { useState, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { OverviewView } from './components/overview/OverviewView';
import { KnowledgeGraphWorkspace } from './components/graph/KnowledgeGraphWorkspace';
import type { WorkspaceMode } from './components/graph/KnowledgeGraphWorkspace';
import { CreateGraphModal } from './components/modals/CreateGraphModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { SourcesView } from './components/sources/SourcesView';
import { LearningPathsView } from './components/paths/LearningPathsView';
import { 
  mockProjectWorkspace, 
  mockRecentMaterials, 
  mockConnectedConcepts, 
  mockLearningPaths 
} from './data/mockData';
import type { NavSection, RecentMaterial } from './types';

export function App() {
  const getInitialSection = (): NavSection => {
    const path = window.location.pathname.replace(/^\//, '');
    if (path === 'overview') return 'overview';
    if (path === 'paths') return 'paths';
    if (path === 'sources') return 'sources';
    if (path === 'settings') return 'settings';
    return 'graph';
  };

  const [currentSection, setCurrentSection] = useState<NavSection>(getInitialSection);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchPaletteOpen, setSearchPaletteOpen] = useState(false);
  const [hasGraphContent, setHasGraphContent] = useState(true);
  const [sources, setSources] = useState<RecentMaterial[]>(mockRecentMaterials);
  const [graphMode, setGraphMode] = useState<WorkspaceMode>('interactive');

  const navigateToSection = (section: NavSection) => {
    setCurrentSection(section);
    const targetPath = section === 'graph' ? '/graph' : section === 'overview' ? '/overview' : `/${section}`;
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
    setSources((prev) => [
      {
        id: `rm-${Date.now()}`,
        title: 'Stanford_CS229_Lecture_04.pdf',
        format: 'PDF',
        size: '2.4 MB',
        conceptsExtracted: 36,
        timestamp: 'Added just now',
        status: 'Indexed'
      },
      ...prev
    ]);
    setGraphMode('loading');
    navigateToSection('graph');
  };

  return (
    <>
      <AppShell
        currentSection={currentSection}
        onSelectSection={navigateToSection}
        project={mockProjectWorkspace}
        recentMaterials={sources}
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
          />
        )}

        {/* Dedicated Knowledge Graph Workspace (/graph) */}
        {currentSection === 'graph' && (
          <KnowledgeGraphWorkspace 
            onOpenUpload={() => setCreateModalOpen(true)} 
            initialMode={graphMode}
          />
        )}

        {/* Learning Paths View */}
        {currentSection === 'paths' && (
          <LearningPathsView 
            paths={mockLearningPaths}
            onSelectPath={() => navigateToSection('graph')}
          />
        )}

        {/* Sources View (Prompt 7) */}
        {currentSection === 'sources' && (
          <SourcesView
            sources={sources}
            onAddSource={() => setCreateModalOpen(true)}
          />
        )}

        {/* Settings View (Accessible via ⌘,) */}
        {currentSection === 'settings' && (
          <div className="page-container">
            <header className="page-header">
              <div className="page-header-left">
                <span className="page-kicker">Preferences</span>
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">
                  Knowledge graph preferences and keyboard shortcuts.
                </p>
              </div>
            </header>

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
