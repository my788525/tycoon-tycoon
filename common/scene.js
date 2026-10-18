/* ============================================================================
 * 发展国 · 像素场景层（Kairosoft 游戏发展国 视觉语言还原）
 * ----------------------------------------------------------------------------
 * Canvas 画板：办公室场景 + 小人角色 + 时间轴条 + 进度条。
 * 4 款游戏共用，按 profile.office.tier 切换场景背景。
 * ==========================================================================*/
const scene = (function(){
  'use strict';

  /* ---------- 场景元数据（按办公室档位） ---------- */
  const OFFICE = [
    { name:'车库',   sky:'#E8F1F5', wall:'#D8C8B0', floor:'#C9B89A', desk:1, char:1, light:'#FFE9A8' },
    { name:'小办',   sky:'#EAF4F8', wall:'#DCE8E0', floor:'#C8D8C8', desk:2, char:2, light:'#E8F5FF' },
    { name:'大办',   sky:'#DCE8F5', wall:'#C8D8E8', floor:'#B8C8D8', desk:3, char:4, light:'#C8E0F5' },
    { name:'旗舰总部',sky:'#F0E0C0', wall:'#E8D0A0', floor:'#D8C080', desk:4, char:5, light:'#FFF0C8' },
  ];

  /* ---------- 角色配色（程序化贴图） ---------- */
  const SKIN='#F2D8B0', HAIR='#3D2C1E', SHIRT=['#F5B942','#7FB0D6','#6B9E5A','#C97B2D','#D95D5D'], PANTS='#3D4A5C', SHOE='#2A2A2A';

  let canvas, ctx, W, H, dpr;
  let running = false, lastT = 0;
  let chars = [];
  let jumpT = 0;
  let shakeT = 0;
  let progress = 0;      // 0..1 开发进度
  let showBar = false;
  let showTick = true;
  let tier = 1;
  let phase = 'greenlight';
  // 动画控制
  let targetProgress = 0;
  let progressSpeed = 0;   // 每秒推进量
  let animating = false;
  let _lastFrame = 0;
  // 粒子系统
  let particles = [];
  function spawnParticles(x,y,n,type){
    const colors=['#F5B942','#D95D5D','#6B9E5A','#7FB0D6','#C97B2D','#F5A0A0'];
    for(let i=0;i<n;i++){
      particles.push({
        x, y,
        vx:(Math.random()-.5)*(type==='jump'?5:2),
        vy:type==='jump'?(-4-Math.random()*3):(type==='flash'?-1:-2-Math.random()*2),
        life:1, decay:type==='jump'?.012:.03,
        size:type==='jump'?3:2,
        color:colors[i%colors.length],
        type,
      });
    }
    if(particles.length>200) particles.splice(0,particles.length-200);
  }

  // 外部调用：从当前 progress 平滑推进到 1（用于开发阶段进度条动画）
  function animateProgressTo(target, durationMs=1800){
    targetProgress = target||1;
    progressSpeed = (targetProgress - progress) / Math.max(1,durationMs/1000);
    animating = true;
    showBar = true;
  }

  /* ---------- 初始化 ---------- */
  function bind(id){
    canvas = document.getElementById(id || 'scene');
    if(!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    loadSprites();          // 加载本地贴图集（assets/*.png）
    window.addEventListener('resize', resize);
    requestAnimationFrame(loop);
    return true;
  }
  function resize(){
    if(!canvas) return;
    dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    H = canvas.clientHeight;
    W = w;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildChars();
  }
  function buildChars(){
    const meta = OFFICE[tier-1];
    chars = [];
    const n = meta.char;
    for(let i=0;i<n;i++){
      chars.push({
        x: 40 + i * (W-80)/Math.max(1,n-1),
        targetX: 40 + i * (W-80)/Math.max(1,n-1),
        y: 0,           // 跳跃偏移
        vy: 0,
        idx: i,         // 贴图色号
        phase: Math.random()*Math.PI*2,
        typing: 0,
      });
    }
  }

  /* ---------- 外部状态注入 ---------- */
  function update(opts){
    const o = opts || {};
    tier = Math.max(1, Math.min(4, o.tier || 1));
    phase = o.phase || 'greenlight';
    if(o.progress!==undefined){ progress = o.progress; targetProgress = o.progress; animating=false; }
    showBar = o.showBar || false;
    showTick = o.showTick !== false;
    // 员工数量决定角色数（重排）
    const wantChars = (OFFICE[tier-1]||OFFICE[0]).char;
    if(chars.length !== wantChars) buildChars();
    // 阶段影响角色行为
    if(phase === 'develop'){ showBar = true; }
  }
  function pulse(){
    shakeT = 0.5;
  }
  function doJump(){
    chars.forEach((c,i)=>{
      setTimeout(()=>{
        c.vy = -6 - Math.random()*2;
        spawnParticles(c.x, H-40, 6, 'jump');
      }, i*60);
    });
    jumpT = 1;
  }

  /* ---------- 贴图集加载 ---------- */
  const spriteImages = {};
  let spritesReady = false;
  function loadSprites(){
    // 角色站立/走路 5 色 × 4 帧 + 背景 4 档 + 道具
    const names = [
      ...[0,1,2,3,4].map(i=>`char_stand_${i}`),
      ...[0,1,2,3,4].flatMap(i=>[0,1,2,3].map(f=>`char_walk_${i}_${f}`)),
      'office_1','office_2','office_3','office_4',
      'desk','plant',
    ];
    let loaded = 0, total = names.length;
    names.forEach(n=>{
      const img = new Image();
      img.onload = ()=>{ spriteImages[n]=img; loaded++; if(loaded===total) spritesReady=true; };
      img.onerror = ()=>{ loaded++; };
      img.src = '../../assets/'+n+'.png';
    });
  }
  function px(x,y,w,h,color){ ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,w),Math.max(1,h)); }
  function drawChar(c){
    const groundY = H - 36;
    const cx = Math.round(c.x);
    const yBase = groundY - 22 + c.y;
    const frame = Math.floor(performance.now()/150)%4;
    const walk = (phase==='develop'||phase==='perform') ? frame : 0;

    // 阴影（随跳跃升高而缩小）
    const shadowW = 10*(1 - Math.min(.5,Math.max(0,-c.y)/40));
    px(cx-shadowW/2, groundY-3, shadowW, 3, 'rgba(40,30,20,.25)');

    // 贴图模式
    if(spritesReady && spriteImages['char_stand_'+c.idx]){
      const name = walk===0 ? 'char_stand_'+c.idx : 'char_walk_'+c.idx+'_'+(walk%4);
      const img = spriteImages[name];
      if(img){
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(img, cx-8, yBase-8, 16, 24);
        ctx.imageSmoothingEnabled=true;
        // 打字光标（开发阶段闪烁）
        if(c.typing>0 && frame%2===0) px(cx+5, yBase+10, 2, 2, '#FFF8E0');
      }
      return;
    }
    // 兜底程序化像素小人
    const sx = cx, sy = yBase;
    const legLift = (walk===1||walk===3)?2:0;
    const armLift  = (walk===2)?2:0;
    const shirt = SHIRT[c.idx%SHIRT.length];
    px(sx-3, sy+12, 3, 6-legLift, PANTS);
    px(sx+1, sy+12, 3, 6+legLift, PANTS);
    px(sx-3, sy+16-legLift, 3, 2, SHOE);
    px(sx+1, sy+16+legLift, 3, 2, SHOE);
    px(sx-4, sy, 8, 12, shirt);
    px(sx-1, sy, 2, 2, SKIN);
    px(sx-4, sy+3, 8, 1, 'rgba(0,0,0,.12)');
    const handY = c.typing>0 ? sy+3+legLift : sy+(4-armLift);
    px(sx-5, handY, 2, 5, shirt);
    px(sx+3, handY, 2, 5, shirt);
    px(sx-5, handY+4, 2, 2, SKIN);
    px(sx+3, handY+4, 2, 2, SKIN);
    px(sx-4, sy-9, 8, 9, SKIN);
    px(sx-4, sy-9, 8, 3, HAIR);
    px(sx-3, sy-6, 1, 2, '#2A2A2A');
    px(sx+2, sy-6, 1, 2, '#2A2A2A');
    px(sx-4, sy-8, 1, 1, 'rgba(255,255,255,.4)');
    if(c.typing>0 && frame%2===0) px(sx+5, sy+8, 2, 1, '#FFF8E0');
  }

  /* ---------- 场景背景绘制（贴图化：墙面/地板砖/窗户/家具/吊灯） ---------- */
  function drawScene(){
    const meta = OFFICE[tier-1];
    // 贴图集模式：office_X.png 已加载 → 画整幅背景
    const bgImg = spritesReady ? spriteImages['office_'+tier] : null;
    if(bgImg){
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(bgImg, 0, 0, W, H);
      ctx.imageSmoothingEnabled=true;
    } else {
      // 兜底程序化背景（贴图未加载完成时）
      const wallGrad = ctx.createLinearGradient(0,0,0,H-36);
      wallGrad.addColorStop(0, meta.light);
      wallGrad.addColorStop(1, meta.wall);
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0,0,W,H-36);
      ctx.fillStyle='rgba(60,40,20,.18)';
      ctx.fillRect(0,H-44,W,2);
      const floorY=H-36;
      ctx.fillStyle=meta.floor; ctx.fillRect(0,floorY,W,36);
      ctx.strokeStyle='rgba(60,40,20,.18)'; ctx.lineWidth=1;
      for(let x=0;x<W;x+=26){ ctx.beginPath(); ctx.moveTo(x,floorY); ctx.lineTo(x,H); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0,floorY+18); ctx.lineTo(W,floorY+18); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.12)';
      for(let x=4;x<W;x+=52){ ctx.fillRect(x,floorY+2,20,3); }
    }

    // 道具（贴图集模式画桌面 PNG + 盆栽 PNG；兜底程序化）
    const deskImg = spritesReady ? spriteImages['desk'] : null;
    const plantImg = spritesReady ? spriteImages['plant'] : null;
    const deskY = H - 52;
    const n = meta.desk;
    for(let i=0;i<n;i++){
      const dx = 50 + i*(W-100)/Math.max(1,n-1);
      if(deskImg){
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(deskImg, dx-16, deskY-22, 32, 32);
        ctx.imageSmoothingEnabled=true;
      } else {
        // 兜底程序化桌子
        ctx.fillStyle='#5C4A32';
        ctx.fillRect(dx-11,deskY+4,3,16); ctx.fillRect(dx+8,deskY+4,3,16);
        const deskGrad=ctx.createLinearGradient(dx-13,deskY,dx-13,deskY+5);
        deskGrad.addColorStop(0,'#B0885C'); deskGrad.addColorStop(1,'#8B6F4E');
        ctx.fillStyle=deskGrad; ctx.fillRect(dx-13,deskY,26,5);
        ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=1; ctx.strokeRect(dx-13,deskY,26,5);
        ctx.fillStyle='#2C3E50'; ctx.fillRect(dx-9,deskY-15,18,13);
        const scr=ctx.createLinearGradient(dx-8,deskY-14,dx-8,deskY-3);
        scr.addColorStop(0,'#9FD8F5'); scr.addColorStop(1,'#5FA8D6');
        ctx.fillStyle=scr; ctx.fillRect(dx-8,deskY-14,16,11);
        ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(dx-7,deskY-13,5,2);
        ctx.fillStyle='#2C3E50'; ctx.fillRect(dx-2,deskY-2,4,2);
        ctx.fillStyle='#4A4A4A'; ctx.fillRect(dx-7,deskY+3,14,2);
      }
      // 盆栽（大办+ 桌面绿植，贴图/兜底）
      if(tier>=3 && i%2===0){
        if(plantImg){
          ctx.imageSmoothingEnabled=false;
          ctx.drawImage(plantImg, dx+10, deskY-18, 14, 14);
          ctx.imageSmoothingEnabled=true;
        } else {
          ctx.fillStyle='#C97B2D'; ctx.fillRect(dx+12,deskY-4,5,4);
          ctx.fillStyle='#6B9E5A';
          ctx.beginPath(); ctx.arc(dx+14,deskY-6,4,0,Math.PI*2); ctx.fill();
        }
      }
    }
  }

  /* ---------- 时间轴条（游戏 HUD 风格） ---------- */
  function drawTimeline(){
    if(!showTick) return;
    const y=6, h=12;
    ctx.fillStyle='rgba(30,22,14,.55)';
    ctx.fillRect(6, y, W-12, h);
    // 阶段填充（按 phase 推进视觉）
    const phaseFill={greenlight:.3,develop:.55,ship:.8,perform:.6,bankrupt:0}[phase]||.3;
    ctx.fillStyle='#F5B942';
    ctx.fillRect(8, y+2, (W-16)*phaseFill, h-4);
    // 阶段图标
    const phaseIcon={greenlight:'📋',develop:'💻',ship:'🚀',perform:'📈',bankrupt:'💸'}[phase]||'📋';
    ctx.font='10px sans-serif'; ctx.textAlign='left';
    ctx.fillText(phaseIcon, 10, y+h-3);
    const phaseName={greenlight:'立项',develop:'开发',ship:'发行',perform:'结算',bankrupt:'破产'}[phase]||phase;
    ctx.fillStyle='#FFF'; ctx.font='bold 9px sans-serif';
    ctx.fillText(phaseName, 24, y+h-3);
  }

  /* ---------- 开发进度条（游戏 HUD 风格） ---------- */
  function drawProgress(){
    if(!showBar) return;
    const y=H-14, h=8, bw=W-20;
    // 背景槽
    ctx.fillStyle='rgba(30,22,14,.5)';
    ctx.fillRect(10,y,bw,h);
    // 填充（渐变）
    const g=ctx.createLinearGradient(10,0,10+bw,0);
    g.addColorStop(0,'#F5B942'); g.addColorStop(1,'#6B9E5A');
    ctx.fillStyle=g;
    ctx.fillRect(10,y,bw*Math.min(1,progress),h);
    // 边框
    ctx.strokeStyle='#3D2C1E'; ctx.lineWidth=1;
    ctx.strokeRect(10,y,bw,h);
    // 标签
    ctx.fillStyle='#FFF'; ctx.font='bold 9px sans-serif'; ctx.textAlign='right';
    ctx.fillText(Math.round(progress*100)+'%',10+bw-3,y+h-1);
    ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.fillText('开发进度',13,y-2);
  }

  /* ---------- 主循环 ---------- */
  function loop(t){
    if(!canvas) return;
    const dt = Math.min(50, t - lastT); lastT = t;
    // 进度条动画推进（开发阶段 0→100%）
    if(animating && progress < targetProgress){
      progress += progressSpeed * (dt/1000);
      if(progress >= targetProgress){ progress = targetProgress; animating = false; }
    }
    // 角色更新
    chars.forEach(c=>{
      c.x += (c.targetX - c.x) * 0.05;
      c.y += c.vy; c.vy += 0.4;
      if(c.y > 0){ c.y = 0; c.vy = 0; }
      if(phase === 'develop' && Math.random()<0.3) c.typing = 4;
      else if(c.typing>0) c.typing--;
    });
    // 粒子更新
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx; p.y+=p.vy; p.vy+=.25; p.life-=p.decay;
      if(p.life<=0||p.y>H+10) particles.splice(i,1);
    }
    // 震动衰减
    if(shakeT>0) shakeT -= dt/1000;
    // 绘制
    ctx.save();
    if(shakeT>0){ ctx.translate((Math.random()-.5)*4*shakeT,0); }
    drawScene();
    chars.forEach(drawChar);
    // 粒子（跳跃彩屑）
    particles.forEach(p=>{
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.color;
      ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);
    });
    ctx.globalAlpha=1;
    drawTimeline();
    drawProgress();
    ctx.restore();
    requestAnimationFrame(loop);
  }

  return { bind, update, pulse, doJump, animateProgressTo };
})();
