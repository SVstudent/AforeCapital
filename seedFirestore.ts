// Firestore seed script - Run this once to populate demo data
// Usage: Open browser console and call: await window.seedFirestore()
// This will CLEAR existing data and seed fresh!

import {
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase/config';

// Helper to clear a collection
async function clearCollection(collectionName: string) {
    const snapshot = await getDocs(collection(db, collectionName));
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log(`  🗑️ Cleared ${snapshot.docs.length} items from ${collectionName}`);
}

// =============================================================================
// CLASS RUBRICS - Unique grading criteria per subject
// =============================================================================

const CLASS_RUBRICS: Record<string, {
    name: string;
    criteria: Array<{
        name: string;
        description: string;
        maxPoints: number;
        levels: { score: number; description: string }[];
    }>;
}> = {
    'phys-101': {
        name: 'Physics Lab & Problem Solving Rubric',
        criteria: [
            {
                name: 'Scientific Method',
                description: 'Proper use of hypothesis, procedure, and conclusion',
                maxPoints: 25,
                levels: [
                    { score: 25, description: 'Excellent: Clear hypothesis, detailed procedure, logical conclusions supported by data' },
                    { score: 20, description: 'Good: Hypothesis present, procedure clear, conclusions mostly supported' },
                    { score: 15, description: 'Satisfactory: Basic hypothesis and procedure, conclusions need more support' },
                    { score: 10, description: 'Needs Work: Missing or unclear hypothesis, incomplete procedure' },
                ]
            },
            {
                name: 'Calculations & Units',
                description: 'Mathematical accuracy and proper unit handling',
                maxPoints: 30,
                levels: [
                    { score: 30, description: 'Excellent: All calculations correct, units properly converted and labeled' },
                    { score: 24, description: 'Good: Minor calculation errors, units mostly correct' },
                    { score: 18, description: 'Satisfactory: Some calculation errors, some unit issues' },
                    { score: 12, description: 'Needs Work: Major errors in calculations or units' },
                ]
            },
            {
                name: 'Diagrams & Visuals',
                description: 'Free body diagrams, graphs, and visual representations',
                maxPoints: 25,
                levels: [
                    { score: 25, description: 'Excellent: Clear, accurate diagrams with proper labels and scales' },
                    { score: 20, description: 'Good: Diagrams present with minor labeling issues' },
                    { score: 15, description: 'Satisfactory: Basic diagrams, missing some labels or accuracy' },
                    { score: 10, description: 'Needs Work: Diagrams missing, unclear, or inaccurate' },
                ]
            },
            {
                name: 'Conceptual Understanding',
                description: 'Demonstration of physics concepts and principles',
                maxPoints: 20,
                levels: [
                    { score: 20, description: 'Excellent: Deep understanding of physics principles evident' },
                    { score: 16, description: 'Good: Solid understanding with minor gaps' },
                    { score: 12, description: 'Satisfactory: Basic understanding, some misconceptions' },
                    { score: 8, description: 'Needs Work: Significant conceptual gaps' },
                ]
            },
        ]
    },
    'calc-bc': {
        name: 'Calculus Problem Solving Rubric',
        criteria: [
            {
                name: 'Problem Setup',
                description: 'Correctly identifying given information and what to find',
                maxPoints: 20,
                levels: [
                    { score: 20, description: 'Excellent: Problem clearly stated, all variables identified, approach outlined' },
                    { score: 16, description: 'Good: Problem understood, most variables identified' },
                    { score: 12, description: 'Satisfactory: Basic setup, some missing elements' },
                    { score: 8, description: 'Needs Work: Problem poorly set up or misunderstood' },
                ]
            },
            {
                name: 'Mathematical Process',
                description: 'Showing all steps and using correct methods',
                maxPoints: 35,
                levels: [
                    { score: 35, description: 'Excellent: All steps shown clearly, correct methods applied throughout' },
                    { score: 28, description: 'Good: Most steps shown, methods generally correct' },
                    { score: 21, description: 'Satisfactory: Some steps missing, method partially correct' },
                    { score: 14, description: 'Needs Work: Major steps missing or wrong methods used' },
                ]
            },
            {
                name: 'Mathematical Accuracy',
                description: 'Correctness of computations and final answer',
                maxPoints: 30,
                levels: [
                    { score: 30, description: 'Excellent: All computations correct, accurate final answer' },
                    { score: 24, description: 'Good: Minor arithmetic errors, answer close to correct' },
                    { score: 18, description: 'Satisfactory: Some computational errors affecting answer' },
                    { score: 12, description: 'Needs Work: Major computational errors, incorrect answer' },
                ]
            },
            {
                name: 'Notation & Presentation',
                description: 'Proper mathematical notation and clear presentation',
                maxPoints: 15,
                levels: [
                    { score: 15, description: 'Excellent: Perfect notation, well-organized, easy to follow' },
                    { score: 12, description: 'Good: Minor notation issues, generally organized' },
                    { score: 9, description: 'Satisfactory: Some notation errors, somewhat disorganized' },
                    { score: 6, description: 'Needs Work: Poor notation, difficult to follow' },
                ]
            },
        ]
    },
    'bio-ap': {
        name: 'AP Biology Scientific Rubric',
        criteria: [
            {
                name: 'Scientific Accuracy',
                description: 'Correctness of biological facts and concepts',
                maxPoints: 30,
                levels: [
                    { score: 30, description: 'Excellent: All biological concepts accurately explained with depth' },
                    { score: 24, description: 'Good: Mostly accurate with minor errors' },
                    { score: 18, description: 'Satisfactory: Basic accuracy, some misconceptions' },
                    { score: 12, description: 'Needs Work: Significant factual errors' },
                ]
            },
            {
                name: 'Scientific Terminology',
                description: 'Proper use of biological vocabulary and terms',
                maxPoints: 20,
                levels: [
                    { score: 20, description: 'Excellent: Precise use of scientific terminology throughout' },
                    { score: 16, description: 'Good: Appropriate terminology with minor issues' },
                    { score: 12, description: 'Satisfactory: Some correct terminology, some informal language' },
                    { score: 8, description: 'Needs Work: Lacks scientific vocabulary' },
                ]
            },
            {
                name: 'Diagrams & Labels',
                description: 'Quality and accuracy of biological diagrams',
                maxPoints: 25,
                levels: [
                    { score: 25, description: 'Excellent: Detailed, accurate diagrams with complete labeling' },
                    { score: 20, description: 'Good: Clear diagrams with most labels correct' },
                    { score: 15, description: 'Satisfactory: Basic diagrams, some labels missing or incorrect' },
                    { score: 10, description: 'Needs Work: Diagrams unclear, missing, or incorrectly labeled' },
                ]
            },
            {
                name: 'Analysis & Connections',
                description: 'Connecting concepts and analyzing relationships',
                maxPoints: 25,
                levels: [
                    { score: 25, description: 'Excellent: Deep analysis connecting multiple biological concepts' },
                    { score: 20, description: 'Good: Solid analysis with clear connections' },
                    { score: 15, description: 'Satisfactory: Basic analysis, limited connections' },
                    { score: 10, description: 'Needs Work: Little to no analysis or connections made' },
                ]
            },
        ]
    },
    'hist-101': {
        name: 'World History Research & Analysis Rubric',
        criteria: [
            {
                name: 'Thesis & Argument',
                description: 'Clear thesis statement and logical argument structure',
                maxPoints: 25,
                levels: [
                    { score: 25, description: 'Excellent: Strong, clear thesis with compelling argument throughout' },
                    { score: 20, description: 'Good: Clear thesis with solid supporting argument' },
                    { score: 15, description: 'Satisfactory: Thesis present but argument needs development' },
                    { score: 10, description: 'Needs Work: Weak or missing thesis, unclear argument' },
                ]
            },
            {
                name: 'Historical Evidence',
                description: 'Use of primary and secondary sources to support claims',
                maxPoints: 30,
                levels: [
                    { score: 30, description: 'Excellent: Multiple relevant sources integrated effectively' },
                    { score: 24, description: 'Good: Good use of sources with clear citations' },
                    { score: 18, description: 'Satisfactory: Some sources used, citation issues' },
                    { score: 12, description: 'Needs Work: Insufficient or irrelevant sources' },
                ]
            },
            {
                name: 'Historical Context',
                description: 'Understanding and explaining historical context',
                maxPoints: 25,
                levels: [
                    { score: 25, description: 'Excellent: Rich historical context, shows cause and effect' },
                    { score: 20, description: 'Good: Solid context, some cause/effect analysis' },
                    { score: 15, description: 'Satisfactory: Basic context provided' },
                    { score: 10, description: 'Needs Work: Lacks historical context' },
                ]
            },
            {
                name: 'Writing Quality',
                description: 'Grammar, organization, and clarity of writing',
                maxPoints: 20,
                levels: [
                    { score: 20, description: 'Excellent: Well-organized, clear writing, no errors' },
                    { score: 16, description: 'Good: Organized writing with minor errors' },
                    { score: 12, description: 'Satisfactory: Some organization issues, several errors' },
                    { score: 8, description: 'Needs Work: Disorganized, many errors' },
                ]
            },
        ]
    },
};

// CLASSROOM DATA
const CLASSROOMS = [
    {
        id: 'phys-101',
        name: 'Physics 101',
        section: 'Period 3',
        teacherId: 'demo-teacher',
        teacherName: 'Dr. Aris',
        bannerColor: 'bg-[#1e8e3e]',
        code: 'PHYS01',
    },
    {
        id: 'calc-bc',
        name: 'Calculus BC',
        section: 'Advanced Placement',
        teacherId: 'demo-teacher',
        teacherName: 'Prof. Gauss',
        bannerColor: 'bg-[#4285f4]',
        code: 'CALC01',
    },
    {
        id: 'bio-ap',
        name: 'AP Biology',
        section: 'Period 5',
        teacherId: 'demo-teacher',
        teacherName: 'Dr. Darwin',
        bannerColor: 'bg-[#34a853]',
        code: 'BIO001',
    },
    {
        id: 'hist-101',
        name: 'World History',
        section: 'Period 2',
        teacherId: 'demo-teacher',
        teacherName: 'Prof. Churchill',
        bannerColor: 'bg-[#ea4335]',
        code: 'HIST01',
    },
];

const CLASSROOM_STUDENTS: Record<string, string[]> = {
    'phys-101': ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Prince', 'Ethan Hunt'],
    'calc-bc': ['Frank Castle', 'Gwen Stacy', 'Harry Osborn', 'Iris West'],
    'bio-ap': ['Jack Sparrow', 'Kara Danvers', 'Logan Howlett'],
    'hist-101': ['Max Rockatansky', 'Nancy Drew', 'Oscar Isaac'],
};

const CLASSROOM_CONTENT: Record<string, {
    announcements: Array<{ id: string; content: string; author: string; hoursAgo: number }>;
    topics: Array<{ id: string; name: string; order: number; collapsed: boolean }>;
    assignments: Array<{
        id: string;
        title: string;
        description: string;
        type: 'assignment' | 'quiz' | 'material';
        points?: number;
        dueDate: string;
        topicId: string;
        status: string;
        order: number;
        quizReady?: boolean;
    }>;
}> = {
    'phys-101': {
        announcements: [
            { id: 'phys-a1', content: "Welcome to Physics 101! Lab 01 on vectors is now available.", author: 'Dr. Aris', hoursAgo: 1 },
            { id: 'phys-a2', content: "Remember to bring your lab notebooks on Wednesday!", author: 'Dr. Aris', hoursAgo: 24 },
        ],
        topics: [
            { id: 'phys-t1', name: 'Unit 1: Mechanics', order: 1, collapsed: false },
            { id: 'phys-t2', name: 'Unit 2: Thermodynamics', order: 2, collapsed: false },
            { id: 'phys-t3', name: 'Lab Resources', order: 3, collapsed: true },
        ],
        assignments: [
            { id: 'phys-as1', title: 'Lab 01: Vector Analysis', description: 'Calculate the resultant force of three vectors acting on a single point. Show all work and include free body diagrams.', dueDate: 'Friday, Oct 24', topicId: 'phys-t1', status: 'assigned', type: 'assignment', points: 100, order: 1 },
            { id: 'phys-as2', title: "Newton's Laws of Motion", description: 'Explain the relationship between force, mass, and acceleration with real-world examples.', dueDate: 'Monday, Oct 27', topicId: 'phys-t1', status: 'assigned', type: 'assignment', points: 50, order: 2 },
            { id: 'phys-as3', title: 'Kinematics Problem Set', description: 'Complete problems 1-15 on projectile motion and free fall.', dueDate: 'Wednesday, Oct 29', topicId: 'phys-t1', status: 'assigned', type: 'assignment', points: 75, order: 3 },
            { id: 'phys-as4', title: 'Unit 1 Quiz: Mechanics', description: 'Quiz covering vectors, forces, and Newton\'s laws. 30 minutes.', dueDate: 'Thursday, Oct 30', topicId: 'phys-t1', status: 'assigned', type: 'quiz', points: 50, quizReady: true, order: 4 },
            { id: 'phys-as5', title: 'Lab Safety Guidelines', description: 'Review the lab safety protocols before your first lab session.', dueDate: '', topicId: 'phys-t3', status: 'assigned', type: 'material', order: 5 },
        ],
    },
    'calc-bc': {
        announcements: [
            { id: 'calc-a1', content: "Welcome to Calculus BC! This is an accelerated course covering both AB and BC content.", author: 'Prof. Gauss', hoursAgo: 2 },
            { id: 'calc-a2', content: "AP exam prep sessions start next month. Sign up sheet in class!", author: 'Prof. Gauss', hoursAgo: 48 },
        ],
        topics: [
            { id: 'calc-t1', name: 'Limits & Continuity', order: 1, collapsed: false },
            { id: 'calc-t2', name: 'Derivatives', order: 2, collapsed: false },
            { id: 'calc-t3', name: 'Integration', order: 3, collapsed: false },
            { id: 'calc-t4', name: 'AP Prep Materials', order: 4, collapsed: true },
        ],
        assignments: [
            { id: 'calc-as1', title: 'Limits Practice Set', description: 'Evaluate limits using algebraic techniques. Problems 1-20 from Chapter 2.', dueDate: 'Friday, Oct 24', topicId: 'calc-t1', status: 'assigned', type: 'assignment', points: 80, order: 1 },
            { id: 'calc-as2', title: 'Chain Rule Mastery', description: 'Calculate derivatives using the chain rule. Show all intermediate steps.', dueDate: 'Monday, Oct 27', topicId: 'calc-t2', status: 'assigned', type: 'assignment', points: 100, order: 2 },
            { id: 'calc-as3', title: 'Related Rates Problems', description: 'Solve 10 related rates problems involving geometric relationships.', dueDate: 'Wednesday, Oct 29', topicId: 'calc-t2', status: 'missing', type: 'assignment', points: 90, order: 3 },
            { id: 'calc-as4', title: 'Derivatives Quiz', description: 'Timed quiz on differentiation techniques. Product, quotient, and chain rules.', dueDate: 'Thursday, Oct 30', topicId: 'calc-t2', status: 'assigned', type: 'quiz', points: 60, quizReady: true, order: 4 },
            { id: 'calc-as5', title: 'AP Formula Sheet', description: 'Reference sheet for the AP Calculus BC exam.', dueDate: '', topicId: 'calc-t4', status: 'assigned', type: 'material', order: 5 },
        ],
    },
    'bio-ap': {
        announcements: [
            { id: 'bio-a1', content: "Welcome to AP Biology! Get ready to explore the wonders of life.", author: 'Dr. Darwin', hoursAgo: 1.5 },
            { id: 'bio-a2', content: "Lab coats and goggles are required starting next week.", author: 'Dr. Darwin', hoursAgo: 72 },
        ],
        topics: [
            { id: 'bio-t1', name: 'Unit 1: Cell Biology', order: 1, collapsed: false },
            { id: 'bio-t2', name: 'Unit 2: Genetics', order: 2, collapsed: false },
            { id: 'bio-t3', name: 'Unit 3: Evolution', order: 3, collapsed: true },
            { id: 'bio-t4', name: 'Lab Protocols', order: 4, collapsed: true },
        ],
        assignments: [
            { id: 'bio-as1', title: 'Cell Structure Diagram', description: 'Create a detailed diagram of a eukaryotic cell labeling all organelles.', dueDate: 'Friday, Oct 24', topicId: 'bio-t1', status: 'assigned', type: 'assignment', points: 100, order: 1 },
            { id: 'bio-as2', title: 'Mitosis vs Meiosis Essay', description: 'Compare and contrast mitosis and meiosis. Minimum 500 words.', dueDate: 'Monday, Oct 27', topicId: 'bio-t1', status: 'assigned', type: 'assignment', points: 80, order: 2 },
            { id: 'bio-as3', title: 'Punnett Square Practice', description: 'Complete 15 Punnett square problems covering monohybrid and dihybrid crosses.', dueDate: 'Wednesday, Oct 29', topicId: 'bio-t2', status: 'assigned', type: 'assignment', points: 75, order: 3 },
            { id: 'bio-as4', title: 'Cell Biology Quiz', description: 'Quiz on cell structure, function, and cellular respiration.', dueDate: 'Thursday, Oct 30', topicId: 'bio-t1', status: 'assigned', type: 'quiz', points: 50, quizReady: true, order: 4 },
            { id: 'bio-as5', title: 'Microscope Lab Guide', description: 'Instructions for proper microscope use and cell observation techniques.', dueDate: '', topicId: 'bio-t4', status: 'assigned', type: 'material', order: 5 },
        ],
    },
    'hist-101': {
        announcements: [
            { id: 'hist-a1', content: "Welcome to World History! We'll explore civilizations from ancient times to modern day.", author: 'Prof. Churchill', hoursAgo: 2.5 },
            { id: 'hist-a2', content: "Field trip to the history museum scheduled for November 15th!", author: 'Prof. Churchill', hoursAgo: 120 },
        ],
        topics: [
            { id: 'hist-t1', name: 'Ancient Civilizations', order: 1, collapsed: false },
            { id: 'hist-t2', name: 'Medieval Period', order: 2, collapsed: false },
            { id: 'hist-t3', name: 'Modern History', order: 3, collapsed: true },
            { id: 'hist-t4', name: 'Primary Sources', order: 4, collapsed: true },
        ],
        assignments: [
            { id: 'hist-as1', title: 'Ancient Egypt Research', description: 'Research paper on the cultural achievements of Ancient Egypt. 3-5 pages.', dueDate: 'Friday, Oct 24', topicId: 'hist-t1', status: 'assigned', type: 'assignment', points: 150, order: 1 },
            { id: 'hist-as2', title: 'Greek Democracy Analysis', description: 'Analyze the origins of democracy in ancient Greece and its influence today.', dueDate: 'Monday, Oct 27', topicId: 'hist-t1', status: 'assigned', type: 'assignment', points: 100, order: 2 },
            { id: 'hist-as3', title: 'Roman Empire Timeline', description: 'Create a detailed timeline of major events in Roman history.', dueDate: 'Wednesday, Oct 29', topicId: 'hist-t1', status: 'missing', type: 'assignment', points: 80, order: 3 },
            { id: 'hist-as4', title: 'Ancient Civilizations Quiz', description: 'Quiz covering Mesopotamia, Egypt, Greece, and Rome.', dueDate: 'Thursday, Oct 30', topicId: 'hist-t1', status: 'assigned', type: 'quiz', points: 50, quizReady: true, order: 4 },
            { id: 'hist-as5', title: 'Citing Historical Sources', description: 'Guide on how to properly cite primary and secondary historical sources.', dueDate: '', topicId: 'hist-t4', status: 'assigned', type: 'material', order: 5 },
        ],
    },
};

export async function seedFirestore() {
    console.log('🌱 Starting Firestore seed...');
    console.log('');

    // STEP 1: Clear ALL existing data first
    console.log('🗑️ Clearing existing data...');
    await clearCollection('classrooms');
    await clearCollection('enrollments');
    await clearCollection('topics');
    await clearCollection('announcements');
    await clearCollection('assignments');
    await clearCollection('rubrics');
    console.log('');

    // STEP 2: Seed fresh data
    console.log('📚 Seeding fresh data...');

    for (const classroom of CLASSROOMS) {
        const classroomId = classroom.id;
        console.log(`  📖 ${classroom.name}`);

        // Create classroom document WITH rubric
        const rubric = CLASS_RUBRICS[classroomId];
        await setDoc(doc(db, 'classrooms', classroomId), {
            name: classroom.name,
            section: classroom.section,
            teacherId: classroom.teacherId,
            teacherName: classroom.teacherName,
            bannerColor: classroom.bannerColor,
            code: classroom.code,
            rubric: rubric || null, // Embed rubric directly in classroom
            createdAt: serverTimestamp(),
        });

        // Also store rubric separately for easy access
        if (rubric) {
            await setDoc(doc(db, 'rubrics', classroomId), {
                classroomId,
                ...rubric,
            });
        }

        // Enroll students
        const students = CLASSROOM_STUDENTS[classroomId] || [];
        for (const student of students) {
            const studentKey = student.replace(/\s/g, '-').toLowerCase();
            await setDoc(doc(db, 'enrollments', `${classroomId}-${studentKey}`), {
                classroomId,
                studentId: studentKey,
                studentName: student,
                enrolledAt: serverTimestamp(),
            });
        }

        // Get content for this classroom
        const content = CLASSROOM_CONTENT[classroomId];
        if (!content) continue;

        // Create topics
        for (const topic of content.topics) {
            await setDoc(doc(db, 'topics', topic.id), {
                classroomId,
                name: topic.name,
                order: topic.order,
                collapsed: topic.collapsed,
            });
        }

        // Create announcements
        for (const ann of content.announcements) {
            await setDoc(doc(db, 'announcements', ann.id), {
                classroomId,
                authorId: 'demo-teacher',
                authorName: ann.author,
                content: ann.content,
                createdAt: new Date(Date.now() - ann.hoursAgo * 3600000),
            });
        }

        // Create assignments
        for (const assignment of content.assignments) {
            await setDoc(doc(db, 'assignments', assignment.id), {
                classroomId,
                title: assignment.title,
                description: assignment.description,
                type: assignment.type,
                points: assignment.points || null,
                dueDate: assignment.dueDate,
                topicId: assignment.topicId,
                status: assignment.status,
                order: assignment.order,
                quizReady: assignment.quizReady || false,
                createdAt: new Date(Date.now() - assignment.order * 86400000),
            });
        }
    }

    console.log('');
    console.log('✅ SEED COMPLETE! Fresh data loaded.');
    console.log('');
    console.log('📋 Summary:');
    console.log('   • 4 classrooms with rubrics');
    console.log('   • 15 topics');
    console.log('   • 8 announcements');
    console.log('   • 20 assignments');
    console.log('   • 15 student enrollments');
    console.log('   • 4 class rubrics (Physics, Calculus, Biology, History)');
    console.log('');
    console.log('🔄 Refresh the page to see your data!');

    return 'Seed complete!';
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
    (window as any).seedFirestore = seedFirestore;
}
