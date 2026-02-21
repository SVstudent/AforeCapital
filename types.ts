
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CLASSROOM_DETAIL = 'CLASSROOM_DETAIL',
}

export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export type ClassTab = 'STREAM' | 'CLASSWORK' | 'PEOPLE' | 'GRADES' | 'LUMINA';

export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  thinking?: string;
  timestamp: number;
  image?: string;
}

export interface Classroom {
  id: string;
  name: string;
  section: string;
  teacher: string;
  bannerColor: string;
  studentCount: number;
  bannerImage?: string;
  students?: string[]; // Names of students in the class
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface Quiz {
  assignmentId: string;
  questions: QuizQuestion[];
  completed?: boolean;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  points: number;
}

export interface Attachment {
  id: string;
  type: 'doc' | 'slide' | 'sheet' | 'link' | 'file' | 'image';
  title: string;
  url: string;
  content?: string; // Stateful content for mock editor
}

export interface Topic {
  id: string;
  name: string;
  order: number;
  collapsed?: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  topic: string; // Topic ID or name
  status: 'assigned' | 'missing' | 'turned-in' | 'graded' | 'draft' | 'scheduled';
  type: 'assignment' | 'quiz' | 'material' | 'question';
  submission?: string;
  submissionImage?: string;
  attachments?: Attachment[];
  rubric?: RubricCriterion[];
  grade?: string;
  feedback?: string;
  quizReady?: boolean;
  // New fields
  points?: number;
  gradeCategory?: string;
  scheduledDate?: string;
  questionType?: 'short-answer' | 'multiple-choice';
  questionOptions?: string[]; // For multiple choice
  allowReplies?: boolean;
  order?: number;
  // Quiz questions for embedded quizzes
  quizQuestions?: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }>;
  studentAnswers?: number[]; // Student's selected answer indices
}

export interface Announcement {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  comments: number;
  role: UserRole;
}

export interface ClassroomState {
  announcements: Announcement[];
  assignments: Assignment[];
  topics: Topic[];
  luminaMessages: Message[];
  rubric?: ClassRubric;
}

// Class-level rubric with criteria and scoring levels
export interface ClassRubric {
  name: string;
  criteria: Array<{
    name: string;
    description: string;
    maxPoints: number;
    levels: { score: number; description: string }[];
  }>;
}
// AI Interaction Persistence
export interface LuminaTutorSession {
  id: string;
  studentId: string;
  studentName: string;
  classroomId: string;
  assignmentId: string;
  startTime: number;
  lastActive: number;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  summary?: string;
  topicsCovered?: string[];
  resourcesCompiled?: string[];
  engagementScore?: number; // 1-10 based on session length/complexity
}

export interface StudentAIAnalytics {
  studentId: string;
  classroomId: string;
  totalSessions: number;
  totalQuestions: number;
  lastActive: number;
  topTopics: string[];
  conceptMastery: Record<string, number>; // concept -> mastery level 0-1
}

export interface AIGradingInsight {
  id: string;
  studentId: string;
  studentName: string;
  assignmentId: string;
  classroomId: string;
  score: string;
  feedback: string;
  criteriaScores: Array<{
    name: string;
    score: number;
    maxScore: number;
    feedback: string;
  }>;
  timestamp: number;
}
