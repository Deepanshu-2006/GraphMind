import React from 'react';
import { 
  Search, 
  Menu, 
  Bell, 
  Share2, 
  Layers, 
  Sparkles,
  ChevronDown
} from 'lucide-react';
import type { NavSection, ProjectWorkspace } from '../../types';

interface TopBarProps {
  currentSection: NavSection;
  project: ProjectWorkspace;
  onOpenSearch: () => void;
  onToggleMobileMenu: () => void;
  onOpenCreateModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentSection,
  project,
  onOpenSearch,
  onToggleMobileMenu,
  onOpenCreateModal
}) => {
  const getSectionTitle = (section: NavSection) => {
    switch (section) {
      case 'overview': return 'Overview';
      case 'graph': return 'Knowledge Graph';
      case 'paths': return 'Learning Paths';
      case 'sources': return 'Sources';
      case 'settings': return 'System Settings';
    }
  };

  return (
    <header className="app-topbar">
      {/* Topbar Left: Mobile Toggle & Breadcrumbs */}
      <div className="topbar-left">
        <button 
          className="mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label="Toggle Navigation Menu"
        >
          <Menu size={18} />
        </button>

        <div className="breadcrumb-nav">
          <span className="breadcrumb-root">GraphMind</span>
          <span className="breadcrumb-separator">/</span>
          <button className="workspace-selector-btn" title="Switch Workspace">
            <Layers size={13} style={{ color: 'var(--accent-cyan)' }} />
            <span>{project.name}</span>
            <ChevronDown size={12} style={{ opacity: 0.6 }} />
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{getSectionTitle(currentSection)}</span>
        </div>
      </div>

      {/* Topbar Center: Search trigger with shortcut badge */}
      <div className="topbar-center">
        <button 
          className="topbar-search-trigger"
          onClick={onOpenSearch}
          aria-label="Search Concepts and Relationships"
        >
          <Search size={14} />
          <span>Search concepts, papers, relationships...</span>
          <div className="search-shortcut">
            <span>⌘</span>
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Topbar Right: Status, Action Button, Notification & Profile */}
      <div className="topbar-right">
        {/* Status indicator */}
        <div className="status-pill" title="Live Synapse Topology Active">
          <span className="status-pill-dot" />
          <span>Synapse Live</span>
        </div>

        {/* Quick Ingest Button */}
        <button 
          className="btn-primary" 
          onClick={onOpenCreateModal}
          style={{ padding: '7px 14px', fontSize: '12.5px' }}
        >
          <Sparkles size={13} />
          <span>New Graph</span>
        </button>

        {/* Notification indicator */}
        <button 
          className="topbar-action-btn"
          title="Telemetry Notifications"
          aria-label="Telemetry Notifications"
        >
          <Bell size={15} />
        </button>

        {/* Share/Export button */}
        <button 
          className="topbar-action-btn"
          title="Export Graph Topology"
          aria-label="Export Graph Topology"
        >
          <Share2 size={15} />
        </button>

        {/* Profile / Avatar Area */}
        <div className="profile-chip" title="Active Researcher: Deepanshu K. (AI Lab)">
          <div className="profile-avatar">DK</div>
          <span className="profile-name">AI Lab</span>
        </div>
      </div>
    </header>
  );
};
