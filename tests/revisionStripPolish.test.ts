import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND STUDY SPACE — CONTINUE REVISION STRIP POLISH & ENTRANCE ANIMATION', () => {
  const studyViewPath = path.resolve(__dirname, '../src/components/study/StudySpaceView.tsx');
  const studyCssPath = path.resolve(__dirname, '../src/styles/studySpace.css');

  const studyViewSrc = fs.readFileSync(studyViewPath, 'utf8');
  const studyCss = fs.readFileSync(studyCssPath, 'utf8');

  describe('1. Unboxed Appearance — Borderless Editorial Row', () => {
    it('removes visible outer borders, card background fill, and box shadows from .study-revision-strip', () => {
      // Must have background: transparent or none
      assert.match(
        studyCss,
        /\.study-revision-strip\s*\{[\s\S]*?background:\s*transparent;/
      );
      // Must have border: none
      assert.match(
        studyCss,
        /\.study-revision-strip\s*\{[\s\S]*?border:\s*none;/
      );
      // Must have border-radius: 0
      assert.match(
        studyCss,
        /\.study-revision-strip\s*\{[\s\S]*?border-radius:\s*0;/
      );
      // Must have box-shadow: none
      assert.match(
        studyCss,
        /\.study-revision-strip\s*\{[\s\S]*?box-shadow:\s*none;/
      );
    });

    it('preserves the compact vertical footprint of the revision strip', () => {
      assert.match(
        studyCss,
        /\.study-revision-strip\s*\{[\s\S]*?padding:\s*6px\s*0;/
      );
    });

    it('removes glowing shadow effects from the status dot', () => {
      // Dot should have clean solid accent color without glowing box-shadow
      assert.doesNotMatch(
        studyCss,
        /\.study-revision-strip-dot\s*\{[\s\S]*?box-shadow:/
      );
    });
  });

  describe('2. Exact Match with "CONTINUE LEARNING" Entrance Animation', () => {
    it('wraps the "REVISION IN PROGRESS" label in a clipping container matching the kicker pattern', () => {
      assert.ok(
        studyViewSrc.includes('className="study-continue-kicker-clip study-revision-strip-label-clip"'),
        'Label must be wrapped in a kicker clipping container'
      );
      assert.match(
        studyCss,
        /\.study-revision-strip-label-clip\s*\{[\s\S]*?overflow:\s*hidden;/,
        'Label clip container must have overflow: hidden'
      );
    });

    it('animates "REVISION IN PROGRESS" using the exact horizontal clipping reveal and translation of Continue Learning', () => {
      assert.ok(
        studyViewSrc.includes("initial={shouldReduceMotion ? { opacity: 1, clipPath: 'inset(0 0% 0 0)', x: 0 } : { opacity: 0, clipPath: 'inset(0 100% 0 0)', x: -6 }}"),
        'Must share exact initial mask and x-offset with Continue Learning kicker'
      );
      assert.ok(
        studyViewSrc.includes("animate={hasContinueEnteredView ? { opacity: 1, clipPath: 'inset(0 0% 0 0)', x: 0 } : { opacity: 0, clipPath: 'inset(0 100% 0 0)', x: -6 }}"),
        'Must animate to full reveal tied to hasContinueEnteredView'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.48, delay: 0.04, ease: REVEAL_EASE }}"),
        'Must use exact duration: 0.48, delay: 0.04, and ease: REVEAL_EASE'
      );
    });

    it('optimizes will-change for the revision strip label', () => {
      assert.match(
        studyCss,
        /\.study-revision-strip-label\s*\{[\s\S]*?will-change:[\s\S]*?clip-path;/
      );
    });

    it('preserves the existing Continue Learning animation completely untouched', () => {
      assert.ok(
        studyViewSrc.includes('className="study-continue-kicker"'),
        'Must preserve study-continue-kicker element'
      );
      assert.ok(
        studyViewSrc.includes('CONTINUE LEARNING'),
        'Must preserve CONTINUE LEARNING text'
      );
    });
  });

  describe('3. Coordinated Subtle Entrance for Remaining Revision Strip Elements', () => {
    it('reveals the lime status dot at delay 0.04s in coordination with the label', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-revision-strip-status\""),
        'Status container must be present'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.36, delay: 0.04, ease: REVEAL_EASE }}"),
        'Status dot must enter at delay 0.04s'
      );
    });

    it('reveals the concept name with subtle y: 4 upward reveal at delay 0.12s', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-revision-strip-concept\""),
        'Concept name element must be present'
      );
      assert.ok(
        studyViewSrc.includes("initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}"),
        'Concept name must start at subtle y: 4'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.42, delay: 0.12, ease: REVEAL_EASE }}"),
        'Concept name must enter at delay 0.12s'
      );
    });

    it('reveals the concept position count at delay 0.18s', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-revision-strip-count\""),
        'Count element must be present'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.40, delay: 0.18, ease: REVEAL_EASE }}"),
        'Count must enter at delay 0.18s'
      );
    });

    it('reveals the progress track at delay 0.22s', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-revision-strip-progress-track\""),
        'Progress track must be present'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.40, delay: 0.22, ease: REVEAL_EASE }}"),
        'Progress track must enter at delay 0.22s'
      );
    });

    it('reveals the resume revision action with subtle horizontal entrance x: -6 at delay 0.26s', () => {
      assert.ok(
        studyViewSrc.includes("className=\"study-editorial-btn study-revision-strip-action\""),
        'Resume button must be present'
      );
      assert.ok(
        studyViewSrc.includes("initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}"),
        'Resume button must start at subtle x: -6'
      );
      assert.ok(
        studyViewSrc.includes("transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.42, delay: 0.26, ease: REVEAL_EASE }}"),
        'Resume button must enter at delay 0.26s'
      );
    });
  });

  describe('4. Accessibility & Reduced Motion', () => {
    it('sets duration: 0 across all revision strip motion elements when shouldReduceMotion is active', () => {
      // Container, status dot, label, divider, concept, count, progress, button
      const occurrences = (studyViewSrc.match(/transition=\{shouldReduceMotion \? \{ duration: 0 \}/g) || []).length;
      assert.ok(occurrences >= 15, 'All motion elements must handle shouldReduceMotion with duration: 0');
    });

    it('includes .study-revision-strip-label in CSS prefers-reduced-motion media query', () => {
      assert.match(
        studyCss,
        /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.study-revision-strip-label,/,
        'Must register .study-revision-strip-label in reduced motion rules'
      );
    });
  });

  describe('5. Responsive Layout & Clean Hierarchy', () => {
    it('defines responsive rules for tablet (768px) and mobile (640px)', () => {
      assert.ok(studyCss.includes('@media (max-width: 768px)'));
      assert.ok(studyCss.includes('@media (max-width: 640px)'));
    });

    it('prevents overlap on mobile screens by allowing left items to wrap', () => {
      assert.match(
        studyCss,
        /@media\s*\(max-width:\s*640px\)[\s\S]*?\.study-revision-strip-left\s*\{[\s\S]*?flex-wrap:\s*wrap;/
      );
    });
  });
});
