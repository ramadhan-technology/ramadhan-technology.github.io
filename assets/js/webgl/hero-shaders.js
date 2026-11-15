/**
 * SHADERS FOR THE HERO ("from manual to system").
 *
 * WHAT A SHADER IS
 *   A small program that runs on the graphics chip (GPU). It is written in GLSL, a C-like language,
 *   and handed to WebGL as a text string. That is why the code below sits inside JavaScript strings.
 *   There are always two:
 *     1. VERTEX shader    runs once per corner of each shape. Its job: say WHERE that corner is on screen.
 *     2. FRAGMENT shader  runs once per pixel inside the shape. Its job: say WHAT COLOUR that pixel is.
 *
 * WHAT WE DRAW
 *   A handful of squares ("fragments"). Each one is a paper slip, a chat bubble, spreadsheet cells
 *   or a sticky note: the pieces of a business that is run by hand.
 *   One number, u_progress, drives everything:
 *     0 = manual: the pieces float around, tilted, dim.
 *     1 = system: every piece sits upright in its own cell of a grid, bright, with a frame around it.
 *   JavaScript only changes that one number (and the time). All movement is calculated here, on the GPU.
 *
 * WORDS YOU WILL SEE
 *   attribute  a value that is different for every corner (set once from JavaScript, see hero.js)
 *   uniform    a value that is the same for the whole picture (progress, time, canvas size, colours)
 *   varying    a value the vertex shader passes on to the fragment shader
 *   vec2/vec3  2 or 3 numbers together (a position, a colour)
 *   mix(a,b,t) blend from a to b; t = 0 gives a, t = 1 gives b
 *
 * TO CHANGE THE LOOK, the numbers marked "TUNE" are the safe ones to play with.
 */

export const VERTEX_SHADER = /* glsl */ `
  attribute vec2  a_corner;  // which corner of the square this is: (-1,-1) (1,-1) (-1,1) or (1,1)
  attribute vec2  a_cell;    // this piece's home in the grid: (column, row), counted from 0
  attribute vec4  a_seed;    // four random numbers 0..1, fixed per piece: makes every piece behave differently
  attribute float a_type;    // 0 slip, 1 chat, 2 cells, 3 note. Add 10 for the one orange piece

  uniform vec2  u_resolution; // canvas size in pixels
  uniform vec2  u_grid;       // number of (columns, rows)
  uniform float u_cell;       // size of one grid cell in pixels
  uniform float u_progress;   // 0 = manual ... 1 = system
  uniform float u_time;       // seconds since start, for the slow floating

  varying vec2  v_uv;         // position inside the square, -1..1 (the fragment shader draws the icon with it)
  varying float v_type;
  varying float v_lock;       // how "locked in" this piece is, 0..1
  varying float v_pixel;      // the size of one screen pixel measured in v_uv units (for smooth edges)

  // Ease-out: fast at first, then slows down a lot. Makes the piece "click" into its cell.
  float easeOut(float t) { return 1.0 - pow(1.0 - t, 4.0); }

  void main() {
    // ---- 1. When does this piece move? ----
    // Pieces do not all move together. Each waits for its own delay (from its random seed),
    // then takes 55% of the progress range to travel. TUNE: 0.45 = how spread out the starts are.
    float delay = a_seed.w * 0.45;
    float local = clamp((u_progress - delay) / 0.55, 0.0, 1.0);
    float lock  = easeOut(local);

    // ---- 2. Where is "home" (the system position)? ----
    vec2 gridSize = u_grid * u_cell;
    vec2 gridTopLeft = (u_resolution - gridSize) * 0.5;       // the grid is centred in the canvas
    vec2 home = gridTopLeft + (a_cell + 0.5) * u_cell;        // centre of this piece's cell

    // ---- 3. Where is it when loose (the manual position)? ----
    // A random spot in the canvas (kept 8% away from the edges), plus a slow circular float.
    vec2 spot  = mix(vec2(0.08), vec2(0.92), a_seed.xy) * u_resolution;
    vec2 drift = vec2(sin(u_time * 0.6 + a_seed.x * 6.2832),
                      cos(u_time * 0.5 + a_seed.y * 6.2832)) * u_cell * 0.16; // TUNE: 0.16 = float distance
    vec2 loose = spot + drift;

    vec2 centre = mix(loose, home, lock);

    // ---- 4. Tilt and size ----
    // Loose pieces are tilted (up to about 70 degrees either way) and wobble; locked pieces are upright.
    float angle = ((a_seed.z - 0.5) * 2.4 + sin(u_time * 0.4 + a_seed.w * 6.2832) * 0.25) * (1.0 - lock);
    // Loose pieces are smaller and uneven; locked pieces are all the same size.
    float halfSize = u_cell * 0.5 * mix(0.60 + a_seed.x * 0.30, 0.92, lock);

    // Rotate the corner around the centre of the piece.
    float c = cos(angle);
    float s = sin(angle);
    vec2 corner = vec2(a_corner.x * c - a_corner.y * s,
                       a_corner.x * s + a_corner.y * c) * halfSize;

    // ---- 5. Pixels to WebGL coordinates ----
    // WebGL wants -1..1 with +y pointing up; we worked in pixels with +y pointing down.
    vec2 clip = (centre + corner) / u_resolution * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);

    v_uv    = a_corner;
    v_type  = a_type;
    v_lock  = lock;
    v_pixel = 1.0 / halfSize;
  }
`;

export const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;   // medium number precision: enough here, and faster on phones

  varying vec2  v_uv;
  varying float v_type;
  varying float v_lock;
  varying float v_pixel;

  uniform vec3 u_colorDim;    // colour of a loose piece  (--color-text-dim)
  uniform vec3 u_colorText;   // colour of a locked piece (--color-text)
  uniform vec3 u_colorAccent; // the orange               (--color-accent)
  uniform vec3 u_colorLine;   // the cell frame           (--color-line-strong)

  // The icons are drawn with "signed distance" maths instead of images:
  // a function returns how far a point is from a shape's edge (negative = inside).
  // That keeps them sharp at any size and costs no download.

  // Distance to a rectangle centred on 0 with half-size b.
  float rect(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
  // 1 inside the shape, 0 outside, with a one-pixel soft edge (anti-aliasing).
  float fill(float dist) { return 1.0 - smoothstep(-v_pixel, v_pixel, dist); }
  // Only the outline of a shape, with half-thickness w.
  float outline(float dist, float w) { return fill(abs(dist) - w); }
  // A horizontal bar from x0 to x1 at height y.
  float bar(vec2 p, float y, float x0, float x1, float w) {
    return fill(rect(p - vec2((x0 + x1) * 0.5, y), vec2((x1 - x0) * 0.5, w)));
  }
  // A vertical bar from y0 to y1 at position x.
  float post(vec2 p, float x, float y0, float y1, float w) {
    return fill(rect(p - vec2(x, (y0 + y1) * 0.5), vec2(w, (y1 - y0) * 0.5)));
  }

  void main() {
    vec2 p = v_uv;                 // -1..1 across the square, +y is down
    float w = 0.035;               // TUNE: line thickness of the icons
    float type = mod(v_type, 10.0);
    bool isAccent = v_type >= 10.0;

    float icon = 0.0;
    if (type < 0.5) {
      // PAPER SLIP: a tall outline with three lines of "writing"
      icon = outline(rect(p, vec2(0.36, 0.52)), w);
      icon = max(icon, bar(p, -0.24, -0.20, 0.20, w));
      icon = max(icon, bar(p,  0.00, -0.20, 0.20, w));
      icon = max(icon, bar(p,  0.24, -0.20, 0.02, w));
    } else if (type < 1.5) {
      // CHAT BUBBLE: a wide outline, a small tail, two lines of text
      icon = outline(rect(p - vec2(0.0, -0.08), vec2(0.54, 0.34)), w);
      icon = max(icon, fill(rect(p - vec2(-0.30, 0.36), vec2(0.06, 0.10))));
      icon = max(icon, bar(p, -0.18, -0.34, 0.34, w));
      icon = max(icon, bar(p,  0.02, -0.34, 0.08, w));
    } else if (type < 2.5) {
      // SPREADSHEET CELLS: an outline cut by two horizontal and two vertical lines
      icon = outline(rect(p, vec2(0.54, 0.44)), w);
      icon = max(icon, bar(p, -0.15, -0.54, 0.54, w * 0.8));
      icon = max(icon, bar(p,  0.15, -0.54, 0.54, w * 0.8));
      icon = max(icon, post(p, -0.18, -0.44, 0.44, w * 0.8));
      icon = max(icon, post(p,  0.18, -0.44, 0.44, w * 0.8));
    } else {
      // STICKY NOTE: a solid square with the bottom-right corner cut off
      float d = rect(p, vec2(0.46));
      d = max(d, (p.x + p.y - 0.62) * 0.7071);
      icon = fill(d);
    }

    // The frame of the grid cell fades in during the last part of the lock: "it has a place now".
    float frame = outline(rect(p, vec2(0.86)) - 0.08, 0.014) * smoothstep(0.6, 1.0, v_lock);

    // Loose = dim and a bit transparent. Locked = full cream. The accent piece is always orange.
    vec3  iconColor = isAccent ? u_colorAccent : mix(u_colorDim, u_colorText, v_lock);
    float iconAlpha = icon * mix(0.5, 1.0, v_lock);

    // Icon on top of frame. Colours are multiplied by alpha ("premultiplied"), which is what the
    // canvas expects for correct see-through edges.
    float alpha = iconAlpha + frame * (1.0 - iconAlpha);
    vec3  color = iconColor * iconAlpha + u_colorLine * frame * (1.0 - iconAlpha);
    gl_FragColor = vec4(color, alpha);
  }
`;
