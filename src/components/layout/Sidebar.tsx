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
  isOpen: boolean;
  onCloseMobile: () => void;
  project?: ProjectWorkspace;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  isOpen,
  onCloseMobile,
  project
}) => {
  const mainNavItems = [
    { id: 'overview' as NavSection, label: 'Overview', icon: Compass },
    { id: 'graph' as NavSection, label: 'Knowledge Graph', icon: Network },
    { id: 'paths' as NavSection, label: 'Learning Paths', icon: GitFork },
    { id: 'sources' as NavSection, label: 'Sources', icon: Files }
  ];

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} aria-label="Application sidebar">
      {/* Brand: Pure typographic wordmark without icon containers */}
      <div className="sidebar-header">
        <button
          type="button"
          className="brand-wordmark"
          onClick={() => {
            onSelectSection('overview');
            onCloseMobile();
          }}
          title="GraphMind Overview"
          aria-label="GraphMind Overview"
        >
          GraphMind
        </button>
      </div>

      {/* Primary Navigation Body: 52px breathing room below brand */}
      <div className="sidebar-content">
        <nav className="sidebar-nav-list" aria-label="Main Navigation">
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
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-indicator-line" aria-hidden="true" />
                <Icon className="nav-icon" size={15} strokeWidth={1.5} />
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Lower Sidebar: Contextual Current Graph + Settings */}
        <div className="sidebar-lower">
          {project && (
            <div className="sidebar-context-section">
              <span className="sidebar-context-kicker">Current Graph</span>
              <span className="sidebar-context-title" title={project.name}>
                {project.name}
              </span>
            </div>
          )}

          <div className="sidebar-footer">
            <button
              type="button"
              className={`sidebar-nav-item ${currentSection === 'settings' ? 'active' : ''}`}
              onClick={() => {
                onSelectSection('settings');
                onCloseMobile();
              }}
              aria-current={currentSection === 'settings' ? 'page' : undefined}
            >
              <span className="nav-indicator-line" aria-hidden="true" />
              <Settings className="nav-icon" size={15} strokeWidth={1.5} />
              <span className="nav-label">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
