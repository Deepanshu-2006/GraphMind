import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { KnowledgeGraph } from '../src/types/knowledgeGraph';
import { 
  saveRevisionSession, 
  loadRevisionSession, 
  clearRevisionSession, 
  validateRevisionSession,
  type RevisionSession
} from '../src/services/revisionSession';

describe('GraphMind Study Space Simplification — Continue Revision Only', () => {
  const studySpacePath = path.resolve(process.cwd(), 'src/components/study/StudySpaceView.tsx');
  const cssPath = path.resolve(process.cwd(), 'src/styles/studySpace.css');

  const studySpaceSrc = fs.readFileSync(studySpacePath, 'utf-8');
  const cssSrc = fs.readFileSync(cssPath, 'utf-8');

  describe('1. Active View Architecture & Single-Section Focus', () => {
    it('defines CONTINUE REVISION as the sole primary section in active JSX', () => {
      assert.ok(
        studySpaceSrc.includes('className="study-continue-revision-section"'),
        'StudySpaceView must include the study-continue-revision-section class'
      );
      assert.ok(
        studySpaceSrc.includes('CONTINUE REVISION'),
        'StudySpaceView must render the CONTINUE REVISION kicker'
      );
    });

    it('removes learning dashboards and analytics from the active render flow', () => {
      // The active view checks unfinishedSessionInfo and renders only continue-revision or empty-section
      assert.ok(
        studySpaceSrc.includes('unfinishedSessionInfo ? ('),
        'Must conditionally render based on unfinishedSessionInfo'
      );
      assert.ok(
        studySpaceSrc.includes('study-continue-empty-section'),
        'Must render restrained empty state when no unfinished session'
      );
      // Legacy blocks are hidden in an unrendered branch
      assert.ok(
        studySpaceSrc.includes('(false as boolean) &&'),
        'Legacy blocks must be deactivated in active render tree'
      );
    });

    it('renders the restrained empty state when no unfinished session exists', () => {
      assert.ok(
        studySpaceSrc.includes('Nothing to resume yet.'),
        'Must display exact empty heading: Nothing to resume yet.'
      );
      assert.ok(
        studySpaceSrc.includes('Open a knowledge graph to start revising.'),
        'Must display exact supporting description: Open a knowledge graph to start revising.'
      );
      assert.ok(
        studySpaceSrc.includes('Open knowledge graph'),
        'Must render Open knowledge graph action label'
      );
      assert.ok(
        studySpaceSrc.includes('onClick={onNavigateToGraph}'),
        'Empty state action must navigate to knowledge graph'
      );
    });
  });

  describe('2. Unfinished Revision Session Resume Details', () => {
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

    it('resolves graph name, paused concept title, and remaining count accurately', () => {
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
      const remaining = Math.max(0, total - position);
      const currentNode = mockGraph.nodes.find(n => n.id === validated.currentConceptId);

      assert.strictEqual(total, 3);
      assert.strictEqual(position, 1);
      assert.strictEqual(remaining, 2);
      assert.strictEqual(currentNode?.name, 'Process');
      assert.strictEqual(mockGraph.name, 'Operating Systems');
    });

    it('renders progress summary text and accessible progressbar', () => {
      assert.ok(
        studySpaceSrc.includes('Concept {unfinishedSessionInfo.position} of {unfinishedSessionInfo.total} · {unfinishedSessionInfo.remaining} remaining'),
        'Must format progress summary string exactly as specified'
      );
      assert.ok(
        studySpaceSrc.includes('role="progressbar"'),
        'Must include progressbar role for accessibility'
      );
      assert.ok(
        studySpaceSrc.includes('className="study-continue-progress-fill"'),
        'Must include progress fill element'
      );
    });

    it('wires the primary action button to resume at exact paused concept', () => {
      assert.ok(
        studySpaceSrc.includes('onNavigateToRevision?.(unfinishedSessionInfo.currentConceptId)'),
        'Must call onNavigateToRevision with the paused concept ID'
      );
      assert.ok(
        studySpaceSrc.includes('Continue revision'),
        'Must display "Continue revision" on primary action'
      );
    });
  });

  describe('3. Swiss Editorial Styling & Tokens', () => {
    it('defines required styling tokens for continue revision section in studySpace.css', () => {
      assert.ok(cssSrc.includes('.study-continue-revision-section'), 'Must style .study-continue-revision-section');
      assert.ok(cssSrc.includes('.study-continue-revision-card'), 'Must style .study-continue-revision-card');
      assert.ok(cssSrc.includes('.study-continue-concept-title'), 'Must style .study-continue-concept-title');
      assert.ok(cssSrc.includes('.study-continue-progress-track'), 'Must style .study-continue-progress-track');
      assert.ok(cssSrc.includes('.study-continue-progress-fill'), 'Must style .study-continue-progress-fill');
      assert.ok(cssSrc.includes('.study-continue-empty-section'), 'Must style .study-continue-empty-section');
      assert.ok(cssSrc.includes('.study-continue-empty-card'), 'Must style .study-continue-empty-card');
    });

    it('uses the signature lime accent #A3FF12 for the progress fill', () => {
      assert.match(
        cssSrc,
        /\.study-continue-progress-fill\s*\{[\s\S]*?var\(--accent,\s*#A3FF12\);/
      );
    });

    it('implements responsive rules for smaller screens', () => {
      assert.ok(
        cssSrc.includes('@media (max-width: 640px)'),
        'Must include responsive breakpoint for mobile screens'
      );
      assert.ok(
        cssSrc.includes('.study-continue-revision-card'),
        'Must style revision card under mobile query'
      );
    });
  });
});
