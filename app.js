// --- ESTADO GLOBAL & AUDIO CONTEXT ---
const AudioCtx = new (window.AudioContext || window.webkitAudioContext)();

let pitchBase = 440; // Default Estándar A440 (puede cambiar a 256Hz)
let currentOctaveHarp = 0;
let selectedRoot = 'C';
let selectedType = 'Maj';
let activeInstrument = null;
let isRecording = false;

function changePitchBase(val) {
  pitchBase = parseFloat(val);
  console.log(`Base de afinación cambiada a: ${pitchBase} Hz`);
}

function cycleBars(inst) {
  const btn = document.getElementById(`btn-bars-${inst === 'guitarra' ? 'guit' : inst === 'bateria' ? 'bat' : inst}`);
  if (!btn) return;
  if (btn.innerText.includes('1 COMP')) btn.innerText = '2 COMP';
  else if (btn.innerText.includes('2 COMP')) btn.innerText = '4 COMP';
  else btn.innerText = '1 COMP';
}

// BOTONES DE GRABACIÓN / GUARDADO
function startRec(inst, countIn) {
  if (AudioCtx.state === 'suspended') AudioCtx.resume();
  isRecording = true;
  console.log(`[REC] Grabando en ${inst}. Conteo: ${countIn}`);
  
  // Muestra controles al terminar la toma simulada
  setTimeout(() => {
    const el = document.getElementById(`save-controls-${inst}`);
    if (el) el.classList.remove('hidden');
  }, 3000);
}

function discardTake(inst) {
  isRecording = false;
  const el = document.getElementById(`save-controls-${inst}`);
  if (el) el.classList.add('hidden');
}

function promptSave(inst) {
  isRecording = false;
  const name = prompt("Nombre del bloque:", `${inst}_toma_1`);
  if (name) console.log(`Guardado: ${name}`);
  const el = document.getElementById(`save-controls-${inst}`);
  if (el) el.classList.add('hidden');
}

// ==========================================
// 1. MOTOR DEL ARPA (DOBLE JUEGO + GLIDE)
// ==========================================
const canvasArpa = document.getElementById('canvas-arpa');
const ctxArpa = canvasArpa ? canvasArpa.getContext('2d') : null;
let lastHarpOsc = null;
let lastHarpGain = null;

// Proporciones Intervalicas Pitagóricas
const pythagoreanRatios = [1, 9/8, 81/64, 4/3, 3/2, 27/16, 243/128, 2];

function shiftOctaveHarp(delta) {
  currentOctaveHarp = Math.max(-2, Math.min(2, currentOctaveHarp + delta));
  const lbl = document.getElementById('oct-label-arpa');
  if (lbl) lbl.innerText = `OCT: ${currentOctaveHarp >= 0 ? '+' : ''}${currentOctaveHarp}`;
}

function playHarpGlide(freq, bendY = 0) {
  if (AudioCtx.state === 'suspended') AudioCtx.resume();

  const finalFreq = (freq * Math.pow(2, currentOctaveHarp)) + bendY;

  if (lastHarpOsc && lastHarpGain) {
    lastHarpOsc.frequency.setTargetAtTime(finalFreq, AudioCtx.currentTime, 0.02);
    return;
  }

  const osc = AudioCtx.createOscillator();
  const gain = AudioCtx.createGain();
  const filter = AudioCtx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(finalFreq, AudioCtx.currentTime);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(finalFreq * 3, AudioCtx.currentTime);

  gain.gain.setValueAtTime(0.3, AudioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, AudioCtx.currentTime + 1.2);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(AudioCtx.destination);

  osc.start();
  lastHarpOsc = osc;
  lastHarpGain = gain;

  setTimeout(() => {
    if (lastHarpOsc === osc) {
      lastHarpOsc = null;
      lastHarpGain = null;
    }
  }, 1200);
}

function drawHarp() {
  if (!canvasArpa) return;
  canvasArpa.width = canvasArpa.offsetWidth;
  canvasArpa.height = canvasArpa.offsetHeight;

  ctxArpa.clearRect(0, 0, canvasArpa.width, canvasArpa.height);
  const numStrings = pythagoreanRatios.length;
  const spacing = canvasArpa.width / (numStrings + 1);
  const midY = canvasArpa.height / 2;

  // Divisorio de doble juego
  ctxArpa.beginPath();
  ctxArpa.moveTo(0, midY);
  ctxArpa.lineTo(canvasArpa.width, midY);
  ctxArpa.strokeStyle = '#2d3748';
  ctxArpa.lineWidth = 2;
  ctxArpa.stroke();

  for (let i = 0; i < numStrings; i++) {
    const x = spacing * (i + 1);

    // Juego Arriba (Grave)
    ctxArpa.beginPath();
    ctxArpa.moveTo(x, 0);
    ctxArpa.lineTo(x, midY - 4);
    ctxArpa.lineWidth = 3;
    ctxArpa.strokeStyle = `hsl(${180 + i * 12}, 100%, 60%)`;
    ctxArpa.stroke();

    // Juego Abajo (Agudo)
    ctxArpa.beginPath();
    ctxArpa.moveTo(x, midY + 4);
    ctxArpa.lineTo(x, canvasArpa.height);
    ctxArpa.lineWidth = 2;
    ctxArpa.strokeStyle = `hsl(${280 + i * 12}, 100%, 65%)`;
    ctxArpa.stroke();
  }
}

let isTouchingHarp = false;
if (canvasArpa) {
  canvasArpa.addEventListener('pointerdown', e => { isTouchingHarp = true; handleHarpTouch(e); });
  canvasArpa.addEventListener('pointermove', e => { if (isTouchingHarp) handleHarpTouch(e); });
  canvasArpa.addEventListener('pointerup', () => { isTouchingHarp = false; lastHarpOsc = null; });
}

function handleHarpTouch(e) {
  const rect = canvasArpa.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const numStrings = pythagoreanRatios.length;
  const spacing = canvasArpa.width / (numStrings + 1);
  const stringIdx = Math.floor(x / spacing);

  if (stringIdx >= 0 && stringIdx < numStrings) {
    const isBottom = y > (canvasArpa.height / 2);
    const octaveMultiplier = isBottom ? 2 : 1;
    const baseFreq = (pitchBase * 0.5) * pythagoreanRatios[stringIdx] * octaveMultiplier;
    const bendY = ((canvasArpa.height / 2) - y) * 0.15;

    playHarpGlide(baseFreq, bendY);
  }
}

// ==========================================
// 2. MOTOR DE GUITARRA (CUALQUIER ACORDE)
// ==========================================
const canvasGuitarra = document.getElementById('canvas-guitarra');
const ctxGuit = canvasGuitarra ? canvasGuitarra.getContext('2d') : null;

const noteOffsets = { 'C':0, 'D':2, 'E':4, 'F':5, 'G':7, 'A':9, 'B':11 };

function getChordFrequencies(root, type) {
  const offset = noteOffsets[root] || 0;
  // Frecuencia Raíz en base a pitchBase (256Hz / 440Hz)
  const rootFreq = (pitchBase * 0.5) * Math.pow(2, offset / 12);
  const third = (type === 'Maj') ? 4 : 3;

  return [
    rootFreq * 0.5,                          // 6ta
    rootFreq * Math.pow(2, 7/12) * 0.5,      // 5ta
    rootFreq,                                // 4ta
    rootFreq * Math.pow(2, third/12),        // 3ra
    rootFreq * Math.pow(2, 7/12),            // 2da
    rootFreq * 2                             // 1ra
  ];
}

function playGuitarString(freq) {
  if (AudioCtx.state === 'suspended') AudioCtx.resume();

  const osc = AudioCtx.createOscillator();
  const gain = AudioCtx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, AudioCtx.currentTime);

  gain.gain.setValueAtTime(0.5, AudioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, AudioCtx.currentTime + 0.9);

  osc.connect(gain);
  gain.connect(AudioCtx.destination);

  osc.start();
  osc.stop(AudioCtx.currentTime + 0.9);
}

function drawGuitarStrings() {
  if (!canvasGuitarra) return;
  canvasGuitarra.width = canvasGuitarra.offsetWidth;
  canvasGuitarra.height = canvasGuitarra.offsetHeight;

  ctxGuit.clearRect(0, 0, canvasGuitarra.width, canvasGuitarra.height);
  const spacing = canvasGuitarra.height / 7;

  for (let i = 0; i < 6; i++) {
    const y = spacing * (i + 1);
    ctxGuit.beginPath();
    ctxGuit.moveTo(0, y);
    ctxGuit.lineTo(canvasGuitarra.width, y);
    ctxGuit.lineWidth = 4 - (i * 0.5);
    ctxGuit.strokeStyle = '#00f0ff';
    ctxGuit.stroke();
  }
}

let lastGuitarHit = -1;
if (canvasGuitarra) {
  canvasGuitarra.addEventListener('pointermove', e => {
    if (e.buttons > 0) {
      const rect = canvasGuitarra.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const spacing = canvasGuitarra.height / 7;
      const stringIdx = Math.floor(y / spacing);

      if (stringIdx >= 0 && stringIdx < 6 && stringIdx !== lastGuitarHit) {
        lastGuitarHit = stringIdx;
        const freqs = getChordFrequencies(selectedRoot, selectedType);
        playGuitarString(freqs[stringIdx]);
      }
    }
  });

  canvasGuitarra.addEventListener('pointerup', () => { lastGuitarHit = -1; });
}

function setChordRoot(root) {
  selectedRoot = root;
  updateChordUI();
}

function setChordType(type) {
  selectedType = type;
  document.getElementById('btn-type-maj').classList.toggle('active', type === 'Maj');
  document.getElementById('btn-type-min').classList.toggle('active', type === 'Min');
  updateChordUI();
}

function updateChordUI() {
  const display = document.getElementById('current-chord-display');
  if (display) display.innerText = `${selectedRoot} ${selectedType}`;
}

// ==========================================
// 3. MOTOR DEL BAJO METÁLICO
// ==========================================
const canvasBajo = document.getElementById('canvas-bajo');
const ctxBajo = canvasBajo ? canvasBajo.getContext('2d') : null;
const bassStrings = [41.20, 55.00, 73.42, 98.00];

function playBassNote(freq) {
  if (AudioCtx.state === 'suspended') AudioCtx.resume();

  const osc = AudioCtx.createOscillator();
  const gain = AudioCtx.createGain();
  const filter = AudioCtx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, AudioCtx.currentTime);

  filter.type = 'lowpass';
  filter.Q.value = 5;
  filter.frequency.setValueAtTime(freq * 4, AudioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(freq, AudioCtx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.8, AudioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, AudioCtx.currentTime + 1.2);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(AudioCtx.destination);

  osc.start();
  osc.stop(AudioCtx.currentTime + 1.2);
}

function drawFretboard() {
  if (!canvasBajo) return;
  canvasBajo.width = canvasBajo.offsetWidth;
  canvasBajo.height = canvasBajo.offsetHeight;

  ctxBajo.clearRect(0, 0, canvasBajo.width, canvasBajo.height);
  const numFrets = 7;
  const numStrings = 4;
  const fretWidth = canvasBajo.width / numFrets;
  const stringHeight = canvasBajo.height / (numStrings + 1);

  for (let f = 1; f <= numFrets; f++) {
    ctxBajo.beginPath();
    ctxBajo.moveTo(f * fretWidth, 0);
    ctxBajo.lineTo(f * fretWidth, canvasBajo.height);
    ctxBajo.strokeStyle = '#333b56';
    ctxBajo.lineWidth = 3;
    ctxBajo.stroke();
  }

  for (let s = 0; s < numStrings; s++) {
    const y = stringHeight * (s + 1);
    ctxBajo.beginPath();
    ctxBajo.moveTo(0, y);
    ctxBajo.lineTo(canvasBajo.width, y);
    ctxBajo.strokeStyle = '#8a95b5';
    ctxBajo.lineWidth = 6 - s;
    ctxBajo.stroke();
  }
}

if (canvasBajo) {
  canvasBajo.addEventListener('pointerdown', e => {
    const rect = canvasBajo.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const fretWidth = canvasBajo.width / 7;
    const stringHeight = canvasBajo.height / 5;
    const fret = Math.floor(x / fretWidth);
    const stringIdx = Math.floor(y / stringHeight);

    if (stringIdx >= 0 && stringIdx < 4) {
      const noteFreq = bassStrings[stringIdx] * Math.pow(2, fret / 12);
      playBassNote(noteFreq);
    }
  });
}

// ==========================================
// 4. MOTOR DE BATERÍA TÁCTIL
// ==========================================
function playDrum(type) {
  if (AudioCtx.state === 'suspended') AudioCtx.resume();

  const osc = AudioCtx.createOscillator();
  const gain = AudioCtx.createGain();

  if (type === 'kick') {
    osc.frequency.setValueAtTime(120, AudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, AudioCtx.currentTime + 0.25);
    gain.gain.setValueAtTime(1, AudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, AudioCtx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(AudioCtx.destination);
    osc.start();
    osc.stop(AudioCtx.currentTime + 0.25);
  } 
  else if (type === 'snare') {
    const bufferSize = AudioCtx.sampleRate * 0.15;
    const buffer = AudioCtx.createBuffer(1, bufferSize, AudioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = AudioCtx.createBufferSource();
    noise.buffer = buffer;

    gain.gain.setValueAtTime(0.6, AudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, AudioCtx.currentTime + 0.15);

    noise.connect(gain);
    gain.connect(AudioCtx.destination);
    noise.start();
  }
  else if (type === 'fill') {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playDrum('snare'), i * 75);
    }
  }
}

let hihatModes = ['OFF', '1/4', '1/8', '1/16'];
let hihatIdx = 0;
let hihatTimer = null;

function cycleHiHat() {
  hihatIdx = (hihatIdx + 1) % hihatModes.length;
  const mode = hihatModes[hihatIdx];
  document.getElementById('btn-hihat').innerText = `HI-HAT: ${mode}`;

  clearInterval(hihatTimer);
  if (mode !== 'OFF') {
    const speed = mode === '1/4' ? 500 : mode === '1/8' ? 250 : 125;
    hihatTimer = setInterval(() => playDrum('snare'), speed);
  }
}

// NAVEGACIÓN ENTRE PANTALLAS
function openInstrument(type) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${type}`).classList.add('active');
  activeInstrument = type;

  setTimeout(() => {
    if (type === 'arpa') drawHarp();
    if (type === 'guitarra') drawGuitarStrings();
    if (type === 'bajo') drawFretboard();
  }, 50);
}

function closeInstrument() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-select').classList.add('active');
}
