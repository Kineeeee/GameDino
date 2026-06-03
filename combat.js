/**
 * Dino Chrome - Combat System
 * Projectiles and Ammo pickups entities
 */

class Projectile {
  constructor(x, y, theme) {
    this.x = x;
    this.y = y;
    this.width = 16;
    this.height = 8;
    this.vx = 600; // pixels per second
    this.vy = 0;
    this.markedForDeletion = false;
    this.theme = theme || 'classic-light';
  }

  update(dt) {
    // Projectile moves at a constant speed to feel responsive,
    // regardless of whether slow-motion is active in the environment
    this.x += this.vx * dt;

    // Delete if goes off screen
    if (this.x > 810) {
      this.markedForDeletion = true;
    }
  }

  getHitbox() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  draw(ctx, themeColors) {
    ctx.save();

    if (this.theme === 'classic-light' || this.theme === 'classic-dark') {
      // Classic 1-bit pixel laser dash
      ctx.fillStyle = themeColors.accent || '#535353';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      // Draw pixelated tip
      ctx.fillRect(this.x + this.width, this.y + 2, 2, 4);
    } else if (this.theme === 'synthwave') {
      // Synthwave glowing pink/cyan laser bolt
      ctx.shadowBlur = 8;
      ctx.shadowColor = themeColors.secondary || '#00f3ff';
      ctx.fillStyle = themeColors.secondary || '#00f3ff';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
    } else if (this.theme === 'cyberpunk') {
      // Cyberpunk yellow/green neon laser pulse
      ctx.shadowBlur = 8;
      ctx.shadowColor = themeColors.secondary || '#f7e018';
      ctx.fillStyle = themeColors.secondary || '#f7e018';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
    } else if (this.theme === 'space-nebula') {
      // Space Nebula glowing plasma orb
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffae00';
      ctx.fillStyle = '#ffae00';
      
      ctx.beginPath();
      const radius = this.height / 2;
      ctx.arc(this.x + this.width - radius, this.y + radius, radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ff4d00';
      ctx.fillRect(this.x, this.y + 1, this.width - radius, this.height - 2);
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x + this.width - radius - 2, this.y + radius, radius / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

class AmmoPickup {
  constructor(yLevel, theme) {
    this.x = 810;
    this.yLevel = yLevel; // ground y is ~220, floating is ~150
    this.y = yLevel;
    this.width = 20;
    this.height = 20;
    this.markedForDeletion = false;
    this.theme = theme || 'classic-light';
    this.pulseTimer = 0;
  }

  update(dt, worldSpeed) {
    // Scrolls with the environment speed
    this.x -= worldSpeed * dt;
    
    // Animate the vertical floating effect
    this.pulseTimer += dt;
    const hoverOffset = Math.sin(this.pulseTimer * 5) * 4;
    this.y = this.yLevel + hoverOffset;

    // Delete if goes off screen
    if (this.x + this.width < 0) {
      this.markedForDeletion = true;
    }
  }

  getHitbox() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  draw(ctx, themeColors) {
    ctx.save();
    
    if (this.theme === 'classic-light' || this.theme === 'classic-dark') {
      // Retro 1-bit pixel canister box with "+" symbol
      ctx.strokeStyle = themeColors.accent || '#535353';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      
      ctx.fillStyle = themeColors.accent || '#535353';
      // Draw vertical bar of "+"
      ctx.fillRect(this.x + 9, this.y + 4, 2, 12);
      // Draw horizontal bar of "+"
      ctx.fillRect(this.x + 4, this.y + 9, 12, 2);
    } else if (this.theme === 'synthwave' || this.theme === 'cyberpunk') {
      // Neon glowing energy battery pack
      const glowColor = themeColors.secondary || '#00f3ff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2;
      
      // Draw rounded rectangle battery border
      this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, 4);
      
      // Draw positive contact tip on top
      ctx.fillStyle = glowColor;
      ctx.fillRect(this.x + 7, this.y - 2, 6, 2);
      
      // Draw battery level bars inside
      const numBars = 3;
      const totalSpacing = 4; // padding left/right
      const spaceBetween = 2;
      const barW = (this.width - totalSpacing * 2 - (numBars - 1) * spaceBetween) / numBars;
      const barH = this.height - 8;
      
      for (let i = 0; i < numBars; i++) {
        ctx.fillRect(
          this.x + totalSpacing + i * (barW + spaceBetween),
          this.y + 4,
          barW,
          barH
        );
      }
    } else if (this.theme === 'space-nebula') {
      // High-tech alien fuel core capsule
      ctx.shadowBlur = 12;
      ctx.shadowColor = themeColors.secondary || '#00ffff';
      ctx.fillStyle = themeColors.secondary || '#00ffff';
      
      // Draw diamond shape crystal
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y);
      ctx.lineTo(this.x + this.width, this.y + this.height / 2);
      ctx.lineTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x, this.y + this.height / 2);
      ctx.closePath();
      ctx.fill();
      
      // Inner glowing core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + 4);
      ctx.lineTo(this.x + this.width - 4, this.y + this.height / 2);
      ctx.lineTo(this.x + this.width / 2, this.y + this.height - 4);
      ctx.lineTo(this.x + 4, this.y + this.height / 2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.stroke();
  }
}
