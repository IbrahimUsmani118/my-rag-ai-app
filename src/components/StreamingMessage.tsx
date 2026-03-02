import { useEffect, useState } from 'react';

const WORD_DELAY_MS = 35;

interface StreamingMessageProps {
  fullText: string;
  onComplete?: () => void;
}

export function StreamingMessage({ fullText, onComplete }: StreamingMessageProps) {
  const [visibleLength, setVisibleLength] = useState(0);
  const words = fullText.split(/(\s+)/); // keep spaces
  const visibleText = words.slice(0, visibleLength).join('');

  useEffect(() => {
    if (visibleLength >= words.length) {
      onComplete?.();
      return;
    }
    const t = setTimeout(() => setVisibleLength((n) => n + 1), WORD_DELAY_MS);
    return () => clearTimeout(t);
  }, [visibleLength, words.length, onComplete]);

  useEffect(() => {
    setVisibleLength(0);
  }, [fullText]);

  return <span>{visibleText}</span>;
}
