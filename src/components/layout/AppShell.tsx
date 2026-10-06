import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import type { NavSection, ProjectWorkspace, RecentMaterial } from '../../types';
import type { KnowledgeGraph, KnowledgeGraphMeta } from '../../types/knowledgeGraph';

interface AppShellProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  project: ProjectWorkspace;
  recentMaterials: RecentMaterial[];
  graphs?: KnowledgeGraphMeta[];
  activeGraphId?: string | null;
  activeGraphMeta?: KnowledgeGraphMeta | null;
  activeGraph?: KnowledgeGraph | null;
  onSelectGraph?: (graphId: string) => void;
  onOpenNewGraphModal?: () => void;
  onRenameGraph?: (graphId: string, newName: string) => void;
  onOpenSearch?: () => void;
  onSelectConcept?: (conceptId: string) => void;
  onOpenCreateModal: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentSection,
  onSelectSection,
  project,
  graphs = [],
  activeGraphId = null,
  activeGraphMeta = null,
  activeGraph = null,
  onSelectGraph = () => {},
  onOpenNewGraphModal = () => {},
  onRenameGraph,
  onOpenSearch,
  onSelectConcept,
  onOpenCreateModal,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="app-shell">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div 
          className="modal-backdrop mobile-drawer-backdrop" 
          style={{ zIndex: 45 }}
          onClick={() => setMobileMenuOpen(false)} 
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <Sidebar 
        currentSection={currentSection}
        onSelectSection={onSelectSection}
        isOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        project={project}
        activeGraphMeta={activeGraphMeta}
      />

      {/* Main Content Area */}
      <div className="app-main">
        <TopBar 
          project={project}
          graphs={graphs}
          activeGraphId={activeGraphId}
          activeGraphMeta={activeGraphMeta}
          activeGraph={activeGraph}
          onSelectGraph={onSelectGraph}
          onOpenNewGraphModal={onOpenNewGraphModal}
          onRenameGraph={onRenameGraph}
          onOpenSearch={onOpenSearch}
          onSelectConcept={onSelectConcept}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
          onOpenCreateModal={onOpenCreateModal}
          isMobileMenuOpen={mobileMenuOpen}
        />
        
        <main className="workspace-viewport" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
};
