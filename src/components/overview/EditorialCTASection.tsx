import React, { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/* ==========================================================================
   Editorial Content & Structural Constants
   ========================================================================== */

export interface HeadlinePart {
  text: string;
  variant: 'primary' | 'bridge';
}

export const EDITORIAL_HEADLINE_PARTS: HeadlinePart[] = [
  { text: 'TURN', variant: 'primary' },
  { text: 'STUDY MATERIAL', variant: 'primary' },
  { text: '— INTO', variant: 'bridge' },
  { text: 'CONNECTED KNOWLEDGE.', variant: 'primary' }
];

export const EDITORIAL_SUPPORTING_COPY = {
  kicker: 'FROM MATERIAL / TO MEANING',
  heading: 'Your study material holds hidden structure.',
  description:
    'GraphMind parses the core concepts inside your lecture notes, textbook chapters, and research papers, maps the relationships connecting them, and organizes your study topics into an interactive knowledge canvas.',
  primaryCta: 'Upload material',
  secondaryCta: 'Open interactive workspace'
};

export const EDITORIAL_DIAGRAM_STEPS = [
  { code: '01', name: 'Material' },
  { code: '02', name: 'Concepts' },
  { code: '03', name: 'Connections' },
  { code: '04', name: 'Knowledge', isAccent: true }
];

interface EditorialCTASectionProps {
  onUploadMaterial: () => void;
  onExploreWorkspace: () => void;
}

export const EditorialCTASection: React.FC<EditorialCTASectionProps> = ({
  onUploadMaterial,
  onExploreWorkspace
}) => {
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(containerRef, { amount: 0.2, once: true });
  const shouldReduceMotion = useReducedMotion();

  const handleScrollTop = () => {
    const scrollContainer: HTMLElement | Window =
      (containerRef.current?.closest('.workspace-viewport') as HTMLElement | null) ||
      (document.querySelector('.workspace-viewport') as HTMLElement | null) ||
      window;

    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      ref={containerRef}
      className="editorial-cta-section"
      aria-label="GraphMind — Knowledge Synthesis"
    >
      {/* 1. Top Architectural Rule */}
      <motion.div
        className="editorial-rule-horizontal top"
        initial={shouldReduceMotion ? { opacity: 1 } : { scaleX: 0, transformOrigin: '0% 50%' }}
        animate={isInView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden="true"
      />

      <div className="editorial-cta-inner">
        {/* 2. Top Header Metadata Bar */}
        <motion.div
          className="editorial-meta-header"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        >
          <div className="editorial-meta-index">
            <span className="editorial-meta-dot" aria-hidden="true" />
            <span className="editorial-meta-code">GRAPHMIND / 02</span>
            <span className="editorial-meta-sep" aria-hidden="true">·</span>
            <span className="editorial-meta-label">KNOWLEDGE SYNTHESIS</span>
          </div>
          <div className="editorial-meta-system">
            <span>DETERMINISTIC EXTRACTION · REVERSIBLE CANVAS</span>
          </div>
        </motion.div>

        {/* 3. Main Asymmetric Composition */}
        <div className="editorial-main-grid">
          {/* Left Column: Giant Typographic Statement */}
          <div className="editorial-statement-col">
            <h2 className="editorial-statement" aria-label="Turn study material into connected knowledge.">
              {EDITORIAL_HEADLINE_PARTS.map((part, idx) => (
                <div key={idx} className="editorial-statement-line-wrap">
                  <motion.span
                    className={[
                      'editorial-statement-line',
                      part.variant === 'bridge' ? 'bridge-line' : 'primary-line'
                    ].join(' ')}
                    initial={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: part.variant === 'bridge' ? 18 : 34 }
                    }
                    animate={
                      isInView
                        ? { opacity: 1, y: 0 }
                        : shouldReduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: part.variant === 'bridge' ? 18 : 34 }
                    }
                    transition={{
                      duration: shouldReduceMotion ? 0.3 : 0.8,
                      delay: shouldReduceMotion ? 0 : 0.18 + idx * 0.08,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                  >
                    {part.text}
                  </motion.span>
                </div>
              ))}
            </h2>

            <motion.div
              className="editorial-statement-footnote"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.5, delay: 0.52, ease: 'easeOut' }}
            >
              <span className="editorial-footnote-code">ARCHITECTURAL STATEMENT</span>
              <span className="editorial-footnote-desc">
                From unstructured source pages to an interconnected study graph.
              </span>
            </motion.div>
          </div>

          {/* Vertical Structural Divider Rule */}
          <motion.div
            className="editorial-rule-vertical"
            initial={shouldReduceMotion ? { opacity: 1 } : { scaleY: 0, transformOrigin: '50% 0%' }}
            animate={isInView ? { scaleY: 1, opacity: 1 } : { scaleY: 0, opacity: 0 }}
            transition={{ duration: 0.85, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          />

          {/* Right Column: Contextual Supporting Information & Actions */}
          <div className="editorial-supporting-col">
            <motion.div
              className="editorial-context-block"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
              transition={{ duration: 0.65, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="editorial-context-kicker-row">
                <span className="editorial-context-kicker">{EDITORIAL_SUPPORTING_COPY.kicker}</span>
                <span className="editorial-context-index">SEC 02 / 02</span>
              </div>

              <h3 className="editorial-context-heading">
                {EDITORIAL_SUPPORTING_COPY.heading}
              </h3>

              <p className="editorial-context-desc">
                {EDITORIAL_SUPPORTING_COPY.description}
              </p>
            </motion.div>

            {/* Miniature Restrained Knowledge Diagram */}
            <motion.div
              className="editorial-diagram-wrap"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.6, delay: 0.56, ease: [0.16, 1, 0.3, 1] }}
              aria-hidden="true"
            >
              <span className="editorial-diagram-title">Pipeline Architecture</span>
              <div className="editorial-diagram-flow">
                {EDITORIAL_DIAGRAM_STEPS.map((step, idx) => (
                  <React.Fragment key={step.code}>
                    <div className={['editorial-diagram-step', step.isAccent ? 'accent' : ''].join(' ')}>
                      <span className="editorial-diagram-dot" />
                      <div className="editorial-diagram-step-meta">
                        <span className="editorial-diagram-code">{step.code}</span>
                        <span className="editorial-diagram-name">{step.name}</span>
                      </div>
                    </div>
                    {idx < EDITORIAL_DIAGRAM_STEPS.length - 1 && (
                      <div className="editorial-diagram-line" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </motion.div>

            {/* Editorial CTAs */}
            <motion.div
              className="editorial-actions-block"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
              transition={{ duration: 0.6, delay: 0.66, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                type="button"
                className="editorial-cta-primary"
                onClick={onUploadMaterial}
                aria-label="Upload material to begin knowledge mapping"
              >
                <span className="editorial-cta-text">{EDITORIAL_SUPPORTING_COPY.primaryCta}</span>
                <span className="editorial-cta-arrow" aria-hidden="true">↗</span>
                <span className="editorial-cta-line" aria-hidden="true" />
              </button>

              <button
                type="button"
                className="editorial-cta-secondary"
                onClick={onExploreWorkspace}
                aria-label="Open interactive knowledge workspace"
              >
                <span className="editorial-cta-sec-text">{EDITORIAL_SUPPORTING_COPY.secondaryCta}</span>
                <span className="editorial-cta-sec-arrow" aria-hidden="true">→</span>
              </button>
            </motion.div>
          </div>
        </div>

        {/* 4. Bottom Baseline Bar */}
        <motion.div
          className="editorial-baseline-bar"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.78, ease: 'easeOut' }}
        >
          <div className="editorial-baseline-col left">
            <span>GRAPHMIND STUDIO</span>
            <span className="editorial-baseline-sep">/</span>
            <span>KNOWLEDGE VISUALIZATION</span>
          </div>

          <div className="editorial-baseline-col center">
            <span>DESIGNED FOR SERIOUS STUDY &amp; RESEARCH</span>
          </div>

          <div className="editorial-baseline-col right">
            <button
              type="button"
              className="editorial-back-to-top"
              onClick={handleScrollTop}
              aria-label="Scroll back to top of page"
            >
              <span>Back to top</span>
              <span className="editorial-back-to-top-arrow" aria-hidden="true">↑</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* 5. Bottom Architectural Rule */}
      <motion.div
        className="editorial-rule-horizontal bottom"
        initial={shouldReduceMotion ? { opacity: 1 } : { scaleX: 0, transformOrigin: '100% 50%' }}
        animate={isInView ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden="true"
      />
    </section>
  );
};
