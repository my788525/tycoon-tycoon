/* ============================================================================
 * 发展国 · 游戏页启动器
 * ----------------------------------------------------------------------------
 * 每个游戏页（games/<domain>/index.html）加载：
 *   engine.js, profiles.js, ui.js, core-ui.js, boot.js
 * boot.js 读取 DOM 里 data-domain 属性决定加载哪个 profile，
 * 驱动整个循环。4 款游戏共用同一份 boot.js，零改动。
 * ==========================================================================*/
(function(){
  const DOMAIN_KEY = document.body.dataset.domain || 'game';
  const profiles = window.PROFILES || {};
  const domain = profiles[DOMAIN_KEY];
  if(!domain){ console.error('[tycoon] profile not found:', DOMAIN_KEY); return; }

  const root = document.getElementById('tycoon');
  bindUI(root);
  SFX.init(); // 创建 AudioContext（首次手势后 resume）

  // 解锁音频（真实用户手势内）
  const unlock = ()=>{ SFX.resume(); document.removeEventListener('pointerdown',unlock); document.removeEventListener('keydown',unlock); };
  document.addEventListener('pointerdown',unlock,{once:true});
  document.addEventListener('keydown',unlock,{once:true});

  // 恢复存档或新建
  const saved = load();
  let game;
  if(saved && saved.domain===DOMAIN_KEY){
    // 从存档恢复
    game = createTycoonGame(DOMAIN_KEY, profiles);
    Object.assign(game.state.company, saved.company);
    game.state.project = saved.project;
    game.state.lastResult = saved.lastResult;
    game.state.loopPhase = saved.loopPhase;
    game.state.log = saved.log || [];
    window.__game = game;
    renderLog(game.state.log);
    pushLog('💾 存档已恢复');
  } else {
    game = createTycoonGame(DOMAIN_KEY, profiles);
    window.__game = game;
    renderLog(game.state.log);
  }

  const state = game.state;
  window.game = game; // 暴露全局 game（ui.js 中 renderPanel(state, game) 用到）

  // 首次渲染
  renderPanel(state, game);
  bindStageButtons(state, game);

  // 保存按钮
  const bSave = document.getElementById('btnSave');
  if(bSave) bSave.onclick = ()=>{ SFX.good(); save(); pushLog('💾 已存档'); };

  // 重置按钮
  const bReset = document.getElementById('btnReset');
  if(bReset) bReset.onclick = ()=>{
    SFX.bad();
    modal({
      title:{icon:'⚠️',text:'确定开新局？'},
      body:'当前进度将清空，无法恢复。',
      buttons:[
        {label:'确定重置',danger:true,onClick:()=>{ clearSave(); location.reload(); }},
        {label:'取消',onClick:()=>{}}
      ]
    });
  };

  // 自动存档定时器
  setInterval(save, 15000);
})();
