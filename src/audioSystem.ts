let audioCtx: AudioContext | null = null;
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let windFilter: BiquadFilterNode | null = null;
let windGain: GainNode | null = null;

export const initAudio = () => {
  if (audioCtx) return;
  try {
    audioCtx = new window.AudioContext();
    
    // --- Engine Sound ---
    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0; // Start silenced
    
    const engineLowPass = audioCtx.createBiquadFilter();
    engineLowPass.type = 'lowpass';
    engineLowPass.frequency.value = 300;

    engineOsc.connect(engineLowPass);
    engineLowPass.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();

    // --- Wind Sound (White Noise Approx) ---
    const bufferSize = audioCtx.sampleRate * 2;
    const windBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = windBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const windSource = audioCtx.createBufferSource();
    windSource.buffer = windBuffer;
    windSource.loop = true;

    windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 150; 

    windGain = audioCtx.createGain();
    windGain.gain.value = 0;

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(audioCtx.destination);
    windSource.start();

    // Ensure audio plays if suspended
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    console.warn('Web Audio API not supported', e);
  }
};

export const updateAudio = (throttle: number, speedKnots: number) => {
  if (!audioCtx || !engineGain || !engineOsc || !windGain || !windFilter) return;
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;

  // Modulate engine sound based on throttle
  const targetEngineGain = Math.max(0.01, throttle * 0.4);
  const targetEngineFreq = 50 + (throttle * 150);
  engineGain.gain.setTargetAtTime(targetEngineGain, now, 0.1);
  engineOsc.frequency.setTargetAtTime(targetEngineFreq, now, 0.1);

  // Modulate wind sound based on airspeed
  const windIntensity = Math.min(speedKnots / 400, 1.0); // max wind at 400knots
  const targetWindGain = windIntensity * 0.5;
  const targetWindFreq = 150 + (windIntensity * 2500);
  
  windGain.gain.setTargetAtTime(targetWindGain, now, 0.1);
  windFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.1);
};

export const stopAudio = () => {
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
};
