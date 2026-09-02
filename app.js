// CONTEXTO DE AUDIO & ESTADO GLOBAL
const AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
let currentChord = 'C';
let metroOn = false;
let activeInstrument = null;

// SÍNTESIS: FRECUENCIA BASE PITAGÓRICA (C = 256 Hz)
const C_BASE = 256;
// Generación de escala pitagórica (C, D, E, F, G, A, B)
const pythagoreanRatios = [1, 9/8, 81/64, 4/3, 3/2, 27/16, 243/128, 2];
const harpFreqs = [];
for (let oct = 0; oct < 2; oct++) {
  pythagoreanRatios.forEach(r => harpFreqs.push(C_BASE * r * Math.pow(2, oct)));
}

// ESTRUCTURA DE ACORDES PARA GUITARRA
const chords = {
  'C': [256, 320, 384, 512, 640, 768],
  'Am': [220, 264, 330, 440, 528, 660],
  'F': [170, 213, 256, 341, 426, 512],
  'G5': [192, 288, 384, 576, 768, 1152]
};

// MOTOR DEL ARPA (HAZE DE LUZ)
const canvasArpa = document.getElementById('canvas-arpa');
const ctxArpa = canvasArpa.getContext('2d');
let activeTouches = {};

function initCanvasSize() {
  canvasArpa.width = canvasArpa.offsetWidth;
  canvasArpa.height = canvasArpa.offsetHeight;
}

// SINTETIZADOR DE CUERDA (OSCILADOR + FILTRO)
function playHarpNode(freq, bend = 0) {
  if (AudioCtx.state === 'suspended') AudioCtx.resume();
  
  const osc = AudioCtx.createOscillator();
  const gain = AudioCtx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq + bend, AudioCtx.currentTime);
  
  // Filtro de luz / cristalino
  const filter = AudioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 3, AudioCtx.currentTime);

  gain.gain.setValueAtTime(0.3, AudioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, AudioCtx.currentTime + 1.5);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(AudioCtx.destination);

  osc.start();
  osc.stop(AudioCtx.currentTime + 1.5);
  return osc;
}

function drawHarp() {
  ctxArpa.clearRect(0, 0, canvasArpa.width, canvasArpa.height);
  const numStrings = harpFreqs.length;
  const spacing = canvasArpa.width / (numStrings + 1);

  for (let i = 0; i < numStrings; i++) {
    const x = spacing * (i + 1);
    
    // Dibujar Haz de Luz (Cyan Neón con resplandor)
    ctxArpa.beginPath();
    ctxArpa.moveTo(x, 0);
    ctxArpa.lineTo(x, canvasArpa.height);
    ctxArpa.lineWidth = 3;
    ctxArpa.strokeStyle = `hsl(${180 + i * 5}, 100%, 60%)`;
    ctxArpa.shadowBlur = 12;
    ctxArpa.shadowColor = '#00f0ff';
    ctxArpa.stroke();
  }

  requestAnimationFrame(drawHarp);
}

// EVENTOS TÁCTILES DEL ARPA (EJE X = PORTAMENTO, EJE Y = BENDING/VIBRATO)
canvasArpa.addEventListener('pointerdown', e => {
  activeTouches[e.pointerId] = { x: e.clientX, y: e.clientY };
  processHarpTouch(e);
});

canvasArpa.addEventListener('pointermove', e => {
  if (activeTouches[e.pointerId]) {
    processHarpTouch(e);
  }
});

canvasArpa.addEventListener('pointerup', e => { delete activeTouches[e.pointerId]; });

function processHarpTouch(e) {
  const rect = canvasArpa.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const spacing = canvasArpa.width / (harpFreqs.length + 1);
  const stringIdx = Math.floor(x / spacing);

  if (stringIdx >= 0 && stringIdx < harpFreqs.length) {
    // Eje Y: Bending (desplazamiento vertical altera la frecuencia)
    const bendY = (canvasArpa.height / 2 - y) * 0.5;
    playHarpNode(harpFreqs[stringIdx], bendY);
  }
}

// NAVEGACIÓN Y CONTROL
function openInstrument(type) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${type}`).classList.add('active');
  activeInstrument = type;
  if (type === 'arpa') {
    initCanvasSize();
    drawHarp();
  }
}

function closeInstrument() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-select').classList.add('active');
}

function selectChord(chord) {
  currentChord = chord;
  document.querySelectorAll('.btn-chord').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

function toggleMetro() {
  metroOn = !metroOn;
  document.getElementById('btn-metro-arpa').innerText = `Metro: ${metroOn ? 'ON' : 'OFF'}`;
}

// GRABACIÓN MINIMALISTA (2 BOTONES AL DETENER)
function startRec(inst, countIn) {
  console.log(`Grabando ${inst} (Conteo: ${countIn})`);
  // Simulación: Al detener la grabación, se muestran los dos botones mínimos
  setTimeout(() => {
    document.getElementById(`save-controls-${inst}`).classList.remove('hidden');
  }, 2000);
}

function discardTake(inst) {
  document.getElementById(`save-controls-${inst}`).classList.add('hidden');
  console.log("Toma descartada.");
}

function promptSave(inst) {
  const name = prompt("Nombre del bloque:", `${inst}_toma_1`);
  if (name) console.log(`Guardado como: ${name}`);
  document.getElementById(`save-controls-${inst}`).classList.add('hidden');
}
