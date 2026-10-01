import React from 'react';
import { 
  Compass, 
  Network, 
  GitFork, 
  Files, 
  Settings, 
  ChevronRight, 
  Cpu
} from 'lucide-react';
import type { NavSection, ProjectWorkspace, RecentMaterial } from '../../types';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  project: ProjectWorkspace;
  recentMaterials: RecentMaterial[];
  isOpen: boolean;
  onCloseMobile: () => void;
  onOpenCreateModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  project,
  recentMaterials,
  isOpen,
  onCloseMobile,
  onOpenCreateModal
}) => {
  const mainNavItems = [
    { id: 'overview' as NavSection, label: 'Overview', icon: Compass, tag: 'Active' },
    { id: 'graph' as NavSection, label: 'Knowledge Graph', icon: Network, tag: '418 Nodes' },
    { id: 'paths' as NavSection, label: 'Learning Paths', icon: GitFork, tag: '6 Tracks' },
    { id: 'sources' as NavSection, label: 'Sources', icon: Files, tag: '24 Docs' }
  ];

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Sidebar Header / Branding */}
      <div className="sidebar-header">
        <div className="brand-wrapper">
          <div className="brand-glyph">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <circle cx="19" cy="5" r="2" />
              <circle cx="5" cy="19" r="2" />
              <circle cx="18" cy="19" r="2" />
              <circle cx="6" cy="5" r="2" />
              <path d="M10 10.5 7 6.5" />
              <path d="m14 10.5 3.5-4" />
              <path d="m10 13.5-3.5 4" />
              <path d="m14 13.5 3 4" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-title">GraphMind</span>
            <span className="brand-subtitle">Visual Synapse OS</span>
          </div>
        </div>
        <span className="brand-badge">v1.0</span>
      </div>

      {/* Scrollable Navigation Body */}
      <div className="sidebar-content">
        {/* Workspace Main Navigation */}
        <div className="sidebar-group">
          <div className="sidebar-group-title">
            <span>Workspace</span>
          </div>
          <ul className="sidebar-nav-list">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onSelectSection(item.id);
                      onCloseMobile();
                    }}
                  >
                    <Icon className="nav-icon" />
                    <span>{item.label}</span>
                    {item.tag && <span className="nav-tag">{item.tag}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Current Project Workspace Section */}
        <div className="sidebar-group">
          <div className="sidebar-group-title">
            <span>Current Project</span>
            <span className="mono" style={{ fontSize: '9px', opacity: 0.7 }}>SYNCED</span>
          </div>
          <div className="sidebar-project-card">
            <div className="project-card-header">
              <span className="project-pill">
                <span className="project-pill-dot" />
                {project.code}
              </span>
              <Cpu size={13} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="project-name">{project.name}</div>
            <div className="project-meta-row">
              <span>{project.activeNodes} Nodes</span>
              <span>{project.density}</span>
            </div>
          </div>
        </div>

        {/* Recent Materials Section */}
        <div className="sidebar-group">
          <div className="sidebar-group-title">
            <span>Recent Materials</span>
            <button 
              onClick={onOpenCreateModal}
              title="Add Material"
              style={{ color: 'var(--accent-cyan)', fontSize: '11px', display: 'flex', alignItems: 'center' }}
            >
              + Ingest
            </button>
          </div>
          <div className="recent-materials-list">
            {recentMaterials.map((mat) => (
              <div 
                key={mat.id} 
                className="material-item"
                onClick={onOpenCreateModal}
                title={`Extracted ${mat.conceptsExtracted} concepts from ${mat.title}`}
              >
                <span className="material-badge">{mat.format}</span>
                <div className="material-details">
                  <span className="material-title">{mat.title}</span>
                  <span className="material-meta">
                    {mat.conceptsExtracted} concepts • {mat.timestamp}
                  </span>
                </div>
                <ChevronRight size={13} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar Footer with Settings & Telemetry Status */}
      <div className="sidebar-footer">
        <div className="system-telemetry">
          <div className="telemetry-indicator">
            <span className="pulse-dot" />
            <span>Synapse Engine Active</span>
          </div>
          <span>3.06x</span>
        </div>

        <button
          className={`sidebar-nav-item ${currentSection === 'settings' ? 'active' : ''}`}
          onClick={() => {
            onSelectSection('settings');
            onCloseMobile();
          }}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          <Settings className="nav-icon" />
          <span>Settings</span>
          <span className="mono" style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>⌘,</span>
        </button>
      </div>
    </aside>
  );
};
