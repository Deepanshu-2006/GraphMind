import React from 'react';
import { Menu, UploadCloud } from 'lucide-react';
import type { ProjectWorkspace } from '../../types';
import type { KnowledgeGraph, KnowledgeGraphMeta } from '../../types/knowledgeGraph';
import { GraphSwitcher } from './GraphSwitcher';
import { HeaderSearch } from './HeaderSearch';

interface TopBarProps {
  project: ProjectWorkspace;
  graphs?: KnowledgeGraphMeta[];
  activeGraphId?: string | null;
  activeGraphMeta?: KnowledgeGraphMeta | null;
  activeGraph?: KnowledgeGraph | null;
  onSelectGraph?: (graphId: string) => void;
  onOpenNewGraphModal?: () => void;
  onRenameGraph?: (graphId: string, newName: string) => void;
  onOpenSearch?: () => void;
  onSelectConcept?: (conceptId: string) => void;
  onToggleMobileMenu: () => void;
  onOpenCreateModal: () => void;
  isMobileMenuOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  graphs = [],
  activeGraphId = null,
  activeGraphMeta = null,
  activeGraph = null,
  onSelectGraph = () => {},
  onOpenNewGraphModal = () => {},
  onRenameGraph,
  onSelectConcept,
  onToggleMobileMenu,
  onOpenCreateModal,
  isMobileMenuOpen = false
}) => {
  return (
    <header className="app-topbar" role="banner">
      {/* Left: Mobile Drawer Trigger + Native Quiet Graph Switcher */}
      <div className="topbar-left">
        <button 
          type="button"
          className="mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMobileMenuOpen}
        >
          <Menu size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>

        {graphs.length > 0 ? (
          <GraphSwitcher
            graphs={graphs}
            activeGraphId={activeGraphId}
            activeGraphMeta={activeGraphMeta}
            onSelectGraph={onSelectGraph}
            onOpenNewGraph={onOpenNewGraphModal}
            onRenameGraph={onRenameGraph}
          />
        ) : (
          <div className="topbar-context" title={project.name}>
            {project.name}
          </div>
        )}
      </div>

      {/* Right: Search, Upload Material shortcut, User Avatar */}
      <div className="topbar-right">
        {/* Redesigned editorial knowledge navigation search instrument */}
        <HeaderSearch
          activeGraph={activeGraph}
          onSelectConcept={onSelectConcept}
        />

        {/* Upload Material: Quiet contextual shortcut */}
        <button 
          type="button" 
          className="topbar-upload-btn" 
          onClick={onOpenCreateModal}
          title="Upload material"
          aria-label="Upload material"
          id="btn-topbar-add-material"
        >
          <UploadCloud size={14} strokeWidth={1.5} aria-hidden="true" />
          <span className="topbar-btn-text-full">Upload material</span>
          <span className="topbar-btn-text-short">Upload</span>
        </button>

        {/* Profile Avatar: Quiet 30px circular surface */}
        <div 
          className="profile-avatar" 
          title="Profile (DK)" 
          role="button" 
          tabIndex={0} 
          aria-label="User profile"
        >
          <span className="profile-initials">DK</span>
        </div>
      </div>
    </header>
  );
};
