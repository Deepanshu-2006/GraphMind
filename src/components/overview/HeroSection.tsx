import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Upload, ArrowRight } from 'lucide-react';
import { KnowledgeOrb3D } from './KnowledgeOrb3D';

interface HeroSectionProps {
  onCreateGraph: () => void;
  onExploreDemo: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onCreateGraph,
  onExploreDemo
}) => {
  const heroRef = useRef<HTMLElement>(null);

  // Subtle interactive parallax for the typography layer
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 28, stiffness: 120, mass: 0.5 };
  const textParallaxX = useSpring(mouseX, springConfig);
  const textParallaxY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = heroEl.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      // Extremely subtle depth response: ±3px
      mouseX.set(x * 3.5);
      mouseY.set(y * 2.5);
    };

    const handlePointerLeave = () => {
      mouseX.set(0);
      mouseY.set(0);
    };

    heroEl.addEventListener('pointermove', handlePointerMove, { passive: true });
    heroEl.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    return () => {
      heroEl.removeEventListener('pointermove', handlePointerMove);
      heroEl.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [mouseX, mouseY]);

  return (
    <section ref={heroRef} className="overview-hero" aria-label="GraphMind interactive 3d knowledge orb hero">
      {/* Layer 1: The Interactive 3D Knowledge Orb */}
      <KnowledgeOrb3D />

      {/* Layer 2: Editorial Spatial Depth & Vignette */}
      <div className="overview-hero-vignette" aria-hidden="true" />

      {/* Layer 3: Editorial Typography & Actions */}
      <motion.div 
        className="overview-hero-content"
        style={{ x: textParallaxX, y: textParallaxY }}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.12,
              delayChildren: 0.08
            }
          }
        }}
      >
        {/* Eyebrow */}
        <motion.div 
          className="overview-hero-eyebrow"
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { 
              opacity: 1, 
              y: 0, 
              transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } 
            }
          }}
        >
          Knowledge Mapping
        </motion.div>

        {/* Display Headline */}
        <motion.h1 
          className="overview-hero-title"
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { 
              opacity: 1, 
              y: 0, 
              transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } 
            }
          }}
        >
          <span className="hero-title-line">Make your material</span>
          <span className="hero-title-line">
            make sense<span className="hero-title-dot">.</span>
          </span>
        </motion.h1>

        {/* Supporting Copy */}
        <motion.p 
          className="overview-hero-desc"
          variants={{
            hidden: { opacity: 0, y: 14 },
            visible: { 
              opacity: 1, 
              y: 0, 
              transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } 
            }
          }}
        >
          GraphMind finds the ideas inside your study material and maps how they connect.
        </motion.p>

        {/* Action Controls */}
        <motion.div 
          className="overview-hero-actions"
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { 
              opacity: 1, 
              y: 0, 
              transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } 
            }
          }}
        >
          <motion.button 
            type="button"
            className="btn-primary hero-btn-primary"
            onClick={onCreateGraph}
            aria-label="Upload material"
            id="btn-overview-add-material"
            whileHover={{ y: -1.5, backgroundColor: '#FFFFFF', transition: { duration: 0.18 } }}
            whileTap={{ scale: 0.985 }}
          >
            <Upload size={14} strokeWidth={2} className="hero-btn-icon" />
            <span>Upload material</span>
          </motion.button>

          <motion.button 
            type="button"
            className="btn-secondary hero-btn-secondary"
            onClick={onExploreDemo}
            aria-label="Explore a graph"
            id="btn-explore-demo-graph"
            whileHover="hover"
            whileTap={{ scale: 0.985 }}
            variants={{
              hover: {
                borderColor: 'rgba(255, 255, 255, 0.28)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                transition: { duration: 0.18 }
              }
            }}
          >
            <span>Explore a graph</span>
            <motion.span
              className="hero-btn-arrow-wrap"
              variants={{
                hover: { x: 4, transition: { duration: 0.18, ease: 'easeOut' } }
              }}
            >
              <ArrowRight size={14} strokeWidth={2} className="hero-btn-arrow" />
            </motion.span>
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Understated Editorial Bottom Scroll Cue */}
      <motion.div 
        className="overview-hero-cue" 
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ delay: 0.8, duration: 0.8 }}
      >
        <span className="hero-cue-text">Scroll to explore</span>
        <span className="hero-cue-arrow">↓</span>
      </motion.div>
    </section>
  );
};
