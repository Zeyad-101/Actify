// Code-generated 32x32 pixel-art character for Actify.
// Pure SVG, <rect> only, shape-rendering="crispEdges". No external assets.
// Same option shape as before: skin, hairStyle, hairColor, eyes, shirt,
// pants, shoes, accessory.

const SKIN_COLORS = {
  light:       '#f4c8a8',
  mediumLight: '#d9a578',
  medium:      '#b07d4f',
  dark:        '#6b4327',
};

const HAIR_COLORS = {
  black:    '#1a1a1a',
  brown:    '#6b3a1f',
  blonde:   '#e8c46b',
  auburn:   '#8b2c1c',
  platinum: '#f0ead6',
  red:      '#c34a36',
};

const DEFAULT_SHIRT = '#4a90e2';
const DEFAULT_PANTS = '#3a3a3a';
const DEFAULT_SHOES = '#1a1a1a';
const INK            = '#1a1a1a';
const SPARKLE        = '#ffffff';

// ---- color helpers ----
function shade(hex, by) {
  const c = hex.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(c.slice(0, 2), 16) + by));
  const g = Math.max(0, Math.min(255, parseInt(c.slice(2, 4), 16) + by));
  const b = Math.max(0, Math.min(255, parseInt(c.slice(4, 6), 16) + by));
  return '#' + r.toString(16).padStart(2, '0')
             + g.toString(16).padStart(2, '0')
             + b.toString(16).padStart(2, '0');
}

// ---- body: head, neck, shirt, pants, shoes ----
// Head is chibi-large: 18 wide x 14 tall. The body is shorter and slightly
// narrower in the legs to keep the figure top-heavy and friendly.
function baseLayers(skin, shirt, pants, shoes) {
  const shirtDark = shade(shirt, -35);
  const pantsDark = shade(pants, -30);
  return [
    // Head (face)
    { x: 7,  y: 4,  w: 18, h: 14, fill: skin },
    // Neck (1 row between head and shirt)
    { x: 13, y: 18, w: 6,  h: 1,  fill: skin },
    // Shirt
    { x: 6,  y: 19, w: 20, h: 6,  fill: shirt },
    // Shirt shade (bottom 2 rows)
    { x: 6,  y: 23, w: 20, h: 2,  fill: shirtDark },
    // Pants (slightly narrower than shirt)
    { x: 7,  y: 25, w: 18, h: 4,  fill: pants },
    // Pants shade (bottom row)
    { x: 7,  y: 28, w: 18, h: 1,  fill: pantsDark },
    // Shoes
    { x: 7,  y: 29, w: 8,  h: 3,  fill: shoes },
    { x: 17, y: 29, w: 8,  h: 3,  fill: shoes },
  ];
}

// ---- hair: short / long / spiky ----
function hairLayer(style, color, highlight) {
  if (style === 'long') {
    return [
      { x: 9,  y: 0,  w: 14, h: 1, fill: color },
      { x: 7,  y: 1,  w: 18, h: 1, fill: color },
      { x: 6,  y: 2,  w: 20, h: 4, fill: color },
      { x: 9,  y: 6,  w: 14, h: 1, fill: color },
      { x: 6,  y: 6,  w: 2,  h: 12, fill: color },
      { x: 24, y: 6,  w: 2,  h: 12, fill: color },
      { x: 11, y: 0,  w: 5,  h: 1, fill: highlight },
      { x: 9,  y: 1,  w: 7,  h: 1, fill: highlight },
    ];
  }
  if (style === 'spiky') {
    return [
      { x: 7,  y: 2, w: 3, h: 3, fill: color },
      { x: 10, y: 1, w: 3, h: 4, fill: color },
      { x: 13, y: 2, w: 3, h: 3, fill: color },
      { x: 16, y: 1, w: 3, h: 4, fill: color },
      { x: 19, y: 2, w: 3, h: 3, fill: color },
      { x: 22, y: 2, w: 3, h: 3, fill: color },
      { x: 7,  y: 5, w: 18, h: 2, fill: color },
      { x: 10, y: 7, w: 3,  h: 1, fill: color },
      { x: 14, y: 7, w: 3,  h: 1, fill: color },
      { x: 18, y: 7, w: 3,  h: 1, fill: color },
      { x: 10, y: 1, w: 1,  h: 2, fill: highlight },
      { x: 16, y: 1, w: 1,  h: 2, fill: highlight },
    ];
  }
  // short (default)
  return [
    { x: 8,  y: 1,  w: 16, h: 1, fill: color },
    { x: 7,  y: 2,  w: 18, h: 3, fill: color },
    // Short sideburns on the cheeks
    { x: 7,  y: 5,  w: 2,  h: 3, fill: color },
    { x: 23, y: 5,  w: 2,  h: 3, fill: color },
    // Two front bangs
    { x: 10, y: 5,  w: 4,  h: 1, fill: color },
    { x: 18, y: 5,  w: 4,  h: 1, fill: color },
    // Highlight strip
    { x: 11, y: 1,  w: 5,  h: 1, fill: highlight },
    { x: 10, y: 2,  w: 7,  h: 1, fill: highlight },
  ];
}

// ---- eyebrows ----
// 3-wide blocks in the hair color, one row above the glasses frame
// (y=9) and below the lowest hair row (y=7 for spiky bangs, y=5 for
// short, y=6 for long) — so they never collide with either.
function eyebrowsLayer(hairColor) {
  return [
    { x: 10, y: 8, w: 3, h: 1, fill: hairColor },
    { x: 18, y: 8, w: 3, h: 1, fill: hairColor },
  ];
}

// ---- eyes ----
// All three styles share the same y-center (~row 10-11) so the glasses
// lenses line up regardless of which style is chosen. Normal and wide
// eyes get a 1x1 white sparkle in the top-left corner so they don't
// read as solid featureless blocks; happy eyes are a closed line and
// don't need one.
function eyesLayer(style) {
  if (style === 'happy') {
    return [
      { x: 11, y: 11, w: 3, h: 1, fill: INK },
      { x: 18, y: 11, w: 3, h: 1, fill: INK },
    ];
  }
  if (style === 'wide') {
    return [
      { x: 10, y: 10, w: 3, h: 2, fill: INK },
      { x: 19, y: 10, w: 3, h: 2, fill: INK },
      { x: 10, y: 10, w: 1, h: 1, fill: SPARKLE },
      { x: 19, y: 10, w: 1, h: 1, fill: SPARKLE },
    ];
  }
  // normal (default) — 2x2 with a sparkle in the top-left
  return [
    { x: 11, y: 10, w: 2, h: 2, fill: INK },
    { x: 19, y: 10, w: 2, h: 2, fill: INK },
    { x: 11, y: 10, w: 1, h: 1, fill: SPARKLE },
    { x: 19, y: 10, w: 1, h: 1, fill: SPARKLE },
  ];
}

// ---- mouth: connected smile (corners at y=14, 4-wide center at y=15) ----
function mouth() {
  return [
    { x: 13, y: 14, w: 1, h: 1, fill: INK },
    { x: 18, y: 14, w: 1, h: 1, fill: INK },
    { x: 14, y: 15, w: 4, h: 1, fill: INK },
  ];
}

// ---- glasses ----
// Two hollow 6x5 lenses centered on the eye positions (left lens at
// x=9-14, right lens at x=17-22, both rows 9-13) joined by a 2-pixel
// bridge at row 11. Verified to frame the eyes for all three eye styles:
// normal (2x3) and wide (3x3) sit in the lens interior, happy (1-tall
// line) sits at the lens vertical midpoint.
function glasses() {
  return [
    // Left lens — 4 rects for the border
    { x: 9,  y: 9,  w: 6, h: 1, fill: INK },  // top
    { x: 9,  y: 13, w: 6, h: 1, fill: INK },  // bottom
    { x: 9,  y: 9,  w: 1, h: 5, fill: INK },  // left
    { x: 14, y: 9,  w: 1, h: 5, fill: INK },  // right
    // Right lens
    { x: 17, y: 9,  w: 6, h: 1, fill: INK },
    { x: 17, y: 13, w: 6, h: 1, fill: INK },
    { x: 17, y: 9,  w: 1, h: 5, fill: INK },
    { x: 22, y: 9,  w: 1, h: 5, fill: INK },
    // Bridge between the lenses at the eye-line
    { x: 15, y: 11, w: 2, h: 1, fill: INK },
  ];
}

// ---- cap ----
// Drawn after the hair so it fully covers the top of the head. Wide dome
// (rows 0-6), darker band at row 7, brim sticking forward at row 8 — all
// within the hair region (rows 0-7 for short/spiky, 0-7 for long's top),
// so no hair pokes out above or between the cap and the head.
function cap() {
  const color = '#c34a36';
  const dark  = '#8b2c1c';
  return [
    { x: 9,  y: 0,  w: 14, h: 1, fill: color },
    { x: 8,  y: 1,  w: 16, h: 1, fill: color },
    { x: 7,  y: 2,  w: 18, h: 1, fill: color },
    { x: 6,  y: 3,  w: 20, h: 4, fill: color },
    { x: 6,  y: 7,  w: 20, h: 1, fill: dark  },  // band
    { x: 5,  y: 8,  w: 22, h: 1, fill: dark  },  // brim
  ];
}

// ---- main entry point ----
window.renderCharacter = function renderCharacter(containerEl, options) {
  const opts = options || {};
  const skin      = SKIN_COLORS[opts.skin]      || SKIN_COLORS.medium;
  const hairColor = HAIR_COLORS[opts.hairColor] || HAIR_COLORS.brown;
  const shirt     = opts.shirt  || DEFAULT_SHIRT;
  const pants     = opts.pants  || DEFAULT_PANTS;
  const shoes     = opts.shoes  || DEFAULT_SHOES;
  const hairStyle = opts.hairStyle || 'short';
  const eyes      = opts.eyes     || 'normal';
  const accessory = opts.accessory || 'none';

  const hairHighlight = shade(hairColor, 30);

  const layers = [
    ...baseLayers(skin, shirt, pants, shoes),
    ...hairLayer(hairStyle, hairColor, hairHighlight),
    ...eyebrowsLayer(hairColor),
    ...eyesLayer(eyes),
    ...mouth(),
  ];
  if (accessory === 'glasses') layers.push(...glasses());
  if (accessory === 'cap')     layers.push(...cap());

  while (containerEl.firstChild) containerEl.removeChild(containerEl.firstChild);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', '200');
  svg.setAttribute('height', '200');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.style.imageRendering = 'pixelated';
  svg.setAttribute('aria-hidden', 'true');

  for (const layer of layers) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', layer.x);
    rect.setAttribute('y', layer.y);
    rect.setAttribute('width', layer.w);
    rect.setAttribute('height', layer.h);
    rect.setAttribute('fill', layer.fill);
    svg.appendChild(rect);
  }

  containerEl.appendChild(svg);
};
