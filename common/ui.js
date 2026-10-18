/* ============================================================================
 * 发展国 · UI / 音效 / 动画层（完整版）
 * ----------------------------------------------------------------------------
 * 像素手账风渲染 + Web Audio 程序化音效 + 金币飞/彩带/震动 + 事件浮层。
 * 4 款游戏共用，仅按 profile 切换标题/文案。
 * ==========================================================================*/

/* ---------- 音效引擎（程序化合成，零音频文件） ---------- */
const SFX={
  ctx:null,master:null,muted:false,
  init(){ if(this.ctx)return; try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return; this.ctx=new AC(); this.master=this.ctx.createGain(); this.master.gain.value=.45; this.master.connect(this.ctx.destination); }catch(e){} },
  resume(){ if(this.ctx&&this.ctx.state==='suspended'){ this.ctx.resume().catch(()=>{}); } },
  tone(f,d=.12,type='sine',v=.2,slide=0){ if(!this.ctx||this.muted)return; const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+d); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+d+.02); },
  click(){ this.tone(660,.05,'square',.12); },
  good(){ this.tone(880,.08,'square',.18); setTimeout(()=>this.tone(1320,.12,'square',.14),60); },
  bad(){ this.tone(220,.16,'sawtooth',.18,-80); },
  coin(){ this.tone(1046,.07,'triangle',.2); setTimeout(()=>this.tone(1568,.1,'triangle',.16),50); },
  fanfare(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.tone(f,.16,'triangle',.2),i*90)); },
  ship(){ this.tone(440,.1,'sine',.18,220); setTimeout(()=>this.tone(880,.14,'sine',.16),80); },
};

/* ---------- BGM 引擎（程序化循环，按阶段切换 4 种情绪） ---------- */
const BGM={
  ctx:null, gain:null, timer:null, current:'greenlight', step:0, playing:false,
  _note:{
    greenlight:[0,4,7,12,0,4,7,12,0,4,7,10,0,4,7,12],
    develop:[0,2,4,7,4,2,0,4,7,9,12,9,7,4,2,0],
    ship:[12,15,19,24,19,15,12,15,19,24,27,24,19,15,12,15],
    perform:[0,0,4,0,7,0,4,0,12,0,7,0,4,0,0,0],
    bankrupt:[0,-2,-4,-7,-4,-2,0,-2,-4,-7,-10,-7,-4,-2,0,0],
  },
  _root:{ greenlight:261.6, develop:329.6, ship:392.0, perform:392.0, bankrupt:220.0 },
  _bpm:{ greenlight:120, develop:130, ship:140, perform:120, bankrupt:80 },
  _wave:{ greenlight:'triangle', develop:'square', ship:'sine', perform:'triangle', bankrupt:'sawtooth' },
  _vol:{ greenlight:.14, develop:.10, ship:.16, perform:.12, bankrupt:.08 },

  start(phase){
    if(this.playing){
      // 热切换：阶段变了就更新 current，_loop 自动用新旋律
      if(phase&&phase!==this.current){ this.current=phase; this.step=0; }
      return;
    }
    this.playing=true;
    this.current=phase||'greenlight';
    this.step=0;
    this._loop();
  },
  stop(){
    this.playing=false;
    if(this.timer){ clearTimeout(this.timer); this.timer=null; }
  },
  _loop(){
    if(!this.playing)return;
    if(!this.ctx){ this.ctx=SFX.ctx; }
    if(!this.ctx){ this.timer=setTimeout(()=>this._loop(),100); return; }
    const scale=this._note[this.current]||this._note.greenlight;
    const root=this._root[this.current]||261.6;
    const wave=this._wave[this.current]||'triangle';
    const vol=this._vol[this.current]||.12;
    const interval=60/(this._bpm[this.current]||120)*1000;

    const t=this.ctx.currentTime;
    const f=root*Math.pow(2,scale[this.step%scale.length]/12);
    const o=this.ctx.createOscillator();
    const g=this.ctx.createGain();
    o.type=wave; o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(.001,t+interval/1000*.9);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t+interval/1000+0.05);
    // 低音贝斯（每 4 步）
    if(this.step%4===0){
      const fo=this.ctx.createOscillator();
      const fg=this.ctx.createGain();
      fo.type='sine'; fo.frequency.setValueAtTime(root/2,t);
      fg.gain.setValueAtTime(vol*.6,t);
      fg.gain.exponentialRampToValueAtTime(.001,t+interval/1000*3);
      fo.connect(fg); fg.connect(this.ctx.destination);
      fo.start(t); fo.stop(t+interval/1000*3+.05);
    }
    this.step++;
    this.timer=setTimeout(()=>this._loop(), interval);
  },
};


/* ---------- 岗位名（与引擎 STAFF_ROLES 对齐，UI 显示用） ---------- */
const STAFF_ROLES_UI=[
  {id:'dev',name:'开发',short:'开发'},
  {id:'art',name:'美术',short:'美术'},
  {id:'prod',name:'产品',short:'产品'},
  {id:'mkt',name:'市场',short:'市场'},
];

/* ---------- 全局 DOM 引用（每个游戏页初始化） ---------- */
let UI={};
function bindUI(root){
  UI={
    root,
    hud:{ money:root.querySelector('#hudMoney'), rep:root.querySelector('#hudRep'), fans:root.querySelector('#hudFans'), month:root.querySelector('#hudMonth'),
          morale:root.querySelector('#hudMorale'), loan:root.querySelector('#hudLoan') },
    panel:root.querySelector('#panelBody'),
    office:root.querySelector('#officeBody'),
    staff:root.querySelector('#staffBody'),
    log:root.querySelector('#logBody'),
    btn:{
      greenlight:root.querySelector('#btnGreenlight'),
      develop:root.querySelector('#btnDevelop'),
      ship:root.querySelector('#btnShip'),
      nextMonth:root.querySelector('#btnNextMonth'),
      share:root.querySelector('#btnShare'),
    },
    upgrades:root.querySelector('#upgBody'),
  };
}
function refreshHud(c){
  if(!UI.hud)return;
  UI.hud.money.textContent=fmt$(c.money);
  UI.hud.money.parentElement.className='item money'+(c.money<0?' danger':'');
  UI.hud.rep.textContent=Math.round(c.rep);
  UI.hud.fans.textContent=fmtK(c.fans||0);
  UI.hud.month.textContent=c.month;
  if(UI.hud.morale)UI.hud.morale.textContent=Math.round(c.morale||50);
  if(UI.hud.loan)UI.hud.loan.textContent=(c.loan>0)?fmt$(c.loan):'—';
  // BGM 阶段情绪切换
  if(typeof BGM!=='undefined' && BGM.playing){ BGM.start(state.loopPhase||'greenlight'); }
}

/* ---------- 场景同步（Kairosoft 像素画板） ---------- */
function syncScene(state){
  if(typeof scene==='undefined')return;
  const c=state.company, d=state.domain, p=state.project;
  const off=c.office;
  const tier=off?off.tier:1;
  const progress=p&&(p._devProgress||0);
  scene.update({
    tier, phase: state.loopPhase,
    progress,
    showBar: state.loopPhase==='develop',
  });
}
function fmtK(v){ v=+v||0; if(v>=1e8)return(v/1e8).toFixed(1)+'亿'; if(v>=1e4)return(v/1e4).toFixed(1)+'万'; return ''+v; }
function pushLog(txt){
  const el=document.createElement('div'); el.className='logLine'; el.textContent=txt;
  UI.log.prepend(el);
  while(UI.log.children.length>60)UI.log.removeChild(UI.log.lastChild);
}

/* ---------- 事件浮层（随机事件弹出） ---------- */
function showToast(text, cat){
  const el=document.createElement('div');
  el.className='eventToast '+(cat||'');
  el.textContent=text;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),300); },3600);
}

/* ---------- 渲染：当前阶段面板 ---------- */
function renderPanel(state){
  const d=state.domain, c=state.company, p=state.project, ph=state.loopPhase;
  let h='';
  if(ph==='greenlight'){
    h+=`<div class="stageTag">📋 立项阶段</div>`;
    h+=`<div class="pickRow"><label>平台</label>
      <div class="pickGrid">${Object.keys(d.platform).map(k=>`<button class="chip${p&&p.platform===k?' on':''}" data-pk="platform" data-v="${k}">${d.platform[k].name}</button>`).join('')}</div></div>`;
    h+=`<div class="pickRow"><label>题材</label>
      <div class="pickGrid">${d.genres.map(g=>`<button class="chip${p&&p.genre===g?' on':''}" data-pk="genre" data-v="${g}">${g}</button>`).join('')}</div></div>`;
    h+=`<div class="pickRow"><label>受众</label>
      <div class="pickGrid">${d.audience.map(a=>`<button class="chip${p&&p.audience===a?' on':''}" data-pk="audience" data-v="${a}">${AUD[a]}</button>`).join('')}</div></div>`;
    h+=`<div class="pickRow"><label>变现</label>
      <div class="pickGrid">${Object.keys(d.monetization).map(m=>`<button class="chip${p&&p.monetization===m?' on':''}" data-pk="mono" data-v="${m}">${d.monetization[m].name}</button>`).join('')}</div></div>`;
    h+=`<div class="pickRow"><label>体量</label>
      <div class="pickGrid">${Object.keys(d.ambition).map(a=>`<button class="chip${p&&p.ambition===a?' on':''}" data-pk="ambition" data-v="${a}">${a}</button>`).join('')}</div></div>`;
    if(p){
      h+=`<div class="pickRow"><label>属性投入</label>
        ${[['gameplay','玩法'],['art','画面'],['tech','优化'],['content','内容']].map(([k,l])=>
          `<div class="attrLine"><span>${l}</span><input type="range" min="1" max="10" value="${p.attrs[k]}" data-attr="${k}" class="attr"><b id="av_${k}">${p.attrs[k]}</b></div>`).join('')}</div>`;
    }
  }
  else if(ph==='develop'){
    h+=`<div class="stageTag">💻 开发阶段</div>`;
    h+=`<div class="tiny mut">当前项目「${p.name}」（${p.platform}/${p.genre}）· 团队能力自动提升属性</div>`;
  }
  else if(ph==='ship'){
    h+=`<div class="stageTag">🚀 发行阶段</div>`;
    h+=`<div class="staffGrid"><div class="staffRow"><span>营销预算</span><input type="range" min="0" max="10" value="5" id="shipMkt" class="attr"><b id="sv_mkt2">5</b></div></div>`;
  }
  else if(ph==='perform'){
    h+=`<div class="stageTag">📈 市场表现 · 进入下月</div>`;
    if(state.lastResult){
      const L=state.lastResult;
      const editors=(L.editorScores||[]).map(e=>`<div class="billRow"><span>${e.name}</span><b>${e.score}/10</b></div>`).join('');
      const hoF=L.hallOfFame?'<div class="billRow"><span>荣誉</span><b class="up">⭐ 名人堂</b></div>':(L.seqFlag?'<div class="billRow"><span>续作</span><b>🏆 可出续作</b></div>':'');
      h+=`<div class="card mini"><div class="billRow"><span>4 编辑总分</span><b class="${L.score40>=32?'up':''}">${L.score40}/40</b></div>${editors}<div class="billRow"><span>首月销量</span><b>${fmtK(L.sales)}</b></div><div class="billRow"><span>首月营收</span><b class="up">+${fmt$(L.firstRevenue)}</b></div>${hoF}</div>`;
    }
  }
  else if(ph==='bankrupt'){
    h+=`<div class="stageTag">💸 公司破产</div><div class="tiny mut">资金耗尽且无贷款——经营终止，可查看成果卡或开新局。</div>`;
  }
  UI.panel.innerHTML=h;
  bindPanel(state);
  renderOffice(state,game);
  renderStaff(state,game);
  renderUpgrades(state);
  refreshHud(c);
  syncScene(state);
}

function bindPanel(state){
  const d=state.domain, p=state.project;
  UI.root.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>{
    SFX.click();
    const key=b.dataset.pk, v=b.dataset.v;
    if(!p)state.greenlight({platform:Object.keys(d.platform)[0],genre:d.genres[0],audience:d.audience[0],ambition:Object.keys(d.ambition)[0],monetization:Object.keys(d.monetization)[0]});
    else p[key]=v;
    UI.root.querySelectorAll('[data-pk="'+key+'"]').forEach(x=>x.classList.toggle('on',x.dataset.v===v));
    renderPanel(state,game);
  });
  UI.root.querySelectorAll('[data-attr]').forEach(r=>r.oninput=()=>{
    p.attrs[r.dataset.attr]=+r.value;
    const el=document.getElementById('av_'+r.dataset.attr); if(el)el.textContent=r.value;
  });
  const mkt=UI.root.querySelector('#shipMkt');
  if(mkt)mkt.oninput=()=>{ const el=document.getElementById('sv_mkt2'); if(el)el.textContent=mkt.value; };
}

/* ---------- 办公室面板 ---------- */
function renderOffice(state,game){
  if(!UI.office)return;
  const d=state.domain, c=state.company;
  const offices=d.offices||{};
  UI.office.innerHTML=Object.entries(offices).map(([key,off])=>{
    const cur=c.office&&c.office.key===key;
    const afford=c.money>=off.rent;
    return `<div class="officeRow${cur?' on':''}" data-off="${key}">
      <div><span class="oname">${off.name}</span><div class="odetail">容量 ${off.cap} 人 · 签约费 ${fmt$(off.rent)}</div></div>
      <div class="orent${afford?'':' poor'}">${cur?'✔ 使用中':'-'+fmt$(off.rent)}</div></div>`;
  }).join('')||'<div class="tiny mut">暂无办公室档位</div>';
  UI.office.querySelectorAll('[data-off]').forEach(r=>r.onclick=()=>{
    if(c.office&&c.office.key===r.dataset.off)return;
    if(game.rentOffice(r.dataset.off)){ SFX.good(); refreshHud(c); renderOffice(state,game); }
    else SFX.bad();
  });
}

/* ---------- 员工面板 ---------- */
function renderStaff(state,game){
  if(!UI.staff)return;
  const c=state.company;
  const off=c.office;
  const full=off&&off.cap&&c.staffList.length>=off.cap;
  let h=`<div class="tiny mut">团队 ${c.staffList.length}${off?('/'+off.cap):''} 人${full?' · 已满':''} · 团队能力：`;
  const team=game.getTeam();
  h+=` 开发${team.dev} 美术${team.art} 产品${team.prod} 市场${team.mkt}</div>`;
  // 员工卡片
  h+=c.staffList.map(e=>{
    const roleName=(STAFF_ROLES_UI.find(r=>r.id===e.role)||{}).name||e.role;
    return `<div class="empCard" data-emp="${e.id}">
      <div><div class="ename">${roleName}</div><div class="edetail">月薪 ${fmt$(e.salary)}</div></div>
      <div class="emeta"><span class="lvl">Lv${e.lvl}</span>
        <div class="mbtns">
          <button class="mbtn up" data-a="up" data-emp="${e.id}">${e.lvl>=5?'满级':'升级'}</button>
          <button class="mbtn del" data-a="fire" data-emp="${e.id}">解雇</button>
        </div></div></div>`;
  }).join('');
  // 招聘
  h+=`<div class="hireGrid">${STAFF_ROLES_UI.map(r=>
    `<button class="hireBtn" data-hire="${r.id}">+ ${r.short}${full?'（满）':''}</button>`).join('')}</div>`;
  UI.staff.innerHTML=h;
  UI.staff.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.emp;
    if(b.dataset.a==='up'){ if(game.upgradeEmp(id)){SFX.coin();renderStaff(state,game);refreshHud(c);}else SFX.bad(); }
    else{ if(game.fire(id)){SFX.bad();renderStaff(state,game);refreshHud(c);} }
  });
  UI.staff.querySelectorAll('[data-hire]').forEach(b=>b.onclick=()=>{
    if(b.textContent.includes('满'))return;
    const r=game.hire(b.dataset.hire);
    if(r.ok){SFX.good();renderStaff(state,game);refreshHud(c);}
    else showToast(r.reason||'无法招聘','bad');
  });
}

/* ---------- 升级区 ---------- */
function renderUpgrades(state){
  const d=state.domain, c=state.company;
  const avail=[];
  Object.keys(d.upgradeTree).forEach(cat=>{
    d.upgradeTree[cat].forEach(u=>{
      if(c.upgrades[u.id])return;
      if(u.requires&&!c.upgrades[u.requires])return;
      avail.push({id:u.id,label:u.label,cost:u.cost});
    });
  });
  UI.upgrades.innerHTML=avail.length
    ? avail.map((u,i)=>`<div class="upgRow" data-ui="${i}"><span>${u.label}</span><b class="${c.money>=u.cost?'ok':'poor'}">-${fmt$(u.cost)}</b></div>`).join('')
    : '<div class="tiny mut">暂无可购升级</div>';
  UI.upgrades.querySelectorAll('[data-ui]').forEach(row=>{
    const u=avail[+row.dataset.ui];
    row.onclick=()=>{ if(state.buyUpgrade(u.id)){SFX.coin();renderPanel(state,game);}else showToast('资金不足','bad'); };
  });
}

/* ---------- 阶段推进按钮 ---------- */
function bindStageButtons(state,game){
  const c=state.company;
  UI.btn.greenlight.onclick=()=>{
    if(!state.project||state.loopPhase!=='greenlight')return;
    SFX.ship(); state.loopPhase='develop'; renderPanel(state,game);
  };
  UI.btn.develop.onclick=()=>{
    if(state.loopPhase!=='develop')return;
    SFX.ship();
    // 开发阶段进度条动画（0→100% 缓慢爬升，Kairosoft 手感）
    if(typeof scene!=='undefined'){
      scene.update({ tier:(state.company.office?state.company.office.tier:1), phase:'develop' });
      scene.animateProgressTo(1, 1800);
    }
    setTimeout(()=>{ game.develop(); renderPanel(state,game); },1850);
  };
  UI.btn.ship.onclick=()=>{
    if(state.loopPhase!=='ship')return;
    const mkt=+document.getElementById('shipMkt')?.value||5;
    SFX.fanfare();
    game.ship(mkt);
    coinBurst(state.lastResult?.firstRevenue||0);
    confetti(18);
    if(typeof scene!=='undefined') scene.doJump();
    renderPanel(state,game);
  };
  UI.btn.nextMonth.onclick=()=>{
    if(state.loopPhase==='bankrupt')return;
    SFX.click();
    const prevMonth=state.company.month;
    game.nextMonth();
    // 检测事件日志 → 弹窗
    const newLogs=state.log.slice(-2);
    newLogs.forEach(l=>{
      if(l.startsWith('📈')||l.startsWith('🐛')||l.startsWith('📜')||l.startsWith('🎮')||l.startsWith('🏆')||l.startsWith('🌟')||l.startsWith('🚀')||l.startsWith('🐞')||l.startsWith('⭐')||l.startsWith('📉')||l.startsWith('🤝')||l.startsWith('🧠')||l.startsWith('🔥')||l.startsWith('📦')||l.startsWith('🤖')||l.startsWith('⚖️')||l.startsWith('💰')||l.startsWith('🎨')||l.startsWith('📋')||l.startsWith('🌸')||l.startsWith('✏️')||l.startsWith('📝')){
        showToast(l, l.includes('¥')&&l.includes('-')?'bad':(l.includes('!')?'good':''));
        if(l.includes('-')&&typeof scene!=='undefined') scene.pulse();
      }
    });
    renderPanel(state,game);
    checkEndings(state,game);
  };
  if(UI.btn.share)UI.btn.share.onclick=()=>{ SFX.coin(); shareCard(state); };
}

/* ---------- 结局检测 ---------- */
function checkEndings(state,game){
  const ends=game.endings();
  const newEnds=ends.filter(e=>!state.company._doneEndings.includes(e.id));
  if(newEnds.length){
    const e=newEnds[0];
    game.recordEnding(e.id);
    victoryModal(e,state,game);
  }
}
function victoryModal(e,state,game){
  const c=state.company, d=state.domain;
  const unlocks=[];
  Object.keys(c.upgrades).forEach(id=>{
    if(c.upgrades[id]){
      let lbl='';
      Object.values(d.upgradeTree).forEach(arr=>arr.forEach(u=>{ if(u.id===id)lbl=u.label; }));
      if(lbl)unlocks.push(lbl);
    }
  });
  showVictory(e,d,c,unlocks,()=>{ save(); });
}

/* ---------- 分享卡（Canvas 手绘） ---------- */
function shareCard(state){
  const d=state.domain, c=state.company;
  const cv=document.createElement('canvas'); cv.width=620; cv.height=820;
  const x=cv.getContext('2d');
  x.fillStyle='#FBF6EC'; x.fillRect(0,0,620,820);
  x.strokeStyle='#3D2C1E'; x.lineWidth=6; x.strokeRect(18,18,584,784);
  x.textAlign='center'; x.fillStyle='#3D2C1E';
  x.font='700 40px sans-serif'; x.fillText(d.name+'发展国 · 复盘',310,92);
  x.font='26px sans-serif'; x.fillText(c.projectsShipped+' 款'+d.goods+' · 第 '+c.month+' 月',310,132);
  x.fillStyle='#C97B2D'; x.font='700 34px sans-serif';
  x.fillText('累计营收 '+fmt$(c.totalEarn),310,184);
  x.fillStyle='#3D2C1E'; x.font='22px sans-serif';
  x.fillText('声望 '+Math.round(c.rep)+' · 粉丝 '+fmtK(c.fans||0)+' · 团队 '+c.staffList.length+' 人',310,224);
  x.fillText('峰值月营收 '+fmt$(c.peak||0),310,254);
  x.fillStyle='#4E7A4E'; x.font='700 24px sans-serif';
  const done=(c._doneEndings||[]).map(id=>(d.endings.find(e=>e.id===id)||{}).n).filter(Boolean);
  x.fillText('达成结局：'+(done.length?done.join(' / '):'仍在路上'),310,300);
  for(let i=0;i<30;i++){ x.fillStyle=pick(['#F5B942','#D95D5D','#6B9E5A','#7FB0D6','#C97B2D']); x.fillRect(40+Math.random()*540,360+Math.random()*80,10,14); }
  x.fillStyle='#B4A48E'; x.font='18px sans-serif';
  x.fillText('把「'+d.name+'」当事业，把版本当人生',310,548);
  const url=cv.toDataURL('image/png');
  showShare(url);
}

/* ---------- 金币飞 / 彩带 ---------- */
function coinBurst(amount){
  if(!amount||amount<=0)return;
  const n=Math.min(12,Math.max(4,Math.round(amount/50000)));
  for(let i=0;i<n;i++){
    setTimeout(()=>{
      const el=document.createElement('div'); el.className='coin-fly'; el.textContent='🪙';
      el.style.left=(30+Math.random()*40)+'%'; el.style.top=(40+Math.random()*20)+'%';
      document.body.appendChild(el); setTimeout(()=>el.remove(),800);
    },i*60);
  }
}
function confetti(n=20){
  const colors=['#F5B942','#D95D5D','#6B9E5A','#7FB0D6','#C97B2D','#F5A0A0'];
  for(let i=0;i<n;i++){
    const el=document.createElement('div'); el.className='confetti';
    el.style.left=Math.random()*100+'%'; el.style.top='-20px';
    el.style.background=colors[i%colors.length]; el.style.animationDelay=(i*0.04)+'s';
    document.body.appendChild(el); setTimeout(()=>el.remove(),1600);
  }
}
