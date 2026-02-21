
import React from 'react';
import { MASTER_TUTOR_PROMPT } from './constants';

const SystemPromptView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2 italic uppercase tracking-tighter">The Master Reasoning Prompt</h2>
        <p className="text-white/50">This 1,000+ word system instruction defines the entire pedagogical DNA of LuminaOS. It turns a generic LLM into a targeted Socratic Mentor.</p>
      </div>

      <div className="glass rounded-3xl border border-white/10 overflow-hidden">
        <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs font-mono font-bold text-white/60">LUMINA_SOCRATIC_V1_CORE.PROMPT</span>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(MASTER_TUTOR_PROMPT)}
            className="text-[10px] font-bold text-white/40 hover:text-white transition-colors"
          >
            COPY TO CLIPBOARD
          </button>
        </div>
        <div className="p-8 bg-[#020202] text-white/80 font-mono text-sm leading-relaxed overflow-x-auto">
          <pre className="whitespace-pre-wrap">
            {MASTER_TUTOR_PROMPT}
          </pre>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Anti-Hallucination', desc: 'Strict Chain-of-Thought enforcement before every student-facing response.' },
          { title: 'Emotional IQ', desc: 'Tone shifts dynamically based on student frustration markers.' },
          { title: 'Multimodal Sync', desc: 'Instructions for handling interleaved image and text reasoning.' },
        ].map(card => (
          <div key={card.title} className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <h4 className="font-bold text-violet-400 mb-2">{card.title}</h4>
            <p className="text-xs text-white/50">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SystemPromptView;
