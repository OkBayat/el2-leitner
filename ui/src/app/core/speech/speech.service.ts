import { Injectable } from '@angular/core';
import { clamp } from '../../domain/learning/learning-rules';

export interface SpeechPlaybackObserver {
  onStart?: () => void;
  onWordBoundary?: (charIndex: number, charLength: number) => void;
  onEnd?: () => void;
}

interface SpeechWordRange {
  charIndex: number;
  charLength: number;
  text: string;
}

function speechWordRanges(text: string): SpeechWordRange[] {
  return [...text.matchAll(/\S+/gu)].map((match) => ({
    charIndex: match.index ?? 0,
    charLength: match[0].length,
    text: match[0],
  }));
}

function estimatedWordDurationMs(word: string, rate: number): number {
  const alphanumericLength = [...word].filter((character) => /[\p{L}\p{N}]/u.test(character)).length;
  const punctuationPause = /[.!?]$/u.test(word) ? 120 : /[,;:]$/u.test(word) ? 70 : 0;
  return (190 + Math.min(12, Math.max(1, alphanumericLength)) * 22 + punctuationPause) / rate;
}

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private playbackSequence = 0;
  private readonly fallbackTimers = new Set<ReturnType<typeof setTimeout>>();

  speak(text: string, rate = 0.85, observer?: SpeechPlaybackObserver, voiceIndex = 0): boolean {
    if (!('speechSynthesis' in globalThis) || !('SpeechSynthesisUtterance' in globalThis)) return false;
    this.cancel();
    const playbackSequence = ++this.playbackSequence;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = clamp(rate, 0.45, 1.2);
    const voices = globalThis.speechSynthesis.getVoices();
    const britishEnglishVoices = voices.filter((voice) => /^en-GB/iu.test(voice.lang));
    const otherEnglishVoices = voices.filter((voice) => /^en/iu.test(voice.lang) && !/^en-GB/iu.test(voice.lang));
    const englishVoices = [...britishEnglishVoices, ...otherEnglishVoices];
    const normalizedVoiceIndex = Number.isSafeInteger(voiceIndex) && voiceIndex >= 0 ? voiceIndex : 0;
    utterance.voice = englishVoices.length > 0 ? englishVoices[normalizedVoiceIndex % englishVoices.length] : null;

    const words = speechWordRanges(text);
    let nativeBoundarySeen = false;
    let fallbackStarted = false;
    const isCurrentPlayback = () => playbackSequence === this.playbackSequence;
    const emitFallbackWords = () => {
      if (fallbackStarted || nativeBoundarySeen || !observer?.onWordBoundary || !words.length) return;
      fallbackStarted = true;
      observer.onWordBoundary(words[0].charIndex, words[0].charLength);
      let delay = estimatedWordDurationMs(words[0].text, utterance.rate);
      for (let index = 1; index < words.length; index += 1) {
        const word = words[index];
        const timer = setTimeout(() => {
          this.fallbackTimers.delete(timer);
          if (isCurrentPlayback() && !nativeBoundarySeen) {
            observer.onWordBoundary?.(word.charIndex, word.charLength);
          }
        }, delay);
        this.fallbackTimers.add(timer);
        delay += estimatedWordDurationMs(word.text, utterance.rate);
      }
    };

    utterance.onstart = () => {
      if (!isCurrentPlayback()) return;
      observer?.onStart?.();
      emitFallbackWords();
    };
    utterance.onboundary = (event) => {
      if (!isCurrentPlayback() || event.name === 'sentence') return;
      nativeBoundarySeen = true;
      this.clearFallbackTimers();
      const charIndex = Math.max(0, Number.isFinite(event.charIndex) ? event.charIndex : 0);
      const containingWord = words.find((word) => charIndex >= word.charIndex && charIndex < word.charIndex + word.charLength);
      const charLength = event.charLength > 0 ? event.charLength : containingWord?.charLength ?? 1;
      observer?.onWordBoundary?.(charIndex, charLength);
    };
    const finishPlayback = () => {
      if (!isCurrentPlayback()) return;
      this.clearFallbackTimers();
      observer?.onEnd?.();
      this.playbackSequence += 1;
    };
    utterance.onend = finishPlayback;
    utterance.onerror = finishPlayback;

    globalThis.speechSynthesis.speak(utterance);
    return true;
  }

  cancel(): void {
    this.playbackSequence += 1;
    this.clearFallbackTimers();
    globalThis.speechSynthesis?.cancel?.();
  }

  private clearFallbackTimers(): void {
    for (const timer of this.fallbackTimers) clearTimeout(timer);
    this.fallbackTimers.clear();
  }
}
