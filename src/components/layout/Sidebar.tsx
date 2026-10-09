import React from 'react';
import { 
  Compass, 
  Network, 
  BookOpen, 
  Files,
  Settings
} from 'lucide-react';
import { GraphMindLogo } from '../common/GraphMindLogo';
import type { NavSection, ProjectWorkspace } from '../../types';
import type { KnowledgeGraphMeta } from '../../types/knowledgeGraph';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  project?: ProjectWorkspace;
  activeGraphMeta?: KnowledgeGraphMeta | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  isOpen,
  onCloseMobile,
  project,
  activeGraphMeta
}) => {
  const mainNavItems = [
    { id: 'overview' as NavSection, label: 'Overview', icon: Compass },
    { id: 'graph' as NavSection, label: 'Knowledge Graph', icon: Network },
    { id: 'study' as NavSection, label: 'Study Space', icon: BookOpen },
    { id: 'sources' as NavSection, label: 'Sources', icon: Files }
  ];

  const currentGraphName = activeGraphMeta?.name || project?.name || 'Knowledge Graph';

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} aria-label="Application sidebar">
      {/* Brand: Compact horizontal brand lockup with canonical logo mark and wordmark */}
      <div className="sidebar-header">
        <button
          type="button"
          className="brand-lockup"
          onClick={() => {
            onSelectSection('overview');
            onCloseMobile();
          }}
          title="GraphMind Overview"
          aria-label="GraphMind Overview"
        >
          <GraphMindLogo className="brand-logo" size={20} />
          <span className="brand-wordmark">GraphMind</span>
        </button>
      </div>

      {/* Primary Navigation Body: 56px breathing room below brand */}
      <div className="sidebar-content">
        <nav className="sidebar-nav-list" aria-label="Main Navigation">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id || (item.id === 'study' && currentSection === 'paths');
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-active-dot" aria-hidden="true" />
                <Icon className="nav-icon" size={15} strokeWidth={1.5} />
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Lower Sidebar: Contextual Current Graph + Secondary Settings */}
        <div className="sidebar-lower">
          {currentGraphName && (
            <div className="sidebar-context-section">
              <span className="sidebar-context-kicker">CURRENT GRAPH</span>
              <span className="sidebar-context-title" title={currentGraphName}>
                {currentGraphName}
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
              <span className="nav-active-dot" aria-hidden="true" />
              <Settings className="nav-icon" size={15} strokeWidth={1.5} />
              <span className="nav-label">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
