/* ============================================================================
 * 发展国 · Phaser 像素场景层（Kairosoft 游戏发展国 视觉语言还原）
 * ----------------------------------------------------------------------------
 * 用 Phaser 3 替换原 Canvas 手画引擎：办公室场景 + 角色精灵 + 时间轴条 +
 * 开发进度条 + 跳跃彩屑粒子 + 震动。4 款游戏共用，按 profile.office.tier 切背景。
 *
 * 对外接口与旧版完全一致，ui.js / boot.js 零改动：
 *   scene.bind(id)                 初始化 Phaser（id 是父容器 DOM）
 *   scene.update(opts)             注入 tier/phase/progress/showBar
 *   scene.pulse()                  负反馈震动
 *   scene.doJump()                 角色跳跃 + 彩屑（发行庆祝）
 *   scene.animateProgressTo(t, ms) 开发进度条 0→100% 平滑爬升
 *
 * 贴图：assets/*.png（char_stand_X / char_walk_X_Y / office_1..4 / desk / plant）
 * Phaser 引擎：lib/phaser.min.js（本地离线引入，不走 CDN）
 * ==========================================================================*/
const scene = (function(){
  'use strict';

  /* ---------- 场景元数据（按办公室档位 1-4） ---------- */
  const OFFICE = [
    { name:'车库',     sky:'#E8F1F5', wall:'#D8C8B0', floor:'#C9B89A', desk:1, char:1 },
    { name:'小办',     sky:'#EAF4F8', wall:'#DCE8E0', floor:'#C8D8C8', desk:2, char:2 },
    { name:'大办',     sky:'#DCE8F5', wall:'#C8D8E8', floor:'#B8C8D8', desk:3, char:4 },
    { name:'旗舰总部', sky:'#F0E0C0', wall:'#E8D0A0', floor:'#D8C080', desk:4, char:5 },
  ];
  const PHASE_NAME = { greenlight:'立项', develop:'开发', ship:'发行', perform:'结算', bankrupt:'破产' };
  const PHASE_FILL = { greenlight:.3, develop:.55, ship:.8, perform:.6, bankrupt:0 };

  /* ---------- 贴图名清单（与 assets/ 对齐） ---------- */
  const SPRITE_NAMES = [
    ...[0,1,2,3,4].map(i=>`char_stand_${i}`),
    ...[0,1,2,3,4].flatMap(i=>[0,1,2,3].map(f=>`char_walk_${i}_${f}`)),
    'office_1','office_2','office_3','office_4',
    'desk','plant',
  ];

  let PHASER_OK = (typeof window!=='undefined' && !!window.Phaser);
  let game=null, sceneRef=null, started=false;

  // 尺寸：Phaser 逻辑宽 640，按容器实际宽等比缩放（保持 4:1）
  const LOGIC_W = 640, LOGIC_H = 160;
  const S = {};   // 场景对象引用（角色、背景、进度、时间轴、粒子、震屏组）

  /* ---------- 初始化 Phaser ---------- */
  let TycoonPreload=null, TycoonScene=null;   // 惰性构建（Phaser 可用时才 class extends）
  function _build(){
    if(TycoonScene) return;   // 只构建一次
    class _Preload extends Phaser.Scene {
      constructor(){ super({ key:'pre' }); }
      preload(){
        const base = '../../assets/';
        SPRITE_NAMES.forEach(n=> this.load.image(n, base + n + '.png'));
      }
      create(){ this.scene.start('tycoon'); }
    }
    class _Main extends Phaser.Scene {
      constructor(){ super({ key:'tycoon' }); }
      create(){
        sceneRef = this;
        // 状态
        this.tier = 1; this.phase = 'greenlight'; this.progress = 0; this.showBar = false;

        // 1x1 白像素纹理兜底（贴图缺失时用，避免引用无效键）
        this.textures.addCanvas('solid', ()=>{
          const cv=document.createElement('canvas'); cv.width=1; cv.height=1;
          const g=cv.getContext('2d'); g.fillStyle='#ffffff'; g.fillRect(0,0,1,1);
          return cv;
        });
        const OFFICE_TINT=[0xE8F1F5,0xEAF4F8,0xDCE8F5,0xF0E0C0];

        // 背景（4 档办公室 PNG，撑满 640x160 逻辑画布）
        this.bg=[];
        for(let t=1;t<=4;t++){
          const key='office_'+t;
          const has=this.textures.exists(key);
          const img=this.add.image(0,0, has?key:'solid').setOrigin(0,0).setAlpha(0);
          if(!has) img.tint=OFFICE_TINT[t-1];
          img.setDisplaySize(LOGIC_W, LOGIC_H);
          this.bg.push(img);
        }

        // 角色（最多 5 个，按档位 1/2/4/5 显示）
        this.chars=[];
        const gap=(LOGIC_W-80)/4;
        for(let i=0;i<5;i++){
          const key=`char_stand_${i}`;
          const c={
            sprite:this.add.image(0,0, this.textures.exists(key)?key:'solid').setOrigin(0.5,1).setAlpha(0),
            x:40+i*gap, yOff:0, vy:0, walkFrame:0, colorIdx:i,
          };
          c.sprite.setPosition(c.x,0);
          this.chars.push(c);
        }

        // 彩屑粒子（跳跃庆祝）
        const confettiKey=this.textures.exists('char_stand_0')?'char_stand_0':'solid';
        this.confetti=this.add.particles({
          texture:confettiKey, emitting:false, lifespan:900,
          speedX:{min:-70,max:70}, speedY:{min:-150,max:-60}, gravity:200,
          scale:{start:.18,end:.04},
          tint:[0xF5B942,0xD95D5D,0x6B9E5A,0x7FB0D6,0xC97B2D,0xF5A0A0],
        });

        // 顶部时间轴
        this.barBg=this.add.rectangle(0,12,LOGIC_W,12,0x1e160e,.55).setOrigin(0,0);
        this.barFill=this.add.rectangle(2,14,(LOGIC_W-4)*.3,8,0xF5B942).setOrigin(0,0);
        this.barText=this.add.text(6,5,'📋 立项',{fontFamily:'monospace',fontSize:'11px',color:'#ffffff'}).setOrigin(0,0);

        // 底部开发进度条
        this.progBarBg=this.add.rectangle(LOGIC_W/2,LOGIC_H-14,LOGIC_W-24,10,0x1e160e,.5).setOrigin(.5);
        this.progBarFill=this.add.rectangle(2,LOGIC_H-14,0,10,0xF5B942).setOrigin(0,.5);
        this.progLabel=this.add.text(6,LOGIC_H-22,'开发进度',{fontFamily:'monospace',fontSize:'9px',color:'rgba(255,255,255,.9)'});
        this.progPct=this.add.text(LOGIC_W-6,LOGIC_H-16,'0%',{fontFamily:'monospace',fontSize:'10px',color:'#fff',fontStyle:'bold'}).setOrigin(1,.5);
        this.progGroup=this.add.group();
        this.progGroup.add([this.progBarBg,this.progBarFill,this.progLabel,this.progPct]);
        this.progGroup.setVisible(false);

        // 震屏
        this.shakeCam=this.cameras.main;

        // 处理缓存的 update
        if(S.pending){ this.applyUpdate(S.pending); S.pending=null; }
      }

      applyUpdate(o){
        this.tier=o.tier||1; this.phase=o.phase||'greenlight';
        if(o.progress!==undefined) this.progress=o.progress;
        if(o.showBar!==undefined) this.showBar=o.showBar;
        if(this.phase==='develop') this.showBar=true;
        this.layoutScene();
      }

      layoutScene(){
        this.bg.forEach((b,i)=>{ const on=(i+1)===this.tier;
          this.tweens.add({targets:b,alpha:on?1:0,duration:250,ease:'Linear'}); });
        const meta=OFFICE[this.tier-1]||OFFICE[0];
        this.chars.forEach((c,i)=>{
          const show=i<meta.char; c.sprite.setVisible(show);
          if(show){ c.x=40+i*(LOGIC_W-80)/Math.max(1,meta.char-1);
            c.sprite.setPosition(c.x,0); c.yOff=0; c.vy=0; this.setCharTexture(c,'stand'); }
        });
        const fillPct=PHASE_FILL[this.phase]||.3;
        this.barFill.width=(LOGIC_W-4)*fillPct;
        const icon={greenlight:'📋',develop:'💻',ship:'🚀',perform:'📈',bankrupt:'💸'}[this.phase]||'📋';
        this.barText.setText(icon+' '+(PHASE_NAME[this.phase]||this.phase));
        this.progGroup.setVisible(this.showBar);
        if(this.showBar) this.refreshProgress();
        const groundY=LOGIC_H-36;
        this.chars.forEach(c=>{ c.sprite.y=groundY; c.sprite.setOrigin(.5,1); });
      }

      setCharTexture(c,mode,frame){
        const key=mode==='stand'?`char_stand_${c.colorIdx}`:`char_walk_${c.colorIdx}_${(frame%4)}`;
        if(this.textures.exists(key)) c.sprite.setTexture(key);
      }

      refreshProgress(){
        const p=Phaser.Math.Clamp(this.progress,0,1);
        const fullW=LOGIC_W-24;
        this.progBarFill.width=fullW*p;
        this.progBarFill.setPosition(LOGIC_W/2-fullW/2, LOGIC_H-14);
        this.progPct.setText(Math.round(p*100)+'%');
        this.progPct.setPosition(LOGIC_W-6, LOGIC_H-14);
      }

      animateProgressTo(target,ms){
        target=target||1; this.showBar=true; this.progGroup.setVisible(true);
        this.tweens.add({ targets:this, progress:target, duration:ms||1800, ease:'Sine.easeInOut',
          onUpdate:()=>this.refreshProgress(),
          onComplete:()=>{ this.progress=target; this.refreshProgress(); } });
        this.chars.forEach(c=>c.anim=true);
      }

      jumpAll(){
        const groundY=LOGIC_H-36;
        this.chars.forEach((c,i)=>{
          setTimeout(()=>{
            c.vy=-7-Math.random()*2.5; c.yOff=0;
            this.confetti.setPosition(c.x, groundY-4);
            this.confetti.explode(14);
          }, i*60);
        });
      }

      shake(){ this.shakeCam.shake(160,.008,false); }

      update(time,dt){
        if(!this.chars) return;
        this.chars.forEach(c=>{
          if(c.vy!==0||c.yOff!==0){
            c.yOff+=c.vy; c.vy+=.65;
            if(c.yOff>0){ c.yOff=0; c.vy=0; }
            c.sprite.y=(LOGIC_H-36)-c.yOff;
          }
          if((this.phase==='develop'||this.phase==='perform')&&Math.random()<.5){
            c.walkFrame=(c.walkFrame+1)%4;
            this.setCharTexture(c,'walk',c.walkFrame);
          }
        });
        if(this.showBar) this.refreshProgress();
      }
    }
    TycoonPreload=_Preload; TycoonScene=_Main;
  }

  /* ---------- 初始化 Phaser ---------- */
  function bind(parent){
    if(!PHASER_OK){ // 加载不到 Phaser：静默降级为占位色块，不阻塞其余玩法
      const el=document.getElementById(parent||'scene');
      if(el){ el.style.background='linear-gradient(180deg,#E8F1F5,#C9B89A)'; }
      console.warn('[tycoon] Phaser 未加载，场景降级为占位');
      return false;
    }
    const parentEl=document.getElementById(parent||'scene');
    if(!parentEl) return false;
    _build();   // 惰性构建场景类（此时 Phaser 已确认可用）
    // 容器已由 CSS 锁定 4:1（#scene {height:160px}），
    // Phaser Scale.FIT 会据此把 640x160 逻辑画布等比缩放进容器
    const config = {
      type: Phaser.AUTO,
      parent: parent,
      width: LOGIC_W, height: LOGIC_H,
      pixelArt: true,
      backgroundColor: OFFICE[0].sky,
      scene: [TycoonPreload, TycoonScene],
      banner: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    };
    game = new Phaser.Game(config);
    game.events.once(Phaser.Core.Events.READY, ()=>{ started=true; });
    return true;
  }

  /* ---------- 外部状态注入 ---------- */
  function update(opts){
    if(!started){ S.pending = opts; return; }   // 尚未 READY，缓存
    const o = opts || {};
    if(sceneRef) sceneRef.set('tier', o.tier||1),
                 sceneRef.set('phase', o.phase||'greenlight');
    if(o.progress!==undefined){
      if(sceneRef) sceneRef.set('progress', o.progress);
    }
    if(sceneRef){
      sceneRef.set('showBar', o.showBar || false);
      if(o.phase==='develop') sceneRef.set('showBar', true);
    }
    S.pending = null;
  }
  function pulse(){
    if(!started || !sceneRef) return;
    sceneRef.shake();
  }
  function doJump(){
    if(!started || !sceneRef) return;
    sceneRef.jumpAll();
  }
  function animateProgressTo(target, durationMs){
    if(!started || !sceneRef){
      if(S.pending){ S.pending.showBar = true; }
      return;
    }
    sceneRef.set('showBar', true);
    sceneRef.animateProgressTo(target||1, durationMs||1800);
  }

  const scene = { bind, update, pulse, doJump, animateProgressTo };

  // 浏览器：window 不存在时挂到全局（node 无头 vm 测试用）；
  // 浏览器：window 存在时暴露为 window.scene（与旧 Canvas 版一致的命名空间）
  const g = (typeof window!=='undefined') ? window : (typeof globalThis!=='undefined'?globalThis:null);
  if(g) g.scene = scene;

  return scene;
})();
