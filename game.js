(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const els = {
    menu: document.getElementById('menu'),
    howPanel: document.getElementById('howPanel'),
    pausePanel: document.getElementById('pausePanel'),
    gameOverPanel: document.getElementById('gameOverPanel'),
    hud: document.getElementById('hud'),
    healthBar: document.getElementById('healthBar'),
    ammoText: document.getElementById('ammoText'),
    waveText: document.getElementById('waveText'),
    scoreText: document.getElementById('scoreText'),
    finalStats: document.getElementById('finalStats'),
    startBtn: document.getElementById('startBtn'),
    howBtn: document.getElementById('howBtn'),
    backBtn: document.getElementById('backBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    restartBtn: document.getElementById('restartBtn'),
    restartBtnPause: document.getElementById('restartBtnPause'),
    mobileControls: document.getElementById('mobileControls'),
    moveStick: document.getElementById('moveStick'),
    reloadTouch: document.getElementById('reloadTouch'),
    shootTouch: document.getElementById('shootTouch')
  };

  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const keys = new Set();
  const pointer = { x: 0, y: 0, down: false };
  const mobileMove = { x: 0, y: 0, active: false };
  const world = { width: 2200, height: 1500 };
  const camera = { x: 0, y: 0 };

  let lastTime = 0;
  let state = 'menu';
  let shake = 0;
  let audioReady = false;
  let audioCtx = null;

  const game = {
    player: null,
    bullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    obstacles: [],
    wave: 1,
    score: 0,
    highScore: Number(localStorage.getItem('combatArenaHighScore') || 0),
    nextShot: 0,
    reloading: 0,
    waveDelay: 0,
    spawnTicker: 0,
    enemiesRemainingToSpawn: 0
  };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function resize() {
    canvas.width = Math.floor(window.innerWidth * DPR);
    canvas.height = Math.floor(window.innerHeight * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    pointer.x = window.innerWidth / 2;
    pointer.y = window.innerHeight / 2;
  }

  function initAudio() {
    if (audioReady) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioReady = true;
    } catch (err) {
      audioReady = false;
    }
  }

  function beep(freq = 440, duration = 0.04, type = 'square', gain = 0.035) {
    if (!audioReady || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = type;
    amp.gain.value = gain;
    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start();
    amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  }

  function hidePanels() {
    els.menu.classList.add('hidden');
    els.howPanel.classList.add('hidden');
    els.pausePanel.classList.add('hidden');
    els.gameOverPanel.classList.add('hidden');
  }

  function makeObstacles() {
    const obs = [];
    for (let i = 0; i < 26; i++) {
      obs.push({
        x: rand(120, world.width - 260),
        y: rand(120, world.height - 220),
        w: rand(80, 180),
        h: rand(50, 140),
        hp: 1
      });
    }
    return obs;
  }

  function newGame() {
    initAudio();
    game.player = {
      x: world.width / 2,
      y: world.height / 2,
      r: 18,
      speed: 270,
      angle: 0,
      health: 100,
      maxHealth: 100,
      ammo: 30,
      magSize: 30,
      reserve: 120,
      fireRate: 95,
      invincible: 0
    };
    game.bullets = [];
    game.enemies = [];
    game.particles = [];
    game.pickups = [];
    game.obstacles = makeObstacles();
    game.wave = 1;
    game.score = 0;
    game.nextShot = 0;
    game.reloading = 0;
    game.waveDelay = 0;
    startWave();
    state = 'playing';
    hidePanels();
    els.hud.classList.remove('hidden');
    updateHud();
  }

  function startWave() {
    game.enemiesRemainingToSpawn = 5 + game.wave * 3;
    game.spawnTicker = 0.15;
  }

  function spawnEnemy() {
    const side = Math.floor(rand(0, 4));
    let x = 0;
    let y = 0;
    if (side === 0) { x = rand(0, world.width); y = -40; }
    if (side === 1) { x = world.width + 40; y = rand(0, world.height); }
    if (side === 2) { x = rand(0, world.width); y = world.height + 40; }
    if (side === 3) { x = -40; y = rand(0, world.height); }

    const fast = Math.random() < Math.min(0.35, 0.08 + game.wave * 0.02);
    const heavy = !fast && Math.random() < Math.min(0.28, game.wave * 0.018);
    game.enemies.push({
      x,
      y,
      r: heavy ? 24 : fast ? 14 : 18,
      speed: heavy ? rand(80, 110) : fast ? rand(185, 230) : rand(120, 165),
      health: heavy ? 95 + game.wave * 8 : fast ? 38 + game.wave * 3 : 58 + game.wave * 5,
      maxHealth: heavy ? 95 + game.wave * 8 : fast ? 38 + game.wave * 3 : 58 + game.wave * 5,
      damage: heavy ? 22 : fast ? 8 : 13,
      kind: heavy ? 'heavy' : fast ? 'fast' : 'grunt',
      hitFlash: 0
    });
  }

  function updateHud() {
    const p = game.player;
    const hp = clamp((p.health / p.maxHealth) * 100, 0, 100);
    els.healthBar.style.width = `${hp}%`;
    els.ammoText.textContent = game.reloading > 0 ? 'Reloading...' : `${p.ammo} / ${p.reserve}`;
    els.waveText.textContent = String(game.wave);
    els.scoreText.textContent = String(game.score);
  }

  function reload() {
    const p = game.player;
    if (game.reloading > 0 || p.ammo === p.magSize || p.reserve <= 0) return;
    game.reloading = 1.05;
    beep(220, 0.06, 'sawtooth', 0.025);
  }

  function finishReload() {
    const p = game.player;
    const needed = p.magSize - p.ammo;
    const taken = Math.min(needed, p.reserve);
    p.ammo += taken;
    p.reserve -= taken;
    beep(520, 0.05, 'triangle', 0.03);
  }

  function shoot() {
    const now = performance.now();
    const p = game.player;
    if (state !== 'playing' || now < game.nextShot || game.reloading > 0) return;
    if (p.ammo <= 0) {
      reload();
      return;
    }
    p.ammo -= 1;
    game.nextShot = now + p.fireRate;
    const spread = rand(-0.045, 0.045);
    const angle = p.angle + spread;
    const speed = 760;
    const muzzle = 24;
    game.bullets.push({
      x: p.x + Math.cos(angle) * muzzle,
      y: p.y + Math.sin(angle) * muzzle,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.8,
      r: 4,
      damage: 30
    });
    addParticles(p.x + Math.cos(angle) * 24, p.y + Math.sin(angle) * 24, 8, angle, '#ffe08a');
    shake = Math.max(shake, 4);
    beep(rand(120, 170), 0.035, 'square', 0.026);
  }

  function addParticles(x, y, count, angle, color) {
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-1.3, 1.3);
      const s = rand(50, 240);
      game.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.22, 0.55),
        maxLife: 0.55,
        size: rand(2, 6),
        color
      });
    }
  }

  function spawnPickup(x, y) {
    const roll = Math.random();
    if (roll < 0.14) {
      game.pickups.push({ x, y, r: 14, type: 'medkit', value: 30, life: 16 });
    } else if (roll < 0.28) {
      game.pickups.push({ x, y, r: 14, type: 'ammo', value: 30, life: 16 });
    }
  }

  function rectCircleCollision(rect, c) {
    const cx = clamp(c.x, rect.x, rect.x + rect.w);
    const cy = clamp(c.y, rect.y, rect.y + rect.h);
    return Math.hypot(c.x - cx, c.y - cy) < c.r;
  }

  function circleObstacleResolve(entity) {
    for (const o of game.obstacles) {
      if (!rectCircleCollision(o, entity)) continue;
      const cx = clamp(entity.x, o.x, o.x + o.w);
      const cy = clamp(entity.y, o.y, o.y + o.h);
      let dx = entity.x - cx;
      let dy = entity.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      entity.x = cx + dx * (entity.r + 0.5);
      entity.y = cy + dy * (entity.r + 0.5);
    }
  }

  function bulletHitsObstacle(b) {
    return game.obstacles.some(o => b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h);
  }

  function update(dt) {
    if (state !== 'playing') return;
    const p = game.player;

    if (game.reloading > 0) {
      game.reloading -= dt;
      if (game.reloading <= 0) finishReload();
    }

    let mx = 0;
    let my = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (mobileMove.active) {
      mx += mobileMove.x;
      my += mobileMove.y;
    }
    const ml = Math.hypot(mx, my) || 1;
    p.x += (mx / ml) * p.speed * dt;
    p.y += (my / ml) * p.speed * dt;
    p.x = clamp(p.x, p.r, world.width - p.r);
    p.y = clamp(p.y, p.r, world.height - p.r);
    circleObstacleResolve(p);

    const worldPointer = { x: pointer.x + camera.x, y: pointer.y + camera.y };
    if (mobileMove.active && Math.abs(mobileMove.x) + Math.abs(mobileMove.y) > 0.2) {
      p.angle = Math.atan2(mobileMove.y, mobileMove.x);
    } else {
      p.angle = Math.atan2(worldPointer.y - p.y, worldPointer.x - p.x);
    }

    if (pointer.down) shoot();

    camera.x = clamp(p.x - window.innerWidth / 2, 0, world.width - window.innerWidth);
    camera.y = clamp(p.y - window.innerHeight / 2, 0, world.height - window.innerHeight);

    game.spawnTicker -= dt;
    if (game.enemiesRemainingToSpawn > 0 && game.spawnTicker <= 0) {
      spawnEnemy();
      game.enemiesRemainingToSpawn -= 1;
      game.spawnTicker = clamp(0.75 - game.wave * 0.03, 0.25, 0.75);
    }

    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > world.width || b.y < 0 || b.y > world.height || bulletHitsObstacle(b)) {
        game.bullets.splice(i, 1);
      }
    }

    for (const e of game.enemies) {
      const angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;
      circleObstacleResolve(e);
      e.hitFlash = Math.max(0, e.hitFlash - dt);
    }

    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      for (let j = game.bullets.length - 1; j >= 0; j--) {
        const b = game.bullets[j];
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          e.health -= b.damage;
          e.hitFlash = 0.08;
          addParticles(b.x, b.y, 7, Math.atan2(b.vy, b.vx), '#f87171');
          game.bullets.splice(j, 1);
          break;
        }
      }
      if (e.health <= 0) {
        addParticles(e.x, e.y, 18, rand(0, Math.PI * 2), e.kind === 'heavy' ? '#fb923c' : '#f43f5e');
        game.score += e.kind === 'heavy' ? 60 : e.kind === 'fast' ? 35 : 45;
        spawnPickup(e.x, e.y);
        game.enemies.splice(i, 1);
        beep(rand(70, 100), 0.045, 'sawtooth', 0.02);
      }
    }

    if (p.invincible > 0) p.invincible -= dt;
    for (const e of game.enemies) {
      if (dist(p, e) < p.r + e.r && p.invincible <= 0) {
        p.health -= e.damage;
        p.invincible = 0.45;
        shake = 12;
        addParticles(p.x, p.y, 14, p.angle + Math.PI, '#ef4444');
        beep(90, 0.08, 'sawtooth', 0.04);
        if (p.health <= 0) {
          endGame();
          return;
        }
      }
    }

    for (let i = game.pickups.length - 1; i >= 0; i--) {
      const item = game.pickups[i];
      item.life -= dt;
      if (dist(p, item) < p.r + item.r) {
        if (item.type === 'medkit') p.health = clamp(p.health + item.value, 0, p.maxHealth);
        if (item.type === 'ammo') p.reserve += item.value;
        addParticles(item.x, item.y, 16, -Math.PI / 2, item.type === 'medkit' ? '#22c55e' : '#38bdf8');
        beep(item.type === 'medkit' ? 660 : 560, 0.07, 'triangle', 0.028);
        game.pickups.splice(i, 1);
      } else if (item.life <= 0) {
        game.pickups.splice(i, 1);
      }
    }

    for (let i = game.particles.length - 1; i >= 0; i--) {
      const part = game.particles[i];
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vx *= 0.92;
      part.vy *= 0.92;
      part.life -= dt;
      if (part.life <= 0) game.particles.splice(i, 1);
    }

    if (game.enemiesRemainingToSpawn <= 0 && game.enemies.length === 0) {
      game.waveDelay += dt;
      if (game.waveDelay > 1.4) {
        game.wave += 1;
        game.waveDelay = 0;
        p.health = clamp(p.health + 12, 0, p.maxHealth);
        game.score += 100;
        startWave();
      }
    }

    shake = Math.max(0, shake - dt * 24);
    updateHud();
  }

  function endGame() {
    state = 'gameover';
    els.hud.classList.add('hidden');
    els.gameOverPanel.classList.remove('hidden');
    game.highScore = Math.max(game.highScore, game.score);
    localStorage.setItem('combatArenaHighScore', String(game.highScore));
    els.finalStats.textContent = `Score: ${game.score} · Wave: ${game.wave} · Best: ${game.highScore}`;
  }

  function drawGrid() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = '#081120';
    ctx.fillRect(0, 0, world.width, world.height);

    const grid = 80;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= world.width; x += grid) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, world.height);
    }
    for (let y = 0; y <= world.height; y += grid) {
      ctx.moveTo(0, y);
      ctx.lineTo(world.width, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, world.width - 8, world.height - 8);
    ctx.restore();
  }

  function drawObstacles() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const o of game.obstacles) {
      const grad = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
      grad.addColorStop(0, 'rgba(51, 65, 85, 0.95)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
      ctx.fillStyle = grad;
      roundRect(o.x, o.y, o.w, o.h, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPlayer() {
    const p = game.player;
    ctx.save();
    ctx.translate(p.x - camera.x, p.y - camera.y);
    ctx.rotate(p.angle);

    ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = p.invincible > 0 ? '#93c5fd' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#dbeafe';
    roundRect(2, -5, 30, 10, 4);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    roundRect(13, -3, 20, 6, 3);
    ctx.fill();

    ctx.restore();
  }

  function drawEnemies() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const e of game.enemies) {
      const color = e.hitFlash > 0 ? '#ffffff' : e.kind === 'heavy' ? '#f97316' : e.kind === 'fast' ? '#f43f5e' : '#dc2626';
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.32)';
      ctx.shadowBlur = 13;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(e.x - e.r, e.y - e.r - 12, e.r * 2, 5);
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(e.x - e.r, e.y - e.r - 12, (e.health / e.maxHealth) * e.r * 2, 5);
    }
    ctx.restore();
  }

  function drawBullets() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const b of game.bullets) {
      ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPickups() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const item of game.pickups) {
      const pulse = 1 + Math.sin(performance.now() / 150) * 0.08;
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = item.type === 'medkit' ? '#22c55e' : '#38bdf8';
      ctx.shadowColor = item.type === 'medkit' ? '#22c55e' : '#38bdf8';
      ctx.shadowBlur = 18;
      roundRect(-item.r, -item.r, item.r * 2, item.r * 2, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      if (item.type === 'medkit') {
        ctx.fillRect(-3, -9, 6, 18);
        ctx.fillRect(-9, -3, 18, 6);
      } else {
        ctx.fillRect(-8, -8, 16, 16);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-5, -5, 10, 10);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const part of game.particles) {
      ctx.globalAlpha = clamp(part.life / part.maxLife, 0, 1);
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawCrosshair() {
    if (window.matchMedia('(hover: none)').matches) return;
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.moveTo(-18, 0);
    ctx.lineTo(-8, 0);
    ctx.moveTo(8, 0);
    ctx.lineTo(18, 0);
    ctx.moveTo(0, -18);
    ctx.lineTo(0, -8);
    ctx.moveTo(0, 8);
    ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.restore();
  }

  function drawOverlayText() {
    if (state === 'playing' && game.waveDelay > 0 && game.enemies.length === 0) {
      ctx.save();
      ctx.font = '800 28px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`Wave ${game.wave + 1} incoming...`, window.innerWidth / 2, 110);
      ctx.restore();
    }
  }

  function render() {
    const sx = shake ? rand(-shake, shake) : 0;
    const sy = shake ? rand(-shake, shake) : 0;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.save();
    ctx.translate(sx, sy);
    drawGrid();
    drawObstacles();
    if (game.player) {
      drawPickups();
      drawBullets();
      drawEnemies();
      drawPlayer();
      drawParticles();
      drawCrosshair();
      drawOverlayText();
    }
    ctx.restore();
  }

  function loop(timestamp) {
    const dt = Math.min(0.033, (timestamp - lastTime) / 1000 || 0);
    lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function togglePause(forceState) {
    if (state !== 'playing' && state !== 'paused') return;
    const next = forceState || (state === 'playing' ? 'paused' : 'playing');
    state = next;
    if (state === 'paused') {
      els.pausePanel.classList.remove('hidden');
    } else {
      els.pausePanel.classList.add('hidden');
    }
  }

  function stickPointer(event) {
    const rect = els.moveStick.getBoundingClientRect();
    const touch = event.touches ? event.touches[0] : event;
    const x = touch.clientX - rect.left - rect.width / 2;
    const y = touch.clientY - rect.top - rect.height / 2;
    const len = Math.hypot(x, y);
    const max = rect.width / 2 - 23;
    const nx = len > 0 ? x / len : 0;
    const ny = len > 0 ? y / len : 0;
    mobileMove.x = clamp(x / max, -1, 1);
    mobileMove.y = clamp(y / max, -1, 1);
    mobileMove.active = true;
    els.moveStick.querySelector('span').style.transform = `translate(${nx * Math.min(len, max)}px, ${ny * Math.min(len, max)}px)`;
  }

  function resetStick() {
    mobileMove.x = 0;
    mobileMove.y = 0;
    mobileMove.active = false;
    els.moveStick.querySelector('span').style.transform = 'translate(0, 0)';
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyR') reload();
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  canvas.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
  canvas.addEventListener('pointerdown', (e) => {
    initAudio();
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.down = true;
    shoot();
  });
  window.addEventListener('pointerup', () => { pointer.down = false; });
  window.addEventListener('blur', () => {
    pointer.down = false;
    keys.clear();
    resetStick();
  });

  els.startBtn.addEventListener('click', newGame);
  els.howBtn.addEventListener('click', () => {
    els.menu.classList.add('hidden');
    els.howPanel.classList.remove('hidden');
  });
  els.backBtn.addEventListener('click', () => {
    els.howPanel.classList.add('hidden');
    els.menu.classList.remove('hidden');
  });
  els.resumeBtn.addEventListener('click', () => togglePause('playing'));
  els.restartBtn.addEventListener('click', newGame);
  els.restartBtnPause.addEventListener('click', newGame);
  els.reloadTouch.addEventListener('pointerdown', (e) => { e.preventDefault(); reload(); });
  els.shootTouch.addEventListener('pointerdown', (e) => { e.preventDefault(); pointer.down = true; shoot(); });
  els.shootTouch.addEventListener('pointerup', (e) => { e.preventDefault(); pointer.down = false; });
  els.shootTouch.addEventListener('pointercancel', () => { pointer.down = false; });
  els.moveStick.addEventListener('pointerdown', (e) => { e.preventDefault(); stickPointer(e); els.moveStick.setPointerCapture(e.pointerId); });
  els.moveStick.addEventListener('pointermove', (e) => { if (mobileMove.active) stickPointer(e); });
  els.moveStick.addEventListener('pointerup', resetStick);
  els.moveStick.addEventListener('pointercancel', resetStick);

  if (window.matchMedia('(hover: none)').matches) {
    els.mobileControls.classList.remove('hidden');
  }

  resize();
  requestAnimationFrame(loop);
})();
