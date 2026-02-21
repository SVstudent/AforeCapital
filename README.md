<p align="center">
  <h1 align="center">🧠 LuminaOS</h1>
  <p align="center"><strong>AI-Native Education Operating System</strong></p>
  <p align="center">
    <em>Powered by Google Gemini 3 · Firebase · React 19</em>
  </p>
  <p align="center">
    <a href="https://academy-94e78.web.app">🌐 Live Demo</a> ·
    <a href="#features">✨ Features</a> ·
    <a href="#tech-stack">🛠 Tech Stack</a> ·
    <a href="#getting-started">🚀 Getting Started</a>
  </p>
</p>

---

## 🎯 The Problem

Education is facing a crisis of scale. **One teacher cannot personally tutor 30+ students.** Research consistently shows that 1-on-1 tutoring produces 2 standard deviations of improvement (Bloom's 2 Sigma Problem), but it's economically impossible to provide every student with a dedicated tutor.

Existing EdTech solutions fail because they treat AI as a bolt-on feature — a chatbot stuffed into a sidebar. Students don't engage with text-only interfaces the way they engage with a real conversation. Teachers get no visibility into what students are actually struggling with.

**LuminaOS solves this by making AI the operating system of education itself** — not an add-on, but the foundation.

---

## Overview

LuminaOS is a premium, AI-native education platform that fundamentally reimagines how students learn and how teachers teach. It replaces static LMS tools with a **living, intelligent system** where every interaction is powered by Google's Gemini 3 AI — from voice-native Socratic tutoring to real-time teacher analytics.

Unlike traditional education software, LuminaOS treats AI as a **first-class participant** in the learning process, not an afterthought. Students speak naturally with an AI tutor that listens, draws diagrams, and finds resources. Teachers get instant visibility into every AI-student interaction without lifting a finger.

---

## Features

### 🎙️ Lumina Sync — Voice-Native AI Tutoring

The flagship feature. Students open a **real-time voice session** with Lumina, an AI Socratic tutor powered by **Gemini 3 Native Audio**.

- **Natural Voice Dialogue**: Gemini 3's native audio model enables real conversational tutoring — no text-to-speech, no robotic responses. The AI thinks and responds directly in voice.
- **Neural Soundwave Visualizer**: A 5-bar animated soundwave pulses in real-time with the student's and AI's voice, providing an immersive, focus-driven interface.
- **AI-Powered Whiteboard**: During voice sessions, Lumina can generate educational diagrams, graphs, and illustrations directly onto a live canvas using **Gemini 3 Image Generation**.
- **Socratic Method**: Lumina doesn't give answers — it asks probing questions, guides reasoning, and helps students discover concepts themselves.
- **Session Summary & Resources**: After each session, Gemini 3 compiles topics covered and discovers real educational resources (Khan Academy, YouTube, Wikipedia) via **Google Search Grounding**.
- **Full Persistence**: Every voice session — transcript, topics, resources, engagement score — is automatically saved to **Firebase Firestore** for teacher review.

### 💬 Lumina Chat — Text-Based AI Tutoring

For quick questions or quieter environments, students can chat with Lumina via text.

- **Streaming AI Responses**: Powered by **Gemini 3 Flash**, responses stream in real-time for a natural conversational feel.
- **Incremental Session Persistence**: Chat sessions are saved to Firestore incrementally — every message is captured, not just the final state.
- **Topic Synthesis**: After a few exchanges, Gemini 3 automatically identifies the main topic being discussed and updates the session metadata for teacher analytics.
- **Context-Aware**: Lumina knows the student's classroom, assignments, and teacher context, providing personalized tutoring.

### 👨‍🏫 Teacher Assistant — AI-Powered Teaching Tools

Teachers get their own AI assistant for content creation and classroom management.

- **Assignment Generation**: Describe what you need, and Gemini 3 drafts complete assignments with rubrics.
- **Announcement Drafting**: Generate professional classroom announcements in seconds.
- **Quiz Creation**: Auto-generate quiz questions based on topics and difficulty level.
- **Class Performance Analysis**: AI analyzes student data and provides actionable insights.

### 📊 AI Learning Analytics Hub

Real-time teacher dashboard showing every student's AI interactions.

- **Lumina Session Feed**: Every voice and chat session appears instantly via Firestore `onSnapshot` real-time listeners.
- **Engagement Scoring**: Each session gets an AI-calculated engagement score (1-10) based on interaction depth.
- **Topic Tracking**: See exactly what topics students are exploring with AI assistance.
- **AI Grading Insights**: When students use "Analyze My Progress," the AI grading results are persisted and displayed in real-time.

### 🎓 Student Dashboard

- **Classroom Overview**: See all enrolled classrooms with instructor info and upcoming assignments.
- **Assignment Management**: View, submit, and track assignments with AI-powered progress analysis.
- **Vision Lab**: Upload images for AI-powered visual analysis and educational insights using Gemini 3's multimodal capabilities.

### 🔐 Authentication & Security

- **Firebase Auth**: Secure authentication with email/password and **Google Sign-In** (one-click OAuth).
- **Role-Based Access**: Distinct Student and Teacher experiences with appropriate permissions.
- **Demo Mode**: Built-in demo credentials on the login page for instant access during evaluations.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript | Component architecture with type safety |
| **Styling** | Tailwind CSS | Utility-first responsive design system |
| **AI — Voice** | Gemini 3 Native Audio | Real-time voice tutoring (Lumina Sync) |
| **AI — Text** | Gemini 3 Flash | Chat AI, grading, topic extraction, teacher tools |
| **AI — Vision** | Gemini 3 Image Generation | Live whiteboard diagrams and visual analysis |
| **AI — Search** | Google Search Grounding | Post-session educational resource discovery |
| **Database** | Firebase Firestore | Real-time NoSQL with `onSnapshot` listeners |
| **Auth** | Firebase Authentication | Email/password + Google OAuth |
| **Hosting** | Firebase Hosting | CDN-backed static site deployment |
| **Build** | Vite 6 | Lightning-fast HMR and optimized production builds |

---

## Google Integration Deep Dive

LuminaOS leverages **six Google products** to deliver a seamless AI-native experience:

### Gemini 3 Native Audio
The voice tutoring system (Lumina Sync) uses Gemini 3's native audio model — the AI processes speech and generates voice responses directly, without intermediate text-to-speech. This produces natural, conversational dialogue that feels like talking to a real tutor.

### Gemini 3 Flash
Every text-based AI interaction — chat responses, grading analysis, topic synthesis, teacher assistant tools — runs through Gemini 3 Flash for fast, intelligent processing.

### Gemini 3 Image Generation
During voice tutoring sessions, when a student asks about a visual concept (e.g., "graph y = x²"), the system uses Gemini 3's image generation to create educational diagrams that render directly on the whiteboard canvas.

### Google Search Grounding
After each tutoring session ends, the system uses Google Search grounding (built into Gemini 3's tool-use capabilities) to find real, verified educational resources — Khan Academy videos, Wikipedia articles, official documentation — related to the topics discussed.

### Firebase Firestore
All application data — user profiles, classrooms, assignments, AI sessions, grading insights — is stored in Firestore. Real-time `onSnapshot` listeners ensure teachers see student activity the moment it happens, with no manual refresh needed.

### Firebase Auth
One-click Google Sign-In plus traditional email/password authentication. Role-based access control separates student and teacher experiences.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Google Cloud project with Gemini API access
- A Firebase project with Firestore and Authentication enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/SVstudent/LuminaOS.git
cd LuminaOS

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Gemini 3 API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Development

```bash
npm run dev
```

Visit `http://localhost:3000`

### Production Build & Deploy

```bash
npm run build
firebase deploy --only hosting
```

---

## Project Structure

```
LuminaOS/
├── App.tsx                 # Root component, routing, auth state
├── LuminaSync.tsx          # Voice tutoring with Gemini 3 Native Audio
├── LuminaChat.tsx          # Text chat with Gemini 3 Flash
├── ClassroomView.tsx       # Classroom management & analytics
├── TeacherAssistant.tsx    # AI teaching tools
├── Dashboard.tsx           # Student home dashboard
├── TutorWhiteboard.tsx     # AI-powered drawing canvas
├── SessionSummary.tsx      # Post-session resource compilation
├── VisionLab.tsx           # Multimodal image analysis
├── Sidebar.tsx             # Navigation
├── constants.tsx           # AI prompts & color system
├── types.ts                # TypeScript interfaces
├── components/
│   └── LoginPage.tsx       # Auth with demo credentials
├── contexts/
│   └── AuthContext.tsx     # Firebase Auth state management
├── firebase/
│   └── config.ts           # Firebase initialization
├── hooks/
│   └── useClassroom.ts     # Real-time classroom data hook
└── lib/
    └── firestore.ts        # All Firestore CRUD & subscriptions
```

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| 🎓 Student | `DriJanet@fsd.com` | `studentpass` |
| 👨‍🏫 Teacher | `darwinteach@gmail.com` | `password` |

These are also available as **click-to-autofill** buttons on the login page.

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph Client ["React 19 Frontend"]
        UI["UI Components"]
        LS["Lumina Sync\n(Voice Tutoring)"]
        LC["Lumina Chat\n(Text Tutoring)"]
        TA["Teacher Assistant"]
        AH["Analytics Hub"]
    end

    subgraph Gemini3 ["Google Gemini 3"]
        NA["Native Audio\n(Voice Model)"]
        FL["Flash\n(Text Model)"]
        IG["Image Generation\n(Whiteboard)"]
        GS["Google Search\n(Grounding)"]
    end

    subgraph Firebase ["Firebase"]
        FS[("Firestore\n(Real-time DB)")]
        FA["Auth\n(Google OAuth)"]
        FH["Hosting\n(CDN)"]
    end

    LS -->|"WebSocket"| NA
    LS -->|"Image prompts"| IG
    LC -->|"Chat requests"| FL
    TA -->|"Content generation"| FL
    LS -->|"Resource discovery"| GS

    LS & LC & TA & AH <-->|"onSnapshot"| FS
    UI -->|"Auth state"| FA
    Client -->|"Static deploy"| FH
```

---

## 💡 Innovation & Wow Factor

LuminaOS introduces several novel approaches that don't exist in current EdTech:

| Innovation | Why It Matters |
|------------|----------------|
| **Voice-First AI Tutoring** | No education platform uses Gemini 3's native audio for real-time Socratic dialogue. Students speak naturally — no typing, no friction. |
| **AI-to-Whiteboard Pipeline** | Gemini 3 generates educational diagrams live during voice conversations. The AI doesn't just speak — it draws. |
| **Transparent AI Analytics** | Every AI-student interaction is fully visible to teachers in real-time. No black-box tutoring. Teachers see topics, engagement scores, and transcripts instantly. |
| **Dual-Persona AI System** | Students get a Socratic tutor; teachers get a content-creation assistant. Same platform, role-aware AI. |
| **Zero-Config Resource Discovery** | Google Search Grounding automatically finds verified educational resources after every session — no manual curation needed. |

---

## 🌍 Potential Impact

- **1.6 billion students** worldwide lack access to quality 1-on-1 tutoring
- LuminaOS democratizes the **2 Sigma advantage** — AI tutoring that adapts to each student, available 24/7
- **Teachers don't lose control** — they gain superpowers. Full visibility into AI interactions means they know exactly where students struggle
- **Scalable to any classroom size** — whether 5 students or 500, every student gets a personal AI tutor
- **Language-agnostic** — Gemini 3's native audio works across languages, breaking accessibility barriers

---

## 🛠️ How We Used Gemini 3

We leverage **four distinct Gemini 3 capabilities** across six integration points:

| Capability | Model | Where It's Used | What It Does |
|-----------|-------|-----------------|-------------|
| **Native Audio** | Gemini 3 Native Audio | Lumina Sync | Real-time voice tutoring — AI processes and responds in audio directly |
| **Text Generation** | Gemini 3 Flash | Lumina Chat, Teacher Assistant, AI Grading | Conversational AI, content creation, automated assessment |
| **Image Generation** | Gemini 3 Image Gen | Tutor Whiteboard | Generates educational diagrams and graphs during voice sessions |
| **Tool Use (Search)** | Gemini 3 + Google Search | Session Summary | Finds real educational resources after tutoring sessions |

**Total Gemini 3 integration points in codebase: 11** — including `LuminaSync.tsx`, `LuminaChat.tsx`, `ClassroomView.tsx`, `TeacherAssistant.tsx`, `VisionLab.tsx`, and `SessionSummary.tsx`.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
