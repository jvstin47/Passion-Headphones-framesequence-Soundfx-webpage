class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.ambientSource = null;
    this.ambientFilter = null;
    this.ambientGain = null;
    this.ancHumOsc = null;
    this.ancHumGain = null;
    this.transparencyDelay = null;
    this.analyser = null;
    this.initialized = false;
    this.lastMilestone = -1;
  }

  init() {
    if (this.initialized) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.createNoiseBuffer();
    this.setupAmbientSoundscape();
    this.initialized = true;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  setupAmbientSoundscape() {
    if (!this.ctx || !this.noiseBuffer) return;

    // Create master Analyser Node
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128; // Compact size for clean telemetry waveform lines

    // 1. Ambient Air/Wind Loop
    this.ambientSource = this.ctx.createBufferSource();
    this.ambientSource.buffer = this.noiseBuffer;
    this.ambientSource.loop = true;

    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.value = 250;
    this.ambientFilter.Q.value = 2;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.015;

    // 2. Low Frequency Hum (Reduced sub-bass level for a cleaner feel)
    this.ancHumOsc = this.ctx.createOscillator();
    this.ancHumOsc.type = 'sine';
    this.ancHumOsc.frequency.value = 46;

    this.ancHumGain = this.ctx.createGain();
    this.ancHumGain.gain.value = 0;

    // 3. Transparency delay comb filter
    this.transparencyDelay = this.ctx.createDelay();
    this.transparencyDelay.delayTime.value = 0.012;

    // Connect Ambient air to analyser
    this.ambientSource.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.analyser);
    
    // Connect Hum to analyser
    this.ancHumOsc.connect(this.ancHumGain);
    this.ancHumGain.connect(this.analyser);

    // Connect analyser to master output
    this.analyser.connect(this.ctx.destination);

    this.ambientSource.start(0);
    this.ancHumOsc.start(0);
  }

  setANCMode(mode) {
    if (!this.initialized) this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = this.analyser || this.ctx.destination;

    if (mode === 'ON') {
      // 1. Ear Seal Pressure Drop (Low frequency sweep)
      const sweepOsc = this.ctx.createOscillator();
      const sweepGain = this.ctx.createGain();
      
      sweepOsc.type = 'sine';
      sweepOsc.connect(sweepGain);
      sweepGain.connect(dest);
      
      sweepOsc.frequency.setValueAtTime(140, t);
      sweepOsc.frequency.exponentialRampToValueAtTime(32, t + 0.35);
      
      sweepGain.gain.setValueAtTime(0.06, t);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      
      sweepOsc.start(t);
      sweepOsc.stop(t + 0.36);

      // 2. Adjust ambient filters
      this.ambientFilter.frequency.exponentialRampToValueAtTime(70, t + 0.4);
      this.ambientGain.gain.linearRampToValueAtTime(0.003, t + 0.4);
      this.ancHumGain.gain.linearRampToValueAtTime(0.005, t + 0.4); // Very quiet sub hum
      
      try {
        this.ambientGain.disconnect(this.transparencyDelay);
      } catch (e) {}
    } else if (mode === 'TRANSPARENCY') {
      // Bright transparency reflections
      this.ambientFilter.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
      this.ambientGain.gain.linearRampToValueAtTime(0.035, t + 0.4);
      this.ancHumGain.gain.linearRampToValueAtTime(0, t + 0.4);

      this.ambientGain.connect(this.transparencyDelay);
      this.transparencyDelay.connect(dest);
    } else {
      // OFF mode
      this.ambientFilter.frequency.exponentialRampToValueAtTime(320, t + 0.4);
      this.ambientGain.gain.linearRampToValueAtTime(0.015, t + 0.4);
      this.ancHumGain.gain.linearRampToValueAtTime(0, t + 0.4);

      try {
        this.ambientGain.disconnect(this.transparencyDelay);
      } catch (e) {}
    }
  }

  updateAmbienceScroll(progress) {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    const baseFreq = this.ambientFilter.frequency.value;
    const offset = Math.sin(progress * Math.PI) * 45;
    this.ambientFilter.frequency.setValueAtTime(baseFreq + offset, t);
  }

  // Section transition air whoosh sound
  playWhoosh() {
    if (!this.initialized || !this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const dest = this.analyser || this.ctx.destination;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.8;
    filter.frequency.setValueAtTime(120, t);
    filter.frequency.exponentialRampToValueAtTime(1100, t + 0.45);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.0, t);
    gainNode.gain.linearRampToValueAtTime(0.12, t + 0.15); // Louder presence
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);

    noiseSource.start(t);
    noiseSource.stop(t + 0.46);
  }

  // Mechanical crown dial rapid ticking sound
  playCrownTick() {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.analyser || this.ctx.destination;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.connect(gainNode);
    gainNode.connect(dest);

    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(1500, t + 0.01);

    gainNode.gain.setValueAtTime(0.045, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.01);

    osc.start(t);
    osc.stop(t + 0.012);
  }

  playClick(volume = 0.035) {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.analyser || this.ctx.destination;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.connect(gainNode);
    gainNode.connect(dest);

    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.04);

    gainNode.gain.setValueAtTime(volume, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  playMetalClick() {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.analyser || this.ctx.destination;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.frequency.value = 1600;
    osc2.frequency.value = 1640;

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(dest);

    gainNode.gain.setValueAtTime(0.018, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.13);
    osc2.stop(t + 0.13);
  }

  playServo() {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.analyser || this.ctx.destination;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';
    osc.connect(gainNode);
    gainNode.connect(dest);

    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.15);

    gainNode.gain.setValueAtTime(0.012, t);
    gainNode.gain.linearRampToValueAtTime(0.015, t + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  playFabric() {
    if (!this.initialized || !this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const dest = this.analyser || this.ctx.destination;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4.5;
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.exponentialRampToValueAtTime(850, t + 0.22);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.035, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);

    noiseSource.start(t);
    noiseSource.stop(t + 0.23);
  }

  triggerMilestoneScroll(progress) {
    if (!this.initialized) return;

    const milestoneIndex = Math.floor(progress * 45);
    if (milestoneIndex !== this.lastMilestone) {
      this.lastMilestone = milestoneIndex;

      // Keep scrolling tactile effects quiet
      const subIdx = milestoneIndex % 5;
      if (subIdx === 0) {
        this.playClick(0.01);
      } else if (subIdx === 2) {
        this.playFabric();
      } else if (subIdx === 4) {
        this.playServo();
      }
    }
  }
}

export const audioSynth = new AudioSynthesizer();
