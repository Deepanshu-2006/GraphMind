import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import type { KnowledgeTest } from '../../types/test';

interface TestIntroScreenProps {
  test: KnowledgeTest | null;
  conceptsCovered: string[];
  isInsufficientMaterial: boolean;
  onStartTest: () => void;
  onExitTest: () => void;
}

export function TestIntroScreen({
  test,
  conceptsCovered,
  isInsufficientMaterial,
  onStartTest,
  onExitTest
}: TestIntroScreenProps) {
  if (isInsufficientMaterial || !test) {
    return (
      <motion.div
        className="test-intro-container test-insufficient-container"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="test-intro-kicker">ACADEMIC ASSESSMENT</div>
        <h1 className="test-intro-title">Not enough material to create a full test yet.</h1>
        <p className="test-intro-description">
          GraphMind requires sufficient concept definitions and relationships extracted from your uploaded study material to construct a grounded, authentic examination.
        </p>
        <div className="test-intro-insufficient-actions">
          <button
            type="button"
            className="test-editorial-action-btn action-secondary"
            onClick={onExitTest}
            autoFocus
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>BACK TO GRAPH</span>
          </button>
        </div>
      </motion.div>
    );
  }

  const questionCount = test.questions.length;
  const minutes = Math.round(test.timeLimitSeconds / 60);

  return (
    <motion.div
      className="test-intro-container"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="test-intro-header-block">
        <div className="test-intro-kicker">TEST YOUR KNOWLEDGE</div>
        <h1 className="test-intro-title">{test.title}</h1>
        <div className="test-intro-subtitle">Based on your knowledge graph</div>
      </div>

      <div className="test-intro-divider" aria-hidden="true" />

      <div className="test-intro-metadata-row" aria-label="Test specification">
        <div className="metadata-spec-item">
          <span className="spec-val">{questionCount}</span>
          <span className="spec-lbl">QUESTIONS</span>
        </div>
        <div className="metadata-spec-dot" aria-hidden="true">·</div>
        <div className="metadata-spec-item">
          <span className="spec-val">{minutes}</span>
          <span className="spec-lbl">MINUTES</span>
        </div>
        <div className="metadata-spec-dot" aria-hidden="true">·</div>
        <div className="metadata-spec-item">
          <span className="spec-val">MCQ</span>
          <span className="spec-lbl">FORMAT</span>
        </div>
      </div>

      <div className="test-intro-divider" aria-hidden="true" />

      <div className="test-intro-concepts-section">
        <div className="concepts-section-label">Concepts covered</div>
        <div className="concepts-tags-flow">
          {conceptsCovered.map((cName) => (
            <span key={cName} className="concepts-flow-tag">
              {cName}
            </span>
          ))}
        </div>
      </div>

      <div className="test-intro-actions">
        <button
          type="button"
          className="test-start-btn"
          onClick={onStartTest}
          autoFocus
        >
          <span>START TEST</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="test-intro-back-link"
          onClick={onExitTest}
        >
          Back to graph
        </button>
      </div>
    </motion.div>
  );
}
