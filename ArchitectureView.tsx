
import React from 'react';

const ArchitectureView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent italic">LUMINAOS BLUEPRINT</h1>
        <p className="text-sm font-mono text-white/30 uppercase tracking-[0.5em]">Systems Architecture v2.5 / Gemini 3 Integrated</p>
      </div>

      <section className="space-y-8">
        <div className="border-l-4 border-violet-600 pl-8 space-y-4">
          <h2 className="text-2xl font-bold text-white/90">PART 1: PRODUCT PHILOSOPHY</h2>
          <div className="prose prose-invert max-w-none">
            <h3 className="text-violet-400">1.1 Pedagogical Shift: From Answer-Seeking to Concept-Mastery</h3>
            <p>
              LuminaOS represents a fundamental pivot from "File Repository" LMS systems to a "Reasoning Partner" OS.
              By leveraging Gemini 3's native <strong>Chain-of-Thought</strong> capabilities, the system monitors
              the student's logic flow in real-time, refusing to provide final answers while providing
              "Cognitive Scaffolding" to help them bridge their own knowledge gaps.
            </p>
            <h3 className="text-violet-400">1.2 Social Impact: Democratizing Elite Tutoring</h3>
            <p>
              Every student, regardless of socio-economic status, receives a world-class Socratic mentor.
              This mentor possesses an infinite memory of the student's progress, understanding precisely
              where they struggle with conceptual leaps (e.g., from Algebra to Calculus).
            </p>
          </div>
        </div>

        <div className="border-l-4 border-emerald-600 pl-8 space-y-4">
          <h2 className="text-2xl font-bold text-white/90">PART 2: FULL-STACK GOOGLE ARCHITECTURE</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass p-6 rounded-2xl border border-white/10">
              <h4 className="font-bold text-emerald-400 mb-2">Compute & Hosting</h4>
              <ul className="text-xs space-y-2 text-white/60">
                <li className="flex justify-between"><span>Frontend:</span> <span className="text-white font-mono">Next.js 14 / Firebase</span></li>
                <li className="flex justify-between"><span>Backend:</span> <span className="text-white font-mono">Cloud Functions Gen 2</span></li>
                <li className="flex justify-between"><span>Real-time:</span> <span className="text-white font-mono">Firestore Live Sync</span></li>
              </ul>
            </div>
            <div className="glass p-6 rounded-2xl border border-white/10">
              <h4 className="font-bold text-emerald-400 mb-2">Memory & RAG</h4>
              <ul className="text-xs space-y-2 text-white/60">
                <li className="flex justify-between"><span>Vectors:</span> <span className="text-white font-mono">Vertex AI Search</span></li>
                <li className="flex justify-between"><span>Storage:</span> <span className="text-white font-mono">Google Cloud Storage</span></li>
                <li className="flex justify-between"><span>Auth:</span> <span className="text-white font-mono">Firebase Auth IAM</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 relative overflow-hidden">
          <h3 className="text-lg font-bold mb-4">Gemini 3 Split-Model Strategy</h3>
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1 space-y-2">
              <div className="p-4 bg-violet-600/10 border border-violet-500/20 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Latency Layer</span>
                <p className="text-sm font-semibold">Gemini 3 Flash</p>
                <p className="text-xs text-white/50">Handles conversational UI, instant feedback, and real-time streaming.</p>
              </div>
              <div className="p-4 bg-fuchsia-600/10 border border-fuchsia-500/20 rounded-xl">
                <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">Reasoning Layer</span>
                <p className="text-sm font-semibold">Gemini 3 Pro</p>
                <p className="text-xs text-white/50">Used for grading, syllabus generation, and complex diagram analysis.</p>
              </div>
            </div>
            <div className="w-48 h-48 border border-white/10 rounded-full flex items-center justify-center relative">
              <div className="absolute inset-0 bg-violet-500/10 blur-[40px] rounded-full"></div>
              <div className="text-center">
                <span className="text-2xl font-black">99.9%</span>
                <p className="text-[10px] uppercase font-bold text-white/40">Uptime</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ArchitectureView;
