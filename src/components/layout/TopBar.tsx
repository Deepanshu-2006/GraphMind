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
      {/* Left: Clean Breadcrumb & Mobile Drawer Trigger */}
      <div className="topbar-left">
        <button 
          type="button"
          className="mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMobileMenuOpen}
        >
          <Menu size={16} aria-hidden="true" />
        </button>

        <nav className="topbar-breadcrumbs" aria-label="Breadcrumbs">
          <span className="breadcrumb-root">GraphMind</span>
          <span className="breadcrumb-slash" aria-hidden="true">/</span>
          <span className="breadcrumb-project" title={project.name}>{project.name}</span>
        </nav>
      </div>

      {/* Right: Search, Add Material, Profile */}
      <div className="topbar-right">
        {/* Search trigger */}
        <button 
          type="button"
          className="topbar-search-trigger"
          onClick={onOpenSearch}
          aria-label="Search concepts (⌘K)"
          title="Search concepts (⌘K)"
        >
          <Search size={14} className="topbar-search-icon" aria-hidden="true" />
          <span className="topbar-search-text">Search concepts</span>
          <kbd className="search-kbd" aria-hidden="true">⌘K</kbd>
        </button>

        {/* Primary Action Button: Add material */}
        <button 
          type="button"
          className="btn-primary topbar-action-btn" 
          onClick={onOpenCreateModal}
          title="Add learning material"
          aria-label="Add learning material"
          id="btn-topbar-add-material"
        >
          <UploadCloud size={14} aria-hidden="true" />
          <span className="topbar-btn-text-full">Add material</span>
          <span className="topbar-btn-text-short">Add</span>
        </button>

        {/* Profile Avatar */}
        <div 
          className="profile-badge" 
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
