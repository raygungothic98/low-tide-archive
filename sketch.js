let soundRiver, soundOcean, fft, amp;
let bands = [];
let particles = [];
let textAlpha = 255;
let hasStarted = false;
let notes = [];

// --- CONFIG ---
const NUM_BANDS = 5;
const NUM_PARTICLES = 1000;
const TRAIL_ALPHA = 6;
const FLOW_SCALE = 0.0025;
const FLOW_TAIL = 0.94;
const FADE_TIME = 3000;

// --- sediment palette (RGB arrays for color()) ---
const sedimentColors = [
  [172, 161, 122], // sand-gold
  [91, 139, 120],  // seagrass
  [2, 122, 126],   // teal tide
  [22, 76, 106],   // deep current
  [1, 13, 81]      // midnight basin
];

// --- dynamic hue drift ---
let hueBase;
let hueDrift = 0;

// --- whisper text system ---
let textFade = 0;
let currentLine = "";
let nextTextTime = 0;
let textXOffset = 0;

function preload() {
  soundRiver = loadSound("assets/audio/lowtide3min.mp3");
  soundOcean = loadSound("assets/audio/oceanwaves.mp3");
  loadStrings("assets/data/notes.txt", (data) => (notes = data));
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255, 255, 255, 100);
  noStroke();

  fft = new p5.FFT(0.9, 256);
  amp = new p5.Amplitude();

  // --- initialize tide bands ---
  for (let i = 0; i < NUM_BANDS; i++) {
    bands.push({
      color: sedimentColors[i],
      y: map(i, 0, NUM_BANDS - 1, 0, height),
      angle: random(-PI / 10, PI / 10),
      speed: random(0.0006, 0.0012),
      offset: random(1000),
      alpha: random(35, 65),
    });
  }

  // --- initialize particles ---
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push(new Particle(random(width), random(height)));
  }

  background(0);
}

function draw() {
  fill(0, 0, 0, TRAIL_ALPHA);
  rect(0, 0, width, height);

  const spectrum = fft.analyze();
  const level = amp.getLevel();
  const bass = avg(spectrum.slice(0, 30));
  const mids = avg(spectrum.slice(30, 120));
  const highs = avg(spectrum.slice(120));

  // --- slow tide color drift (teal → violet, amplitude-reactive) ---
  let timeDrift = (sin(frameCount * 0.0004) + 1) * 0.5;
  let levelInfluence = constrain(map(level, 0, 0.4, 0, 0.3), 0, 0.3);
  hueDrift = constrain(timeDrift + levelInfluence, 0, 1);
  hueBase = lerpColor(color(170, 80, 100), color(260, 70, 80), hueDrift);

  // --- angled, wave-like tide bands ---
  push();
  translate(width / 2, height / 2);
  rotate(sin(frameCount * 0.00008) * 0.02);
  translate(-width / 2, -height / 2);

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    push();
    translate(width / 2, b.y);
    rotate(b.angle + sin(frameCount * b.speed + b.offset) * 0.06);
    fill(b.color[0], b.color[1], b.color[2], b.alpha);

    const bandHeight = height / 2.5;
    const waveAmp = map(bass, 0, 255, 10, 90);
    const noiseOffset = b.offset + frameCount * 0.0003;
    const verticalShift = sin(frameCount * 0.0004 + b.offset) * 60;

    beginShape();
    for (let x = -width * 1.5; x <= width * 1.5; x += 20) {
      let y =
        sin(x * 0.004 + noiseOffset) * waveAmp +
        noise(noiseOffset + x * 0.001) * 20 -
        10 +
        verticalShift;
      vertex(x, y);
    }
    vertex(width * 1.5, bandHeight);
    vertex(-width * 1.5, bandHeight);
    endShape(CLOSE);
    pop();
  }
  pop();

  // --- eelgrass / silt particles ---
  const densityBoost = map(level, 0, 0.4, 1, 1.5);
  for (let i = 0; i < particles.length * densityBoost; i++) {
    let p = particles[i % particles.length];
    p.update(level, highs);
    p.applyMouse();
    p.show(highs);
  }

  // --- text whisper system ---
  maybeSpeak(level);
  whisperText(level);

  // --- intro text ---
  if (!hasStarted) drawIntro();
  else if (textAlpha > 0) {
    textAlpha = max(0, textAlpha - 6);
    drawIntro();
  }
}

function drawIntro() {
  fill(255, 255, 255, textAlpha * 0.6);
  textAlign(CENTER, CENTER);
  textSize(22);
  text("click to begin low tide", width / 2, height / 2);
}

// --- sound + crossfade ---
function mousePressed() {
  if (!hasStarted) {
    hasStarted = true;
    textAlpha = 255;
    soundRiver.loop();
    soundOcean.loop();
    soundRiver.setVolume(0);
    soundOcean.setVolume(0);
    soundRiver.fade(0, 0.7, FADE_TIME);
    soundOcean.fade(0, 0.4, FADE_TIME);
  } else if (soundRiver.isPlaying()) {
    soundRiver.fade(0.7, 0, FADE_TIME);
    soundOcean.fade(0.4, 0, FADE_TIME);
    setTimeout(() => {
      soundRiver.pause();
      soundOcean.pause();
    }, FADE_TIME + 200);
  } else {
    soundRiver.loop();
    soundOcean.loop();
    soundRiver.setVolume(0);
    soundOcean.setVolume(0);
    soundRiver.fade(0, 0.7, FADE_TIME);
    soundOcean.fade(0, 0.4, FADE_TIME);
  }
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;
}

// --- PARTICLE CLASS ---
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.2, 0.7));
    this.acc = createVector(0, 0);
    this.baseHue = color(93, 255, 253);
    this.shimmerHue = color(255, 254, 190);
    this.size = random(1.5, 3);
  }

  update(level, highs) {
    let angle =
      noise(this.pos.x * FLOW_SCALE, this.pos.y * FLOW_SCALE, frameCount * 0.0012) *
      TWO_PI *
      4;
    let flow = p5.Vector.fromAngle(angle).mult(0.3 + level * 2.5);
    this.acc.add(flow);
    this.vel.add(this.acc);
    this.vel.mult(FLOW_TAIL);
    this.pos.add(this.vel);
    this.acc.mult(0);
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }

  applyMouse() {
    let m = createVector(mouseX, mouseY);
    let d = dist(this.pos.x, this.pos.y, m.x, m.y);
    if (d < 200) {
      let dir = p5.Vector.sub(this.pos, m);
      let force = map(d, 0, 200, 2.5, 0.1);
      dir.normalize().mult(force);
      this.vel.add(dir);
    }
  }

  show(highs) {
    let sparkle = map(highs, 0, 255, 10, 40);
    if (dist(mouseX, mouseY, this.pos.x, this.pos.y) < 150) {
      fill(this.shimmerHue.levels[0], this.shimmerHue.levels[1], this.shimmerHue.levels[2], sparkle);
    } else {
      fill(this.baseHue.levels[0], this.baseHue.levels[1], this.baseHue.levels[2], sparkle);
    }
    ellipse(this.pos.x, this.pos.y, this.size);
  }
}

// --- TEXT WHISPER VISUAL SYSTEM ---
function generateTideLine() {
  if (notes && notes.length > 0) {
    return random(notes).trim();
  } else {
    const fallback = [
      "The river remembers what it carries.",
      "Every sound is a stone in the mouth.",
      "Low tide reveals what the current forgot.",
      "Silt gathers like thoughts.",
      "Water writes itself in motion.",
    ];
    return random(fallback);
  }
}

function maybeSpeak(level) {
  if (millis() > nextTextTime) {
    currentLine = generateTideLine();
    textFade = 255;
    textXOffset = random(-width * 0.1, width * 0.1);
    nextTextTime = millis() + random(12000, 22000);
  }
}

function whisperText(level) {
  if (textFade > 0 && currentLine) {
    textFade -= 1.2;
    const drift = sin(frameCount * 0.001 + textXOffset) * 30;
    const warp = sin(frameCount * 0.02 + textXOffset * 0.01) * 3;

    push();
    fill(200, 240, 255, textFade * 0.6);
    textAlign(CENTER, CENTER);
    textSize(20 + map(level, 0, 0.3, 0, 6));
    drawingContext.shadowBlur = 30;
    drawingContext.shadowColor = color(180, 220, 255, 80);
    text(currentLine, width / 2 + drift, height - 80 + warp);
    drawingContext.shadowBlur = 0;
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
