import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight, ArrowLeft } from 'lucide-react';
import type { GraphConceptData, SelectedRelationshipData } from '../../types/graph';

export interface NodeContextPanelProps {
  concept: GraphConceptData | null;
  selectedRelationship?: SelectedRelationshipData | null;
  previousConceptName?: string | null;
  onGoBack?: () => void;
  onClose: () => void;
  onSelectConcept: (conceptId: string) => void;
  onFocusNode?: (conceptId: string) => void;
  onSelectSource?: (sourceNameOrId?: string, page?: number) => void;
  isCollapsed?: boolean;
}

/**
 * Cleans an excerpt of raw markdown artifacts and extracts 2–3 sentences.
 */
function cleanExcerpt(raw: string): string {
  if (!raw) return '';
  // Strip Markdown headings (# Title)
  let cleaned = raw.replace(/^#+\s+[^\n]+\n*/gm, '').trim();
  // Strip bullet markers at start of lines
  cleaned = cleaned.replace(/^[-*•]\s+/gm, '').trim();
  // Remove markdown formatting like **bold**
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');

  // Split into sentences (prefer 2-3 sentences max)
  const sentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentences && sentences.length > 0) {
    return sentences.slice(0, 3).join('').trim();
  }
  return cleaned.slice(0, 260).trim();
}

/**
 * Derives a source-grounded passage from available concept evidence.
 */
function getGroundedPassage(concept: GraphConceptData): {
  text: string;
  sourceName: string;
  page?: number;
} | null {
  // 1. Check evidenceItems
  if (concept.evidenceItems && concept.evidenceItems.length > 0) {
    const item = concept.evidenceItems[0];
    if (item.text && item.text.trim()) {
      const clean = cleanExcerpt(item.text);
      if (clean) {
        return {
          text: clean,
          sourceName: concept.sources?.[0]?.name || concept.source || 'Uploaded Material',
          page: item.page ?? concept.page
        };
      }
    }
  }

  // 2. Check evidence text
  if (concept.evidence && concept.evidence.trim()) {
    const clean = cleanExcerpt(concept.evidence);
    if (clean) {
      return {
        text: clean,
        sourceName: concept.sources?.[0]?.name || concept.source || 'Uploaded Material',
        page: concept.page ?? concept.sources?.[0]?.page
      };
    }
  }

  return null;
}

/**
 * Derives the concept explanation strictly grounded in source material.
 */
function getConceptExplanation(concept: GraphConceptData): string {
  if (concept.description && concept.description.trim()) {
    return concept.description.trim();
  }

  const passage = getGroundedPassage(concept);
  if (passage && passage.text) {
    const sentences = passage.text.match(/[^.!?]+[.!?]+(\s|$)/g);
    if (sentences && sentences.length > 0) {
      return sentences.slice(0, 2).join('').trim();
    }
    return passage.text;
  }

  return "GraphMind couldn't find enough source material to explain this concept.";
}

/**
 * Derives key ideas bullet points without empty placeholders.
 */
function getKeyIdeas(concept: GraphConceptData): string[] {
  if (concept.keyIdeas && concept.keyIdeas.length > 0) {
    return concept.keyIdeas.filter(Boolean);
  }

  // Derive from prerequisites if present
  if (concept.prerequisites && concept.prerequisites.length > 0) {
    return concept.prerequisites.slice(0, 4);
  }

  return [];
}

export const NodeContextPanel: React.FC<NodeContextPanelProps> = ({
  concept,
  selectedRelationship,
  previousConceptName,
  onGoBack,
  onClose,
  onSelectConcept,
  onSelectSource,
  isCollapsed = false
}) => {
  if (isCollapsed || (!concept && !selectedRelationship)) {
    return null;
  }

  // 1. Relationship Source Traceability View
  if (selectedRelationship) {
    const hasMultipleSources = selectedRelationship.sourceNames && selectedRelationship.sourceNames.length > 1;

    return (
      <motion.aside
        className="floating-node-inspector study-panel"
        aria-label="Relationship details"
        initial={{ opacity: 0, x: 26 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 26 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="inspector-drag-handle" aria-hidden="true" />

        <div className="inspector-header">
          <div className="inspector-title-wrap">
            <span className="inspector-category">Relationship</span>
            <h2 className="inspector-name" style={{ fontSize: '15px' }}>
              {selectedRelationship.sourceName} <span style={{ color: 'var(--accent)' }}>→</span> {selectedRelationship.targetName}
            </h2>
          </div>
          <button
            type="button"
            className="inspector-close-btn"
            onClick={onClose}
            aria-label="Close relationship details"
            title="Close panel"
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ marginTop: '2px', marginBottom: '8px' }}>
          <span
            className="edge-semantic-badge active"
            style={{ position: 'static', transform: 'none', display: 'inline-block' }}
          >
            {selectedRelationship.type.replace(/-/g, ' ')}
          </span>
        </div>

        {selectedRelationship.description && (
          <p className="inspector-desc">
            {selectedRelationship.description}
          </p>
        )}

        <div className="study-section">
          <div className="inspector-section-header">
            <span className="study-section-label">Connected concepts</span>
            <span className="inspector-section-count">2</span>
          </div>
          <div className="inspector-connections-list">
            <button
              type="button"
              className="inspector-conn-card"
              onClick={() => onSelectConcept(selectedRelationship.sourceId)}
              title={`Study ${selectedRelationship.sourceName}`}
            >
              <div className="inspector-conn-rel-indicator">
                <span className="inspector-conn-rel-symbol">↰</span>
                <span className="inspector-conn-rel-label">source concept</span>
              </div>
              <div className="inspector-conn-main-row">
                <span className="inspector-conn-target-dot" />
                <span className="inspector-conn-name">{selectedRelationship.sourceName}</span>
                <ArrowUpRight size={12} className="inspector-conn-arrow" />
              </div>
            </button>
            <button
              type="button"
              className="inspector-conn-card"
              onClick={() => onSelectConcept(selectedRelationship.targetId)}
              title={`Study ${selectedRelationship.targetName}`}
            >
              <div className="inspector-conn-rel-indicator">
                <span className="inspector-conn-rel-symbol">↳</span>
                <span className="inspector-conn-rel-label">target concept</span>
              </div>
              <div className="inspector-conn-main-row">
                <span className="inspector-conn-target-dot" />
                <span className="inspector-conn-name">{selectedRelationship.targetName}</span>
                <ArrowUpRight size={12} className="inspector-conn-arrow" />
              </div>
            </button>
          </div>
        </div>

        {hasMultipleSources ? (
          <div className="study-section">
            <span className="study-section-label">Sources</span>
            <div className="inspector-sources-compact-list">
              {selectedRelationship.sourceNames!.map((name, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="inspector-source-item clickable"
                  onClick={() => onSelectSource?.(name)}
                  title={`View ${name} in Sources`}
                >
                  <span className="inspector-source-bullet">•</span>
                  <span className="inspector-source-value">{name}</span>
                  <ArrowUpRight size={10} className="inspector-source-link-icon" />
                </button>
              ))}
            </div>
          </div>
        ) : selectedRelationship.sourceNames && selectedRelationship.sourceNames.length === 1 ? (
          <div className="study-section" style={{ borderTop: 'none', paddingTop: 0 }}>
            <span className="study-section-label">Source</span>
            <button
              type="button"
              className="study-source-box"
              onClick={() => onSelectSource?.(selectedRelationship.sourceNames![0])}
              title={`View ${selectedRelationship.sourceNames[0]} in Sources`}
            >
              <span className="inspector-source-value">{selectedRelationship.sourceNames[0]}</span>
              <ArrowUpRight size={11} className="study-source-icon" />
            </button>
          </div>
        ) : null}
      </motion.aside>
    );
  }

  // 2. Study Panel View (Phase 1: Learn Mode)
  // Canonical concept name: exact name stored in the graph
  const canonicalName = concept!.name || concept!.label;
  const explanation = getConceptExplanation(concept!);
  const keyIdeas = getKeyIdeas(concept!);
  const passage = getGroundedPassage(concept!);
  const relationships = concept!.relationships || [];
  const primarySource = concept!.sources?.[0]?.name || concept!.source;
  const primaryPage = concept!.sources?.[0]?.page ?? concept!.page;

  return (
    <motion.aside
      className="floating-node-inspector study-panel"
      aria-label={`Study concept: ${canonicalName}`}
      role="region"
      initial={{ opacity: 0, x: 26 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 26 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Mobile bottom sheet drag handle */}
      <div className="inspector-drag-handle" aria-hidden="true" />

      {/* Subtle Return Navigation to previous concept */}
      {previousConceptName && onGoBack && (
        <button
          type="button"
          className="inspector-back-btn"
          onClick={onGoBack}
          title={`Back to ${previousConceptName}`}
        >
          <ArrowLeft size={11} className="inspector-back-arrow" />
          <span className="inspector-back-label">Previous:</span>
          <span className="inspector-back-name">{previousConceptName}</span>
        </button>
      )}

      {/* Content wrapper with smooth concept-to-concept editorial transition */}
      <div className="study-panel-scroll-container">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={concept!.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="study-panel-content"
          >
            {/* Header: Exact canonical concept name + Category + Close button */}
            <header className="inspector-header study-header">
              <div className="inspector-title-wrap">
                <span className="study-section-label study-category-tag">
                  CONCEPT · {concept!.category}
                </span>
                <h2 className="inspector-name study-concept-title">
                  {canonicalName}
                </h2>
                <span className="study-subtitle">
                  How the concept is understood from your material.
                </span>
              </div>
              <button
                type="button"
                className="inspector-close-btn"
                onClick={onClose}
                aria-label="Close study panel"
                title="Close panel"
              >
                <X size={14} />
              </button>
            </header>

            {/* WHAT IT MEANS */}
            <section className="study-section">
              <h3 className="study-section-label">WHAT IT MEANS</h3>
              <p className="study-explanation">
                {explanation}
              </p>
            </section>

            {/* KEY IDEAS (Only displayed when data is actually available) */}
            {keyIdeas.length > 0 && (
              <section className="study-section">
                <h3 className="study-section-label">KEY IDEAS</h3>
                <ul className="study-key-ideas-list">
                  {keyIdeas.map((idea, idx) => (
                    <li key={idx} className="study-key-idea-item">
                      <span className="study-key-idea-bullet">•</span>
                      <span>{idea}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* FROM YOUR MATERIAL (Short source-grounded excerpt) */}
            {passage && (
              <section className="study-section">
                <h3 className="study-section-label">FROM YOUR MATERIAL</h3>
                <div className="study-passage-box">
                  <blockquote className="study-passage-quote">
                    “{passage.text}”
                  </blockquote>
                  <div className="study-passage-meta">
                    <button
                      type="button"
                      className="study-source-chip"
                      onClick={() => onSelectSource?.(passage.sourceName, passage.page)}
                      title={`View ${passage.sourceName}${passage.page ? ` (p. ${passage.page})` : ''} in Sources`}
                    >
                      <span className="study-source-chip-name">{passage.sourceName}</span>
                      {passage.page && (
                        <span className="study-source-chip-page">· p. {passage.page}</span>
                      )}
                      <ArrowUpRight size={10} className="study-source-link-icon" />
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* CONNECTED CONCEPTS (Actual graph relationships with semantic labels) */}
            {relationships.length > 0 && (
              <section className="study-section">
                <div className="inspector-section-header">
                  <h3 className="study-section-label">CONNECTED CONCEPTS</h3>
                  <span className="inspector-section-count">{relationships.length}</span>
                </div>
                <div className="inspector-connections-list">
                  {relationships.map((rel, idx) => {
                    const isOutgoing = rel.direction !== 'incoming';
                    const relLabel = rel.type ? rel.type.replace(/-/g, ' ') : 'connected to';
                    return (
                      <button
                        key={`${rel.targetId}-${idx}`}
                        type="button"
                        className="inspector-conn-card"
                        onClick={() => onSelectConcept(rel.targetId)}
                        title={`Study ${rel.targetName}`}
                      >
                        <div className="inspector-conn-rel-indicator">
                          <span className="inspector-conn-rel-label">
                            {isOutgoing ? `${relLabel} →` : `← ${relLabel}`}
                          </span>
                        </div>
                        <div className="inspector-conn-main-row">
                          <span className="inspector-conn-target-dot" />
                          <span className="inspector-conn-name">{rel.targetName}</span>
                          <ArrowUpRight size={12} className="inspector-conn-arrow" />
                        </div>
                        {rel.description && (
                          <span className="inspector-conn-desc">
                            {rel.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* SOURCE (Provenance citation with page number if available) */}
            {concept!.sources && concept!.sources.length > 1 ? (
              <section className="study-section">
                <h3 className="study-section-label">SOURCES</h3>
                <div className="inspector-sources-compact-list">
                  {concept!.sources.map((s, idx) => (
                    <button
                      key={`${s.id}-${idx}`}
                      type="button"
                      className="inspector-source-item clickable"
                      onClick={() => onSelectSource?.(s.name, s.page)}
                      title={`View ${s.name}${s.page ? ` (p. ${s.page})` : ''} in Sources`}
                    >
                      <span className="inspector-source-bullet">•</span>
                      <span className="inspector-source-value">{s.name}</span>
                      {s.page && <span className="study-source-page">· p. {s.page}</span>}
                      <ArrowUpRight size={10} className="inspector-source-link-icon" />
                    </button>
                  ))}
                </div>
              </section>
            ) : primarySource ? (
              <section className="study-section">
                <h3 className="study-section-label">SOURCE</h3>
                <button
                  type="button"
                  className="study-source-box"
                  onClick={() => onSelectSource?.(primarySource, primaryPage)}
                  title={`View ${primarySource}${primaryPage ? ` (p. ${primaryPage})` : ''} in Sources`}
                >
                  <div className="study-source-box-meta">
                    <span className="study-source-box-name">{primarySource}</span>
                    {primaryPage && (
                      <span className="study-source-page">Page {primaryPage}</span>
                    )}
                  </div>
                  <ArrowUpRight size={12} className="study-source-icon" />
                </button>
              </section>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};
