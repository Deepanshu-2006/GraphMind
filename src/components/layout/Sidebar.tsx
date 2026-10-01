import React from 'react';
import { 
  Compass, 
  Network, 
  GitFork, 
  Files
} from 'lucide-react';
import type { NavSection } from '../../types';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
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
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} aria-label="Sidebar navigation">
      {/* Brand */}
      <div className="sidebar-header">
        <span className="brand-title">GraphMind</span>
      </div>

      {/* Primary Navigation Body */}
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
                <Icon className="nav-icon" size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
