import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import type { NavSection, ProjectWorkspace, RecentMaterial } from '../../types';

interface AppShellProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  project: ProjectWorkspace;
  recentMaterials: RecentMaterial[];
  onOpenSearch: () => void;
  onOpenCreateModal: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentSection,
  onSelectSection,
  project,
  onOpenSearch,
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
      />

      {/* Main Content Area */}
      <div className="app-main">
        <TopBar 
          project={project}
          onOpenSearch={onOpenSearch}
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
