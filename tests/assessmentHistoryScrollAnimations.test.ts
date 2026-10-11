import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND ASSESSMENT HISTORY — SCROLL-TRIGGERED ENTRY ANIMATIONS & FILTER REPLAY', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');

  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Scroll-Triggered Animation Curve & Parameters (Section 1)', () => {
    it('defines initial state translating row 16-20px below final position with opacity 0', () => {
      assert.match(
        studyCss,
        /\.study-record-item\[data-entry-state="initial"\]\s*\{[\s\S]*?opacity:\s*0;/,
        'Row initial state must have opacity: 0'
      );
      assert.match(
        studyCss,
        /\.study-record-item\[data-entry-state="initial"\]\s*\{[\s\S]*?transform:\s*translateY\(18px\);/,
        'Row initial state must start translateY(18px) (approx 16-20px)'
      );
    });

    it('defines animate state transitioning opacity to 1 and translateY to 0 with cubic-bezier(0.22, 1, 0.36, 1)', () => {
      assert.match(
        studyCss,
        /\.study-record-item\[data-entry-state="animate"\]\s*\{[\s\S]*?opacity:\s*1;/,
        'Row animate state must have opacity: 1'
      );
      assert.match(
        studyCss,
        /\.study-record-item\[data-entry-state="animate"\]\s*\{[\s\S]*?transform:\s*translateY\(0\);/,
        'Row animate state must have transform: translateY(0)'
      );
      assert.match(
        studyCss,
        /\.study-record-item\[data-entry-state="animate"\]\s*\{[\s\S]*?transition:[\s\S]*?520ms\s+cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/,
        'Row animate state must use smooth cubic-bezier(0.22, 1, 0.36, 1) and ~520ms duration'
      );
    });

    it('settles rows cleanly without lingering transforms or interfering with hover transitions', () => {
      assert.match(
        studyCss,
        /\.study-record-item\[data-entry-state="settled"\]\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?transform:\s*translateY\(0\);/,
        'Row settled state must be visible at rest'
      );
    });

    it('applies matching entry animation states to the expand control wrapper', () => {
      assert.match(
        studyCss,
        /\.study-records-expand-wrap\[data-entry-state="initial"\]\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?transform:\s*translateY\(18px\);/,
        'Expand control must start at opacity 0 and translateY(18px)'
      );
      assert.match(
        studyCss,
        /\.study-records-expand-wrap\[data-entry-state="animate"\]\s*\{[\s\S]*?transition:[\s\S]*?520ms\s+cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/,
        'Expand control must animate with cubic-bezier(0.22, 1, 0.36, 1)'
      );
      assert.match(
        studyCss,
        /\.study-records-expand-wrap\[data-entry-state="settled"\]\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?transform:\s*translateY\(0\);/,
        'Expand control must settle at rest'
      );
    });

    it('staggers consecutive rows by 70ms (within 60-80ms range)', () => {
      assert.ok(
        studyViewSrc.includes("(attemptIndex >= 3 ? attemptIndex - 3 : attemptIndex) * 70"),
        'Must calculate stagger delay using 70ms per row'
      );
      assert.ok(
        studyViewSrc.includes("Math.min(group.attempts.length, 3) * 70"),
        'Must stagger expand control after the initial attempts'
      );
    });
  });

  describe('2. IntersectionObserver Triggering & Viewport Tracking (Section 2)', () => {
    it('uses IntersectionObserver to observe individual attempt rows entering the viewport', () => {
      assert.ok(
        studyViewSrc.includes('new IntersectionObserver('),
        'Must initialize IntersectionObserver'
      );
      assert.ok(
        studyViewSrc.includes('observer.observe(el);'),
        'Must observe individual attempt rows'
      );
      assert.ok(
        studyViewSrc.includes('observer.unobserve(target);'),
        'Must unobserve rows once visible to prevent re-triggering during scrolling'
      );
    });

    it('cleans up observer and animation timers on component unmount and filter changes', () => {
      assert.ok(
        studyViewSrc.includes('observer.disconnect();'),
        'Must disconnect observer on cleanup'
      );
      assert.ok(
        studyViewSrc.includes('attemptsTimersRef.current.forEach((t) => clearTimeout(t));'),
        'Must clear active animation timers'
      );
    });

    it('supports scroll listener fallback for rapid scrolling', () => {
      assert.ok(
        studyViewSrc.includes("window.addEventListener('scroll', handleScroll"),
        'Must support scroll listener fallback'
      );
      assert.ok(
        studyViewSrc.includes("window.removeEventListener('scroll', handleScroll);"),
        'Must remove scroll listener on unmount'
      );
    });
  });

  describe('3. Replay Animations When Switching Filters (Section 3)', () => {
    it('maintains a dedicated animation generation counter (attemptsAnimGen) for filter switches', () => {
      assert.ok(
        studyViewSrc.includes('const [attemptsAnimGen, setAttemptsAnimGen] = useState(0);'),
        'Must maintain attemptsAnimGen state'
      );
      assert.ok(
        studyViewSrc.includes('setAttemptsAnimGen((g) => g + 1);'),
        'Must increment attemptsAnimGen when active filter or search changes'
      );
    });

    it('resets animation state on filter switch without remounting the entire Assessment History section', () => {
      assert.ok(
        studyViewSrc.includes('animatedAttemptIdsRef.current = new Set();'),
        'Must reset animated attempt tracker on filter switch'
      );
      assert.ok(
        studyViewSrc.includes('settledAttemptIdsRef.current = new Set();'),
        'Must reset settled attempt tracker on filter switch'
      );
      assert.ok(
        studyViewSrc.includes('hasHistoryEnteredView'),
        'Must preserve hasHistoryEnteredView for the section header'
      );
    });

    it('preserves stable React keys for individual assessment items (key={attempt.id})', () => {
      assert.ok(
        studyViewSrc.includes('key={attempt.id}'),
        'Must use stable attempt.id for article keys'
      );
    });
  });

  describe('4. Expand & Collapse Animation Orchestration (Section 4)', () => {
    it('animates only newly revealed attempts when expanding beyond 3 items', () => {
      assert.ok(
        studyViewSrc.includes('const staggerIndex = index >= 3 ? index - 3 : index;'),
        'Must restart stagger from 0 for attempts at index 3 and above'
      );
      assert.ok(
        studyViewSrc.includes('if (!isAttemptsExpanded && attemptIndex >= 3) {'),
        'Must maintain 3-attempt collapse threshold'
      );
    });

    it('keeps previously visible attempts stationary when expanded or collapsed', () => {
      assert.ok(
        studyViewSrc.includes('if (animatedAttemptIdsRef.current.has(id)) return;'),
        'Must not re-trigger animation for already visible attempts'
      );
    });

    it('resets expanded state to collapsed default when switching filters', () => {
      assert.ok(
        studyViewSrc.includes('if (prevFilterKey !== currentFilterKey) {'),
        'Must track filter/search key changes'
      );
      assert.ok(
        studyViewSrc.includes('setIsAttemptsExpanded(false);'),
        'Must reset isAttemptsExpanded to false on filter changes'
      );
    });
  });

  describe('5. Accessibility & Reduced Motion (Section 6 & Scenario H)', () => {
    it('overrides animation and transitions immediately when prefers-reduced-motion is active', () => {
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.study-record-item\[data-entry-state="initial"\],[\s\S]*?\.study-record-item\[data-entry-state="animate"\][\s\S]*?opacity:\s*1\s*!important;/,
        'CSS must force opacity 1 for reduced motion'
      );
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.study-record-item\[data-entry-state="initial"\],[\s\S]*?\.study-record-item\[data-entry-state="animate"\][\s\S]*?transform:\s*none\s*!important;/,
        'CSS must force transform none for reduced motion'
      );
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.study-record-item\[data-entry-state="initial"\],[\s\S]*?\.study-record-item\[data-entry-state="animate"\][\s\S]*?transition:\s*none\s*!important;/,
        'CSS must disable transitions for reduced motion'
      );
    });

    it('in React, immediately settles items when shouldReduceMotion is true', () => {
      assert.ok(
        studyViewSrc.includes('if (shouldReduceMotion) {'),
        'Must check shouldReduceMotion in animation effect'
      );
      assert.ok(
        studyViewSrc.includes("shouldReduceMotion || settledAttemptIds.has(attempt.id)"),
        'Must render settled state immediately when shouldReduceMotion is true'
      );
    });
  });

  describe('6. Validation Scenarios A–I Coverage', () => {
    it('Scenario A & B: Animate rows upon entry and preserve settled state when scrolling away and returning', () => {
      assert.ok(studyViewSrc.includes('data-entry-state='));
      assert.ok(studyViewSrc.includes('observer.unobserve(target);'));
    });

    it('Scenario C & D: Replays entry animations on filter switch without replaying section heading', () => {
      assert.ok(studyViewSrc.includes('setAttemptsAnimGen((g) => g + 1);'));
      assert.ok(studyViewSrc.includes('study-history-title-line'));
    });

    it('Scenario E & F: Expands only newly revealed items and collapses cleanly', () => {
      assert.ok(studyViewSrc.includes('setIsAttemptsExpanded(!isAttemptsExpanded)'));
      assert.ok(studyViewSrc.includes('staggerIndex = index >= 3 ? index - 3 : index'));
    });

    it('Scenario G: Rapid filter switches cleanly cancel previous timers without overlap', () => {
      assert.ok(studyViewSrc.includes('attemptsTimersRef.current.clear();'));
    });

    it('Scenario H & I: Reduced motion and fast scroll fallbacks prevent any rows from remaining stuck or invisible', () => {
      assert.ok(studyViewSrc.includes('shouldReduceMotion'));
      assert.ok(studyViewSrc.includes('rect.top === 0 && rect.bottom === 0 && rect.height === 0'));
    });
  });
});
