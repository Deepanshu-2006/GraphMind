import React from 'react';
import { 
  Compass, 
  Network, 
  GitFork, 
  Files, 
  Settings
} from 'lucide-react';
import type { NavSection, ProjectWorkspace } from '../../types';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  project: ProjectWorkspace;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  project,
  isOpen,
  onCloseMobile
}) => {
  const mainNavItems = [
    { id: 'overview' as NavSection, label: 'Overview', icon: Compass },
    { id: 'graph' as NavSection, label: 'Knowledge Graph', icon: Network },
    { id: 'paths' as NavSection, label: 'Learning Paths', icon: GitFork },
    { id: 'sources' as NavSection, label: 'Sources', icon: Files }
  ];

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand */}
      <div className="sidebar-header">
        <span className="brand-title">GraphMind</span>
      </div>

      {/* Navigation Body */}
      <div className="sidebar-content">
        {/* Workspace */}
        <div className="sidebar-group">
          <div className="sidebar-group-title">Workspace</div>
          <nav className="sidebar-nav-list">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;
              return (
                <button
                  key={item.id}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectSection(item.id);
                    onCloseMobile();
                  }}
                >
                  <Icon className="nav-icon" size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-divider" />

        {/* Current Project */}
        <div className="sidebar-group">
          <div className="sidebar-group-title">Current Project</div>
          <div className="sidebar-project-item">
            <span className="sidebar-project-name">{project.name}</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* Settings */}
        <div className="sidebar-group" style={{ marginTop: 'auto' }}>
          <button
            className={`sidebar-nav-item ${currentSection === 'settings' ? 'active' : ''}`}
            onClick={() => {
              onSelectSection('settings');
              onCloseMobile();
            }}
          >
            <Settings className="nav-icon" size={16} />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
