// ============================================================
// DEMOLITION LAB — combined bundle
// Order: materials/structures → districts → weapons → disasters → main
// ============================================================

// ─── MATERIALS ───────────────────────────────────────────────────────────────
const MATERIALS = {
  // bondStr = how many px of stretch a bond between two of this material can take before breaking
  // Tuned LOW — structures should fall apart easily on impact.
  concrete: { fillStyle: '#b9bfc6', strokeStyle: '#7d848d', density: 0.008, friction: 1.0,  frictionStatic: 10, restitution: 0.0, bondStr: 32 },
  steel:    { fillStyle: '#5a6473', strokeStyle: '#3a4250', density: 0.014, friction: 0.95, frictionStatic: 10, restitution: 0.0, bondStr: 50 },
  wood:     { fillStyle: '#c98a4b', strokeStyle: '#8a5a2a', density: 0.005, friction: 1.0,  frictionStatic: 10, restitution: 0.0, bondStr: 22 },
  glass:    { fillStyle: 'rgba(124, 198, 255, 0.5)', strokeStyle: '#7cc6ff', density: 0.004, friction: 0.9, frictionStatic: 10, restitution: 0.0, bondStr: 8 },
  brick:    { fillStyle: '#a04d3a', strokeStyle: '#6a2f24', density: 0.007, friction: 1.0,  frictionStatic: 10, restitution: 0.0, bondStr: 24 },
  stone:    { fillStyle: '#8a8478', strokeStyle: '#5a564d', density: 0.011, friction: 1.0,  frictionStatic: 10, restitution: 0.0, bondStr: 38 },
  gold:     { fillStyle: '#e3b04b', strokeStyle: '#8c6a1f', density: 0.018, friction: 0.9,  frictionStatic: 10, restitution: 0.0, bondStr: 42 }
};

// ─── BLOCK FACTORIES ─────────────────────────────────────────────────────────
function makeBlock(x, y, w, h, mat, opts = {}) {
  const m = MATERIALS[mat];
  return Matter.Bodies.rectangle(x, y, w, h, {
    density: m.density,
    friction: m.friction,
    frictionStatic: m.frictionStatic,
    restitution: m.restitution,
    slop: 0.04,
    sleepThreshold: 80,
    render: { fillStyle: m.fillStyle, strokeStyle: m.strokeStyle, lineWidth: 1 },
    label: 'block',
    plugin: { material: mat },
    ...opts
  });
}

function makePoly(x, y, sides, radius, mat, opts = {}) {
  const m = MATERIALS[mat];
  return Matter.Bodies.polygon(x, y, sides, radius, {
    density: m.density,
    friction: m.friction,
    frictionStatic: m.frictionStatic,
    restitution: m.restitution,
    slop: 0.04,
    sleepThreshold: 80,
    render: { fillStyle: m.fillStyle, strokeStyle: m.strokeStyle, lineWidth: 1 },
    label: 'block',
    plugin: { material: mat },
    ...opts
  });
}

// Split each block into smaller sub-blocks so structures have more granularity.
// Bigger originals get a finer subdivision. Polys and tiny pieces are left alone.
// `level` (default 1) scales the subdivision aggressiveness: 0 = no splits,
// 1 = original behaviour, 2+ = much finer.
function subdivideCluster(bodies, level = 1, groundY = null) {
  if (level <= 0) return bodies;
  const out = [];
  // Higher level → smaller thresholds → more splits
  const t1 = 22 / level;
  const t2 = 40 / level;
  bodies.forEach(b => {
    if (!b.position || b.label !== 'block') { out.push(b); return; }
    if (b.vertices && b.vertices.length !== 4) { out.push(b); return; }
    // Skip subdivision for foundation-layer blocks so structures stay upright
    // at spawn. Anything within ~80px of the ground is treated as a foundation.
    if (groundY != null && b.bounds && (groundY - b.bounds.max.y) < 80) {
      out.push(b); return;
    }
    const w = b.bounds.max.x - b.bounds.min.x;
    const h = b.bounds.max.y - b.bounds.min.y;
    if (w < Math.max(8, t1*0.6) && h < Math.max(8, t1*0.6)) { out.push(b); return; }
    const cols = w >= t2 ? Math.min(4, Math.round(w/t1)) : (w >= t1 ? 2 : 1);
    const rows = h >= t2 ? Math.min(4, Math.round(h/t1)) : (h >= t1 ? 2 : 1);
    if (cols === 1 && rows === 1) { out.push(b); return; }
    const cx = b.position.x, cy = b.position.y;
    const ang = b.angle || 0;
    const mat = b.plugin?.material || 'concrete';
    const gap = 0.4;
    const sw = (w - (cols-1)*gap) / cols;
    const sh = (h - (rows-1)*gap) / rows;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lx = -w/2 + sw/2 + c*(sw + gap);
        const ly = -h/2 + sh/2 + r*(sh + gap);
        const ox = lx*ca - ly*sa;
        const oy = lx*sa + ly*ca;
        const sub = makeBlock(cx + ox, cy + oy, sw, sh, mat);
        if (ang) Matter.Body.setAngle(sub, ang);
        out.push(sub);
      }
    }
  });
  return out;
}

// ─── STRUCTURES ──────────────────────────────────────────────────────────────
const STRUCTURES = [
  // ---- towers ----
  {
    id: 'tower', name: 'TOWER', glyph: '▮', desc: '14 floors · concrete',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bw = 32, bh = 20, floors = 14, cols = 5;
      const bodies = [];
      for (let f = 0; f < floors; f++)
        for (let c = 0; c < cols; c++)
          bodies.push(makeBlock(centerX - (cols-1)*bw/2 + c*bw, groundY - bh/2 - f*bh, bw, bh, f%4===0?'steel':'concrete'));
      return bodies;
    }
  },
  {
    id: 'skyscraper', name: 'SKYSCRAPER', glyph: '▌', desc: '16 floors · steel core',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [];
      const padW = 150, padH = 22;
      bodies.push(makeBlock(centerX, groundY - padH/2, padW, padH, 'steel'));
      bodies.push(makeBlock(centerX, groundY - padH - 5, padW - 10, 10, 'steel'));
      const bw = 28, bh = 20, cols = 4, floors = 16;
      const baseY = groundY - padH - 10;
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          let mat;
          if (f === floors-1 || f%5 === 4) mat = 'steel';
          else if (c === 0 || c === cols-1) mat = 'concrete';
          else mat = 'glass';
          bodies.push(makeBlock(centerX - (cols-1)*bw/2 + c*bw, baseY - bh/2 - f*bh, bw, bh, mat));
        }
      }
      const crownY = baseY - floors*bh;
      bodies.push(makeBlock(centerX, crownY - 6, cols*bw - 8, 12, 'steel'));
      bodies.push(makeBlock(centerX, crownY - 12 - 40, 4, 70, 'steel'));
      return bodies;
    }
  },
  {
    id: 'apartments', name: 'APARTMENTS', glyph: '▦', desc: 'brick · window grid',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bw = 26, bh = 22, cols = 9, rows = 8;
      const bodies = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const isWindow = (c%2===1) && (r%2===1) && r < rows-1;
          bodies.push(makeBlock(centerX - (cols-1)*bw/2 + c*bw, groundY - bh/2 - r*bh, bw, bh, isWindow?'glass':'brick'));
        }
      return bodies;
    }
  },
  // ---- castle ----
  {
    id: 'castle', name: 'CASTLE', glyph: '⛫', desc: 'walls + battlements',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [];
      const wallH = 18, wallW = 32, towerOffset = 130;
      for (let s = -1; s <= 1; s += 2)
        for (let i = 0; i < 10; i++)
          bodies.push(makeBlock(centerX + s*towerOffset, groundY - wallH/2 - i*wallH, wallW, wallH, 'brick'));
      const beamY = groundY - 10*wallH - 8;
      bodies.push(makeBlock(centerX, beamY, towerOffset*2 + wallW + 10, 16, 'wood'));
      for (let i = 0; i < 6; i++)
        bodies.push(makeBlock(centerX - 100 + i*40, beamY - 8 - 14, 22, 28, 'brick'));
      return bodies;
    }
  },
  {
    id: 'cathedral', name: 'CATHEDRAL', glyph: '✟', desc: 'columns + spire',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [];
      const colH = 22, colW = 22, cols = 5, colSpacing = 60, colStacks = 9;
      // Reinforced plinths — two layers of wider stone under each column
      const plinthH = 16, plinthW = colW + 18;
      for (let k = 0; k < cols; k++) {
        const cx = centerX + (k - (cols-1)/2)*colSpacing;
        bodies.push(makeBlock(cx, groundY - plinthH/2,           plinthW,     plinthH, 'stone'));
        bodies.push(makeBlock(cx, groundY - plinthH - plinthH/2, plinthW - 6, plinthH, 'stone'));
        for (let i = 0; i < colStacks; i++)
          bodies.push(makeBlock(cx, groundY - plinthH*2 - colH/2 - i*colH, colW, colH, 'stone'));
      }
      const beamY = groundY - plinthH*2 - colStacks*colH - 10;
      bodies.push(makeBlock(centerX, beamY, (cols-1)*colSpacing + colW + 20, 20, 'stone'));
      let spireY = beamY - 10 - 12, w = 70;
      for (let i = 0; i < 7; i++) { bodies.push(makeBlock(centerX, spireY, w, 22, 'stone')); spireY -= 22; w -= 8; }
      bodies.push(makeBlock(centerX, spireY - 14, 4, 28, 'gold'));
      bodies.push(makeBlock(centerX, spireY - 14, 16, 4, 'gold'));
      return bodies;
    }
  },
  {
    id: 'house', name: 'HOUSE', glyph: '⌂', desc: 'brick walls · peak roof',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [];
      const bw = 24, bh = 22;
      for (let i = 0; i < 6; i++) {
        bodies.push(makeBlock(centerX - 80, groundY - bh/2 - i*bh, bw, bh, 'brick'));
        bodies.push(makeBlock(centerX + 80, groundY - bh/2 - i*bh, bw, bh, 'brick'));
      }
      for (let i = 1; i < 6; i++)
        for (let c = -2; c <= 2; c++) {
          if (i === 1 && Math.abs(c) <= 1) continue;
          bodies.push(makeBlock(centerX + c*bw, groundY - bh/2 - i*bh, bw, bh, 'brick'));
        }
      const ceilY = groundY - 6*bh - 6;
      for (let c = -3; c <= 3; c++) bodies.push(makeBlock(centerX + c*bw, ceilY, bw, 10, 'wood'));
      let rw = 7*bw, ry = ceilY - 16;
      for (let i = 0; i < 5; i++) { bodies.push(makeBlock(centerX, ry, rw, 14, 'wood')); rw -= 24; ry -= 14; }
      for (let i = 0; i < 3; i++) bodies.push(makeBlock(centerX + 50, ceilY - 22 - i*18, 16, 18, 'brick'));
      return bodies;
    }
  },
  // ---- ancient ----
  {
    id: 'pyramid', name: 'PYRAMID', glyph: '▲', desc: 'stacked stone',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bw = 36, bh = 22, rows = 11;
      const bodies = [];
      for (let r = 0; r < rows; r++) {
        const count = rows - r;
        for (let c = 0; c < count; c++)
          bodies.push(makeBlock(centerX - (count-1)*bw/2 + c*bw, groundY - bh/2 - r*bh, bw, bh, 'stone'));
      }
      return bodies;
    }
  },
  {
    id: 'stonehenge', name: 'STONEHENGE', glyph: '∏', desc: 'trilithon ring',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [];
      const N = 5, sep = 38;
      for (let i = 0; i < N; i++) {
        const t = i/(N-1), a = -Math.PI*0.275 + t*Math.PI*0.55 - Math.PI/2;
        const x = centerX + Math.cos(a)*88;
        // Reinforced foundation stones — wider base under each upright
        bodies.push(makeBlock(x - sep, groundY - 8, 42, 16, 'stone'));
        bodies.push(makeBlock(x + sep, groundY - 8, 42, 16, 'stone'));
        bodies.push(makeBlock(x - sep, groundY - 16 - 50, 26, 100, 'stone'));
        bodies.push(makeBlock(x + sep, groundY - 16 - 50, 26, 100, 'stone'));
        bodies.push(makeBlock(x,       groundY - 16 - 112, sep*2 + 26, 22, 'stone'));
      }
      return bodies;
    }
  },
  {
    id: 'pagoda', name: 'PAGODA', glyph: '⛩', desc: 'tiered tower',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [];
      const tiers = 6, colH = 40, roofH = 12;
      // Reinforced stone foundation slab
      bodies.push(makeBlock(centerX, groundY - 10, 220, 20, 'stone'));
      let y = groundY - 20;
      for (let t = 0; t < tiers; t++) {
        const tw = 180 - t*22, colW = tw/3 - 4; // thicker columns
        for (let c = -1; c <= 1; c++)
          bodies.push(makeBlock(centerX + c*(tw/3), y - colH/2, colW, colH, 'wood'));
        bodies.push(makeBlock(centerX, y - colH - roofH/2, tw + 14, roofH, t===tiers-1?'stone':'wood'));
        y -= colH + roofH;
      }
      bodies.push(makeBlock(centerX, y - 16, 4, 32, 'gold'));
      return bodies;
    }
  },
  // ---- stacks / classic ----
  {
    id: 'dominoes', name: 'DOMINOES', glyph: '▥', desc: 'long row · chain',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [], count = 24, spacing = 22;
      for (let i = 0; i < count; i++)
        bodies.push(makeBlock(centerX - (count-1)*spacing/2 + i*spacing, groundY - 36, 6, 68, i%4===0?'steel':'wood'));
      return bodies;
    }
  },
  {
    id: 'jenga', name: 'JENGA', glyph: '☰', desc: 'alternating beams',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [], layers = 16, blockL = 90, blockW = 30, seg = blockL/3;
      for (let i = 0; i < layers; i++) {
        const y = groundY - blockW/2 - i*blockW;
        if (i%2===0) {
          for (let k = -1; k <= 1; k++) bodies.push(makeBlock(centerX + k*seg, y, seg, blockW, 'wood'));
        } else {
          const mw = MATERIALS.wood;
          for (let k = -1; k <= 1; k++)
            bodies.push(Matter.Bodies.rectangle(centerX + k*seg, y, blockW, seg, {
              density: mw.density, friction: mw.friction, frictionStatic: mw.frictionStatic,
              restitution: 0, slop: 0.005,
              render: { fillStyle: mw.fillStyle, strokeStyle: mw.strokeStyle, lineWidth: 1 },
              label: 'block', plugin: { material: 'wood' }
            }));
        }
      }
      return bodies;
    }
  },
  {
    id: 'wall', name: 'BRICK WALL', glyph: '▤', desc: 'offset masonry',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [], bw = 44, bh = 18, cols = 12, rows = 12;
      for (let r = 0; r < rows; r++) {
        const offset = (r%2)*(bw/2);
        for (let c = 0; c < cols; c++)
          bodies.push(makeBlock(centerX - (cols-1)*bw/2 + c*bw + offset - bw/4, groundY - bh/2 - r*bh, bw, bh, 'brick'));
      }
      return bodies;
    }
  },
  {
    id: 'glass', name: 'GLASS HOUSE', glyph: '◫', desc: 'fragile · pretty',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [], cols = 8, rows = 9, bw = 30, bh = 24;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const isFrame = (r===0 || r===rows-1 || c===0 || c===cols-1);
          bodies.push(makeBlock(centerX - (cols-1)*bw/2 + c*bw, groundY - bh/2 - r*bh, bw, bh, isFrame?'steel':'glass'));
        }
      return bodies;
    }
  },
  // ---- silo / industrial ----
  {
    id: 'smokestack', name: 'SMOKESTACK', glyph: '╿', desc: 'industrial column',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [], rings = 16, ringH = 20;
      bodies.push(makeBlock(centerX, groundY - 14, 130, 28, 'brick'));
      for (let i = 0; i < rings; i++)
        bodies.push(makeBlock(centerX, groundY - 28 - ringH/2 - i*ringH, 80 - i*2.5, ringH, 'brick'));
      bodies.push(makeBlock(centerX, groundY - 28 - rings*ringH - 8, 60, 16, 'steel'));
      return bodies;
    }
  },
  {
    id: 'silo', name: 'GRAIN SILOS', glyph: '◯', desc: 'cluster · domed tops',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [];

      // Shared concrete foundation slab tying the silos together
      bodies.push(makeBlock(centerX, groundY - 8, 380, 16, 'concrete'));
      const baseY = groundY - 16;

      // Three silos of different heights & widths
      const silos = [
        { x: centerX - 120, r: 28, layers: 6 },  // wide, medium
        { x: centerX,       r: 22, layers: 9 },  // tall, slim
        { x: centerX + 110, r: 26, layers: 7 }   // medium
      ];

      silos.forEach(s => {
        const step = s.r * Math.sqrt(3);
        for (let i = 0; i < s.layers; i++) {
          bodies.push(makePoly(s.x, baseY - step/2 - i*step, 6, s.r, 'concrete'));
        }
        // Steel dome — tapering hexes form a conical roof
        const topY = baseY - s.layers*step;
        bodies.push(makePoly(s.x, topY - step*0.4, 6, s.r*0.72, 'steel'));
        bodies.push(makePoly(s.x, topY - step*0.85, 6, s.r*0.42, 'steel'));
        // Vent pipe on top
        bodies.push(makeBlock(s.x, topY - step*0.85 - 10, 4, 14, 'steel'));
      });

      // Small attached pump-house between the two left silos
      const phX = (silos[0].x + silos[1].x) / 2;
      const phY = baseY - 22;
      bodies.push(makeBlock(phX - 22, phY,       6, 44, 'brick'));
      bodies.push(makeBlock(phX + 22, phY,       6, 44, 'brick'));
      bodies.push(makeBlock(phX,      phY - 24,  50, 6, 'steel'));
      bodies.push(makeBlock(phX,      phY,       38, 6, 'wood'));

      // Steel conveyor / pipe linking middle silo to right silo at the top
      const linkY1 = baseY - silos[1].layers * silos[1].r * Math.sqrt(3) + 14;
      const linkY2 = baseY - silos[2].layers * silos[2].r * Math.sqrt(3) + 14;
      const linkY  = (linkY1 + linkY2) / 2;
      const linkX  = (silos[1].x + silos[2].x) / 2;
      const linkW  = (silos[2].x - silos[1].x) - 20;
      const pipe   = makeBlock(linkX, linkY, linkW, 8, 'steel');
      Matter.Body.setAngle(pipe, Math.atan2(linkY2 - linkY1, silos[2].x - silos[1].x));
      bodies.push(pipe);

      return bodies;
    }
  },
  // ---- bridge ----
  {
    id: 'bridge', name: 'ARCH BRIDGE', glyph: '⌒', desc: 'wedged stones',
    build(state) {
      const { groundY, centerX } = state.arena;
      const bodies = [];
      // Reinforced foundation under each pier
      for (let s = -1; s <= 1; s += 2) {
        bodies.push(makeBlock(centerX + s*140, groundY - 10, 70, 20, 'stone'));
        for (let i = 0; i < 5; i++)
          bodies.push(makeBlock(centerX + s*140, groundY - 20 - 17 - i*34, 46, 34, 'stone'));
      }
      const segs = 13, r = 150, cy = groundY - 190;
      for (let i = 0; i < segs; i++) {
        const t = i/(segs-1), a = Math.PI + t*Math.PI;
        const b = makeBlock(centerX + Math.cos(a)*r, cy + Math.sin(a)*r*0.6, 32, 28, 'stone');
        Matter.Body.setAngle(b, a - Math.PI/2);
        bodies.push(b);
      }
      for (let i = 0; i < 11; i++)
        bodies.push(makeBlock(centerX - 110 + i*22, groundY - 230, 22, 10, 'wood'));
      return bodies;
    }
  }
];

// ─── DISTRICTS ───────────────────────────────────────────────────────────────
function _rnd(a, b) { return a + Math.random()*(b-a); }
function _rint(a, b) { return a + Math.floor(Math.random()*(b-a+1)); }
function _pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function buildDistrictTower(cx, gy, opts) {
  const { floors, baseW, mainMat, bh=20, taper=0.015, podiumChance=0.4, antennaChance=0.4, penthouseChance=0.3 } = opts;
  const bodies = [];
  const hasPodium = Math.random() < podiumChance;
  let topSlab = null;
  for (let f = 0; f < floors; f++) {
    const t = f/Math.max(1, floors-1);
    const isPodium = hasPodium && f < 2;
    const w = baseW*(isPodium ? 1.25 : (1 - t*taper*floors));
    let mat = mainMat;
    if (mainMat==='concrete' && f>1 && Math.random()<0.35) mat='glass';
    else if (mainMat==='steel' && f>1 && Math.random()<0.4) mat='glass';
    if (f===0) mat='steel';
    const slab = makeBlock(cx, gy - bh/2 - f*bh, w, bh, mat);
    bodies.push(slab);
    topSlab = slab;
  }
  if (topSlab) {
    const tx = topSlab.position.x, ty = topSlab.position.y;
    const tw = topSlab.bounds.max.x - topSlab.bounds.min.x;
    const roll = Math.random();
    if (roll < antennaChance) {
      const mastH = 50 + Math.random()*40;
      bodies.push(makeBlock(tx, ty - bh/2 - mastH/2, 4, mastH, 'steel'));
    } else if (roll < antennaChance + penthouseChance) {
      bodies.push(makeBlock(tx, ty - bh/2 - 12, tw*0.5, 24, 'concrete'));
    } else {
      const drumW = tw*0.4, drumH = 22, legH = 14;
      bodies.push(makeBlock(tx - drumW*0.3, ty - bh/2 - legH/2, 5, legH, 'steel'));
      bodies.push(makeBlock(tx + drumW*0.3, ty - bh/2 - legH/2, 5, legH, 'steel'));
      bodies.push(makeBlock(tx, ty - bh/2 - legH - drumH/2, drumW, drumH, 'concrete'));
    }
  }
  return bodies;
}

function buildDistrictHouse(cx, gy, opts) {
  const { w=90, h=70, mat='wood' } = opts;
  const bodies = [];
  const wallH = h - 12;
  bodies.push(makeBlock(cx, gy - 8, w, 12, 'wood'));
  bodies.push(makeBlock(cx - w/2 + 8, gy - 12 - wallH/2, 14, wallH, mat));
  bodies.push(makeBlock(cx + w/2 - 8, gy - 12 - wallH/2, 14, wallH, mat));
  bodies.push(makeBlock(cx, gy - 12 - wallH/4, w - 28, wallH/2, mat));
  bodies.push(makeBlock(cx, gy - 12 - wallH - 6, w - 2, 10, 'wood'));
  bodies.push(makeBlock(cx, gy - 12 - wallH - 18, w*0.85, 12, 'wood'));
  bodies.push(makeBlock(cx, gy - 12 - wallH - 30, w*0.5, 12, 'wood'));
  return bodies;
}

function buildDistrictFactory(cx, gy, opts) {
  const { w=140, mat='brick' } = opts;
  const bodies = [];
  const wallH = 70, stackH = 130, ringH = 18;
  bodies.push(makeBlock(cx, gy - 6, w, 12, 'steel'));
  bodies.push(makeBlock(cx - w/2 + 8, gy - 12 - wallH/2, 16, wallH, mat));
  bodies.push(makeBlock(cx + w/2 - 8, gy - 12 - wallH/2, 16, wallH, mat));
  bodies.push(makeBlock(cx, gy - 12 - wallH - 6, w - 4, 10, 'steel'));
  const stackX = cx + w/4;
  const rings = Math.floor(stackH/ringH);
  for (let i = 0; i < rings; i++)
    bodies.push(makeBlock(stackX, gy - 12 - wallH - 12 - ringH/2 - i*ringH, 38 - i*1.5, ringH, 'brick'));
  return bodies;
}

// Small auxiliary structures used to fill out districts
function buildDistrictShop(cx, gy, opts = {}) {
  const { w = 70, h = 50, mat = 'brick' } = opts;
  const bodies = [];
  // Shop wall + flat roof
  bodies.push(makeBlock(cx, gy - 6, w, 12, 'concrete'));               // foundation
  bodies.push(makeBlock(cx - w/2 + 6, gy - 12 - h/2, 12, h, mat));      // left wall
  bodies.push(makeBlock(cx + w/2 - 6, gy - 12 - h/2, 12, h, mat));      // right wall
  bodies.push(makeBlock(cx, gy - 12 - h/2 + 4, w - 28, h - 8, 'glass'));// store window
  bodies.push(makeBlock(cx, gy - 12 - h - 4, w + 4, 8, 'steel'));       // sign / canopy
  // Awning sign with a flag pole
  bodies.push(makeBlock(cx, gy - 12 - h - 18, 4, 22, 'steel'));
  return bodies;
}

function buildStorageTank(cx, gy, opts = {}) {
  const { r = 28, layers = 3 } = opts;
  const bodies = [];
  const step = r * Math.sqrt(3);
  bodies.push(makeBlock(cx, gy - 8, r*2 + 14, 16, 'concrete'));
  for (let i = 0; i < layers; i++)
    bodies.push(makePoly(cx, gy - 16 - step/2 - i*step, 6, r, 'steel'));
  // Domed top
  bodies.push(makePoly(cx, gy - 16 - layers*step, 6, r*0.65, 'steel'));
  return bodies;
}

function buildLampPost(cx, gy) {
  const bodies = [];
  bodies.push(makeBlock(cx, gy - 6, 14, 12, 'concrete')); // base
  bodies.push(makeBlock(cx, gy - 12 - 50, 4, 100, 'steel')); // post
  bodies.push(makeBlock(cx + 6, gy - 12 - 100, 16, 4, 'steel')); // arm
  bodies.push(makeBlock(cx + 12, gy - 12 - 96, 8, 8, 'gold')); // light
  return bodies;
}

function buildBillboard(cx, gy) {
  const bodies = [];
  bodies.push(makeBlock(cx - 8, gy - 35, 6, 70, 'steel'));
  bodies.push(makeBlock(cx + 8, gy - 35, 6, 70, 'steel'));
  bodies.push(makeBlock(cx, gy - 70 - 22, 90, 44, 'wood'));
  return bodies;
}

// Pyramid cluster — stacked stone, anchored at (cx, gy)
function buildPyramidCluster(cx, gy, opts = {}) {
  const { rows = 9, bw = 30, bh = 18 } = opts;
  const bodies = [];
  for (let r = 0; r < rows; r++) {
    const count = rows - r;
    for (let c = 0; c < count; c++)
      bodies.push(makeBlock(cx - (count-1)*bw/2 + c*bw, gy - bh/2 - r*bh, bw, bh, 'stone'));
  }
  return bodies;
}

// Greek temple — columns + entablature
function buildTempleCluster(cx, gy, opts = {}) {
  const { cols = 5, colStacks = 7, colH = 20, colW = 18, colSpacing = 42 } = opts;
  const bodies = [];
  // Plinth
  const plinthW = cols*colSpacing + 20;
  bodies.push(makeBlock(cx, gy - 8, plinthW, 16, 'stone'));
  // Columns
  for (let k = 0; k < cols; k++) {
    const x = cx + (k - (cols-1)/2)*colSpacing;
    for (let i = 0; i < colStacks; i++)
      bodies.push(makeBlock(x, gy - 16 - colH/2 - i*colH, colW, colH, 'stone'));
  }
  // Entablature
  const entY = gy - 16 - colStacks*colH - 10;
  bodies.push(makeBlock(cx, entY, plinthW - 4, 20, 'stone'));
  // Pediment
  bodies.push(makeBlock(cx, entY - 24, plinthW * 0.7, 14, 'stone'));
  bodies.push(makeBlock(cx, entY - 40, plinthW * 0.4, 12, 'stone'));
  return bodies;
}

// Ziggurat — stepped stone pyramid
function buildZigguratCluster(cx, gy, opts = {}) {
  const { steps = 5, stepH = 26 } = opts;
  const bodies = [];
  for (let i = 0; i < steps; i++) {
    const w = 180 - i*30;
    bodies.push(makeBlock(cx, gy - stepH/2 - i*stepH, w, stepH, 'brick'));
  }
  // Top shrine
  bodies.push(makeBlock(cx, gy - steps*stepH - 12, 50, 24, 'stone'));
  bodies.push(makeBlock(cx, gy - steps*stepH - 30, 4, 16, 'gold'));
  return bodies;
}

const DISTRICTS = [
  {
    id: 'downtown', name: 'DOWNTOWN', glyph: '▦', desc: 'dense skyline · 18 towers',
    build(state) {
      const W = state.W, gy = state.arena.groundY, bodies = [];
      const N = 18;
      for (let i = 0; i < N; i++) {
        const p = (i + 0.5) / N;
        const central = 1 - Math.abs(p - 0.5)*1.4;
        const floors = _rint(10, 14) + Math.round(central * 12);
        bodies.push(...buildDistrictTower(W*p, gy, {
          floors,
          baseW: _rnd(55, 90),
          mainMat: _pick(['concrete','steel','concrete','steel']),
          bh: 20, taper: 0.010
        }));
      }
      // Shops + lamp posts between towers
      [0.06, 0.165, 0.27, 0.39, 0.50, 0.605, 0.71, 0.82, 0.94].forEach((p, idx) => {
        if (idx % 2 === 0) bodies.push(...buildDistrictShop(W*p, gy, { w:_rnd(60,90), h:_rnd(40,65), mat:_pick(['brick','concrete']) }));
        else bodies.push(...buildLampPost(W*p, gy));
      });
      return bodies;
    }
  },
  {
    id: 'industrial', name: 'INDUSTRIAL', glyph: '⚙', desc: 'factories · tanks · stacks',
    build(state) {
      const W = state.W, gy = state.arena.groundY, bodies = [];
      const N = 14;
      for (let i = 0; i < N; i++) {
        const p = (i + 0.5) / N;
        const cx = W*p;
        const choice = i % 5;
        if      (choice === 0) bodies.push(...buildDistrictFactory(cx, gy, { w:_rnd(140,180), mat:'brick' }));
        else if (choice === 1) bodies.push(...buildDistrictTower(cx, gy,   { floors:_rint(7,11), baseW:_rnd(75,100), mainMat:'steel', bh:22 }));
        else if (choice === 2) bodies.push(...buildStorageTank(cx, gy, { r:_rnd(28,38), layers:_rint(3,5) }));
        else if (choice === 3) bodies.push(...buildDistrictFactory(cx, gy, { w:_rnd(120,160), mat:'concrete' }));
        else                   bodies.push(...buildStorageTank(cx, gy, { r:_rnd(24,30), layers:_rint(2,4) }));
      }
      [0.13, 0.42, 0.71].forEach(p => bodies.push(...buildBillboard(W*p, gy)));
      [0.08, 0.30, 0.55, 0.80].forEach(p => bodies.push(...buildLampPost(W*p, gy)));
      return bodies;
    }
  },
  {
    id: 'megapolis', name: 'MEGAPOLIS', glyph: '▮', desc: 'giant skyscrapers · 10 mega-towers',
    build(state) {
      const W = state.W, gy = state.arena.groundY, bodies = [];
      // 10 enormous towers, central ones tallest
      const N = 10;
      for (let i = 0; i < N; i++) {
        const p = (i + 0.5) / N;
        const central = 1 - Math.abs(p - 0.5)*1.2;
        const floors = _rint(22, 30) + Math.round(central * 14);
        bodies.push(...buildDistrictTower(W*p, gy, {
          floors,
          baseW: _rnd(90, 130),
          mainMat: _pick(['concrete','steel','steel','concrete']),
          bh: 22, taper: 0.006,
          antennaChance: 0.6, penthouseChance: 0.4
        }));
      }
      // Mid-rise infill between mega-towers
      for (let i = 0; i < N - 1; i++) {
        const p = (i + 1) / N;
        bodies.push(...buildDistrictTower(W*p, gy, {
          floors: _rint(6, 10), baseW: _rnd(50, 70),
          mainMat: _pick(['steel','concrete']), bh: 18, taper: 0.012,
          antennaChance: 0.3, penthouseChance: 0.4
        }));
      }
      return bodies;
    }
  },
  {
    id: 'ancient', name: 'ANCIENT', glyph: '△', desc: 'temples · pyramids · ziggurats',
    build(state) {
      const W = state.W, gy = state.arena.groundY, bodies = [];
      // Mix of ancient structures across the strip
      bodies.push(...buildPyramidCluster(W*0.10, gy, { rows: 10, bw: 32, bh: 20 }));
      bodies.push(...buildTempleCluster (W*0.28, gy, { cols: 6, colStacks: 8 }));
      bodies.push(...buildZigguratCluster(W*0.46, gy, { steps: 6 }));
      bodies.push(...buildTempleCluster (W*0.62, gy, { cols: 5, colStacks: 9, colSpacing: 50 }));
      bodies.push(...buildPyramidCluster(W*0.78, gy, { rows: 12, bw: 30, bh: 20 }));
      bodies.push(...buildZigguratCluster(W*0.93, gy, { steps: 5 }));
      // Stonehenge-style trilithons scattered between
      [0.19, 0.37, 0.55, 0.71, 0.86].forEach(p => {
        const cx = W*p;
        bodies.push(makeBlock(cx - 22, gy - 50, 14, 100, 'stone'));
        bodies.push(makeBlock(cx + 22, gy - 50, 14, 100, 'stone'));
        bodies.push(makeBlock(cx,      gy - 110, 60, 14, 'stone'));
      });
      return bodies;
    }
  }
];

// ─── WEAPON FX HELPERS ───────────────────────────────────────────────────────
function _wSub(a, b) { return { x: a.x-b.x, y: a.y-b.y }; }
function _wNorm(v) { const l=Math.hypot(v.x,v.y)||1; return { x:v.x/l, y:v.y/l }; }
function _distSq(a, b) { const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }

function _rayHitsBody(origin, dir, body) {
  const b = body.bounds;
  let tmin = -Infinity, tmax = Infinity;
  for (const axis of ['x','y']) {
    const inv = 1/(dir[axis]||1e-9);
    let t1 = (b.min[axis]-origin[axis])*inv, t2 = (b.max[axis]-origin[axis])*inv;
    if (t1>t2) [t1,t2]=[t2,t1];
    tmin = Math.max(tmin,t1); tmax = Math.min(tmax,t2);
    if (tmin>tmax) return false;
  }
  return tmax>0;
}

function _muzzle(state, from, dir) {
  for (let i = 0; i < 8; i++) {
    const spread = (Math.random()-0.5)*0.6;
    const c = Math.cos(spread), s = Math.sin(spread);
    state.addEffect({ kind:'spark', x:from.x, y:from.y,
      vx:(dir.x*c - dir.y*s)*(2+Math.random()*3),
      vy:(dir.x*s + dir.y*c)*(2+Math.random()*3),
      life:24, max:24, color:'#ffaa44' });
  }
}

function _explode(state, pos, radius, power) {
  // Cancel settle immunity on all bonds so a blast right after spawn still breaks things.
  state.bonds.forEach(c => { if (c._settle > 0) c._settle = 0; });
  Matter.Composite.allBodies(state.world).forEach(b => {
    if (b.isStatic) return;
    const d = _wSub(b.position, pos), dist = Math.hypot(d.x,d.y);
    if (dist > radius) return;
    const falloff = 1 - dist/radius, f = power*falloff*b.mass;
    const n = _wNorm(d);
    Matter.Body.applyForce(b, b.position, { x:n.x*f*0.05, y:n.y*f*0.05-0.002 });
  });
  state.addEffect({ kind:'shockwave', x:pos.x, y:pos.y, life:30, max:30, radius });
  for (let i = 0; i < 30; i++) {
    const a = Math.random()*Math.PI*2, v = 3+Math.random()*5;
    state.addEffect({ kind:'spark', x:pos.x, y:pos.y, vx:Math.cos(a)*v, vy:Math.sin(a)*v,
      life:30+Math.random()*20, max:50, color:Math.random()>0.5?'#ff7a1a':'#ffd866' });
  }
  state.shake(12);
}

// Launch-style blast — throws bodies UP and outward, like a mini-nuke.
// `scale` ~ 0.4 for rocket, 1.0 for nuke.
function _launchBlast(state, pos, radius, scale = 1) {
  const cx = pos.x, cy = pos.y;
  Matter.Composite.allBodies(state.world).forEach(b => {
    if (b.isStatic || !b.position) return;
    if (b.isSleeping) Matter.Sleeping.set(b, false);
    const dx = b.position.x - cx, dy = b.position.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > radius * 2.2) return;
    const falloff = Math.max(0.12, 1 - dist / (radius * 2.2));
    const n = { x: dx/dist, y: dy/dist };
    Matter.Body.applyForce(b, b.position, {
      x: n.x * 0.06 * falloff * scale * b.mass,
      y: n.y * 0.04 * falloff * scale * b.mass - 0.055 * falloff * scale * b.mass
    });
    Matter.Body.setAngularVelocity(b, b.angularVelocity + (Math.random()-0.5) * 0.55 * falloff * scale);
  });
  state.addEffect({ kind:'shockwave', x:cx, y:cy, life: 32+Math.round(18*scale), max: 32+Math.round(18*scale), radius: radius * 2.2 });
  const sparkN = Math.round(40 + 120 * scale);
  for (let i = 0; i < sparkN; i++) {
    const a = -Math.PI/2 + (Math.random()-0.5)*1.4;
    const v = (7 + Math.random()*10) * (0.7 + 0.5*scale);
    state.addEffect({
      kind:'spark', x: cx+(Math.random()-0.5)*40, y: cy+(Math.random()-0.5)*20,
      vx: Math.cos(a)*v*0.7, vy: Math.sin(a)*v,
      life: 80+Math.random()*80, max: 160,
      color: Math.random()<0.4?'#ff7a1a':(Math.random()<0.6?'#ffd866':'#fff1c2')
    });
  }
  state.shake(14 + 25 * scale);
}

// Slice a body into two halves perpendicular to the laser direction.
// Replaces the body with two rectangles and cleans up its bonds.
function _sliceBody(state, body, laserDir) {
  if (!body.position || body.isStatic) return;
  const w = body.bounds.max.x - body.bounds.min.x;
  const h = body.bounds.max.y - body.bounds.min.y;
  if (w < 8 || h < 8) {
    try { Matter.Composite.remove(state.world, body); } catch (e) {}
    return;
  }
  const cx = body.position.x, cy = body.position.y;
  const mat = body.plugin?.material || 'concrete';
  const m = MATERIALS[mat];
  const vel = { x: body.velocity?.x || 0, y: body.velocity?.y || 0 };
  const av  = body.angularVelocity || 0;
  const ang = body.angle || 0;

  // Cut axis: split perpendicular to the laser direction.
  // Laser more horizontal → cut horizontally (top/bottom halves).
  // Laser more vertical   → cut vertically   (left/right halves).
  const horizontalCut = Math.abs(laserDir.x) > Math.abs(laserDir.y);
  const makeHalf = (ox, oy, hw, hh) => {
    const b = Matter.Bodies.rectangle(cx + ox, cy + oy, hw, hh, {
      density: m.density, friction: m.friction, frictionStatic: m.frictionStatic,
      restitution: 0.05, slop: 0.04,
      render: { fillStyle: m.fillStyle, strokeStyle: m.strokeStyle, lineWidth: 1 },
      label: 'block', plugin: { material: mat }
    });
    Matter.Body.setAngle(b, ang);
    Matter.Body.setVelocity(b, vel);
    Matter.Body.setAngularVelocity(b, av);
    return b;
  };

  let halfA, halfB;
  const gap = 1.5; // tiny separation so they don't immediately resolve as overlapping
  if (horizontalCut) {
    halfA = makeHalf(0, -h/4 - gap/2, w*0.94, h/2 - gap);
    halfB = makeHalf(0,  h/4 + gap/2, w*0.94, h/2 - gap);
  } else {
    halfA = makeHalf(-w/4 - gap/2, 0, w/2 - gap, h*0.94);
    halfB = makeHalf( w/4 + gap/2, 0, w/2 - gap, h*0.94);
  }

  // Outward kick perpendicular to laser → halves visibly fly apart
  const perp = { x: -laserDir.y, y: laserDir.x };
  const kick = 0.02;
  Matter.Body.applyForce(halfA, halfA.position, { x:  perp.x*kick*halfA.mass, y:  perp.y*kick*halfA.mass });
  Matter.Body.applyForce(halfB, halfB.position, { x: -perp.x*kick*halfB.mass, y: -perp.y*kick*halfB.mass });

  // Clean up bonds attached to the original body
  if (body._bonds) {
    body._bonds.forEach(c => {
      try { Matter.Composite.remove(state.world, c); } catch (e) {}
      const idx = state.bonds.indexOf(c);
      if (idx >= 0) state.bonds.splice(idx, 1);
      const other = c.bodyA === body ? c.bodyB : c.bodyA;
      if (other && other._bonds) other._bonds = other._bonds.filter(x => x !== c);
    });
  }
  try { Matter.Composite.remove(state.world, body); } catch (e) {}
  const sIdx = state.structuresBuilt.indexOf(body);
  if (sIdx >= 0) state.structuresBuilt.splice(sIdx, 1);

  Matter.Composite.add(state.world, halfA);
  Matter.Composite.add(state.world, halfB);
  state.structuresBuilt.push(halfA, halfB);

  // Glow flash at the cut line
  for (let i = 0; i < 4; i++) {
    state.addEffect({
      kind: 'spark', x: cx + (Math.random()-0.5)*w*0.3, y: cy + (Math.random()-0.5)*h*0.3,
      vx: perp.x * (Math.random()*2-1) * 3, vy: perp.y * (Math.random()*2-1) * 3,
      life: 18, max: 18, color: '#ff3344'
    });
  }
}

// ─── WEAPONS ─────────────────────────────────────────────────────────────────
const WEAPONS = [
  {
    id: 'cannon', name: 'CANNONBALL', glyph: '●', desc: 'iron · 80kg',
    fire(state, from, to) {
      const dir = _wNorm(_wSub(to, from)), speed = state.getPower()*0.6;
      const ball = Matter.Bodies.circle(from.x, from.y, 18, {
        density:0.08, frictionAir:0.001, restitution:0.35,
        render:{ fillStyle:'#1a1e26', strokeStyle:'#3a4250', lineWidth:2 }, label:'projectile'
      });
      Matter.Body.setVelocity(ball, { x:dir.x*speed, y:dir.y*speed });
      state.addBody(ball); state.shake(6); _muzzle(state, from, dir);
    }
  },
  {
    id: 'grenade', name: 'GRENADE', glyph: '◉', desc: 'explosive · 1.2s fuse',
    fire(state, from, to) {
      const dir = _wNorm(_wSub(to, from)), speed = state.getPower()*0.55;
      const nade = Matter.Bodies.circle(from.x, from.y, 11, {
        density:0.025, frictionAir:0.005, restitution:0.6,
        render:{ fillStyle:'#2a3138', strokeStyle:'#ff7a1a', lineWidth:2 }, label:'grenade'
      });
      Matter.Body.setVelocity(nade, { x:dir.x*speed, y:dir.y*speed });
      state.addBody(nade); _muzzle(state, from, dir);
      setTimeout(() => {
        if (!nade.position) return;
        // Launch-style blast — meaningful upward + outward kick
        _launchBlast(state, nade.position, 260, 0.55);
        try { Matter.Composite.remove(state.world, nade); } catch(e){}
      }, 1200);
    }
  },
  {
    id: 'wrecker', name: 'WRECKING CRANE', glyph: '⏤⬤', desc: 'pendulum swing · 700kg ball',
    fire(state, from, to) {
      // Build a pendulum: pivot suspended above the target, heavy ball on a long chain,
      // released from the side opposite to the aim direction. Swings through the structure.
      const target = { x: to.x, y: to.y };
      const pivotX = target.x;
      const pivotY = Math.max(60, state.arena.groundY - 620);
      const chainLen = state.arena.groundY - pivotY - 60;
      const swingDir = (target.x >= from.x) ? -1 : 1; // ball starts on the FROM side
      const startAng = swingDir * 1.05; // ~60° off vertical
      const ballR = 38;
      const ballX = pivotX + Math.sin(startAng) * chainLen;
      const ballY = pivotY + Math.cos(startAng) * chainLen;

      const pivot = Matter.Bodies.circle(pivotX, pivotY, 6, { isStatic:true, render:{ visible:false } });
      const ball  = Matter.Bodies.circle(ballX, ballY, ballR, {
        density:0.65, frictionAir:0.0015, restitution:0.18,
        render:{ fillStyle:'#0e1116', strokeStyle:'#ff7a1a', lineWidth:4 }, label:'wrecker'
      });
      // Chain segments — visual only, no collision
      const linkCount = 14;
      const chain = [], links = [];
      for (let i = 0; i < linkCount; i++) {
        const t = (i+1)/(linkCount+1);
        chain.push(Matter.Bodies.circle(
          pivotX + (ballX - pivotX)*t,
          pivotY + (ballY - pivotY)*t, 3,
          { density:0.005, render:{ fillStyle:'#3a4250' }, collisionFilter:{ mask:0 } }
        ));
      }
      let prev = pivot;
      const linkLen = chainLen / (linkCount + 1);
      chain.forEach(seg => {
        links.push(Matter.Constraint.create({ bodyA:prev, bodyB:seg, length:linkLen,
          stiffness:0.98, damping:0.05, render:{ strokeStyle:'#5a6473', lineWidth:2 } }));
        prev = seg;
      });
      links.push(Matter.Constraint.create({ bodyA:prev, bodyB:ball, length:linkLen,
        stiffness:0.98, damping:0.05, render:{ strokeStyle:'#5a6473', lineWidth:3 } }));

      state.addBody(pivot);
      chain.forEach(s => state.addBody(s));
      state.addBody(ball);
      links.forEach(l => Matter.Composite.add(state.world, l));

      // Kick the ball into its swing
      Matter.Body.setVelocity(ball, { x: -swingDir * 8, y: 2 });

      state.shake(10);
      // Cleanup after the swing has had time to do its work
      setTimeout(() => {
        [pivot, ...chain].forEach(b => { try { Matter.Composite.remove(state.world, b); } catch(e){} });
        try { Matter.Composite.remove(state.world, ball); } catch(e){}
        links.forEach(l => { try { Matter.Composite.remove(state.world, l); } catch(e){} });
      }, 9000);
    }
  },
  {
    id: 'gravity', name: 'GRAVITY BOMB', glyph: '◈', desc: 'singularity · pulls all',
    fire(state, from, to) {
      const dir = _wNorm(_wSub(to, from)), speed = state.getPower()*0.5;
      const bomb = Matter.Bodies.circle(from.x, from.y, 12, {
        density:0.02, frictionAir:0.01,
        render:{ fillStyle:'#7c4dff', strokeStyle:'#b39dff', lineWidth:2 }, label:'gravbomb'
      });
      Matter.Body.setVelocity(bomb, { x:dir.x*speed, y:dir.y*speed });
      state.addBody(bomb);
      setTimeout(() => {
        if (!bomb.position) return;
        const center = { x:bomb.position.x, y:bomb.position.y };
        state.addEffect({ kind:'singularity', x:center.x, y:center.y, life:90, max:90 });
        Matter.Composite.remove(state.world, bomb);
        let frames = 0;
        const pull = setInterval(() => {
          Matter.Composite.allBodies(state.world).forEach(b => {
            if (b.isStatic) return;
            const d = _wSub(center, b.position), dist = Math.hypot(d.x,d.y);
            if (dist<5||dist>400) return;
            const f = 0.0008*b.mass/Math.max(20,dist);
            Matter.Body.applyForce(b, b.position, { x:d.x*f, y:d.y*f });
          });
          if (++frames > 60) { clearInterval(pull); _explode(state, center, 240, 0.08); }
        }, 16);
      }, 700);
    }
  },
  {
    id: 'laser', name: 'LASER CUTTER', glyph: '╱', desc: 'slices clean in half',
    fire(state, from, to) {
      const dir = _wNorm(_wSub(to, from));
      const endPt = { x:from.x + dir.x*2000, y:from.y + dir.y*2000 };
      const hits = Matter.Composite.allBodies(state.world)
        .filter(b => !b.isStatic && b.label === 'block' && _rayHitsBody(from, dir, b))
        .sort((a,b) => _distSq(from,a.position) - _distSq(from,b.position));
      // Slice everything the beam touches — clean in half
      hits.slice(0, 18).forEach((b, i) => {
        setTimeout(() => _sliceBody(state, b, dir), i * 20);
      });
      state.addEffect({ kind:'laser', x1:from.x, y1:from.y, x2:endPt.x, y2:endPt.y, life:22, max:22 });
      state.shake(4);
    }
  },
  {
    id: 'rocket', name: 'ROCKET', glyph: '➤', desc: 'thrust · big boom',
    fire(state, from, to) {
      const dir = _wNorm(_wSub(to, from));
      const rocket = Matter.Bodies.rectangle(from.x, from.y, 26, 10, {
        density:0.05, frictionAir:0.015,
        render:{ fillStyle:'#ff7a1a', strokeStyle:'#fff', lineWidth:1 }, label:'rocket'
      });
      Matter.Body.setAngle(rocket, Math.atan2(dir.y, dir.x));
      state.addBody(rocket);
      let t = 0;
      const detonate = (pos) => {
        _launchBlast(state, pos, 280, 0.45);
        try { Matter.Composite.remove(state.world, rocket); } catch(e){}
      };
      const thrust = setInterval(() => {
        if (!rocket.position) { clearInterval(thrust); return; }
        Matter.Body.applyForce(rocket, rocket.position, { x:dir.x*0.06, y:dir.y*0.06 });
        state.addEffect({ kind:'spark', x:rocket.position.x-dir.x*14, y:rocket.position.y-dir.y*14,
          vx:-dir.x*2.5+(Math.random()-.5), vy:-dir.y*2.5+(Math.random()-.5), life:22, max:22, color:'#ffaa44' });
        if (++t > 60) {
          clearInterval(thrust);
          if (rocket.position) detonate(rocket.position);
        }
      }, 16);
      rocket._onCollide = () => {
        clearInterval(thrust);
        if (rocket.position) detonate(rocket.position);
      };
    }
  },
  {
    id: 'railgun', name: 'RAILGUN', glyph: '═', desc: 'piercing slug · supersonic',
    fire(state, from, to) {
      const dir = _wNorm(_wSub(to, from));
      const endPt = { x:from.x + dir.x*2400, y:from.y + dir.y*2400 };
      // Pierces straight through everything in its path
      const hits = Matter.Composite.allBodies(state.world)
        .filter(b => !b.isStatic && b.label === 'block' && _rayHitsBody(from, dir, b))
        .sort((a,b) => _distSq(from,a.position) - _distSq(from,b.position));
      hits.slice(0, 30).forEach((b, i) => {
        const fall = 1 - i/30;
        // Massive forward impulse in the ray direction
        const f = state.getPower() * 0.085 * fall;
        Matter.Body.applyForce(b, b.position, { x: dir.x*f*b.mass, y: dir.y*f*b.mass });
        Matter.Body.setAngularVelocity(b, b.angularVelocity + (Math.random()-0.5)*0.6);
        // Shred bonds connected to the body
        if (b._bonds) b._bonds.forEach(c => { c._fatigue += c._breakStrain * 2.2; c._settle = 0; });
      });
      state.addEffect({ kind:'laser', x1:from.x, y1:from.y, x2:endPt.x, y2:endPt.y, life:22, max:22 });
      // Bright impact sparks along the ray
      hits.slice(0, 12).forEach(b => {
        for (let k = 0; k < 4; k++) {
          const a = Math.random()*Math.PI*2, v = 3+Math.random()*4;
          state.addEffect({ kind:'spark', x:b.position.x, y:b.position.y,
            vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:24, max:24, color:'#aef7ff' });
        }
      });
      _muzzle(state, from, dir);
      state.shake(14);
    }
  },
  {
    id: 'cluster', name: 'CLUSTER BOMB', glyph: '◈◉', desc: 'airbursts into shrapnel',
    fire(state, from, to) {
      const dir = _wNorm(_wSub(to, from));
      const speed = state.getPower()*0.55;
      const bomb = Matter.Bodies.circle(from.x, from.y, 14, {
        density:0.03, frictionAir:0.004, restitution:0.4,
        render:{ fillStyle:'#3a4250', strokeStyle:'#ff7a1a', lineWidth:2 }, label:'grenade'
      });
      Matter.Body.setVelocity(bomb, { x:dir.x*speed, y:dir.y*speed });
      state.addBody(bomb); _muzzle(state, from, dir);
      setTimeout(() => {
        if (!bomb.position) return;
        const center = { x:bomb.position.x, y:bomb.position.y };
        try { Matter.Composite.remove(state.world, bomb); } catch(e){}
        // Spawn 14 sub-grenades that scatter and detonate on short fuses
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI/2 + (i/14)*Math.PI*2 + Math.random()*0.3;
          const v = 9 + Math.random()*4;
          const sub = Matter.Bodies.circle(center.x, center.y, 7, {
            density:0.012, frictionAir:0.004, restitution:0.6,
            render:{ fillStyle:'#2a3138', strokeStyle:'#ffd866', lineWidth:1 }, label:'grenade'
          });
          Matter.Body.setVelocity(sub, { x:Math.cos(a)*v, y:Math.sin(a)*v });
          state.addBody(sub);
          setTimeout(() => {
            if (!sub.position) return;
            // Mini launch blast — meaningful upward kick on every burst
            _launchBlast(state, sub.position, 140, 0.22);
            try { Matter.Composite.remove(state.world, sub); } catch(e){}
          }, 450 + Math.random()*350);
        }
        // Initial airburst
        _launchBlast(state, center, 180, 0.3);
      }, 900);
    }
  },
  {
    id: 'airstrike', name: 'AIRSTRIKE', glyph: '═☣', desc: 'line of bombs from above',
    fire(state, from, to) {
      // Aim line on the ground — drop a row of bombs over it
      const bombs = 9;
      const span = 520;
      const cx = to.x;
      for (let i = 0; i < bombs; i++) {
        setTimeout(() => {
          const x = cx - span/2 + (span/(bombs-1))*i + (Math.random()-0.5)*40;
          const bomb = Matter.Bodies.circle(x, -40, 13, {
            density:0.05, frictionAir:0.002, restitution:0.2,
            render:{ fillStyle:'#3a4250', strokeStyle:'#ff7a1a', lineWidth:2 }, label:'grenade'
          });
          Matter.Body.setVelocity(bomb, { x:0, y:16 });
          state.addBody(bomb);
          const trail = setInterval(() => {
            if (!bomb.position || !state.world.bodies.includes(bomb)) { clearInterval(trail); return; }
            state.effects.push({ kind:'spark', x:bomb.position.x, y:bomb.position.y - 6,
              vx:0, vy:-1.5, life:18, max:18, color:'#999' });
          }, 60);
          bomb._onCollide = () => {
            clearInterval(trail);
            if (bomb.position) {
              _launchBlast(state, bomb.position, 220, 0.35);
              try { Matter.Composite.remove(state.world, bomb); } catch(e){}
            }
          };
        }, i * 100);
      }
      state.shake(10);
    }
  },
  {
    id: 'blackhole', name: 'BLACK HOLE', glyph: '⊙', desc: 'pulls everything · then erupts',
    fire(state, from, to) {
      const dir = _wNorm(_wSub(to, from));
      const speed = state.getPower()*0.45;
      const bomb = Matter.Bodies.circle(from.x, from.y, 16, {
        density:0.02, frictionAir:0.01,
        render:{ fillStyle:'#000000', strokeStyle:'#7c4dff', lineWidth:3 }, label:'gravbomb'
      });
      Matter.Body.setVelocity(bomb, { x:dir.x*speed, y:dir.y*speed });
      state.addBody(bomb);
      setTimeout(() => {
        if (!bomb.position) return;
        const center = { x:bomb.position.x, y:bomb.position.y };
        state.addEffect({ kind:'singularity', x:center.x, y:center.y, life:240, max:240 });
        try { Matter.Composite.remove(state.world, bomb); } catch(e){}
        let frames = 0;
        const pull = setInterval(() => {
          Matter.Composite.allBodies(state.world).forEach(b => {
            if (b.isStatic) return;
            const d = _wSub(center, b.position), dist = Math.hypot(d.x,d.y);
            if (dist<6||dist>1100) return;
            // Strong inward force, even stronger near the singularity
            const f = 0.009*b.mass/Math.max(12, dist*0.7);
            Matter.Body.applyForce(b, b.position, { x:d.x*f, y:d.y*f });
            // Wake everything caught in the well
            if (b.isSleeping) Matter.Sleeping.set(b, false);
          });
          // Tear bonds apart — closer to the center = more damage per tick.
          // Bonds inside the inner zone get shredded almost instantly.
          state.bonds.forEach(c => {
            if (!c.bodyA || !c.bodyB) return;
            const mx = (c.bodyA.position.x + c.bodyB.position.x) / 2;
            const my = (c.bodyA.position.y + c.bodyB.position.y) / 2;
            const dist = Math.hypot(mx - center.x, my - center.y);
            if (dist > 600) return;
            c._settle = 0;
            // Linear ramp: at the center → massive fatigue, at the edge → light
            const damage = (1 - dist/600) * 18;
            c._fatigue += damage * damage; // quadratic falloff so near = very strong
          });
          if (++frames > 180) {
            clearInterval(pull);
            // Erupt outward — bigger and meaner than a nuke
            _launchBlast(state, center, 520, 1.5);
            state.shake(40);
          }
        }, 16);
      }, 700);
    }
  }
];

// ─── DISASTERS ───────────────────────────────────────────────────────────────
function _genBolt(x1, y1, x2, y2, depth) {
  if (depth===0||Math.abs(y2-y1)<12) return [{x1,y1,x2,y2}];
  const mx=(x1+x2)/2+(Math.random()-0.5)*Math.abs(y2-y1)*0.5, my=(y1+y2)/2;
  const s=[..._genBolt(x1,y1,mx,my,depth-1),..._genBolt(mx,my,x2,y2,depth-1)];
  if (depth>2&&Math.random()<0.4) s.push(..._genBolt(mx,my,mx+(Math.random()-0.5)*90,my+Math.abs(y2-y1)*0.4,depth-2));
  return s;
}

const DISASTERS = [
  {
    id: 'quake', name: 'EARTHQUAKE', glyph: '≈', desc: 'tremor · damages structures', key: 'Q',
    run(state) {
      const intensity = state.getIntensity(), base = intensity*0.0028, ticks = 130+intensity*20;
      state.shake(intensity>6?14:8);
      let t = 0;
      const iv = setInterval(() => {
        t++;
        state.structuresBuilt.forEach(b => {
          if (b.isStatic||!b.position) return;
          if (b.isSleeping) Matter.Sleeping.set(b,false);
          const hF = Math.max(0.15,(state.arena.groundY-b.position.y)/(state.arena.groundY*0.8));
          const fx = Math.sin(t*0.32)*base*hF*b.mass;
          Matter.Body.applyForce(b, b.position, { x:fx, y:-Math.abs(fx)*0.05 });
        });
        // ── Structural damage — accumulate fatigue on every bond, weighted
        //    by height. Big enough quakes will eventually snap weak bonds
        //    and collapse buildings even without a direct hit.
        if (t % 3 === 0) {
          state.bonds.forEach(c => {
            if (!c.bodyA || !c.bodyB || c._settle > 0) return;
            const avgY = (c.bodyA.position.y + c.bodyB.position.y) / 2;
            const hF = Math.max(0.2, (state.arena.groundY - avgY) / (state.arena.groundY * 0.8));
            c._fatigue += intensity * 1.8 * hF;
          });
        }
        if (t%8===0) state.shake(2+intensity*0.3);
        if (t%4===0) {
          const x = Math.random()*state.W;
          for (let k=0; k<4; k++)
            state.effects.push({ kind:'spark', x, y:state.arena.groundY, vx:(Math.random()-0.5)*1.5, vy:-Math.random()*2, life:30, max:30, color:'rgba(200,180,140,0.6)' });
        }
        if (t>=ticks) clearInterval(iv);
      }, 16);
    }
  },
  {
    id: 'meteor', name: 'METEOR STORM', glyph: '☄', desc: 'fireballs from above', key: 'W',
    run(state) {
      const intensity = state.getIntensity(), count = 3+Math.floor(intensity*0.8);
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const x = state.W*0.1+Math.random()*state.W*0.8, size = 14+intensity*2+Math.random()*10;
          const meteor = Matter.Bodies.circle(x, -40, size, {
            density:0.05, restitution:0.1, friction:0.4, frictionAir:0,
            render:{ fillStyle:'#ff5522', strokeStyle:'#ffaa44', lineWidth:2 }, label:'meteor'
          });
          Matter.Body.setVelocity(meteor, { x:(Math.random()-0.5)*4, y:12+intensity });
          state.addBody(meteor);
          const trail = setInterval(() => {
            if (!meteor.position||!state.world.bodies.includes(meteor)) { clearInterval(trail); return; }
            state.effects.push({ kind:'spark', x:meteor.position.x, y:meteor.position.y, vx:(Math.random()-0.5)*1, vy:-Math.random()*2, life:24, max:24, color:Math.random()<0.5?'#ff7a1a':'#ffd866' });
          }, 30);
          meteor._onCollide = () => {
            clearInterval(trail);
            if (meteor.position) { _explode(state, meteor.position, 160+intensity*8, 0.1); try { Matter.Composite.remove(state.world,meteor); } catch(e){} }
          };
        }, i*(500-intensity*25));
      }
    }
  },
  {
    id: 'tornado', name: 'TORNADO', glyph: '🌀', desc: 'spinning wind funnel', key: 'E',
    run(state) {
      const intensity = state.getIntensity(), radius = 100+intensity*18;
      const fromRight = Math.random()<0.5;
      state.tornado = {
        x: fromRight?state.W+radius:-radius, y:state.arena.groundY-80,
        radius, intensity, vx:(fromRight?-1:1)*(2.5+intensity*0.3), life:600
      };
      state.shake(6);
    }
  },
  {
    id: 'gravflip', name: 'GRAVITY FLIP', glyph: '↕', desc: 'inverts gravity briefly', key: 'R',
    run(state) {
      const intensity = state.getIntensity();
      // Read the slider as the canonical "normal" gravity so re-triggering
      // mid-flip can never strand us in flipped state.
      const slider = document.getElementById('g-slider');
      const sliderG = slider ? parseFloat(slider.value) : 1;

      // If a flip is already running, cancel its restore timer — we'll set a fresh one.
      if (state._gravTimer) { clearTimeout(state._gravTimer); state._gravTimer = null; }

      // Duration scales inversely with gravity magnitude: weak gravity → long
      // hang-time aloft, strong gravity → brief flip (more violent but quick).
      const gAbs = Math.max(0.15, Math.abs(sliderG));
      const dur  = Math.round(Math.min(5000, Math.max(700, 2400 / gAbs)));

      state.engine.world.gravity.y = -Math.abs(sliderG || 1) - intensity*0.05;
      state.shake(10);
      state.structuresBuilt.forEach(b => {
        if (b.isStatic) return;
        if (b.isSleeping) Matter.Sleeping.set(b,false);
        Matter.Body.applyForce(b, b.position, { x:(Math.random()-0.5)*0.002*b.mass, y:-0.004*b.mass });
      });
      state.gravFlip = { life: dur };
      state._gravTimer = setTimeout(() => {
        // Always restore to the live slider value (user may have moved it)
        const restore = parseFloat(slider?.value || sliderG);
        state.engine.world.gravity.y = restore;
        state.gravFlip = null;
        state._gravTimer = null;
        state.shake(8);
      }, dur);
    }
  },
  {
    id: 'lightning', name: 'LIGHTNING', glyph: '⚡', desc: 'strikes the tallest target', key: 'T',
    run(state) {
      const intensity = state.getIntensity();
      let target = null;
      state.structuresBuilt.forEach(b => { if (!b.position) return; if (!target||b.position.y<target.position.y) target=b; });
      if (!target) return;
      const sx = target.position.x+(Math.random()-0.5)*40, sy = target.position.y;
      state.effects.push({ kind:'lightning', bolts:_genBolt(sx,0,sx,sy,5), life:30, max:30 });
      const r = 70+intensity*12;
      state.structuresBuilt.forEach(b => {
        if (!b.position) return;
        if (b.isSleeping) Matter.Sleeping.set(b,false);
        const dx=b.position.x-sx, dy=b.position.y-sy, d2=dx*dx+dy*dy;
        if (d2<r*r) {
          const t=1-Math.sqrt(d2)/r;
          Matter.Body.applyForce(b, b.position, { x:(Math.random()-0.5)*intensity*0.008*t*b.mass, y:-intensity*0.006*t*b.mass });
        }
      });
      for (let i=0; i<18; i++)
        state.effects.push({ kind:'spark', x:sx, y:sy, vx:(Math.random()-0.5)*9, vy:-Math.random()*7, life:40, max:40, color:'#fffbe0' });
      state.shake(8);
    }
  },
  {
    id: 'nuke', name: 'NUKE', glyph: '☢', desc: 'total annihilation', key: 'Y',
    run(state) {
      const intensity = state.getIntensity();
      const cx = state.W/2, cy = state.arena.groundY-40;
      const r  = 220 + intensity*60;

      state.effects.push({ kind:'nukeFlash', x:cx, y:cy, life:60, max:60 });

      setTimeout(() => {
        // PRIMARY launch — full power, throws everything skyward
        _launchBlast(state, { x:cx, y:cy }, r, 1.0);
        // SECONDARY pulses keep debris airborne and scatter laterally
        for (let i = 0; i < 4; i++) {
          setTimeout(() => {
            _launchBlast(state, { x:cx+(Math.random()-0.5)*r*0.8, y:cy - i*40 }, r*0.7, 0.35);
          }, 180 + i*140);
        }
      }, 220);

      state.shake(45);
    }
  },
  {
    id: 'volcano', name: 'VOLCANO', glyph: '🌋', desc: 'ground erupts · molten chunks', key: 'U',
    run(state) {
      const intensity = state.getIntensity();
      const vents = 2 + Math.floor(intensity * 0.6);
      const gy = state.arena.groundY;
      for (let v = 0; v < vents; v++) {
        setTimeout(() => {
          const vx = state.W*0.15 + Math.random()*state.W*0.7;
          state.addEffect({ kind:'shockwave', x:vx, y:gy, life:30, max:30, radius: 100 });
          // Many lava chunks blasted upward
          const chunks = 8 + intensity * 2;
          for (let i = 0; i < chunks; i++) {
            const c = Matter.Bodies.polygon(vx + (Math.random()-0.5)*60, gy - 20,
              5 + Math.floor(Math.random()*3), 8 + Math.random()*10, {
                density:0.04, friction:0.6, restitution:0.2, frictionAir:0.005,
                render:{ fillStyle:'#ff5522', strokeStyle:'#ffaa44', lineWidth:1 },
                label:'meteor'
            });
            const ang = -Math.PI/2 + (Math.random()-0.5)*1.2;
            const sp = 14 + Math.random()*10;
            Matter.Body.setVelocity(c, { x:Math.cos(ang)*sp, y:Math.sin(ang)*sp });
            Matter.Body.setAngularVelocity(c, (Math.random()-0.5)*0.6);
            state.addBody(c);
            const trail = setInterval(() => {
              if (!c.position||!state.world.bodies.includes(c)) { clearInterval(trail); return; }
              state.effects.push({ kind:'spark', x:c.position.x, y:c.position.y,
                vx:(Math.random()-0.5)*1, vy:-Math.random()*1.5,
                life:24, max:24, color:Math.random()<0.5?'#ff7a1a':'#ffd866' });
            }, 50);
            c._onCollide = () => {
              clearInterval(trail);
              if (c.position) { _explode(state, c.position, 90+intensity*4, 0.05); try { Matter.Composite.remove(state.world, c); } catch(e){} }
            };
          }
          // Big upward kick on anything sitting near the vent
          Matter.Composite.allBodies(state.world).forEach(b => {
            if (b.isStatic || !b.position) return;
            const dx = b.position.x - vx;
            if (Math.abs(dx) > 120) return;
            const k = 1 - Math.abs(dx)/120;
            if (b.isSleeping) Matter.Sleeping.set(b, false);
            Matter.Body.applyForce(b, b.position, { x:(Math.random()-0.5)*0.01*k*b.mass, y:-0.04*k*b.mass });
          });
          state.shake(10+intensity);
        }, v * 600);
      }
    }
  },
  {
    id: 'acidrain', name: 'ACID RAIN', glyph: '☂', desc: 'dissolves blocks · slow ruin', key: 'I',
    run(state) {
      const intensity = state.getIntensity();
      const ticks = 200 + intensity * 30;
      let t = 0;
      const downDir = { x: 0, y: 1 };
      const iv = setInterval(() => {
        t++;
        // Drip visual rain
        for (let k = 0; k < 8; k++) {
          state.effects.push({ kind:'spark',
            x: Math.random()*state.W, y: 0,
            vx: 0, vy: 9 + Math.random()*5,
            life: 40, max: 40, color:'rgba(150,255,120,0.55)'
          });
        }
        // Dissolve random blocks — slice them like the laser gun, downward
        if (t % 6 === 0) {
          const blocks = state.structuresBuilt.filter(b => b.position && b.label === 'block');
          const sliceCount = Math.min(blocks.length, Math.max(1, Math.floor(intensity * 0.7)));
          for (let i = 0; i < sliceCount; i++) {
            const b = blocks[Math.floor(Math.random() * blocks.length)];
            if (!b || !b.position) continue;
            // Green corrosion sparks at the cut
            for (let k = 0; k < 5; k++) {
              state.addEffect({ kind:'spark',
                x: b.position.x + (Math.random()-0.5)*10,
                y: b.position.y - 6,
                vx: (Math.random()-0.5)*2, vy: -Math.random()*1.5,
                life: 20, max: 20, color:'rgba(150,255,120,0.9)' });
            }
            _sliceBody(state, b, downDir);
          }
        }
        // Corrode bonds — accumulate fatigue everywhere, slowly
        if (t % 4 === 0) {
          state.bonds.forEach(c => {
            if (!c.bodyA || !c.bodyB || c._settle > 0) return;
            c._fatigue += intensity * 1.4;
          });
        }
        if (t >= ticks) clearInterval(iv);
      }, 30);
      state.shake(4);
    }
  },
  {
    id: 'tsunami', name: 'TSUNAMI', glyph: '〰', desc: 'wall of water · horizontal sweep', key: 'O',
    run(state) {
      const intensity = state.getIntensity();
      const fromLeft = Math.random() < 0.5;
      const height = 220 + intensity * 30;
      state.tsunami = {
        x: fromLeft ? -120 : state.W + 120,
        height,
        vx: (fromLeft ? 1 : -1) * (6 + intensity * 0.4),
        intensity,
        life: 700
      };
      state.shake(8);
    }
  }
];

// Tsunami tick — drawn + applies force in main loop via tickDisasters
function tickTsunami(state) {
  if (!state.tsunami) return;
  const t = state.tsunami;
  t.x += t.vx; t.life--;
  const top = state.arena.groundY - t.height;
  // Push bodies the wave is currently passing through
  Matter.Composite.allBodies(state.world).forEach(b => {
    if (b.isStatic || !b.position) return;
    const dx = b.position.x - t.x;
    if (Math.abs(dx) > 140) return;
    if (b.position.y < top) return;
    if (b.isSleeping) Matter.Sleeping.set(b, false);
    const horizK = Math.sign(t.vx) * (1 - Math.abs(dx)/140);
    Matter.Body.applyForce(b, b.position, {
      x: 0.012 * horizK * b.mass * t.intensity * 0.18,
      y: -0.004 * (1 - Math.abs(dx)/140) * b.mass
    });
  });
  // Foam particles
  if (Math.random() < 0.9) {
    for (let i = 0; i < 4; i++) {
      state.effects.push({ kind:'spark',
        x: t.x + (Math.random()-0.5)*120,
        y: top + Math.random()*t.height,
        vx: t.vx * 0.3 + (Math.random()-0.5)*1.5,
        vy: (Math.random()-0.5)*2,
        life: 36, max: 36, color:'rgba(140,220,255,0.7)'
      });
    }
  }
  if (t.life <= 0 || t.x < -300 || t.x > state.W + 300) state.tsunami = null;
}

function tickDisasters(state) {
  tickTsunami(state);
  if (!state.tornado) return;
  const t = state.tornado;
  t.x += t.vx; t.life--;
  const maxR = t.radius*1.85;
  state.structuresBuilt.forEach(b => {
    if (b.isStatic||!b.position) return;
    const dx=b.position.x-t.x, dy=b.position.y-t.y, dist=Math.hypot(dx,dy);
    if (dist<maxR&&dist>1) {
      if (b.isSleeping) Matter.Sleeping.set(b,false);
      const k=1-dist/maxR, a=Math.atan2(dy,dx);
      Matter.Body.applyForce(b, b.position, {
        x:(-Math.sin(a)*t.intensity*0.0035*k-(dx/dist)*t.intensity*0.0014*k*k)*b.mass,
        y:(Math.cos(a)*t.intensity*0.0035*k-(dist<t.radius*0.6?t.intensity*0.002*k:0))*b.mass
      });
    }
  });
  if (Math.random()<0.4) {
    const a=Math.random()*Math.PI*2, d=Math.random()*t.radius;
    state.effects.push({ kind:'spark', x:t.x+Math.cos(a)*d, y:t.y+Math.sin(a)*d-t.radius*0.3, vx:-Math.sin(a)*4, vy:Math.cos(a)*4-1, life:40, max:40, color:'rgba(180,180,180,0.6)' });
  }
  if (t.life<=0||t.x>state.W+maxR*2||t.x<-maxR*2) state.tornado=null;
}

// ─── MAIN (game.js) ──────────────────────────────────────────────────────────
(function () {
  const M = Matter;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  const engine = M.Engine.create({ enableSleeping: true });
  engine.world.gravity.y = 1;
  engine.positionIterations  = 20;
  engine.velocityIterations  = 16;
  engine.constraintIterations = 8;
  const world = engine.world;

  let W = 0, H = 0, dpr = 1;
  // ── Background layers (procedural, regenerated on resize) ────────────
  const bg = { stars: [], mountainsFar: [], mountainsMid: [], skyline: [], clouds: [] };
  function generateBackground() {
    bg.stars = [];
    const starCount = Math.round(W * 0.18);
    for (let i = 0; i < starCount; i++) {
      bg.stars.push({
        x: Math.random()*W,
        y: Math.random()*H*0.55,
        r: Math.random() < 0.92 ? 0.6 + Math.random()*0.8 : 1.4 + Math.random()*1.2,
        tw: Math.random()*Math.PI*2,
        sp: 0.005 + Math.random()*0.02
      });
    }
    bg.clouds = [];
    const cloudCount = 5 + Math.floor(Math.random()*4);
    for (let i = 0; i < cloudCount; i++) {
      bg.clouds.push({
        x: Math.random()*W,
        y: 40 + Math.random()*(H*0.35),
        w: 120 + Math.random()*200,
        h: 14 + Math.random()*20,
        vx: 0.08 + Math.random()*0.18
      });
    }
    const ridge = (seedAmp, baseY, step) => {
      const pts = [];
      let x = -50;
      while (x <= W + 50) {
        pts.push({ x, y: baseY - Math.abs(Math.sin(x*0.007 + seedAmp) + Math.sin(x*0.019 + seedAmp*2)*0.5) * seedAmp });
        x += step;
      }
      return pts;
    };
    bg.mountainsFar = ridge(70,  H*0.62, 28);
    bg.mountainsMid = ridge(110, H*0.74, 22);
    // City skyline as a series of rectangles with a few window dots
    bg.skyline = [];
    let sx = -20;
    while (sx < W + 20) {
      const bw = 28 + Math.random()*52;
      const bh = 60 + Math.random()*180;
      bg.skyline.push({ x: sx, w: bw, h: bh });
      sx += bw + 2 + Math.random()*4;
    }
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio||1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W*dpr; canvas.height = H*dpr;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    generateBackground();
    rebuildArena();
  }
  window.addEventListener('resize', resize);

  const arenaBodies = { ground:null, left:null, right:null };
  const state = {
    world, engine, W: 0,
    arena: { groundY:0, centerX:0 },
    effects: [], shakeAmt: 0,
    options: { debris:true, trails:false, shake:true },
    weapon: null, structure: null, power: 35,
    structuresBuilt: [], bonds: [],
    initialPartCount: 0, destroyed: 0, shots: 0,
    tornado: null, gravFlip: null,
    addBody(b) { M.Composite.add(world, b); },
    addEffect(e) { this.effects.push(e); },
    shake(n) {
      if (this.options.shake) this.shakeAmt = Math.max(this.shakeAmt, n);
      // Any destructive event arms bonds — settle immunity ends so the next
      // hit/blast can shatter freshly-spawned structures.
      this.bonds.forEach(c => { if (c._settle > 0) c._settle = 0; });
    },
    getPower() { return this.power; },
    getIntensity() { return parseInt(document.getElementById('intensity-slider')?.value||'5',10); },
    // Customization — read from sliders
    scale: 2.0,
    subdivLevel: 1.4,
    debrisCap: 500,
    projectileCap: 22,
    gameSpeed: 1.0
  };

  function rebuildArena() {
    Object.values(arenaBodies).forEach(b => { if(b) M.Composite.remove(world,b); });
    const t = 80;
    arenaBodies.ground = M.Bodies.rectangle(W/2, H-20, W*2, 40, { isStatic:true, render:{ visible:false }, label:'ground' });
    arenaBodies.left   = M.Bodies.rectangle(-t/2, H/2, t, H*2, { isStatic:true, render:{ visible:false } });
    arenaBodies.right  = M.Bodies.rectangle(W+t/2, H/2, t, H*2, { isStatic:true, render:{ visible:false } });
    M.Composite.add(world, [arenaBodies.ground, arenaBodies.left, arenaBodies.right]);
    state.arena.groundY = H-40; state.arena.centerX = W/2; state.W = W;
  }

  // ---- UI rails ----
  function buildWeaponList() {
    const wrap = document.getElementById('weapon-list');
    wrap.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const el = document.createElement('div');
      el.className = 'rail-item'; el.dataset.id = w.id;
      el.innerHTML = `<div class="rail-icon">${w.glyph}</div><div><div class="rail-name">${w.name}</div><div class="rail-desc">${w.desc}</div></div><div class="rail-key">${i===9?'0':i+1}</div>`;
      el.addEventListener('click', () => selectWeapon(w.id));
      wrap.appendChild(el);
    });
    selectWeapon(WEAPONS[0].id);
  }
  function selectWeapon(id) {
    state.weapon = WEAPONS.find(w => w.id===id);
    document.querySelectorAll('#weapon-list .rail-item').forEach(el => el.classList.toggle('active', el.dataset.id===id));
  }

  function buildStructureList() {
    const wrap = document.getElementById('structure-list');
    wrap.innerHTML = '';
    STRUCTURES.forEach(s => {
      const el = document.createElement('div');
      el.className = 'rail-item'; el.dataset.id = s.id;
      el.innerHTML = `<div class="rail-icon">${s.glyph}</div><div><div class="rail-name">${s.name}</div><div class="rail-desc">${s.desc}</div></div><div class="rail-key">↵</div>`;
      el.addEventListener('click', (ev) => {
        selectStructure(s.id);
        // shift+click = add another structure instead of replacing
        if (ev.shiftKey) appendStructure(s);
        else spawnStructure();
      });
      wrap.appendChild(el);
    });
    selectStructure(STRUCTURES[0].id);
  }
  function selectStructure(id) {
    state.structure = STRUCTURES.find(s => s.id===id);
    document.querySelectorAll('#structure-list .rail-item').forEach(el => el.classList.toggle('active', el.dataset.id===id));
  }

  // Append another structure to the scene without wiping the existing one.
  // Picks a free horizontal slot (or cursor x if held) and shifts the build into it.
  function appendStructure(structDef) {
    // measure existing footprints so we don't overlap
    const occupied = state.structuresBuilt
      .filter(b => b.position && !b.isStatic)
      .map(b => b.position.x);
    // build at center then shift to chosen x
    const tmpCenter = state.arena.centerX;
    const savedCenter = state.arena.centerX;
    // Find target x: prefer cursor if recently moved, else next free slot
    let targetX = pickFreeSlot(occupied);
    state.arena.centerX = targetX;
    let bodies = structDef.build(state);
    state.arena.centerX = savedCenter;
    scaleCluster(bodies, state.scale, { x: targetX, y: state.arena.groundY });
    bodies = subdivideCluster(bodies, state.subdivLevel, state.arena.groundY);
    bodies.forEach(b => { M.Composite.add(world, b); M.Sleeping.set(b, true); });
    state.structuresBuilt.push(...bodies);
    state.initialPartCount += bodies.length;
    bondNeighbors(bodies);
    // Zero velocity + force-sleep after bonds wake bodies. Bonds impart tiny
    // residual velocities; clearing them prevents spawn drift.
    bodies.forEach(b => {
      M.Body.setVelocity(b, { x: 0, y: 0 });
      M.Body.setAngularVelocity(b, 0);
      M.Sleeping.set(b, true);
    });
    updateMeter();
  }

  function pickFreeSlot(occupiedX) {
    // Worst-case half-width of a scaled structure footprint
    const halfW = 280;
    // If cursor is over the canvas AND clear of existing footprints, use it
    if (lastCursor && lastCursor.x > halfW && lastCursor.x < state.W - halfW) {
      const minD = occupiedX.length
        ? Math.min(...occupiedX.map(o => Math.abs(o - lastCursor.x)))
        : 9999;
      if (minD > halfW) return lastCursor.x;
    }
    // Otherwise scan slots across the screen and pick the one farthest from
    // any existing body — guarantees no overlap with neighbours.
    const margin = 240;
    const slots = [];
    for (let x = margin; x <= state.W - margin; x += 40) slots.push(x);
    let best = slots[0], bestDist = -1;
    slots.forEach(x => {
      const d = occupiedX.length ? Math.min(...occupiedX.map(o => Math.abs(o - x))) : 9999;
      if (d > bestDist) { bestDist = d; best = x; }
    });
    return best;
  }

  function buildDistrictList() {
    const wrap = document.getElementById('district-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    DISTRICTS.forEach(d => {
      const el = document.createElement('div');
      el.className = 'rail-item district'; el.dataset.id = d.id;
      el.innerHTML = `<div class="rail-icon">${d.glyph}</div><div><div class="rail-name">${d.name}</div><div class="rail-desc">${d.desc}</div></div><div class="rail-key">↵</div>`;
      el.addEventListener('click', () => spawnDistrict(d.id));
      wrap.appendChild(el);
    });
  }
  function spawnDistrict(id) {
    const d = DISTRICTS.find(x => x.id === id);
    if (!d) return;
    state.structuresBuilt.forEach(b => { try { M.Composite.remove(world,b); } catch(e){} });
    state.structuresBuilt = []; state.bonds.forEach(c => { try { M.Composite.remove(world,c); } catch(e){} }); state.bonds = [];
    state.destroyed = 0;
    M.Composite.allBodies(world).forEach(b => { if (b.isStatic) return; M.Composite.remove(world,b); });
    M.Composite.allConstraints(world).forEach(c => { try { M.Composite.remove(world,c); } catch(e){} });
    state.effects.length = 0; trailLayer.length = 0; state.shakeAmt = 0; state.shots = 0;
    // Cancel any active disasters so a lingering tornado/gravity-flip can't wreck the fresh build
    state.tornado = null;
    state.tsunami = null;
    if (state._gravTimer) { clearTimeout(state._gravTimer); state._gravTimer = null; }
    state.gravFlip = null;
    state.engine.world.gravity.y = parseFloat(document.getElementById('g-slider')?.value || '1');
    const bodies0 = d.build(state);
    const bodies = subdivideCluster(bodies0, state.subdivLevel, state.arena.groundY);
    bodies.forEach(b => { M.Composite.add(world,b); M.Sleeping.set(b,true); });
    state.structuresBuilt = bodies; state.initialPartCount = bodies.length;
    bondNeighbors(bodies);
    bodies.forEach(b => {
      M.Body.setVelocity(b, { x: 0, y: 0 });
      M.Body.setAngularVelocity(b, 0);
      M.Sleeping.set(b, true);
    });
    document.querySelectorAll('#district-list .rail-item').forEach(el => el.classList.toggle('active', el.dataset.id===id));
    document.querySelectorAll('#structure-list .rail-item').forEach(el => el.classList.remove('active'));
    updateMeter();
  }

  // Scale + subdivision level are read from `state` so the sliders can tweak
  // them live. scaleCluster is applied around an anchor point.
  function scaleCluster(bodies, scale, anchor) {
    if (scale === 1) return;
    bodies.forEach(b => {
      const dx = b.position.x - anchor.x;
      const dy = b.position.y - anchor.y;
      M.Body.setPosition(b, { x: anchor.x + dx*scale, y: anchor.y + dy*scale });
      M.Body.scale(b, scale, scale);
    });
  }

  function bondNeighbors(bodies) {
    const eps = 2;
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      const aw = (a.bounds.max.x - a.bounds.min.x) / 2;
      const ah = (a.bounds.max.y - a.bounds.min.y) / 2;
      const matA = a.plugin?.material || 'concrete';
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        const bw = (b.bounds.max.x - b.bounds.min.x) / 2;
        const bh = (b.bounds.max.y - b.bounds.min.y) / 2;
        const dx = Math.abs(a.position.x - b.position.x);
        const dy = Math.abs(a.position.y - b.position.y);
        if (dx <= aw + bw + eps && dy <= ah + bh + eps) {
          const matB = b.plugin?.material || 'concrete';
          const baseBondStr = (MATERIALS[matA].bondStr + MATERIALS[matB].bondStr) / 2;
          const breakStrain = baseBondStr + Math.min(10, (a.mass + b.mass) * 0.15);
          const restLen = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
          const c = M.Constraint.create({
            bodyA: a, bodyB: b, length: restLen,
            stiffness: 0.9, damping: 0.2, render: { visible: false }
          });
          c._restLen = restLen;
          c._breakStrain = breakStrain;
          c._fatigue = 0;
          c._maxFatigue = breakStrain * 4;
          c._settle = 240; // ~4s of immunity so gravity can settle the stack
          a._bonds = a._bonds || []; b._bonds = b._bonds || [];
          a._bonds.push(c); b._bonds.push(c);
          M.Composite.add(world, c);
          state.bonds.push(c);
        }
      }
    }
    // Stamp original bond count per body — used to gauge structural integrity.
    // Cascade weakening only fires once a body has lost a meaningful share of
    // its bonds, so isolated hits stay isolated.
    bodies.forEach(b => { b._originalBondCount = (b._bonds || []).length; });
  }

  function buildDisasterList() {
    const wrap = document.getElementById('disaster-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    DISASTERS.forEach(d => {
      const el = document.createElement('div');
      el.className = 'rail-item disaster'; el.dataset.id = d.id;
      el.innerHTML = `<div class="rail-icon">${d.glyph}</div><div><div class="rail-name">${d.name}</div><div class="rail-desc">${d.desc}</div></div><div class="rail-key">${d.key||''}</div>`;
      el.addEventListener('click', () => {
        d.run(state);
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 400);
      });
      wrap.appendChild(el);
    });
  }

  function spawnStructure() {
    state.structuresBuilt.forEach(b => { try { M.Composite.remove(world,b); } catch(e){} });
    state.structuresBuilt = []; state.bonds.forEach(c => { try { M.Composite.remove(world,c); } catch(e){} }); state.bonds = [];
    state.destroyed = 0;
    M.Composite.allBodies(world).forEach(b => { if (b.isStatic) return; M.Composite.remove(world,b); });
    M.Composite.allConstraints(world).forEach(c => { try { M.Composite.remove(world,c); } catch(e){} });
    state.effects.length = 0; trailLayer.length = 0; state.shakeAmt = 0; state.shots = 0;
    // Cancel any active disasters so a lingering tornado/gravity-flip can't wreck the fresh build
    state.tornado = null;
    state.tsunami = null;
    if (state._gravTimer) { clearTimeout(state._gravTimer); state._gravTimer = null; }
    state.gravFlip = null;
    state.engine.world.gravity.y = parseFloat(document.getElementById('g-slider')?.value || '1');
    const bodies0 = state.structure.build(state);
    scaleCluster(bodies0, state.scale, { x: state.arena.centerX, y: state.arena.groundY });
    const bodies = subdivideCluster(bodies0, state.subdivLevel, state.arena.groundY);
    bodies.forEach(b => { M.Composite.add(world,b); M.Sleeping.set(b,true); });
    state.structuresBuilt = bodies; state.initialPartCount = bodies.length;
    bondNeighbors(bodies);
    bodies.forEach(b => {
      M.Body.setVelocity(b, { x: 0, y: 0 });
      M.Body.setAngularVelocity(b, 0);
      M.Sleeping.set(b, true);
    });
    document.querySelectorAll('#district-list .rail-item').forEach(el => el.classList.remove('active'));
    updateMeter();
  }

  function clearArena() {
    M.Composite.allBodies(world).forEach(b => { if (b.isStatic) return; M.Composite.remove(world,b); });
    state.structuresBuilt=[]; state.initialPartCount=0; state.destroyed=0; updateMeter();
  }
  function resetWorld() { clearArena(); state.shots=0; state.effects=[]; updateMeter(); }

  function updateMeter() {
    const alive=state.structuresBuilt.filter(b=>b.position&&Math.abs(b.position.y)<4000&&Math.abs(b.position.x)<4000).length;
    const total=state.initialPartCount;
    document.getElementById('stat-parts').textContent=total;
    document.getElementById('stat-destroyed').textContent=Math.max(0,total-alive);
    document.getElementById('stat-shots').textContent=state.shots;
  }

  // ---- input ----
  let dragging=false, dragFrom=null, dragTo=null;
  let lastCursor = null;
  const aimReadout=document.getElementById('aim-readout');
  canvas.addEventListener('pointerdown', e => { dragging=true; dragFrom=dragTo={ x:e.clientX, y:e.clientY }; });
  window.addEventListener('pointermove', e => {
    lastCursor = { x: e.clientX, y: e.clientY };
    if (!dragging) return;
    dragTo={ x:e.clientX, y:e.clientY };
    const dx=dragTo.x-dragFrom.x, dy=dragTo.y-dragFrom.y;
    aimReadout.style.display='block'; aimReadout.style.left=(e.clientX+16)+'px'; aimReadout.style.top=(e.clientY+16)+'px';
    aimReadout.textContent=`${Math.round(Math.hypot(dx,dy))}px · ${(Math.atan2(dy,dx)*180/Math.PI).toFixed(0)}°`;
  });
  window.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging=false; aimReadout.style.display='none';
    let to={ x:e.clientX, y:e.clientY };
    if (Math.hypot(to.x-dragFrom.x,to.y-dragFrom.y)<6) to={ x:state.arena.centerX, y:state.arena.groundY-100 };
    fire(dragFrom, to);
  });
  function fire(from, to) { if (!state.weapon) return; state.weapon.fire(state,from,to); state.shots++; updateMeter(); }

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key>='1'&&e.key<='9') { const idx=parseInt(e.key,10)-1; if(WEAPONS[idx]) selectWeapon(WEAPONS[idx].id); }
    else if (e.key==='0') { if(WEAPONS[9]) selectWeapon(WEAPONS[9].id); }
    else if (e.key===' ') { e.preventDefault(); spawnStructure(); }
    else if (e.key.toLowerCase()==='r') resetWorld();
    else if (e.key.toLowerCase()==='c') clearArena();
    else if (e.key.toLowerCase()==='h') document.body.classList.toggle('rails-hidden');
    // disaster keys
    else {
      const d=DISASTERS.find(d=>d.key&&d.key.toLowerCase()===e.key.toLowerCase());
      if (d) d.run(state);
    }
  });

  document.getElementById('btn-clear').addEventListener('click', clearArena);
  document.getElementById('btn-reset').addEventListener('click', resetWorld);

  const gSlider=document.getElementById('g-slider'), gOut=document.getElementById('g-out');
  gSlider.addEventListener('input',()=>{ const v=parseFloat(gSlider.value); engine.world.gravity.y=v; gOut.textContent=v.toFixed(2); });
  const pSlider=document.getElementById('p-slider'), pOut=document.getElementById('p-out');
  pSlider.addEventListener('input',()=>{ state.power=parseFloat(pSlider.value); pOut.textContent=state.power; });
  const iSlider=document.getElementById('i-slider'), iOut=document.getElementById('i-out');
  if (iSlider) iSlider.addEventListener('input',()=>{ iOut.textContent=iSlider.value; });
  const speedSlider = document.getElementById('speed-slider'), speedOut = document.getElementById('speed-out');
  if (speedSlider) {
    speedSlider.addEventListener('input', () => {
      state.gameSpeed = parseFloat(speedSlider.value);
      speedOut.textContent = state.gameSpeed.toFixed(1) + '×';
    });
  }
  // Customization sliders — scale, detail, debris cap
  const scaleSlider = document.getElementById('scale-slider'), scaleOut = document.getElementById('scale-out');
  if (scaleSlider) {
    scaleSlider.addEventListener('input', () => {
      state.scale = parseFloat(scaleSlider.value);
      scaleOut.textContent = state.scale.toFixed(1) + '×';
    });
  }
  const subdivSlider = document.getElementById('subdiv-slider'), subdivOut = document.getElementById('subdiv-out');
  if (subdivSlider) {
    subdivSlider.addEventListener('input', () => {
      state.subdivLevel = parseFloat(subdivSlider.value);
      subdivOut.textContent = state.subdivLevel.toFixed(1) + '×';
    });
  }
  const capSlider = document.getElementById('cap-slider'), capOut = document.getElementById('cap-out');
  if (capSlider) {
    capSlider.addEventListener('input', () => {
      state.debrisCap = parseInt(capSlider.value, 10);
      capOut.textContent = state.debrisCap;
    });
  }
  document.getElementById('t-debris').addEventListener('change',e=>state.options.debris=e.target.checked);
  document.getElementById('t-trails').addEventListener('change',e=>state.options.trails=e.target.checked);
  document.getElementById('t-shake').addEventListener('change',e=>state.options.shake=e.target.checked);
  const slowToggle=document.getElementById('t-slowmo');
  if (slowToggle) slowToggle.addEventListener('change',e=>{ state.options.slowmo=e.target.checked; });

  // ---- collision events ----
  M.Events.on(engine,'collisionStart',ev=>{
    ev.pairs.forEach(p=>{
      [p.bodyA,p.bodyB].forEach(b=>{
        if (b._onCollide&&(p.bodyA.isStatic||p.bodyB.isStatic||p.bodyA.label==='block'||p.bodyB.label==='block')) {
          b._onCollide(); b._onCollide=null;
        }
      });
      [p.bodyA,p.bodyB].forEach(b=>{
        if (b.plugin&&b.plugin.material==='glass'&&!b._shattered) {
          const other=b===p.bodyA?p.bodyB:p.bodyA;
          const v=Math.hypot(other.velocity?.x||0,other.velocity?.y||0);
          if (v>6) {
            b._shattered=true;
            const cx=b.position.x, cy=b.position.y;
            setTimeout(()=>{
              try { M.Composite.remove(world,b); } catch(e){}
              if (!state.options.debris) return;
              for (let i=0;i<5;i++) {
                const shard=M.Bodies.polygon(cx+(Math.random()-.5)*8,cy+(Math.random()-.5)*8,3,4+Math.random()*4,{
                  density:0.001,friction:0.3,restitution:0.3,
                  render:{ fillStyle:'rgba(124,198,255,0.7)', strokeStyle:'#7cc6ff', lineWidth:1 },label:'shard'
                });
                M.Body.setVelocity(shard,{ x:(Math.random()-.5)*6, y:-Math.random()*4 });
                M.Composite.add(world,shard);
                setTimeout(()=>{ try { M.Composite.remove(world,shard); } catch(e){} },4000);
              }
            },0);
          }
        }
      });
    });
  });

  // ---- render loop ----
  let lastT=performance.now(), fpsAcc=0, fpsFrames=0, lastFps=0;
  const trailLayer=[];

  function render(now) {
    const dt=Math.min(33,now-lastT); lastT=now;
    const baseStep = state.options.slowmo ? 1000/180 : 1000/60;
    const stepMs = baseStep * (state.gameSpeed || 1);
    M.Engine.update(engine, stepMs);

    // ── Despawn pass — keep loose debris count under a cap so the world
    //    doesn't grind to a halt. Detached blocks/shards/projectiles past
    //    their use are removed oldest-first.
    state._frame = (state._frame || 0) + 1;
    if (state._frame % 30 === 0) {
      const MAX_LOOSE = state.debrisCap;
      const MAX_PROJECTILES = state.projectileCap;
      const PROJECTILE_TTL = 8000; // ms before a projectile auto-despawns
      const PROJ_LABELS = ['rocket','meteor','grenade','gravbomb','wrecker','projectile'];
      const loose = [];
      const projectiles = [];
      // First: kill anything that fell off-screen, and stamp a birth time on
      // projectiles the first time we see them.
      M.Composite.allBodies(world).forEach(b => {
        if (b.isStatic) return;
        if (b.position && (b.position.y > H + 600 || b.position.x < -800 || b.position.x > W + 800)) {
          try { M.Composite.remove(world, b); } catch(e){}
          const idx = state.structuresBuilt.indexOf(b);
          if (idx >= 0) state.structuresBuilt.splice(idx, 1);
          return;
        }
        if (PROJ_LABELS.includes(b.label)) {
          if (b._bornAt == null) b._bornAt = now;
          projectiles.push(b);
        }
      });
      // Projectile despawn — time-based and count-based
      projectiles.forEach(b => {
        if (now - b._bornAt > PROJECTILE_TTL) {
          try { M.Composite.remove(world, b); } catch(e){}
          if (b.position) {
            state.addEffect({ kind:'spark', x:b.position.x, y:b.position.y, vx:0, vy:-1.2,
              life:18, max:18, color:'rgba(255,170,68,0.6)' });
          }
        }
      });
      // Hard cap on live projectile count — oldest go first
      const live = projectiles.filter(b => b.position);
      if (live.length > MAX_PROJECTILES) {
        live.sort((a, b) => (a._bornAt || 0) - (b._bornAt || 0));
        const cull = live.length - MAX_PROJECTILES;
        for (let i = 0; i < cull; i++) {
          try { M.Composite.remove(world, live[i]); } catch(e){}
        }
      }
      // Loose detached debris cap (excludes projectiles handled above)
      M.Composite.allBodies(world).forEach(b => {
        if (b.isStatic) return;
        if (PROJ_LABELS.includes(b.label)) return;
        if (b.label === 'block' && b._bonds && b._bonds.length > 0) return;
        loose.push(b);
      });
      if (loose.length > MAX_LOOSE) {
        loose.sort((a, b) => a.id - b.id);
        const toRemove = loose.length - MAX_LOOSE;
        for (let i = 0; i < toRemove; i++) {
          const b = loose[i];
          try { M.Composite.remove(world, b); } catch(e){}
          const idx = state.structuresBuilt.indexOf(b);
          if (idx >= 0) state.structuresBuilt.splice(idx, 1);
          if (b.position) {
            state.addEffect({ kind:'spark', x:b.position.x, y:b.position.y, vx:0, vy:-1.2,
              life:14, max:14, color:'rgba(180,180,180,0.55)' });
          }
        }
      }
    }

    // ── Bond stress & fracture ─────────────────────────────────────────────
    // Each frame: measure strain, accumulate fatigue, snap when threshold is crossed.
    // Fatigue means repeated sub-threshold stress still eventually breaks a bond —
    // a structure shaken by an earthquake will crumble even without a direct hit.
    for (let i = state.bonds.length - 1; i >= 0; i--) {
      const c = state.bonds[i];
      if (!c.bodyA || !c.bodyB) { state.bonds.splice(i, 1); continue; }

      // Settle grace: ignore bond stress entirely for the first ~2s so gravity
      // can compact the stack without snapping any bonds.
      if (c._settle > 0) {
        c._settle--;
        // Re-baseline rest length on the last settle frame so any compression
        // that occurred during settling becomes the new "zero strain" state.
        if (c._settle === 0) {
          const sdx = c.bodyA.position.x - c.bodyB.position.x;
          const sdy = c.bodyA.position.y - c.bodyB.position.y;
          c._restLen = Math.hypot(sdx, sdy);
          c.length = c._restLen;
        }
        continue;
      }

      // Both bodies asleep → structure has settled, bonds are not actually
      // strained. Skip break/fatigue check so gravity-settling at spawn can't
      // self-destruct a tower.
      if (c.bodyA.isSleeping && c.bodyB.isSleeping) continue;

      const dx   = c.bodyA.position.x - c.bodyB.position.x;
      const dy   = c.bodyA.position.y - c.bodyB.position.y;
      const dist = Math.hypot(dx, dy);
      const strain = Math.abs(dist - c._restLen);

      // Relative velocity — a hard whack creates a big velocity differential
      // BEFORE positions separate. This is what makes towers shatter on impact.
      const vdx = (c.bodyA.velocity.x || 0) - (c.bodyB.velocity.x || 0);
      const vdy = (c.bodyA.velocity.y || 0) - (c.bodyB.velocity.y || 0);
      const vrel = Math.hypot(vdx, vdy);
      const velSnap = vrel > c._breakStrain * 0.16;

      // Accumulate fatigue proportional to how much the bond is strained above ~5% of threshold.
      // Sub-threshold micro-strain still chips away at the bond over time.
      if (strain > c._breakStrain * 0.03) {
        c._fatigue += strain * 1.6;
      }

      const snap = strain > c._breakStrain || c._fatigue >= c._maxFatigue || velSnap;
      if (!snap) continue;

      // ── Snap the bond ──────────────────────────────────────────────────
      try { M.Composite.remove(world, c); } catch (e) {}
      state.bonds.splice(i, 1);

      const a = c.bodyA, b = c.bodyB;
      if (a._bonds) a._bonds = a._bonds.filter(x => x !== c);
      if (b._bonds) b._bonds = b._bonds.filter(x => x !== c);

      // ── Localized damage model ─────────────────────────────────────────
      // Damage is the share of a body's original bonds that have snapped.
      // Cascade only fires once a body crosses 50% damage — until then,
      // hits stay confined to the bond that took them. Past 50%, the body
      // is considered compromised and remaining bonds weaken proportionally.
      const damageOf = (body) => {
        const orig = body._originalBondCount || 0;
        if (orig <= 0) return 0;
        return 1 - (body._bonds?.length || 0) / orig;
      };
      const cascadeFrom = (body, otherFatigue) => {
        const d = damageOf(body);
        if (d < 0.5) return; // still structurally sound — no spread
        // Past the threshold, weaken remaining bonds: 50%→0% loss, 100%→55% loss
        const weakenFactor = 1 - (d - 0.5) * 1.1;
        const fatigueShare = (d - 0.5) * 0.8; // fraction of fatigue passed on
        (body._bonds || []).forEach(n => {
          n._breakStrain *= weakenFactor;
          n._fatigue     += otherFatigue * fatigueShare;
        });
      };
      cascadeFrom(a, c._fatigue);
      cascadeFrom(b, c._fatigue);

      // Small separation kick so pieces visibly detach
      const ocx  = (a.position.x + b.position.x) / 2;
      const ocy  = (a.position.y + b.position.y) / 2;
      const kick = 0.0006;
      M.Body.applyForce(a, a.position, { x: (a.position.x - ocx) * kick, y: (a.position.y - ocy) * kick - 0.0003 });
      M.Body.applyForce(b, b.position, { x: (b.position.x - ocx) * kick, y: (b.position.y - ocy) * kick - 0.0003 });

      // Crack dust — more particles for a violent snap, fewer for fatigue failure
      const violence = Math.min(1, strain / c._breakStrain);
      const puffCount = 3 + Math.floor(violence * 10);
      for (let k = 0; k < puffCount; k++) {
        state.effects.push({
          kind: 'spark',
          x: ocx + (Math.random() - 0.5) * 10,
          y: ocy + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * (1.5 + violence * 3),
          vy: (Math.random() - 0.5) * 2 - 0.6,
          life: 14 + Math.random() * 18, max: 32,
          color: `rgba(${180 + Math.floor(violence*60)},${170 - Math.floor(violence*60)},${140 - Math.floor(violence*60)},0.75)`
        });
      }
    }

    tickDisasters(state);

    // ── Background: gradient + stars + clouds + parallax silhouettes ──────
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0,    '#070912');
    skyGrad.addColorStop(0.45, '#0d1320');
    skyGrad.addColorStop(0.75, '#1a1a26');
    skyGrad.addColorStop(1,    '#241a1c');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);

    // Subtle horizon glow
    const glow = ctx.createRadialGradient(W*0.5, H*0.78, 0, W*0.5, H*0.78, W*0.6);
    glow.addColorStop(0, 'rgba(255,122,26,0.10)');
    glow.addColorStop(1, 'rgba(255,122,26,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // Stars
    bg.stars.forEach(s => {
      s.tw += s.sp;
      const a = 0.45 + Math.sin(s.tw)*0.35;
      ctx.fillStyle = `rgba(220,230,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    });

    // Clouds — soft elongated blobs drifting right
    bg.clouds.forEach(c => {
      c.x += c.vx; if (c.x - c.w > W) c.x = -c.w;
      ctx.fillStyle = 'rgba(180,190,210,0.06)';
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI*2); ctx.fill();
    });

    // Far mountain ridge
    ctx.fillStyle = '#141822';
    ctx.beginPath(); ctx.moveTo(0, H);
    bg.mountainsFar.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

    // Mid mountain ridge
    ctx.fillStyle = '#0e1219';
    ctx.beginPath(); ctx.moveTo(0, H);
    bg.mountainsMid.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

    // Distant city skyline (silhouette behind the action)
    const skyBase = H - 60;
    bg.skyline.forEach(b => {
      ctx.fillStyle = '#080a10';
      ctx.fillRect(b.x, skyBase - b.h, b.w, b.h);
      // Windows
      ctx.fillStyle = 'rgba(255,200,120,0.25)';
      for (let wy = skyBase - b.h + 8; wy < skyBase - 6; wy += 12) {
        for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 10) {
          if ((wx + wy) % 30 < 6) ctx.fillRect(wx, wy, 2, 4);
        }
      }
    });

    // Grid overlay (faint)
    ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.025)'; ctx.lineWidth=1;
    const grid=40;
    for (let x=0;x<W;x+=grid) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for (let y=0;y<H;y+=grid) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
    ctx.restore();

    let sx=0, sy=0;
    if (state.shakeAmt>0.1) { sx=(Math.random()-0.5)*state.shakeAmt; sy=(Math.random()-0.5)*state.shakeAmt; state.shakeAmt*=0.86; }
    ctx.save(); ctx.translate(sx,sy);

    ctx.fillStyle='#1a1f27'; ctx.fillRect(0,H-40,W,40);
    ctx.fillStyle='#0f1318'; ctx.fillRect(0,H-40,W,3);
    ctx.fillStyle='rgba(255,122,26,0.4)'; ctx.font='10px ui-monospace,monospace';
    for (let x=40;x<W;x+=120) ctx.fillRect(x,H-38,30,2);

    const bodies=M.Composite.allBodies(world);
    bodies.forEach(b=>{
      if (b.render&&b.render.visible===false) return;
      if (b.isStatic&&b.label!=='block') return;
      drawBody(b);
      if (state.options.trails&&['projectile','rocket','grenade','wrecker'].includes(b.label))
        trailLayer.push({ x:b.position.x,y:b.position.y,life:30,max:30,color:b.label==='rocket'?'#ff7a1a':'#ffaa44' });
    });

    const constraints=M.Composite.allConstraints(world);
    constraints.forEach(c=>{
      if (c.render&&c.render.visible===false) return;
      const a=c.bodyA?{x:c.bodyA.position.x+c.pointA.x,y:c.bodyA.position.y+c.pointA.y}:c.pointA;
      const b=c.bodyB?{x:c.bodyB.position.x+c.pointB.x,y:c.bodyB.position.y+c.pointB.y}:c.pointB;
      ctx.strokeStyle=c.render.strokeStyle||'#5a6473'; ctx.lineWidth=c.render.lineWidth||1;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    });

    for (let i=trailLayer.length-1;i>=0;i--) {
      const t=trailLayer[i]; ctx.fillStyle=t.color; ctx.globalAlpha=(t.life/t.max)*0.5;
      ctx.beginPath();ctx.arc(t.x,t.y,3*(t.life/t.max),0,Math.PI*2);ctx.fill(); ctx.globalAlpha=1;
      t.life--; if(t.life<=0) trailLayer.splice(i,1);
    }

    for (let i=state.effects.length-1;i>=0;i--) {
      const e=state.effects[i]; drawEffect(e);
      if (e.kind==='spark') { e.x+=e.vx; e.y+=e.vy; e.vy+=0.2; e.vx*=0.99; }
      e.life--; if(e.life<=0) state.effects.splice(i,1);
    }

    if (dragging&&dragFrom&&dragTo) {
      const dx=dragTo.x-dragFrom.x, dy=dragTo.y-dragFrom.y, len=Math.hypot(dx,dy);
      const dirx=dx/(len||1), diry=dy/(len||1);
      ctx.save(); ctx.strokeStyle='#ff7a1a'; ctx.lineWidth=2; ctx.setLineDash([6,6]);
      ctx.beginPath();ctx.moveTo(dragFrom.x,dragFrom.y);ctx.lineTo(dragFrom.x+dirx*Math.min(len*6,600),dragFrom.y+diry*Math.min(len*6,600));ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='#ff7a1a'; ctx.beginPath();ctx.arc(dragFrom.x,dragFrom.y,5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,122,26,0.5)'; ctx.beginPath();ctx.arc(dragFrom.x,dragFrom.y,Math.min(len,120),0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    fpsAcc+=dt; fpsFrames++;
    if (fpsAcc>500) {
      lastFps=Math.round(1000/(fpsAcc/fpsFrames));
      document.getElementById('fps').textContent=lastFps;
      document.getElementById('bodies').textContent=bodies.length;
      fpsAcc=0; fpsFrames=0; updateMeter();
    }

    bodies.forEach(b=>{
      if (b.isStatic) return;
      if (b.position.y>H+400||b.position.y<-2000||b.position.x<-400||b.position.x>W+400)
        try { M.Composite.remove(world,b); } catch(e){}
    });

    requestAnimationFrame(render);
  }

  function drawBody(b) {
    if (!b.vertices||b.vertices.length===0) return;
    ctx.beginPath(); ctx.moveTo(b.vertices[0].x,b.vertices[0].y);
    for (let i=1;i<b.vertices.length;i++) ctx.lineTo(b.vertices[i].x,b.vertices[i].y);
    ctx.closePath();
    if (b.render?.fillStyle) { ctx.fillStyle=b.render.fillStyle; ctx.fill(); }
    if (b.render?.strokeStyle) { ctx.strokeStyle=b.render.strokeStyle; ctx.lineWidth=b.render.lineWidth||1; ctx.stroke(); }
    if (b.circleRadius&&b.label!=='shard') {
      ctx.save(); ctx.translate(b.position.x,b.position.y); ctx.rotate(b.angle);
      ctx.strokeStyle=b.render.strokeStyle||'#fff'; ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(b.circleRadius,0);ctx.stroke(); ctx.restore();
    }
  }

  function drawEffect(e) {
    if (e.kind==='spark') {
      ctx.globalAlpha=e.life/e.max; ctx.fillStyle=e.color;
      ctx.beginPath();ctx.arc(e.x,e.y,2+(e.life/e.max)*2,0,Math.PI*2);ctx.fill(); ctx.globalAlpha=1;
    } else if (e.kind==='shockwave') {
      const t=1-e.life/e.max;
      ctx.strokeStyle=`rgba(255,122,26,${1-t})`; ctx.lineWidth=3*(1-t);
      ctx.beginPath();ctx.arc(e.x,e.y,t*e.radius,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=`rgba(255,220,100,${(1-t)*0.6})`; ctx.lineWidth=6*(1-t);
      ctx.beginPath();ctx.arc(e.x,e.y,t*e.radius*0.7,0,Math.PI*2);ctx.stroke();
    } else if (e.kind==='laser') {
      const a=e.life/e.max;
      ctx.strokeStyle=`rgba(255,80,80,${a})`; ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(e.x1,e.y1);ctx.lineTo(e.x2,e.y2);ctx.stroke();
      ctx.strokeStyle=`rgba(255,255,255,${a})`; ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(e.x1,e.y1);ctx.lineTo(e.x2,e.y2);ctx.stroke();
    } else if (e.kind==='singularity') {
      const t=1-e.life/e.max, r=6+t*40;
      const grad=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,r);
      grad.addColorStop(0,'rgba(124,77,255,0.9)'); grad.addColorStop(0.6,'rgba(124,77,255,0.3)'); grad.addColorStop(1,'rgba(124,77,255,0)');
      ctx.fillStyle=grad; ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.fill();
    } else if (e.kind==='lightning') {
      const a=e.life/e.max;
      ctx.strokeStyle=`rgba(100,160,255,${a*0.5})`; ctx.lineWidth=6;
      e.bolts.forEach(s=>{ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();});
      ctx.strokeStyle=`rgba(255,255,220,${a})`; ctx.lineWidth=1.5;
      e.bolts.forEach(s=>{ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();});
    } else if (e.kind==='nukeFlash') {
      ctx.fillStyle=`rgba(255,245,200,${(e.life/e.max)*0.75})`; ctx.fillRect(0,0,W,H);
    }
  }

  document.getElementById('boot-go').addEventListener('click',()=>{
    document.getElementById('boot').classList.add('hide');
    setTimeout(()=>spawnStructure(),200);
  });

  resize();
  buildWeaponList();
  buildStructureList();
  buildDistrictList();
  buildDisasterList();
  requestAnimationFrame(render);
})();
