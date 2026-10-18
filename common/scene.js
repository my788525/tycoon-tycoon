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
    { name:'车库',   sky:'#E8F1F5', wall:'#D8C8B0', floor:'#C9B89A', desk:1, char:1 },
    { name:'小办',   sky:'#EAF4F8', wall:'#DCE8E0', floor:'#C8D8C8', desk:2, char:2 },
    { name:'大办',   sky:'#DCE8F5', wall:'#C8D8E8', floor:'#B8C8D8', desk:3, char:4 },
    { name:'旗舰总部',sky:'#F0E0C0', wall:'#E8D0A0', floor:'#D8C080', desk:4, char:5 },
  ];

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
        color: ['#F5B942','#7FB0D6','#6B9E5A','#C97B2D','#D95D5D'][i%5],
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
      setTimeout(()=>{ c.vy = -6 - Math.random()*2; }, i*60);
    });
    jumpT = 1;
  }

  /* ---------- 像素小人绘制 ---------- */
  function drawChar(c){
    const groundY = H - 36;
    const cx = c.x;
    const y = groundY - 22 + c.y;
    const p = Math.sin(c.phase + performance.now()*0.004);
    const walk = (Math.abs(p)>0.5) ? 1 : 0;

    ctx.save();
    // 身体
    ctx.fillStyle = c.color;
    ctx.fillRect(cx-4, y, 8, 12);
    // 头
    ctx.fillStyle = '#F5E0C0';
    ctx.fillRect(cx-3, y-8, 6, 7);
    // 眼
    ctx.fillStyle = '#3D2C1E';
    ctx.fillRect(cx-2, y-5, 1, 1);
    ctx.fillRect(cx+1, y-5, 1, 1);
    // 头发
    ctx.fillStyle = '#3D2C1E';
    ctx.fillRect(cx-3, y-8, 6, 2);
    // 腿（行走摆动）
    ctx.fillStyle = c.color;
    if(walk){
      ctx.fillRect(cx-4, y+12, 3, 5);
      ctx.fillRect(cx+1, y+12, 3, 5);
    } else {
      ctx.fillRect(cx-3, y+12, 2, 5);
      ctx.fillRect(cx+1, y+12, 2, 5);
    }
    // 手臂（打字时抬起）
    const handY = c.typing > 0 ? y+4 + p*2 : y+8;
    ctx.fillStyle = '#F5E0C0';
    ctx.fillRect(cx-5, handY, 2, 4);
    ctx.fillRect(cx+3, handY, 2, 4);
    ctx.restore();
  }

  /* ---------- 场景背景绘制 ---------- */
  function drawScene(){
    const meta = OFFICE[tier-1];
    // 天空
    ctx.fillStyle = meta.sky;
    ctx.fillRect(0, 0, W, H);
    // 墙面
    ctx.fillStyle = meta.wall;
    ctx.fillRect(0, 0, W, H-36);
    // 地板
    ctx.fillStyle = meta.floor;
    ctx.fillRect(0, H-36, W, 36);
    // 地板木纹线
    ctx.strokeStyle = 'rgba(60,40,20,.15)';
    ctx.lineWidth = 1;
    for(let y=H-30; y<H; y+=8){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }
    // 窗户（大办/总部）
    if(tier>=2){
      ctx.fillStyle = '#B8D8E8';
      const winY = 20;
      const nWin = tier-1;
      for(let i=0;i<nWin;i++){
        const wx = 30 + i*(W-60)/Math.max(1,nWin-1);
        ctx.fillRect(wx, winY, 30, 24);
        ctx.strokeStyle = '#3D2C1E'; ctx.lineWidth = 1;
        ctx.strokeRect(wx, winY, 30, 24);
      }
    }
    // 工位/桌子
    const deskY = H - 50;
    const n = meta.desk;
    for(let i=0;i<n;i++){
      const dx = 50 + i*(W-100)/Math.max(1,n-1);
      ctx.fillStyle = '#8B6F4E';
      ctx.fillRect(dx-12, deskY, 24, 4);
      ctx.fillStyle = '#3D2C1E';
      ctx.fillRect(dx-4, deskY+4, 8, 14);
      // 显示器
      ctx.fillStyle = '#2C3E50';
      ctx.fillRect(dx-6, deskY-10, 12, 9);
      ctx.fillStyle = '#7FB0D6';
      ctx.fillRect(dx-5, deskY-9, 10, 7);
    }
    // 盆栽（大办+）
    if(tier>=3){
      ctx.fillStyle = '#6B9E5A';
      ctx.fillRect(20, H-50, 10, 10);
      ctx.fillStyle = '#C97B2D';
      ctx.fillRect(22, H-42, 6, 6);
    }
  }

  /* ---------- 时间轴条（Kairosoft 标志性视觉） ---------- */
  function drawTimeline(){
    if(!showTick) return;
    const y = 10, h = 14;
    ctx.fillStyle = 'rgba(60,40,20,.15)';
    ctx.fillRect(10, y, W-20, h);
    const p = 0.6;
    ctx.fillStyle = '#F5B942';
    ctx.fillRect(10, y, (W-20)*p, h);
    // 当前阶段标记
    ctx.fillStyle = '#3D2C1E';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    const phaseName = {greenlight:'立项', develop:'开发', ship:'发行', perform:'结算', bankrupt:'破产'}[phase]||phase;
    ctx.fillText(phaseName, 14, y+h-2);
  }

  /* ---------- 开发进度条 ---------- */
  function drawProgress(){
    if(!showBar) return;
    const y = H - 8, h = 8;
    ctx.fillStyle = 'rgba(60,40,20,.2)';
    ctx.fillRect(10, y, W-20, h);
    ctx.fillStyle = phase==='ship' ? '#6B9E5A' : '#F5B942';
    ctx.fillRect(10, y, (W-20)*Math.min(1,progress), h);
    ctx.fillStyle = '#3D2C1E';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('开发进度 ' + Math.round(progress*100) + '%', W/2, y-3);
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
    // 更新
    chars.forEach(c=>{
      // 缓动走向目标
      c.x += (c.targetX - c.x) * 0.05;
      // 跳跃物理
      c.y += c.vy;
      c.vy += 0.4;
      if(c.y > 0){ c.y = 0; c.vy = 0; }
      // 打字动效
      if(phase === 'develop' && Math.random()<0.3) c.typing = 4;
      else if(c.typing>0) c.typing--;
      // 阶段变化时重新分散
    });
    // 震动衰减
    if(shakeT>0) shakeT -= dt/1000;
    // 绘制
    ctx.save();
    if(shakeT>0){
      const sx = (Math.random()-0.5)*4*shakeT;
      ctx.translate(sx, 0);
    }
    drawScene();
    chars.forEach(drawChar);
    drawTimeline();
    drawProgress();
    ctx.restore();
    requestAnimationFrame(loop);
  }

  return { bind, update, pulse, doJump, animateProgressTo };
})();
