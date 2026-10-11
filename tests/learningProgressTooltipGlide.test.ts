import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND — SMOOTH, CONTINUOUS CHART TOOLTIP ANIMATION VERIFICATION', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Continuous Single Tooltip Instance & Pointer Tracking (Prompt Section 1)', () => {
    it('maintains a single persistent tooltip instance mounted across chart point hovers', () => {
      assert.ok(
        studyViewSrc.includes('displayedTooltipPoint'),
        'Must maintain persistent displayedTooltipPoint coordinate reference'
      );
      assert.ok(
        studyViewSrc.includes('activeDebounceTimerRef'),
        'Must maintain active debounce timer to prevent tooltip unmounting/blinking during point transitions'
      );
    });

    it('attaches continuous pointer tracking across the chart shell to eliminate dead zones between points', () => {
      assert.ok(
        studyViewSrc.includes('onPointerMove={handleChartPointerMove}'),
        'Chart shell must track pointer moves across entire horizontal area'
      );
      assert.ok(
        studyViewSrc.includes('onPointerLeave={handleChartPointerLeave}'),
        'Chart shell must handle pointer exit smoothly'
      );
    });

    it('immediately updates attempt number, score, and date on point change', () => {
      assert.ok(
        studyViewSrc.includes('{displayedTooltipPoint.pt.attemptNumber}'),
        'Must immediately render current attempt number'
      );
      assert.ok(
        studyViewSrc.includes('{displayedTooltipPoint.pt.scorePercentage}%'),
        'Must immediately render current score percentage'
      );
      assert.ok(
        studyViewSrc.includes('{displayedTooltipPoint.pt.dateStr}'),
        'Must render current assessment date string'
      );
    });
  });

  describe('2. Animation Architecture & Spring Tuning (Prompt Section 2)', () => {
    it('positions tooltip using hardware-accelerated translate3d transforms instead of layout mutations', () => {
      assert.ok(
        studyViewSrc.includes("translate3d(${x}, ${y}, 0)"),
        'Must use translate3d(x, y, 0) transform template for GPU acceleration'
      );
      assert.ok(
        studyViewSrc.includes('willChange: \'transform, opacity\'') ||
        studyCss.includes('will-change: transform, opacity;'),
        'Must declare will-change for compositor optimization'
      );
    });

    it('tunes spring physics with restrained motion, zero wobble, and 180–280ms perceived duration', () => {
      assert.ok(
        studyViewSrc.includes("type: 'spring'"),
        'Must use spring transition'
      );
      assert.ok(
        studyViewSrc.includes('stiffness: 320'),
        'Must use carefully tuned stiffness'
      );
      assert.ok(
        studyViewSrc.includes('damping: 32'),
        'Must use critically damped spring to eliminate overshoot and rubber-banding'
      );
      assert.ok(
        studyViewSrc.includes('mass: 0.8'),
        'Must use responsive mass for snappy retargeting'
      );
    });

    it('does not introduce foreign animation dependencies', () => {
      const packageJsonPath = path.resolve(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      assert.ok(pkg.dependencies['framer-motion'], 'Uses existing framer-motion library');
      assert.strictEqual(pkg.dependencies['gsap'], undefined, 'Must not introduce gsap');
    });
  });

  describe('3. Separation of Entrance Animation from Position Motion (Prompt Section 3)', () => {
    it('distinguishes initial entrance from continuous glide between points', () => {
      assert.ok(
        studyViewSrc.includes('isFirstEntry'),
        'Must track first entry state'
      );
      assert.ok(
        studyViewSrc.includes('isFirstEntryRef'),
        'Must track first entry ref to reset after exit settle'
      );
    });

    it('settles upward on initial entrance and holds position opacity 1 during point moves', () => {
      assert.ok(
        studyViewSrc.includes('y: targetPos.y + (isTooltipActive ? 0 : 4)'),
        'Initial entry settles upward by 4px into resting position'
      );
      assert.ok(
        studyViewSrc.includes('opacity: isTooltipActive ? 1 : 0'),
        'Animates opacity smoothly between active and inactive states'
      );
    });
  });

  describe('4. Tooltip Content Stability & Typography (Prompt Section 4)', () => {
    it('preserves compact tooltip styling with attempt number, lime score, and date', () => {
      assert.match(
        studyCss,
        /\.study-trajectory-tooltip-score\s*\{[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/,
        'Score must be rendered in signature lime green accent'
      );
      assert.match(
        studyCss,
        /\.study-trajectory-tooltip\s*\{[\s\S]*?padding:\s*6px\s+11px;/
      );
    });
  });

  describe('5. Chart Boundary Handling & Edge Clamping (Prompt Section 5)', () => {
    it('clamps horizontal coordinates with safety margins to prevent clipping at left or right edges', () => {
      assert.ok(
        studyViewSrc.includes('Math.max(PADDING_X, Math.min(shellWidth - tipWidth - PADDING_X, idealX))'),
        'Must clamp X position within chart shell padding'
      );
    });

    it('smoothly places tooltip below point marker when near top boundary without clipping', () => {
      assert.ok(
        studyViewSrc.includes('idealY < PADDING_Y'),
        'Must detect top boundary proximity'
      );
      assert.ok(
        studyViewSrc.includes('clampedY = py + GAP'),
        'Must position below point when near top boundary'
      );
    });
  });

  describe('6. Point Highlighting & Halo Preservation (Prompt Section 6)', () => {
    it('preserves crisp lime-green outline, subtle outer halo, and latest point ring', () => {
      assert.ok(studyViewSrc.includes('study-trajectory-point-halo'));
      assert.ok(studyViewSrc.includes('study-trajectory-latest-ring'));
      assert.ok(studyViewSrc.includes('study-trajectory-point'));
    });
  });

  describe('7. Accessibility & prefers-reduced-motion (Prompt Section 7)', () => {
    it('disables spring motion under prefers-reduced-motion for immediate transitions', () => {
      assert.ok(
        studyViewSrc.includes('shouldReduceMotion ? { duration: 0 } :'),
        'Must respect reduced motion preference with instant duration'
      );
    });

    it('preserves keyboard navigation, tabIndex, and click-to-open handlers', () => {
      assert.ok(studyViewSrc.includes('tabIndex={0}'));
      assert.ok(studyViewSrc.includes('role="button"'));
      assert.ok(studyViewSrc.includes('onClick={() => handleOpenAttempt('));
    });
  });

  describe('8. Shared Interaction Layer & Continuous Hover Detection (Prompt Section 1 & 2)', () => {
    it('covers the entire plotting region with a shared transparent interaction layer', () => {
      assert.ok(
        studyViewSrc.includes('study-trajectory-interaction-layer'),
        'Must render dedicated shared transparent interaction layer'
      );
      assert.ok(
        studyViewSrc.includes('width={760}') && studyViewSrc.includes('height={180}'),
        'Interaction layer rect must span entire 760x180 viewBox'
      );
    });

    it('does not clear hover state on SVG point marker mouseleave to prevent flickering in empty space', () => {
      const svgNodesSectionMatch = studyViewSrc.match(/coords\.map\(\(c,\s*idx\)\s*=>\s*\{[\s\S]*?return\s*\(\s*<motion\.g[\s\S]*?<\/motion\.g>/);
      assert.ok(svgNodesSectionMatch, 'Must find SVG point nodes mapping');
      const svgNodesSection = svgNodesSectionMatch[0];
      assert.ok(
        !svgNodesSection.includes('onMouseLeave={() => setHoveredPointAttemptId(null)}'),
        'SVG point nodes must NOT clear hover state on mouse leave; only chart shell exit clears hover'
      );
    });
  });

  describe('9. Intelligent Nearest Point Selection with Boundary Hysteresis (Prompt Section 3)', () => {
    it('implements hysteresis deadband to prevent rapid boundary toggling between points', () => {
      assert.ok(
        studyViewSrc.includes('midpoint + hysteresis'),
        'Must require pointer to pass midpoint plus hysteresis to transition right'
      );
      assert.ok(
        studyViewSrc.includes('midpoint - hysteresis'),
        'Must require pointer to pass midpoint minus hysteresis to transition left'
      );
      assert.ok(
        studyViewSrc.includes('Math.min(12, dist * 0.15)'),
        'Must compute proportional hysteresis buffer'
      );
    });

    it('uses stable ref for hoveredPointAttemptId to avoid unnecessary re-renders during pointer moves', () => {
      assert.ok(
        studyViewSrc.includes('hoveredPointAttemptIdRef'),
        'Must use hoveredPointAttemptIdRef for stable identity'
      );
    });
  });

  describe('10. Tooltip & Chart Pointer Event Isolation (Prompt Section 6)', () => {
    it('guarantees pointer-events: none on tooltip and all its child elements', () => {
      assert.match(
        studyCss,
        /\.study-trajectory-tooltip,\s*\.study-trajectory-tooltip\s*\*\s*\{[\s\S]*?pointer-events:\s*none\s*!important;/,
        'Must enforce pointer-events: none !important on tooltip and all child elements'
      );
    });

    it('sets pointer-events: none on trajectory line and reference grid to prevent hit-testing interference', () => {
      assert.match(
        studyCss,
        /\.study-trajectory-line\s*\{[\s\S]*?pointer-events:\s*none;/,
        'Trajectory line must not capture pointer events'
      );
      assert.match(
        studyCss,
        /\.study-trajectory-reference-grid\s*\{[\s\S]*?pointer-events:\s*none;/,
        'Reference grid must not capture pointer events'
      );
    });
  });

  describe('11. Continuous Hovering Between Timeline Columns (Area C)', () => {
    it('does not stop hovering when cursor moves through gaps between timeline columns', () => {
      assert.ok(
        studyViewSrc.includes('handleTimelinePointerMove'),
        'Must handle pointer movement across timeline container'
      );
      assert.ok(
        studyViewSrc.includes('onPointerMove={handleTimelinePointerMove}'),
        'Must attach handleTimelinePointerMove to timeline container'
      );
      const timelineButtonsSectionMatch = studyViewSrc.match(/prog\.chronologicalAttempts\.map\(\(pt,\s*pIdx\)\s*=>\s*\{[\s\S]*?return\s*\(\s*<motion\.button[\s\S]*?<\/motion\.button>/);
      assert.ok(timelineButtonsSectionMatch, 'Must find timeline buttons mapping');
      const timelineButtonsSection = timelineButtonsSectionMatch[0];
      assert.ok(
        !timelineButtonsSection.includes('onMouseLeave={() => setHoveredPointAttemptId(null)}'),
        'Individual timeline buttons must NOT clear hover state on mouse leave so hovering does not stop in gaps'
      );
    });
  });
});
