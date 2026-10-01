import React from 'react';
import { Search, Menu, UploadCloud } from 'lucide-react';
import type { ProjectWorkspace } from '../../types';

interface TopBarProps {
  project: ProjectWorkspace;
  onOpenSearch: () => void;
  onToggleMobileMenu: () => void;
  onOpenCreateModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  onOpenSearch,
  onToggleMobileMenu,
  onOpenCreateModal
}) => {
  return (
    <header className="app-topbar">
      {/* Left: Clean Breadcrumb */}
      <div className="topbar-left">
        <button 
          className="mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <Menu size={16} />
        </button>

        <div className="topbar-breadcrumbs">
          <span className="breadcrumb-root">GraphMind</span>
          <span className="breadcrumb-slash">/</span>
          <span className="breadcrumb-project">{project.name}</span>
        </div>
      </div>

      {/* Right: Search, + New graph, Profile */}
      <div className="topbar-right">
        {/* Search trigger */}
        <button 
          className="topbar-search-trigger"
          onClick={onOpenSearch}
          aria-label="Search concepts"
        >
          <Search size={14} className="topbar-search-icon" />
          <span>Search</span>
          <kbd className="search-kbd">⌘K</kbd>
        </button>

        {/* Primary Action Button: Upload material (Section 1) */}
        <button 
          className="btn-primary" 
          onClick={onOpenCreateModal}
          style={{ padding: '6px 12px', fontSize: '13px' }}
          title="Upload learning material"
        >
          <UploadCloud size={14} />
          <span>Upload material</span>
        </button>

        {/* Profile Avatar */}
        <div className="profile-badge" title="Profile">
          <span className="profile-initials">DK</span>
        </div>
      </div>
    </header>
  );
};
