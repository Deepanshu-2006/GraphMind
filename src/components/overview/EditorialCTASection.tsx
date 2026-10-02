import React, { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/* ==========================================================================
   Constants
   ========================================================================== */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Very faint document-text fragments — raw material layer
const DOC_FRAGMENTS = [
  'neural networks consist of layers of interconnected nodes',
  'activation functions determine the output of each neuron',
  'backpropagation adjusts weights through gradient descent',
  'the learning rate controls how quickly the model adapts',
  'attention mechanisms allow focus on relevant input parts',
  'embedding spaces represent semantic concept relationships',
  'convolutional layers extract hierarchical spatial features',
];

const TIMELINE_STAGES = [
  { code: '01', label: 'MATERIAL',     active: false },
  { code: '02', label: 'CONCEPTS',     active: true  },
  { code: '03', label: 'CONNECTIONS',  active: false },
  { code: '04', label: 'KNOWLEDGE',    active: false },
] as const;

const PART_1 = ['TURN', 'STUDY', 'MATERIAL'] as const;
const PART_2 = ['CONNECTED', 'KNOWLEDGE.'] as const;

/* ==========================================================================
   Component
   ========================================================================== */

interface EditorialCTASectionProps {
  onUploadMaterial: () => void;
  onExploreWorkspace: () => void;
}

export const EditorialCTASection: React.FC<EditorialCTASectionProps> = ({
  onUploadMaterial,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.12, once: true });
  const R = useReducedMotion();

  return (
    <section
      ref={sectionRef}
      className="ect-section"
      aria-label="GraphMind — From Material to Knowledge"
    >
      {/* ── Background: giant '02' numeral ─────────────────────────────── */}
      <motion.div
        className="ect-bg-numeral"
        aria-hidden="true"
        initial={R ? { opacity: 0 } : { opacity: 0, y: 48 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: R ? 0.3 : 1.6, delay: R ? 0 : 0.08, ease: 'easeOut' }}
      >
        02
      </motion.div>

      {/* ── Background: document text fragments ────────────────────────── */}
      <div className="ect-bg-fragments" aria-hidden="true">
        {DOC_FRAGMENTS.map((frag, i) => (
          <motion.p
            key={i}
            className={`ect-frag ect-frag-${i + 1}`}
            initial={{ opacity: R ? 0 : 0.048 }}
            animate={isInView ? { opacity: 0.008 } : { opacity: 0 }}
            transition={{
              duration: R ? 0.1 : 2.8,
              delay: R ? 0 : 0.5 + i * 0.07,
              ease: 'linear',
            }}
          >
            {frag}
          </motion.p>
        ))}
      </div>

      <div className="ect-inner">
        {/* ── Phase 1: Top rule ───────────────────────────────────────── */}
        <motion.div
          className="ect-rule-top"
          aria-hidden="true"
          initial={R ? { opacity: 0 } : { scaleX: 0, transformOrigin: '0% 50%' }}
          animate={isInView ? { scaleX: 1, opacity: 1 } : {}}
          transition={{ duration: R ? 0.1 : 0.9, ease: EASE }}
        />

        {/* ── Phase 1: Header ─────────────────────────────────────────── */}
        <motion.div
          className="ect-header"
          initial={R ? { opacity: 0 } : { opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: R ? 0.3 : 0.6, delay: R ? 0 : 0.18, ease: EASE }}
        >
          <span className="ect-header-index">GRAPHMIND / 02</span>
          <span className="ect-header-label">KNOWLEDGE MAPPING</span>
        </motion.div>

        {/* ── Main Composition ─────────────────────────────────────────── */}
        <div className="ect-composition">

          {/* LEFT: Typographic headline */}
          <div className="ect-headline-col">
            <h2
              className="ect-headline"
              aria-label="Turn study material into connected knowledge."
            >
              {/* Phase 2: TURN / STUDY / MATERIAL — clip reveal */}
              {PART_1.map((word, i) => (
                <div key={word} className="ect-line-clip">
                  <motion.span
                    className="ect-line ect-line-primary"
                    initial={R ? { opacity: 0 } : { y: '108%', opacity: 0 }}
                    animate={isInView ? { y: '0%', opacity: 1 } : {}}
                    transition={{
                      duration: R ? 0.3 : 0.78,
                      delay: R ? 0 : 0.32 + i * 0.09,
                      ease: EASE,
                    }}
                  >
                    {word}
                  </motion.span>
                </div>
              ))}

              {/* Phase 3: — INTO */}
              <div className="ect-into-row">
                <motion.span
                  className="ect-into-dash"
                  aria-hidden="true"
                  initial={R ? { opacity: 0 } : { scaleX: 0, transformOrigin: '0% 50%' }}
                  animate={isInView ? { scaleX: 1, opacity: 1 } : {}}
                  transition={{ duration: R ? 0.1 : 0.42, delay: R ? 0 : 0.70, ease: EASE }}
                />
                <motion.span
                  className="ect-into-text"
                  initial={R ? { opacity: 0 } : { opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: R ? 0.3 : 0.52, delay: R ? 0 : 0.88, ease: EASE }}
                >
                  INTO
                </motion.span>
              </div>

              {/* Phase 4: CONNECTED / KNOWLEDGE. — settle from slight spread */}
              {PART_2.map((word, i) => (
                <div key={word} className="ect-line-clip">
                  <motion.span
                    className="ect-line ect-line-primary"
                    initial={R ? { opacity: 0 } : { y: '108%', opacity: 0, x: (i + 1) * 8 }}
                    animate={isInView ? { y: '0%', opacity: 1, x: 0 } : {}}
                    transition={{
                      duration: R ? 0.3 : 0.84,
                      delay: R ? 0 : 1.04 + i * 0.10,
                      ease: EASE,
                    }}
                  >
                    {word}
                  </motion.span>
                </div>
              ))}
            </h2>
          </div>

          {/* RIGHT: Editorial annotation */}
          <div className="ect-annotation-col">
            <motion.span
              className="ect-annotation-kicker"
              initial={R ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: R ? 0.3 : 0.55, delay: R ? 0 : 1.26, ease: EASE }}
            >
              FROM MATERIAL / TO MEANING
            </motion.span>

            <motion.h3
              className="ect-annotation-heading"
              initial={R ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: R ? 0.3 : 0.60, delay: R ? 0 : 1.40, ease: EASE }}
            >
              Your study material holds hidden structure.
            </motion.h3>

            <motion.p
              className="ect-annotation-body"
              initial={R ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: R ? 0.3 : 0.60, delay: R ? 0 : 1.54, ease: EASE }}
            >
              GraphMind finds the core concepts inside your material and maps
              the relationships connecting them.
            </motion.p>

            <motion.button
              type="button"
              className="ect-cta"
              onClick={onUploadMaterial}
              aria-label="Upload material to begin knowledge mapping"
              initial={R ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: R ? 0.3 : 0.55, delay: R ? 0 : 1.70, ease: EASE }}
            >
              <span className="ect-cta-text">UPLOAD MATERIAL</span>
              <span className="ect-cta-arrow" aria-hidden="true">↗</span>
              <span className="ect-cta-line" aria-hidden="true" />
            </motion.button>
          </div>
        </div>

        {/* ── Phase 6: Open editorial timeline ────────────────────────── */}
        <div className="ect-timeline" aria-label="Knowledge pipeline stages">
          <div className="ect-timeline-track" aria-hidden="true">
            <motion.div
              className="ect-timeline-track-line"
              initial={R ? { opacity: 1 } : { scaleX: 0, transformOrigin: '0% 50%' }}
              animate={isInView ? { scaleX: 1, opacity: 1 } : {}}
              transition={{ duration: R ? 0.1 : 1.2, delay: R ? 0 : 1.62, ease: EASE }}
            />
            {/* Green dot travels 0% → 25% (stage 02) */}
            <motion.div
              className="ect-timeline-progress"
              initial={R ? { left: '25%' } : { left: '2%', opacity: 0 }}
              animate={isInView ? { left: '25%', opacity: 1 } : {}}
              transition={{ duration: R ? 0.3 : 1.1, delay: R ? 0 : 2.0, ease: EASE }}
            />
          </div>

          <div className="ect-timeline-stages">
            {TIMELINE_STAGES.map((stage, i) => (
              <motion.div
                key={stage.code}
                className={`ect-stage${stage.active ? ' ect-stage--active' : ''}`}
                initial={R ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: R ? 0.3 : 0.50,
                  delay: R ? 0 : 1.68 + i * 0.07,
                  ease: EASE,
                }}
              >
                <span className="ect-stage-tick" aria-hidden="true" />
                <span className="ect-stage-code">{stage.code}</span>
                <span className="ect-stage-label">{stage.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Bottom rule ─────────────────────────────────────────────── */}
        <motion.div
          className="ect-rule-bottom"
          aria-hidden="true"
          initial={R ? { opacity: 1 } : { scaleX: 0, transformOrigin: '100% 50%' }}
          animate={isInView ? { scaleX: 1, opacity: 1 } : {}}
          transition={{ duration: R ? 0.1 : 0.9, delay: R ? 0 : 0.18, ease: EASE }}
        />
      </div>
    </section>
  );
};
