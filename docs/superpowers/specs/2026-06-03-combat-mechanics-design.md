# Dino Chrome Combat & Projectile Shooting Specification

This specification outlines the design and implementation details for adding combat and projectile shooting mechanics to the Dino Chrome game. 

## Goals
- Add a projectile firing mechanic to help clear obstacles, controlled via the "F" key on desktop and a dedicated "SHOOT" button on mobile.
- Implement an ammo replenishment system using collectable ammo canisters spawning on the ground or in the air.
- Maintain retro-synthesized audio effects for shooting, reloads, and explosions.
- Support theme-specific visuals for projectiles, ammo containers, and explosion particle shards.
- Award bonus score when destroying obstacles.

---

## 1. System Architecture & Core Entities (in `combat.js`)

We will place all new combat classes and their drawing routines in a dedicated file, `combat.js`, loaded in `index.html` right before `game.js`.

### 1.1 `Projectile` Class
Handles individual bullets/projectiles fired by the Dino.
- **Properties**:
  - `x`: Current X position (starts at Dino's front edge).
  - `y`: Current Y position (aligned with the center of Dino's height).
  - `vx`: Velocity X (constant `600` pixels per second).
  - `vy`: Velocity Y (constant `0`).
  - `width`: 16 pixels.
  - `height`: 8 pixels.
  - `markedForDeletion`: Set to `true` when off-screen (`x > 810`) or on collision.
  - `theme`: The active theme name (cached on creation to determine styling).
- **Methods**:
  - `update(dt)`: Advances the projectile's position by `vx * dt`. If slow-motion power-up is active, the projectile moves at `1.0` multiplier (normal speed) to feel responsive, while obstacles move slower.
  - `draw(ctx)`: Renders custom retro styles based on the active theme.
  - `getHitbox()`: Returns the rectangle `{ x, y, width, height }`.

### 1.2 `AmmoPickup` Class
Collectable energy capsules that appear on the course.
- **Properties**:
  - `x`: Current X position (starts off-screen at `810`).
  - `y`: Current Y position. Either on the ground (`y = 220`) or floating (`y = 150`).
  - `width`: 20 pixels.
  - `height`: 20 pixels.
  - `markedForDeletion`: Set to `true` when collected or off-screen (`x + width < 0`).
  - `pulseTimer`: Counter incremented by `dt` to create a hovering vertical offset or glowing animation.
- **Methods**:
  - `update(dt)`: Scrolls left at the environment speed (`currentSpeed * dt`). If slow-motion power-up is active, scroll speed is halved.
  - `draw(ctx)`: Renders a retro pulsing/rotating fuel pack or energy canister.
  - `getHitbox()`: Returns the rectangle `{ x, y, width, height }`.

### 1.3 State Management
We will manage the combat state through these variables integrated in `game.js`:
- `ammo`: Number of shots currently held (starts at `0`, capped at `5`).
- `projectiles`: Array containing active `Projectile` instances.
- `ammoPickups`: Array containing active `AmmoPickup` instances.
- `nextAmmoTimer`: Time in seconds until the next ammo canister is allowed to spawn (randomized between `12` and `18` seconds).

---

## 2. Controls & Spawning Integration (in `game.js`)

### 2.1 Shooting Controls
- **Desktop**: A `keydown` listener for the "F" key.
- **Mobile**: A dedicated button in `index.html` with class `shoot-btn` and touch events mapped to fire.
- **Firing Logic (`fireProjectile()`)**:
  - If `state !== GAME_STATE.PLAYING` or `ammo <= 0`, play a dry-fire warning sound (or flash the HUD ammo red) and exit.
  - Decrement `ammo` by 1.
  - Play `playShoot()` synthesizer sound.
  - Create a new `Projectile` centered on the Dino character and push it to `projectiles`.

### 2.2 Spawning Logic
In `updateSpawns(dt)`:
- Increment `nextAmmoTimer` by delta time.
- If it exceeds the target interval, spawn an `AmmoPickup`:
  - Choose ground (`y = 220`) or floating (`y = 150`) height.
  - Do not spawn if an obstacle is already in the range of `780` to `820` pixels.
  - Reset `nextAmmoTimer` to a random number between `12` and `18` seconds.

### 2.3 Collisions & Cleanup
- **Ammo Collection**: If the Dino's hitbox overlaps an `AmmoPickup`'s hitbox:
  - Play `playReload()` sound.
  - Increment `ammo` (cap at `5`).
  - Set `AmmoPickup.markedForDeletion = true`.
  - Spawn floating `+1 AMMO` text at the pickup coordinates that rises and fades.
- **Obstacle Destruction**: If a `Projectile` overlaps an `Obstacle`:
  - Set both `Projectile` and `Obstacle` to `markedForDeletion`.
  - Play `playExplosion()` sound.
  - Award `+100` points to the score.
  - Increment `obstaclesAvoided` count.
  - Spawn 8 to 12 theme-colored shard particles flying upwards with random gravity-affected velocities.

---

## 3. Visual & Audio Aesthetics

### 3.1 Audio Synthesis (in `sound.js`)
Using the HTML5 Web Audio API, we will synthesize these sound effects dynamically:
- **Shoot**: A rapid pitch sweep from `880Hz` to `220Hz` using a triangle wave over `0.12` seconds.
- **Explosion**: A burst of white noise passed through a low-pass filter with exponential decay over `0.35` seconds.
- **Reload**: A short double-beep (pitch `587Hz` for `0.05s`, followed immediately by `880Hz` for `0.08s`) using a square wave.

### 3.2 Theme-Specific Styling
1. **Classic Themes (Light & Dark)**:
   - **Canister**: A simple 1-bit pixel box with a `+` symbol inside.
   - **Laser**: A basic black/white dashed horizontal line.
   - **Shards**: Grey/Black square pixels scattering.
2. **Synthwave Theme**:
   - **Canister**: Glowing neon-pink canister with scanlines.
   - **Laser**: Thick neon-pink laser bar with a white core and trailing cyan drop shadow.
   - **Shards**: Neon pink and violet shards scattering.
3. **Cyberpunk Theme**:
   - **Canister**: Neon-green high-tech fuel capsule.
   - **Laser**: High-frequency electric blue dash with glow.
   - **Shards**: Cyan and bright yellow shards scattering.
4. **Space Nebula Theme**:
   - **Canister**: Alien battery orb (purple core, yellow rings).
   - **Laser**: Floating yellow plasma fireball with particle sparks trailing.
   - **Shards**: Purple and gold stardust shards.

### 3.3 HUD Ammo Display
A horizontal grid of 5 energy segments added in the top header.
- Filled segments glow with the theme's accent color.
- Empty segments are represented by low-opacity borders.
- When ammo is empty and player tries to shoot, the border turns red and pulses briefly.

---

## 4. Verification Plan

### 4.1 Automated & Console Checks
- Verify page load yields zero syntax or runtime errors.
- Confirm `combat.js` script tag loads before `game.js`.

### 4.2 Gameplay Verification
- Play classical and arcade modes. Verify combat is disabled in Classic Mode.
- Collect ammo canisters and ensure the HUD counter increments correctly (capping at 5).
- Fire projectiles using 'F' key on desktop and verify they travel across the screen.
- Verify obstacles are destroyed on impact, score increases by 100, and explosion sounds play.
- Check mobile "SHOOT" touch control triggering.
