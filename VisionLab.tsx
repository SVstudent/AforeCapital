
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MASTER_TUTOR_PROMPT } from './constants';

const VisionLab: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setSelectedImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const runAnalysis = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = selectedImage.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
            { text: "Analyze this work. Identify the specific moment the logic diverges and ask a Socratic guiding question. Do not solve it for me." }
          ]
        },
        config: {
          systemInstruction: MASTER_TUTOR_PROMPT
        }
      });

      setAnalysis(response.text);
    } catch (error) {
      console.error("Vision Analysis Error:", error);
      setAnalysis("The reasoning engine encountered a visual parsing error. Please ensure the image is clear.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Multimodal Vision Lab</h2>
        <p className="text-white/50 max-w-lg">Upload your handwritten work or diagrams. Aura will 'see' your logic flow and identify conceptual divergence points.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload & Preview */}
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`aspect-video rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center relative overflow-hidden group ${
              selectedImage ? 'border-violet-500/50' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            }`}
          >
            {selectedImage ? (
              <>
                <img src={selectedImage} alt="Preview" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-sm font-medium bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md border border-white/20">Replace Image</span>
                </div>
              </>
            ) : (
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-white/5 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:bg-violet-600/20 transition-colors">
                  <svg className="w-8 h-8 text-white/20 group-hover:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <h4 className="font-semibold mb-1">Upload Work</h4>
                <p className="text-xs text-white/40">PDF, JPG, or PNG (Max 10MB)</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
          </div>
          
          <button 
            disabled={!selectedImage || isAnalyzing}
            onClick={runAnalysis}
            className={`w-full py-4 rounded-2xl font-bold tracking-widest uppercase text-xs transition-all flex items-center justify-center gap-2 ${
              selectedImage && !isAnalyzing 
                ? 'bg-violet-600 text-white hover:bg-violet-500' 
                : 'bg-white/5 text-white/20 border border-white/5'
            }`}
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Initializing Neural Parsing...
              </>
            ) : (
              'Run Reasoning Sequence'
            )}
          </button>
        </div>

        {/* Analysis Result */}
        <div className="glass rounded-3xl p-8 border border-white/10 min-h-[400px] flex flex-col">
          <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
             <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"/><path d="m4.93 4.93 14.14 14.14"/><path d="M2 12h20"/><path d="m19.07 4.93-14.14 14.14"/></svg>
             </div>
             <div>
               <h3 className="font-semibold">Socratic Insight</h3>
               <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Concept Divergence Mapping</p>
             </div>
          </div>

          <div className="flex-1">
            {analysis ? (
              <div className="prose prose-invert max-w-none animate-in fade-in slide-in-from-left-2">
                <p className="text-white/80 leading-relaxed italic border-l-2 border-violet-500 pl-4 py-2">
                  {analysis}
                </p>
                <div className="mt-8 space-y-4">
                   <div className="text-xs font-bold text-white/30 uppercase">Suggested Logic Pathway</div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">A: Re-evaluate Torque Components</div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">B: Check Unit Dimensions</div>
                   </div>
                </div>
              </div>
            ) : isAnalyzing ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                 <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-600 animate-progress origin-left"></div>
                 </div>
                 <p className="text-sm font-mono text-white/20 animate-pulse">Scanning vector discrepancies...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-white/20">
                <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M22 10V4a2 2 0 0 0-2-2h-6"/><path d="m22 2-10.1 10.1"/><circle cx="12" cy="12" r="3"/></svg>
                <p className="text-sm font-medium">Ready for visual logic analysis.<br/>Please upload a diagram to begin.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisionLab;
