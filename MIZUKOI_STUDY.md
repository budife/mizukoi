# Mizukoi — Complete Codebase Reference

**Mizukoi** is a procedurally animated interactive koi pond built with React, TypeScript, Three.js, and Vite. Forked from [msk1039/nagomi](https://github.com/msk1039/nagomi).

- **Repo**: https://github.com/budife/mizukoi
- **Live**: https://mizukoi.budd.my.id/
- **Internal Canvas**: 480 × 270 logical pixels
- **Simulation Clock**: Fixed 60 Hz
- **Rendering**: Capped at 60/30/20 fps (user-configurable)

---

## Project Structure

```
mizukoi/
├── src/
│   ├── app.tsx                    # React root, animation loop, UI state
│   ├── main.tsx                   # React DOM init + Vercel analytics
│   ├── config.ts                  # Re-export live settings (FISH, WATER, etc.)
│   ├── config-editor.tsx          # Settings drawer UI
│   ├── quick-settings.tsx         # Floating quick-access settings
│   ├── settings-controls.tsx      # Settings control components
│   ├── koi.ts                     # Single fish state & reset
│   ├── school.ts                  # Fish collective behavior & AI
│   ├── fish-renderer.ts           # Three.js fish mesh building & rendering
│   ├── water-surface.ts           # Water shader (refraction, ripples, tint)
│   ├── weather.ts                 # 7 weather presets + definitions
│   ├── ripple-system.ts           # Ripple event pooling
│   ├── lotus-leaves.ts            # Lotus, flower, duckweed geometry
│   ├── butterflies.ts             # Butterfly animation
│   ├── tiny-fish.ts               # Tiny fish school AI + rendering
│   ├── tiny-fish-renderer.ts      # Tiny fish renderer
│   ├── pond-bed.ts                # Pond bed geometry & colors
│   ├── fish-appearance.ts         # Fish coloring & pattern system
│   ├── duckweed.ts                # Duckweed patch data
│   ├── duckweed-geometry.ts       # Duckweed mesh generation
│   ├── butterflies.ts             # Butterfly spawning & animation
│   ├── surface-disturbance.ts     # Ripple height map updates
│   ├── audio-config.ts            # Audio settings (volumes, sources)
│   ├── performance-prefs.ts       # Frame rate preferences + persistence
│   ├── frame-limiter.ts           # FPS capping logic
│   ├── math.ts                    # Vector math, RNG (XorShift32)
│   ├── styles.css                 # Tailwind CSS + custom styles
│   ├── vite-env.d.ts              # Vite environment types
│   ├── hooks/
│   │   ├── use-mobile.ts          # Mobile detection hook
│   │   └── use-controllable-state.tsx
│   ├── components/
│   │   ├── ui/                    # shadcn components (Button, Switch, etc.)
│   │   ├── github-stars.tsx       # GitHub stars badge
│   │   └── wallpaper-app-link.tsx # External app link
│   ├── settings/
│   │   ├── definition.ts          # Schema: all settings with bounds & effects
│   │   ├── store.ts               # Reactive store (defaults ⊕ weather ⊕ edits)
│   │   ├── persistence.ts         # localStorage read/write + v1→v2 migration
│   │   ├── effects.ts             # Setting change handlers (e.g., "koi:count")
│   │   ├── react.ts               # useSettingsMeta() hook
│   │   ├── schema.ts              # Settings type definitions
│   │   └── [*.test.ts]            # Unit tests
│   └── lib/
│       └── utils.ts               # clsx + tailwind-merge utilities
├── docs/
│   └── how-it-works.md            # User-facing procedural animation guide
├── public/
│   ├── audio/                     # .m4a ambient sounds
│   ├── nagomi-social-v1.png       # Social share image
│   └── sitemap.xml
├── components.json                # shadcn component config
├── vite.config.ts
├── tsconfig.json
├── package.json
├── wrangler.jsonc                 # Cloudflare Workers config (optional)
└── pnpm-workspace.yaml            # pnpm monorepo marker
```

---

## Core Simulation

### 1. Animation Loop (app.tsx)

The heart of Mizukoi is a **fixed-timestep update loop with variable frame rate rendering**.

```typescript
// Simplified pseudocode
let accumulator = 0;
let simulationTime = 0;
let previousTime = performance.now();
const FIXED_STEP = 1 / 60;  // 16.67 ms

function animate(now: number) {
  // Frame rate limiting
  const targetFps = frameRateOption(frameRateCap).fps;
  if (!frameLimiter.shouldRender(now, targetFps)) {
    requestAnimationFrame(animate);
    return;
  }

  // Accumulate time
  accumulator += Math.min((now - previousTime) / 1000, 0.1);
  previousTime = now;

  // Fixed timesteps
  while (accumulator >= FIXED_STEP) {
    simulationTime += FIXED_STEP;
    school.update(FIXED_STEP, simulationTime);  // ← All behavior updates
    accumulator -= FIXED_STEP;
  }

  // Render frame
  renderer.draw(school, simulationTime, showDebug);
  requestAnimationFrame(animate);
}
```

**Why this design?**
- Simulation always runs at 60 Hz (predictable, stable)
- Rendering can cap at 60/30/20 fps (battery / performance trade-off)
- **Result**: Smooth movement even on low-refresh displays

**Frame Rate Capping** (frame-limiter.ts):
```typescript
shouldRender(now: number, targetFps: number): boolean {
  const targetFrameTime = 1000 / targetFps;  // ms per frame
  const elapsed = now - lastRenderTime;
  if (elapsed >= targetFrameTime) {
    lastRenderTime = now;
    return true;
  }
  return false;
}
```

### 2. Fish State (koi.ts)

Every koi is a `Koi` object with complete behavioral state:

**Position & Movement:**
- `position: Vec2` — Current (x, y) in pond space (480 × 270)
- `velocity: Vec2` — Direction vector
- `heading: number` — Facing angle (radians, 0 = right)
- `angularVelocity: number` — Turning rate (rad/frame)
- `speed: number` — Current forward speed

**Personality** (randomized on spawn):
```typescript
cruiseSpeed = random(13, 21)      // Preferred speed
maximumSpeed = cruiseSpeed × random(1.55, 1.9)
turnStrength = random(4.4, 6.8)   // Steering agility
reactivity = random(0.35, 1.0)    // Responsiveness to neighbors
```

**Body & Animation:**
- `spine[14]: Vec2[]` — 14 invisible nodes (head → tail chain)
- `renderSpine[14]: Vec2[]` — Spine after wave deformation
- `bodyLength, bodyWidth` — Physical dimensions
- `swimPhase: number` — Tail wave cycle (0 to 2π)
- `tailEffort: number` — Wave amplitude control

**Swimming State Machine:**
```typescript
enum SwimState {
  Glide = 0,    // Relaxed, normal swimming
  Coast = 1,    // Slowing down, minimal tail
  Hover = 2,    // Nearly stationary
  Burst = 3,    // Fast, responsive burst
  Pivot = 4,    // Sharp, deliberate turn
}
```

Each fish changes state at different times (not synchronized):
```typescript
stateAge += dt;
if (stateAge >= stateDuration) {
  state = nextState();           // Transition
  stateDuration = random(1, 3);  // 1-3s in new state
}
```

**Depth** (z-axis through water):
```typescript
depth: number                    // 0 = surface, 1 = deep
targetDepth: number             // Where fish wants to go
depthTransitionRate: number     // Smoothing factor (0.3-3.0)

// Smooth depth change each frame
depth = lerp(depth, targetDepth, depthTransitionRate * dt);
```

**Call Response:**
```typescript
callDelay: number               // Response delay (distance + reactivity)
respondedToCall: boolean        // Has this fish responded?
callResponseAge: number         // How long since response started

// When user clicks pond → all nearby fish get callDelay
callDelay = distance(fish, clickPoint) * 0.05 + random(0, reactivity);
```

### 3. School Behavior (school.ts)

`School` manages **collective behavior** of up to 48 koi. Key method:

```typescript
public update(dt: number, simulationTime: number): void {
  // 1. Age the target (user click fades over time)
  this.targetAge += dt;
  if (this.targetAge > 1.5) {
    this.targetActive = false;
  }

  // 2. Per-fish behavior loop
  for (let i = 0; i < this.count; i++) {
    const fish = this.fish[i];
    
    // Compute steering intentions
    const wander = ...       // Slow random heading
    const cohesion = ...     // Move toward average neighbor position
    const alignment = ...    // Match average neighbor heading
    const separation = ...   // Repel from close neighbors
    const edges = ...        // Avoid pond boundaries (480×270)
    const target = ...       // Move toward click point (if active)
    
    // Blend intentions
    const steering = 
      wander * 1.0 +
      cohesion * 0.5 +
      alignment * 0.7 +
      separation * 1.2 +
      edges * 0.8 +
      target * 1.5;
    
    // Smooth angular velocity (no instant turns)
    fish.angularVelocity = lerp(
      fish.angularVelocity,
      clampAngle(steering - fish.heading) * fish.turnStrength,
      0.3  // Smoothing factor
    );
    fish.heading += fish.angularVelocity * dt;
    
    // Smooth speed transitions
    fish.speed = lerp(fish.speed, targetSpeed, 0.15);
    
    // Update position
    fish.position = add(fish.position, 
      mul(fromAngle(fish.heading), fish.speed * dt)
    );
    
    // Update spine (chain kinematics)
    fish.spine[0] = fish.position;
    for (let j = 1; j < SPINE_NODES; j++) {
      const parent = fish.spine[j - 1];
      const child = fish.spine[j];
      const diff = sub(parent, child);
      const dist = length(diff);
      const dir = normalize(diff);
      fish.spine[j] = add(parent, mul(dir, SPINE_LENGTH));
    }
    
    // Add swimming wave
    updateSwimmingWave(fish, dt);
    
    // Update depth (smooth transitions)
    fish.depth = lerp(fish.depth, fish.targetDepth, 
      fish.depthTransitionRate * dt);
  }

  // 3. Tiny fish schools
  this.tinyFish.update(dt, simulationTime);

  // 4. Ripple system
  this.ripples.update(dt);
}
```

**Steering Intentions Detailed:**

- **Wander**: Perlin-like noise added to heading
  ```typescript
  const wanderAngle = fish.wanderSeed + simulationTime * 2;
  const wanderForce = Math.sin(wanderAngle) * 0.5;
  ```

- **Cohesion**: Average position of nearby fish
  ```typescript
  const neighbors = getNearbyFish(fish, NEIGHBOR_RADIUS);
  const centerOfMass = neighbors.reduce((sum, n) => add(sum, n.position)) / neighbors.length;
  const toCenter = sub(centerOfMass, fish.position);
  const cohesionForce = normalize(toCenter) * 0.1;
  ```

- **Separation**: Repel from overlapping neighbors
  ```typescript
  for (const neighbor of neighbors) {
    const dist = distance(fish, neighbor);
    if (dist < MIN_SEPARATION) {
      const away = normalize(sub(fish.position, neighbor.position));
      separationForce += away * (1 - dist / MIN_SEPARATION);
    }
  }
  ```

- **Alignment**: Match direction of nearby fish
  ```typescript
  const avgHeading = neighbors.reduce((sum, n) => sum + n.heading) / neighbors.length;
  const alignmentForce = avgHeading - fish.heading;
  ```

- **Edge Avoidance**: Turn back from boundaries
  ```typescript
  if (fish.position.x < 30) edgeForce.x += 1;
  if (fish.position.x > 450) edgeForce.x -= 1;
  if (fish.position.y < 20) edgeForce.y += 1;
  if (fish.position.y > 250) edgeForce.y -= 1;
  ```

- **Target Following** (when user clicks):
  ```typescript
  if (this.targetActive && fish.callDelay <= 0) {
    const toTarget = sub(this.target, fish.position);
    const distance = length(toTarget);
    const strength = Math.max(0, 1 - distance / 100);
    const targetForce = normalize(toTarget) * strength;
  }
  ```

### 4. Procedural Spine & Body (koi.ts, fish-renderer.ts)

**The Spine Chain** (14 invisible points):

```
Head (point 0) — follows movement rules
  ↓
Point 1 — follows point 0, distance = L
  ↓
Point 2 — follows point 1, distance = L
  ↓
... 
  ↓
Point 13 (Tail) — follows point 12, distance = L
```

Each point maintains fixed distance from predecessor, creating a flexible chain that naturally "follows through" during turns.

**Swimming Wave**:
```typescript
for (let i = 0; i < SPINE_NODES; i++) {
  const baseNode = fish.spine[i];
  
  // Wave phase and amplitude
  const wavePhase = fish.swimPhase + i * waveFrequency;
  const amplitude = fish.tailEffort * (i / SPINE_NODES);  // Grows toward tail
  
  // Lateral offset (perpendicular to heading)
  const lateralOffset = Math.sin(wavePhase) * amplitude;
  const perpDir = perpendicular(heading);
  
  // Render spine position = base + offset
  fish.renderSpine[i] = add(baseNode, mul(perpDir, lateralOffset));
}
```

**Result**: Infinite pose variety from 14 nodes + one sine wave, no precomputed frames.

---

## Settings System

### Three-Layer Composition

Every setting has an **effective value** computed from:

```
effectiveValue = defaults[field] 
  ⊕ (weatherPreset[field] if it defines it)
  ⊕ (userEdit[field] if user changed it)
```

**Example: Water Tint**
1. Default: `[0.3, 0.5, 0.8]` (blue-ish)
2. User loads "Sunset" weather → Sunset preset says `[1.0, 0.6, 0.3]` → Use it
3. User manually drags water tint → User edit now takes precedence
4. User switches to "Rain" weather → Rain preset has its own tint, BUT user edit still wins
5. User touches the tint slider again → User edit clears, Rain's tint applies

### Schema System (settings/definition.ts)

Every setting declared **once** with full metadata:

```typescript
{
  key: "koi.initialCount",           // Path in store.live
  default: 12,                       // Default value
  min: 1,
  max: 48,                           // Bounds
  kind: "slider",                    // UI type: slider | color | switch | number | etc.
  effect: "koi:count",               // Which subsystem reacts: "koi:count" → school.setCount()
  keepsFamilyPreview: false,         // UI hint: does preview survive this change?
}
```

**Effect Tags** trigger handlers in `settings/effects.ts`:
```typescript
// When settings with effect="koi:count" change:
settings.subscribe((batch) => {
  if (batch.some(c => c.effect === "koi:count")) {
    school.setCount(settings.live.koi.initialCount);
  }
});
```

### Store (settings/store.ts)

Central reactive store:

```typescript
export const settings = {
  live: { /* mutable, read by simulation every frame */ },
  
  set(path: string[], value: any) {
    // Update user edit layer
    updatePath(overrides, path, value);
    // Recompute effective values & notify subscribers
    recompose();
    notifySubscribers(batch);
  },
  
  subscribe(callback: (batch: Change[]) => void) {
    // React to batches of changes
  },
  
  undo() { /* pop from history */ },
  resetSections(ids: SectionId[]) { /* revert groups */ },
  resetAll() { /* clear all edits */ },
};
```

### Persistence (settings/persistence.ts)

Saves **only user edits** (sparse):
```typescript
const saved = {
  version: 2,
  overrides: {
    "koi.initialCount": 18,           // User set count to 18
    "water.tint.r": 0.2,              // User changed water red channel
    // Only these are saved, not the full state
  }
};
localStorage.setItem("mizukoi:pond-settings:v2", JSON.stringify(saved));
```

**Migration** (v1 → v2):
```typescript
// Old v1 format stored full config
// New v2 only stores diffs
// On load: if v1 found, convert and save as v2
// Allows defaults to evolve without orphaning user data
```

### UI Generation (config-editor.tsx, quick-settings.tsx)

Settings UI auto-generates from schema:
1. Add field to `definition.ts`
2. UI component automatically created
3. No hand-written sliders needed
4. Type-safe & self-documenting

---

## Rendering System (Three.js Multi-Pass)

### Render Pipeline

Mizukoi draws the pond in **6 ordered passes**:

```
Pass 1: Pond Bed
  ├─ Deep color
  └─ Shallow color

Pass 2: Shadows
  ├─ Fish shadows (per-fish, correct depth order)
  └─ Plant shadows

Pass 3: Fish
  ├─ Large koi (from highest depth → lowest)
  └─ Tiny fish schools

Pass 4: Water Surface
  ├─ Refraction shader
  ├─ Ripple distortion
  ├─ Water tint
  └─ Fresnel (rim lighting)

Pass 5: Plants & Particles
  ├─ Lotus leaves
  ├─ Lotus flowers
  ├─ Duckweed patches
  └─ Butterflies

Pass 6: Weather
  ├─ Rain particles
  ├─ Cloud overlay
  └─ Lighting/color grading
```

**Render Targets** (offscreen textures):
- `renderTarget1` — Scene color + refraction info
- `renderTarget2` — Post-processed water surface

This layering lets the water shader distort underwater objects without distorting floating plants.

### Fish Renderer (fish-renderer.ts)

Per koi each frame:

```typescript
function renderFish(fish: Koi, depth: number, palette: KoiPalette) {
  // 1. Update spine wave
  updateSwimmingWave(fish, dt);
  
  // 2. Build geometry from spine
  const bodyMesh = buildBodyFromSpine(fish.renderSpine, fish.bodyWidth);
  const headMesh = buildHeadMesh(fish);
  const tailMesh = buildTailMesh(fish);
  const finMeshes = buildFins(fish);
  
  // 3. Apply coloring from palette
  bodyMesh.material.color = palette.color;
  applyPatterns(bodyMesh, palette.patterns);
  
  // 4. Set depth & transparency
  mesh.position.z = -depth;  // Deeper = lower z
  mesh.material.opacity = 1 - depth * 0.3;  // Fade with depth
  
  // 5. Render to render target
  renderer.render(scene, camera, renderTarget1);
}
```

### Water Surface Shader (water-surface.ts)

Fragment shader with:
- **Refraction** — Ripples bend light
- **Chromatic Aberration** — Color separation (subtle)
- **Water Tint** — Color overlay by depth
- **Fresnel** — Brighter at edges

```glsl
void main() {
  // Sample ripple height map
  vec2 rippleUV = vUv + rippleHeight * 0.05;
  
  // Refract
  vec2 refractUV = vUv + rippleUV * refractStrength;
  vec3 refracted = texture2D(sceneTexture, refractUV).rgb;
  
  // Water tint
  vec3 waterColor = mix(vec3(0.3, 0.5, 0.8), refracted, 0.7);
  
  // Fresnel (rim)
  float fresnel = pow(1.0 - dot(normal, viewDir), 2.0);
  vec3 finalColor = mix(waterColor, vec3(1.0), fresnel * 0.2);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
```

### Weather Presets (weather.ts)

7 presets, each supplies partial overrides:

```typescript
{
  id: "sunset",
  label: "Sunset",
  settings: {
    "water.tint": [1.0, 0.6, 0.3],
    "lighting.intensity": 1.2,
    "lighting.direction": [0.5, 0.3, 1.0],
    "koi-palettes": [/* palette overrides */],
    // Partial: only these fields apply
  }
}
```

---

## User Interaction

### Click / Tap to Call Fish

```typescript
canvas.addEventListener("pointerdown", (event) => {
  // Convert screen coords to pond space
  const bounds = canvas.getBoundingClientRect();
  const canvasX = (event.clientX - bounds.left) / bounds.width * CANVAS_WIDTH;
  const canvasY = (event.clientY - bounds.top) / bounds.height * CANVAS_HEIGHT;
  
  school.callTo(vec(canvasX, canvasY));
});

// In school.ts:
callTo(point: Vec2) {
  this.target = point;
  this.targetAge = 0;
  this.targetActive = true;
  
  // Ripple effect
  this.ripples.create(point, maxRadius, lifespan);
  
  // Each fish gets a response delay
  for (const fish of this.fish) {
    fish.callDelay = distance(fish, point) * 0.05 
                   + random(0, 1) * (1 - fish.reactivity);
  }
}
```

### Keyboard Controls

| Key | Action |
|-----|--------|
| `Space` | `school.scatter()` — Fish flee |
| `[` / `]` | Decrease / increase koi count |
| `D` | Toggle debug spine display |
| `H` | Toggle UI visibility |
| `R` | `school.reset()` — Fresh start |
| `F` | Toggle ambient (fullscreen) mode |

### Mobile Touch

- Tap reveals UI if hidden
- Swipe drawer open/close

---

## Performance Architecture

### Fixed Timestep Benefits

- **Deterministic** — Same input = same output
- **Stable** — Physics always updates at 60 Hz
- **Decoupled** — Rendering FPS independent of logic

### Pooling & Reuse

```typescript
// Ripples
ripples.create(point);     // Grabs from pool
ripples.update(dt);        // Reuses instances
ripples.dispose(ripple);   // Returns to pool

// Render targets
sceneRT = reuseRenderTarget(sceneRT, width, height);

// Geometry
fishGeometry.reuse();      // Transform, don't recreate
```

### Spatial Optimization

Neighbor queries use spatial hashing:
```typescript
getNearbyFish(fish, radius): Koi[] {
  const cellSize = 50;
  const cellX = Math.floor(fish.position.x / cellSize);
  const cellY = Math.floor(fish.position.y / cellSize);
  
  // Check only nearby cells, not all 48 fish
  return searchCells(cellX - 1 to cellX + 1, cellY - 1 to cellY + 1);
}
```

---

## Testing

### Unit Tests (Vitest)

```bash
npm run test
```

Tests cover:
- Settings persistence (v1 ↔ v2 migration)
- Store operations (set, undo, reset)
- Schema validation
- Frame rate logic
- Procedural geometry (duckweed)

Locations:
- `src/settings/persistence.test.ts`
- `src/settings/store.test.ts`
- `src/settings/schema.test.ts`
- `src/frame-limiter.test.ts`
- `src/duckweed-geometry.test.ts`
- `src/performance-prefs.test.ts`

---

## Deployment

### Local Development
```bash
npm install
npm run dev
```

Live at `http://localhost:5173`

### Production Build
```bash
npm run build    # TypeScript + Vite → dist/
npm run preview  # Test prod build locally
```

### Hosting

**Current Setup** (Maple VPS):
- Nginx Proxy Manager (NPM) for reverse proxy
- Domain: `mizukoi.budd.my.id`
- Static files served from `/srv/deploy/mizukoi/production/`
- Assets cached, HTML revalidated

---

## Key Design Patterns

### 1. Simulation ≠ Rendering

- `school.update(dt)` computes next state
- `renderer.draw()` displays it
- Decouples logic from graphics

### 2. Procedural Over Precomputed

- Every frame calculates fish pose
- No stored animations or frames
- Infinite variation from few rules

### 3. Settings as Single Source of Truth

- All config flows through `settings.live`
- Changes propagate via subscriptions
- No scattered constants

### 4. Smooth Transitions

- Heading, speed, depth all interpolated
- No instant changes = natural motion

### 5. Fixed Timestep

- Simulation runs at 60 Hz always
- Rendering cap independent
- Stable, deterministic behavior

### 6. Multi-Pass Rendering

- Each layer independent
- Easy to add/remove effects
- Modular composition

### 7. Sparse Persistence

- Only save user edits, not full state
- Allows defaults to evolve
- Small localStorage footprint

---

## File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `app.tsx` | ~920 | React root, animation loop, UI |
| `school.ts` | ~494 | Fish AI & collective behavior |
| `koi.ts` | ~110 | Single fish state |
| `fish-renderer.ts` | ~600 | Three.js fish rendering |
| `water-surface.ts` | ~300 | Water shader & surface |
| `weather.ts` | ~200 | Weather presets |
| `settings/definition.ts` | ~800 | Schema definitions |
| `settings/store.ts` | ~300 | Reactive store |
| `settings/persistence.ts` | ~200 | localStorage logic |
| `settings/effects.ts` | ~150 | Change handlers |
| `lotus-leaves.ts` | ~400 | Plant geometry |
| `tiny-fish.ts` | ~300 | Tiny fish AI |
| `ripple-system.ts` | ~150 | Ripple pooling |
| `config.ts` | ~88 | Settings re-export |
| `math.ts` | ~200 | Vector & RNG utilities |

---

## Quick Start Guide

### Clone & Install
```bash
cd /srv/projects
git clone https://github.com/budife/mizukoi.git
cd mizukoi
npm install
```

### Develop
```bash
npm run dev
# http://localhost:5173
```

### Customize

**Change fish count default** → `src/settings/definition.ts` → `koi.initialCount` default
**Add new weather** → `src/weather.ts` → Add preset object + icon in `app.tsx`
**Tune behavior** → `src/school.ts` → Adjust steering weights
**Modify colors** → `src/settings/definition.ts` → `koi-palettes` section

### Build & Deploy
```bash
npm run build
# Push dist/ to production host
```

---

## Key Insights

**Why Mizukoi feels alive:**
- Procedural animation (not pre-baked frames)
- Steering blending (multiple intentions, smooth results)
- Individual personalities (random speeds, sizes, reactivities)
- Smooth transitions (no instant changes)
- Responsive interaction (immediate ripple, depth rise)
- Depth dimension (visual layering, parallax feel)

**Why it's performant:**
- Fixed 60 Hz timestep (no wasted calculation)
- Pooling & reuse (low allocation/GC)
- Spatial partitioning (efficient neighbor queries)
- Frame rate cap (battery-friendly on mobile)
- Sparse settings (small localStorage)

**Why it's maintainable:**
- Schema-driven settings (UI auto-generates)
- Simulation ≠ rendering (modular)
- Reactive store (predictable updates)
- Type-safe (TypeScript throughout)
- Well-tested (unit tests for core logic)

---

**Mizukoi is a masterclass in interactive animation: simple rules + continuous evaluation = living, responsive experience.**
