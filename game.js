/**
 * Dino Chrome - Modern Retro Edition
 * Core Game Engine
 * Programmed using clean Canvas 2D API, Delta Time Physics, and modular OOP classes.
 */

// --- DOM ELEMENTS REFERENCE ---
const gameWrapper = document.querySelector('.game-wrapper');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const modeSelect = document.getElementById('mode-select');
const themeSelect = document.getElementById('theme-select');
const soundBtn = document.getElementById('sound-btn');
const soundOnIcon = document.getElementById('sound-on-icon');
const soundOffIcon = document.getElementById('sound-off-icon');
const pauseBtn = document.getElementById('pause-btn');

const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');

const startGameBtn = document.getElementById('start-game-btn');
const resumeBtn = document.getElementById('resume-btn');
const restartGameBtn = document.getElementById('restart-game-btn');

const scoreVal = document.getElementById('current-score');
const highScoreVal = document.getElementById('high-score');
const finalScoreVal = document.getElementById('final-score');
const finalTimeVal = document.getElementById('final-time');
const finalObstaclesVal = document.getElementById('final-obstacles');

const powerupStatus = document.getElementById('powerup-status');
const powerupName = document.getElementById('powerup-name');
const powerupProgress = document.getElementById('powerup-progress');

const mobileDuckBtn = document.getElementById('mobile-duck');
const mobileJumpBtn = document.getElementById('mobile-jump');
const hudAmmoBox = document.getElementById('hud-ammo-box');
const ammoCounter = document.getElementById('ammo-counter');
const mobileShootBtn = document.getElementById('mobile-shoot');

// --- GAME CONSTANTS & STATE ---
const GAME_STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
  CRASHED: 'crashed'
};

const POWERUP_TYPE = {
  SHIELD: 'shield',
  DOUBLE_JUMP: 'double_jump',
  SLOW_MOTION: 'slow_motion'
};

// Physics config
const GRAVITY = 1600; // pixels per second squared
const INITIAL_SPEED = 380; // pixels per second
const MAX_SPEED = 900;
const ACCELERATION = 8; // increase in speed per second
const JUMP_FORCE = -550;
const DUCK_GRAVITY_MULTIPLIER = 2.5; // fall faster if holding down in mid-air

let state = GAME_STATE.MENU;
let gameMode = 'arcade'; // 'classic' or 'arcade'
let activeTheme = 'classic-light';

let currentSpeed = INITIAL_SPEED;
let score = 0;
let highScore = 0;
let distanceRan = 0;
let obstaclesAvoided = 0;
let timeElapsed = 0; // seconds
let lastMilestone = 0; // Tracks classic day/night transition milestones

let lastTime = 0; // for delta time calculation
let screenShake = 0; // screenshake magnitude
let nextObstacleTimer = 0;
let nextPowerUpTimer = 0;
let nextAmmoTimer = 0;
let crashTimeoutId = null;

// Entities collections
let dino = null;
let obstacles = [];
let powerups = [];
let projectiles = [];
let ammoPickups = [];
let ammo = 0;
let particles = [];
let clouds = [];
let stars = []; // for synthwave/cyberpunk night sky
let terrainFeatures = []; // background mountains/structures
let groundGridOffset = 0;

// --- CHARACTER CUSTOMIZATION STATE ---
let characterConfig = {
  skin: 'classic',          // 'classic' | 'robot' | 'ghost' | 'neon' | 'custom_image'
  bodyColor: null,          // null = use theme default color
  accentColor: null,        // null = use theme default eye/accent color
  customImage: null,        // HTMLImageElement (restored from base64 at startup)
  customImageDataUrl: null, // base64 string saved to localStorage
  spriteSheet: {
    enabled: false,
    rows: 2,
    cols: 4,
    frameMap: {
      running_0: 0,
      running_1: 1,
      jumping: 0,
      ducking_0: 2,
      ducking_1: 3,
      crashed: 4
    }
  }
};
// Preview animation state (separate from game loop)
let _previewAnimId   = null;
let _previewRunFrame = 0;
let _previewRunTimer = 0;
let _previewLastTime = 0;
let _previewStateOverride = null; // interactive preview state override
// Color palette presets for swatches
const CHAR_BODY_COLORS   = ['#535353','#e63946','#457b9d','#2a9d8f','#e9c46a','#f4a261','#6a0572','#1d3557','#ff006e','#00b4d8'];
const CHAR_ACCENT_COLORS = ['#ffffff','#000000','#ffbe0b','#ff006e','#00f3ff','#06d6a0','#fb5607','#8338ec','#ff4d6d','#a8dadc'];

// Theme configuration palette values used in Canvas drawing
let themeColors = {
  ground: '#ff007f',
  dino: '#ffffff',
  dinoGlow: '#ff007f',
  obstacle: '#00f3ff',
  obstacleGlow: '#00f3ff',
  text: '#ffffff',
  sky: '#12092e',
  accent: '#ff007f',
  secondary: '#00f3ff',
  ambientGlow: 'rgba(255, 0, 127, 0.2)'
};

// --- INITIALIZE & AUDIO SETUP ---
function init() {
  loadHighScore();
  setupEventListeners();
  resizeCanvas();
  applyTheme(themeSelect.value);
  applySoundUI();
  
  // Load saved character customization from localStorage
  loadCharacterConfig();
  
  // Create static background elements once
  generateBackgrounds();
  
  // Game Loop
  initCustomizationModal();
  requestAnimationFrame(gameLoop);
}

function loadHighScore() {
  const saved = localStorage.getItem('dino_high_score');
  if (saved) {
    highScore = parseInt(saved, 10);
    highScoreVal.textContent = String(highScore).padStart(5, '0');
  }
}

function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('dino_high_score', highScore);
    highScoreVal.textContent = String(highScore).padStart(5, '0');
  }
}

function resizeCanvas() {
  // Use scale for Retina displays
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = 800 * dpr;
  canvas.height = 340 * dpr; // Expanded height to prevent component clipping
  
  ctx.scale(dpr, dpr);
}

// Generate star/cloud distributions
function generateBackgrounds() {
  clouds = [];
  stars = [];
  terrainFeatures = [];
  
  // Generate clouds
  for (let i = 0; i < 5; i++) {
    clouds.push({
      x: Math.random() * 800 + i * 200,
      y: Math.random() * 80 + 30,
      speed: Math.random() * 15 + 10,
      size: Math.random() * 30 + 20
    });
  }
  
  // Generate stars (used in dark themes)
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: Math.random() * 800,
      y: Math.random() * 140,
      size: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
      pulseSpeed: Math.random() * 2 + 1
    });
  }

  // Mountains/Retro Sun lines
  for (let i = 0; i < 3; i++) {
    terrainFeatures.push({
      x: i * 350,
      width: 250 + Math.random() * 100,
      height: 60 + Math.random() * 40,
      speed: 15
    });
  }
}

// --- CORE GAME ENTITIES ---

class DinoCharacter {
  constructor() {
    this.width = 44;
    this.height = 48;
    this.x = 80;
    this.y = 200; // ground height is 248, so dino Y is 248 - 48 = 200
    this.groundY = 200;
    
    this.vy = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.isCrashed = false;
    
    // Animation states
    this.runTimer = 0;
    this.runFrame = 0;
    this.duckRunFrame = 0;
    
    // Power-up indicators
    this.activePowerUp = null;
    this.powerUpTimeLeft = 0; // in seconds
    this.powerUpTotalDuration = 0;
    this.doubleJumpsLeft = 0;
    
    // Hitbox padding for fair gameplay
    this.hitboxPadding = {
      x: 6,
      y: 4
    };
  }

  update(dt) {
    // 1. Gravity and Jump physics
    let localGravity = GRAVITY;
    if (this.isDucking && this.vy > 0) {
      localGravity *= DUCK_GRAVITY_MULTIPLIER; // fall faster if sliding down
    }
    
    // Applying Slow-motion effect to jump velocity
    const isSlow = this.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
    const dtMult = isSlow ? 0.6 : 1.0;
    
    this.vy += localGravity * dt * dtMult;
    this.y += this.vy * dt * dtMult;
    
    // Ground collision
    if (this.y >= this.groundY) {
      this.y = this.groundY;
      this.vy = 0;
      if (this.isJumping) {
        this.isJumping = false;
        // Reset double jumps on landing
        if (this.activePowerUp === POWERUP_TYPE.DOUBLE_JUMP) {
          this.doubleJumpsLeft = 2;
        } else {
          this.doubleJumpsLeft = 0;
        }
        
        // Spawn sparks on landing
        spawnLandingSparks(this.x + this.width / 2, 248);
      }
    }

    // 2. Animation loop
    if (!this.isJumping && !this.isCrashed) {
      this.runTimer += dt * (currentSpeed / INITIAL_SPEED) * (isSlow ? 0.6 : 1.0);
      if (this.runTimer > 0.08) {
        this.runFrame = (this.runFrame + 1) % 2;
        this.duckRunFrame = (this.duckRunFrame + 1) % 2;
        this.runTimer = 0;
        
        // Spawn running dust
        if (Math.random() < 0.6) {
          particles.push(new RunningDust(this.x + 8, 248));
        }
      }
    }

    // 3. Power-up Timer updates
    if (this.activePowerUp) {
      this.powerUpTimeLeft -= dt;
      
      // Keep UI progress bar updated
      if (gameMode === 'arcade') {
        const percent = Math.max(0, (this.powerUpTimeLeft / this.powerUpTotalDuration) * 100);
        powerupProgress.style.width = `${percent}%`;
        
        if (this.powerUpTimeLeft <= 0) {
          this.deactivatePowerUp();
        }
      }
    }
  }

  jump() {
    if (this.isCrashed) return;
    
    if (!this.isJumping) {
      // Normal Jump
      this.vy = JUMP_FORCE;
      this.isJumping = true;
      this.isDucking = false;
      this.width = 44;
      this.height = 48;
      this.groundY = 200;
      soundManager.playJump();
      
      // Spawn lift-off particles
      spawnJumpDust(this.x + this.width / 2, 248);
      
      if (this.activePowerUp === POWERUP_TYPE.DOUBLE_JUMP) {
        this.doubleJumpsLeft = 1;
      }
    } else if (this.activePowerUp === POWERUP_TYPE.DOUBLE_JUMP && this.doubleJumpsLeft > 0) {
      // Double Jump
      this.vy = JUMP_FORCE * 0.9; // slightly weaker second jump
      this.doubleJumpsLeft--;
      soundManager.playJump();
      
      // Neon rings for double jump particle
      spawnDoubleJumpCircle(this.x + this.width / 2, this.y + this.height);
    }
  }

  duck(isPressed) {
    if (this.isCrashed || this.isJumping) {
      if (isPressed && this.vy < 0) {
        this.vy = 0; // quickly halt upward velocity
      }
      return;
    }
    
    if (isPressed) {
      if (!this.isDucking) {
        soundManager.playSlide();
      }
      this.isDucking = true;
      this.width = 55;
      this.height = 28;
      this.groundY = 220; // 248 - 28 = 220
      this.y = 220;
    } else {
      this.isDucking = false;
      this.width = 44;
      this.height = 48;
      this.groundY = 200;
      this.y = 200;
    }
  }

  activatePowerUp(type, duration) {
    this.activePowerUp = type;
    this.powerUpTimeLeft = duration;
    this.powerUpTotalDuration = duration;
    
    if (type === POWERUP_TYPE.DOUBLE_JUMP) {
      this.doubleJumpsLeft = 2;
    }

    soundManager.playPowerUp();
    
    // UI update
    if (gameMode === 'arcade') {
      powerupStatus.classList.remove('hidden');
      if (type === POWERUP_TYPE.SHIELD) {
        powerupName.textContent = '🛡️ SHIELD ACTIVE';
        powerupStatus.style.borderColor = 'var(--secondary-color)';
        powerupName.style.color = 'var(--secondary-color)';
        powerupProgress.style.background = 'var(--secondary-color)';
      } else if (type === POWERUP_TYPE.DOUBLE_JUMP) {
        powerupName.textContent = '🪶 DOUBLE JUMP ACTIVE';
        powerupStatus.style.borderColor = 'var(--accent-color)';
        powerupName.style.color = 'var(--accent-color)';
        powerupProgress.style.background = 'var(--accent-color)';
      } else if (type === POWERUP_TYPE.SLOW_MOTION) {
        powerupName.textContent = '⏳ SLOW-MO ACTIVE';
        powerupStatus.style.borderColor = '#f7e018';
        powerupName.style.color = '#f7e018';
        powerupProgress.style.background = '#f7e018';
      }
    }
    
    // Spark particles
    spawnPowerUpRing(this.x + this.width/2, this.y + this.height/2);
  }

  deactivatePowerUp() {
    this.activePowerUp = null;
    this.powerUpTimeLeft = 0;
    this.doubleJumpsLeft = 0;
    powerupStatus.classList.add('hidden');
  }

  getHitbox() {
    return {
      x: this.x + this.hitboxPadding.x,
      y: this.y + this.hitboxPadding.y,
      width: this.width - this.hitboxPadding.x * 2,
      height: this.height - this.hitboxPadding.y * 2
    };
  }

  draw() {
    ctx.save();
    
    const isSlow = this.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
    
    // Draw neon trail in synthwave / cyberpunk themes
    if (activeTheme !== 'classic-light' && activeTheme !== 'classic-dark' && !this.isCrashed) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = themeColors.dinoGlow;
      
      // Draw neon silhouettes trailing
      if (this.isJumping || currentSpeed > 500) {
        ctx.fillStyle = themeColors.ambientGlow;
        ctx.fillRect(this.x - 15, this.y + 4, this.width, this.height);
        ctx.fillRect(this.x - 30, this.y + 8, this.width, this.height);
      }
    }

    ctx.fillStyle = themeColors.dino;
    
    // Draw bubble shield if active
    if (this.activePowerUp === POWERUP_TYPE.SHIELD) {
      ctx.strokeStyle = themeColors.secondary;
      ctx.lineWidth = 2;
      if (activeTheme !== 'classic-light' && activeTheme !== 'classic-dark') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = themeColors.secondary;
      }
      ctx.beginPath();
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;
      const radius = Math.max(this.width, this.height) * 0.75 + Math.sin(Date.now() * 0.01) * 3;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(0, 243, 255, 0.05)';
      ctx.fill();
      
      // reset shadow settings
      if (activeTheme !== 'classic-light' && activeTheme !== 'classic-dark') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = themeColors.dinoGlow;
      }
      ctx.fillStyle = themeColors.dino;
    }

    // DRAW DINO PROGRAMMATIC PIXEL VECTOR
    // Dino classic shape scaled to 44x48 widthxheight or 55x28 ducking widthxheight
    if (this.isCrashed) {
      drawDinoSprite(ctx, this.x, this.y, this.width, this.height, 'crashed', activeTheme);
    } else if (this.isJumping) {
      drawDinoSprite(ctx, this.x, this.y, this.width, this.height, 'jumping', activeTheme);
    } else if (this.isDucking) {
      drawDinoSprite(ctx, this.x, this.y, this.width, this.height, `ducking_${this.duckRunFrame}`, activeTheme);
    } else {
      drawDinoSprite(ctx, this.x, this.y, this.width, this.height, `running_${this.runFrame}`, activeTheme);
    }

    ctx.restore();
  }
}

// --- DINO RENDER PROCEDURES ---
function drawDinoSprite(ctx, x, y, w, h, state, theme) {
  ctx.save();
  const bodyCol   = characterConfig.bodyColor || themeColors.dino;
  const accentCol = characterConfig.accentColor
    || (theme === 'cyberpunk' ? '#05050a' : theme.includes('light') ? '#f7f7f7' : '#000000');
  _drawDinoWithSkin(ctx, x, y, w, h, state, bodyCol, accentCol);
  ctx.restore();
}

// --- OBSTACLE ENTITIES ---

class Obstacle {
  constructor(type, xSpeed) {
    this.x = 810;
    this.speed = xSpeed;
    this.type = type; // 'cactus_s', 'cactus_l', 'cactus_double', 'cactus_triple', 'bird'
    this.markedForDeletion = false;
    this.passed = false;
    
    // Specific attributes based on type
    if (type.startsWith('cactus')) {
      this.isCactus = true;
      this.y = 248; // grounded
      
      if (type === 'cactus_s') {
        this.width = 18;
        this.height = 36;
        this.y = 248 - 36;
      } else if (type === 'cactus_l') {
        this.width = 24;
        this.height = 46;
        this.y = 248 - 46;
      } else if (type === 'cactus_double') {
        this.width = 38;
        this.height = 42;
        this.y = 248 - 42;
      } else if (type === 'cactus_triple') {
        this.width = 54;
        this.height = 45;
        this.y = 248 - 45;
      }
    } else if (type === 'bird') {
      this.isCactus = false;
      this.width = 42;
      this.height = 30;
      
      // Birds fly at 3 different levels
      const heights = [
        135, // High: run under easily
        185, // Medium: must jump or duck perfectly
        215  // Low: must jump over
      ];
      this.y = heights[Math.floor(Math.random() * heights.length)];
      
      // Wing flapping animation
      this.flapTimer = 0;
      this.flapFrame = 0;
    }
    
    // Adjust collision hitboxes
    this.hitboxPadding = {
      x: 3,
      y: 3
    };
  }

  update(dt) {
    // Move left. If slow-motion power-up is active, scroll at 50% speed.
    const isSlow = dino && dino.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
    const scrollSpeed = this.speed * (isSlow ? 0.5 : 1.0);
    
    this.x -= scrollSpeed * dt;
    
    if (this.x + this.width < 0) {
      this.markedForDeletion = true;
    }

    // Bird animation
    if (this.type === 'bird') {
      this.flapTimer += dt * (isSlow ? 5 : 10);
      if (this.flapTimer > 1) {
        this.flapFrame = (this.flapFrame + 1) % 2;
        this.flapTimer = 0;
      }
    }
  }

  getHitbox() {
    return {
      x: this.x + this.hitboxPadding.x,
      y: this.y + this.hitboxPadding.y,
      width: this.width - this.hitboxPadding.x * 2,
      height: this.height - this.hitboxPadding.y * 2
    };
  }

  draw() {
    ctx.save();
    
    if (activeTheme !== 'classic-light' && activeTheme !== 'classic-dark') {
      ctx.shadowBlur = 10;
      ctx.shadowColor = themeColors.obstacleGlow;
    }
    
    ctx.fillStyle = themeColors.obstacle;

    if (activeTheme === 'space-nebula') {
      if (this.isCactus) {
        drawSpaceCrystalSprite(ctx, this.x, this.y, this.width, this.height, this.type);
      } else {
        drawUFOSprite(ctx, this.x, this.y, this.width, this.height, this.flapFrame);
      }
    } else {
      if (this.isCactus) {
        // Programmatic pixel-cactus render
        drawCactusSprite(ctx, this.x, this.y, this.width, this.height, this.type);
      } else {
        // Flapping bird render
        drawBirdSprite(ctx, this.x, this.y, this.width, this.height, this.flapFrame, activeTheme);
      }
    }

    ctx.restore();
  }
}

// Cactus vector drawing helpers
function drawCactusSprite(ctx, x, y, w, h, type) {
  ctx.save();
  
  if (type === 'cactus_s' || type === 'cactus_l') {
    // Single Cactus
    const trunkW = w * 0.4;
    const branchW = w * 0.2;
    const trunkX = x + (w - trunkW) / 2;
    
    // Main trunk
    ctx.fillRect(trunkX, y + 4, trunkW, h - 4);
    ctx.fillRect(trunkX + 2, y, trunkW - 4, 4); // rounded top tip
    
    // Left branch
    ctx.fillRect(x, y + h * 0.35, branchW, h * 0.35); // branch stem
    ctx.fillRect(x, y + h * 0.3, branchW * 2, branchW); // bend
    
    // Right branch
    ctx.fillRect(x + w - branchW, y + h * 0.45, branchW, h * 0.3); // branch stem
    ctx.fillRect(x + w - branchW * 2, y + h * 0.4, branchW * 2, branchW); // bend
    
  } else if (type === 'cactus_double') {
    // Multi cactus (2 clustered together)
    // Left cactus (smaller)
    ctx.fillRect(x, y + 10, 12, h - 10);
    ctx.fillRect(x + 2, y + 6, 8, 4);
    
    // Right cactus (larger)
    ctx.fillRect(x + 22, y + 4, 14, h - 4);
    ctx.fillRect(x + 24, y, 10, 4);
    
    // Small connecting twigs
    ctx.fillRect(x + 12, y + h*0.4, 10, 6);
    
  } else if (type === 'cactus_triple') {
    // Multi cactus (3 clustered together)
    // Left cactus
    ctx.fillRect(x, y + 12, 12, h - 12);
    ctx.fillRect(x + 2, y + 8, 8, 4);
    
    // Middle cactus (tallest)
    ctx.fillRect(x + 18, y + 4, 14, h - 4);
    ctx.fillRect(x + 20, y, 10, 4);
    
    // Right cactus
    ctx.fillRect(x + 38, y + 10, 14, h - 10);
    ctx.fillRect(x + 40, y + 6, 10, 4);
  }
  
  ctx.restore();
}

function drawBirdSprite(ctx, x, y, w, h, flapFrame, theme) {
  // Classic style pixel pterodactyl
  ctx.save();
  
  // Body center
  ctx.fillRect(x + 14, y + 10, 16, 8);
  
  // Neck and long snout
  ctx.fillRect(x + 28, y + 6, 8, 6);
  ctx.fillRect(x + 34, y + 8, 8, 4); // beak
  
  // Tail
  ctx.fillRect(x + 6, y + 12, 8, 4);
  
  // Eye
  ctx.fillStyle = theme.includes('light') ? '#f7f7f7' : '#000000';
  if (theme === 'cyberpunk') ctx.fillStyle = '#05050a';
  ctx.fillRect(x + 30, y + 8, 3, 3);
  
  ctx.fillStyle = themeColors.obstacle;

  // Wings (animated flapping)
  if (flapFrame === 0) {
    // Wing pointing UP
    ctx.fillRect(x + 16, y, 6, 10);
    ctx.fillRect(x + 18, y - 6, 4, 6); // wing tip
    
    // Tiny bottom flap
    ctx.fillRect(x + 20, y + 18, 4, 4);
  } else {
    // Wing pointing DOWN
    ctx.fillRect(x + 16, y + 18, 6, 10);
    ctx.fillRect(x + 18, y + 28, 4, 4); // wing tip pointing down
    
    // Tiny top flap
    ctx.fillRect(x + 20, y + 6, 4, 4);
  }

  ctx.restore();
}

function drawSpaceCrystalSprite(ctx, x, y, w, h, type) {
  ctx.save();
  ctx.fillStyle = themeColors.obstacle;
  
  if (type === 'cactus_s' || type === 'cactus_l') {
    drawCrystalShard(ctx, x, y, w, h, 'rgba(255, 255, 255, 0.45)');
  } else if (type === 'cactus_double') {
    drawCrystalShard(ctx, x, y + h * 0.2, w * 0.45, h * 0.8, 'rgba(255, 255, 255, 0.45)');
    drawCrystalShard(ctx, x + w * 0.48, y, w * 0.52, h, 'rgba(255, 255, 255, 0.45)');
  } else if (type === 'cactus_triple') {
    drawCrystalShard(ctx, x, y + h * 0.25, w * 0.3, h * 0.75, 'rgba(255, 255, 255, 0.45)');
    drawCrystalShard(ctx, x + w * 0.28, y, w * 0.42, h, 'rgba(255, 255, 255, 0.45)');
    drawCrystalShard(ctx, x + w * 0.68, y + h * 0.15, w * 0.32, h * 0.85, 'rgba(255, 255, 255, 0.45)');
  }
  ctx.restore();
}

function drawCrystalShard(ctx, x, y, w, h, colorAccent) {
  ctx.save();
  // Outer outline
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h * 0.7);
  ctx.lineTo(x + w * 0.7, y + h);
  ctx.lineTo(x + w * 0.3, y + h);
  ctx.lineTo(x, y + h * 0.7);
  ctx.closePath();
  ctx.fill();
  
  // Left side facet shadow reflection
  ctx.fillStyle = colorAccent;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w * 0.5, y + h);
  ctx.lineTo(x + w * 0.3, y + h);
  ctx.lineTo(x, y + h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawUFOSprite(ctx, x, y, w, h, flapFrame) {
  ctx.save();
  
  // Cockpit glass dome (glowing cyan)
  ctx.fillStyle = '#00ffff';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.38, w * 0.22, Math.PI, 0);
  ctx.fill();
  
  // Main metal body
  ctx.fillStyle = themeColors.obstacle;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.58, w * 0.5, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Blinking neon rim lights
  ctx.fillStyle = flapFrame === 0 ? '#00ffff' : '#ff007f';
  ctx.beginPath();
  ctx.arc(x + w * 0.24, y + h * 0.58, 2.5, 0, Math.PI * 2);
  ctx.arc(x + w * 0.5, y + h * 0.63, 2.5, 0, Math.PI * 2);
  ctx.arc(x + w * 0.76, y + h * 0.58, 2.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Faint glowing tractor beam cone
  ctx.fillStyle = 'rgba(0, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.78);
  ctx.lineTo(x + w * 0.65, y + h * 0.78);
  ctx.lineTo(x + w * 0.8, y + h * 1.3);
  ctx.lineTo(x + w * 0.2, y + h * 1.3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}


// ============================================================
// --- CUSTOM CHARACTER SKINS ---
// ============================================================

function drawClassicDinoSprite(ctx, x, y, w, h, state, bodyCol, accentCol) {
  ctx.fillStyle = bodyCol;
  if (state.startsWith('ducking')) {
    ctx.fillRect(x + 10, y + 4,  35, 12);
    ctx.fillRect(x + 45, y + 8,  10,  8);
    ctx.fillRect(x,      y + 8,  12, 10);
    ctx.fillRect(x + 6,  y + 10, 25, 14);
    ctx.fillStyle = accentCol;
    ctx.fillRect(x + 36, y + 6, 3, 3);
    ctx.fillStyle = bodyCol;
    if (state === 'ducking_0') {
      ctx.fillRect(x + 16, y + 24, 4, 4);
      ctx.fillRect(x + 28, y + 24, 6, 2);
    } else {
      ctx.fillRect(x + 16, y + 24, 6, 2);
      ctx.fillRect(x + 28, y + 24, 4, 4);
    }
  } else {
    ctx.fillRect(x,      y + 16,  6, 12);
    ctx.fillRect(x + 4,  y + 14,  6, 16);
    ctx.fillRect(x + 8,  y + 12, 22, 22);
    ctx.fillRect(x + 20, y,      16, 12);
    ctx.fillRect(x + 20, y,      24, 16);
    ctx.fillRect(x + 36, y + 4,   8, 12);
    ctx.fillStyle = accentCol;
    ctx.fillRect(x + 24, y + 4, 3, 3);
    ctx.fillStyle = bodyCol;
    ctx.fillRect(x + 32, y + 18, 6, 4);
    ctx.fillRect(x + 36, y + 20, 4, 2);
    if (state === 'jumping' || state === 'crashed') {
      ctx.fillRect(x + 12, y + 34, 4, 10);
      ctx.fillRect(x + 12, y + 42, 6,  2);
      ctx.fillRect(x + 24, y + 34, 4, 10);
      ctx.fillRect(x + 24, y + 42, 6,  2);
      if (state === 'crashed') { ctx.fillStyle = '#ff3333'; ctx.fillRect(x + 24, y + 4, 3, 3); }
    } else if (state === 'running_0') {
      ctx.fillRect(x + 12, y + 34, 4, 14);
      ctx.fillRect(x + 12, y + 46, 6,  2);
      ctx.fillRect(x + 24, y + 34, 4,  8);
      ctx.fillRect(x + 28, y + 40, 4,  2);
    } else {
      ctx.fillRect(x + 12, y + 34, 4,  8);
      ctx.fillRect(x +  8, y + 40, 4,  2);
      ctx.fillRect(x + 24, y + 34, 4, 14);
      ctx.fillRect(x + 24, y + 46, 6,  2);
    }
  }
}

function drawRobotDinoSprite(ctx, x, y, w, h, state, bodyCol, accentCol) {
  ctx.fillStyle = bodyCol;
  if (state.startsWith('ducking')) {
    ctx.fillRect(x + 10, y + 4,  35, 12);
    ctx.fillRect(x + 45, y + 8,  10,  8);
    ctx.fillRect(x,      y + 8,  12, 10);
    ctx.fillRect(x + 6,  y + 10, 25, 14);
    // Panel seam lines
    ctx.save();
    ctx.globalAlpha = 0.4; ctx.strokeStyle = accentCol; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 4); ctx.lineTo(x + 22, y + 24);
    ctx.moveTo(x + 34, y + 4); ctx.lineTo(x + 34, y + 24);
    ctx.stroke(); ctx.restore();
    // LED eye
    ctx.fillStyle = accentCol;
    ctx.fillRect(x + 35, y + 5, 4, 4);
    ctx.fillStyle = bodyCol;
    if (state === 'ducking_0') {
      ctx.fillRect(x + 16, y + 24, 4, 4);
      ctx.fillRect(x + 28, y + 24, 6, 2);
    } else {
      ctx.fillRect(x + 16, y + 24, 6, 2);
      ctx.fillRect(x + 28, y + 24, 4, 4);
    }
  } else {
    ctx.fillRect(x,      y + 16,  6, 12);
    ctx.fillRect(x + 4,  y + 14,  6, 16);
    ctx.fillRect(x + 8,  y + 12, 22, 22);
    ctx.fillRect(x + 20, y,      16, 12);
    ctx.fillRect(x + 20, y,      24, 16);
    ctx.fillRect(x + 36, y + 4,   8, 12);
    // Panel lines
    ctx.save();
    ctx.globalAlpha = 0.4; ctx.strokeStyle = accentCol; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8,  y + 22); ctx.lineTo(x + 30, y + 22);
    ctx.moveTo(x + 20, y + 12); ctx.lineTo(x + 20, y + 34);
    ctx.stroke(); ctx.restore();
    // Antenna
    ctx.fillStyle = accentCol;
    ctx.fillRect(x + 28, y - 8, 2, 8);
    ctx.fillRect(x + 25, y - 11, 8, 3);
    // LED eye
    ctx.fillRect(x + 23, y + 4, 5, 4);
    ctx.fillStyle = bodyCol;
    // Arm + claw
    ctx.fillRect(x + 32, y + 18, 6, 4);
    ctx.fillRect(x + 36, y + 20, 4, 2);
    ctx.fillStyle = accentCol; ctx.fillRect(x + 38, y + 19, 2, 2); ctx.fillStyle = bodyCol;
    // Legs
    if (state === 'jumping' || state === 'crashed') {
      ctx.fillRect(x + 12, y + 34, 4, 10);
      ctx.fillRect(x + 12, y + 42, 6,  2);
      ctx.fillRect(x + 24, y + 34, 4, 10);
      ctx.fillRect(x + 24, y + 42, 6,  2);
      if (state === 'crashed') { ctx.fillStyle = '#ff3333'; ctx.fillRect(x + 24, y + 4, 3, 3); }
    } else if (state === 'running_0') {
      ctx.fillRect(x + 12, y + 34, 4, 14);
      ctx.fillRect(x + 12, y + 46, 6,  2);
      ctx.fillRect(x + 24, y + 34, 4,  8);
      ctx.fillRect(x + 28, y + 40, 4,  2);
    } else {
      ctx.fillRect(x + 12, y + 34, 4,  8);
      ctx.fillRect(x +  8, y + 40, 4,  2);
      ctx.fillRect(x + 24, y + 34, 4, 14);
      ctx.fillRect(x + 24, y + 46, 6,  2);
    }
    // Joint indicators
    ctx.fillStyle = accentCol;
    ctx.fillRect(x + 11, y + 33, 6, 2);
    ctx.fillRect(x + 23, y + 33, 6, 2);
  }
}

function drawGhostDinoSprite(ctx, x, y, w, h, state, bodyCol, accentCol) {
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = bodyCol;
  if (state.startsWith('ducking')) {
    ctx.fillRect(x + 10, y + 4,  35, 12);
    ctx.fillRect(x + 45, y + 8,  10,  8);
    ctx.fillRect(x,      y + 8,  12, 10);
    ctx.fillRect(x + 6,  y + 10, 25, 14);
    ctx.globalAlpha = 1; ctx.fillStyle = accentCol;
    ctx.shadowBlur = 8; ctx.shadowColor = accentCol;
    ctx.fillRect(x + 36, y + 6, 4, 4);
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.62; ctx.fillStyle = bodyCol;
    if (state === 'ducking_0') {
      ctx.fillRect(x + 16, y + 24, 4, 4); ctx.fillRect(x + 28, y + 24, 6, 2);
    } else {
      ctx.fillRect(x + 16, y + 24, 6, 2); ctx.fillRect(x + 28, y + 24, 4, 4);
    }
  } else {
    ctx.fillRect(x,      y + 16,  6, 12);
    ctx.fillRect(x + 4,  y + 14,  6, 16);
    ctx.fillRect(x + 8,  y + 12, 22, 22);
    ctx.fillRect(x + 20, y,      16, 12);
    ctx.fillRect(x + 20, y,      24, 16);
    ctx.fillRect(x + 36, y + 4,   8, 12);
    // Dashed outline
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = accentCol; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.strokeRect(x + 8, y + 12, 22, 22);
    ctx.strokeRect(x + 20, y, 24, 16);
    ctx.setLineDash([]);
    // Glowing eye
    ctx.globalAlpha = 1;
    ctx.fillStyle = accentCol; ctx.shadowBlur = 10; ctx.shadowColor = accentCol;
    ctx.fillRect(x + 23, y + 3, 5, 5);
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.62; ctx.fillStyle = bodyCol;
    ctx.fillRect(x + 32, y + 18, 6, 4);
    ctx.fillRect(x + 36, y + 20, 4, 2);
    if (state === 'jumping' || state === 'crashed') {
      ctx.fillRect(x + 12, y + 34, 4, 10);
      ctx.fillRect(x + 12, y + 42, 6,  2);
      ctx.fillRect(x + 24, y + 34, 4, 10);
      ctx.fillRect(x + 24, y + 42, 6,  2);
    } else if (state === 'running_0') {
      ctx.fillRect(x + 12, y + 34, 4, 14);
      ctx.fillRect(x + 12, y + 46, 6,  2);
      ctx.fillRect(x + 24, y + 34, 4,  8);
      ctx.fillRect(x + 28, y + 40, 4,  2);
    } else {
      ctx.fillRect(x + 12, y + 34, 4,  8);
      ctx.fillRect(x +  8, y + 40, 4,  2);
      ctx.fillRect(x + 24, y + 34, 4, 14);
      ctx.fillRect(x + 24, y + 46, 6,  2);
    }
  }
  ctx.restore();
}

function drawNeonDinoSprite(ctx, x, y, w, h, state, bodyCol, accentCol) {
  ctx.save();
  ctx.strokeStyle = bodyCol; ctx.lineWidth = 2;
  ctx.shadowBlur = 14; ctx.shadowColor = bodyCol;
  if (state.startsWith('ducking')) {
    ctx.strokeRect(x + 10, y + 4,  35, 12);
    ctx.strokeRect(x + 45, y + 8,  10,  8);
    ctx.strokeRect(x,      y + 8,  12, 10);
    ctx.strokeRect(x + 6,  y + 10, 25, 14);
    ctx.fillStyle = accentCol; ctx.shadowColor = accentCol; ctx.shadowBlur = 12;
    ctx.fillRect(x + 35, y + 5, 5, 5);
    ctx.shadowColor = bodyCol; ctx.shadowBlur = 14;
    if (state === 'ducking_0') {
      ctx.strokeRect(x + 16, y + 24, 4, 4); ctx.strokeRect(x + 28, y + 24, 6, 2);
    } else {
      ctx.strokeRect(x + 16, y + 24, 6, 2); ctx.strokeRect(x + 28, y + 24, 4, 4);
    }
  } else {
    ctx.strokeRect(x,      y + 16,  6, 12);
    ctx.strokeRect(x + 8,  y + 12, 22, 22);
    ctx.strokeRect(x + 20, y,      24, 16);
    ctx.strokeRect(x + 36, y + 4,   8, 12);
    ctx.fillStyle = accentCol; ctx.shadowColor = accentCol; ctx.shadowBlur = 16;
    ctx.fillRect(x + 22, y + 3, 6, 6);
    ctx.shadowColor = bodyCol; ctx.shadowBlur = 14;
    ctx.strokeRect(x + 32, y + 18, 6, 4);
    if (state === 'jumping' || state === 'crashed') {
      ctx.strokeRect(x + 12, y + 34, 4, 10);
      ctx.strokeRect(x + 24, y + 34, 4, 10);
    } else if (state === 'running_0') {
      ctx.strokeRect(x + 12, y + 34, 4, 14);
      ctx.strokeRect(x + 24, y + 34, 4,  8);
    } else {
      ctx.strokeRect(x + 12, y + 34, 4,  8);
      ctx.strokeRect(x + 24, y + 34, 4, 14);
    }
  }
  ctx.restore();
}

// Dispatches to the correct skin renderer
function _drawDinoWithSkin(ctx, x, y, w, h, state, bodyCol, accentCol) {
  if (characterConfig.skin === 'custom_image' && characterConfig.customImage) {
    const ss = characterConfig.spriteSheet;
    if (ss && ss.enabled) {
      const cellIndex = (ss.frameMap && ss.frameMap[state] !== undefined) ? ss.frameMap[state] : 0;
      const cols = ss.cols || 4;
      const rows = ss.rows || 2;
      const cellWidth = characterConfig.customImage.width / cols;
      const cellHeight = characterConfig.customImage.height / rows;
      const colIndex = cellIndex % cols;
      const rowIndex = Math.floor(cellIndex / cols);
      const cellX = colIndex * cellWidth;
      const cellY = rowIndex * cellHeight;
      ctx.drawImage(
        characterConfig.customImage,
        cellX, cellY, cellWidth, cellHeight,
        x, y, w, h
      );
    } else {
      ctx.drawImage(characterConfig.customImage, x, y, w, h);
    }
    if (state === 'crashed') { ctx.fillStyle = '#ff3333'; ctx.fillRect(x + 24, y + 4, 3, 3); }
    return;
  }
  ctx.fillStyle = bodyCol;
  const sk = characterConfig.skin;
  if      (sk === 'robot') drawRobotDinoSprite(ctx, x, y, w, h, state, bodyCol, accentCol);
  else if (sk === 'ghost') drawGhostDinoSprite(ctx, x, y, w, h, state, bodyCol, accentCol);
  else if (sk === 'neon')  drawNeonDinoSprite(ctx, x, y, w, h, state, bodyCol, accentCol);
  else                     drawClassicDinoSprite(ctx, x, y, w, h, state, bodyCol, accentCol);
}

// ============================================================
// --- CHARACTER CONFIG PERSISTENCE ---
// ============================================================

function loadCharacterConfig() {
  try {
    const saved = localStorage.getItem('dino_char_config');
    if (!saved) return;
    const p = JSON.parse(saved);
    characterConfig.skin             = p.skin             || 'classic';
    characterConfig.bodyColor        = p.bodyColor        || null;
    characterConfig.accentColor      = p.accentColor      || null;
    characterConfig.customImageDataUrl = p.customImageDataUrl || null;
    if (characterConfig.customImageDataUrl) {
      const img = new Image();
      img.onload = () => { characterConfig.customImage = img; };
      img.src    = characterConfig.customImageDataUrl;
    }
    // Load spriteSheet settings if present, otherwise keep defaults
    if (p.spriteSheet) {
      characterConfig.spriteSheet = {
        enabled: !!p.spriteSheet.enabled,
        rows: parseInt(p.spriteSheet.rows, 10) || 2,
        cols: parseInt(p.spriteSheet.cols, 10) || 4,
        frameMap: {
          running_0: p.spriteSheet.frameMap?.running_0 !== undefined ? parseInt(p.spriteSheet.frameMap.running_0, 10) : 0,
          running_1: p.spriteSheet.frameMap?.running_1 !== undefined ? parseInt(p.spriteSheet.frameMap.running_1, 10) : 1,
          jumping:   p.spriteSheet.frameMap?.jumping   !== undefined ? parseInt(p.spriteSheet.frameMap.jumping, 10)   : 0,
          ducking_0: p.spriteSheet.frameMap?.ducking_0 !== undefined ? parseInt(p.spriteSheet.frameMap.ducking_0, 10) : 2,
          ducking_1: p.spriteSheet.frameMap?.ducking_1 !== undefined ? parseInt(p.spriteSheet.frameMap.ducking_1, 10) : 3,
          crashed:   p.spriteSheet.frameMap?.crashed   !== undefined ? parseInt(p.spriteSheet.frameMap.crashed, 10)   : 4
        }
      };
    }
  } catch(e) { console.warn('[CharConfig] Load failed:', e); }
}

function saveCharacterConfig() {
  try {
    localStorage.setItem('dino_char_config', JSON.stringify({
      skin:               characterConfig.skin,
      bodyColor:          characterConfig.bodyColor,
      accentColor:        characterConfig.accentColor,
      customImageDataUrl: characterConfig.customImageDataUrl,
      spriteSheet:        characterConfig.spriteSheet
    }));
  } catch(e) { console.warn('[CharConfig] Save failed (storage full?):', e); }
}

function resizeImageFile(file, maxPx, callback) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      let sw = img.width, sh = img.height;
      if (sw > maxPx || sh > maxPx) {
        if (sw >= sh) { sh = Math.round(sh * maxPx / sw); sw = maxPx; }
        else          { sw = Math.round(sw * maxPx / sh); sh = maxPx; }
      }
      const oc = document.createElement('canvas');
      oc.width = sw; oc.height = sh;
      oc.getContext('2d').drawImage(img, 0, 0, sw, sh);
      callback(oc.toDataURL('image/png', 0.85));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function applyUploadedImage(file) {
  resizeImageFile(file, 400, (dataUrl) => {
    characterConfig.customImageDataUrl = dataUrl;
    characterConfig.skin = 'custom_image';
    if (!characterConfig.spriteSheet) {
      characterConfig.spriteSheet = {
        enabled: false,
        rows: 2,
        cols: 4,
        frameMap: {
          running_0: 0,
          running_1: 1,
          jumping: 0,
          ducking_0: 2,
          ducking_1: 3,
          crashed: 4
        }
      };
    }
    const img = new Image();
    img.onload = () => {
      characterConfig.customImage = img;
      const previewImg = document.getElementById('upload-preview-img');
      const previewImgFallback = document.getElementById('upload-preview-img-fallback');
      if (previewImg) previewImg.src = dataUrl;
      if (previewImgFallback) previewImgFallback.src = dataUrl;
      
      document.getElementById('upload-preview-wrapper')?.classList.remove('hidden');
      document.getElementById('upload-zone')?.classList.add('hidden');
      document.querySelectorAll('.skin-card').forEach(c => c.classList.remove('active'));
      
      _syncModalToConfig();
    };
    img.src = dataUrl;
  });
}

// ============================================================
// --- CHARACTER CUSTOMIZATION MODAL ---
// ============================================================

function initCustomizationModal() {
  const modal      = document.getElementById('character-modal');
  const openBtn    = document.getElementById('customize-btn');
  const closeBtn   = document.getElementById('close-char-modal');
  const applyBtn   = document.getElementById('apply-char-btn');
  const resetBtn   = document.getElementById('reset-char-btn');
  const backdrop   = modal.querySelector('.char-modal-backdrop');
  const fileInput  = document.getElementById('image-upload-input');
  const uploadZone = document.getElementById('upload-zone');

  // --- OPEN ---
  openBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('char-modal--open'));
    _syncModalToConfig();
    _genSwatches('body-swatches',   CHAR_BODY_COLORS,   'body');
    _genSwatches('accent-swatches', CHAR_ACCENT_COLORS, 'accent');
    _startPreviewAnim();
  });

  // --- CLOSE ---
  function closeModal() {
    modal.classList.remove('char-modal--open');
    setTimeout(() => modal.classList.add('hidden'), 320);
    _stopPreviewAnim();
  }
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  // --- TABS ---
  modal.querySelectorAll('.char-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.char-tab').forEach(t => t.classList.remove('active'));
      modal.querySelectorAll('.char-tab-content').forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // --- SKIN CARDS ---
  modal.querySelectorAll('.skin-card').forEach(card => {
    card.addEventListener('click', () => {
      modal.querySelectorAll('.skin-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      characterConfig.skin = card.dataset.skin;
    });
  });

  // --- COLOR PICKERS ---
  document.getElementById('body-color-picker').addEventListener('input', e => {
    characterConfig.bodyColor = e.target.value;
    document.querySelectorAll('#body-swatches .swatch:not(.swatch-custom)').forEach(s => s.classList.remove('active'));
  });
  document.getElementById('accent-color-picker').addEventListener('input', e => {
    characterConfig.accentColor = e.target.value;
    document.querySelectorAll('#accent-swatches .swatch:not(.swatch-custom)').forEach(s => s.classList.remove('active'));
  });

  // --- IMAGE UPLOAD ---
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault(); uploadZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) applyUploadedImage(f);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) applyUploadedImage(e.target.files[0]);
  });

  // --- REMOVE IMAGE ---
  document.getElementById('remove-custom-image').addEventListener('click', () => {
    characterConfig.customImage        = null;
    characterConfig.customImageDataUrl = null;
    if (characterConfig.skin === 'custom_image') characterConfig.skin = 'classic';
    document.getElementById('upload-preview-wrapper').classList.add('hidden');
    document.getElementById('upload-zone').classList.remove('hidden');
    _syncModalToConfig();
  });

  // --- APPLY ---
  applyBtn.addEventListener('click', () => {
    saveCharacterConfig();
    const orig = applyBtn.textContent;
    applyBtn.textContent = '\u2713 Saved!';
    applyBtn.disabled = true;
    setTimeout(() => { applyBtn.textContent = orig; applyBtn.disabled = false; }, 1200);
    closeModal();
  });

  // --- RESET ---
  resetBtn.addEventListener('click', () => {
    characterConfig = {
      skin: 'classic',
      bodyColor: null,
      accentColor: null,
      customImage: null,
      customImageDataUrl: null,
      spriteSheet: {
        enabled: false,
        rows: 2,
        cols: 4,
        frameMap: {
          running_0: 0,
          running_1: 1,
          jumping: 0,
          ducking_0: 2,
          ducking_1: 3,
          crashed: 4
        }
      }
    };
    localStorage.removeItem('dino_char_config');
    document.getElementById('upload-preview-wrapper').classList.add('hidden');
    document.getElementById('upload-zone').classList.remove('hidden');
    _syncModalToConfig();
    _genSwatches('body-swatches',   CHAR_BODY_COLORS,   'body');
    _genSwatches('accent-swatches', CHAR_ACCENT_COLORS, 'accent');
  });

  // --- SPRITE SHEET EDITOR UI LISTENERS ---
  const enableCheckbox = document.getElementById('spritesheet-enable');
  const rowsInput = document.getElementById('spritesheet-rows');
  const colsInput = document.getElementById('spritesheet-cols');

  enableCheckbox.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    if (!characterConfig.spriteSheet) {
      characterConfig.spriteSheet = {
        enabled: false,
        rows: 2,
        cols: 4,
        frameMap: { running_0: 0, running_1: 1, jumping: 0, ducking_0: 2, ducking_1: 3, crashed: 4 }
      };
    }
    characterConfig.spriteSheet.enabled = enabled;
    document.getElementById('spritesheet-options').classList.toggle('hidden', !enabled);
    document.getElementById('spritesheet-disabled-preview').classList.toggle('hidden', enabled);
    document.querySelector('.char-modal-panel').classList.toggle('expanded', enabled);

    if (enabled) {
      _updateVisualGridOverlay();
      characterConfig.skin = 'custom_image';
      document.querySelectorAll('.skin-card').forEach(c => c.classList.remove('active'));
    }
  });

  const handleDimensionChange = () => {
    let rowsVal = parseInt(rowsInput.value, 10);
    if (isNaN(rowsVal) || rowsVal < 1) rowsVal = 1;
    if (rowsVal > 10) rowsVal = 10;
    rowsInput.value = rowsVal;

    let colsVal = parseInt(colsInput.value, 10);
    if (isNaN(colsVal) || colsVal < 1) colsVal = 1;
    if (colsVal > 10) colsVal = 10;
    colsInput.value = colsVal;

    _updateVisualGridOverlay();
    _updateFrameMapFromUI();
  };

  rowsInput.addEventListener('change', handleDimensionChange);
  colsInput.addEventListener('change', handleDimensionChange);

  const _updateFrameMapFromUI = () => {
    if (!characterConfig.spriteSheet) return;
    characterConfig.spriteSheet.frameMap = {
      running_0: parseInt(document.getElementById('map-run-0').value, 10) || 0,
      running_1: parseInt(document.getElementById('map-run-1').value, 10) || 0,
      jumping:   parseInt(document.getElementById('map-jump').value, 10) || 0,
      ducking_0: parseInt(document.getElementById('map-duck-0').value, 10) || 0,
      ducking_1: parseInt(document.getElementById('map-duck-1').value, 10) || 0,
      crashed:   parseInt(document.getElementById('map-crash').value, 10) || 0
    };
  };

  const selects = ['map-run-0', 'map-run-1', 'map-jump', 'map-duck-0', 'map-duck-1', 'map-crash'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', _updateFrameMapFromUI);
      // Interactive preview override on focus
      el.addEventListener('focus', () => {
        if (id === 'map-run-0') _previewStateOverride = 'running_0';
        else if (id === 'map-run-1') _previewStateOverride = 'running_1';
        else if (id === 'map-jump') _previewStateOverride = 'jumping';
        else if (id === 'map-duck-0') _previewStateOverride = 'ducking_0';
        else if (id === 'map-duck-1') _previewStateOverride = 'ducking_1';
        else if (id === 'map-crash') _previewStateOverride = 'crashed';
      });
      el.addEventListener('blur', () => {
        _previewStateOverride = null;
      });

      // Hover preview override on parent map-row element
      const row = el.closest('.map-row');
      if (row) {
        row.addEventListener('mouseenter', () => {
          if (id === 'map-run-0') _previewStateOverride = 'running_0';
          else if (id === 'map-run-1') _previewStateOverride = 'running_1';
          else if (id === 'map-jump') _previewStateOverride = 'jumping';
          else if (id === 'map-duck-0') _previewStateOverride = 'ducking_0';
          else if (id === 'map-duck-1') _previewStateOverride = 'ducking_1';
          else if (id === 'map-crash') _previewStateOverride = 'crashed';
        });
        row.addEventListener('mouseleave', () => {
          _previewStateOverride = null;
        });
      }
    }
  });
}

function _syncModalToConfig() {
  document.querySelectorAll('.skin-card').forEach(c =>
    c.classList.toggle('active', c.dataset.skin === characterConfig.skin)
  );
  if (characterConfig.bodyColor)   document.getElementById('body-color-picker').value   = characterConfig.bodyColor;
  if (characterConfig.accentColor) document.getElementById('accent-color-picker').value = characterConfig.accentColor;
  
  const activeTabIndex = characterConfig.skin === 'custom_image' ? 2 : 0;
  document.querySelectorAll('.char-tab').forEach((t, i)          => t.classList.toggle('active', i === activeTabIndex));
  document.querySelectorAll('.char-tab-content').forEach((tc, i) => tc.classList.toggle('active', i === activeTabIndex));
  
  const hasImg = !!characterConfig.customImageDataUrl;
  document.getElementById('upload-preview-wrapper').classList.toggle('hidden', !hasImg);
  document.getElementById('upload-zone').classList.toggle('hidden', hasImg);
  
  if (hasImg) {
    const dataUrl = characterConfig.customImageDataUrl;
    document.getElementById('upload-preview-img').src = dataUrl;
    document.getElementById('upload-preview-img-fallback').src = dataUrl;
    
    const ss = characterConfig.spriteSheet || {
      enabled: false,
      rows: 2,
      cols: 4,
      frameMap: { running_0: 0, running_1: 1, jumping: 0, ducking_0: 2, ducking_1: 3, crashed: 4 }
    };
    
    const enableCheckbox = document.getElementById('spritesheet-enable');
    enableCheckbox.checked = ss.enabled;
    
    document.getElementById('spritesheet-options').classList.toggle('hidden', !ss.enabled);
    document.getElementById('spritesheet-disabled-preview').classList.toggle('hidden', ss.enabled);
    document.querySelector('.char-modal-panel').classList.toggle('expanded', ss.enabled);
    
    document.getElementById('spritesheet-rows').value = ss.rows;
    document.getElementById('spritesheet-cols').value = ss.cols;
    
    _updateVisualGridOverlay();
    
    if (ss.frameMap) {
      document.getElementById('map-run-0').value = ss.frameMap.running_0 ?? 0;
      document.getElementById('map-run-1').value = ss.frameMap.running_1 ?? 1;
      document.getElementById('map-jump').value = ss.frameMap.jumping ?? 0;
      document.getElementById('map-duck-0').value = ss.frameMap.ducking_0 ?? 2;
      document.getElementById('map-duck-1').value = ss.frameMap.ducking_1 ?? 3;
      document.getElementById('map-crash').value = ss.frameMap.crashed ?? 4;
    }
  } else {
    document.getElementById('spritesheet-enable').checked = false;
    document.getElementById('spritesheet-options').classList.add('hidden');
    document.getElementById('spritesheet-disabled-preview').classList.remove('hidden');
    document.querySelector('.char-modal-panel').classList.remove('expanded');
  }
}

function _updateVisualGridOverlay() {
  const rowsInput = document.getElementById('spritesheet-rows');
  const colsInput = document.getElementById('spritesheet-cols');
  
  let rows = Math.max(1, Math.min(10, parseInt(rowsInput.value, 10) || 1));
  let cols = Math.max(1, Math.min(10, parseInt(colsInput.value, 10) || 1));
  
  if (!characterConfig.spriteSheet) {
    characterConfig.spriteSheet = {
      enabled: false,
      rows: 2,
      cols: 4,
      frameMap: { running_0: 0, running_1: 1, jumping: 0, ducking_0: 2, ducking_1: 3, crashed: 4 }
    };
  }
  characterConfig.spriteSheet.rows = rows;
  characterConfig.spriteSheet.cols = cols;
  
  const totalCells = rows * cols;
  const overlay = document.getElementById('grid-overlay');
  if (overlay) {
    overlay.style.setProperty('--rows', rows);
    overlay.style.setProperty('--cols', cols);
    overlay.innerHTML = '';
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell-label';
      cell.textContent = i;
      overlay.appendChild(cell);
    }
  }
  
  const selects = [
    document.getElementById('map-run-0'),
    document.getElementById('map-run-1'),
    document.getElementById('map-jump'),
    document.getElementById('map-duck-0'),
    document.getElementById('map-duck-1'),
    document.getElementById('map-crash')
  ];
  
  selects.forEach(sel => {
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    for (let i = 0; i < totalCells; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Cell ${i}`;
      sel.appendChild(opt);
    }
    if (currentVal !== "" && parseInt(currentVal, 10) < totalCells) {
      sel.value = currentVal;
    } else {
      if (sel.id === 'map-run-0') sel.value = 0;
      else if (sel.id === 'map-run-1') sel.value = Math.min(1, totalCells - 1);
      else if (sel.id === 'map-jump') sel.value = 0;
      else if (sel.id === 'map-duck-0') sel.value = Math.min(2, totalCells - 1);
      else if (sel.id === 'map-duck-1') sel.value = Math.min(3, totalCells - 1);
      else if (sel.id === 'map-crash') sel.value = Math.min(4, totalCells - 1);
    }
  });
}

function _genSwatches(containerId, colors, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const activeColor = type === 'body' ? characterConfig.bodyColor : characterConfig.accentColor;
  colors.forEach(color => {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.style.background = color;
    if (activeColor === color) s.classList.add('active');
    s.addEventListener('click', () => {
      container.querySelectorAll('.swatch').forEach(sw => sw.classList.remove('active'));
      s.classList.add('active');
      if (type === 'body') {
        characterConfig.bodyColor = color;
        document.getElementById('body-color-picker').value = color;
      } else {
        characterConfig.accentColor = color;
        document.getElementById('accent-color-picker').value = color;
      }
    });
    container.appendChild(s);
  });
  // '+' custom picker swatch
  const plus = document.createElement('div');
  plus.className = 'swatch swatch-custom';
  plus.textContent = '+';
  plus.title = 'Pick custom color';
  plus.addEventListener('click', () =>
    document.getElementById(type === 'body' ? 'body-color-picker' : 'accent-color-picker').click()
  );
  container.appendChild(plus);
}

// --- PREVIEW ANIMATION LOOP ---

function _startPreviewAnim() {
  _stopPreviewAnim();
  _previewLastTime = performance.now();
  _previewRunFrame = 0; _previewRunTimer = 0;
  (function loop(ts) {
    const dt = Math.min((ts - _previewLastTime) / 1000, 0.05);
    _previewLastTime = ts;
    _previewRunTimer += dt;
    if (_previewRunTimer > 0.1) { _previewRunFrame = (_previewRunFrame + 1) % 2; _previewRunTimer = 0; }
    _drawPreviewCanvas();
    _previewAnimId = requestAnimationFrame(loop);
  })(performance.now());
}

function _stopPreviewAnim() {
  if (_previewAnimId) { cancelAnimationFrame(_previewAnimId); _previewAnimId = null; }
}

function _drawPreviewCanvas() {
  const canvas = document.getElementById('char-preview-canvas');
  if (!canvas) return;
  const pc = canvas.getContext('2d');
  const pw = canvas.width, ph = canvas.height;
  pc.clearRect(0, 0, pw, ph);

  // Background
  const bg = activeTheme === 'classic-light' ? '#efefef'
           : activeTheme === 'classic-dark'  ? '#1c1c1e'
           : activeTheme === 'cyberpunk'     ? '#05050a'
           : activeTheme === 'space-nebula'  ? '#0b0217' : '#0e0625';
  pc.fillStyle = bg;
  pc.fillRect(0, 0, pw, ph);

  // Subtle grid
  pc.strokeStyle = activeTheme.includes('light') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
  pc.lineWidth = 1;
  for (let gx = 0; gx <= pw; gx += 20) { pc.beginPath(); pc.moveTo(gx,0); pc.lineTo(gx,ph); pc.stroke(); }
  for (let gy = 0; gy <= ph; gy += 20) { pc.beginPath(); pc.moveTo(0,gy); pc.lineTo(pw,gy); pc.stroke(); }

  // Ground line
  const groundY = Math.round(ph * 0.78);
  pc.strokeStyle = themeColors.ground; pc.lineWidth = 2;
  pc.beginPath(); pc.moveTo(0, groundY); pc.lineTo(pw, groundY); pc.stroke();

  // Determine state & dimensions
  let previewState = `running_${_previewRunFrame}`;
  if (_previewStateOverride) {
    previewState = _previewStateOverride;
  }

  let dw = 44, dh = 48;
  if (previewState.startsWith('ducking')) {
    dw = 55;
    dh = 28;
  }

  const dx = Math.round((pw - dw) / 2);
  const dy = groundY - dh;
  const bodyCol   = characterConfig.bodyColor   || themeColors.dino;
  const accentCol = characterConfig.accentColor || (activeTheme.includes('light') ? '#f7f7f7' : '#000000');

  pc.save();
  if (activeTheme !== 'classic-light' && activeTheme !== 'classic-dark') {
    pc.shadowBlur = 12; pc.shadowColor = bodyCol;
  }
  _drawDinoWithSkin(pc, dx, dy, dw, dh, previewState, bodyCol, accentCol);
  pc.restore();

  // Running dust puffs (only show if running)
  if (previewState.startsWith('running')) {
    pc.globalAlpha = 0.25;
    pc.fillStyle = themeColors.ground;
    for (let d = 0; d < 3; d++) pc.fillRect(dx + 2 - d * 8, groundY, 5 - d, 2);
    pc.globalAlpha = 1;
  }
}

// --- POWER-UP FLOATING ENTITIES ---

class PowerUpItem {
  constructor(type, xSpeed) {
    this.x = 820;
    this.y = 110 + Math.random() * 50; // heights reachable by jumping
    this.width = 28;
    this.height = 28;
    this.type = type; // POWERUP_TYPE
    this.speed = xSpeed;
    this.markedForDeletion = false;
    
    this.hoverTimer = Math.random() * Math.PI;
    this.rotateAngle = 0;
  }

  update(dt) {
    // Scroll speed affected by Slow-mo
    const isSlow = dino && dino.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
    const scrollSpeed = this.speed * (isSlow ? 0.5 : 1.0);
    
    this.x -= scrollSpeed * dt;
    
    if (this.x + this.width < 0) {
      this.markedForDeletion = true;
    }

    // Floating vertical wave and rotating
    this.hoverTimer += dt * 4;
    this.rotateAngle += dt * 2;
  }

  getHitbox() {
    return {
      x: this.x,
      y: this.y + Math.sin(this.hoverTimer) * 4,
      width: this.width,
      height: this.height
    };
  }

  draw() {
    ctx.save();
    
    const centerY = this.y + Math.sin(this.hoverTimer) * 4 + this.height/2;
    const centerX = this.x + this.width/2;
    const size = 12 + Math.sin(this.hoverTimer * 2) * 1.5;
    
    // Glow and color depending on power-up type
    let color = '#ffffff';
    if (this.type === POWERUP_TYPE.SHIELD) color = themeColors.secondary; // Cyan
    else if (this.type === POWERUP_TYPE.DOUBLE_JUMP) color = themeColors.accent; // Pink/Red
    else if (this.type === POWERUP_TYPE.SLOW_MOTION) color = '#f7e018'; // Yellow

    if (activeTheme !== 'classic-light' && activeTheme !== 'classic-dark') {
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
    }
    
    // Draw surrounding glowing ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Fill ring background slightly
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();

    // Draw central rotating symbol
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotateAngle);
    ctx.fillStyle = color;

    if (this.type === POWERUP_TYPE.SHIELD) {
      // Draw 🛡️ shape
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -4);
      ctx.lineTo(5, 3);
      ctx.quadraticCurveTo(0, 8, -5, 3);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === POWERUP_TYPE.DOUBLE_JUMP) {
      // Draw feather/wing 🪶 shape
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-5, -3, 3, 6);
      ctx.fillRect(2, -1, 3, 4);
    } else if (this.type === POWERUP_TYPE.SLOW_MOTION) {
      // Draw Hourglass shape
      ctx.fillRect(-5, -6, 10, 2); // top plate
      ctx.fillRect(-5, 4, 10, 2);  // bottom plate
      
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.lineTo(0, -1);
      ctx.lineTo(4, -4);
      ctx.lineTo(4, -3);
      ctx.lineTo(1, 0);
      ctx.lineTo(4, 3);
      ctx.lineTo(4, 4);
      ctx.lineTo(-4, 4);
      ctx.lineTo(-4, 3);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-4, -3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

// --- PARTICLE EMITTERS ---

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() * 2 - 1) * 60;
    this.vy = (Math.random() * 2 - 1) * 60;
    this.life = 1.0; // scales down to 0
    this.decay = Math.random() * 1.5 + 1.0; // speed of fade
    this.color = '#ffffff';
    this.size = Math.random() * 4 + 1;
    this.markedForDeletion = false;
  }

  update(dt) {
    // If slow-motion, particles update slower too
    const isSlow = dino && dino.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
    const dtMult = isSlow ? 0.6 : 1.0;

    this.x += this.vx * dt * dtMult;
    this.y += this.vy * dt * dtMult;
    this.life -= dt * this.decay * dtMult;
    
    if (this.life <= 0) {
      this.markedForDeletion = true;
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    
    if (activeTheme !== 'classic-light' && activeTheme !== 'classic-dark') {
      ctx.shadowBlur = 6;
      ctx.shadowColor = this.color;
    }
    
    ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    ctx.restore();
  }
}

// Sub-classes of Particle for custom behaviors
class RunningDust extends Particle {
  constructor(x, y) {
    super(x, y);
    this.vx = -currentSpeed * 0.4 - Math.random() * 30;
    this.vy = -Math.random() * 40;
    this.color = activeTheme.includes('light') ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)';
    if (activeTheme === 'synthwave') this.color = 'rgba(255, 0, 127, 0.3)';
    if (activeTheme === 'cyberpunk') this.color = 'rgba(0, 255, 102, 0.3)';
    if (activeTheme === 'space-nebula') this.color = 'rgba(186, 85, 211, 0.35)';
    this.size = Math.random() * 5 + 2;
    this.decay = 2.5;
  }
}

class CrashShard extends Particle {
  constructor(x, y, customColor) {
    super(x, y);
    this.vx = (Math.random() - 0.3) * 200 - 50; // shoot outwards
    this.vy = -Math.random() * 200 - 50; // and upwards
    this.color = customColor || themeColors.accent;
    this.size = Math.random() * 6 + 3;
    this.decay = 1.0;
  }
  update(dt) {
    super.update(dt);
    this.vy += 400 * dt; // subject to local gravity
  }
}

class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color || '#ffffff';
    this.vy = -50; // rise upwards
    this.alpha = 1;
    this.markedForDeletion = false;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.alpha -= 1.5 * dt; // fade out quickly
    if (this.alpha <= 0) {
      this.markedForDeletion = true;
    }
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    if (activeTheme.includes('classic')) {
      ctx.font = '8px "Press Start 2P"';
    } else {
      ctx.font = 'bold 10px Orbitron, sans-serif';
    }
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

function spawnObstacleExplosion(x, y) {
  const numShards = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < numShards; i++) {
    particles.push(new CrashShard(x, y, themeColors.obstacle));
  }
}

function spawnFloatingText(x, y, text, color) {
  particles.push(new FloatingText(x, y, text, color));
}

function fireProjectile() {
  if (ammo <= 0) {
    soundManager.playDryFire();
    if (ammoCounter) {
      ammoCounter.classList.add('shake');
      setTimeout(() => {
        ammoCounter.classList.remove('shake');
      }, 300);
    }
    return;
  }
  
  ammo--;
  updateAmmoHUD();
  soundManager.playShoot();
  
  const startX = dino.x + dino.width;
  const startY = dino.y + dino.height / 2 - 4;
  
  projectiles.push(new Projectile(startX, startY, activeTheme));
}

function updateAmmoHUD() {
  if (!ammoCounter) return;
  const segments = ammoCounter.querySelectorAll('.ammo-segment');
  segments.forEach((seg, idx) => {
    if (idx < ammo) {
      seg.classList.add('active');
    } else {
      seg.classList.remove('active');
    }
  });
}

// Helper generators for specific effect animations
function spawnLandingSparks(x, y) {
  let col = activeTheme.includes('light') ? '#535353' : '#ffffff';
  if (activeTheme === 'synthwave') col = themeColors.secondary;
  if (activeTheme === 'cyberpunk') col = themeColors.accent;
  if (activeTheme === 'space-nebula') col = themeColors.secondary;
  
  for (let i = 0; i < 8; i++) {
    const p = new Particle(x, y);
    p.vx = (Math.random() * 2 - 1) * 120;
    p.vy = -Math.random() * 50 - 20;
    p.color = col;
    p.size = Math.random() * 3 + 1;
    p.decay = 3;
    particles.push(p);
  }
}

function spawnJumpDust(x, y) {
  for (let i = 0; i < 6; i++) {
    const p = new Particle(x, y);
    p.vx = (Math.random() * 2 - 1) * 40;
    p.vy = -Math.random() * 20;
    p.color = activeTheme.includes('light') ? 'rgba(0,0,0,0.1)' : 'rgba(255, 255, 255, 0.15)';
    if (activeTheme === 'synthwave') p.color = 'rgba(0, 243, 255, 0.3)';
    if (activeTheme === 'space-nebula') p.color = 'rgba(0, 255, 255, 0.35)';
    p.size = Math.random() * 6 + 2;
    p.decay = 2.0;
    particles.push(p);
  }
}

function spawnDoubleJumpCircle(x, y) {
  let col = themeColors.accent;
  for (let i = 0; i < 15; i++) {
    const p = new Particle(x, y);
    const angle = (i / 15) * Math.PI * 2;
    const speed = 100;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed * 0.3 + 10;
    p.color = col;
    p.size = 3;
    p.decay = 2.0;
    particles.push(p);
  }
}

function spawnPowerUpRing(x, y) {
  let col = themeColors.secondary;
  for (let i = 0; i < 24; i++) {
    const p = new Particle(x, y);
    const angle = (i / 24) * Math.PI * 2;
    const speed = 160;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.color = col;
    p.size = Math.random() * 4 + 2;
    p.decay = 1.5;
    particles.push(p);
  }
}

function spawnCrashExplosion(x, y) {
  // Massive explosion shards
  let colors = [themeColors.accent, themeColors.secondary, '#ffffff'];
  if (activeTheme.includes('classic')) colors = [themeColors.obstacle, '#757575'];
  
  for (let i = 0; i < 35; i++) {
    const col = colors[Math.floor(Math.random() * colors.length)];
    particles.push(new CrashShard(x, y, col));
  }
}

// --- THEME SELECTOR HANDLING ---

function applyTheme(themeName) {
  activeTheme = themeName;
  if (gameWrapper) {
    gameWrapper.className = 'game-wrapper';
    gameWrapper.classList.add(`theme-${themeName}`);
  }
  
  // Update canvas color references
  if (themeName === 'classic-light') {
    themeColors = {
      ground: '#535353', dino: '#535353', dinoGlow: 'transparent',
      obstacle: '#535353', obstacleGlow: 'transparent', text: '#535353',
      sky: '#f7f7f7', accent: '#535353', secondary: '#757575', ambientGlow: 'transparent'
    };
  } else if (themeName === 'classic-dark') {
    themeColors = {
      ground: '#e8eaed', dino: '#e8eaed', dinoGlow: 'transparent',
      obstacle: '#e8eaed', obstacleGlow: 'transparent', text: '#e8eaed',
      sky: '#202124', accent: '#e8eaed', secondary: '#9aa0a6', ambientGlow: 'transparent'
    };
  } else if (themeName === 'synthwave') {
    themeColors = {
      ground: '#ff007f', dino: '#ffffff', dinoGlow: '#ff007f',
      obstacle: '#00f3ff', obstacleGlow: '#00f3ff', text: '#ffffff',
      sky: '#12092e', accent: '#ff007f', secondary: '#00f3ff', ambientGlow: 'rgba(255, 0, 127, 0.25)'
    };
  } else if (themeName === 'cyberpunk') {
    themeColors = {
      ground: '#00ff66', dino: '#00ff66', dinoGlow: '#00ff66',
      obstacle: '#f7e018', obstacleGlow: '#f7e018', text: '#00ff66',
      sky: '#000000', accent: '#00ff66', secondary: '#f7e018', ambientGlow: 'rgba(0, 255, 102, 0.2)'
    };
  } else if (themeName === 'space-nebula') {
    themeColors = {
      ground: '#00ffff', dino: '#ffffff', dinoGlow: '#ba55d3',
      obstacle: '#ba55d3', obstacleGlow: '#ba55d3', text: '#ffffff',
      sky: '#0b0217', accent: '#ba55d3', secondary: '#00ffff', ambientGlow: 'rgba(186, 85, 211, 0.25)'
    };
  }

  // Set mobile buttons borders/colors matching themes
  mobileDuckBtn.style.borderColor = themeColors.accent;
  mobileDuckBtn.style.color = themeColors.accent;
  mobileJumpBtn.style.borderColor = themeColors.secondary;
  mobileJumpBtn.style.color = themeColors.secondary;

  generateBackgrounds();
}

// --- AUDIO UI TOGGLING ---

function applySoundUI() {
  if (soundManager.isMuted) {
    soundOnIcon.classList.add('hidden');
    soundOffIcon.classList.remove('hidden');
  } else {
    soundOnIcon.classList.remove('hidden');
    soundOffIcon.classList.add('hidden');
  }
}

function toggleSound() {
  const isMuted = soundManager.toggleMute();
  applySoundUI();
}

// --- GAME LOGIC FLOW ---

function startGame() {
  if (crashTimeoutId) {
    clearTimeout(crashTimeoutId);
    crashTimeoutId = null;
  }
  state = GAME_STATE.PLAYING;
  
  // Hide UI overlays
  startOverlay.classList.remove('active');
  pauseOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  
  pauseBtn.disabled = false;
  
  // Reset Stats
  score = 0;
  lastMilestone = 0; // Reset classic day/night transition tracking
  distanceRan = 0;
  obstaclesAvoided = 0;
  timeElapsed = 0;
  currentSpeed = INITIAL_SPEED;
  nextObstacleTimer = 1.0; // spawn first obstacle after 1s
  nextPowerUpTimer = 10.0; // spawn powerup after 10s
  nextAmmoTimer = 6.0; // spawn first ammo pickup after 6s
  ammo = 0;
  
  // Instantiate Dino
  dino = new DinoCharacter();
  
  // Clear lists
  obstacles = [];
  powerups = [];
  projectiles = [];
  ammoPickups = [];
  particles = [];
  
  if (gameMode === 'arcade') {
    if (hudAmmoBox) hudAmmoBox.classList.remove('hidden');
    if (mobileShootBtn) mobileShootBtn.classList.remove('hidden');
  } else {
    if (hudAmmoBox) hudAmmoBox.classList.add('hidden');
    if (mobileShootBtn) mobileShootBtn.classList.add('hidden');
  }
  updateAmmoHUD();
  
  // Deactivate powerup bar in classic mode
  dino.deactivatePowerUp();
  if (gameMode === 'classic') {
    powerupStatus.classList.add('hidden');
  }

  soundManager.playJump();
}

function pauseGame() {
  if (state !== GAME_STATE.PLAYING) return;
  state = GAME_STATE.PAUSED;
  pauseOverlay.classList.add('active');
  pauseOverlay.classList.remove('hidden');
  pauseBtn.querySelector('path').setAttribute('d', 'M8,5.14V19.14L19,12.14L8,5.14Z'); // Play icon
}

function resumeGame() {
  if (state !== GAME_STATE.PAUSED) return;
  state = GAME_STATE.PLAYING;
  pauseOverlay.classList.remove('active');
  pauseOverlay.classList.add('hidden');
  pauseBtn.querySelector('path').setAttribute('d', 'M14,19H18V5H14M6,19H10V5H6V19Z'); // Pause icon
  lastTime = performance.now(); // reset delta timer
}

function triggerGameOver() {
  state = GAME_STATE.CRASHED;
  dino.isCrashed = true;
  pauseBtn.disabled = true;
  
  // Screen shake and crash particles
  screenShake = 15;
  spawnCrashExplosion(dino.x + dino.width/2, dino.y + dino.height/2);
  
  soundManager.playGameOver();
  saveHighScore();
  
  crashTimeoutId = setTimeout(() => {
    crashTimeoutId = null;
    if (state === GAME_STATE.CRASHED) {
      showGameOverScreen();
    }
  }, 1500);
}

function showGameOverScreen() {
  state = GAME_STATE.GAMEOVER;
  
  // UI Display
  finalScoreVal.textContent = String(score).padStart(5, '0');
  finalTimeVal.textContent = `${Math.floor(timeElapsed)}s`;
  finalObstaclesVal.textContent = obstaclesAvoided;
  
  gameoverOverlay.classList.remove('hidden');
  gameoverOverlay.classList.add('active');
}

// --- DETECT INPUTS ---

function setupEventListeners() {
  // Keyboard Events
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; // prevent key holding jump triggers
    
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state === GAME_STATE.PLAYING) {
        dino.jump();
      } else if (state === GAME_STATE.MENU) {
        startGame();
      } else if (state === GAME_STATE.GAMEOVER) {
        startGame();
      }
    }
    
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      if (state === GAME_STATE.PLAYING) {
        dino.duck(true);
      }
    }

    if (e.code === 'KeyF') {
      e.preventDefault();
      if (state === GAME_STATE.PLAYING && gameMode === 'arcade') {
        fireProjectile();
      }
    }

    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      if (state === GAME_STATE.PLAYING) {
        pauseGame();
      } else if (state === GAME_STATE.PAUSED) {
        resumeGame();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown') {
      if (state === GAME_STATE.PLAYING) {
        dino.duck(false);
      }
    }
  });

  // Mobile/Mouse HUD buttons
  startGameBtn.addEventListener('click', startGame);
  resumeBtn.addEventListener('click', resumeGame);
  restartGameBtn.addEventListener('click', startGame);
  
  soundBtn.addEventListener('click', toggleSound);
  
  pauseBtn.addEventListener('click', () => {
    if (state === GAME_STATE.PLAYING) pauseGame();
    else if (state === GAME_STATE.PAUSED) resumeGame();
  });

  themeSelect.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });

  modeSelect.addEventListener('change', (e) => {
    gameMode = e.target.value;
    if (state === GAME_STATE.PLAYING) {
      // Force restart to apply mode
      startGame();
    }
  });

  // Mobile Touch Controls
  mobileJumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state === GAME_STATE.PLAYING) {
      dino.jump();
    } else if (state === GAME_STATE.MENU) {
      startGame();
    } else if (state === GAME_STATE.GAMEOVER) {
      startGame();
    }
  });

  mobileDuckBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state === GAME_STATE.PLAYING) {
      dino.duck(true);
    }
  });

  mobileDuckBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (state === GAME_STATE.PLAYING) {
      dino.duck(false);
    }
  });

  if (mobileShootBtn) {
    mobileShootBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (state === GAME_STATE.PLAYING && gameMode === 'arcade') {
        fireProjectile();
      }
    });
  }

  // Clicking on canvas starts game too
  canvas.addEventListener('mousedown', (e) => {
    if (state === GAME_STATE.MENU) {
      startGame();
    } else if (state === GAME_STATE.GAMEOVER) {
      startGame();
    } else if (state === GAME_STATE.PLAYING && e.offsetX > 700 && e.offsetY < 50) {
      // click near top-right pauses
      pauseGame();
    }
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
  });
}

// --- COLLISION DETECTION ---
function checkCollision(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.y + rect1.height > rect2.y;
}

// --- SPAWN MANAGER ---

function updateSpawns(dt) {
  // If slow-motion, spawning occurs at slower intervals too
  const isSlow = dino && dino.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
  const timeMult = isSlow ? 0.6 : 1.0;

  // 1. Spawning Obstacles
  nextObstacleTimer -= dt * timeMult;
  if (nextObstacleTimer <= 0) {
    // Determine obstacle type based on current speed and randomization
    let type = 'cactus_s';
    const rand = Math.random();
    
    if (currentSpeed < 450) {
      // only small and large single cacti
      type = rand < 0.6 ? 'cactus_s' : 'cactus_l';
    } else if (currentSpeed < 600) {
      // double cacti and single
      if (rand < 0.4) type = 'cactus_s';
      else if (rand < 0.7) type = 'cactus_l';
      else type = 'cactus_double';
    } else {
      // birds, triple cacti and double cacti
      if (rand < 0.25) type = 'cactus_l';
      else if (rand < 0.45) type = 'cactus_double';
      else if (rand < 0.6) type = 'cactus_triple';
      else type = 'bird'; // Birds spawn at high speeds!
    }

    obstacles.push(new Obstacle(type, currentSpeed));
    
    // Set timer for next obstacle, scale with speed so they don't overlap
    // Min gap based on current speed
    const minGap = 1.2;
    const maxGap = 2.5;
    nextObstacleTimer = minGap + Math.random() * (maxGap - minGap);
  }

  // 2. Spawning Powerups (only in arcade mode)
  if (gameMode === 'arcade') {
    nextPowerUpTimer -= dt * timeMult;
    if (nextPowerUpTimer <= 0) {
      // Pick random powerup type
      const types = [POWERUP_TYPE.SHIELD, POWERUP_TYPE.DOUBLE_JUMP, POWERUP_TYPE.SLOW_MOTION];
      const selectedType = types[Math.floor(Math.random() * types.length)];
      
      powerups.push(new PowerUpItem(selectedType, currentSpeed));
      
      // Spawn next powerup in 12-20s
      nextPowerUpTimer = 12 + Math.random() * 8;
    }
    
    // 3. Spawning Ammo Pickups (only in arcade mode)
    nextAmmoTimer -= dt * timeMult;
    if (nextAmmoTimer <= 0) {
      const yLevel = Math.random() < 0.6 ? 220 : 150;
      
      // Prevent spawning overlapping elements
      const nearObstacle = obstacles.some(obs => obs.x > 750);
      const nearPowerUp = powerups.some(pw => pw.x > 750);
      
      if (!nearObstacle && !nearPowerUp) {
        ammoPickups.push(new AmmoPickup(yLevel, activeTheme));
        nextAmmoTimer = 12 + Math.random() * 6;
      } else {
        nextAmmoTimer = 0.5; // retry soon
      }
    }
  }
}

// --- DRAW PARALLAX BACKGROUNDS & SCENERY ---

function drawScenery(dt) {
  const isSlow = dino && dino.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
  const speedFactor = isSlow ? 0.5 : 1.0;

  // Draw Synthwave Grid & Sunset elements
  if (activeTheme === 'synthwave') {
    drawSynthwaveBackground(dt, speedFactor);
  } else if (activeTheme === 'cyberpunk') {
    drawCyberpunkBackground(dt, speedFactor);
  } else if (activeTheme === 'space-nebula') {
    drawSpaceBackground(dt, speedFactor);
  } else {
    // Classic Day/Night dynamic backdrop
    drawClassicBackground(dt, speedFactor);
  }
}

function drawSynthwaveBackground(dt, speedFactor) {
  // 1. Giant Retro Sun
  const sunX = 400;
  const sunY = 160;
  const sunRadius = 60;
  
  ctx.save();
  // Draw Sun Gradient
  const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
  sunGrad.addColorStop(0, '#f7e018'); // Yellow top
  sunGrad.addColorStop(0.5, '#ff007f'); // Neon pink middle
  sunGrad.addColorStop(1, '#7a005a');  // Purple bottom
  
  ctx.fillStyle = sunGrad;
  ctx.shadowBlur = 25;
  ctx.shadowColor = '#ff007f';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sun horizontal slices (classic retro synthwave aesthetic)
  ctx.fillStyle = themeColors.sky; // matches sky bg
  for (let i = 0; i < 7; i++) {
    const sliceY = sunY + 12 + i * 7;
    const sliceH = 2 + i * 0.8;
    if (sliceY < sunY + sunRadius) {
      ctx.fillRect(sunX - sunRadius - 10, sliceY, sunRadius * 2 + 20, sliceH);
    }
  }

  // 2. Stars twinkling
  ctx.fillStyle = '#ffffff';
  stars.forEach(star => {
    star.alpha += Math.sin(Date.now() * 0.001 * star.pulseSpeed) * 0.05;
    ctx.globalAlpha = Math.max(0.1, Math.min(1.0, star.alpha));
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });
  ctx.globalAlpha = 1.0;

  // 3. Parallax Mountains
  ctx.fillStyle = '#1c0c45';
  terrainFeatures.forEach(mount => {
    // Parallax scroll
    mount.x -= mount.speed * dt * speedFactor;
    if (mount.x + mount.width < 0) {
      mount.x = 800;
    }
    
    // Draw polygon mountain
    ctx.beginPath();
    ctx.moveTo(mount.x, 248);
    ctx.lineTo(mount.x + mount.width * 0.4, 248 - mount.height);
    ctx.lineTo(mount.x + mount.width * 0.5, 248 - mount.height * 0.8);
    ctx.lineTo(mount.x + mount.width * 0.6, 248 - mount.height * 1.1);
    ctx.lineTo(mount.x + mount.width, 248);
    ctx.closePath();
    ctx.fill();
    
    // Draw subtle glowing contour line
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // 4. Ground Neon gridlines scrolling (Pseudo 3D perspective Grid!)
  draw3DGrid(248, 340, groundGridOffset); // Expanded end Y to match canvas height
  
  groundGridOffset -= currentSpeed * dt * speedFactor;
  if (groundGridOffset <= -40) groundGridOffset = 0;
}

function drawCyberpunkBackground(dt, speedFactor) {
  // Stars / Neon nodes in sky
  ctx.fillStyle = 'rgba(0, 255, 102, 0.4)';
  stars.forEach(star => {
    ctx.fillRect(star.x, star.y, star.size, star.size);
    if (Math.random() < 0.001) {
      // Connect nearby stars with grid matrix lines
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.05)';
      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(star.x + 30, star.y + 20);
      ctx.stroke();
    }
  });

  // City Skyline Parallax
  ctx.fillStyle = '#060a08';
  ctx.strokeStyle = 'rgba(0, 255, 102, 0.08)';
  ctx.lineWidth = 1.5;
  terrainFeatures.forEach(building => {
    building.x -= building.speed * dt * speedFactor;
    if (building.x + building.width < 0) {
      building.x = 800;
    }
    
    // Draw building blocks
    ctx.fillRect(building.x, 248 - building.height, building.width, building.height);
    ctx.strokeRect(building.x, 248 - building.height, building.width, building.height);
    
    // Draw some yellow/green neon windows
    ctx.fillStyle = Math.sin(building.x * 0.05) > 0 ? 'rgba(0, 255, 102, 0.2)' : 'rgba(247, 224, 24, 0.1)';
    const winCols = 4;
    const winRows = 6;
    const winW = building.width / (winCols * 2);
    const winH = building.height / (winRows * 2);
    
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if ((r+c) % 2 === 0) {
          ctx.fillRect(building.x + 10 + c * (winW + 8), 248 - building.height + 10 + r * (winH + 8), winW, winH);
        }
      }
    }
    ctx.fillStyle = '#060a08'; // restore fill style
  });

  // Draw cyber green matrix grid
  draw3DGrid(248, 340, groundGridOffset); // Expanded end Y to match canvas height
  
  groundGridOffset -= currentSpeed * dt * speedFactor;
  if (groundGridOffset <= -40) groundGridOffset = 0;
}

function drawSpaceBackground(dt, speedFactor) {
  // 1. Draw glowing space nebula clouds
  ctx.save();
  
  // Nebula 1: glowing violet/purple
  let neb1X = 250 - (distanceRan * 0.1) % 1000;
  if (neb1X < -200) neb1X += 1000;
  let grad1 = ctx.createRadialGradient(neb1X, 90, 5, neb1X, 90, 160);
  grad1.addColorStop(0, 'rgba(186, 85, 211, 0.22)');
  grad1.addColorStop(0.5, 'rgba(123, 31, 162, 0.08)');
  grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad1;
  ctx.beginPath();
  ctx.arc(neb1X, 90, 160, 0, Math.PI * 2);
  ctx.fill();

  // Nebula 2: cosmic cyan/teal
  let neb2X = 750 - (distanceRan * 0.12) % 1000;
  if (neb2X < -200) neb2X += 1000;
  let grad2 = ctx.createRadialGradient(neb2X, 70, 5, neb2X, 70, 140);
  grad2.addColorStop(0, 'rgba(0, 255, 255, 0.16)');
  grad2.addColorStop(0.5, 'rgba(0, 136, 255, 0.06)');
  grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad2;
  ctx.beginPath();
  ctx.arc(neb2X, 70, 140, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();

  // 2. Twinkling space stars with multi-colors and cross flares
  ctx.save();
  stars.forEach(star => {
    star.alpha += Math.sin(Date.now() * 0.001 * star.pulseSpeed) * 0.05;
    ctx.globalAlpha = Math.max(0.1, Math.min(1.0, star.alpha));
    
    // Choose star color based on hash value
    const hash = Math.floor(star.x + star.y);
    if (hash % 3 === 0) {
      ctx.fillStyle = '#00ffff';
    } else if (hash % 3 === 1) {
      ctx.fillStyle = '#ba55d3';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    
    ctx.fillRect(star.x, star.y, star.size, star.size);
    
    // Tiny cross flare for brighter/larger stars
    if (star.size > 1.8) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(star.x - 2, star.y + 0.5, star.size + 4, 0.5);
      ctx.fillRect(star.x + 0.5, star.y - 2, 0.5, star.size + 4);
    }
  });
  ctx.restore();

  // 3. Parallax Celestial Bodies & Space Stations
  terrainFeatures.forEach((feature, idx) => {
    feature.x -= feature.speed * 0.25 * dt * speedFactor;
    if (feature.x + feature.width < 0) {
      feature.x = 800 + Math.random() * 100;
    }

    ctx.save();
    if (idx === 0) {
      // Draw ringed planet (Saturn style)
      const px = feature.x + feature.width / 2;
      const py = 75;
      const r = 20;

      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00ffff';

      // Ring back half
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.55)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(px, py, 38, 9, Math.PI / 8, Math.PI, 0);
      ctx.stroke();

      // Planet sphere
      let planetGrad = ctx.createLinearGradient(px - r, py - r, px + r, py + r);
      planetGrad.addColorStop(0, '#ba55d3');
      planetGrad.addColorStop(1, '#0e031a');
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      // Ring front half
      ctx.beginPath();
      ctx.ellipse(px, py, 38, 9, Math.PI / 8, 0, Math.PI);
      ctx.stroke();
    } else if (idx === 1) {
      // Draw distant gas planet
      const px = feature.x + feature.width / 2;
      const py = 95;
      const r = 14;
      
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ba55d3';
      
      let planetGrad = ctx.createLinearGradient(px - r, py - r, px + r, py + r);
      planetGrad.addColorStop(0, '#00ffff');
      planetGrad.addColorStop(1, '#042129');
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Draw high-tech solar space station
      const px = feature.x + feature.width / 2;
      const py = 60;
      
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ba55d3';
      ctx.strokeStyle = '#ba55d3';
      ctx.lineWidth = 1.5;
      
      // Central hub ring
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.stroke();
      
      // Core glowing reactor
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Left and right solar wing struts
      ctx.strokeStyle = '#ba55d3';
      ctx.beginPath();
      ctx.moveTo(px - 32, py);
      ctx.lineTo(px + 32, py);
      ctx.stroke();
      
      // Solar wing panels
      ctx.fillStyle = 'rgba(0, 255, 255, 0.85)';
      ctx.fillRect(px - 32, py - 6, 12, 12);
      ctx.fillRect(px + 20, py - 6, 12, 12);
    }
    ctx.restore();
  });

  // 4. Vanishing 3D perspective grid lines
  draw3DGrid(248, 340, groundGridOffset);
  
  groundGridOffset -= currentSpeed * dt * speedFactor;
  if (groundGridOffset <= -40) groundGridOffset = 0;
}

function draw3DGrid(startY, endY, offset) {
  ctx.save();
  ctx.strokeStyle = themeColors.ground;
  ctx.lineWidth = 1.5;
  
  if (activeTheme !== 'classic-light' && activeTheme !== 'classic-dark') {
    ctx.shadowBlur = 8;
    ctx.shadowColor = themeColors.ground;
  }

  // Draw horizontal lines with logarithmic perspective scaling (closer lines are further apart)
  let y = startY;
  let spacing = 6;
  while (y < endY) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
    ctx.stroke();
    
    spacing *= 1.35; // increase spacing as it approaches viewport bottom
    y += spacing;
  }

  // Draw perspective vanishing vertical lines radiating from vanishing point in center
  const vanishingX = 400;
  const vanishingY = 160; // horizon
  const count = 18;
  
  for (let i = 0; i <= count; i++) {
    const angle = Math.PI + (i / count) * Math.PI;
    const endX = vanishingX + Math.cos(angle) * 1200;
    const endY_line = vanishingY - Math.sin(angle) * 1200;
    
    ctx.beginPath();
    ctx.moveTo(vanishingX, vanishingY);
    ctx.lineTo(endX, endY_line);
    
    // Clip lines so they only draw below the horizon
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, startY, 800, endY - startY);
    ctx.clip();
    
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// Classic pixel-art sprite for Moon — full rounded crescent
const MOON_SPRITE = [
  "     XXXXXX   ",
  "   XXXXXXXXX  ",
  "  XXXXXXXXXX  ",
  " XXXXXXXXXXX  ",
  "XXXXXXXXXX    ",
  "XXXXXXXXX     ",
  "XXXXXXXXX     ",
  "XXXXXXXXX     ",
  "XXXXXXXXX     ",
  "XXXXXXXXXX    ",
  " XXXXXXXXXXX  ",
  "  XXXXXXXXXX  ",
  "   XXXXXXXXX  ",
  "     XXXXXX   "
];

function drawPixelSprite(ctx, sprite, startX, startY, pixelSize, color) {
  ctx.save();
  ctx.fillStyle = color;
  for (let r = 0; r < sprite.length; r++) {
    const row = sprite[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'X') {
        ctx.fillRect(startX + c * pixelSize, startY + r * pixelSize, pixelSize, pixelSize);
      }
    }
  }
  ctx.restore();
}

function drawClassicBackground(dt, speedFactor) {
  // Day/Night transitions depending on score milestones
  // Over 700 points, day/night toggles. We update theme only when milestone changes to respect user selection
  if (state === GAME_STATE.PLAYING) {
    const milestone = Math.floor(score / 700);
    if (milestone !== lastMilestone) {
      if (activeTheme === 'classic-light') {
        applyTheme('classic-dark');
        themeSelect.value = 'classic-dark';
      } else if (activeTheme === 'classic-dark') {
        applyTheme('classic-light');
        themeSelect.value = 'classic-light';
      }
      lastMilestone = milestone;
    }
  }

  // 1. Draw background astronomical body (Sun or Moon & Stars)
  //    Rays twinkle using per-ray sin-wave with unique phase offsets
  const t = Date.now() * 0.001; // time in seconds

  if (activeTheme === 'classic-light') {
    ctx.save();
    ctx.fillStyle = themeColors.secondary;

    // Core Sun square (always solid)
    ctx.fillRect(120, 50, 36, 36);

    // Draw sun ray helper — alpha pulses with unique phase per ray
    const drawSunRay = (x, y, w, h, phase) => {
      ctx.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.5 + phase));
      ctx.fillRect(x, y, w, h);
    };

    drawSunRay(136, 34, 4, 8,  0.0);    // Top
    drawSunRay(136, 94, 4, 8,  0.8);    // Bottom
    drawSunRay(104, 66, 8, 4,  1.6);    // Left
    drawSunRay(164, 66, 8, 4,  2.4);    // Right
    drawSunRay(108, 38, 4, 4,  3.2);    // Top-Left
    drawSunRay(164, 38, 4, 4,  4.0);    // Top-Right
    drawSunRay(108, 94, 4, 4,  4.8);    // Bottom-Left
    drawSunRay(164, 94, 4, 4,  5.6);    // Bottom-Right

    ctx.globalAlpha = 1.0;
    ctx.restore();

  } else if (activeTheme === 'classic-dark') {
    // Draw twinkling classic stars
    ctx.save();
    ctx.fillStyle = themeColors.secondary;
    stars.forEach(star => {
      star.alpha += Math.sin(Date.now() * 0.001 * star.pulseSpeed) * 0.05;
      ctx.globalAlpha = Math.max(0.1, Math.min(1.0, star.alpha));
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    ctx.restore();

    // Draw moon ray helper — slower, softer twinkle than the sun
    ctx.save();
    ctx.fillStyle = themeColors.secondary;
    const drawMoonRay = (x, y, w, h, phase) => {
      ctx.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.8 + phase));
      ctx.fillRect(x, y, w, h);
    };

    // Moon sprite: x=120–156, y=50–92, center=(138,71)
    // Gap from body to ray = 8px (same as sun rays)
    // Top:    moon top=50,   ray bottom=42  → y=34, h=8  ✓
    // Bottom: moon bottom=92, ray top=100   → y=100, h=8 (was 91 — overlapped!)
    // Left:   moon left=120,  ray right=112 → x=104, w=8 ✓ ; center y=71, ray h=4 → y=69
    // Right:  moon right=156, ray left=164  → x=164, w=8 ✓ ; center y=71, ray h=4 → y=69
    drawMoonRay(136, 34,  4, 8,  0.0);   // Top
    drawMoonRay(136, 100, 4, 8,  0.9);   // Bottom  (moved: 91 → 100, no longer overlaps moon)
    drawMoonRay(104, 69,  8, 4,  1.8);   // Left    (recentered: y=64 → 69, aligned to moon center)
    drawMoonRay(164, 69,  8, 4,  2.7);   // Right   (recentered: y=64 → 69, aligned to moon center)
    drawMoonRay(108, 38,  4, 4,  3.6);   // Top-Left
    drawMoonRay(164, 38,  4, 4,  4.5);   // Top-Right
    drawMoonRay(108, 100, 4, 4,  5.4);   // Bottom-Left  (moved: 91 → 100)
    drawMoonRay(164, 100, 4, 4,  6.3);   // Bottom-Right (moved: 91 → 100)

    ctx.globalAlpha = 1.0;
    ctx.restore();

    // Draw classic pixel-art Moon on top of rays (so rays appear around moon, not over it)
    drawPixelSprite(ctx, MOON_SPRITE, 120, 50, 3, themeColors.secondary);
  }

  // Draw classic flat ground line
  ctx.strokeStyle = themeColors.ground;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 248);
  ctx.lineTo(800, 248);
  ctx.stroke();
  
  // Ground details (little pixel bumps scrolling by)
  ctx.fillStyle = themeColors.ground;
  groundGridOffset -= currentSpeed * dt * speedFactor;
  if (groundGridOffset <= -200) groundGridOffset = 0;
  
  for (let i = 0; i < 5; i++) {
    const bumpX = groundGridOffset + i * 200 + 40;
    ctx.fillRect(bumpX, 252, 5, 2);
    ctx.fillRect(bumpX + 10, 255, 2, 2);
    ctx.fillRect(bumpX + 80, 250, 8, 2);
  }

  // Parallax clouds
  clouds.forEach(cloud => {
    cloud.x -= cloud.speed * dt * speedFactor;
    if (cloud.x + cloud.size * 2 < 0) {
      cloud.x = 800;
      cloud.y = Math.random() * 80 + 30;
    }
    
    // Draw classic pixel-ish flat cloud
    ctx.fillStyle = themeColors.secondary;
    ctx.fillRect(cloud.x, cloud.y, cloud.size * 2, cloud.size * 0.4);
    ctx.fillRect(cloud.x + cloud.size * 0.3, cloud.y - cloud.size * 0.2, cloud.size * 1.3, cloud.size * 0.4);
    ctx.fillRect(cloud.x + cloud.size * 0.6, cloud.y - cloud.size * 0.35, cloud.size * 0.7, cloud.size * 0.4);
  });
}

// --- RENDER HUD STATS ---

function updateHUD(dt) {
  // Score accumulates slowly based on distance ran
  if (state === GAME_STATE.PLAYING) {
    const isSlow = dino && dino.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
    const speedFactor = isSlow ? 0.5 : 1.0;
    
    distanceRan += currentSpeed * dt * speedFactor * 0.1;
    timeElapsed += dt;
    
    const prevScore = score;
    score = Math.floor(distanceRan);
    
    // Play score chime beep every 100 points
    if (Math.floor(score / 100) > Math.floor(prevScore / 100)) {
      soundManager.playScore();
    }
  }

  scoreVal.textContent = String(score).padStart(5, '0');
}

// --- GAME LOOP ENGINE ---

function gameLoop(timestamp) {
  // Calculate Delta Time in seconds
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  
  // Cap max delta time to prevent clipping during frame drops
  if (dt > 0.1) dt = 0.1;
  lastTime = timestamp;

  // Clear Canvas
  ctx.fillStyle = themeColors.sky;
  ctx.fillRect(0, 0, 800, 340); // Expanded clear height to clear entire canvas

  // Apply Screen Shake translates
  ctx.save();
  if (screenShake > 0) {
    const dx = (Math.random() * 2 - 1) * screenShake;
    const dy = (Math.random() * 2 - 1) * screenShake;
    ctx.translate(dx, dy);
    screenShake -= dt * 30; // dampening shake over time
  }

  // DRAWING AND LOGIC BRANCHES
  if (state === GAME_STATE.PLAYING || state === GAME_STATE.CRASHED) {
    // 1. Physics update & Difficulty acceleration
    if (state === GAME_STATE.PLAYING) {
      const isSlow = dino && dino.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
      if (currentSpeed < MAX_SPEED) {
        const slowMult = isSlow ? 0.3 : 1.0;
        currentSpeed += ACCELERATION * dt * slowMult;
      }
    }

    // 2. Entities updating
    dino.update(dt);
    if (state === GAME_STATE.PLAYING) {
      updateSpawns(dt);
    }
    
    // Scenery background (scroll only if playing)
    drawScenery(state === GAME_STATE.PLAYING ? dt : 0);

    // Obstacles loop
    obstacles.forEach(obs => {
      if (state === GAME_STATE.PLAYING) {
        obs.update(dt);
      }
      obs.draw();
      
      // Collision checker
      if (state === GAME_STATE.PLAYING && checkCollision(dino.getHitbox(), obs.getHitbox())) {
        if (dino.activePowerUp === POWERUP_TYPE.SHIELD) {
          // Shield absorbs collision
          dino.deactivatePowerUp();
          obs.markedForDeletion = true;
          screenShake = 6;
          soundManager.playGameOver(); // play a small explosion crash
          
          // spawn shield breaks sparks
          spawnPowerUpRing(obs.x + obs.width/2, obs.y + obs.height/2);
        } else {
          // Game over!
          triggerGameOver();
        }
      }
      
      // Pass stats tracking
      if (state === GAME_STATE.PLAYING && !obs.passed && obs.x + obs.width < dino.x) {
        obs.passed = true;
        obstaclesAvoided++;
      }
    });
    
    // Powerups loop
    powerups.forEach(pw => {
      if (state === GAME_STATE.PLAYING) {
        pw.update(dt);
      }
      pw.draw();
      
      // Touch collection checker
      if (state === GAME_STATE.PLAYING && checkCollision(dino.getHitbox(), pw.getHitbox())) {
        pw.markedForDeletion = true;
        
        // 8 seconds of power-up duration
        dino.activatePowerUp(pw.type, 8.0);
      }
    });

    // Projectiles loop
    projectiles.forEach(proj => {
      if (state === GAME_STATE.PLAYING) {
        proj.update(dt);
        
        // Projectile vs Obstacle collision checker
        obstacles.forEach(obs => {
          if (!obs.markedForDeletion && !proj.markedForDeletion && checkCollision(proj.getHitbox(), obs.getHitbox())) {
            proj.markedForDeletion = true;
            obs.markedForDeletion = true;
            score += 100;
            soundManager.playExplosion();
            screenShake = 4;
            spawnObstacleExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2);
          }
        });
      }
      proj.draw(ctx, themeColors);
    });

    // Ammo Pickups loop
    ammoPickups.forEach(ammoItem => {
      if (state === GAME_STATE.PLAYING) {
        ammoItem.update(dt, currentSpeed);
        
        // Touch collection checker
        if (checkCollision(dino.getHitbox(), ammoItem.getHitbox())) {
          ammoItem.markedForDeletion = true;
          if (ammo < 5) {
            ammo++;
          }
          updateAmmoHUD();
          soundManager.playReload();
          spawnFloatingText(ammoItem.x + ammoItem.width / 2, ammoItem.y - 10, "+1 AMMO", themeColors.secondary);
        }
      }
      ammoItem.draw(ctx, themeColors);
    });

    // Cleanup arrays
    obstacles = obstacles.filter(o => !o.markedForDeletion);
    powerups = powerups.filter(p => !p.markedForDeletion);
    projectiles = projectiles.filter(p => !p.markedForDeletion);
    ammoPickups = ammoPickups.filter(a => !a.markedForDeletion);
    
    // Particles update
    particles.forEach(p => {
      p.update(dt);
      p.draw();
    });
    particles = particles.filter(p => !p.markedForDeletion);

    // Draw Dino
    dino.draw();

  } else {
    // MENUS STATS PREVIEW (PAUSED OR GAMEOVER OR INITIAL START)
    drawScenery(0); // static backgrounds

    obstacles.forEach(o => o.draw());
    powerups.forEach(p => p.draw());
    projectiles.forEach(p => p.draw(ctx, themeColors));
    ammoPickups.forEach(a => a.draw(ctx, themeColors));
    particles.forEach(p => {
      p.draw();
    });

    if (dino) {
      dino.draw();
    }
  }

  // Restore screen shake translates
  ctx.restore();

  // HUD and score ticking
  updateHUD(dt);

  // Loop request
  requestAnimationFrame(gameLoop);
}

// Start game instance on load
window.addEventListener('DOMContentLoaded', init);
