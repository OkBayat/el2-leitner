/* Resample microphone input to bounded, mono, little-endian PCM16 chunks. */
class VocoraPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.weight = 0;
    this.sum = 0;
    this.buffer = new ArrayBuffer(16000);
    this.view = new DataView(this.buffer);
    this.offset = 0;
    this.samples = 0;
    this.energy = 0;
    this.levelSamples = 0;
    this.done = false;
    this.port.onmessage = event => {
      if (event.data === 'flush') {
        this.emit();
        this.done = true;
        this.port.postMessage({ type: 'flushed' });
      }
    };
  }
  emit() {
    if (!this.offset) return;
    const pcm = this.buffer.slice(0, this.offset);
    this.port.postMessage({ type: 'pcm', pcm }, [pcm]);
    this.offset = 0;
  }
  output(value) {
    if (this.samples >= 480000) return;
    const clipped = Math.max(-1, Math.min(1, value));
    this.view.setInt16(this.offset, Math.round(clipped * (clipped < 0 ? 32768 : 32767)), true);
    this.offset += 2;
    this.samples++;
    if (this.offset === this.buffer.byteLength) this.emit();
    if (this.samples === 480000) this.port.postMessage({ type: 'limit' });
  }
  process(inputs) {
    if (this.done) return false;
    const channel = inputs[0]?.[0];
    if (!channel || this.samples >= 480000) return true;
    for (const sample of channel) {
      this.energy += sample * sample;
      this.levelSamples++;
      if (this.levelSamples >= sampleRate / 20) {
        this.port.postMessage({ type: 'level', rms: Math.sqrt(this.energy / this.levelSamples) });
        this.energy = 0;
        this.levelSamples = 0;
      }
      let remaining = 1;
      while (remaining > 1e-9) {
        const take = Math.min(remaining, this.ratio - this.weight);
        this.sum += sample * take;
        this.weight += take;
        remaining -= take;
        if (this.weight >= this.ratio - 1e-9) {
          this.output(this.sum / this.ratio);
          this.weight = 0;
          this.sum = 0;
        }
      }
    }
    // Outputs remain silent: microphone audio is never played through speakers.
    return true;
  }
}
registerProcessor('vocora-pcm-capture', VocoraPcmCapture);
