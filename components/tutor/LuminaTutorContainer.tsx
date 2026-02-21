import { useState } from 'react';
import { LandingPage } from './LandingPage';
import { AIVoiceTutor } from './AIVoiceTutor';

interface LuminaTutorContainerProps {
    currentUser: any;
    classroom: any;
}

export function LuminaTutorContainer({ currentUser, classroom }: LuminaTutorContainerProps) {
    const [hasStarted, setHasStarted] = useState(false);
    const [settings, setSettings] = useState<{
        voice_id: string;
        voice_name: string;
        ai_pushiness_level: number;
    } | null>(null);

    const handleStart = (voiceId: string, voiceName: string, pushinessLevel: number) => {
        setSettings({
            voice_id: voiceId,
            voice_name: voiceName,
            ai_pushiness_level: pushinessLevel,
        });
        setHasStarted(true);
    };

    const handleBack = () => {
        setHasStarted(false);
        setSettings(null);
    };

    if (!hasStarted || !settings) {
        return <LandingPage onStart={handleStart} />;
    }

    return (
        <div className="h-full flex flex-col p-4 bg-white">
            <AIVoiceTutor
                settings={settings}
                onBack={handleBack}
                currentUser={currentUser}
            />
        </div>
    );
}
