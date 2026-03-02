import { useEffect, useState } from 'react';

const WORD_DELAY_MS = 38;

export function useStreamingText(fullText: string, isActive: boolean): string {
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const words = fullText.split(/(\s+)/);

  useEffect(() => {
    if (!isActive || fullText === '') return;
    setVisibleWordCount(0);
  }, [fullText, isActive]);

  useEffect(() => {
    if (!isActive || visibleWordCount >= words.length) return;
    const t = setTimeout(() => setVisibleWordCount((n) => n + 1), WORD_DELAY_MS);
    return () => clearTimeout(t);
  }, [isActive, visibleWordCount, words.length]);

  if (!isActive || fullText === '') return fullText;
  if (visibleWordCount >= words.length) return fullText;
  return words.slice(0, visibleWordCount).join('');
}
