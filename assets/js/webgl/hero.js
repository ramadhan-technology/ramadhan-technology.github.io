/**
 * HERO WEBGL: "from manual to system".
 *
 * Draws the floating pieces that lock into a grid (the drawing itself is in hero-shaders.js).
 * This file does everything around it:
 *   - sets WebGL up, and gives up cleanly if the device cannot do it
 *   - works out "progress" (0 = manual, 1 = system) from time and scroll position
 *   - keeps the phone cool: capped resolution, no drawing when off-screen or finished
 *   - switches to the static SVG picture if anything goes wrong or the device is too slow
 *
 * WebGL in one paragraph: you give the graphics chip a list of points (here: the corners of
 * some squares) plus two small programs (shaders). Every frame you set a few numbers
 * ("uniforms") and say "draw". The chip does the rest. All squares are drawn in ONE draw call.
 *
 * No library is used: this is plain WebGL 1, which every browser with WebGL supports.
 */
import { VERTEX_SHADER, FRAGMENT_SHADER } from './hero-shaders.js';

// ---------------------------------------------------------------- settings (TUNE)
const MAX_DPR_PHONE = 1.5;    // cap on device pixel ratio for touch devices (sharper = more pixels = more heat)
const MAX_DPR_DESKTOP = 2;
const AUTO_PROGRESS = 0.38;   // how far the pieces assemble by themselves after load, before any scrolling
const AUTO_DURATION = 1.8;    // seconds that takes
const SMOOTHING = 0.09;       // 0..1: how quickly the picture follows the target progress each frame
const SLOW_FRAME_MS = 34;     // average frame time above this (under ~30 fps) counts as "too slow"
const SAMPLE_FRAMES = 40;     // frames measured before judging speed

/**
 * Starts the hero effect inside the element with class "hero__visual".
 * Returns (as a Promise) a small controller, or null when the static picture is used instead.
 *
 * It is "async" because of one step: turning the shader text into a GPU program can take a
 * noticeable moment on a phone. We let the graphics driver do that in the background and
 * check back once per frame, instead of making the whole page wait for it.
 */
export async function initHero() {
  const figure = document.querySelector('.hero__visual');
  if (!figure) return null; // this page has no hero

  /** Give up: remove the canvas and show the static SVG picture. Safe to call more than once. */
  const useFallback = (reason) => {
    stop();
    canvas.remove();
    figure.classList.remove('is-live');
    figure.classList.add('is-fallback');
    console.info('Hero: using the static picture (' + reason + ').');
    return null;
  };

  const canvas = document.createElement('canvas');
  canvas.className = 'hero__canvas';
  canvas.setAttribute('aria-hidden', 'true');

  // premultipliedAlpha matches the colours the fragment shader outputs; antialias is off because
  // the shader smooths its own edges (cheaper than the browser's full-screen anti-aliasing).
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  let running = false;
  let frameId = 0;
  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
  }
  if (!gl) return useFallback('WebGL not available');

  // ---------------------------------------------------------------- compile the two shaders
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);     // only STARTS the work; we do not ask "are you done?" here on purpose
    return shader;
  };
  const vertexShader = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // Asking WebGL for the result makes the page WAIT until the driver has finished. With the
  // "parallel shader compile" extension we can ask "finished yet?" without waiting, once per frame.
  // Browsers without the extension skip this and simply wait at the check below, as before.
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  if (parallel) {
    const deadline = performance.now() + 5000;
    while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
      if (gl.isContextLost() || performance.now() > deadline) return useFallback('shader compile did not finish');
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(
      gl.getShaderInfoLog(vertexShader) || gl.getShaderInfoLog(fragmentShader) || gl.getProgramInfoLog(program) || 'shader error'
    );
    return useFallback('shader error');
  }
  gl.useProgram(program);

  // Where each uniform lives inside the compiled program.
  const uniform = {};
  ['u_resolution', 'u_grid', 'u_cell', 'u_progress', 'u_time', 'u_colorDim', 'u_colorText', 'u_colorAccent', 'u_colorLine']
    .forEach((name) => (uniform[name] = gl.getUniformLocation(program, name)));

  // Colours come from the CSS tokens, so the canvas always matches the page.
  const cssColor = (token) => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue(token).trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  };
  gl.uniform3fv(uniform.u_colorDim, cssColor('--color-text-dim'));
  gl.uniform3fv(uniform.u_colorText, cssColor('--color-text'));
  gl.uniform3fv(uniform.u_colorAccent, cssColor('--color-accent'));
  gl.uniform3fv(uniform.u_colorLine, cssColor('--color-line-strong'));

  // Draw see-through pixels correctly on top of each other ("premultiplied alpha" blending).
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  // ---------------------------------------------------------------- the pieces
  const buffer = gl.createBuffer();
  let vertexCount = 0;
  let grid = { cols: 0, rows: 0 };

  /** A repeatable "random" number 0..1 from a whole number, so the layout is the same on every visit. */
  const random = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  /**
   * Builds the list of corners for a cols x rows grid.
   * Every piece is a square = 2 triangles = 6 corners. Each corner carries 9 numbers:
   *   corner x,y | cell column,row | 4 random seeds | type
   */
  function buildPieces(cols, rows) {
    const FLOATS_PER_VERTEX = 9;
    const corners = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]];
    const accentIndex = Math.floor(rows / 2) * cols + Math.floor(cols / 2); // the middle cell is the orange note
    const data = new Float32Array(cols * rows * 6 * FLOATS_PER_VERTEX);
    let offset = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const seeds = [random(index * 4 + 1), random(index * 4 + 2), random(index * 4 + 3), random(index * 4 + 4)];
        // Types repeat in a shifted pattern so the same icon is never directly below itself.
        const type = index === accentIndex ? 13 : (col + row * 2) % 3; // 13 = sticky note (3) + accent (10)
        for (const [x, y] of corners) {
          data.set([x, y, col, row, ...seeds, type], offset);
          offset += FLOATS_PER_VERTEX;
        }
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    // Tell WebGL how the 9 numbers per corner map onto the shader's attributes.
    const stride = FLOATS_PER_VERTEX * 4; // 4 bytes per float
    const layout = [['a_corner', 2, 0], ['a_cell', 2, 2], ['a_seed', 4, 4], ['a_type', 1, 8]];
    for (const [name, size, start] of layout) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, start * 4);
    }

    vertexCount = cols * rows * 6;
    grid = { cols, rows };
  }

  // ---------------------------------------------------------------- size
  const isTouch = matchMedia('(pointer: coarse)').matches;
  let dpr = Math.min(window.devicePixelRatio || 1, isTouch ? MAX_DPR_PHONE : MAX_DPR_DESKTOP);

  /** Matches the canvas to its box on the page and picks a grid that suits the shape. */
  function resize() {
    const box = figure.getBoundingClientRect();
    if (!box.width || !box.height) return;
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Wide box (desktop): 5 x 3 pieces. Squarer box (phone): 4 x 3.
    const cols = box.width / box.height > 1.45 ? 5 : 4;
    const rows = 3;
    if (cols !== grid.cols || rows !== grid.rows) buildPieces(cols, rows);

    const cell = Math.min(canvas.width / cols, canvas.height / rows);
    gl.uniform2f(uniform.u_resolution, canvas.width, canvas.height);
    gl.uniform2f(uniform.u_grid, cols, rows);
    gl.uniform1f(uniform.u_cell, cell);
  }

  // ---------------------------------------------------------------- progress
  let progress = 0;          // what is on screen now
  let startTime = 0;         // when the effect started (ms)
  let onScreen = true;

  /**
   * Target progress = the larger of:
   *   - the automatic part: rises to AUTO_PROGRESS after load, so visitors who never scroll still see the idea
   *   - the scroll part: 0 while the middle of the picture is 85% down the screen, 1 when it reaches 45%
   * No pinning: the page scrolls normally and the picture reacts to where it is.
   */
  function targetProgress(now) {
    const t = Math.min((now - startTime) / 1000 / AUTO_DURATION, 1);
    const auto = AUTO_PROGRESS * (1 - Math.pow(1 - t, 3));

    const box = figure.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    const viewport = window.innerHeight;
    const scroll = (viewport * 0.85 - middle) / (viewport * 0.4);

    return Math.max(auto, Math.min(Math.max(scroll, 0), 1));
  }

  function draw(value, seconds) {
    gl.uniform1f(uniform.u_progress, value);
    gl.uniform1f(uniform.u_time, seconds);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount); // one draw call for every piece
  }

  // ---------------------------------------------------------------- speed check
  let lastFrame = 0;
  let sampleTotal = 0;
  let sampleCount = 0;
  let judged = false;

  /**
   * Measures the first frames. Too slow: first lower the resolution; if still too slow, use the static picture.
   * Frames longer than 250 ms are ignored: that is a background tab being throttled, not a slow device.
   */
  function checkSpeed(now) {
    if (judged || !lastFrame) return true;
    const delta = now - lastFrame;
    if (delta > 250) return true;
    sampleTotal += delta;
    if (++sampleCount < SAMPLE_FRAMES) return true;

    const average = sampleTotal / sampleCount;
    if (average <= SLOW_FRAME_MS) {
      judged = true;
    } else if (dpr > 1) {
      dpr = 1;               // second chance at lower resolution
      resize();
      sampleTotal = 0;
      sampleCount = 0;
    } else {
      useFallback('device too slow: ' + average.toFixed(0) + ' ms per frame');
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- frame loop
  function frame(now) {
    if (!running) return;
    if (!checkSpeed(now)) return;
    lastFrame = now;

    const target = targetProgress(now);
    progress += (target - progress) * SMOOTHING;
    if (Math.abs(target - progress) < 0.0005) progress = target;
    draw(progress, (now - startTime) / 1000);

    // Fully assembled and nothing left to move: stop drawing until the visitor scrolls again.
    if (progress >= 0.9995 && target >= 0.9995) {
      running = false;
      return;
    }
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || !onScreen || document.hidden) return;
    running = true;
    lastFrame = 0;
    frameId = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- when to run
  // Only draw while the picture is on screen ...
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    onScreen ? start() : stop();
  }).observe(figure);
  // ... and the tab is visible.
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  // Scrolling can wake a finished picture (scrolling back up loosens the pieces again).
  window.addEventListener('scroll', start, { passive: true });
  // Keep the canvas matched to its box.
  new ResizeObserver(() => {
    resize();
    running ? null : draw(progress, (performance.now() - startTime) / 1000);
  }).observe(figure);

  // The graphics chip can drop our context (memory pressure, driver reset). Show the static picture then.
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    useFallback('WebGL context lost');
  });

  // ---------------------------------------------------------------- go
  figure.append(canvas);
  resize();
  startTime = performance.now();
  draw(0, 0);                          // first picture immediately, before the loop starts
  figure.classList.add('is-live');     // CSS fades the canvas in and keeps the SVG hidden
  start();

  return {
    /** For testing: draw one exact state. progress 0..1, seconds = position of the floating motion. */
    drawAt(value, seconds = 0) {
      stop();
      draw(value, seconds);
    },
    resume: start,
  };
}
