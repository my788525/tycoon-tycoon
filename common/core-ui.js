/* ============================================================================
 * 发展国 · 通用 DOM 渲染层（core-ui.js）
 * ----------------------------------------------------------------------------
 * 提供：save/load、modal、showVictory、showShare、coinBurst、confetti
 * 所有游戏页共用，无游戏特定逻辑。
 * ==========================================================================*/

const SAVE_KEY = 'tycoon_save_v1';

/* ---------- 存档 ---------- */
function save(){
  try{
    const st = window.__game ? window.__game.state : null;
    if(!st) return;
    const data = tycoonSave(st);
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }catch(e){ console.warn('[save] fail:', e); }
}
function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function clearSave(){
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
}

/* ---------- 通用弹窗 ---------- */
function modal(opts){
  // opts: {title, body, buttons:[{label,onClick,danger}], onClose}
  const ov = document.createElement('div');
  ov.className = 'endingBanner show';
  ov.innerHTML = `
    <div class="inner">
      ${opts.title?`<div class="icon">${opts.title.icon||'🎉'}</div><h2>${opts.title.text||''}</h2>`:''}
      ${opts.body?`<p>${opts.body}</p>`:''}
      <div class="btns"></div>
    </div>`;
  document.body.appendChild(ov);
  const btnsEl = ov.querySelector('.btns');
  (opts.buttons||[]).forEach(b=>{
    const btn=document.createElement('button');
    btn.className='btn'+(b.danger?' danger':'');
    btn.style.marginTop='10px';
    btn.textContent=b.label;
    btn.onclick=()=>{ SFX.click(); ov.remove(); if(b.onClick)b.onClick(); if(opts.onClose)opts.onClose(); };
    btnsEl.appendChild(btn);
  });
  return ov;
}

/* ---------- 结局胜利弹窗 ---------- */
function showVictory(e, d, c, unlocks, cb){
  SFX.fanfare();
  const body = `
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:48px;margin-bottom:8px">${e.icon||'🏆'}</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:4px">${e.n}</div>
      <div style="font-size:13px;color:var(--ink2)">${e.d}</div>
    </div>
    <div class="card mini" style="text-align:left;margin-bottom:12px">
      <div class="billRow"><span>累计营收</span><b class="up">${fmt$(c.totalEarn)}</b></div>
      <div class="billRow"><span>发行作品</span><b>${c.projectsShipped} 款</b></div>
      <div class="billRow"><span>当前资金</span><b>${fmt$(c.money)}</b></div>
      <div class="billRow"><span>声望</span><b>${Math.round(c.rep)}</b></div>
      <div class="billRow"><span>粉丝</span><b>${fmtK(c.fans||0)}</b></div>
      <div class="billRow"><span>经营月数</span><b>${c.month} 月</b></div>
    </div>
    ${unlocks.length?`<div style="font-size:12px;color:var(--ink2);text-align:center;margin-bottom:8px">
      📌 已解锁成就：${unlocks.join(' / ')}
    </div>`:''}
    <div style="font-size:11px;color:var(--mut);text-align:center">达成结局 · 继续经营或分享成果</div>`;
  modal({
    title:{icon:'🏆',text:d.name+' 发展国 · 达成结局'},
    body,
    buttons:[
      {label:'继续经营',onClick:cb},
      {label:'📤 分享成果卡',onClick:()=>{shareCard(window.__game.state); cb&&cb();}},
      {label:'🔄 开新局',danger:true,onClick:()=>{clearSave(); location.reload();}}
    ]
  });
}

/* ---------- 分享卡弹窗 ---------- */
function showShare(url){
  const ov = document.createElement('div');
  ov.className='shareModal show';
  ov.innerHTML=`
    <div class="inner">
      <div style="text-align:center;margin-bottom:8px">
        <b style="font-size:15px">📤 分享成果卡</b>
        <span style="font-size:11px;color:var(--mut)">（长按截图 / 下载保存）</span>
      </div>
      <img src="${url}" alt="share">
      <div class="shareBtns">
        <button id="shareDl">⬇️ 下载图片</button>
        <button id="shareClose">关闭</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#shareDl').onclick=()=>{
    SFX.coin();
    const a=document.createElement('a');
    a.href=url; a.download='tycoon-share.png'; a.click();
  };
  ov.querySelector('#shareClose').onclick=()=>{ SFX.click(); ov.remove(); };
}

/* ---------- 金币飞动画 ---------- */
function coinBurst(amount){
  if(!amount||amount<=0)return;
  const n = Math.min(12, Math.max(4, Math.round(amount/50000)));
  for(let i=0;i<n;i++){
    setTimeout(()=>{
      const el=document.createElement('div');
      el.className='coin-fly';
      el.textContent='🪙';
      el.style.left=(30+Math.random()*40)+'%';
      el.style.top=(40+Math.random()*20)+'%';
      document.body.appendChild(el);
      setTimeout(()=>el.remove(),800);
    },i*60);
  }
}

/* ---------- 彩带雨 ---------- */
function confetti(n=20){
  const colors=['#F5B942','#D95D5D','#6B9E5A','#7FB0D6','#C97B2D','#F5A0A0'];
  for(let i=0;i<n;i++){
    const el=document.createElement('div');
    el.className='confetti';
    el.style.left=Math.random()*100+'%';
    el.style.top='-20px';
    el.style.background=colors[i%colors.length];
    el.style.animationDelay=(i*0.04)+'s';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1600);
  }
}

/* ---------- 震动反馈 ---------- */
function shake(){
  const t=document.getElementById('tycoon');
  if(t){ t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); }
}

/* ---------- 日志滚动渲染 ---------- */
function renderLog(log){
  if(!UI.log)return;
  UI.log.innerHTML='';
  (log||[]).slice().reverse().forEach(l=>{
    const el=document.createElement('div');
    el.className='logLine';
    el.textContent=l;
    UI.log.appendChild(el);
  });
}
