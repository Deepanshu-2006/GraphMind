import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { LearningPath } from '../../types';

interface LearningPathsViewProps {
  paths: LearningPath[];
  onSelectPath: (pathId: string) => void;
}

export const LearningPathsView: React.FC<LearningPathsViewProps> = ({
  paths,
  onSelectPath
}) => {
  return (
    <div className="page-container">
      {/* Standardized Editorial Header */}
      <header className="page-header">
        <div className="page-header-left">
          <span className="page-kicker">Curriculum</span>
          <h1 className="page-title">Learning paths</h1>
          <p className="page-subtitle">
            Generated from the relationships in your knowledge graph.
          </p>
        </div>
      </header>

      {/* Editorial List or Clean Empty State */}
      {paths.length > 0 ? (
        <div className="editorial-list" role="list">
          {paths.map((path) => (
            <div key={path.id} className="editorial-row" role="listitem">
              <div className="editorial-row-info">
                <div className="editorial-row-title">
                  <span>{path.title.replace('to', '→')}</span>
                </div>
                <div className="editorial-row-meta">
                  <span>{path.nodeCount} concepts</span>
                  <span className="source-meta-separator">·</span>
                  <span>{path.estimatedHours}</span>
                  {path.progress > 0 && (
                    <>
                      <span className="source-meta-separator">·</span>
                      <span>{path.progress}% complete</span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '7px 14px', fontSize: '13px' }}
                onClick={() => onSelectPath(path.id)}
                aria-label={`${path.progress > 0 ? 'Continue' : 'Start'} learning path: ${path.title}`}
                title={`Explore ${path.title}`}
              >
                <span>{path.progress > 0 ? 'Continue' : 'Start'}</span>
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="sources-empty-state">
          <div className="sources-empty-card">
            <h2 className="sources-empty-title">
              No learning paths generated yet.
            </h2>
            <p className="sources-empty-desc">
              Upload your material and GraphMind will construct structured paths through your concepts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
