import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathContentProps {
    content: string;
    displayMode?: boolean;
}

export function MathContent({ content, displayMode = false }: MathContentProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        container.innerHTML = '';

        const parts = content.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g);

        parts.forEach((part) => {
            if (!part) return;

            if (part.startsWith('$$') && part.endsWith('$$')) {
                const math = part.slice(2, -2);
                const span = document.createElement('div');
                span.className = 'my-4';
                try {
                    katex.render(math, span, {
                        displayMode: true,
                        throwOnError: false,
                        trust: false,
                    });
                    container.appendChild(span);
                } catch (error) {
                    console.error('KaTeX rendering error (display):', error);
                    span.textContent = part;
                    span.className = 'text-red-600 my-2';
                    container.appendChild(span);
                }
            } else if (part.startsWith('$') && part.endsWith('$')) {
                const math = part.slice(1, -1);
                const span = document.createElement('span');
                span.className = 'inline-block mx-1';
                try {
                    katex.render(math, span, {
                        displayMode: false,
                        throwOnError: false,
                        trust: false,
                    });
                    container.appendChild(span);
                } catch (error) {
                    console.error('KaTeX rendering error (inline):', error);
                    span.textContent = part;
                    span.className = 'text-red-600';
                    container.appendChild(span);
                }
            } else {
                const textParts = part.split('\n');
                textParts.forEach((textPart, index) => {
                    if (textPart.trim()) {
                        const textNode = document.createTextNode(textPart);
                        container.appendChild(textNode);
                    }
                    if (index < textParts.length - 1) {
                        container.appendChild(document.createElement('br'));
                    }
                });
            }
        });
    }, [content]);

    return (
        <div
            ref={containerRef}
            className={`text-slate-800 leading-relaxed ${displayMode ? 'text-center' : ''}`}
        />
    );
}
