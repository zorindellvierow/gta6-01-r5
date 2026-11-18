// Crescent Bay — audio.js
// Synth WebAudio murni, tanpa file suara. Semua bunyi dibuat dari oscillator
// dan noise buffer. Panggil init() sekali setelah interaksi user pertama
// (klik/tombol), karena browser memblokir AudioContext sebelum itu.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this._ready = false;
  }

  // Buat AudioContext + master gain. Aman dipanggil berulang; hanya init sekali.
  init() {
    if (this._ready) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AudioCtx = (typeof window !== 'undefined')
      && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return false;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this._ready = true;
    return true;
  }

  get ready() {
    return this._ready;
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _tone(freq, duration, type, volume, when) {
    if (!this._ready) return;
    const t0 = this.ctx.currentTime + (when || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(volume || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  _noise(duration, volume, filterFreq) {
    if (!this._ready) return;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume || 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  // --- Dengung mesin: oscillator kontinyu, pitch ikut kecepatan 0..1 ---
  startEngine() {
    if (!this._ready || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngineSpeed(speedRatio, on) {
    if (!this._ready || !this.engineOsc) return;
    const ratio = Math.max(0, Math.min(1, speedRatio || 0));
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + ratio * 165, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + ratio * 900, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.06 + ratio * 0.08 : 0, t, 0.1);
  }

  stopEngine() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch (e) { /* sudah berhenti */ }
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  // --- Sirene polisi: dua nada bergantian via LFO ---
  startSiren() {
    if (!this._ready || this.sirenOsc) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 750;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'square';
    this.sirenLfo.frequency.value = 1.4;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 220;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.05;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  stopSiren() {
    if (!this.sirenOsc) return;
    try { this.sirenOsc.stop(); } catch (e) { /* sudah berhenti */ }
    try { if (this.sirenLfo) this.sirenLfo.stop(); } catch (e) { /* sudah berhenti */ }
    this.sirenOsc = null;
    this.sirenLfo = null;
    this.sirenGain = null;
  }

  // --- Efek sekali bunyi ---
  shoot() {
    this._noise(0.12, 0.35, 2500);
    this._tone(180, 0.08, 'square', 0.12);
  }

  pickupCash() {
    this._tone(880, 0.09, 'sine', 0.2);
    this._tone(1318, 0.14, 'sine', 0.2, 0.08);
  }

  missionComplete() {
    const notes = [523, 659, 784, 1046];
    for (let i = 0; i < notes.length; i += 1) {
      this._tone(notes[i], 0.22, 'triangle', 0.22, i * 0.13);
    }
  }

  missionFailed() {
    this._tone(392, 0.25, 'sawtooth', 0.15);
    this._tone(311, 0.4, 'sawtooth', 0.15, 0.22);
  }

  click() {
    this._tone(660, 0.05, 'square', 0.12);
  }

  crash() {
    this._noise(0.3, 0.4, 500);
    this._tone(90, 0.25, 'sine', 0.25);
  }

  wantedUp() {
    this._tone(220, 0.15, 'square', 0.15);
    this._tone(220, 0.15, 'square', 0.15, 0.18);
  }
}

export function createAudio() {
  return new GameAudio();
}

export default GameAudio;
