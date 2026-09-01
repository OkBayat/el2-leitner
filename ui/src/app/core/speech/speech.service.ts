import { Injectable } from '@angular/core';
import { clamp } from '../../domain/learning/learning-rules';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  speak(text: string, rate = 0.85): boolean {
    if (!('speechSynthesis' in globalThis) || !('SpeechSynthesisUtterance' in globalThis)) return false;
    globalThis.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = clamp(rate, 0.45, 1.2);
    const voices = globalThis.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => /^en-GB/iu.test(voice.lang)) || voices.find((voice) => /^en/iu.test(voice.lang)) || null;
    globalThis.speechSynthesis.speak(utterance);
    return true;
  }
  cancel(): void { globalThis.speechSynthesis?.cancel?.(); }
}
