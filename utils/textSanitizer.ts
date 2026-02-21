export function sanitizeTextForSpeech(text: string): string {
    let sanitized = text;

    sanitized = sanitized.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
    sanitized = sanitized.replace(/\*\*(.+?)\*\*/g, '$1');
    sanitized = sanitized.replace(/\*(.+?)\*/g, '$1');
    sanitized = sanitized.replace(/___(.+?)___/g, '$1');
    sanitized = sanitized.replace(/__(.+?)__/g, '$1');
    sanitized = sanitized.replace(/_(.+?)_/g, '$1');

    sanitized = sanitized.replace(/^#{1,6}\s+/gm, '');

    sanitized = sanitized.replace(/```[\s\S]*?```/g, 'code snippet');
    sanitized = sanitized.replace(/`(.+?)`/g, '$1');

    sanitized = sanitized.replace(/^\s*[-*+]\s+/gm, '');
    sanitized = sanitized.replace(/^\s*\d+\.\s+/gm, '');

    sanitized = sanitized.replace(/^>\s+/gm, '');

    sanitized = sanitized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    sanitized = sanitized.replace(/(?<!\d)=(?!\d)/g, ' equals ');
    sanitized = sanitized.replace(/\+/g, ' plus ');
    sanitized = sanitized.replace(/(?<!\d)-(?!\d)/g, ' minus ');
    sanitized = sanitized.replace(/×|\\times/g, ' times ');
    sanitized = sanitized.replace(/÷|\\div/g, ' divided by ');
    sanitized = sanitized.replace(/≤|\\leq/g, ' less than or equal to ');
    sanitized = sanitized.replace(/≥|\\geq/g, ' greater than or equal to ');
    sanitized = sanitized.replace(/≠|\\neq/g, ' not equal to ');
    sanitized = sanitized.replace(/√|\\sqrt/g, ' square root of ');
    sanitized = sanitized.replace(/\^(\d+)/g, ' to the power of $1');

    sanitized = sanitized.replace(/\s+/g, ' ');
    sanitized = sanitized.trim();

    return sanitized;
}
