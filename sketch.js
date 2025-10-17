// --- GLOBAL VARIABLES ---
let soundRiver, soundOcean, fft, amp, markov, notes;
let bands = [];
let particles = [];
let textAlpha = 255;
let hasStarted = false;
let lastTextTime = 0;
let currentLine = "";
let textFade = 0;

// --- CONFIG ---
const NUM_BANDS = 5;
const NUM_PARTICLES = 1000;
const TRAIL_ALPHA = 6;
const FLOW_SCALE = 0.0025;
const FLOW_TAIL = 0.94;
const FADE_TIME = 3000;
const TEXT_INTERVAL = 10000; // ms between lines
const TEXT_FADE_SPEED = 3;

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

// --- PRELOAD ASSETS ---
function preload() {
  soundRiver = loadSound("assets/audio/lowtide3min.mp3");
  soundOcean = loadSound("assets/audio/oceanwaves.mp3");
  notes = loadStrings("assets/data/notes.txt");
}

// --- SETUP ---
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255, 255, 255, 100);
  noStroke();

  fft = new p5.FFT(0.9, 256);
  amp = new p5.Amplitude();

  // initialize Markov model
  markov = new RiTa.RiMarkov(3);
  markov.addText(join(notes, " "));

  // --- initialize tide bands ---
  for (let i = 0; i < NUM_BANDS; i++) {
    bands.push({
      color: sedimentColors[i],
      y: map(i, 0, NUM_BANDS - 1, 0, height),
      angle: random(-PI / 10, PI / 10),
      speed: random(0.0006, 0.0014),
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

// --- DRAW LOOP ---
function draw() {
  fill(0, 0, 0, TRAIL_ALPHA);
  rect(0, 0, width, height);

  // --- AUDIO REACTIVITY ---
  const spectrum = fft.analyze();
  const level = amp.getLevel();
  const bass  = avg(spectrum.slice(0, 30));
  const mids  = avg(spectrum.slice(30, 120));
  const highs = avg(spectrum.slice(120));

  // --- slow tide color drift (teal → violet, amplitude-reactive) ---
  let timeDrift = (sin(frameCount * 0.0004) + 1) * 0.5;
  let levelInfluence = constrain(map(level, 0, 0.4, 0, 0.3), 0, 0.3);
  hueDrift = constrain(timeDrift + levelInfluence, 0, 1);
  hueBase = lerpColor(color(170, 80, 100), color(260, 70, 80), hueDrift);

  // --- reactive tide bands ---
  push();
  translate(width / 2, height / 2);
  rotate(sin(frameCount * 0.00008) * 0.02);
  translate(-width / 2, -height / 2);

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    push();
    translate(width / 2, b.y + sin(frameCount * b.speed * 20) * 40 * (bass / 255));
    rotate(b.angle + sin(frameCount * b.speed + b.offset) * 0.04 + bass * 0.0004);
    fill(b.color[0], b.color[1], b.color[2], b.alpha);
    beginShape();

    const bandHeight = height / 2.5;
    const waveAmp = map(bass, 0, 255, 20, 80);
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

  // --- reactive particle field ---
  for (let p of particles) {
    p.update(level, highs);
    p.applyMouse();
    p.show(highs);
  }

  // --- text fade logic ---
  if (currentLine && textFade > 0) {
    fill(255, 255, 255, textFade);
    textAlign(CENTER, CENTER);
    textSize(20);
    text(currentLine, width / 2, height - 80);
    textFade -= TEXT_FADE_SPEED;
  }

  // --- timed generative field note ---
  if (hasStarted && millis() - lastTextTime > TEXT_INTERVAL) {
    generateTideLine();
    lastTextTime = millis();
  }

  // --- intro text ---
  if (!hasStarted) drawIntro();
  else if (textAlpha > 0) {
    textAlpha = max(0, textAlpha - 6);
    drawIntro();
  }
}

// --- INTRO TEXT ---
function drawIntro() {
  fill(255, 255, 255, textAlpha * 0.6);
  textAlign(CENTER, CENTER);
  textSize(22);
  text("click to begin low tide", width / 2, height / 2);
}

// --- SOUND + CROSSFADE ---
function mousePressed() {
  if (!hasStarted) {
    hasStarted = true;
    textAlpha = 255;
    soundRiver.loop();
    soundOcean.loop();
    soundRiver.setVolume(0);
    soundOcean.setVolume(0);
    soundRiver.fade(0, 0.8, FADE_TIME);
    soundOcean.fade(0, 0.4, FADE_TIME);

    // opening whisper
    whisperText("The river remembers what it carries.");
  } else if (soundRiver.isPlaying()) {
    soundRiver.fade(0.8, 0, FADE_TIME);
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
    soundRiver.fade(0, 0.8, FADE_TIME);
    soundOcean.fade(0, 0.4, FADE_TIME);
  }
}

// --- TEXT GENERATION & WHISPER ---
function generateTideLine() {
  let result = markov.generate(); // no argument!
  if (result && result.length > 0) {
    currentLine = result.join(" ");
    textFade = 255;
    whisperText(currentLine);
  }
}

function whisperText(txt) {
  let voice = new p5.Speech();
  voice.setRate(0.8);
  voice.setVolume(0.6);
  voice.speak(txt);
}

// --- UTILITIES ---
function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;
}

// --- PARTICLE CLASS ---
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.3, 1));
    this.acc = createVector(0, 0);
    this.hue = color(93, 255, 253);
    this.size = random(1.5, 3);
  }

  update(level, highs) {
    let angle = noise(this.pos.x * FLOW_SCALE, this.pos.y * FLOW_SCALE, frameCount * 0.0012) * TWO_PI * 4;
    let flow = p5.Vector.fromAngle(angle).mult(0.5 + level * 2);
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
      let force = map(d, 0, 200, 3.5, 0.1);
      dir.normalize().mult(force);
      this.vel.add(dir);
      // shimmer to pale yellow near mouse
      this.hue = color(255, 254, 190);
    } else {
      this.hue = color(93, 255, 253);
    }
  }

  show(highs) {
    let sparkle = map(highs, 0, 255, 8, 24);
    fill(this.hue.levels[0], this.hue.levels[1], this.hue.levels[2], sparkle);
    ellipse(this.pos.x, this.pos.y, this.size);
  }
}

// --- WINDOW RESIZE ---
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
