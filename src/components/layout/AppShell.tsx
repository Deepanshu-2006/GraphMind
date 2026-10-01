import React, { useState } from 'react';
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
  recentMaterials,
  onOpenSearch,
  onOpenCreateModal,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div 
          className="modal-backdrop" 
          style={{ zIndex: 35 }}
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Main Sidebar */}
      <Sidebar 
        currentSection={currentSection}
        onSelectSection={onSelectSection}
        project={project}
        recentMaterials={recentMaterials}
        isOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenCreateModal={onOpenCreateModal}
      />

      {/* Main Content Area */}
      <div className="app-main">
        <TopBar 
          currentSection={currentSection}
          project={project}
          onOpenSearch={onOpenSearch}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
          onOpenCreateModal={onOpenCreateModal}
        />
        
        <main className="workspace-viewport">
          {children}
        </main>
      </div>
    </div>
  );
};
