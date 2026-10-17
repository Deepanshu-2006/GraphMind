# GraphMind Persona — Data Architecture Audit Report

This document is a comprehensive, evidence-grounded audit of the GraphMind codebase to determine how learning statistics, assessment performance, and graph activities are currently modeled, stored, and retrieved.

---

## A. Current Architecture Overview

GraphMind is currently implemented as a **client-side React 19 Single Page Application (SPA)** built with Vite and TypeScript, running entirely in the browser without an active backend web server or remote database:

* **Persistence Layer**: Browser `localStorage` acts as the persistent datastore for all entities (knowledge graphs, nodes, relationships, sources, completed concepts, assessment attempts, and revision sessions).
* **State Management**: Centralized React context (`src/context/GraphContext.tsx`) manages multi-graph workspace state, active graph metadata, loaded graph data, and completed concepts.
* **Services Layer**: Modular client-side services (`src/services/`) execute graph analysis, concept mastery tracking, test generation, evaluation, and attempt persistence.

---

## B. Knowledge Graph Data

| Requirement | Audit Finding | Exact File & Reference |
| :--- | :--- | :--- |
| **Storage System** | Browser `localStorage` using keys `graphmind_graphs_v1` (graph registry) and `graphmind_graph_data_v1_<graphId>` (individual graph payloads). | `src/services/storage.ts` (lines 20–37) |
| **Graph Schema** | `KnowledgeGraph`: `nodes: KnowledgeNode[]`, `relationships: KnowledgeRelationship[]`, `sources: KnowledgeSource[]`. Metadata: `KnowledgeGraphMeta`: `id`, `name`, `description`, `createdAt`, `updatedAt`. | `src/types/knowledgeGraph.ts` (lines 29–35, 150–159) |
| **User Association** | Graphs are currently scoped to the local device workspace. `KnowledgeGraphMeta` does not currently contain a `userId` column, though `auth.ts` provides `getCurrentUserId()` (`user-local-default`). | `src/services/storage.ts` (lines 254–260), `src/services/auth.ts` (lines 15–25) |
| **CRUD Functions** | `createGraph(name, desc)`, `loadGraphs()`, `renameGraph(id, name)`, `deleteGraph(id)`, `loadGraphData(id)`, `saveGraphData(id, graph)`. | `src/services/storage.ts` (lines 139–425) |
| **Graph Count** | `loadGraphs().length` reliably returns the exact count of graphs created by the user. | `src/services/storage.ts` (lines 139–169) |
| **Timestamps** | Both `createdAt` and `updatedAt` are persisted as ISO 8601 strings on every `KnowledgeGraphMeta` object. | `src/services/storage.ts` (lines 252–260) |
| **Nodes & Edges** | Fully persisted under each graph payload with unique node and relationship IDs. | `src/services/storage.ts` (lines 401–409) |
| **Recent Activity** | Can be identified by sorting `KnowledgeGraphMeta.updatedAt` descending, and comparing against the active graph ID stored in `graphmind_active_graph_id_v1`. | `src/services/storage.ts` (lines 187–206) |

---

## C. Assessment and Test Data

| Requirement | Audit Finding | Exact File & Reference |
| :--- | :--- | :--- |
| **Test Feature Exists?** | **YES**. A complete academic timed MCQ assessment engine exists with question generation, test execution, timers, scoring, and review screens. | `src/components/test/TestWorkspace.tsx` (lines 1–100), `src/services/knowledgeTestGenerator.ts` (lines 1–100) |
| **Storage Model** | Persisted permanently in `graphmind_assessment_attempts_v1` as an array of `AssessmentAttempt` objects. Historical snapshots freeze questions, selected options, correct answers, and explanations. | `src/services/assessmentHistory.ts` (lines 12–86), `src/types/test.ts` (lines 90–110) |
| **User Scoping** | **YES**. `AssessmentAttempt.userId` records the authenticated user ID (`auth.getCurrentUserId()`). `getAssessmentAttempts({ userId })` enforces user ownership isolation. | `src/services/assessmentHistory.ts` (lines 56–67) |
| **Scores & Maximums** | **YES**. `AssessmentAttempt.correctAnswers` (score), `totalQuestions` (total possible score), and `scorePercentage` (0–100 integer) are recorded for each attempt. | `src/types/test.ts` (lines 98–100) |
| **Timestamps** | **YES**. `createdAt` (test start timestamp) and `completedAt` (submission timestamp) are recorded in ISO 8601 format. | `src/types/test.ts` (lines 96–97) |
| **Multiple Attempts** | **YES**. Each attempt creates a new unique `id` (`attempt-<graphId>-<timestamp>-<rand>`). Attempts are appended and sorted newest-first by `completedAt`. | `src/services/assessmentHistory.ts` (lines 76–82) |
| **Recent & Average Score Calculation** | **YES**. Can be calculated directly: `getAssessmentAttempts()` returns attempts in chronological order; average score is `Math.round(attempts.reduce((acc, a) => acc + a.scorePercentage, 0) / attempts.length)`. | `src/components/study/StudySpaceView.tsx` (lines 2083–2085) |

---

## D. Revision Data

| Requirement | Audit Finding | Exact File & Reference |
| :--- | :--- | :--- |
| **Revision Tracking** | **YES**. `RevisionSessionState` tracks active revision progress for each graph under key `graphmind_revision_session_v1_<graphId>`. | `src/services/revisionSession.ts` (lines 24–68), `src/services/storage.ts` (lines 644–706) |
| **Reviewed Concepts** | **YES**. `RevisionSessionState.reviewedConceptIds: string[]` tracks completed concepts in session. `markedForReviewIds: string[]` tracks concepts explicitly flagged for review. Concept practice states also store `practiceCount` and `status` (`'unseen' \| 'learning' \| 'needs-review' \| 'understood'`). | `src/types/practice.ts` (lines 1–50), `src/services/storage.ts` (lines 762–809) |
| **Revision History** | **PARTIAL**. The *active/current* session and individual concept practice records are persisted permanently. However, closed past revision sessions do not have an append-only historical log table like assessment attempts do. | `src/services/storage.ts` (lines 644–744) |
| **Pending Revision Items** | **YES**. Identifiable via: 1) `getConceptsByKnowledgeState(graphId, 'needs-review')`, 2) `session.markedForReviewIds`, and 3) `conceptsNeedingAttention` in `computeUnifiedLearningOverview()`. | `src/services/storage.ts` (lines 850–859), `src/services/unifiedLearningOverview.ts` (lines 124–180) |
| **Revision Timestamps** | **YES**. `RevisionSessionState.createdAt` and `updatedAt`. Individual `ConceptPracticeState` records have `firstStudiedAt`, `lastStudiedAt`, and `lastPracticedAt`. | `src/services/storage.ts` (lines 697–698, 794–804) |
| **Revision Progress** | **YES**. In an active session: `Math.round((reviewedConceptIds.length / totalConcepts) * 100)`. Across the graph: `demonstratedPercentage` or `completedConcepts.length / nodes.length`. | `src/services/unifiedLearningOverview.ts` (lines 88–111) |

---

## E. Learning Progress Data

| Requirement | Audit Finding | Exact File & Reference |
| :--- | :--- | :--- |
| **Definition of Learning Activity** | Defined strictly by observable actions: studying a concept, completing formative knowledge checks, or submitting an academic test. Reading time alone or merely opening a page is explicitly disallowed from marking understanding. | `src/services/conceptMastery.ts` (lines 1–15), `src/services/unifiedLearningOverview.ts` (lines 102–111) |
| **Granularity of Tracking** | Tracked at the **concept level** (`ConceptPracticeState`, `ConceptMasterySummary`) and rolled up at the **graph level** (`GraphMasteryOverview`, `UnifiedLearningOverviewData`). | `src/services/conceptMastery.ts` (lines 69–100) |
| **Completed vs Incomplete** | **YES**. Distinguishable through: 1) `loadCompletedConceptIds(graphId)` (binary manual completion list), and 2) `ConceptMasteryStatus`: `'not-started'`, `'in-progress'`, `'needs-review'`, `'understanding-demonstrated'`. | `src/services/storage.ts` (lines 549–567), `src/services/conceptMastery.ts` (lines 41–54) |
| **Activity Timestamps** | **YES**. `AssessmentAttempt.completedAt`, `RevisionSessionState.updatedAt`, `ConceptPracticeState.lastStudiedAt`, and `KnowledgeGraphMeta.updatedAt`. | `src/services/storage.ts` (lines 801–804) |
| **Learning Streak** | **NOT AVAILABLE**. No streak counter or daily login streak model exists in the codebase. Tests explicitly state GraphMind avoids gamification metrics: *"generates restrained summary without XP, streaks, or fake statistics"*. | `tests/activeRecallGraphExperience.test.ts` (lines 345–346) |
| **Knowledge Retention** | **NOT AVAILABLE**. No Ebbinghaus forgetting curve, half-life model, or retention rate calculation exists in the codebase. Any displayed retention percentage would be fabricated. | Codebase search confirms 0 retention calculations. |

---

## F. Authentication and Data Ownership

| Requirement | Audit Finding | Exact File & Reference |
| :--- | :--- | :--- |
| **Current User Identity** | Resolved via `getCurrentUser(): AuthUser \| null` and `getCurrentUserId(): string \| null`. Defaults to `{ id: 'user-local-default', name: 'Local Scholar' }` stored in localStorage under `graphmind_current_user_v1`. | `src/services/auth.ts` (lines 9–57) |
| **Data Association** | `AssessmentAttempt` explicitly records `userId`. `KnowledgeGraphMeta` and `RevisionSessionState` currently lack an explicit `userId` attribute because storage is local to the device. | `src/services/assessmentHistory.ts` (lines 59–67), `src/services/storage.ts` (lines 254–260) |
| **Server-Side Endpoints** | None. The application is a client-only single-page application without a backend API or server actions. | `package.json` (lines 1–34) |
| **Ownership Restriction** | `getAssessmentAttempts()` and `getAssessmentAttemptById()` enforce ownership isolation against `targetUserId`, throwing `AssessmentAccessDeniedError` if attempting to access another user's attempt ID. | `src/services/assessmentHistory.ts` (lines 92–122) |
| **Exposure Risks** | All local storage is readable by any script within the same origin. No remote server or multi-tenant database currently exists to leak cross-user data across different physical devices. | `src/services/storage.ts` (lines 20–37) |

---

## G. Reusable APIs and Components

The Persona dashboard can directly reuse existing core services and contexts without duplicating business logic:

1. **Graph Overview & Workspace State**:
   * `useGraph()` (`src/context/GraphContext.tsx`): Exposes `graphs` (total count, names, timestamps), `activeGraphId`, `activeGraph`, and `activeCompletedConceptIds`.
   * `loadGraphs()` (`src/services/storage.ts`): Retrieves all user graph metadata.
2. **Learning Overview & Progress**:
   * `computeUnifiedLearningOverview()` (`src/services/unifiedLearningOverview.ts`): Computes `demonstratedPercentage`, `demonstratedCount`, `needsReviewCount`, `totalConcepts`, `hasUnfinishedSession`, `unfinishedSession`, and `conceptsNeedingAttention`.
   * `loadGraphMasteryOverview()` (`src/services/conceptMastery.ts`): Returns status breakdown across all nodes in a graph.
3. **Assessment History & Scores**:
   * `getAssessmentAttempts()` (`src/services/assessmentHistory.ts`): Returns all historical test attempts sorted newest-first, providing exact percentages, raw scores, total questions, and timestamps.
4. **Revision Sessions & Difficult Concepts**:
   * `loadRevisionSession()` (`src/services/storage.ts`): Retrieves the active session with reviewed concept count and total concepts.
   * `getConceptsByKnowledgeState(graphId, 'needs-review')` (`src/services/storage.ts`): Retrieves concept IDs flagged as needing review.
5. **User Profile**:
   * `getCurrentUser()` (`src/services/auth.ts`): Provides user name (`Local Scholar`) and ID.

---

## H. Missing Data and Limitations

1. **Learning Streak**:
   * **Status**: NOT AVAILABLE.
   * **Why**: There is no streak model, counter, or daily activity ledger. A daily streak was intentionally avoided to adhere to GraphMind's quiet, anti-gamification design.
   * **Recommendation**: Do not fabricate a streak counter. Instead, display **"Active This Week"** or **"Last Active Date"** derived from `AssessmentAttempt.completedAt` and `ConceptPracticeState.lastStudiedAt`.
2. **Knowledge Retention**:
   * **Status**: NOT AVAILABLE.
   * **Why**: No memory decay algorithm (such as Ebbinghaus curve or spaced repetition interval multiplier) exists in the codebase.
   * **Recommendation**: Do not display a fake retention percentage. Instead, display **"Concepts Demonstrated"** (`demonstratedPercentage` from `computeUnifiedLearningOverview()`), which represents actual verified understanding.
3. **Graph-Specific vs Global Scope**:
   * The user may have multiple graphs. `getAssessmentAttempts()` can query all attempts across all graphs or filter by `activeGraphId`. The Persona dashboard should clarify whether it is presenting global user statistics or statistics for the active graph (or offer an active graph selector).

---

## I. Persona Dashboard Statistic Classification & Proposed Data-Source Mapping

| Planned Statistic | Dashboard Location | Classification | Proposed Data Source | Fallback / Empty State |
| :--- | :--- | :--- | :--- | :--- |
| **Total Knowledge Graphs Created** | LEFT (Activity) | **AVAILABLE** | `graphs.length` from `useGraph()` or `loadGraphs()`. | Displays `0` if no graphs created. |
| **Learning Progress** | LEFT (Activity) | **AVAILABLE** | `demonstratedPercentage` (0–100%) from `computeUnifiedLearningOverview()`. | Displays `0%` with "No concepts studied yet". |
| **Recent Graph Activity** | LEFT (Activity) | **AVAILABLE** | Most recent `updatedAt` / `createdAt` across `graphs` and `lastStudiedAt` from `unifiedLearningOverview.ts`. | Displays "No recent activity". |
| **Learning Streak** | LEFT (Activity) | **NOT AVAILABLE** | Not tracked in codebase. | Display **"Last Active"** date or omit entirely to respect anti-gamification design. |
| **Recent Test Scores** | RIGHT (Performance) | **AVAILABLE** | Latest attempts (`attempts.slice(0, 3)`) from `getAssessmentAttempts()`, displaying `scorePercentage` & `completedAt`. | Displays "No tests completed yet". |
| **Average Test Score** | RIGHT (Performance) | **AVAILABLE** | `Math.round(attempts.reduce((acc, a) => acc + a.scorePercentage, 0) / attempts.length)` from `assessmentHistory.ts`. | Displays `—` when `attempts.length === 0`. |
| **Revision Progress** | RIGHT (Performance) | **AVAILABLE** | `unfinishedSession.progressPercent` or `reviewedConceptIds.length / totalConcepts` from `loadRevisionSession()`. | Displays "No active revision session" or `0%`. |
| **Concepts Requiring Revision** | RIGHT (Performance) | **AVAILABLE** | `conceptsNeedingAttention` list from `computeUnifiedLearningOverview()` and `getConceptsByKnowledgeState(graphId, 'needs-review')`. | Displays "All concepts on track". |
| **Knowledge Retention** | RIGHT (Performance) | **NOT AVAILABLE** | No retention formula exists. | Substitute with verified metric: **"Concepts Demonstrated"** count / percentage. |

---

## J. Recommended Implementation Order for Subsequent Steps

1. **Data Hook (`usePersonaStats`)**:
   Create a clean, focused hook that aggregates data from `useGraph()`, `getAssessmentAttempts()`, `computeUnifiedLearningOverview()`, and `loadRevisionSession()` into structured `activityStats` and `performanceStats`.
2. **Left-Side Component (`PersonaActivityPanel`)**:
   Implement a quiet, elegant sidebar in `PersonaExperience.tsx` displaying Graphs Created, Overall Progress bar, and Recent Graph Activity with clean empty states.
3. **Right-Side Component (`PersonaPerformancePanel`)**:
   Implement the matching right sidebar displaying Recent Scores list, Average Score indicator, Revision Session Progress, and Concepts Needing Revision.
4. **Desktop & Responsive Layout in `PersonaExperience.tsx`**:
   Arrange the view in a 3-column layout (Left Panel, 3D Character Stage Center, Right Panel) with media queries to gracefully tuck or stack panels on tablet/mobile screens without obstructing the 3D character.
