import { Injectable } from '@angular/core';

export interface MicrophoneHandlers {
  pcm: (audio: ArrayBuffer) => void;
  level: (rms: number) => void;
  limit: () => void;
  error: (message: string) => void;
}

@Injectable()
export class PcmRecorderService {
  private context?: AudioContext;
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private node?: AudioWorkletNode;
  private generation = 0;
  private flush?: () => void;

  supported(): boolean {
    return !!globalThis.isSecureContext && !!navigator.mediaDevices?.getUserMedia
      && typeof AudioContext === 'function' && typeof AudioWorkletNode === 'function';
  }

  async open(): Promise<void> {
    this.cancel();
    if (!this.supported()) throw new Error('Microphone practice requires HTTPS (or localhost) and a browser with Web Audio support.');
    const generation = this.generation;
    const context = new AudioContext();
    this.context = context;
    // Resume directly from the click gesture, before the permission promise.
    const resumed = context.resume();
    void resumed.catch(() => {});
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        throw new DOMException('Recording cancelled.', 'AbortError');
      }
      this.stream = stream;
      await Promise.all([resumed, context.audioWorklet.addModule('/assets/shadowing/pcm-capture.js')]);
      if (generation !== this.generation) throw new DOMException('Recording cancelled.', 'AbortError');
      this.node = new AudioWorkletNode(context, 'vocora-pcm-capture', { channelCount: 1, channelCountMode: 'explicit', numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      this.source = context.createMediaStreamSource(stream);
    } catch (error) {
      if (generation === this.generation) this.cancel();
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError') throw new Error('Microphone permission was denied. Allow microphone access in your browser settings, then try again.');
      if (name === 'NotFoundError') throw new Error('No microphone was found. Connect a microphone and try again.');
      if (name === 'NotReadableError') throw new Error('The microphone is unavailable or in use by another application.');
      throw error;
    }
  }

  begin(handlers: MicrophoneHandlers): void {
    if (!this.node || !this.source || !this.context || !this.stream) throw new Error('Microphone is not ready.');
    this.node.port.onmessage = ({ data }) => {
      if (data.type === 'pcm') handlers.pcm(data.pcm as ArrayBuffer);
      else if (data.type === 'level') handlers.level(Number(data.rms));
      else if (data.type === 'limit') handlers.limit();
      else if (data.type === 'flushed') this.flush?.();
    };
    this.node.onprocessorerror = () => handlers.error('Audio processing was interrupted. Please record again.');
    this.stream.getAudioTracks().forEach(track => { track.onended = () => handlers.error('The microphone was disconnected. Please record again.'); });
    this.source.connect(this.node);
    this.node.connect(this.context.destination);
  }

  async stop(): Promise<void> {
    const node = this.node;
    if (!node) return;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Recording was interrupted before the audio could be finished. Please try again.')), 1500);
        this.flush = () => { clearTimeout(timeout); resolve(); };
        node.port.postMessage('flush');
      });
    } finally { if (this.node === node) this.cancel(); }
  }

  cancel(): void {
    this.generation++;
    this.flush?.();
    this.flush = undefined;
    this.node?.port.close();
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    if (this.context) void this.context.close().catch(() => {});
    this.node = undefined;
    this.source = undefined;
    this.stream = undefined;
    this.context = undefined;
  }
}
