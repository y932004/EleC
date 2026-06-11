(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const startScreen = document.getElementById("startScreen");
  const pauseScreen = document.getElementById("pauseScreen");
  const gameOverScreen = document.getElementById("gameOverScreen");
  const finalScore = document.getElementById("finalScore");
  const gameOverTitle = document.getElementById("gameOverTitle");

  const buttons = {
    up: document.getElementById("upBtn"),
    down: document.getElementById("downBtn"),
    boost: document.getElementById("boostBtn")
  };
  const keys = { up:false, down:false, boost:false };

  const SCENE_BLEND = 170;
  const SCENE_STEP = W - SCENE_BLEND;

  // Final fixed route: gate → sinks → slides → football field → basketball court → playground → classroom → gate.
  const sceneDefs = [
    { name:"START GATE", src:"assets/scene-01-gate.webp", boxes:[] },
    { name:"RAINBOW SINKS", src:"assets/scene-02-rainbow-sinks.webp", boxes:[[520,352,290,220]] },
    { name:"WHITE SLIDES", src:"assets/scene-03-white-slides.png", boxes:[[0,330,430,150],[850,330,430,150]] },
    { name:"FOOTBALL FIELD", src:"assets/scene-04-football-field.webp", boxes:[[420,455,440,120]] },
    { name:"BASKETBALL COURT", src:"assets/scene-05-basketball.webp", boxes:[[120,230,175,330],[985,230,175,330]] },
    { name:"PLAYGROUND", src:"assets/scene-06-playground.webp", boxes:[[220,185,590,380],[850,330,330,240]] },
    { name:"CLASSROOM", src:"assets/scene-07-classroom.webp", boxes:[[40,430,370,170],[455,430,370,170],[870,430,370,170]] },
    { name:"FINISH GATE", src:"assets/scene-01-gate.webp", boxes:[[225,315,830,270]] }
  ];
  const ROUTE = sceneDefs.map((_, i) => i);

  const images = sceneDefs.map((scene) => {
    const image = new Image();
    image.src = scene.src;
    return image;
  });

  const sceneBuffer = document.createElement("canvas");
  sceneBuffer.width = W;
  sceneBuffer.height = H;
  const sb = sceneBuffer.getContext("2d");

  const palette = {
    paper:"#f6e2b8",
    ink:"#4a2d24",
    inkSoft:"#6d4839",
    red:"#a54b43",
    gold:"#d29b4c",
    blue:"#657f8f"
  };

  const player = { x:215, y:305, vy:0, r:28, boost:100, tilt:0, bob:0 };
  let state = "ready";
  let last = performance.now();
  let speed = 290;
  let score = 0;
  let lives = 3;
  let flash = 0;
  let invincible = 0;
  let sceneQueue = [];
  let rewards = [];
  let particles = [];
  let rewardTimer = 0;
  function readBest(){
    try { return Number(window.localStorage.getItem("campusBroomstickBest") || 0); }
    catch (_) { return 0; }
  }
  function writeBest(value){
    try { window.localStorage.setItem("campusBroomstickBest", String(value)); }
    catch (_) { /* private / embedded browser: continue without persistence */ }
  }
  let best = readBest();

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function rectHit(cx, cy, r, rx, ry, rw, rh){
    const qx = clamp(cx, rx, rx + rw);
    const qy = clamp(cy, ry, ry + rh);
    const dx = cx - qx;
    const dy = cy - qy;
    return dx * dx + dy * dy < r * r;
  }

  function hideAll(){
    startScreen.classList.remove("show");
    pauseScreen.classList.remove("show");
    gameOverScreen.classList.remove("show");
  }

  function seedScenes(){
    sceneQueue = ROUTE.map((index, routeIndex) => ({ index, routeIndex, x: routeIndex * SCENE_STEP, hit:false }));
  }

  function reset(){
    state = "playing";
    speed = 290;
    score = 0;
    lives = 3;
    flash = 0;
    invincible = 0;
    rewardTimer = 0.75;
    rewards = [];
    particles = [];
    player.y = 305;
    player.vy = 0;
    player.boost = 100;
    player.tilt = 0;
    player.bob = 0;
    seedScenes();
    hideAll();
    last = performance.now();
  }

  function togglePause(force){
    if(force === true && state === "playing") state = "paused";
    else if(force === false && state === "paused") state = "playing";
    else if(state === "playing") state = "paused";
    else if(state === "paused") state = "playing";
    pauseScreen.classList.toggle("show", state === "paused");
    last = performance.now();
  }

  function finish(win){
    state = "over";
    best = Math.max(best, Math.floor(score));
    writeBest(best);
    gameOverTitle.textContent = win ? "You arrived at the school gate!" : "Nice flight!";
    finalScore.textContent = `${win ? "Reached the gate" : "Score"}: ${Math.floor(score)} · Best: ${best}`;
    gameOverScreen.classList.add("show");
  }

  function rewardSpotSafe(x, y, r){
    for(const scene of sceneQueue){
      for(const box of sceneDefs[scene.index].boxes){
        if(rectHit(x, y, r + 18, scene.x + box[0], box[1] - 18, box[2], box[3] + 36)) return false;
      }
    }
    for(const item of rewards){
      if(Math.hypot(x - item.x, y - item.y) < r + item.r + 36) return false;
    }
    return y > 100 && y < 545;
  }

  function spawnReward(){
    const x = W + 88;
    const r = 28;
    const lanes = [125,170,215,260,305,350,395,440,490,530].sort(() => Math.random() - .5);
    let y = lanes.find((lane) => rewardSpotSafe(x, lane, r));
    if(y === undefined) y = 160;
    rewards.push({ x, y, r, bob:Math.random() * Math.PI * 2, spin:Math.random() * Math.PI * 2, taken:false });
    rewardTimer = 0.8 + Math.random() * 0.85;
  }

  function dust(x, y, type){
    const count = type === "hit" ? 18 : type === "score" ? 12 : type === "boost" ? 4 : 1;
    for(let i = 0; i < count; i++){
      particles.push({
        x, y,
        vx:(Math.random() - .5) * (type === "dust" ? 70 : type === "boost" ? 110 : 250),
        vy:(Math.random() - .5) * (type === "dust" ? 45 : 220),
        life:type === "dust" ? .4 : type === "boost" ? .5 : .9,
        max:type === "dust" ? .4 : type === "boost" ? .5 : .9,
        size:2 + Math.random() * 7,
        color:type === "score" ? palette.gold : type === "hit" ? palette.red : type === "boost" ? palette.blue : palette.ink,
        kind:type
      });
    }
  }

  function update(dt){
    if(state !== "playing") return;

    player.bob += dt * 7;
    if(invincible > 0) invincible -= dt;
    if(flash > 0) flash -= dt;

    const boosting = keys.boost && player.boost > 0;
    const targetSpeed = boosting ? 530 : 290 + Math.min(130, score / 20);
    speed += (targetSpeed - speed) * Math.min(1, dt * 4.2);
    player.boost = clamp(player.boost + (boosting ? -38 : 18) * dt, 0, 100);

    let ay = 0;
    if(keys.up) ay -= 980;
    if(keys.down) ay += 980;
    if(!keys.up && !keys.down) ay += (315 - player.y) * 3.7 - player.vy * 3.0;
    player.vy = (player.vy + ay * dt) * Math.pow(.95, dt * 60);
    player.y = clamp(player.y + player.vy * dt, 82, 562);
    player.tilt += (player.vy / 860 - player.tilt) * Math.min(1, dt * 7);

    for(const scene of sceneQueue) scene.x -= speed * dt;
    while(sceneQueue.length > 1 && sceneQueue[0].x + W < -SCENE_BLEND) sceneQueue.shift();

    const finishGate = sceneQueue.find((scene) => scene.routeIndex === ROUTE.length - 1);
    if(finishGate && finishGate.x <= 0){
      finishGate.x = 0;
      sceneQueue = [finishGate];
      rewards = [];
      finish(true);
      return;
    }

    for(const scene of sceneQueue){
      for(const box of sceneDefs[scene.index].boxes){
        if(!scene.hit && invincible <= 0 && rectHit(player.x, player.y, player.r, scene.x + box[0], box[1], box[2], box[3])){
          scene.hit = true;
          lives--;
          invincible = 1.2;
          flash = .34;
          dust(player.x, player.y, "hit");
          if(lives <= 0){ finish(false); return; }
        }
      }
    }

    rewardTimer -= dt;
    if(rewardTimer <= 0) spawnReward();
    for(const reward of rewards){
      reward.x -= speed * dt;
      reward.spin += dt * 2.7;
      reward.bob += dt * 4.2;
      if(!reward.taken && Math.hypot(reward.x - player.x, reward.y - player.y) < reward.r + player.r){
        reward.taken = true;
        score += 120;
        dust(reward.x, reward.y, "score");
      }
    }
    rewards = rewards.filter((reward) => !reward.taken && reward.x > -80);

    if(boosting && Math.random() < .75) dust(player.x - 70, player.y + 12, "boost");
    if(Math.random() < .14) dust(player.x - 58, player.y + 16, "dust");

    for(const p of particles){
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    score += dt * (speed / 9.6);
  }

  function drawImageCover(target, image){
    if(!image || !image.complete || !image.naturalWidth){
      target.fillStyle = palette.paper;
      target.fillRect(0, 0, W, H);
      return;
    }
    const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    target.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  function drawScene(scene){
    sb.clearRect(0, 0, W, H);
    drawImageCover(sb, images[scene.index]);
    const gradient = sb.createLinearGradient(0, 0, W, 0);
    const fade = SCENE_BLEND / W;
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(Math.max(.001, fade * .86), "rgba(0,0,0,1)");
    gradient.addColorStop(1 - Math.max(.001, fade * .86), "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    sb.globalCompositeOperation = "destination-in";
    sb.fillStyle = gradient;
    sb.fillRect(0, 0, W, H);
    sb.globalCompositeOperation = "source-over";
    ctx.drawImage(sceneBuffer, scene.x, 0);
  }

  function drawInitialGate(){
    ctx.clearRect(0, 0, W, H);
    drawImageCover(ctx, images[0]);
  }

  function drawSoccerBall(x, y, r){
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    for(let i=0;i<5;i++){
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const px = Math.cos(a) * r * .34;
      const py = Math.sin(a) * r * .34;
      if(i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    const spots = [[0,-.72],[.67,-.18],[.43,.58],[-.43,.58],[-.67,-.18]];
    for(const [sx, sy] of spots){
      ctx.beginPath(); ctx.arc(sx * r, sy * r, r * .18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sx * r * .76, sy * r * .76); ctx.stroke();
    }
    ctx.restore();
  }

  function drawRewards(){
    for(const item of rewards){
      ctx.save();
      ctx.translate(item.x, item.y + Math.sin(item.bob) * 5);
      ctx.rotate(Math.sin(item.spin) * .12);
      ctx.shadowColor = "rgba(76,48,36,.32)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      drawSoccerBall(0, 0, item.r);
      ctx.restore();
    }
  }

  function drawPlayer(){
    const bob = Math.sin(player.bob) * 2.2;
    ctx.save();
    ctx.translate(player.x, player.y + bob);
    ctx.rotate(player.tilt * .45);
    if(invincible > 0 && Math.floor(invincible * 10) % 2 === 0) ctx.globalAlpha = .45;

    // broom
    ctx.strokeStyle = "#563827";
    ctx.lineWidth = 5.2;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-92, 14); ctx.lineTo(52, 12); ctx.stroke();
    ctx.fillStyle = "#b98942";
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(-112, 16); ctx.lineTo(-82, -2); ctx.lineTo(-76, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    for(let i=0;i<6;i++){
      ctx.beginPath(); ctx.moveTo(-104 + i * 5, 15); ctx.lineTo(-90 + i * 4, 31 + (i % 2) * 2); ctx.stroke();
    }

    // black cat
    ctx.fillStyle = "#161616";
    ctx.strokeStyle = "#050505";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -3, 32, 22, .08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(33, -22, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(21, -31); ctx.lineTo(26, -50); ctx.lineTo(35, -33); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(37, -34); ctx.lineTo(48, -50); ctx.lineTo(51, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#161616"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-27, -8); ctx.quadraticCurveTo(-54, -30, -42, -59); ctx.quadraticCurveTo(-31, -69, -21, -56); ctx.stroke();
    ctx.fillStyle = "#f1d44f";
    ctx.beginPath(); ctx.ellipse(28, -22, 3.2, 5.6, 0, 0, Math.PI * 2); ctx.ellipse(40, -21, 3.2, 5.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.fillRect(27.2, -26.6, 1.6, 9.2); ctx.fillRect(39.2, -25.6, 1.6, 9.2);
    ctx.fillStyle = "#d58d8d";
    ctx.beginPath(); ctx.moveTo(34, -16); ctx.lineTo(30.5, -12.5); ctx.lineTo(37.5, -12.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#f2e9da"; ctx.lineWidth = 1.3;
    [[18,-16,30,-15],[18,-11,31,-11],[18,-6,30,-8],[50,-15,38,-14],[50,-10,39,-10],[50,-5,39,-7]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    ctx.restore();
  }

  function drawParticles(){
    for(const p of particles){
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      if(p.kind === "boost"){
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * .48, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(){
    ctx.save();
    ctx.fillStyle = "rgba(255,244,213,.9)";
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(18, 16, 250, 56);
    ctx.strokeRect(18, 16, 250, 56);
    ctx.fillStyle = palette.ink;
    ctx.font = "700 24px Georgia";
    ctx.fillText(`SCORE  ${Math.floor(score)}`, 36, 52);
    for(let i=0;i<3;i++){
      ctx.fillStyle = i < lives ? palette.red : "rgba(84,52,42,.22)";
      ctx.beginPath(); ctx.arc(424 + i * 42, 45, 14, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = palette.ink; ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,244,213,.88)";
    ctx.strokeStyle = palette.ink;
    ctx.fillRect(W - 274, 22, 238, 42);
    ctx.strokeRect(W - 274, 22, 238, 42);
    ctx.fillStyle = palette.gold;
    ctx.fillRect(W - 264, 32, Math.max(0, player.boost) * 2.16, 22);
    ctx.fillStyle = palette.ink;
    ctx.font = "700 15px Arial";
    ctx.fillText("BOOST", W - 258, 49);
    ctx.restore();
  }

  function draw(){
    if(state === "ready"){
      drawInitialGate();
      return;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, W, H);
    for(const scene of sceneQueue) drawScene(scene);

    const glaze = ctx.createLinearGradient(0, 0, 0, H);
    glaze.addColorStop(0, "rgba(255,249,236,.16)");
    glaze.addColorStop(.55, "rgba(255,244,220,.07)");
    glaze.addColorStop(1, "rgba(175,128,87,.08)");
    ctx.fillStyle = glaze;
    ctx.fillRect(0, 0, W, H);

    drawRewards();
    drawParticles();
    drawPlayer();
    drawHUD();

    if(flash > 0){
      ctx.fillStyle = `rgba(165,75,67,${flash * .7})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(now){
    const dt = Math.min(.035, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function bindHold(button, key){
    const press = (event) => {
      if(event){ event.preventDefault(); event.stopPropagation(); }
      keys[key] = true;
      button.classList.add("pressed");
    };
    const release = (event) => {
      if(event){ event.preventDefault(); event.stopPropagation(); }
      keys[key] = false;
      button.classList.remove("pressed");
    };
    button.addEventListener("pointerdown", press, { passive:false });
    button.addEventListener("pointerup", release, { passive:false });
    button.addEventListener("pointercancel", release, { passive:false });
    button.addEventListener("pointerleave", release, { passive:false });
    button.addEventListener("touchstart", press, { passive:false });
    button.addEventListener("touchend", release, { passive:false });
    button.addEventListener("touchcancel", release, { passive:false });
  }

  function bindTap(button, action){
    let lastActivation = 0;
    const activate = (event) => {
      if(event){ event.preventDefault(); event.stopPropagation(); }
      const now = Date.now();
      if(now - lastActivation < 320) return;
      lastActivation = now;
      action();
    };
    button.addEventListener("pointerup", activate, { passive:false });
    button.addEventListener("touchend", activate, { passive:false });
    button.addEventListener("click", activate, { passive:false });
  }

  bindHold(buttons.up, "up");
  bindHold(buttons.down, "down");
  bindHold(buttons.boost, "boost");

  bindTap(document.getElementById("startBtn"), reset);
  bindTap(document.getElementById("restartBtn"), reset);
  bindTap(document.getElementById("resumeBtn"), () => togglePause(false));
  bindTap(document.getElementById("pauseBtn"), () => togglePause());

  window.addEventListener("keydown", (event) => {
    if(["ArrowUp","ArrowDown","Space"].includes(event.code)) event.preventDefault();
    if(event.code === "ArrowUp" || event.code === "KeyW") keys.up = true;
    if(event.code === "ArrowDown" || event.code === "KeyS") keys.down = true;
    if(event.code === "Space") keys.boost = true;
    if(event.code === "KeyP") togglePause();
    if(event.code === "Enter" && (state === "ready" || state === "over")) reset();
  });
  window.addEventListener("keyup", (event) => {
    if(event.code === "ArrowUp" || event.code === "KeyW") keys.up = false;
    if(event.code === "ArrowDown" || event.code === "KeyS") keys.down = false;
    if(event.code === "Space") keys.boost = false;
  });

  function canvasPress(event){
    if(event){ event.preventDefault(); }
    const rect = canvas.getBoundingClientRect();
    const point = event.touches && event.touches[0] ? event.touches[0] : event;
    const y = ((point.clientY - rect.top) / rect.height) * H;
    keys[y < H * .5 ? "up" : "down"] = true;
  }
  const clearCanvasTouch = (event) => {
    if(event) event.preventDefault();
    keys.up = false;
    keys.down = false;
  };
  canvas.addEventListener("pointerdown", canvasPress, { passive:false });
  canvas.addEventListener("pointerup", clearCanvasTouch, { passive:false });
  canvas.addEventListener("pointercancel", clearCanvasTouch, { passive:false });
  canvas.addEventListener("pointerleave", clearCanvasTouch, { passive:false });
  canvas.addEventListener("touchstart", canvasPress, { passive:false });
  canvas.addEventListener("touchend", clearCanvasTouch, { passive:false });
  canvas.addEventListener("touchcancel", clearCanvasTouch, { passive:false });

  // Keep game clicks interactive while asking the host page to handle scrolling.
  window.addEventListener("wheel", (event) => {
    if(window.parent === window) return;
    window.parent.postMessage({
      type:"campus-game-wheel",
      deltaY:event.deltaY,
      deltaMode:event.deltaMode
    },"*");
    event.preventDefault();
  }, { passive:false, capture:true });

  // Start screen: immediately show the school-gate image before the user presses START.
  images[0].addEventListener("load", drawInitialGate);
  startScreen.classList.add("show");
  requestAnimationFrame(loop);
})();
