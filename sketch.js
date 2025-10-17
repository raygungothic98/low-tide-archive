let soundRiver, soundOcean, fft, amp, masterGain;
let bands = [];
let particles = [];
let textAlpha = 255;
let hasStarted = false;
let fieldNotes = [];
let tideText = "";
let textTimer = 0;
let lastTextChange = 0;

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

  // --- master gain setup ---
  masterGain = new p5.Gain();
  masterGain.connect();
  soundRiver.disconnect();
  soundOcean.disconnect();
  soundRiver.connect(masterGain);
  soundOcean.connect(masterGain);
  masterGain.amp(1.0); // base level, will modulate later

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
  textFont("Georgia");
  textAlign(CENTER, CENTER);
  fill(255);
  tideText = random(fieldNotes);
}

function draw() {
  fill(0, 0, 0, TRAIL_ALPHA);
  rect(0, 0, width, height);

  const spectrum = fft.analyze();
  const level = amp.getLevel();
  const bass = avg(spectrum.slice(0, 30));
  const mids = avg(spectrum.slice(30, 120));
  const highs = avg(spectrum.slice(120));

  // --- dynamic tide gain (slow breathing of amplitude) ---
  const tideGain = map(bass, 0, 255, 0.8, 1.4);
  masterGain.amp(tideGain, 0.2); // smooth transitions

  // --- tide color drift (teal → violet, amplitude-reactive) ---
  let timeDrift = (sin(frameCount * 0.0004) + 1) * 0.5;
  let levelInfluence = constrain(map(level, 0, 0.4, 0, 0.3), 0, 0.3);
  let hueDrift = constrain(timeDrift + levelInfluence, 0, 1);
  let hueBase = lerpColor(color(170, 80, 100), color(260, 70, 80), hueDrift);

  // --- tide bands: wave-like, moving up/down ---
  push();
  translate(width / 2, height / 2);
  rotate(sin(frameCount * 0.00008) * 0.02);
  translate(-width / 2, -height / 2);

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    push();
    translate(width / 2, b.y + sin(frameCount * 0.002 + b.offset) * 40);
    rotate(b.angle + sin(frameCount * b.speed + b.offset) * 0.04 + bass * 0.0005);
    fill(b.color[0], b.color[1], b.color[2], b.alpha);

    // undulating wave geometry
    beginShape();
    const bandHeight = height / 2.5;
    const waveAmp = map(bass, 0, 255, 10, 60);
    const noiseOffset = b.offset + frameCount * 0.0003;

    for (let x = -width * 1.5; x <= width * 1.5; x += 20) {
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

  // --- adaptive silt particles ---
  let activeParticleCount = int(map(level, 0, 0.4, 600, NUM_PARTICLES));
  for (let i = 0; i < activeParticleCount; i++) {
    let p = particles[i];
    p.update(level, highs);
    p.applyMouse();
    p.show(highs);
  }

  // --- generative text (field notes) ---
  if (millis() - lastTextChange > 7000 + random(2000)) {
    tideText = random(fieldNotes); // choose a new line
    lastTextChange = millis();
  }

  if (hasStarted) {
    fill(255, 255, 255, 140);
    textSize(18);
    text(tideText, width / 2, height - 60);
  }

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
    soundRiver.fade(0, 1.0, FADE_TIME);
    soundOcean.fade(0, 0.6, FADE_TIME);
  } else if (soundRiver.isPlaying()) {
    soundRiver.fade(1.0, 0, FADE_TIME);
    soundOcean.fade(0.6, 0, FADE_TIME);
    setTimeout(() => {
      soundRiver.pause();
      soundOcean.pause();
    }, FADE_TIME + 200);
  } else {
    soundRiver.loop();
    soundOcean.loop();
    soundRiver.setVolume(0);
    soundOcean.setVolume(0);
    soundRiver.fade(0, 1.0, FADE_TIME);
    soundOcean.fade(0, 0.6, FADE_TIME);
  }
}

// --- helper functions ---
function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;
}

// --- PARTICLES ---
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.2, 0.6));
    this.acc = createVector(0, 0);
    this.baseColor = color(93, 255, 253);
    this.shimmerColor = color(255, 254, 190);
    this.size = random(1.5, 3);
  }

  update(level, highs) {
    let angle = noise(
      this.pos.x * FLOW_SCALE,
      this.pos.y * FLOW_SCALE,
      frameCount * 0.0012
    ) * TWO_PI * 4;
    let flow = p5.Vector.fromAngle(angle).mult(0.4 + level * 2);
    this.acc.add(flow);
    this.vel.add(this.acc);
    this.vel.mult(FLOW_TAIL);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.wrap();
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

  wrap() {
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }

  show(highs) {
    let sparkle = map(highs, 0, 255, 6, 22);
    let c = dist(this.pos.x, this.pos.y, mouseX, mouseY) < 120
      ? this.shimmerColor
      : this.baseColor;
    fill(red(c), green(c), blue(c), sparkle);
    ellipse(this.pos.x, this.pos.y, this.size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
