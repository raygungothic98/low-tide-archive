// 🌊 LOW-TIDE ARCHIVE (The River Records Itself)
// Eva Grant © 2025

let soundRiver, soundOcean, fft, amp;
let bands = [];
let particles = [];
let tideTexts = [];
let ripples = [];
let textAlpha = 255;
let hasStarted = false;

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

// --- LANGUAGE SYSTEM ---
let markov, voice;
let archiveLines = [];
let lastSpeak = 0;
const SPEAK_INTERVAL = 30000; // every 30 seconds approx.

// --- RiTa compatibility shim ---
let RiMarkov = RiTa.RiMarkov || window.RiMarkov;

function preload() {
  soundRiver = loadSound("lowtide3min.mp3");
  soundOcean = loadSound("oceanwaves.mp3");
  archiveLines = loadStrings("field_notes.txt");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255, 255, 255, 100);
  noStroke();

  fft = new p5.FFT(0.9, 256);
  amp = new p5.Amplitude();

  // --- Markov setup ---
  markov = new RiMarkov(3);
  markov.addText(archiveLines.join(" "));

  // --- Voice setup ---
  voice = new p5.Speech();
  voice.setRate(0.92);
  voice.setPitch(1.05);
  voice.setVolume(0.7);
  voice.onStart = () => {
    let x = random(width * 0.2, width * 0.8);
    let y = random(height * 0.6, height * 0.9);
    ripples.push(new Ripple(x, y));
  };

  // --- initialize tide bands ---
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
  const highs = avg(spectrum.slice(120));

  // --- tide band movement ---
  push();
  translate(width / 2, height / 2);
  rotate(sin(frameCount * 0.0001) * 0.03);
  translate(-width / 2, -height / 2);

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    push();
    translate(width / 2, b.y + sin(frameCount * 0.002 + i) * 40 * level * 3);
    rotate(
      b.angle +
        sin(frameCount * b.speed + b.offset) * 0.05 +
        map(bass, 0, 255, -0.02, 0.02)
    );
    fill(b.color[0], b.color[1], b.color[2], b.alpha);

    beginShape();
    const bandHeight = height / 2.5;
    const waveAmp = map(bass, 0, 255, 10, 60);
    const noiseOffset = b.offset + frameCount * 0.0003;
    for (let x = -width * 1.5; x <= width * 1.5; x += 25) {
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
  let dynamicCount = int(
    map(level, 0, 0.4, NUM_PARTICLES * 0.6, NUM_PARTICLES * 1.4)
  );
  if (particles.length < dynamicCount) {
    for (let i = 0; i < 15; i++)
      particles.push(new Particle(random(width), random(height)));
  } else if (particles.length > dynamicCount) {
    particles.splice(0, 10);
  }

  // --- eelgrass-like flow ---
  for (let p of particles) {
    p.update(level, highs);
    p.applyMouse();
    p.show(highs);
  }

  // --- generative tide text ---
  if (hasStarted && frameCount % 900 === 0) {
    tideTexts.push(new TideText(generateTideLine()));
  }
  for (let t of tideTexts) {
    t.update();
    t.show();
  }
  tideTexts = tideTexts.filter((t) => !t.dead);

  // --- ripple shimmer on speech ---
  for (let r of ripples) {
    r.update();
    r.show();
  }
  ripples = ripples.filter((r) => !r.dead);

  maybeSpeak(level);

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

// --- Markov text generation ---
function generateTideLine() {
  let results = markov.generate(); // no '1' argument needed in modern RiTa
  let line = results && results.length ? results[0] : "The river remembers.";
  return line.charAt(0).toUpperCase() + line.slice(1);
}

// --- whisper timing + ripple trigger ---
function maybeSpeak(level) {
  if (millis() - lastSpeak > SPEAK_INTERVAL && hasStarted) {
    lastSpeak = millis();
    if (random() < map(level, 0, 0.3, 0.3, 0.8)) {
      let line = generateTideLine();
      voice.speak(line);
      tideTexts.push(new TideText(line));
    }
  }
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

// --- UTILITIES ---
function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;
}

// --- PARTICLES ---
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.3, 1));
    this.acc = createVector(0, 0);
    this.size = random(1.5, 3);
  }

  update(level, highs) {
    let angle =
      noise(
        this.pos.x * FLOW_SCALE,
        this.pos.y * FLOW_SCALE,
        frameCount * 0.0012
      ) *
      TWO_PI *
      4;
    let flow = p5.Vector.fromAngle(angle).mult(0.4 + level * 2);
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
    let d = dist(this.pos.x, this.pos.y, mouseX, mouseY);
    if (d < 200) {
      let dir = p5.Vector.sub(this.pos, createVector(mouseX, mouseY));
      let force = map(d, 0, 200, 3.5, 0.1);
      dir.normalize().mult(force);
      this.vel.add(dir);
    }
  }

  show(highs) {
    let shimmerChance = map(highs, 0, 255, 0, 0.02);
    if (random() < shimmerChance) fill(255, 254, 190, 80);
    else fill(93, 255, 253, 70);
    ellipse(this.pos.x, this.pos.y, this.size);
  }
}

// --- TIDE TEXT ---
class TideText {
  constructor(line) {
    this.line = line;
    this.pos = createVector(
      random(width * 0.1, width * 0.9),
      random(height * 0.7, height * 1.1)
    );
    this.alpha = 0;
    this.dead = false;
    this.life = 900 + random(400);
    this.size = random(14, 22);
  }

  update() {
    this.alpha = map(sin(frameCount * 0.01), -1, 1, 100, 255);
    this.pos.y -= 0.25;
    if (this.pos.y < -60) this.dead = true;
  }

  show() {
    fill(255, 255, 255, this.alpha * 0.5);
    textAlign(CENTER);
    textSize(this.size);
    text(this.line, this.pos.x, this.pos.y);
  }
}

// --- RIPPLE shimmer ---
class Ripple {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.r = 0;
    this.alpha = 120;
    this.dead = false;
  }

  update() {
    this.r += 3;
    this.alpha -= 1.5;
    if (this.alpha <= 0) this.dead = true;
  }

  show() {
    noFill();
    stroke(200, 240, 255, this.alpha);
    strokeWeight(1.2);
    ellipse(this.pos.x, this.pos.y, this.r * 2);
    noStroke();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
