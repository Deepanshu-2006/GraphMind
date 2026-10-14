import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import { 
  validateRevisionSession,
  type RevisionSession
} from '../src/services/revisionSession';

describe('GraphMind Study Space — Compact Revision Resume Strip', () => {
  const studySpacePath = path.resolve(process.cwd(), 'src/components/study/StudySpaceView.tsx');
  const cssPath = path.resolve(process.cwd(), 'src/styles/studySpace.css');

  const studySpaceSrc = fs.readFileSync(studySpacePath, 'utf-8');
  const cssSrc = fs.readFileSync(cssPath, 'utf-8');

  describe('1. Compact Horizontal Revision Strip Architecture', () => {
    it('replaces the large card with a compact horizontal revision strip', () => {
      assert.ok(
        studySpaceSrc.includes('className="study-revision-strip"'),
        'StudySpaceView must include the study-revision-strip container'
      );
      assert.ok(
        studySpaceSrc.includes('REVISION IN PROGRESS'),
        'Must display "REVISION IN PROGRESS" uppercase status label'
      );
      assert.ok(
        studySpaceSrc.includes('Resume revision'),
        'Must display "Resume revision" action label'
      );
    });

    it('positions the strip directly below header and before Continue Learning', () => {
      const headerIdx = studySpaceSrc.indexOf('className="study-header"');
      const stripIdx = studySpaceSrc.indexOf('className="study-revision-strip"');
      const continueLearningIdx = studySpaceSrc.indexOf('className="study-continue-section"');

      assert.ok(headerIdx !== -1, 'Header must be present');
      assert.ok(stripIdx !== -1, 'Revision strip must be present');
      assert.ok(continueLearningIdx !== -1, 'Continue Learning section must be present');

      assert.ok(headerIdx < stripIdx, 'Strip must appear after header');
      assert.ok(stripIdx < continueLearningIdx, 'Strip must appear before Continue Learning');
    });

    it('hides the revision strip completely when no active revision session exists', () => {
      // The strip is guarded strictly by unfinishedSessionInfo
      assert.ok(
        studySpaceSrc.includes('!isLoading && !errorMessage && unfinishedSessionInfo && ('),
        'Strip must only render when an unfinishedSessionInfo is actively present'
      );
      // Ensures no oversized empty placeholder card is rendered for revision
      assert.ok(
        !studySpaceSrc.includes('study-continue-empty-section'),
        'Must not render an oversized empty card placeholder above assessments'
      );
    });
  });

  describe('2. Unfinished Session Data & Resume Navigation', () => {
    const mockGraph: KnowledgeGraph = {
      id: 'graph-os-101',
      name: 'Operating Systems',
      description: 'Core concepts in operating systems',
      nodes: [
        { id: 'c-proc', name: 'Process', description: 'Program in execution' },
        { id: 'c-thread', name: 'Thread', description: 'Lightweight execution unit' },
        { id: 'c-deadlock', name: 'Deadlock', description: 'Permanent blocking state' }
      ],
      edges: [
        { id: 'e1', source: 'c-proc', target: 'c-thread', relationship: 'contains' },
        { id: 'e2', source: 'c-thread', target: 'c-deadlock', relationship: 'can cause' }
      ]
    };

    it('correctly resolves concept title, position, and total from active session', () => {
      const session: RevisionSession = {
        graphId: mockGraph.id,
        conceptIds: ['c-proc', 'c-thread', 'c-deadlock'],
        currentIndex: 0,
        currentConceptId: 'c-proc',
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      };

      const validated = validateRevisionSession(session, mockGraph);
      assert.ok(validated !== null);

      const total = validated.conceptIds.length;
      const currIdx = validated.currentIndex;
      const position = currIdx + 1;
      const currentNode = mockGraph.nodes.find(n => n.id === validated.currentConceptId);

      assert.strictEqual(total, 3);
      assert.strictEqual(position, 1);
      assert.strictEqual(currentNode?.name, 'Process');
    });

    it('renders current concept name and concise count format', () => {
      assert.ok(
        studySpaceSrc.includes('{unfinishedSessionInfo.conceptTitle}'),
        'Must render current concept title from session'
      );
      assert.ok(
        studySpaceSrc.includes('Concept {unfinishedSessionInfo.position} of {unfinishedSessionInfo.total}'),
        'Must render concise "Concept X of Y" format'
      );
    });

    it('renders an understated mini progress indicator with accessible progressbar attributes', () => {
      assert.ok(
        studySpaceSrc.includes('role="progressbar"'),
        'Must include role="progressbar"'
      );
      assert.ok(
        studySpaceSrc.includes('className="study-revision-strip-progress-track"'),
        'Must include progress track element'
      );
      assert.ok(
        studySpaceSrc.includes('className="study-revision-strip-progress-fill"'),
        'Must include progress fill element'
      );
      assert.ok(
        studySpaceSrc.includes('width: `${unfinishedSessionInfo.progressPercent}%`'),
        'Must bind fill width to progressPercent'
      );
    });

    it('wires the resume action to navigate to the exact concept where the student paused', () => {
      assert.ok(
        studySpaceSrc.includes('onNavigateToRevision?.(unfinishedSessionInfo.currentConceptId)'),
        'Clicking action button must call onNavigateToRevision with currentConceptId'
      );
      assert.ok(
        studySpaceSrc.includes('className="study-editorial-btn study-revision-strip-action"'),
        'Must style action button with signature editorial button classes'
      );
    });
  });

  describe('3. Swiss Editorial Styling & Responsive Layout', () => {
    it('defines required styling tokens for the compact revision strip in studySpace.css', () => {
      assert.ok(cssSrc.includes('.study-revision-strip'), 'Must style .study-revision-strip');
      assert.ok(cssSrc.includes('.study-revision-strip-content'), 'Must style .study-revision-strip-content');
      assert.ok(cssSrc.includes('.study-revision-strip-dot'), 'Must style .study-revision-strip-dot');
      assert.ok(cssSrc.includes('.study-revision-strip-label'), 'Must style .study-revision-strip-label');
      assert.ok(cssSrc.includes('.study-revision-strip-concept'), 'Must style .study-revision-strip-concept');
      assert.ok(cssSrc.includes('.study-revision-strip-count'), 'Must style .study-revision-strip-count');
      assert.ok(cssSrc.includes('.study-revision-strip-progress-track'), 'Must style .study-revision-strip-progress-track');
      assert.ok(cssSrc.includes('.study-revision-strip-progress-fill'), 'Must style .study-revision-strip-progress-fill');
      assert.ok(cssSrc.includes('.study-revision-strip-action'), 'Must style .study-revision-strip-action');
    });

    it('uses the signature lime accent #A3FF12 for the status dot and progress fill', () => {
      assert.match(
        cssSrc,
        /\.study-revision-strip-dot\s*\{[\s\S]*?var\(--accent,\s*#A3FF12\);/
      );
      assert.match(
        cssSrc,
        /\.study-revision-strip-progress-fill\s*\{[\s\S]*?var\(--accent,\s*#A3FF12\);/
      );
    });

    it('implements responsive rules for tablet (768px) and mobile (640px)', () => {
      assert.ok(cssSrc.includes('@media (max-width: 768px)'), 'Must include 768px tablet query');
      assert.ok(cssSrc.includes('@media (max-width: 640px)'), 'Must include 640px mobile query');
    });
  });
});
