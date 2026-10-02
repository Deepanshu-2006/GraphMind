import React from 'react';
import { Search, Menu, UploadCloud } from 'lucide-react';
import type { ProjectWorkspace } from '../../types';

interface TopBarProps {
  project: ProjectWorkspace;
  onOpenSearch: () => void;
  onToggleMobileMenu: () => void;
  onOpenCreateModal: () => void;
  isMobileMenuOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  onOpenSearch,
  onToggleMobileMenu,
  onOpenCreateModal,
  isMobileMenuOpen = false
}) => {
  return (
    <header className="app-topbar" role="banner">
      {/* Left: Mobile Drawer Trigger + Project Context (No redundant GraphMind /) */}
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

        <div className="topbar-context" title={project.name}>
          {project.name}
        </div>
      </div>

      {/* Right: Search, Upload Material shortcut, User Avatar */}
      <div className="topbar-right">
        {/* Search trigger: compact, subtle command control */}
        <button 
          type="button"
          className="topbar-search-trigger"
          onClick={onOpenSearch}
          aria-label="Search concepts (⌘K)"
          title="Search concepts (⌘K)"
        >
          <Search size={14} strokeWidth={1.5} className="topbar-search-icon" aria-hidden="true" />
          <span className="topbar-search-text">Search concepts</span>
          <kbd className="search-kbd" aria-hidden="true">⌘K</kbd>
        </button>

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
