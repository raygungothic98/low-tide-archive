let soundRiver, soundOcean, fft, amp;
let bands = [];
let particles = [];
let textAlpha = 255;
let hasStarted = false;
let fieldNotes = [];
let floatingText = [];

const NUM_BANDS = 5;
const BASE_PARTICLES = 1000;
const TRAIL_ALPHA = 6;
const FLOW_SCALE = 0.0025;
const FLOW_TAIL = 0.94;
const FADE_TIME = 3000;
const MAX_FLOATING_TEXT = 5;

const sedimentColors = [
  [172, 161, 122],
  [91, 139, 120],
  [2, 122, 126],
  [22, 76, 106],
  [1, 13, 81]
];

function preload() {
  soundRiver = loadSound("assets/audio/lowtide3min.mp3");
  soundOcean = loadSound("assets/audio/oceanwaves.mp3");
  fieldNotes = loadStrings("assets/data/notes.txt");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255, 255, 255, 100);
  noStroke();

  fft = new p5.FFT(0.9, 256);
  amp = new p5.Amplitude();

  // tide bands
  for (let i = 0; i < NUM_BANDS; i++) {
    bands.push({
      color: sedimentColors[i],
      y: map(i, 0, NUM_BANDS - 1, 0, height),
      angle: random(-PI / 10, PI / 10),
      speed: random(0.0004, 0.001),
      offset: random(1000),
      alpha: random(35, 65)
    });
  }

  // particles
  for (let i = 0; i < BASE_PARTICLES; i++) {
    particles.push(new Particle(random(width), random(height)));
  }

  background(0);
}

function draw() {
  fill(0, 0, 0, TRAIL_ALPHA);
  rect(0, 0, width, height);

  // --- AUDIO REACTIVITY ---
const spectrum = fft.analyze();
const level = amp.getLevel();
const bass  = avg(spectrum.slice(0, 30));   // low frequencies
const mids  = avg(spectrum.slice(30, 120)); // midrange
const highs = avg(spectrum.slice(120));     // high frequencies

  // --- color drift ---
  let timeDrift = (sin(frameCount * 0.0004) + 1) * 0.5;
  let levelInfluence = constrain(map(level, 0, 0.4, 0, 0.3), 0, 0.3);
  let hueDrift = constrain(timeDrift + levelInfluence, 0, 1);
  let hueBase = lerpColor(color(170, 80, 100), color(260, 70, 80), hueDrift);

 // --- tide bands (now more reactive to low tide synths) ---
push();
translate(width / 2, height / 2);
rotate(sin(frameCount * 0.00008) * 0.02);
translate(-width / 2, -height / 2);

for (let i = 0; i < bands.length; i++) {
  const b = bands[i];
  push();

  // stronger sway with bass frequencies
  const bassLift = map(bass, 0, 255, -120, 120);
  const verticalDrift = sin(frameCount * 0.002 + b.offset) * (60 + bassLift * 0.4);
  translate(width / 2, b.y + verticalDrift);

  // tilt angle influenced by midrange synths
  const midTilt = map(mids, 0, 255, -PI / 8, PI / 8);
  rotate(b.angle + midTilt * 0.15 + sin(frameCount * b.speed + b.offset) * 0.04);

  // opacity now tied to volume (like light through tide)
  const dynamicAlpha = map(level, 0, 0.4, b.alpha * 0.5, b.alpha * 1.8);
  fill(b.color[0], b.color[1], b.color[2], dynamicAlpha);

  // smooth wide waves
  beginShape();
  const bandHeight = height / 2.2;
  const waveAmp = map(bass, 0, 255, 30, 120); // stronger amplitude = deeper waves
  const noiseOffset = b.offset + frameCount * 0.0006 * (1 + level * 2);

  for (let x = -width * 1.5; x <= width * 1.5; x += 16) {
    let y = sin(x * 0.004 + noiseOffset) * waveAmp;
    y += noise(noiseOffset + x * 0.001) * 20 - 10;
    vertex(x, y);
  }

  vertex(width * 1.5, bandHeight);
  vertex(-width * 1.5, bandHeight);
  endShape(CLOSE);
  pop();
}
pop();

  // --- adaptive particle density ---
  const targetCount = BASE_PARTICLES + int(map(level, 0, 0.3, 0, 600));
  while (particles.length < targetCount) particles.push(new Particle(random(width), random(height)));
  while (particles.length > targetCount) particles.pop();

  for (let p of particles) {
    p.update(level, highs);
    p.applyMouse();
    p.show(highs);
  }

  // --- drifting text ---
  updateFloatingText(level);
  for (let t of floatingText) t.display();

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

function mousePressed() {
  if (!hasStarted) {
    hasStarted = true;
    textAlpha = 255;
    soundRiver.loop();
    soundOcean.loop();
    soundRiver.setVolume(0.7);
    soundOcean.setVolume(0.4);
  } else if (soundRiver.isPlaying()) {
    soundRiver.pause();
    soundOcean.pause();
  } else {
    soundRiver.loop();
    soundOcean.loop();
  }
}

// --- Floating poetic text ---
function updateFloatingText(level) {
  if (frameCount % int(random(180, 300)) === 0 && floatingText.length < MAX_FLOATING_TEXT) {
    let line = random(fieldNotes);
    floatingText.push(new FloatingLine(line));
  }

  floatingText = floatingText.filter(t => !t.isDead());
}

class FloatingLine {
  constructor(line) {
    this.text = line;
    this.x = random(width * 0.1, width * 0.9);
    this.y = random(height * 0.6, height);
    this.alpha = 0;
    this.life = 0;
    this.fadeIn = true;
  }

  display() {
    textAlign(CENTER);
    textSize(18);
    fill(255, 255, 255, this.alpha);
    text(this.text, this.x, this.y);
    this.y -= 0.2;

    if (this.fadeIn) {
      this.alpha += 1.2;
      if (this.alpha >= 100) this.fadeIn = false;
    } else {
      this.life++;
      if (this.life > 500) this.alpha -= 0.4;
    }
  }

  isDead() {
    return this.alpha <= 0;
  }
}

// --- Particle class ---
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.3, 1));
    this.acc = createVector(0, 0);
    this.size = random(1.5, 3);
  }

  update(level, highs) {
    let angle = noise(this.pos.x * FLOW_SCALE, this.pos.y * FLOW_SCALE, frameCount * 0.0012) * TWO_PI * 4;
    let flow = p5.Vector.fromAngle(angle).mult(0.4 + level * 2.5);
    this.acc.add(flow);
    this.vel.add(this.acc);
    this.vel.mult(FLOW_TAIL);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.wrap();
  }

  applyMouse() {
    let m = createVector(mouseX, mouseY);
    let d = dist(this.pos.x, this.pos.y, m.x, m.y);
    if (d < 200) {
      let dir = p5.Vector.sub(this.pos, m);
      let force = map(d, 0, 200, 3, 0.2);
      dir.normalize().mult(force);
      this.vel.add(dir);
    }
  }

  show(highs) {
    let baseColor = color(93, 255, 253);
    let shimmerColor = color(255, 254, 190);
    let c = dist(mouseX, mouseY, this.pos.x, this.pos.y) < 150 ? shimmerColor : baseColor;
    fill(red(c), green(c), blue(c), map(highs, 0, 255, 10, 60));
    ellipse(this.pos.x, this.pos.y, this.size);
  }

  wrap() {
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
