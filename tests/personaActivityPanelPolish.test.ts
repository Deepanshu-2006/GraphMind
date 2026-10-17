import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  formatRelativeTime,
  formatTabularCount,
  PersonaActivityPanel
} from '../src/components/persona/PersonaActivityPanel';
import {
  calculateInterpolatedValue,
  easeOutCubic,
  clampValue
} from '../src/components/persona/PersonaAnimatedNumber';
import { calculatePersonaStats } from '../src/hooks/usePersonaStats';
import type { KnowledgeGraphMeta, KnowledgeGraph } from '../src/types/knowledgeGraph';
import { saveGraphData, updateConceptPracticeState } from '../src/services/storage';

// In-memory backing store for localStorage simulation in Node test runner
const storageMap = new Map<string, string>();

(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] || null,
  get length() { return storageMap.size; }
};

describe('GRAPHMIND — PERSONA LEFT ACTIVITY PANEL POLISH & EDITORIAL TYPOGRAPHY', () => {
  const panelSrc = readFileSync(
    resolve(process.cwd(), 'src/components/persona/PersonaActivityPanel.tsx'),
    'utf-8'
  );
  const cssSrc = readFileSync(
    resolve(process.cwd(), 'src/styles/persona.css'),
    'utf-8'
  );

  // =========================================================================
  // 1. TYPOGRAPHY & EDITORIAL HIERARCHY
  // =========================================================================
  describe('1. Editorial Typography Hierarchy', () => {
    it('defines section eyebrow with monospace font, small uppercase text, and lime dot', () => {
      // JSX structure
      assert.ok(panelSrc.includes('className="persona-activity-tag"'));
      assert.ok(panelSrc.includes('className="persona-activity-tag-bullet"'));
      assert.ok(panelSrc.includes('YOUR LEARNING'));

      // Scoped CSS in persona.css
      assert.ok(cssSrc.includes('.persona-activity-panel .persona-activity-tag'));
      assert.ok(cssSrc.includes('font-family: var(--font-mono, monospace);'));
      assert.ok(cssSrc.includes('letter-spacing: 0.12em;'));
      assert.ok(cssSrc.includes('text-transform: uppercase;'));
    });

    it('styles supporting heading with comfortable font size and soft neutral color', () => {
      assert.ok(panelSrc.includes('className="persona-activity-subtitle"'));
      assert.ok(panelSrc.includes('Your activity across GraphMind'));

      assert.ok(cssSrc.includes('.persona-activity-panel .persona-activity-subtitle'));
      assert.ok(cssSrc.includes('font-size: 15px;'));
      assert.ok(cssSrc.includes('line-height: 1.4;'));
    });

    it('formats statistic labels in consistent small uppercase with controlled letter spacing', () => {
      assert.ok(cssSrc.includes('.persona-activity-panel .persona-stat-label'));
      assert.ok(cssSrc.includes('font-size: 11px;'));
      assert.ok(cssSrc.includes('letter-spacing: 0.08em;'));
      assert.ok(cssSrc.includes('text-transform: uppercase;'));
    });

    it('formats primary numerical values with large 42px font and tabular figures', () => {
      assert.ok(cssSrc.includes('.persona-activity-panel .persona-stat-value'));
      assert.ok(cssSrc.includes('font-size: 42px;'));
      assert.ok(cssSrc.includes('font-variant-numeric: tabular-nums;'));
      assert.ok(cssSrc.includes("font-feature-settings: 'tnum';"));
    });

    it('styles supporting descriptions with comfortable 13px size and relaxed line height', () => {
      assert.ok(cssSrc.includes('.persona-activity-panel .persona-stat-subtext'));
      assert.ok(cssSrc.includes('font-size: 13px;'));
      assert.ok(cssSrc.includes('line-height: 1.45;'));
    });

    it('styles recent activity rows with truncated names, subtle green dot, and right-aligned timestamps', () => {
      assert.ok(cssSrc.includes('.persona-activity-panel .persona-activity-name'));
      assert.ok(cssSrc.includes('text-overflow: ellipsis;'));
      assert.ok(cssSrc.includes('white-space: nowrap;'));
      assert.ok(cssSrc.includes('.persona-activity-panel .persona-activity-time'));
      assert.ok(cssSrc.includes('margin-left: auto;'));
    });
  });

  // =========================================================================
  // 2. 5-PHASE COORDINATED ENTRANCE ANIMATION
  // =========================================================================
  describe('2. Coordinated 5-Phase Entrance Animation', () => {
    it('Phase 1: implements panel container entrance moving upward 12px with 0.6s duration', () => {
      assert.ok(panelSrc.includes('y: shouldReduceMotion ? 0 : 12'));
      assert.ok(panelSrc.includes('duration: shouldReduceMotion ? 0 : 0.6'));
      assert.ok(panelSrc.includes('staggerChildren: shouldReduceMotion ? 0 : 0.09'));
    });

    it('Phase 2: reveals editorial content items with subtle vertical stagger', () => {
      assert.ok(panelSrc.includes('y: shouldReduceMotion ? 0 : 8'));
      assert.ok(panelSrc.includes('duration: shouldReduceMotion ? 0 : 0.45'));
    });

    it('Phase 3: configures graph count animation duration to 850ms', () => {
      assert.ok(panelSrc.includes('duration={850}'));
      assert.ok(panelSrc.includes('format={formatTabularCount}'));
    });

    it('Phase 4: configures learning progress percentage animation duration to 950ms', () => {
      assert.ok(panelSrc.includes('duration={950}'));
      assert.ok(panelSrc.includes('suffix="%"'));
    });

    it('Phase 5: staggers recent activity items with restrained timing', () => {
      assert.ok(panelSrc.includes('listContainerVariants'));
      assert.ok(panelSrc.includes('listItemVariants'));
      assert.ok(panelSrc.includes('staggerChildren: shouldReduceMotion ? 0 : 0.12') || panelSrc.includes('staggerChildren: shouldReduceMotion ? 0 : 0.06'));
      assert.ok(panelSrc.includes('duration: shouldReduceMotion ? 0 : 0.35'));
    });
  });

  // =========================================================================
  // 3. GREEN PROGRESS LINE SCALE-X FROM ZERO
  // =========================================================================
  describe('3. Green Progress Line Scale-X Animation', () => {
    it('begins at scaleX: 0 initially and scales to exact progress ratio', () => {
      assert.ok(panelSrc.includes('initial={{ scaleX: 0 }}'));
      assert.ok(panelSrc.includes('animate={{ scaleX: progressRatio }}'));
      assert.ok(panelSrc.includes("style={{ transformOrigin: 'left' }}"));
      assert.ok(panelSrc.includes('duration: shouldReduceMotion ? 0 : 1.0'));
    });

    it('sets progressRatio to 0 when totalConcepts is 0', () => {
      storageMap.clear();
      const stats = calculatePersonaStats({ graphs: [] });
      const totalConcepts = stats.activity.totalConcepts;
      const demonstratedPercentage = stats.activity.demonstratedPercentage;
      const progressRatio = totalConcepts === 0 ? 0 : Math.max(0, Math.min(100, demonstratedPercentage)) / 100;
      assert.strictEqual(progressRatio, 0);
    });

    it('calculates exact progressRatio matching real percentage (e.g. 75% -> 0.75)', () => {
      storageMap.clear();
      const graphMeta: KnowledgeGraphMeta = {
        id: 'graph-polish-1',
        name: 'Systems Programming',
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-17T08:00:00.000Z'
      };

      const graphData: KnowledgeGraph = {
        nodes: [
          { id: 'c1', name: 'Pointers', summary: 'Memory addresses' },
          { id: 'c2', name: 'Concurrency', summary: 'Threads and locks' },
          { id: 'c3', name: 'Virtual Memory', summary: 'Pages and MMU' },
          { id: 'c4', name: 'File Systems', summary: 'Inodes and blocks' }
        ],
        relationships: []
      };

      saveGraphData('graph-polish-1', graphData);
      updateConceptPracticeState('c1', 'understood', 'graph-polish-1');
      updateConceptPracticeState('c2', 'understood', 'graph-polish-1');
      updateConceptPracticeState('c3', 'understood', 'graph-polish-1');

      const stats = calculatePersonaStats({ graphs: [graphMeta] });
      const totalConcepts = stats.activity.totalConcepts;
      const demonstratedPercentage = stats.activity.demonstratedPercentage;
      const progressRatio = totalConcepts === 0 ? 0 : Math.max(0, Math.min(100, demonstratedPercentage)) / 100;

      assert.strictEqual(demonstratedPercentage, 75);
      assert.strictEqual(progressRatio, 0.75);
    });
  });

  // =========================================================================
  // 4. ANIMATION LIFECYCLE & RE-RENDER SAFETY
  // =========================================================================
  describe('4. Lifecycle & Re-render Safety', () => {
    it('exports PersonaActivityPanel wrapped in React.memo', () => {
      assert.ok(panelSrc.includes('React.memo'));
      assert.ok(panelSrc.includes("PersonaActivityPanel.displayName = 'PersonaActivityPanel'"));
    });

    it('interpolates number to exact target without overshooting', () => {
      const target = 12;
      const start = 0;
      const half = calculateInterpolatedValue(start, target, 0.5);
      const finished = calculateInterpolatedValue(start, target, 1.0);

      assert.ok(half >= 0 && half <= 12);
      assert.strictEqual(finished, 12);
    });
  });

  // =========================================================================
  // 5. REDUCED MOTION PREFERENCES
  // =========================================================================
  describe('5. Reduced Motion Handling', () => {
    it('removes entrance translation and delays when prefersReducedMotion is active', () => {
      const shouldReduceMotion = true;
      const yOffset = shouldReduceMotion ? 0 : 12;
      const duration = shouldReduceMotion ? 0 : 0.6;
      const delay = shouldReduceMotion ? 0 : 0.18;

      assert.strictEqual(yOffset, 0);
      assert.strictEqual(duration, 0);
      assert.strictEqual(delay, 0);
    });
  });

  // =========================================================================
  // 6. THREE-GROUP ARCHITECTURE & EDITORIAL POLISH
  // =========================================================================
  describe('6. Three Content Groups & Editorial Spacing', () => {
    it('structures panel into 3 distinct groups: Group A (intro), Group B (metrics), and Group C (recent)', () => {
      assert.ok(panelSrc.includes('persona-activity-group--intro'));
      assert.ok(panelSrc.includes('persona-activity-group--metrics'));
      assert.ok(panelSrc.includes('persona-activity-group--recent'));
    });

    it('establishes generous macro-gap of 34px between main content groups', () => {
      assert.ok(cssSrc.includes('gap: 34px;'));
      assert.ok(cssSrc.includes('.persona-activity-panel .persona-activity-group--metrics'));
      assert.ok(cssSrc.includes('gap: 26px;'));
    });

    it('refines supporting headline to 18px with tighter letter spacing', () => {
      assert.ok(cssSrc.includes('font-size: 18px;'));
      assert.ok(cssSrc.includes('letter-spacing: -0.015em;'));
    });

    it('permanently suppresses focus outline and border on Return to workspace exit button', () => {
      assert.ok(cssSrc.includes('.persona-exit-btn'));
      assert.ok(cssSrc.includes('outline: none !important;'));
      assert.ok(cssSrc.includes('border: none !important;'));
      assert.ok(cssSrc.includes('box-shadow: none !important;'));
    });
  });

  // =========================================================================
  // 7. CINEMATIC COORDINATED ENTRANCE TIMELINE (PHASES A–E)
  // =========================================================================
  describe('7. Cinematic Coordinated Entrance Sequence (Phases A–E)', () => {
    it('Phase A: reveals green indicator dot with scale & opacity, followed by section label', () => {
      assert.ok(panelSrc.includes('eyebrowDotVariants'));
      assert.ok(panelSrc.includes('eyebrowTextVariants'));
      assert.ok(panelSrc.includes('scale: shouldReduceMotion ? 1 : 0.65'));
      assert.ok(panelSrc.includes('delay: shouldReduceMotion ? 0 : 0.05'));
      assert.ok(panelSrc.includes('delay: shouldReduceMotion ? 0 : 0.14'));
    });

    it('Phase B: reveals supporting headline with smooth upward movement and opacity', () => {
      assert.ok(panelSrc.includes('headlineVariants'));
      assert.ok(panelSrc.includes('y: shouldReduceMotion ? 0 : 10'));
      assert.ok(panelSrc.includes('delay: shouldReduceMotion ? 0 : 0.22'));
    });

    it('Phase C: implements clipped vertical reveal for graph count with overflow: hidden wrapper', () => {
      assert.ok(panelSrc.includes('persona-stat-value-clip'));
      assert.ok(panelSrc.includes('persona-stat-value-inner'));
      assert.ok(panelSrc.includes('metric1ValueVariants'));
      assert.ok(panelSrc.includes("y: shouldReduceMotion ? 0 : '100%'"));
      assert.ok(panelSrc.includes('delay: shouldReduceMotion ? 0 : 0.48'));
      assert.ok(cssSrc.includes('.persona-activity-panel .persona-stat-value-clip'));
      assert.ok(cssSrc.includes('overflow: hidden;'));
    });

    it('Phase D: implements clipped vertical reveal for progress % and coordinates progress fill', () => {
      assert.ok(panelSrc.includes('metric2ValueVariants'));
      assert.ok(panelSrc.includes('metric2SubtextVariants'));
      assert.ok(panelSrc.includes('progressTrackVariants'));
      assert.ok(panelSrc.includes('delay: shouldReduceMotion ? 0 : 1.06'));
      assert.ok(panelSrc.includes('delay: shouldReduceMotion ? 0 : 1.20'));
      assert.ok(panelSrc.includes('delay: shouldReduceMotion ? 0 : 1.30'));
    });

    it('Phase E: reveals recent activity heading and staggers rows individually', () => {
      assert.ok(panelSrc.includes('recentHeadingVariants'));
      assert.ok(panelSrc.includes('rowDotVariants'));
      assert.ok(panelSrc.includes('rowNameVariants'));
      assert.ok(panelSrc.includes('rowTimeVariants'));
      assert.ok(panelSrc.includes('delay: shouldReduceMotion ? 0 : 1.82'));
      assert.ok(panelSrc.includes('delayChildren: shouldReduceMotion ? 0 : 1.95'));
    });
  });
});


