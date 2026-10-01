import React, { useState } from 'react';
import { Plus, Eye, Sparkles } from 'lucide-react';
import type { RecentMaterial } from '../../types';

interface SourcesViewProps {
  sources: RecentMaterial[];
  onAddSource: () => void;
}

export const SourcesView: React.FC<SourcesViewProps> = ({
  sources,
  onAddSource
}) => {
  // Support toggling between populated and empty states for testing and inspection
  const [showEmptyPreview, setShowEmptyPreview] = useState<boolean>(false);

  const activeSources = showEmptyPreview ? [] : sources;

  const renderStatus = (status: string) => {
    const norm = status.toLowerCase();

    if (norm === 'ready' || norm === 'synced' || norm === 'indexed') {
      return (
        <span className="source-status-badge status-ready">
          <span className="source-status-pip ready" />
          <span>Indexed</span>
        </span>
      );
    }

    if (norm === 'processing' || norm === 'indexing') {
      return (
        <span className="source-status-badge status-processing">
          <span className="source-status-spinner" />
          <span>Processing</span>
        </span>
      );
    }

    if (norm === 'failed') {
      return (
        <span className="source-status-badge status-failed">
          <span className="source-status-pip failed" />
          <span>Failed</span>
        </span>
      );
    }

    return (
      <span className="source-status-badge status-ready">
        <span className="source-status-pip ready" />
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="sources-page-container">
      {/* Editorial Header */}
      <header className="sources-page-header">
        <div className="sources-header-left">
          <span className="sources-kicker">Library</span>
          <h1 className="sources-title">Sources</h1>
          <p className="sources-subtitle">
            Learning material added to GraphMind.
          </p>
        </div>

        <div className="sources-header-actions">
          {/* Subtle state toggle for previewing both empty and populated states */}
          <button
            type="button"
            className="sources-preview-toggle"
            onClick={() => setShowEmptyPreview((prev) => !prev)}
            title="Toggle between populated list and empty state"
          >
            {showEmptyPreview ? (
              <>
                <Sparkles size={12} />
                <span>Show sources ({sources.length})</span>
              </>
            ) : (
              <>
                <Eye size={12} />
                <span>Preview empty state</span>
              </>
            )}
          </button>

          {/* Primary Action Button */}
          <button
            type="button"
            className="btn-primary"
            onClick={onAddSource}
            id="btn-sources-add-source"
            title="Add learning material"
          >
            <Plus size={14} />
            <span>Add source</span>
          </button>
        </div>
      </header>

      {/* Main Content: Editorial List or Clean Empty State */}
      {activeSources.length > 0 ? (
        <div className="sources-list" role="list">
          {activeSources.map((source) => {
            const isProcessing =
              source.status.toLowerCase() === 'processing' ||
              source.status.toLowerCase() === 'indexing';

            return (
              <div key={source.id} className="source-row" role="listitem">
                {/* Left Column: Format Tag + Name + Metadata */}
                <div className="source-info-col">
                  <div className="source-title-row">
                    <span className="source-format-tag" aria-label={`Format: ${source.format}`}>
                      {source.format}
                    </span>
                    <span className="source-filename" title={source.title}>
                      {source.title}
                    </span>
                  </div>

                  <div className="source-meta-row">
                    <span>{source.size}</span>
                    <span className="source-meta-separator">·</span>
                    <span>
                      {source.timestamp.startsWith('Added')
                        ? source.timestamp
                        : `Added ${source.timestamp}`}
                    </span>
                  </div>
                </div>

                {/* Right Column: Concept Count + Processing State */}
                <div className="source-state-col">
                  <div className="source-concept-stat">
                    {isProcessing ? (
                      <span className="source-concept-pending">Extracting concepts...</span>
                    ) : source.conceptsExtracted !== undefined ? (
                      <span>{source.conceptsExtracted} concepts</span>
                    ) : (
                      <span className="source-concept-pending">—</span>
                    )}
                  </div>

                  <div className="source-status-wrap">
                    {renderStatus(source.status)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State (Prompt 7, Section 7) */
        <div className="sources-empty-state">
          <div className="sources-empty-card">
            <h2 className="sources-empty-title">
              Your knowledge graph starts with your material.
            </h2>
            <p className="sources-empty-desc">
              Upload a paper, lecture, note, or transcript to begin.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={onAddSource}
              id="btn-sources-empty-add"
            >
              <Plus size={14} />
              <span>Add source</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
