// Firestore CRUD operations for LuminaOS
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Classroom, Assignment, Announcement, Topic, UserRole, ClassRubric, LuminaTutorSession, StudentAIAnalytics, AIGradingInsight } from '../types';

// ==================== USERS ====================

export interface FirestoreUser {
    email: string;
    displayName: string;
    role: UserRole;
    photoURL?: string;
    createdAt: Timestamp;
}

export async function getUser(userId: string): Promise<FirestoreUser | null> {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as FirestoreUser) : null;
}

export async function updateUser(userId: string, data: Partial<FirestoreUser>): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, data);
}

// ==================== CLASSROOMS ====================

export interface FirestoreClassroom {
    name: string;
    section: string;
    subject?: string;
    teacherId: string;
    teacherName: string;
    bannerColor: string;
    bannerImage?: string;
    code: string; // Join code
    createdAt: Timestamp;
}

export async function createClassroom(data: Omit<FirestoreClassroom, 'createdAt' | 'code'>): Promise<string> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const docRef = await addDoc(collection(db, 'classrooms'), {
        ...data,
        code,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function getClassroom(classroomId: string): Promise<FirestoreClassroom | null> {
    const docRef = doc(db, 'classrooms', classroomId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as FirestoreClassroom) : null;
}

export async function getTeacherClassrooms(teacherId: string): Promise<Array<{ id: string } & FirestoreClassroom>> {
    const q = query(collection(db, 'classrooms'), where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as FirestoreClassroom) }));
}

export async function getStudentClassrooms(studentId: string): Promise<Array<{ id: string } & FirestoreClassroom>> {
    // Get enrollments first
    const enrollmentsQuery = query(collection(db, 'enrollments'), where('studentId', '==', studentId));
    const enrollments = await getDocs(enrollmentsQuery);

    const classroomIds = enrollments.docs.map(doc => doc.data().classroomId);
    if (classroomIds.length === 0) return [];

    const classrooms: Array<{ id: string } & FirestoreClassroom> = [];
    for (const id of classroomIds) {
        const classroom = await getClassroom(id);
        if (classroom) {
            classrooms.push({ id, ...classroom });
        }
    }
    return classrooms;
}

// Get ALL classrooms (for demo/admin purposes)
export async function getAllClassrooms(): Promise<Array<{ id: string } & FirestoreClassroom>> {
    const snapshot = await getDocs(collection(db, 'classrooms'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as FirestoreClassroom) }));
}

// Get enrolled students for a classroom
export async function getClassroomEnrollments(classroomId: string): Promise<string[]> {
    const q = query(collection(db, 'enrollments'), where('classroomId', '==', classroomId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().studentName || doc.data().studentId);
}

export async function joinClassroomByCode(studentId: string, code: string): Promise<string | null> {
    const q = query(collection(db, 'classrooms'), where('code', '==', code.toUpperCase()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const classroomDoc = snapshot.docs[0];

    // Add enrollment
    await addDoc(collection(db, 'enrollments'), {
        studentId,
        classroomId: classroomDoc.id,
        enrolledAt: serverTimestamp(),
    });

    return classroomDoc.id;
}

// ==================== ASSIGNMENTS ====================

export interface FirestoreAssignment {
    classroomId: string;
    title: string;
    description: string;
    type: 'assignment' | 'quiz' | 'material' | 'question';
    dueDate?: string;
    points?: number;
    topicId?: string;
    status: 'draft' | 'assigned' | 'scheduled';
    scheduledDate?: string;
    quizQuestions?: Array<{
        question: string;
        options: string[];
        correctIndex: number;
        explanation?: string;
    }>;
    attachments?: any[];
    order: number;
    createdAt: Timestamp;
}

export async function createAssignment(data: Omit<FirestoreAssignment, 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'assignments'), {
        ...data,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function getClassroomAssignments(classroomId: string): Promise<Array<{ id: string } & FirestoreAssignment>> {
    const q = query(
        collection(db, 'assignments'),
        where('classroomId', '==', classroomId)
    );
    const snapshot = await getDocs(q);
    const assignments = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as FirestoreAssignment) }));
    // Sort client-side by order (ascending)
    return assignments.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function updateAssignment(assignmentId: string, data: Partial<FirestoreAssignment>): Promise<void> {
    const docRef = doc(db, 'assignments', assignmentId);
    await updateDoc(docRef, data);
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
    await deleteDoc(doc(db, 'assignments', assignmentId));
}

// ==================== SUBMISSIONS ====================

export interface FirestoreSubmission {
    assignmentId: string;
    studentId: string;
    content?: string;
    studentAnswers?: number[];
    grade?: number;
    feedback?: string;
    submittedAt?: Timestamp;
    status: 'not-started' | 'in-progress' | 'submitted' | 'graded';
}

export async function getSubmission(assignmentId: string, studentId: string): Promise<FirestoreSubmission | null> {
    const q = query(
        collection(db, 'submissions'),
        where('assignmentId', '==', assignmentId),
        where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : (snapshot.docs[0].data() as FirestoreSubmission);
}

export async function submitAssignment(assignmentId: string, studentId: string, data: Partial<FirestoreSubmission>): Promise<void> {
    // Check if submission exists
    const existing = await getSubmission(assignmentId, studentId);

    if (existing) {
        const q = query(
            collection(db, 'submissions'),
            where('assignmentId', '==', assignmentId),
            where('studentId', '==', studentId)
        );
        const snapshot = await getDocs(q);
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, {
            ...data,
            submittedAt: serverTimestamp(),
            status: 'submitted',
        });
    } else {
        await addDoc(collection(db, 'submissions'), {
            assignmentId,
            studentId,
            ...data,
            submittedAt: serverTimestamp(),
            status: 'submitted',
        });
    }
}

export async function gradeSubmission(submissionId: string, grade: number, feedback: string): Promise<void> {
    const docRef = doc(db, 'submissions', submissionId);
    await updateDoc(docRef, { grade, feedback, status: 'graded' });
}

// ==================== ANNOUNCEMENTS ====================

export interface FirestoreAnnouncement {
    classroomId: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: Timestamp;
}

export async function createAnnouncement(data: Omit<FirestoreAnnouncement, 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'announcements'), {
        ...data,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function getClassroomAnnouncements(classroomId: string): Promise<Array<{ id: string } & FirestoreAnnouncement>> {
    const q = query(
        collection(db, 'announcements'),
        where('classroomId', '==', classroomId)
    );
    const snapshot = await getDocs(q);
    const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as FirestoreAnnouncement) }));
    // Sort client-side by createdAt (descending - newest first)
    return announcements.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
    });
}

// ==================== TOPICS ====================

export interface FirestoreTopic {
    classroomId: string;
    name: string;
    order: number;
    collapsed?: boolean;
}

export async function createTopic(data: FirestoreTopic): Promise<string> {
    const docRef = await addDoc(collection(db, 'topics'), data);
    return docRef.id;
}

export async function getClassroomTopics(classroomId: string): Promise<Array<{ id: string } & FirestoreTopic>> {
    const q = query(
        collection(db, 'topics'),
        where('classroomId', '==', classroomId)
    );
    const snapshot = await getDocs(q);
    const topics = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as FirestoreTopic) }));
    // Sort client-side by order (ascending)
    return topics.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function updateTopic(topicId: string, data: Partial<FirestoreTopic>): Promise<void> {
    const docRef = doc(db, 'topics', topicId);
    await updateDoc(docRef, data);
}

// ==================== REAL-TIME LISTENERS ====================

export function subscribeToClassroomAssignments(
    classroomId: string,
    callback: (assignments: Array<{ id: string } & FirestoreAssignment>) => void
) {
    const q = query(
        collection(db, 'assignments'),
        where('classroomId', '==', classroomId)
    );

    return onSnapshot(q, (snapshot) => {
        const assignments = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as FirestoreAssignment) }));
        // Sort client-side by order
        callback(assignments.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });
}

export function subscribeToClassroomAnnouncements(
    classroomId: string,
    callback: (announcements: Array<{ id: string } & FirestoreAnnouncement>) => void
) {
    const q = query(
        collection(db, 'announcements'),
        where('classroomId', '==', classroomId)
    );

    return onSnapshot(q, (snapshot) => {
        const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as FirestoreAnnouncement) }));
        // Sort client-side by createdAt (newest first)
        callback(announcements.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        }));
    });
}

export function subscribeToClassroomTopics(
    classroomId: string,
    callback: (topics: Array<{ id: string } & FirestoreTopic>) => void
) {
    const q = query(
        collection(db, 'topics'),
        where('classroomId', '==', classroomId)
    );

    return onSnapshot(q, (snapshot) => {
        const topics = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as FirestoreTopic) }));
        // Sort client-side by order
        callback(topics.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });
}

// ==================== RUBRICS ====================

export async function getClassroomRubric(classroomId: string): Promise<ClassRubric | null> {
    const docRef = doc(db, 'rubrics', classroomId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
        name: data.name,
        criteria: data.criteria || [],
    };
}

// ==================== AI ANALYTICS ====================

export async function saveLuminaSession(session: Omit<LuminaTutorSession, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'lumina_sessions'), {
        ...session,
        startTime: serverTimestamp(),
        lastActive: serverTimestamp()
    });
    return docRef.id;
}

export async function updateLuminaSession(sessionId: string, sessionData: Partial<LuminaTutorSession>): Promise<void> {
    const docRef = doc(db, 'lumina_sessions', sessionId);
    await updateDoc(docRef, {
        ...sessionData,
        lastActive: serverTimestamp(),
    });
}

export async function getClassroomLuminaSessions(classroomId: string): Promise<LuminaTutorSession[]> {
    const q = query(
        collection(db, 'lumina_sessions'),
        where('classroomId', '==', classroomId),
        orderBy('startTime', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LuminaTutorSession));
}

export function subscribeToClassroomLuminaSessions(classroomId: string, callback: (sessions: LuminaTutorSession[]) => void) {
    const q = query(
        collection(db, 'lumina_sessions'),
        where('classroomId', '==', classroomId),
        orderBy('startTime', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LuminaTutorSession));
        callback(sessions);
    });
}

export async function updateStudentAIAnalytics(studentId: string, classroomId: string, sessionData: Partial<StudentAIAnalytics>): Promise<void> {
    const docId = `${studentId}_${classroomId}`;
    const docRef = doc(db, 'ai_analytics', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        await updateDoc(docRef, {
            ...sessionData,
            lastActive: Date.now(),
        });
    } else {
        await setDoc(docRef, {
            studentId,
            classroomId,
            totalSessions: 1,
            totalQuestions: 0,
            topTopics: [],
            conceptMastery: {},
            lastActive: Date.now(),
            ...sessionData
        });
    }
}

// ==================== AI GRADING INSIGHTS ====================

export async function saveAIGradingInsight(insight: Omit<AIGradingInsight, 'id' | 'timestamp'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'ai_grading_insights'), {
        ...insight,
        timestamp: serverTimestamp(),
    });
    return docRef.id;
}

export async function getClassroomAIGradingInsights(classroomId: string): Promise<AIGradingInsight[]> {
    const q = query(
        collection(db, 'ai_grading_insights'),
        where('classroomId', '==', classroomId),
        orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toMillis() || Date.now()
        } as AIGradingInsight;
    });
}

export function subscribeToClassroomAIGradingInsights(
    classroomId: string,
    callback: (insights: AIGradingInsight[]) => void
) {
    const q = query(
        collection(db, 'ai_grading_insights'),
        where('classroomId', '==', classroomId),
        orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const insights = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toMillis() || Date.now()
            } as AIGradingInsight;
        });
        callback(insights);
    });
}
