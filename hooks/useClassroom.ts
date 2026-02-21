'use client';

import { useState, useEffect } from 'react';
import {
    FirestoreClassroom,
    FirestoreAssignment,
    FirestoreAnnouncement,
    FirestoreTopic,
    getClassroom,
    subscribeToClassroomAssignments,
    subscribeToClassroomAnnouncements,
    subscribeToClassroomTopics,
    getSubmission,
    FirestoreSubmission,
} from '../lib/firestore';
import { useAuth } from '../contexts/AuthContext';

interface ClassroomData {
    classroom: (FirestoreClassroom & { id: string }) | null;
    assignments: Array<{ id: string } & FirestoreAssignment>;
    announcements: Array<{ id: string } & FirestoreAnnouncement>;
    topics: Array<{ id: string } & FirestoreTopic>;
    loading: boolean;
    error: string | null;
}

export function useClassroomData(classroomId: string | null): ClassroomData {
    const [classroom, setClassroom] = useState<(FirestoreClassroom & { id: string }) | null>(null);
    const [assignments, setAssignments] = useState<Array<{ id: string } & FirestoreAssignment>>([]);
    const [announcements, setAnnouncements] = useState<Array<{ id: string } & FirestoreAnnouncement>>([]);
    const [topics, setTopics] = useState<Array<{ id: string } & FirestoreTopic>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!classroomId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // Fetch classroom data
        getClassroom(classroomId)
            .then((data) => {
                if (data) {
                    setClassroom({ id: classroomId, ...data });
                } else {
                    setError('Classroom not found');
                }
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });

        // Subscribe to real-time updates
        const unsubAssignments = subscribeToClassroomAssignments(classroomId, setAssignments);
        const unsubAnnouncements = subscribeToClassroomAnnouncements(classroomId, setAnnouncements);
        const unsubTopics = subscribeToClassroomTopics(classroomId, setTopics);

        return () => {
            unsubAssignments();
            unsubAnnouncements();
            unsubTopics();
        };
    }, [classroomId]);

    return { classroom, assignments, announcements, topics, loading, error };
}

// Hook to get student's submission for an assignment
export function useSubmission(assignmentId: string | null, studentId: string | null) {
    const [submission, setSubmission] = useState<FirestoreSubmission | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!assignmentId || !studentId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        getSubmission(assignmentId, studentId)
            .then((data) => {
                setSubmission(data);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, [assignmentId, studentId]);

    return { submission, loading };
}
