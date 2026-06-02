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

// --- GAME CONSTANTS & STATE ---
const GAME_STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover'
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

// Entities collections
let dino = null;
let obstacles = [];
let powerups = [];
let particles = [];
let clouds = [];
let stars = []; // for synthwave/cyberpunk night sky
let terrainFeatures = []; // background mountains/structures
let groundGridOffset = 0;

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
  
  // Create static background elements once
  generateBackgrounds();
  
  // Game Loop
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
  // Let's render Dino using elegant shapes representing Chrome Dino.
  // In classic mode, it is pure black/white flat vector. In Synth/Cyberpunk, it is styled with matching neon glow.
  ctx.save();
  
  if (state.startsWith('ducking')) {
    // Squished ducking Dino!
    // Head & Snout (Right side)
    ctx.fillRect(x + 10, y + 4, 35, 12); // main head
    ctx.fillRect(x + 45, y + 8, 10, 8);  // snout front
    
    // Body & Tail (Left side)
    ctx.fillRect(x, y + 8, 12, 10);      // tail back
    ctx.fillRect(x + 6, y + 10, 25, 14); // lower belly
    
    // Eye
    ctx.fillStyle = theme.includes('light') ? '#f7f7f7' : '#000000';
    if (theme === 'cyberpunk') ctx.fillStyle = '#05050a';
    ctx.fillRect(x + 36, y + 6, 3, 3);
    
    // Running feet
    ctx.fillStyle = themeColors.dino;
    if (state === 'ducking_0') {
      ctx.fillRect(x + 16, y + 24, 4, 4); // Left leg down
      ctx.fillRect(x + 28, y + 24, 6, 2); // Right leg up
    } else {
      ctx.fillRect(x + 16, y + 24, 6, 2); // Left leg up
      ctx.fillRect(x + 28, y + 24, 4, 4); // Right leg down
    }
  } else {
    // Normal standing/jumping/running Dino
    // Tail
    ctx.fillRect(x, y + 16, 6, 12);
    ctx.fillRect(x + 4, y + 14, 6, 16);
    
    // Body
    ctx.fillRect(x + 8, y + 12, 22, 22);
    
    // Neck & Head
    ctx.fillRect(x + 20, y, 16, 12);
    ctx.fillRect(x + 20, y, 24, 16); // wider top head
    
    // Snout
    ctx.fillRect(x + 36, y + 4, 8, 12);
    
    // Eye
    ctx.fillStyle = theme.includes('light') ? '#f7f7f7' : '#000000';
    if (theme === 'cyberpunk') ctx.fillStyle = '#05050a';
    ctx.fillRect(x + 24, y + 4, 3, 3);
    
    // Reset back to main color for arms and legs
    ctx.fillStyle = themeColors.dino;
    
    // Small Arm
    ctx.fillRect(x + 32, y + 18, 6, 4);
    ctx.fillRect(x + 36, y + 20, 4, 2);

    // Legs
    if (state === 'jumping' || state === 'crashed') {
      ctx.fillRect(x + 12, y + 34, 4, 10);
      ctx.fillRect(x + 12, y + 42, 6, 2);
      ctx.fillRect(x + 24, y + 34, 4, 10);
      ctx.fillRect(x + 24, y + 42, 6, 2);
      
      if (state === 'crashed') {
        // Draw dramatic X eyes!
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(x + 24, y + 4, 3, 3);
      }
    } else if (state === 'running_0') {
      // Left leg down, Right leg bent
      ctx.fillRect(x + 12, y + 34, 4, 14);
      ctx.fillRect(x + 12, y + 46, 6, 2);
      
      ctx.fillRect(x + 24, y + 34, 4, 8);
      ctx.fillRect(x + 28, y + 40, 4, 2);
    } else if (state === 'running_1') {
      // Left leg bent, Right leg down
      ctx.fillRect(x + 12, y + 34, 4, 8);
      ctx.fillRect(x + 8, y + 40, 4, 2);
      
      ctx.fillRect(x + 24, y + 34, 4, 14);
      ctx.fillRect(x + 24, y + 46, 6, 2);
    }
  }

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

    if (this.isCactus) {
      // Programmatic pixel-cactus render
      drawCactusSprite(ctx, this.x, this.y, this.width, this.height, this.type);
    } else {
      // Flapping bird render
      drawBirdSprite(ctx, this.x, this.y, this.width, this.height, this.flapFrame, activeTheme);
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

// Helper generators for specific effect animations
function spawnLandingSparks(x, y) {
  let col = activeTheme.includes('light') ? '#535353' : '#ffffff';
  if (activeTheme === 'synthwave') col = themeColors.secondary;
  if (activeTheme === 'cyberpunk') col = themeColors.accent;
  
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
  
  // Instantiate Dino
  dino = new DinoCharacter();
  
  // Clear lists
  obstacles = [];
  powerups = [];
  particles = [];
  
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
  state = GAME_STATE.GAMEOVER;
  dino.isCrashed = true;
  pauseBtn.disabled = true;
  
  // Screen shake and crash particles
  screenShake = 15;
  spawnCrashExplosion(dino.x + dino.width/2, dino.y + dino.height/2);
  
  soundManager.playGameOver();
  saveHighScore();
  
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
  if (state === GAME_STATE.PLAYING) {
    // 1. Physics update & Difficulty acceleration
    const isSlow = dino && dino.activePowerUp === POWERUP_TYPE.SLOW_MOTION;
    if (currentSpeed < MAX_SPEED) {
      const slowMult = isSlow ? 0.3 : 1.0;
      currentSpeed += ACCELERATION * dt * slowMult;
    }

    // 2. Entities updating
    dino.update(dt);
    updateSpawns(dt);
    
    // Scenery background
    drawScenery(dt);

    // Obstacles loop
    obstacles.forEach(obs => {
      obs.update(dt);
      obs.draw();
      
      // Collision checker
      if (checkCollision(dino.getHitbox(), obs.getHitbox())) {
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
      if (!obs.passed && obs.x + obs.width < dino.x) {
        obs.passed = true;
        obstaclesAvoided++;
      }
    });
    
    // Powerups loop
    powerups.forEach(pw => {
      pw.update(dt);
      pw.draw();
      
      // Touch collection checker
      if (checkCollision(dino.getHitbox(), pw.getHitbox())) {
        pw.markedForDeletion = true;
        
        // 8 seconds of power-up duration
        dino.activatePowerUp(pw.type, 8.0);
      }
    });

    // Cleanup arrays
    obstacles = obstacles.filter(o => !o.markedForDeletion);
    powerups = powerups.filter(p => !p.markedForDeletion);
    
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
