import { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
    getByteFrequencyData: () => Uint8Array | undefined;
    isSpeaking: boolean;
    isActive: boolean;
}

export function VoiceVisualizer({ getByteFrequencyData, isSpeaking, isActive }: VoiceVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            const data = getByteFrequencyData();
            const width = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);

            if (!isActive || !data) {
                // Draw a faint static line when inactive
                ctx.beginPath();
                ctx.moveTo(0, height / 2);
                ctx.lineTo(width, height / 2);
                ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
                animationRef.current = requestAnimationFrame(draw);
                return;
            }

            const barWidth = (width / data.length) * 2.5;
            let x = 0;

            const gradient = ctx.createLinearGradient(0, height, 0, 0);
            if (isSpeaking) {
                gradient.addColorStop(0, '#3b82f6'); // Blue
                gradient.addColorStop(1, '#60a5fa');
            } else {
                gradient.addColorStop(0, '#10b981'); // Green/Teal
                gradient.addColorStop(1, '#34d399');
            }

            ctx.beginPath();
            ctx.moveTo(0, height / 2);

            for (let i = 0; i < data.length; i++) {
                const barHeight = (data[i] / 255) * height * 0.8;
                const y = (height / 2) - (barHeight / 2);

                if (i === 0) {
                    ctx.moveTo(x, y + barHeight / 2);
                } else {
                    ctx.quadraticCurveTo(x - barWidth / 2, y + barHeight / 2, x, y + barHeight / 2);
                }

                x += barWidth + 1;
            }

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.stroke();

            animationRef.current = requestAnimationFrame(draw);
        };

        animationRef.current = requestAnimationFrame(draw);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [getByteFrequencyData, isSpeaking, isActive]);

    return (
        <div className="flex flex-col items-center justify-center h-12 w-48 relative overflow-hidden rounded-xl">
            <canvas
                ref={canvasRef}
                width={192}
                height={48}
                className="w-full h-full"
            />
        </div>
    );
}
