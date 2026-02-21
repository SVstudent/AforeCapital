
import React, { useState, useRef, useEffect } from 'react';
import { Classroom, ClassTab, Announcement, Assignment, User, UserRole, Message, Attachment, RubricCriterion, ClassroomState, Topic, ClassRubric, LuminaTutorSession, StudentAIAnalytics, AIGradingInsight } from './types';
import { GoogleGenAI } from "@google/genai";
import LuminaSync from './LuminaSync';
import { LuminaTutorContainer } from './components/tutor/LuminaTutorContainer';
import TeacherAssistant from './TeacherAssistant';
import { marked } from 'marked';
import {
  AUTO_GRADE_PROMPT,
  AI_SUBMISSION_REVIEW_PROMPT,
} from './constants';
import {
  createAnnouncement,
  createAssignment as createFirestoreAssignment,
  createTopic as createFirestoreTopic,
  saveLuminaSession,
  updateStudentAIAnalytics,
  getClassroomLuminaSessions,
  getClassroomRubric,
  saveAIGradingInsight,
  subscribeToClassroomAIGradingInsights,
  subscribeToClassroomLuminaSessions,
} from './lib/firestore';

interface ClassroomViewProps {
  classroom: Classroom;
  currentUser: User;
  state: ClassroomState;
  onUpdate: (updates: Partial<ClassroomState>) => void;
}

const ClassroomView: React.FC<ClassroomViewProps> = ({ classroom, currentUser, state, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<ClassTab>('STREAM');

  // Assignment creation/viewing state
  const [viewingWorkId, setViewingWorkId] = useState<string | null>(null);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [createType, setCreateType] = useState<'assignment' | 'quiz' | 'question' | 'material' | 'topic'>('assignment');
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    topic: '',
    points: 100,
    scheduledDate: '',
    questionType: 'short-answer' as 'short-answer' | 'multiple-choice'
  });
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  // Worksheet Generator State
  const [isGeneratingWorksheet, setIsGeneratingWorksheet] = useState(false);
  const [wsPrompt, setWsPrompt] = useState('');
  const [wsPreview, setWsPreview] = useState<string | null>(null);
  const [isWsLoading, setIsWsLoading] = useState(false);

  // Quiz Generator State
  const [quizQuestions, setQuizQuestions] = useState<Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }>>([]);
  const [quizTopic, setQuizTopic] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // Grading & Review State
  const [isGrading, setIsGrading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // Internal Editor State
  const [editingAttachment, setEditingAttachment] = useState<{ assignmentId: string, attachmentId: string } | null>(null);
  const [isEditorPreview, setIsEditorPreview] = useState(true);

  // Stream/Announcement state
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');

  // Submission state
  const [submissionText, setSubmissionText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [showTurnInConfirm, setShowTurnInConfirm] = useState(false);

  const [showCreateWorkDropdown, setShowCreateWorkDropdown] = useState(false);

  // Student Auto-Grade & Analytics States
  const [autoGradeResult, setAutoGradeResult] = useState<{ score: string; feedback: string; criteriaScores: Array<{ name: string; score: number; maxScore: number; feedback: string }> } | null>(null);
  const [isAutoGrading, setIsAutoGrading] = useState(false);
  const [luminaSessions, setLuminaSessions] = useState<LuminaTutorSession[]>([]);
  const [aiGradingInsights, setAiGradingInsights] = useState<AIGradingInsight[]>([]);
  const aiHelpEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTeacher = currentUser.role === UserRole.TEACHER;
  const { announcements = [], assignments = [], topics = [], rubric } = state || {};

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);


  useEffect(() => {
    if (!classroom.id || !isTeacher) return;

    // Subscribe to AI Grading Insights in real-time
    const unsubInsights = subscribeToClassroomAIGradingInsights(classroom.id, (insights) => {
      setAiGradingInsights(insights);
    });

    // Subscribe to Lumina Sessions in real-time
    const unsubSessions = subscribeToClassroomLuminaSessions(classroom.id, (sessions) => {
      setLuminaSessions(sessions);
    });

    return () => {
      unsubInsights();
      unsubSessions();
    };
  }, [classroom.id, isTeacher]);

  const handlePostAnnouncement = async () => {
    if (!announcementText.trim()) return;

    try {
      // Write to Firestore - real-time subscription will update local state
      await createAnnouncement({
        classroomId: classroom.id,
        authorId: currentUser.id,
        authorName: currentUser.name,
        content: announcementText,
      });

      setAnnouncementText('');
      setIsPostingAnnouncement(false);
      setNotification("Announcement posted.");
    } catch (err) {
      console.error('Error posting announcement:', err);
      setNotification("Failed to post announcement.");
    }
  };

  const handleCreateAssignment = async () => {
    if (!editForm.title.trim()) return;

    try {
      // Handle topic creation separately
      if (createType === 'topic') {
        await createFirestoreTopic({
          classroomId: classroom.id,
          name: editForm.title,
          order: topics.length + 1,
          collapsed: false,
        });
        setIsCreatingAssignment(false);
        setEditForm({ title: '', description: '', dueDate: '', topic: '', points: 100, scheduledDate: '', questionType: 'short-answer' });
        setNotification("Topic created.");
        return;
      }

      // Write assignment to Firestore - real-time subscription will update local state
      const assignmentData: Parameters<typeof createFirestoreAssignment>[0] = {
        classroomId: classroom.id,
        title: editForm.title,
        description: editForm.description,
        dueDate: editForm.dueDate || (createType === 'material' ? '' : 'No due date'),
        topicId: editForm.topic || topics[0]?.id || '',
        status: editForm.scheduledDate ? 'scheduled' : 'assigned',
        type: (createType as string) === 'topic' ? 'assignment' : createType,
        points: createType === 'material' ? null : editForm.points,
        scheduledDate: editForm.scheduledDate || null,
        attachments: wsPreview ? [{
          id: 'ws-' + Date.now(),
          type: 'doc',
          title: 'AI Generated Worksheet',
          url: 'internal-editor://doc/ws-' + Date.now(),
          content: wsPreview
        }] : [],
        order: assignments.length + 1,
        quizQuestions: createType === 'quiz' && quizQuestions.length > 0 ? quizQuestions : null,
      };

      await createFirestoreAssignment(assignmentData);

      setIsCreatingAssignment(false);
      setEditForm({ title: '', description: '', dueDate: '', topic: '', points: 100, scheduledDate: '', questionType: 'short-answer' });
      setWsPreview(null);
      setCreateType('assignment');
      setQuizQuestions([]); // Reset quiz questions
      setQuizTopic('');
      setNotification(`${createType.charAt(0).toUpperCase() + createType.slice(1)} created.`);
    } catch (err) {
      console.error('Error creating assignment:', err);
      setNotification(`Failed to create ${createType}.`);
    }
  };

  const handleGenerateWorksheet = async () => {
    if (!wsPrompt.trim()) return;
    setIsWsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate a professional educational worksheet in Markdown format about: ${wsPrompt}. 
        Subject: ${editForm.topic}. 
        
        Strict Guidelines for Formatting:
        - Use standard Markdown (# for headers, ** for bold, - for lists).
        - AVOID LaTeX math notation (e.g., avoid \mathbf, \frac, $...$).
        - Use standard text-based math notation (e.g., a = (vf - vi) / t, m/s^2, 10 * 5) for clarity in all viewers.
        - Section 1: # Learning Objectives
        - Section 2: # Conceptual Review
        - Section 3: # Practice Problems (Include 5 problems). Leave space like: \n\n___ (Answer here) ___\n\n
        - Section 4: # Neural Challenge (Critical thinking).
        - At the end, include a clear "Teacher Answer Key" section.`,
        config: { thinkingConfig: { thinkingBudget: 24000 } }
      });
      setWsPreview(response.text || "Failed to generate worksheet.");
    } catch (e) {
      setNotification("Worksheet engine failure.");
    } finally {
      setIsWsLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!quizTopic.trim()) return;
    setIsGeneratingQuiz(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a ${quizDifficulty} difficulty quiz with exactly ${numberOfQuestions} multiple choice questions about: "${quizTopic}".
        
        Subject context: ${classroom.name}
        
        Return ONLY valid JSON in this exact format with no additional text:
        {
          "questions": [
            {
              "question": "What is ...?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctIndex": 0,
              "explanation": "Brief explanation of why this is correct"
            }
          ]
        }
        
        Requirements:
        - Each question must have exactly 4 options
        - correctIndex is 0-3 indicating which option is correct
        - Make questions progressively harder if difficulty is "hard"
        - Include real educational value
        - Explanations should be educational and concise`
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          setQuizQuestions(parsed.questions);
          if (!editForm.title.trim()) {
            setEditForm(prev => ({ ...prev, title: `${quizTopic} Quiz` }));
          }
          setNotification(`Generated ${parsed.questions.length} questions!`);
        }
      }
    } catch (err) {
      console.error('[Quiz] Generation error:', err);
      setNotification('Failed to generate quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAiReview = async (studentName: string, asId: string) => {
    const as = assignments.find(a => a.id === asId);
    if (!as) return;

    setIsReviewing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `
          ASSIGNMENT: ${as.title}
          STUDENT: ${studentName}
          SUBMISSION: ${as.submission || "No text submission content."}
          TASK: ${AI_SUBMISSION_REVIEW_PROMPT}
        `,
        config: { thinkingConfig: { thinkingBudget: 24000 } }
      });
      onUpdate({
        assignments: assignments.map(a => a.id === asId ? { ...a, feedback: `🔍 REVIEW:\n${response.text}`, grade: 'Reviewed' } : a)
      });
      setNotification("AI Review complete.");
    } catch (e) {
      setNotification("Review engine saturated.");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleAiGrade = async (studentName: string, asId: string) => {
    const as = assignments.find(a => a.id === asId);
    if (!as) return;

    setIsGrading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `
          ASSIGNMENT: ${as.title}
          STUDENT: ${studentName}
          SUBMISSION: ${as.submission || "No text submission provided."}
          TASK: ${AUTO_GRADE_PROMPT}
        `,
        config: { thinkingConfig: { thinkingBudget: 24000 } }
      });
      onUpdate({
        assignments: assignments.map(a => a.id === asId ? { ...a, feedback: `🏆 GRADE:\n${response.text}`, grade: 'Graded' } : a)
      });
      setNotification("AI Grading complete.");
    } catch (e) {
      setNotification("Grading engine saturated.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleCreateWork = (type: 'doc' | 'slide' | 'sheet') => {
    if (!viewingWorkId) return;
    const assignment = assignments.find(a => a.id === viewingWorkId);
    if (!assignment) return;

    const newAttachment: Attachment = {
      id: `${type}-${Date.now()}`,
      type,
      title: `${currentUser.name} - ${assignment.title}`,
      url: `internal-editor://${type}/${Date.now()}`,
      content: type === 'sheet' ? 'Cell A1: \nCell B1: ' : ''
    };

    onUpdate({
      assignments: assignments.map(a => a.id === viewingWorkId ? { ...a, attachments: [...(a.attachments || []), newAttachment] } : a)
    });
    setShowCreateWorkDropdown(false);
    setNotification(`New ${type} attached.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!viewingWorkId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const isImage = file.type.startsWith('image/');

    // Simulate file upload by creating a local URL
    const fileUrl = URL.createObjectURL(file);

    const newAttachment: Attachment = {
      id: `file-${Date.now()}`,
      type: isImage ? 'image' : 'file',
      title: file.name,
      url: fileUrl,
    };

    onUpdate({
      assignments: assignments.map(a => a.id === viewingWorkId ? { ...a, attachments: [...(a.attachments || []), newAttachment] } : a)
    });
    setShowCreateWorkDropdown(false);
    setNotification(`${file.name} uploaded.`);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateAttachmentContent = (assignmentId: string, attachmentId: string, content: string) => {
    onUpdate({
      assignments: assignments.map(a => a.id === assignmentId ? {
        ...a,
        attachments: a.attachments?.map(att => att.id === attachmentId ? { ...att, content } : att)
      } : a)
    });
  };

  const handleTurnIn = (id: string) => {
    onUpdate({
      assignments: assignments.map(a => a.id === id ? { ...a, status: 'turned-in', submission: submissionText } : a)
    });
    setViewingWorkId(null);
    setShowTurnInConfirm(false);
    setSubmissionText('');
    setNotification("Work turned in.");
  };

  const handleMarkAsDone = (id: string) => {
    onUpdate({
      assignments: assignments.map(a => a.id === id ? { ...a, status: 'turned-in' } : a)
    });
    setViewingWorkId(null);
    setNotification("Marked as done.");
  };

  const handleUnsubmit = (id: string) => {
    onUpdate({
      assignments: assignments.map(a => a.id === id ? { ...a, status: 'assigned' } : a)
    });
    setNotification("Unsubmitted.");
  };


  // Auto-grade against class rubric
  const handleAutoGrade = async (assignment: Assignment) => {
    if (!rubric || !assignment.attachments?.length) {
      setNotification("Add some work first to check your progress!");
      return;
    }

    setIsAutoGrading(true);
    setAutoGradeResult(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        throw new Error("AI Credentials not found.");
      }

      const genAI = new GoogleGenAI({ apiKey });

      const workContent = assignment.attachments.map(a => `${a.title} (${a.type}):\n${a.content || '(External/File attachment)'}`).join('\n\n');

      const rubricText = rubric.criteria.map(c =>
        `${c.name} (${c.maxPoints} pts): ${c.description}\nLevels: ${c.levels.map(l => `${l.score}pts - ${l.description}`).join('; ')}`
      ).join('\n\n');

      const prompt = `You are grading a student's work against a specific rubric. Be fair, encouraging, and constructive.

ASSIGNMENT: ${assignment.title}
DESCRIPTION: ${assignment.description}

RUBRIC:
${rubricText}

STUDENT'S WORK:
${workContent}

Grade the work against EACH rubric criterion. Return a JSON object with this exact format:
{
  "score": "X/${rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0)}",
  "feedback": "Overall 1-2 sentence summary",
  "criteriaScores": [
    {"name": "criterion name", "score": earned_points, "maxScore": max_points, "feedback": "specific feedback for this criterion"}
  ]
}

Be encouraging but honest. If work is incomplete or uses external files that cannot be read, provide feedback based on what IS present. Return ONLY valid JSON.`;

      const result = await genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

      let parsed;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch {
        parsed = { score: "Unable to grade", feedback: "The AI had trouble formatting your results. Please try again with more detailed content.", criteriaScores: [] };
      }

      setAutoGradeResult(parsed);

      // Save insight for Teacher analytics
      if (parsed.score !== "Unable to grade") {
        saveAIGradingInsight({
          studentId: currentUser.id,
          studentName: currentUser.name,
          assignmentId: assignment.id,
          classroomId: classroom.id,
          score: parsed.score,
          feedback: parsed.feedback,
          criteriaScores: parsed.criteriaScores
        }).catch(err => console.error("[AutoGrade] Failed to save insight:", err));
      }
    } catch (error) {
      console.error("[AutoGrade] Error:", error);
      setAutoGradeResult({ score: "Error", feedback: "Couldn't connect to grading service. Try again.", criteriaScores: [] });
    }

    setIsAutoGrading(false);
  };

  const printWorksheet = (title: string, content: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !content) return;
    const renderedHtml = marked.parse(content);
    printWindow.document.write(`
      <html>
        <head>
          <title>LuminaOS | Worksheet - ${title}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 50px; line-height: 1.6; color: #111; max-width: 800px; margin: auto; }
            h1 { text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; font-size: 28px; margin-bottom: 20px; }
            h2 { margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; font-size: 22px; }
            h3 { font-size: 18px; margin-top: 20px; }
            p { margin: 10px 0; font-size: 16px; }
            ul, ol { margin-left: 20px; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 40px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
            .branding { text-align: center; color: #888; font-size: 10px; margin-top: 60px; font-family: sans-serif; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header-info">
            <div>Name: ____________________________</div>
            <div>Date: ________________</div>
          </div>
          <div class="worksheet-content">
            ${renderedHtml}
          </div>
          <div class="branding">Generated by LuminaOS | Socratic Neural Forge</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  if (editingAttachment) {
    const as = assignments.find(a => a.id === editingAttachment.assignmentId);
    const att = as?.attachments?.find(at => at.id === editingAttachment.attachmentId);
    if (!as || !att) { setEditingAttachment(null); return null; }
    const isSubmitted = as.status === 'turned-in' || as.status === 'graded';

    return (
      <div className="fixed inset-0 z-[500] bg-[#f8f9fa] flex flex-col font-sans animate-in fade-in zoom-in-95 duration-200">
        <header className="h-16 bg-white border-b border-[#dadce0] flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setEditingAttachment(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <svg className="w-6 h-6 text-[#5f6368]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className={`w-8 h-8 rounded flex items-center justify-center text-white font-black text-[10px] ${att.type === 'doc' ? 'bg-[#4285f4]' : att.type === 'slide' ? 'bg-[#f4b400]' : 'bg-[#0f9d58]'}`}>{att.type[0].toUpperCase()}</div>
            <h2 className="text-[18px] text-[#202124] font-normal truncate max-w-md">{att.title}</h2>
          </div>

          <div className="flex items-center gap-4">
            {att.type === 'doc' && (
              <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setIsEditorPreview(true)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${isEditorPreview ? 'bg-white shadow text-[#1a73e8]' : 'text-gray-500 hover:text-gray-700'}`}>Preview</button>
                <button onClick={() => setIsEditorPreview(false)} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!isEditorPreview ? 'bg-white shadow text-[#1a73e8]' : 'text-gray-500 hover:text-gray-700'}`}>Edit Source</button>
              </div>
            )}

            <button onClick={() => printWorksheet(att.title, att.content || '')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500" title="Print to PDF">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            </button>

            {isSubmitted ? <span className="text-sm font-medium text-gray-400 italic">View only</span> : (
              <button onClick={() => { setEditingAttachment(null); handleTurnIn(as.id); }} className="bg-[#4285f4] text-white px-6 py-2 rounded font-bold text-sm hover:bg-[#1a73e8] transition-colors">Turn in</button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 flex justify-center bg-[#f8f9fa]">
          {att.type === 'doc' && (
            <div className="w-full max-w-[850px] bg-white shadow-lg min-h-[1100px] border border-[#dadce0] p-16 animate-in fade-in duration-300">
              {isEditorPreview ? (
                <div className="worksheet-preview font-serif text-black" dangerouslySetInnerHTML={{ __html: marked.parse(att.content || '*No content yet.*') }} />
              ) : (
                <textarea
                  readOnly={isSubmitted}
                  value={att.content || ''}
                  onChange={(e) => updateAttachmentContent(as.id, att.id, e.target.value)}
                  className="w-full h-full text-[16px] leading-relaxed text-[#202124] bg-transparent outline-none resize-none font-mono"
                  placeholder="Start typing your document in Markdown..."
                />
              )}
            </div>
          )}
          {att.type === 'slide' && (
            <div className="aspect-video w-full max-w-[960px] bg-white shadow-xl border border-[#dadce0] p-12 flex flex-col justify-center items-center text-center">
              <textarea readOnly={isSubmitted} value={att.content || ''} onChange={(e) => updateAttachmentContent(as.id, att.id, e.target.value)} className="w-full text-[48px] font-bold text-[#202124] bg-transparent outline-none resize-none text-center" placeholder="Click to add title" rows={2} />
            </div>
          )}
          {att.type === 'sheet' && (
            <div className="w-full max-w-[1200px] bg-white shadow-lg border border-[#dadce0] flex flex-col">
              <textarea readOnly={isSubmitted} value={att.content || ''} onChange={(e) => updateAttachmentContent(as.id, att.id, e.target.value)} className="w-full h-[600px] p-4 bg-transparent outline-none font-mono text-[13px] resize-none" placeholder="Data rows..." />
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'STREAM':
        return (
          <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mt-10 px-6">
            <div className="md:col-span-1 hidden md:block space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Upcoming</h5>
                {assignments.filter(a => a.status === 'assigned').slice(0, 2).map(a => (
                  <div
                    key={a.id}
                    onClick={() => { setActiveTab('CLASSWORK'); setViewingWorkId(a.id); }}
                    className="mb-4 last:mb-0 group cursor-pointer"
                  >
                    <p className="text-[13px] font-bold text-slate-700 truncate leading-tight group-hover:text-indigo-600 transition-colors">{a.title}</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">Due {a.dueDate}</p>
                  </div>
                ))}
                {assignments.filter(a => a.status === 'assigned').length === 0 && (
                  <p className="text-[11px] text-slate-400 italic">Woohoo, no work due soon!</p>
                )}
                <button className="text-[12px] font-black text-indigo-600 mt-4 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all w-full text-left" onClick={() => setActiveTab('CLASSWORK')}>View all tasks</button>
              </div>

              {/* Class Rubric Section */}
              {rubric && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm shadow-slate-100">
                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-5 h-5 bg-violet-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3 h-3 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    Standards
                  </h5>
                  <p className="text-[11px] font-bold text-slate-600 mb-4">{rubric.name}</p>
                  <div className="space-y-3">
                    {rubric.criteria.slice(0, 3).map((criterion, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-2xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-bold text-slate-700">{criterion.name}</span>
                          <span className="text-indigo-600 font-black text-[10px] bg-white px-1.5 py-0.5 rounded-md shadow-sm border border-slate-100">{criterion.maxPoints} pts</span>
                        </div>
                      </div>
                    ))}
                    {rubric.criteria.length > 3 && (
                      <p className="text-[10px] font-bold text-slate-400 text-center pt-1">+{rubric.criteria.length - 3} more criteria</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="md:col-span-3 space-y-6">
              <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
                {!isPostingAnnouncement ? (
                  <div className="p-6 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-all group" onClick={() => setIsPostingAnnouncement(true)}>
                    <div className="relative">
                      <img src={currentUser.avatar} className="w-11 h-11 rounded-2xl border-2 border-slate-100 shadow-sm" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                    </div>
                    <span className="text-[15px] font-medium text-slate-400 flex-1">Share something with your class...</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    <textarea
                      autoFocus
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="Share with your class..."
                      className="w-full min-h-[140px] p-4 text-[15px] outline-none bg-slate-50 rounded-2xl focus:bg-white border-2 border-transparent focus:border-indigo-500/20 transition-all resize-none shadow-inner"
                    />
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setIsPostingAnnouncement(false)} className="px-5 py-2.5 text-[14px] font-black text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                      <button onClick={handlePostAnnouncement} className="px-8 py-2.5 text-[14px] font-black bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-all">Post</button>
                    </div>
                  </div>
                )}
              </div>
              {announcements.map(ann => (
                <div key={ann.id} className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all space-y-6">
                  <div className="flex items-center gap-4">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${ann.author}`} className="w-12 h-12 rounded-2xl border-2 border-slate-50 shadow-sm" />
                    <div>
                      <h4 className="text-[15px] font-black text-slate-800">{ann.author}</h4>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{new Date(ann.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="text-[15px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{ann.content}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case 'CLASSWORK':
        if (viewingWorkId) {
          const as = assignments.find(a => a.id === viewingWorkId);
          if (!as) return null;
          const isSubmitted = as.status === 'turned-in' || as.status === 'graded';
          const hasAttachments = (as.attachments?.length || 0) > 0;

          return (
            <div className="max-w-[1100px] mx-auto mt-10 space-y-8 px-6 animate-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => setViewingWorkId(null)}
                className="flex items-center gap-2 text-[13px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200/60 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg> Back to class
              </button>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                <div className="md:col-span-3 space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${as.type === 'assignment' ? 'bg-indigo-600 shadow-indigo-200' :
                        as.type === 'quiz' ? 'bg-violet-600 shadow-violet-200' :
                          as.type === 'question' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-slate-600 shadow-slate-200'
                        }`}>
                        {as.type === 'assignment' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                        {as.type === 'quiz' && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
                      </div>
                      <h2 className="text-4xl font-black text-slate-800 leading-tight tracking-tight">{as.title}</h2>
                    </div>
                    <div className="flex items-center gap-4 text-[13px] font-bold text-slate-400 border-b border-slate-200/60 pb-6">
                      <div className="flex items-center gap-2">
                        <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${classroom.teacher}`} className="w-6 h-6 rounded-lg border border-slate-100" />
                        <span className="text-slate-700">{classroom.teacher}</span>
                      </div>
                      <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Due {as.dueDate}
                      </span>
                    </div>
                  </div>
                  <div className="text-[16px] text-slate-600 font-medium leading-[1.6] py-2 whitespace-pre-wrap">{as.description}</div>

                  {isTeacher && as.status === 'turned-in' && (
                    <div className="bg-white p-6 rounded-lg border border-[#dadce0] space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-800">Review Student Work</h4>
                        <div className="flex gap-2">
                          <button onClick={() => handleAiReview('Student', as.id)} disabled={isReviewing} className="bg-[#5f6368] text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 hover:bg-[#3c4043]">
                            {isReviewing ? 'Reviewing...' : '🔍 AI Review'}
                          </button>
                          <button onClick={() => handleAiGrade('Student', as.id)} disabled={isGrading} className="bg-[#1a73e8] text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 hover:bg-[#1557b0]">
                            {isGrading ? 'Grading...' : '✨ AI Grade'}
                          </button>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded border text-sm italic text-gray-600">
                        {as.submission || "No text submission content found."}
                      </div>
                      {as.feedback && (
                        <div className="p-4 border-l-4 border-blue-500 bg-blue-50">
                          <h5 className="text-xs font-bold text-blue-800 uppercase mb-2">AI Feedback & Assessment</h5>
                          <div className="text-sm text-gray-800 whitespace-pre-wrap">{as.feedback}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {!isTeacher && (
                    <div className="space-y-4 pt-4 border-t border-[#f1f3f4]">
                      {/* Quiz Questions UI */}
                      {as.type === 'quiz' && as.quizQuestions && as.quizQuestions.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#7c4dff] rounded-full flex items-center justify-center text-white">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                            </div>
                            <div>
                              <h4 className="text-[14px] font-bold text-[#3c4043]">Quiz ({as.quizQuestions.length} Questions)</h4>
                              <p className="text-[11px] text-[#5f6368]">Select the best answer for each question</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {as.quizQuestions.map((q, qIndex) => {
                              const selectedAnswer = as.studentAnswers?.[qIndex] ?? -1;
                              return (
                                <div key={qIndex} className="bg-white p-5 rounded-xl border border-[#dadce0] shadow-sm space-y-3">
                                  <p className="text-[14px] font-medium text-[#3c4043]">
                                    <span className="text-[#7c4dff] font-bold mr-2">Q{qIndex + 1}.</span>
                                    {q.question}
                                  </p>
                                  <div className="space-y-2">
                                    {q.options.map((opt, optIndex) => (
                                      <button
                                        key={optIndex}
                                        disabled={isSubmitted}
                                        onClick={() => {
                                          const updatedAnswers = [...(as.studentAnswers || new Array(as.quizQuestions!.length).fill(-1))];
                                          updatedAnswers[qIndex] = optIndex;
                                          onUpdate({
                                            assignments: assignments.map(a =>
                                              a.id === as.id ? { ...a, studentAnswers: updatedAnswers } : a
                                            )
                                          });
                                        }}
                                        className={`w-full text-left p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${selectedAnswer === optIndex
                                          ? 'border-[#7c4dff] bg-purple-50 text-[#7c4dff]'
                                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-[#3c4043]'
                                          } ${isSubmitted ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      >
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedAnswer === optIndex
                                          ? 'border-[#7c4dff] bg-[#7c4dff] text-white'
                                          : 'border-gray-300'
                                          }`}>
                                          {selectedAnswer === optIndex && (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                          )}
                                        </div>
                                        <span className="text-[13px] font-medium">
                                          <span className="text-gray-400 mr-2">{String.fromCharCode(65 + optIndex)}.</span>
                                          {opt}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Progress indicator */}
                          <div className="flex items-center justify-between text-[12px] text-[#5f6368] p-3 bg-gray-50 rounded-lg">
                            <span>
                              {(as.studentAnswers?.filter(a => a !== -1).length || 0)} of {as.quizQuestions.length} answered
                            </span>
                            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#7c4dff] transition-all"
                                style={{ width: `${((as.studentAnswers?.filter(a => a !== -1).length || 0) / as.quizQuestions.length) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Regular text answer for non-quiz assignments */
                        <>
                          <h4 className="text-[14px] font-bold text-[#3c4043]">Your Answer</h4>
                          <textarea disabled={isSubmitted} value={submissionText} onChange={e => setSubmissionText(e.target.value)} className="w-full min-h-[200px] p-6 bg-white border border-[#dadce0] rounded-lg outline-none focus:border-[#1e8e3e] text-[14px] transition-all" placeholder="Type your final response here..." />

                          {/* AI Study Tools Relocated Here */}
                          <div className="border-t border-slate-100 pt-8 mt-8">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                <span className="text-xl">✨</span>
                              </div>
                              <div>
                                <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] block">Lumina AI Study Buddy</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Knowledge Analysis & Feedback</span>
                              </div>
                              <div className="h-[1px] flex-1 bg-gradient-to-r from-indigo-100 to-transparent ml-4"></div>
                            </div>

                            <div className="max-w-md">
                              <button
                                onClick={() => handleAutoGrade(as)}
                                disabled={isAutoGrading}
                                className="w-full py-5 bg-white border-2 border-emerald-50 hover:border-emerald-200 text-emerald-700 hover:shadow-xl hover:shadow-emerald-50 rounded-[2rem] flex items-center justify-center gap-4 transition-all duration-500 active:scale-95 disabled:opacity-50"
                              >
                                {isAutoGrading ? (
                                  <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                                <span className="text-[13px] font-black uppercase tracking-widest">{isAutoGrading ? 'Synthesizing Feedback...' : 'Analyze My Progress'}</span>
                              </button>
                            </div>

                            {/* Auto-Grade Result */}
                            {autoGradeResult && (
                              <div className="bg-white border-2 border-amber-100 rounded-[2.5rem] p-8 mt-8 shadow-xl shadow-amber-50 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-center mb-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    </div>
                                    <p className="text-[14px] font-black text-amber-800 uppercase tracking-widest">Cognitive Progress Check</p>
                                  </div>
                                  <div className="px-6 py-2 bg-amber-600 text-white rounded-full font-black text-lg shadow-lg shadow-amber-100">
                                    {autoGradeResult.score}
                                  </div>
                                </div>
                                <p className="text-[15px] font-medium text-amber-900/80 leading-relaxed mb-6 bg-amber-50/50 p-6 rounded-[1.5rem] border border-amber-50">
                                  {autoGradeResult.feedback}
                                </p>
                                {autoGradeResult.criteriaScores?.length > 0 && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {autoGradeResult.criteriaScores.map((c, idx) => (
                                      <div key={idx} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm">
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{c.name}</span>
                                          <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-black">{c.score}/{c.maxScore}</span>
                                        </div>
                                        <p className="text-[12px] text-slate-600 font-medium leading-relaxed">{c.feedback}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <button
                                  onClick={() => setAutoGradeResult(null)}
                                  className="w-full mt-6 py-4 text-[12px] font-black text-amber-600 hover:bg-amber-50 rounded-[1.5rem] transition-colors border-2 border-transparent hover:border-amber-100 uppercase tracking-[0.2em]"
                                >
                                  Dismiss Analysis
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-1">
                  <div className="bg-white p-6 rounded-lg border border-[#dadce0] shadow-sm space-y-4 sticky top-20">
                    <div className="flex justify-between items-center">
                      <span className="text-[14px] font-medium text-[#3c4043]">Your work</span>
                      <span className={`text-[12px] font-bold uppercase tracking-wider ${as.status === 'assigned' ? 'text-gray-500' : 'text-[#1e8e3e]'}`}>{as.status}</span>
                    </div>

                    {!isTeacher && (
                      <div className="space-y-3">
                        {!isSubmitted ? (
                          <>
                            <div className="relative">
                              <button onClick={() => setShowCreateWorkDropdown(!showCreateWorkDropdown)} className="w-full py-2.5 text-[14px] font-bold bg-white border border-[#dadce0] text-[#1e8e3e] rounded hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg> Add or create
                              </button>
                              {showCreateWorkDropdown && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#dadce0] rounded shadow-xl z-20 py-2">
                                  <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-2 text-left text-[14px] hover:bg-gray-100 flex items-center gap-3 transition-colors">
                                    <div className="w-6 h-6 bg-gray-500 rounded flex items-center justify-center text-white font-bold text-[10px]">F</div> Upload File
                                  </button>
                                  <div className="h-[1px] bg-gray-100 my-1"></div>
                                  <button onClick={() => handleCreateWork('doc')} className="w-full px-4 py-2 text-left text-[14px] hover:bg-gray-100 flex items-center gap-3 transition-colors"><div className="w-6 h-6 bg-[#4285f4] rounded flex items-center justify-center text-white font-bold text-[10px]">D</div> Google Docs</button>
                                  <button onClick={() => handleCreateWork('slide')} className="w-full px-4 py-2 text-left text-[14px] hover:bg-gray-100 flex items-center gap-3 transition-colors"><div className="w-6 h-6 bg-[#f4b400] rounded flex items-center justify-center text-white font-bold text-[10px]">S</div> Google Slides</button>
                                  <button onClick={() => handleCreateWork('sheet')} className="w-full px-4 py-2 text-left text-[14px] hover:bg-gray-100 flex items-center gap-3 transition-colors"><div className="w-6 h-6 bg-[#0f9d58] rounded flex items-center justify-center text-white font-bold text-[10px]">X</div> Google Sheets</button>
                                </div>
                              )}
                              <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                              />
                            </div>
                            {as.attachments?.map(att => (
                              <div key={att.id} className="relative group/att">
                                <button onClick={() => { setEditingAttachment({ assignmentId: as.id, attachmentId: att.id }); setIsEditorPreview(true); }} className="w-full p-3 border rounded-lg flex items-center gap-3 hover:bg-gray-50 text-left transition-colors">
                                  <div className={`w-8 h-8 rounded flex items-center justify-center text-white font-black text-[10px] ${att.type === 'doc' ? 'bg-[#4285f4]' :
                                    att.type === 'slide' ? 'bg-[#f4b400]' :
                                      att.type === 'sheet' ? 'bg-[#0f9d58]' :
                                        att.type === 'image' ? 'bg-indigo-500' : 'bg-gray-500'
                                    }`}>
                                    {att.type === 'image' ? (
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                                    ) : att.type[0].toUpperCase()}
                                  </div>
                                  <span className="text-[13px] font-bold truncate flex-1 text-[#3c4043]">{att.title}</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdate({
                                      assignments: assignments.map(a => a.id === as.id ? { ...a, attachments: a.attachments?.filter(t => t.id !== att.id) } : a)
                                    });
                                  }}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 shadow-sm opacity-0 group-hover/att:opacity-100 transition-all z-10"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ))}
                            <button onClick={() => hasAttachments ? setShowTurnInConfirm(true) : handleMarkAsDone(as.id)} className="w-full bg-[#1e8e3e] text-white py-3 rounded font-bold text-[14px] shadow-sm hover:bg-[#188038] transition-all">
                              {hasAttachments ? 'Turn in' : 'Mark as done'}
                            </button>

                            {/* Turn-in Confirmation Modal */}
                            {showTurnInConfirm && (
                              <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
                                  <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-600 mx-auto mb-8 shadow-inner">
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  </div>
                                  <h3 className="text-2xl font-black text-slate-800 text-center mb-4 tracking-tight">Turn in your work?</h3>
                                  <p className="text-slate-500 text-center mb-10 font-medium leading-relaxed">
                                    One attachment will be submitted for "{as.title}". You can always unsubmit if you need to make more changes.
                                  </p>
                                  <div className="flex flex-col gap-3">
                                    <button
                                      onClick={() => handleTurnIn(as.id)}
                                      className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                                    >
                                      Confirm Submission
                                    </button>
                                    <button
                                      onClick={() => setShowTurnInConfirm(false)}
                                      className="w-full py-5 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                                    >
                                      Not yet
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="space-y-3">
                            {as.attachments?.map(att => (
                              <button key={att.id} onClick={() => { setEditingAttachment({ assignmentId: as.id, attachmentId: att.id }); setIsEditorPreview(true); }} className="w-full p-3 border rounded-lg flex items-center gap-3 bg-gray-50 opacity-80 text-left transition-colors">
                                <div className={`w-8 h-8 rounded flex items-center justify-center text-white font-black text-[10px] ${att.type === 'doc' ? 'bg-[#4285f4]' : att.type === 'slide' ? 'bg-[#f4b400]' : 'bg-[#0f9d58]'}`}>{att.type[0].toUpperCase()}</div>
                                <span className="text-[13px] font-bold truncate flex-1 text-gray-500">{att.title}</span>
                              </button>
                            ))}
                            <button onClick={() => handleUnsubmit(as.id)} className="w-full border border-[#dadce0] text-[#1e8e3e] py-2.5 rounded text-[14px] font-bold hover:bg-gray-50 transition-colors mt-2">Unsubmit</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div >
          );
        }

        return (
          <div className="max-w-[1000px] mx-auto mt-10 space-y-8 px-6 pb-20">
            {/* Create Dropdown Button */}
            {isTeacher && (
              <div className="relative">
                <button
                  onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                  className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-[14px] shadow-xl shadow-indigo-100 hover:shadow-2xl hover:bg-indigo-700 flex items-center gap-3 transition-all active:scale-95"
                >
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  Create Resource
                  <svg className={`w-4 h-4 text-white/60 transition-transform duration-300 ${showCreateDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                </button>

                {showCreateDropdown && (
                  <div className="absolute top-full left-0 mt-3 w-64 bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-2xl z-30 py-3 animate-in zoom-in-95 duration-200">
                    <button onClick={() => { setCreateType('assignment'); setIsCreatingAssignment(true); setShowCreateDropdown(false); }} className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center gap-4 transition-all group">
                      <div className="w-9 h-9 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                      <span className="font-bold text-[14px] text-slate-700">Assignment</span>
                    </button>
                    <button onClick={() => { setCreateType('quiz'); setIsCreatingAssignment(true); setShowCreateDropdown(false); }} className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center gap-4 transition-all group">
                      <div className="w-9 h-9 rounded-2xl bg-violet-500 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></div>
                      <span className="font-bold text-[14px] text-slate-700">Quiz</span>
                    </button>
                    <button onClick={() => { setCreateType('question'); setIsCreatingAssignment(true); setShowCreateDropdown(false); }} className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center gap-4 transition-all group">
                      <div className="w-9 h-9 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                      <span className="font-bold text-[14px] text-slate-700">Question</span>
                    </button>
                    <button onClick={() => { setCreateType('material'); setIsCreatingAssignment(true); setShowCreateDropdown(false); }} className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center gap-4 transition-all group">
                      <div className="w-9 h-9 rounded-2xl bg-slate-500 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>
                      <span className="font-bold text-[14px] text-slate-700">Material</span>
                    </button>
                    <div className="mx-4 my-2 h-[1px] bg-slate-100"></div>
                    <button onClick={() => { setCreateType('topic'); setIsCreatingAssignment(true); setShowCreateDropdown(false); }} className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-4 transition-all group">
                      <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-lg shadow-sm group-hover:bg-slate-200 transition-colors">#</div>
                      <span className="font-bold text-[14px] text-slate-500">New Topic</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Topics with grouped assignments */}
            {topics.sort((a, b) => a.order - b.order).map(topic => {
              const topicAssignments = assignments.filter(a => a.topic === topic.id);

              return (
                <div key={topic.id} className="bg-white rounded-[2rem] border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Topic Header */}
                  <div
                    onClick={() => {
                      const updated = topics.map(t =>
                        t.id === topic.id ? { ...t, collapsed: !t.collapsed } : t
                      );
                      onUpdate({ topics: updated });
                    }}
                    className="w-full px-8 py-5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-400 transition-transform ${topic.collapsed ? '' : 'rotate-90'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                      </div>
                      <h3 className="text-[18px] font-black text-slate-800 tracking-tight">{topic.name}</h3>
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-full">{topicAssignments.length} Items</span>
                    </div>
                    {isTeacher && (
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-gray-200 rounded-full transition-colors" onClick={(e) => e.stopPropagation()}>
                          <svg className="w-4 h-4 text-[#5f6368]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Assignments in Topic */}
                  {!topic.collapsed && (
                    <div className="divide-y divide-slate-100">
                      {topicAssignments.length === 0 ? (
                        <div className="px-8 py-10 text-center space-y-2">
                          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          </div>
                          <p className="text-[14px] text-slate-400 font-bold uppercase tracking-widest">No resources found</p>
                        </div>
                      ) : (
                        topicAssignments.map(as => {
                          const typeStyles: Record<string, { bg: string, text: string, shadow: string, icon: React.ReactNode }> = {
                            assignment: { bg: 'bg-indigo-600', text: 'text-indigo-600', shadow: 'shadow-indigo-100', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
                            quiz: { bg: 'bg-violet-600', text: 'text-violet-600', shadow: 'shadow-violet-100', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
                            question: { bg: 'bg-emerald-600', text: 'text-emerald-600', shadow: 'shadow-emerald-100', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                            material: { bg: 'bg-slate-600', text: 'text-slate-600', shadow: 'shadow-slate-100', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> }
                          };
                          const style = typeStyles[as.type] || typeStyles.assignment;

                          return (
                            <div
                              key={as.id}
                              onClick={() => setViewingWorkId(as.id)}
                              className="px-8 py-5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-all group"
                            >
                              <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className={`w-11 h-11 rounded-2xl ${style.bg} flex items-center justify-center text-white flex-shrink-0 shadow-lg ${style.shadow} group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                                  {style.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-[15px] font-black text-slate-800 tracking-tight truncate mb-0.5">{as.title}</h4>
                                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                    <span className={style.text}>{as.type}</span>
                                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                    <span>{as.type === 'material' ? 'Resource' : as.dueDate ? `Due ${as.dueDate}` : 'Lifetime Access'}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {as.status === 'scheduled' && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Scheduled</span>
                                )}
                                {!isTeacher && as.type !== 'material' && (
                                  <span className={`text-[11px] font-bold uppercase tracking-wide ${as.status === 'assigned' ? 'text-gray-400' : 'text-[#1e8e3e]'}`}>{as.status}</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped assignments */}
            {(() => {
              const ungrouped = assignments.filter(a => !topics.find(t => t.id === a.topic));
              if (ungrouped.length === 0) return null;
              return (
                <div className="bg-white rounded-lg border border-[#dadce0] overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-[#f8f9fa] border-b border-[#dadce0]">
                    <h3 className="text-[16px] font-bold text-[#5f6368]">Other</h3>
                  </div>
                  <div className="divide-y divide-[#f1f3f4]">
                    {ungrouped.map(as => (
                      <div key={as.id} onClick={() => setViewingWorkId(as.id)} className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-4 transition-all group">
                        <div className="w-10 h-10 rounded-full bg-[#1e8e3e] flex items-center justify-center text-white">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div>
                          <h4 className="text-[14px] font-medium text-[#3c4043] group-hover:underline">{as.title}</h4>
                          <p className="text-[12px] text-[#5f6368]">{as.dueDate ? `Due ${as.dueDate}` : 'No due date'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      case 'LUMINA':
        // Teachers see TeacherAssistant, Students see SocraticChat
        if (isTeacher) {
          return (
            <div className="max-w-[1200px] mx-auto mt-6 h-[80vh] flex flex-col rounded-xl border border-[#dadce0] shadow-sm overflow-hidden">
              <TeacherAssistant
                classroom={classroom}
                currentUser={currentUser}
                state={state}
                onUpdate={onUpdate}
              />
            </div>
          );
        }
        return (
          <div className="max-w-[1200px] mx-auto mt-8 h-[80vh] flex flex-col bg-white rounded-xl border border-[#dadce0] shadow-sm overflow-hidden px-4 mb-8">
            <LuminaTutorContainer classroom={classroom} currentUser={currentUser} />
          </div>
        );
      case 'PEOPLE':
        return (
          <div className="max-w-[1100px] mx-auto mt-10 space-y-16 px-6 pb-20">
            <div className="space-y-6">
              <div className="border-b border-indigo-600 pb-4 flex justify-between items-center">
                <h3 className="text-3xl font-black text-indigo-600 tracking-tight">Teachers</h3>
              </div>
              <div className="flex items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
                <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${classroom.teacher}`} className="w-12 h-12 rounded-2xl border border-slate-100 shadow-sm" />
                <div>
                  <span className="text-[16px] font-black text-slate-800">{classroom.teacher}</span>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Main Instructor</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="border-b border-emerald-500 pb-4 flex justify-between items-center">
                <h3 className="text-3xl font-black text-emerald-600 tracking-tight">Students</h3>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[11px] font-black uppercase tracking-widest rounded-full">{classroom.students?.length} Learners</span>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden divide-y divide-slate-100">
                {(classroom.students || []).map(s => (
                  <div key={s} className="flex items-center gap-4 p-6 hover:bg-slate-50 transition-colors group">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} className="w-10 h-10 rounded-2xl border border-slate-100 group-hover:scale-110 transition-transform" />
                    <span className="text-[15px] font-bold text-slate-700">{s}</span>
                  </div>
                ))}
                {(!classroom.students || classroom.students.length === 0) && (
                  <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest">No students enrolled yet</div>
                )}
              </div>
            </div>
          </div>
        );
      case 'GRADES':
        // Generate mock grade data from actual students and assignments
        const gradedAssignments = assignments.filter(a => a.type === 'assignment' || a.type === 'quiz');
        const students = classroom.students || [];

        // Generate realistic grades for each student-assignment pair
        const studentGrades: Record<string, Record<string, { score: number; maxScore: number; submitted: boolean; late: boolean }>> = {};
        students.forEach((student, sIdx) => {
          studentGrades[student] = {};
          gradedAssignments.forEach((assignment, aIdx) => {
            const seed = (sIdx * 7 + aIdx * 13) % 100;
            const submitted = seed > 15; // 85% submission rate
            const late = submitted && seed > 70 && seed < 85;
            const baseScore = assignment.points || 100;
            const score = submitted ? Math.floor(baseScore * (0.6 + (seed % 40) / 100)) : 0;
            studentGrades[student][assignment.id] = { score, maxScore: baseScore, submitted, late };
          });
        });

        // Calculate analytics
        const classAverage = students.length > 0
          ? students.reduce((sum, student) => {
            const studentTotal = Object.values(studentGrades[student] || {}).reduce((s, g) => s + (g.submitted ? g.score / g.maxScore * 100 : 0), 0);
            const submittedCount = Object.values(studentGrades[student] || {}).filter(g => g.submitted).length;
            return sum + (submittedCount > 0 ? studentTotal / submittedCount : 0);
          }, 0) / students.length
          : 0;

        const submissionRate = students.length > 0 && gradedAssignments.length > 0
          ? (students.reduce((sum, student) =>
            sum + Object.values(studentGrades[student] || {}).filter(g => g.submitted).length, 0
          ) / (students.length * gradedAssignments.length)) * 100
          : 0;

        // Grade distribution
        const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
        students.forEach(student => {
          const grades = Object.values(studentGrades[student] || {}).filter(g => g.submitted);
          if (grades.length === 0) return;
          const avgPercent = grades.reduce((s, g) => s + (g.score / g.maxScore * 100), 0) / grades.length;
          if (avgPercent >= 90) gradeDistribution.A++;
          else if (avgPercent >= 80) gradeDistribution.B++;
          else if (avgPercent >= 70) gradeDistribution.C++;
          else if (avgPercent >= 60) gradeDistribution.D++;
          else gradeDistribution.F++;
        });

        // At-risk students (below 70%)
        const atRiskStudents = students.filter(student => {
          const grades = Object.values(studentGrades[student] || {}).filter(g => g.submitted);
          if (grades.length === 0) return true;
          const avgPercent = grades.reduce((s, g) => s + (g.score / g.maxScore * 100), 0) / grades.length;
          return avgPercent < 70;
        });

        // Assignment difficulty (avg score per assignment)
        const assignmentStats = gradedAssignments.map(assignment => {
          const scores = students.map(s => studentGrades[s]?.[assignment.id]).filter(g => g?.submitted);
          const avgPercent = scores.length > 0
            ? scores.reduce((sum, g) => sum + (g!.score / g!.maxScore * 100), 0) / scores.length
            : 0;
          return { ...assignment, avgPercent, submissions: scores.length };
        });

        return (
          <div className="max-w-[1200px] mx-auto mt-6 px-4 space-y-8 pb-12">
            {/* Analytics Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-[#1e8e3e] to-[#34a853] rounded-xl p-5 text-white shadow-lg">
                <div className="text-sm opacity-80 font-medium">Class Average</div>
                <div className="text-3xl font-bold mt-1">{classAverage.toFixed(1)}%</div>
                <div className="text-xs mt-2 opacity-70">Across {gradedAssignments.length} assignments</div>
              </div>
              <div className="bg-gradient-to-br from-[#4285f4] to-[#1a73e8] rounded-xl p-5 text-white shadow-lg">
                <div className="text-sm opacity-80 font-medium">Submission Rate</div>
                <div className="text-3xl font-bold mt-1">{submissionRate.toFixed(0)}%</div>
                <div className="text-xs mt-2 opacity-70">{students.length} students enrolled</div>
              </div>
              <div className="bg-gradient-to-br from-[#fbbc04] to-[#ea8600] rounded-xl p-5 text-white shadow-lg">
                <div className="text-sm opacity-80 font-medium">Top Grade</div>
                <div className="text-3xl font-bold mt-1">{gradeDistribution.A} A's</div>
                <div className="text-xs mt-2 opacity-70">{((gradeDistribution.A / Math.max(students.length, 1)) * 100).toFixed(0)}% of class</div>
              </div>
              <div className="bg-gradient-to-br from-[#ea4335] to-[#c5221f] rounded-xl p-5 text-white shadow-lg">
                <div className="text-sm opacity-80 font-medium">At-Risk Students</div>
                <div className="text-3xl font-bold mt-1">{atRiskStudents.length}</div>
                <div className="text-xs mt-2 opacity-70">Below 70% average</div>
              </div>
            </div>

            {/* AI Learning Analytics Hub */}
            <div className="bg-white rounded-xl border border-purple-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <h3 className="text-lg font-bold text-purple-900">AI Learning Analytics Hub</h3>
                </div>
                <div className="flex gap-4 text-[12px] font-bold text-purple-700">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    {luminaSessions.length} Total Sessions
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                    {new Set(luminaSessions.map(s => s.studentId)).size} Unique Learners
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Recent Sessions Feed */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Recent Lumina Sessions</h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {luminaSessions.length === 0 && aiGradingInsights.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                          <p className="text-gray-400 text-sm">No AI interactions recorded yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Voice Sessions */}
                          {luminaSessions.length > 0 && (
                            <div className="space-y-3">
                              {luminaSessions.map(session => (
                                <div key={session.id} className="p-3 border rounded-lg hover:border-purple-300 transition-all hover:shadow-md bg-white group cursor-pointer border-l-4 border-l-purple-400">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session.studentName}`} className="w-6 h-6 rounded-full" />
                                      <span className="text-[13px] font-bold text-[#3c4043]">{session.studentName} <span className="text-purple-500 font-medium ml-1">Synced</span></span>
                                    </div>
                                    <span className="text-[10px] text-gray-400">{new Date(session.startTime).toLocaleString()}</span>
                                  </div>
                                  <p className="text-[12px] text-purple-700 font-medium mb-1 line-clamp-1">{session.summary}</p>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${(session.engagementScore || 0) > 7 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                      Engagement: {session.engagementScore}/10
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Grading Insights */}
                          {aiGradingInsights.length > 0 && (
                            <div className="space-y-3">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">AI Grading Checks</h5>
                              {aiGradingInsights.map(insight => {
                                const assignment = assignments.find(a => a.id === insight.assignmentId);
                                return (
                                  <div key={insight.id} className="p-3 border rounded-lg hover:border-indigo-300 transition-all hover:shadow-md bg-white group cursor-pointer border-l-4 border-l-indigo-400">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex items-center gap-2">
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${insight.studentName}`} className="w-6 h-6 rounded-full" />
                                        <span className="text-[13px] font-bold text-[#3c4043]">{insight.studentName} <span className="text-indigo-500 font-medium ml-1">Autograde</span></span>
                                      </div>
                                      <span className="text-[10px] text-gray-400">{new Date(insight.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-600 mb-1">Assignment: {assignment?.title || 'Unknown'}</p>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[12px] font-black border border-indigo-100 shadow-sm">
                                        Score: {insight.score}
                                      </span>
                                    </div>
                                    <p className="text-[12px] text-slate-500 line-clamp-2 italic">"{insight.feedback}"</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Knowledge Gap & Topic Analysis */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Knowledge Gaps & Insights</h4>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 h-full max-h-[400px]">
                      <div className="space-y-6">
                        {/* Concept Mastery */}
                        <div>
                          <p className="text-xs font-bold text-gray-600 mb-3">CONCEPTS NEEDING REINFORCEMENT</p>
                          <div className="space-y-3">
                            {[
                              { topic: "Stoichiometry & Balanced Equations", count: 4, level: 0.35, color: "bg-red-400" },
                              { topic: "Thermodynamics Laws", count: 3, level: 0.52, color: "bg-orange-400" },
                              { topic: "Kinematics in 2D", count: 2, level: 0.68, color: "bg-yellow-400" }
                            ].map((topic, i) => (
                              <div key={i}>
                                <div className="flex justify-between text-[11px] mb-1">
                                  <span className="font-medium text-gray-700">{topic.topic}</span>
                                  <span className="text-red-500 font-bold">{topic.count} students struggling</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div className={`${topic.color} h-full rounded-full`} style={{ width: `${topic.level * 100}%` }}></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recommendation Card */}
                        <div className="mt-4 p-3 bg-indigo-600 rounded-lg text-white shadow-lg">
                          <div className="flex gap-2 items-start">
                            <span className="text-lg">🤖</span>
                            <div>
                              <p className="text-[12px] font-bold">Lumina's Recommendation</p>
                              <p className="text-[11px] opacity-90 leading-relaxed mt-1">
                                Based on {luminaSessions.length} recent sessions, students are asking most about <strong>balanced equations</strong>. I recommend generating a targeted review quiz.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Standard Grade Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-[#dadce0] p-6 shadow-sm">
                <h3 className="text-lg font-bold text-[#3c4043] mb-4">Grade Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(gradeDistribution).map(([grade, count]) => {
                    const percent = (count / Math.max(students.length, 1)) * 100;
                    const colors: Record<string, string> = { A: 'bg-[#34a853]', B: 'bg-[#4285f4]', C: 'bg-[#fbbc04]', D: 'bg-[#ea8600]', F: 'bg-[#ea4335]' };
                    return (
                      <div key={grade} className="flex items-center gap-3">
                        <span className="w-8 font-bold text-[#3c4043]">{grade}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div className={`h-full ${colors[grade]} transition-all duration-500`} style={{ width: `${percent}%` }} />
                        </div>
                        <span className="w-16 text-right text-sm text-[#5f6368]">{count} ({percent.toFixed(0)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#dadce0] p-6 shadow-sm">
                <h3 className="text-lg font-bold text-[#3c4043] mb-4">Assignment Difficulty Analysis</h3>
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                  {assignmentStats.sort((a, b) => a.avgPercent - b.avgPercent).map(assignment => (
                    <div key={assignment.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[#3c4043] truncate">{assignment.title}</div>
                        <div className="text-[11px] text-[#5f6368]">{assignment.submissions} submissions</div>
                      </div>
                      <div className={`text-sm font-bold ${assignment.avgPercent >= 80 ? 'text-[#34a853]' : assignment.avgPercent >= 60 ? 'text-[#fbbc04]' : 'text-[#ea4335]'}`}>
                        {assignment.avgPercent.toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Support Needed Alert */}
            {atRiskStudents.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <h3 className="text-lg font-bold text-red-700">Students Needing Support</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {atRiskStudents.map(student => (
                    <div key={student} className="flex items-center gap-3 bg-white rounded-lg p-2.5 border border-red-100 shadow-sm">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student}`} className="w-10 h-10 rounded-full bg-red-50" alt="" />
                      <span className="text-[13px] font-bold text-[#3c4043] truncate">{student}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Premium Gradebook Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Class Average</p>
                <div className="flex items-end gap-2">
                  <h4 className="text-4xl font-black text-indigo-600 tracking-tighter">{classAverage.toFixed(0)}%</h4>
                  <span className="text-[11px] font-bold text-emerald-500 mb-1.5">+2.4% vs last week</span>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Submission Intensity</p>
                <div className="flex items-end gap-2">
                  <h4 className="text-4xl font-black text-slate-800 tracking-tighter">88%</h4>
                  <span className="text-[11px] font-bold text-slate-400 mb-1.5">Avg. completion rate</span>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Top Performers</p>
                <div className="flex -space-x-2 mt-1">
                  {students.slice(0, 5).map(s => (
                    <img key={s} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                  ))}
                  <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-500">+{students.length > 5 ? students.length - 5 : 0}</div>
                </div>
              </div>
            </div>

            {/* Modern Lumina Gradebook Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-100 overflow-hidden">
              <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Enterprise Gradebook</h3>
                <span className="px-4 py-1.5 bg-white text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-100 shadow-sm">
                  Live Visualization • {gradedAssignments.length} Column Factors
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky left-0 bg-slate-50 z-10 border-r border-slate-100">Student Profile</th>
                      {gradedAssignments.slice(0, 10).map(a => (
                        <th key={a.id} className="px-6 py-5 text-center min-w-[140px]">
                          <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight mb-0.5 line-clamp-1">{a.title}</div>
                          <div className="text-[10px] text-slate-400 font-bold tracking-widest">CAP {a.points || 100}</div>
                        </th>
                      ))}
                      <th className="px-10 py-5 text-center font-black text-indigo-600 uppercase tracking-[0.2em] bg-slate-100/50">Coefficient</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student, sIdx) => {
                      const grades = Object.values(studentGrades[student] || {}).filter(g => g.submitted);
                      const avgPercent = grades.length > 0
                        ? grades.reduce((s, g) => s + (g.score / g.maxScore * 100), 0) / grades.length
                        : 0;
                      return (
                        <tr key={student} className="hover:bg-slate-50/50 transition-all group">
                          <td className="px-10 py-5 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student}`} className="w-10 h-10 rounded-2xl border border-slate-100 shadow-sm group-hover:scale-110 transition-transform" />
                              <span className="text-[15px] font-black text-slate-700">{student}</span>
                            </div>
                          </td>
                          {gradedAssignments.slice(0, 10).map(a => {
                            const grade = studentGrades[student]?.[a.id];
                            if (!grade?.submitted) return <td key={a.id} className="px-6 py-5 text-center"><span className="text-slate-200 font-black">—</span></td>;
                            const percent = (grade.score / grade.maxScore) * 100;
                            return (
                              <td key={a.id} className="px-6 py-5 text-center">
                                <div className={`text-[15px] font-black px-3 py-1 rounded-xl inline-block ${percent >= 80 ? 'text-emerald-600 bg-emerald-50' : percent >= 60 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50'}`}>
                                  {grade.score}
                                </div>
                                {grade.late && <div className="text-[9px] text-rose-500 font-black uppercase tracking-tighter mt-1">Late Registry</div>}
                              </td>
                            );
                          })}
                          <td className="px-10 py-5 text-center bg-slate-50/30">
                            <span className={`text-[14px] font-black px-4 py-2 rounded-2xl shadow-sm border ${avgPercent >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : avgPercent >= 60 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                              {avgPercent.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-50/50">
      <div className="max-w-[1100px] mx-auto px-6 mt-8 w-full">
        {/* Modern Lumina Banner */}
        <div className={`h-[240px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-3xl p-10 text-white flex flex-col justify-end shadow-2xl shadow-indigo-200 relative overflow-hidden group`}>
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/20 transition-all duration-700" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-400/20 rounded-full -ml-10 -mb-10 blur-2xl" />

          <div className="absolute top-6 right-8 text-white/10 group-hover:scale-110 transition-transform duration-500">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" /></svg>
          </div>

          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                {classroom.section}
              </span>
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight drop-shadow-md">{classroom.name}</h1>
            <p className="text-lg font-medium opacity-80 flex items-center gap-2">
              <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${classroom.teacher}`} className="w-6 h-6 rounded-lg border border-white/30" />
              {classroom.teacher}
            </p>
          </div>
        </div>

        {/* Pill-Based Tab Navigation */}
        <div className="flex justify-start gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200/60 mt-8 w-fit mx-auto shadow-sm">
          {(['STREAM', 'CLASSWORK', 'PEOPLE', isTeacher ? 'GRADES' : null, 'LUMINA'].filter(Boolean) as ClassTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setViewingWorkId(null); }}
              className={`px-6 py-2.5 text-[13px] font-bold tracking-tight transition-all rounded-xl ${activeTab === tab
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
                }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 pb-20">{renderTabContent()}</div>
      {isCreatingAssignment && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col border border-white/20">
            <header className="p-8 border-b bg-gradient-to-r from-slate-50 to-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${createType === 'assignment' ? 'bg-indigo-600 shadow-indigo-100' :
                  createType === 'quiz' ? 'bg-violet-600 shadow-violet-100' :
                    createType === 'question' ? 'bg-emerald-600 shadow-emerald-100' :
                      createType === 'material' ? 'bg-slate-700 shadow-slate-100' : 'bg-slate-400'
                  }`}>
                  {createType === 'assignment' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  {createType === 'quiz' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                    {createType === 'topic' ? 'New Topic' : `Create ${createType.charAt(0).toUpperCase() + createType.slice(1)}`}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Lumina Learning Center</p>
                </div>
              </div>
              <button
                onClick={() => { setIsCreatingAssignment(false); setCreateType('assignment'); }}
                className="w-12 h-12 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all flex items-center justify-center shadow-sm"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 custom-scrollbar">
              {!isGeneratingWorksheet ? (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="bg-white p-8 rounded-xl border border-[#dadce0] space-y-6 shadow-sm">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">{createType === 'topic' ? 'Topic Name' : 'Title'}</label>
                      <input type="text" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="google-input w-full shadow-sm" placeholder={createType === 'topic' ? 'e.g. Unit 3: Thermodynamics' : 'e.g. Lab 02: Kinematics'} />
                    </div>

                    {createType !== 'topic' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">{createType === 'question' ? 'Question' : 'Instructions'}</label>
                          <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="google-input w-full min-h-[100px] resize-none shadow-sm" placeholder={createType === 'question' ? 'Ask your students a question...' : 'Tell students exactly what is expected...'} />
                        </div>

                        {/* Question type toggle */}
                        {createType === 'question' && (
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Response Type</label>
                            <div className="flex gap-3">
                              <button
                                onClick={() => setEditForm({ ...editForm, questionType: 'short-answer' })}
                                className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-all ${editForm.questionType === 'short-answer' ? 'border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                              >Short Answer</button>
                              <button
                                onClick={() => setEditForm({ ...editForm, questionType: 'multiple-choice' })}
                                className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-all ${editForm.questionType === 'multiple-choice' ? 'border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                              >Multiple Choice</button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          {/* Due Date - not for material */}
                          {createType !== 'material' && (
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Due Date</label>
                              <input type="text" value={editForm.dueDate} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} className="google-input w-full" placeholder="Friday, Oct 24" />
                            </div>
                          )}

                          {/* Topic selector */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Topic</label>
                            <select
                              value={editForm.topic}
                              onChange={e => setEditForm({ ...editForm, topic: e.target.value })}
                              className="google-input w-full bg-white"
                            >
                              <option value="">No topic</option>
                              {topics.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Points - not for material */}
                          {createType !== 'material' && (
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Points</label>
                              <input type="number" value={editForm.points} onChange={e => setEditForm({ ...editForm, points: parseInt(e.target.value) || 0 })} className="google-input w-full" placeholder="100" />
                            </div>
                          )}

                          {/* Schedule */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Schedule (optional)</label>
                            <input type="text" value={editForm.scheduledDate} onChange={e => setEditForm({ ...editForm, scheduledDate: e.target.value })} className="google-input w-full" placeholder="Post immediately" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* AI Materials - only for assignment */}
                  {createType === 'assignment' && (
                    <div className="bg-white p-8 rounded-xl border border-[#dadce0] space-y-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-gray-700">Course Materials</h4>
                          <p className="text-xs text-gray-500">Design curriculum attachments using Gemini AI.</p>
                        </div>
                        <button onClick={() => setIsGeneratingWorksheet(true)} className="text-[12px] font-bold text-[#1e8e3e] flex items-center gap-2 hover:bg-[#e6f4ea] px-4 py-2 rounded-full border border-[#1e8e3e] transition-all">✨ AI Worksheet Forge</button>
                      </div>
                      {wsPreview && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between animate-in slide-in-from-top-1">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#1e8e3e] rounded flex items-center justify-center text-white"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm1.83 4L14 4.17V6h1.83zM6 20V4h6v4a2 2 0 002 2h4v10H6z" /></svg></div>
                            <span className="text-sm font-bold text-green-800">Generated Worksheet Attached</span>
                          </div>
                          <button onClick={() => setWsPreview(null)} className="text-xs text-red-500 font-bold hover:underline">Delete</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quiz Generator - only for quiz */}
                  {createType === 'quiz' && (
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-xl border border-purple-200 space-y-6 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#7c4dff] rounded-full flex items-center justify-center text-white">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-800">AI Quiz Generator</h4>
                          <p className="text-xs text-gray-500">Automatically generate multiple-choice questions using Gemini</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Quiz Topic</label>
                          <input
                            type="text"
                            value={quizTopic}
                            onChange={e => setQuizTopic(e.target.value)}
                            className="google-input w-full"
                            placeholder="e.g. Newton's Laws of Motion, Photosynthesis..."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1"># Questions</label>
                          <select
                            value={numberOfQuestions}
                            onChange={e => setNumberOfQuestions(parseInt(e.target.value))}
                            className="google-input w-full bg-white"
                          >
                            <option value={3}>3 Questions</option>
                            <option value={5}>5 Questions</option>
                            <option value={10}>10 Questions</option>
                            <option value={15}>15 Questions</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Difficulty Level</label>
                        <div className="flex gap-3">
                          {(['easy', 'medium', 'hard'] as const).map(level => (
                            <button
                              key={level}
                              onClick={() => setQuizDifficulty(level)}
                              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all capitalize ${quizDifficulty === level
                                ? level === 'easy' ? 'border-green-500 bg-green-50 text-green-700'
                                  : level === 'medium' ? 'border-amber-500 bg-amber-50 text-amber-700'
                                    : 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                              {level === 'easy' && '🟢 '}{level === 'medium' && '🟡 '}{level === 'hard' && '🔴 '}{level}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleGenerateQuiz}
                        disabled={isGeneratingQuiz || !quizTopic.trim()}
                        className="w-full py-4 bg-gradient-to-r from-[#7c4dff] to-[#651fff] text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl hover:from-[#651fff] hover:to-[#536dfe] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGeneratingQuiz ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            Generating Questions...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Generate Quiz with AI
                          </>
                        )}
                      </button>

                      {/* Generated Questions Preview */}
                      {quizQuestions.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-purple-200">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-bold text-gray-700">Generated Questions ({quizQuestions.length})</h5>
                            <button onClick={() => setQuizQuestions([])} className="text-xs text-red-500 font-bold hover:underline">Clear All</button>
                          </div>
                          <div className="space-y-2 max-h-[250px] overflow-y-auto">
                            {quizQuestions.map((q, i) => (
                              <div key={i} className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium text-gray-800"><span className="text-purple-600 font-bold">Q{i + 1}.</span> {q.question}</p>
                                  <button
                                    onClick={() => setQuizQuestions(prev => prev.filter((_, idx) => idx !== i))}
                                    className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {q.options.map((opt, j) => (
                                    <div
                                      key={j}
                                      className={`text-xs px-2 py-1 rounded ${j === q.correctIndex ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-50 text-gray-600'}`}
                                    >
                                      {String.fromCharCode(65 + j)}. {opt}
                                    </div>
                                  ))}
                                </div>
                                {q.explanation && (
                                  <p className="text-[10px] text-gray-500 italic">💡 {q.explanation}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Create Button */}
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setIsCreatingAssignment(false); setCreateType('assignment'); }} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-all">Cancel</button>
                    <button onClick={handleCreateAssignment} disabled={!editForm.title.trim()} className="px-8 py-2.5 bg-[#1a73e8] text-white rounded-lg font-bold shadow hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      {createType === 'topic' ? 'Create' : editForm.scheduledDate ? 'Schedule' : 'Assign'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-6xl mx-auto flex flex-col h-full gap-6 animate-in slide-in-from-right duration-300">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setIsGeneratingWorksheet(false)} className="p-3 hover:bg-gray-200 rounded-full transition-all"><svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg></button>
                      <div>
                        <h4 className="font-bold text-gray-800 text-lg">Worksheet Neural Forge</h4>
                        <p className="text-xs text-gray-500">Generating high-fidelity curriculum documents.</p>
                      </div>
                    </div>
                    {wsPreview && (
                      <div className="flex gap-2">
                        <button onClick={() => printWorksheet(editForm.title, wsPreview || '')} className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          Print Worksheet
                        </button>
                        <button onClick={() => setIsGeneratingWorksheet(false)} className="px-6 py-2.5 bg-[#1e8e3e] text-white rounded-lg font-bold text-xs shadow hover:bg-[#188038] transition-all">Confirm Attachment</button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
                    <div className="lg:col-span-4 bg-white p-8 rounded-2xl border border-[#dadce0] shadow-sm flex flex-col gap-6 overflow-y-auto">
                      <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Architect Configuration</h5>
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600 leading-relaxed italic">Lumina Forge will interpret your prompt and output structured, high-quality curriculum material.</p>
                        <textarea value={wsPrompt} onChange={e => setWsPrompt(e.target.value)} placeholder="e.g. Physics Momentum worksheet for beginners..." className="google-input w-full min-h-[180px] text-sm leading-relaxed shadow-inner" />
                        <button onClick={handleGenerateWorksheet} disabled={isWsLoading} className="w-full bg-[#1e8e3e] text-white py-5 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:bg-[#188038] transition-all flex items-center justify-center gap-3 disabled:bg-gray-300">
                          {isWsLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : "✨ Forge Curriculum"}
                        </button>
                      </div>
                    </div>

                    <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden h-full">
                      <div className="flex-1 bg-[#525659] p-10 overflow-y-auto shadow-inner rounded-2xl border border-black/10">
                        {wsPreview ? (
                          <div className="bg-white w-full min-h-full p-16 shadow-2xl mx-auto font-serif text-[#000] relative animate-in fade-in zoom-in-95 duration-700 max-w-[800px] leading-relaxed worksheet-preview">
                            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-8">
                              <div className="text-[11px] font-bold text-gray-800 space-y-2 uppercase tracking-wide">
                                <div>Student: ____________________________</div>
                                <div>Date: ________________</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] font-black uppercase text-gray-300 mb-1">Generated Document</div>
                                <div className="text-[16px] font-bold italic text-gray-600">{editForm.topic}</div>
                              </div>
                            </div>
                            <div dangerouslySetInnerHTML={{ __html: marked.parse(wsPreview) }} />
                          </div>
                        ) : isWsLoading ? (
                          <div className="h-full flex flex-col items-center justify-center gap-6 text-white/40 animate-pulse">
                            <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
                            <p className="font-mono text-sm tracking-widest uppercase">Forging Logical Matricies...</p>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center border-4 border-dashed border-white/5 rounded-3xl text-white/10 space-y-4">
                            <p className="italic text-base font-medium">Configure Architect and click "Forge Curriculum".</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <footer className="p-6 border-t bg-white flex justify-end gap-3 shrink-0 shadow-lg">
              <button onClick={() => setIsCreatingAssignment(false)} className="px-8 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Discard</button>
              {!isGeneratingWorksheet && (
                <button onClick={handleCreateAssignment} disabled={!editForm.title.trim()} className="bg-[#1e8e3e] text-white px-10 py-2.5 rounded-lg font-bold text-sm shadow hover:bg-[#188038] disabled:bg-gray-300 transition-all">Assign</button>
              )}
            </footer>
          </div>
        </div>
      )}

      {notification && <div className="fixed bottom-8 left-8 z-[600] bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl border-l-4 border-emerald-500 animate-in slide-in-from-left-4 text-sm font-bold tracking-tight">{notification}</div>}
    </div>
  );
};

export default ClassroomView;
