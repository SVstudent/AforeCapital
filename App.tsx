'use client';

import React, { useState, useEffect } from 'react';
import { AppView, Classroom, UserRole, ClassroomState, Assignment, Announcement, Topic, ClassRubric } from './types';
import Dashboard from './Dashboard';
import ClassroomView from './ClassroomView';
import Sidebar from './Sidebar';
import LuminaChat from './LuminaChat';
import LuminaSync from './LuminaSync';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import {
  getAllClassrooms,
  getClassroomEnrollments,
  getClassroomAssignments,
  getClassroomAnnouncements,
  getClassroomTopics,
  getClassroomRubric,
  subscribeToClassroomAssignments,
  subscribeToClassroomAnnouncements,
  subscribeToClassroomTopics,
  createAnnouncement,
  createAssignment,
  createTopic,
  FirestoreClassroom,
  FirestoreAssignment,
  FirestoreAnnouncement,
  FirestoreTopic,
} from './lib/firestore';

// Fallback demo data in case Firestore is empty
const FALLBACK_CLASSROOMS: Classroom[] = [
  {
    id: 'phys-101',
    name: 'Physics 101',
    section: 'Period 3',
    teacher: 'Dr. Aris',
    bannerColor: 'bg-[#1e8e3e]',
    studentCount: 5,
    students: ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Prince', 'Ethan Hunt']
  },
  {
    id: 'calc-bc',
    name: 'Calculus BC',
    section: 'Advanced Placement',
    teacher: 'Prof. Gauss',
    bannerColor: 'bg-[#4285f4]',
    studentCount: 4,
    students: ['Frank Castle', 'Gwen Stacy', 'Harry Osborn', 'Iris West']
  },
];

// Map Firestore data to app types
function mapFirestoreAssignment(fa: { id: string } & FirestoreAssignment): Assignment {
  return {
    id: fa.id,
    title: fa.title,
    description: fa.description,
    type: fa.type,
    dueDate: fa.dueDate || 'No due date',
    points: fa.points,
    topic: fa.topicId || '',
    status: fa.status === 'assigned' ? 'assigned' : fa.status === 'scheduled' ? 'scheduled' : 'assigned',
    order: fa.order,
    attachments: fa.attachments || [],
    rubric: [],
    quizQuestions: fa.quizQuestions,
    quizReady: fa.type === 'quiz' && !!fa.quizQuestions?.length,
  };
}

function mapFirestoreAnnouncement(fa: { id: string } & FirestoreAnnouncement): Announcement {
  return {
    id: fa.id,
    author: fa.authorName,
    content: fa.content,
    timestamp: fa.createdAt?.toMillis?.() || Date.now(),
    comments: 0,
    role: UserRole.TEACHER,
  };
}

function mapFirestoreTopic(ft: { id: string } & FirestoreTopic): Topic {
  return {
    id: ft.id,
    name: ft.name,
    order: ft.order,
    collapsed: ft.collapsed || false,
  };
}

// Inner app component that uses auth context
function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomData, setClassroomData] = useState<Record<string, ClassroomState>>({});
  const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(true);

  const selectedClassroom = classrooms.find(c => c.id === selectedClassId);

  // Load classrooms from Firestore
  useEffect(() => {
    if (!user) {
      setClassrooms([]);
      setIsLoadingClassrooms(false);
      return;
    }

    const loadClassrooms = async () => {
      setIsLoadingClassrooms(true);
      try {
        const firestoreClassrooms = await getAllClassrooms();

        if (firestoreClassrooms.length > 0) {
          // Convert Firestore classrooms to app format with enrollments
          const convertedClassrooms = await Promise.all(
            firestoreClassrooms.map(async (fc) => {
              const students = await getClassroomEnrollments(fc.id);
              return {
                id: fc.id,
                name: fc.name,
                section: fc.section,
                teacher: fc.teacherName,
                bannerColor: fc.bannerColor || 'bg-[#1e8e3e]',
                studentCount: students.length,
                students,
              };
            })
          );
          setClassrooms(convertedClassrooms);
        } else {
          // Use fallback demo data if Firestore is empty
          console.log('No classrooms in Firestore, using fallback demo data');
          setClassrooms(FALLBACK_CLASSROOMS);
        }
      } catch (err) {
        console.error('Error loading classrooms:', err);
        setClassrooms(FALLBACK_CLASSROOMS);
      }
      setIsLoadingClassrooms(false);
    };

    loadClassrooms();
  }, [user]);

  // Load and subscribe to classroom data when a classroom is selected
  useEffect(() => {
    if (!selectedClassId || classroomData[selectedClassId]) return;

    const loadClassroomData = async () => {
      try {
        const [assignments, announcements, topics, rubric] = await Promise.all([
          getClassroomAssignments(selectedClassId),
          getClassroomAnnouncements(selectedClassId),
          getClassroomTopics(selectedClassId),
          getClassroomRubric(selectedClassId),
        ]);

        setClassroomData(prev => ({
          ...prev,
          [selectedClassId]: {
            assignments: assignments.map(mapFirestoreAssignment),
            announcements: announcements.map(mapFirestoreAnnouncement),
            topics: topics.map(mapFirestoreTopic),
            luminaMessages: [],
            rubric: rubric || undefined,
          }
        }));
      } catch (err) {
        console.error('Error loading classroom data:', err);
        // Initialize with empty data on error
        setClassroomData(prev => ({
          ...prev,
          [selectedClassId]: {
            assignments: [],
            announcements: [],
            topics: [{ id: 'default', name: 'General', order: 1, collapsed: false }],
            luminaMessages: [],
          }
        }));
      }
    };

    loadClassroomData();

    // Subscribe to real-time updates
    const unsubAssignments = subscribeToClassroomAssignments(selectedClassId, (assignments) => {
      setClassroomData(prev => ({
        ...prev,
        [selectedClassId]: {
          ...prev[selectedClassId],
          assignments: assignments.map(mapFirestoreAssignment),
        }
      }));
    });

    const unsubAnnouncements = subscribeToClassroomAnnouncements(selectedClassId, (announcements) => {
      setClassroomData(prev => ({
        ...prev,
        [selectedClassId]: {
          ...prev[selectedClassId],
          announcements: announcements.map(mapFirestoreAnnouncement),
        }
      }));
    });

    const unsubTopics = subscribeToClassroomTopics(selectedClassId, (topics) => {
      setClassroomData(prev => ({
        ...prev,
        [selectedClassId]: {
          ...prev[selectedClassId],
          topics: topics.map(mapFirestoreTopic),
        }
      }));
    });

    return () => {
      unsubAssignments();
      unsubAnnouncements();
      unsubTopics();
    };
  }, [selectedClassId]);

  // Handler for classroom state updates - NOW WRITES TO FIRESTORE
  const handleUpdateClassroom = async (id: string, updates: Partial<ClassroomState>) => {
    // Update local state immediately for responsiveness
    setClassroomData(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));

    // The actual Firestore writes happen in ClassroomView handlers
    // This function is kept for local-only updates like auraMessages
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Show loading screen
  if (loading || isLoadingClassrooms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-medium">Loading LuminaOS...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // Convert Firebase user to app User format
  const currentUser = {
    id: user.uid,
    name: user.displayName || 'User',
    email: user.email || '',
    role: user.role,
    avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`,
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-[100]" onClick={() => setIsSidebarOpen(false)}>
          <div className="w-64 h-full bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <Sidebar activeView={activeView} setActiveView={(v) => { setActiveView(v); setIsSidebarOpen(false); }} onBackToHome={() => { setActiveView(AppView.DASHBOARD); setSelectedClassId(null); setIsSidebarOpen(false); }} classrooms={classrooms} onSelectClass={(id) => { setSelectedClassId(id); setActiveView(AppView.CLASSROOM_DETAIL); setIsSidebarOpen(false); }} />
          </div>
        </div>
      )}

      {isGlobalChatOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end bg-black/10 pointer-events-none">
          <div className="w-full max-w-sm h-full bg-white shadow-2xl animate-in slide-in-from-right duration-300 pointer-events-auto">
            <LuminaChat onClose={() => setIsGlobalChatOpen(false)} classroom={selectedClassroom || undefined} currentUser={currentUser} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200/60 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md z-[60] shrink-0 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setActiveView(AppView.DASHBOARD); setSelectedClassId(null); }}>
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
                <span className="text-white font-bold text-xl">L</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 hidden sm:block">LuminaOS</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Role badge */}
            <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${user.role === UserRole.TEACHER ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {user.role}
            </span>
            <button
              onClick={() => setIsGlobalChatOpen(!isGlobalChatOpen)}
              className={`p-2.5 rounded-xl transition-all ${isGlobalChatOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-100'}`}
              title="Lumina AI Chat"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2 22l5-1.338c1.47.851 3.179 1.338 5 1.338 5.523 0 10-4.477 10-10S17.523 2 12 2z" /></svg>
            </button>
            <div className="relative group">
              <div className="w-10 h-10 rounded-xl overflow-hidden cursor-pointer ring-2 ring-transparent group-hover:ring-indigo-500/30 p-0.5 flex items-center justify-center transition-all bg-slate-50 border border-slate-200" onClick={handleLogout}>
                <img src={currentUser.avatar} className="w-full h-full rounded-lg object-cover" alt="Profile" />
              </div>
              <div className="absolute right-0 top-full mt-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl">
                Click to sign out
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-white">
          {activeView === AppView.DASHBOARD ? (
            <Dashboard classrooms={classrooms} onSelectClass={(id) => { setSelectedClassId(id); setActiveView(AppView.CLASSROOM_DETAIL); }} />
          ) : (
            selectedClassroom && classroomData[selectedClassroom.id] && (
              <ClassroomView
                classroom={selectedClassroom}
                currentUser={currentUser}
                state={classroomData[selectedClassroom.id]}
                onUpdate={updates => handleUpdateClassroom(selectedClassroom.id, updates)}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
}

// Main App wrapper with AuthProvider
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
