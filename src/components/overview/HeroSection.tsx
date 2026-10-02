import React, { useRef, useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { ArrowUp, ArrowRight } from 'lucide-react';
import { KnowledgeOrb3D } from './KnowledgeOrb3D';

interface HeroSectionProps {
  onCreateGraph: () => void;
  onExploreDemo: () => void;
}

const LINE1_TEXT = 'Make your material';
const LINE2_TEXT = 'make sense';

export const HeroSection: React.FC<HeroSectionProps> = ({
  onCreateGraph,
  onExploreDemo
}) => {
  const heroRef = useRef<HTMLElement>(null);

  // 1. Continuous Scroll Progress with Fluid Spring Physics (Sections 17, 18, 38)
  const targetScrollRef = useRef(0);
  const scrollRef = useRef(0);
  const [smoothScroll, setSmoothScroll] = useState(0);

  // Subtle interactive parallax for typography layer
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const textParallaxX = useSpring(mouseX, { damping: 30, stiffness: 100, mass: 0.6 });
  const textParallaxY = useSpring(mouseY, { damping: 30, stiffness: 100, mass: 0.6 });

  // Passive Scroll Tracking & Continuous Smooth Interpolation (Section 18)
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;

    const scrollContainer = heroEl.closest('.workspace-viewport') || window;

    const handleScroll = () => {
      const heroHeight = heroEl.offsetHeight || window.innerHeight;
      let scrollTop = 0;

      if (scrollContainer === window) {
        scrollTop = window.scrollY || document.documentElement.scrollTop;
      } else {
        scrollTop = (scrollContainer as HTMLElement).scrollTop;
      }

      // Progress normalized from 0.0 (top) to 1.0 (one viewport scrolled)
      const progress = Math.min(1.0, Math.max(0, scrollTop / heroHeight));
      targetScrollRef.current = progress;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    let rafId: number;
    let lastT = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) * 0.001));
      lastT = now;

      // Exponential continuous approach (Section 18)
      const diff = targetScrollRef.current - scrollRef.current;
      if (Math.abs(diff) > 0.0005) {
        scrollRef.current += diff * (1 - Math.exp(-12.0 * dt));
        setSmoothScroll(scrollRef.current);
      } else if (scrollRef.current !== targetScrollRef.current) {
        scrollRef.current = targetScrollRef.current;
        setSmoothScroll(scrollRef.current);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Passive Mouse Parallax Handler
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (targetScrollRef.current > 0.15) return;
      const rect = heroEl.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
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

  // Layered Scroll Exit Calculations (Sections 27, 28, 29)
  // A. Eyebrow scroll fade
  const eyebrowScroll = Math.max(0, smoothScroll - 0.06);
  const eyebrowY = smoothScroll > 0.05 ? -eyebrowScroll * 60 : 0;
  const eyebrowOpacity = smoothScroll > 0.05 ? Math.max(0, 1.0 - eyebrowScroll / 0.28) : 1;

  // B. Supporting description scroll exit
  const descScroll = Math.max(0, smoothScroll - 0.12);
  const descY = smoothScroll > 0.05 ? -descScroll * 45 : 0;
  const descOpacity = smoothScroll > 0.05 ? Math.max(0, 1.0 - descScroll / 0.36) : 1;

  // C. Action buttons scroll exit
  const actionsScroll = Math.max(0, smoothScroll - 0.18);
  const actionsY = smoothScroll > 0.05 ? -actionsScroll * 35 : 0;
  const actionsOpacity = smoothScroll > 0.05 ? Math.max(0, 1.0 - actionsScroll / 0.38) : 1;

  // D. Scroll cue fade
  const cueOpacity = Math.max(0, 1.0 - smoothScroll / 0.10) * 0.55;

  return (
    <section ref={heroRef} className="overview-hero" aria-label="GraphMind interactive 3d knowledge orb hero">
      {/* Layer 1: The Interactive 3D Knowledge Orb with Continuous Scroll Dissolution */}
      <KnowledgeOrb3D scrollProgress={smoothScroll} />

      {/* Layer 2: Editorial Spatial Depth & Vignette */}
      <div className="overview-hero-vignette" aria-hidden="true" />

      {/* Layer 3: Editorial Typography & Actions */}
      <motion.div 
        className="overview-hero-content"
        style={{ x: textParallaxX, y: textParallaxY }}
      >
        {/* Eyebrow: Editorial section label with tiny GraphMind green marker */}
        <motion.div 
          className="overview-hero-eyebrow"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: eyebrowOpacity, y: eyebrowY }}
          transition={{ 
            duration: smoothScroll > 0.05 ? 0.15 : 0.5, 
            delay: smoothScroll > 0.05 ? 0 : 0.05, 
            ease: [0.22, 1, 0.36, 1] 
          }}
        >
          <span className="hero-eyebrow-dot" aria-hidden="true" />
          <span>Knowledge Mapping</span>
        </motion.div>

        {/* Display Headline with Character-by-Character Entrance & Scroll Exit */}
        <h1 className="overview-hero-title">
          {/* Line 1: Make your material (Weight ~600) */}
          <span className="hero-title-line hero-title-line-1">
            {LINE1_TEXT.split('').map((char, index) => {
              const speedVar = 1.0 + Math.sin(index * 0.8) * 0.18;
              const charScroll = Math.max(0, smoothScroll - 0.10);
              const charY = smoothScroll > 0.05 ? -charScroll * 135 * speedVar : 0;
              const charOpacity = smoothScroll > 0.05 ? Math.max(0, 1.0 - charScroll / (0.42 + (index % 4) * 0.04)) : 1;

              return (
                <span key={`l1-${index}`} className="hero-char-wrap">
                  <motion.span
                    className="hero-char"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: charOpacity, y: charY }}
                    transition={{
                      type: 'spring',
                      stiffness: 130,
                      damping: 22,
                      mass: 0.55,
                      delay: smoothScroll > 0.05 ? 0 : 0.10 + index * 0.015 // 15ms editorial stagger (Section 24)
                    }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </motion.span>
                </span>
              );
            })}
          </span>

          {/* Line 2: make sense. (Weight ~700 with signature green dot) */}
          <span className="hero-title-line hero-title-line-2">
            {LINE2_TEXT.split('').map((char, index) => {
              const globalIndex = LINE1_TEXT.length + index;
              const speedVar = 1.0 + Math.sin(globalIndex * 0.8) * 0.18;
              const charScroll = Math.max(0, smoothScroll - 0.10);
              const charY = smoothScroll > 0.05 ? -charScroll * 135 * speedVar : 0;
              const charOpacity = smoothScroll > 0.05 ? Math.max(0, 1.0 - charScroll / (0.42 + (globalIndex % 4) * 0.04)) : 1;

              return (
                <span key={`l2-${index}`} className="hero-char-wrap">
                  <motion.span
                    className="hero-char"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: charOpacity, y: charY }}
                    transition={{
                      type: 'spring',
                      stiffness: 130,
                      damping: 22,
                      mass: 0.55,
                      delay: smoothScroll > 0.05 ? 0 : 0.10 + globalIndex * 0.015
                    }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </motion.span>
                </span>
              );
            })}

            {/* Signature GraphMind green dot */}
            <span className="hero-char-wrap">
              <motion.span
                className="hero-char hero-title-dot"
                initial={{ opacity: 0, y: 28 }}
                animate={{ 
                  opacity: smoothScroll > 0.05 ? Math.max(0, 1.0 - Math.max(0, smoothScroll - 0.10) / 0.42) : 1, 
                  y: smoothScroll > 0.05 ? -Math.max(0, smoothScroll - 0.10) * 135 : 0 
                }}
                transition={{
                  type: 'spring',
                  stiffness: 130,
                  damping: 22,
                  mass: 0.55,
                  delay: smoothScroll > 0.05 ? 0 : 0.10 + (LINE1_TEXT.length + LINE2_TEXT.length) * 0.015
                }}
              >
                .
              </motion.span>
            </span>
          </span>
        </h1>

        {/* Supporting Copy */}
        <motion.p 
          className="overview-hero-desc"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: descOpacity, y: descY }}
          transition={{ 
            duration: smoothScroll > 0.05 ? 0.15 : 0.6, 
            delay: smoothScroll > 0.05 ? 0 : 0.38, 
            ease: [0.22, 1, 0.36, 1] 
          }}
        >
          GraphMind finds the ideas inside your study material and maps how they connect.
        </motion.p>

        {/* Action Controls: Editorial Action Row (28–36px gap) */}
        <motion.div 
          className="overview-hero-actions"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: actionsOpacity, y: actionsY }}
          transition={{ 
            duration: smoothScroll > 0.05 ? 0.15 : 0.55, 
            delay: smoothScroll > 0.05 ? 0 : 0.48, 
            ease: [0.22, 1, 0.36, 1] 
          }}
        >
          {/* Primary CTA: Editorial action with subtle hairline underline: Upload material ↑ */}
          <motion.button 
            type="button"
            className="hero-action-primary hero-btn-primary"
            onClick={onCreateGraph}
            aria-label="Upload material"
            id="btn-overview-add-material"
            initial="initial"
            whileHover="hover"
            whileTap={{ scale: 0.985 }}
            variants={{
              initial: {},
              hover: {}
            }}
          >
            <span className="hero-action-primary-inner">
              <span className="hero-action-text">Upload material</span>
              <motion.span
                className="hero-action-arrow-wrap"
                variants={{
                  initial: { y: 0 },
                  hover: { y: -3.5, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }
                }}
              >
                <ArrowUp size={15} strokeWidth={2.2} className="hero-action-arrow" />
              </motion.span>
            </span>
            <span className="hero-action-line" aria-hidden="true" />
          </motion.button>

          {/* Secondary CTA: Quiet editorial text action: Explore a graph → */}
          <motion.button 
            type="button"
            className="hero-action-secondary hero-btn-secondary"
            onClick={onExploreDemo}
            aria-label="Explore a graph"
            id="btn-explore-demo-graph"
            initial="initial"
            whileHover="hover"
            whileTap={{ scale: 0.985 }}
            variants={{
              initial: {},
              hover: {}
            }}
          >
            <span className="hero-action-secondary-inner">
              <span className="hero-action-text">Explore a graph</span>
              <motion.span
                className="hero-action-arrow-wrap"
                variants={{
                  initial: { x: 0 },
                  hover: { x: 5, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }
                }}
              >
                <ArrowRight size={15} strokeWidth={2} className="hero-action-arrow" />
              </motion.span>
            </span>
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Understated Editorial Bottom Scroll Cue */}
      <motion.div 
        className="overview-hero-cue" 
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: cueOpacity }}
        transition={{ delay: 0.9, duration: 0.7 }}
      >
        <span className="hero-cue-text">Scroll to explore</span>
        <span className="hero-cue-arrow">↓</span>
      </motion.div>
    </section>
  );
};
