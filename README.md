<div align="center">

# GraphMind

### *Turn your material into connected knowledge.*

An intelligent learning workspace that transforms raw study materials—textbooks, lecture notes, and PDFs—into interactive, multi-dimensional knowledge graphs guided by a procedural 3D AI companion.

[![Live Demo](https://img.shields.io/badge/Demo-graph--mind--sandy.vercel.app-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://graph-mind-sandy.vercel.app)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)

</div>

---

## 🌟 Overview

**GraphMind** goes beyond linear reading and traditional flashcards. It analyzes complex technical documents, maps the underlying conceptual taxonomy, and visualizes knowledge as an interconnected topological graph.

With real-time PDF extraction, Gemini-powered semantic concept modeling, and a procedural 3D humanoid companion with lip-sync and gaze tracking, GraphMind creates an immersive, tactile cognitive space for deep mastery.

---

## ✨ Key Features

### 🔮 Interactive 3D Knowledge Orb
- **Volumetric particle physics**: Over 1,200 depth-stratified particles dynamically bound by sparse semantic relationship networks.
- **Continuous scroll dissolution**: Smooth exponential approach physics dynamically disassemble the orb into the workspace as you explore.
- **Gyroscopic 3D tilt**: Responds organically to cursor motion with symplectic Euler integration and momentum damping.
- **Surface-aware contact lens**: Near-cursor particle repulsion and boundary attraction for tactile kinetic feedback.

### 🤖 3D AI Persona Companion
- **Procedural 3D Humanoid**: Real-time WebGL character stage rendering facial morph targets, natural eye saccades, breathing cycles, and head tracking.
- **Real-Time Lip Sync**: Acoustic syllable and viseme estimation synced with conversational speech synthesis.
- **Contextual Learning Observations**: Evaluates your recent assessment scores, concept retention, and unfinished revision sessions without gamified streaks or fake percentages.
- **Actionable Next-Step Engine**: Guides you directly to weak concepts, baseline tests, or material uploads based on authoritative evidence.

### 🕸️ Multi-Graph Workspace Architecture
- **Complete Scope Isolation**: Manage multiple independent graphs (e.g., *Operating Systems*, *Machine Learning*, *Database Internals*).
- **Zero Data Leakage**: Sources, concepts, relationships, revision sessions, and assessment attempts remain strictly isolated per graph.
- **Instant Switching & Renaming**: Seamless workspace switching and inline graph renaming with persistent localStorage state.
- **Graceful Zero-Graph Onboarding**: Clean, friendly empty-state guidance for first-time learners.

### 📚 Adaptive Study Space & Concept Trajectories
- **Multi-Level Depth**: Progressive conceptual explanations from foundational intuitions (ELI5) to rigorous mathematical definitions and worked examples.
- **Prerequisite Dependencies**: Hierarchical prerequisite analysis identifying bottleneck concepts before advancing.
- **Verbatim Provenance**: Click any concept to view exact citation snippets and source attribution from your uploaded documents.

### 🎯 Active Recall & Knowledge Checks
- **Automated MCQ Generation**: Deterministically constructed test questions grounded directly in extracted concepts.
- **Performance Analytics**: Real arithmetic mean scoring, attempt history tracking, and concept mastery state transitions (untested → developing → mastered).
- **Targeted Revision Rail**: Focused spaced review queues prioritizing missed and flagged concepts.

### 📄 Ingestion & Synthesis Pipeline
- **Document Processing**: Client-side PDF parsing powered by `pdfjs-dist` with support for plain text and markdown.
- **Multi-Stage Synthesis**: Real-time pipeline orchestration displaying live extraction stages (`reading` → `analyzing` → `extracting` → `synthesizing`).
- **Gemini AI Integration**: High-fidelity concept extraction, relation labeling, and prerequisite graph construction.

---

## 🛠️ Technology Stack

| Domain | Technologies |
|---|---|
| **Core Framework** | React 19, TypeScript, Vite |
| **3D & Graphics** | Three.js, Custom GLSL Shaders, WebGL |
| **Graph Visualization** | `@xyflow/react` (React Flow), Force-Directed Physics |
| **Motion & Animation** | Framer Motion (reduced-motion accessible) |
| **Document Parsing** | PDF.js (`pdfjs-dist`) |
| **AI / LLM** | Google Gemini API (Structured concept & relationship extraction) |
| **Styling** | Vanilla CSS with curated dark-mode design system & tokens |
| **Testing & Quality** | Node Native Test Runner (`tsx --test`), Oxlint |
| **Deployment** | Vercel (Continuous Deployment) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** `v20.0.0` or higher
- **npm** `v9.0.0` or higher
- A **Google Gemini API Key** ([Get one from Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Deepanshu-2006/GraphMind.git
   cd GraphMind
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing & Validation

GraphMind includes an extensive suite of native TypeScript unit tests covering storage migrations, multi-graph isolation, 3D particle kinematics, persona observation systems, and recommendation logic:

```bash
# Run all unit test suites
npm test

# Run type check and production bundle verification
npm run build

# Run high-speed linter
npm run lint
```

---

## 📂 Project Architecture

```
GraphMind/
├── src/
│   ├── components/
│   │   ├── common/           # Error boundaries, tooltips, buttons
│   │   ├── graph/            # Knowledge graph canvas, nodes, edges & controls
│   │   ├── layout/           # AppShell, TopBar, Sidebar, GraphSwitcher
│   │   ├── modals/           # CreateGraphModal, NewGraphModal, DeleteGraphModal
│   │   ├── overview/         # HeroSection, KnowledgeOrb3D, spatial depth
│   │   ├── persona/          # 3D Humanoid canvas, speech, stats & panels
│   │   ├── revision/         # RevisionWorkspace, KnowledgeCheckSection
│   │   ├── settings/         # Settings view and data management
│   │   ├── sources/          # Document source list & upload dropzones
│   │   └── study/            # StudySpaceView, concept cards, tests & history
│   ├── context/
│   │   └── GraphContext.tsx  # Central multi-graph state, switching & dispatch
│   ├── data/                 # Benchmark graphs and demo datasets
│   ├── services/
│   │   ├── geminiService.ts  # Gemini API extraction & question generation
│   │   ├── pipelineOrchestrator.ts # Async end-to-end material ingestion
│   │   ├── personaObservations.ts  # Deterministic observation engine
│   │   ├── personaRecommendation.ts# Single high-leverage next action logic
│   │   ├── personaVoiceConfig.ts   # Speech synthesis voice calibration
│   │   ├── storage.ts        # Scoped multi-graph localStorage schema
│   │   └── textExtraction.ts # PDF & plain text document parsing
│   ├── types/                # Strict TypeScript contracts across all modules
│   └── App.tsx               # Primary application router & lifecycle
├── tests/                    # 100+ native unit & integration test suites
└── package.json
```

---

## 🔒 Privacy & Local-First Philosophy

- **Local Storage by Default**: Your knowledge graphs, assessment records, study progress, and revision states are persisted locally in your browser session.
- **Client-Side Document Parsing**: Text extraction happens directly inside your browser. Only extracted text chunks are dispatched to the Gemini API for semantic synthesis.
- **Zero Tracking**: No telemetry, analytics trackers, or third-party cookies.

---

## 📜 License

This project is licensed under the MIT License — feel free to use, modify, and build upon it.

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Deepanshu-2006">Deepanshu Khatri</a></sub>
</div>
