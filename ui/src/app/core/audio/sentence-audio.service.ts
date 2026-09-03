import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SentenceAudioService {
	private current: HTMLAudioElement | null = null;

	play(url: string, rate = 1): boolean {
		const source = String(url ?? '').trim();
		if (!source) return false;
		this.stop();
		const audio = new Audio(source);
		audio.preload = 'auto';
		audio.playbackRate = Math.max(.5, Math.min(2, Number(rate) || 1));
		this.current = audio;
		void audio.play().catch(() => {
			if (this.current === audio) this.current = null;
		});
		return true;
	}

	stop(): void {
		if (!this.current) return;
		this.current.pause();
		this.current.currentTime = 0;
		this.current = null;
	}
}
