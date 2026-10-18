/* ============================================================================
 * 发展国通用引擎 · 回合制经济模拟核心（完整版）
 * ----------------------------------------------------------------------------
 * 复刻 Gamedev Tycoon 核心循环 + 中国本土化。纯逻辑层，不碰 DOM。
 * 4 款游戏（游戏/程序/AI/设计）共用，仅注入不同 profile。
 *
 * 核心循环：
 *   GREENLIGHT(立项) → DEVELOP(开发) → SHIP(发行) → PERFORM(市场表现)
 *   + 办公室(租) / 员工(招募·升级·解雇) / 升级研究 / 趋势 / 随机事件 / 破产
 * ==========================================================================*/

/* ---------- 工具 ---------- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[ri(0,a.length-1)];
const chance=p=>Math.random()<p;
const fmt$=v=>'¥'+Math.round(v||0).toLocaleString('en-US');
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ---------- 办公室系统（每月付租金，决定可容纳员工数 & 制作上限） ---------- */
function rentOffice(company, domain, officeKey){
  const off=(domain.offices||{})[officeKey];
  if(!off)return false;
  // 首次租办公室或换更大的：扣租金（一次性签约费 = 1 月租金）
  const cur=company.office;
  if(!cur||cur.tier<off.tier){
    const fee=off.rent; // 签约费 = 1 月租金
    if(company.money<fee)return false;
    company.money-=fee;
  }
  company.office={key:officeKey, tier:off.tier, rent:off.rent, cap:off.cap, name:off.name};
  company._officeLog='🏢 租了办公室：'+off.name+'（每月 '+fmt$(off.rent)+'，容量 '+off.cap+' 人）';
  return true;
}

/* ---------- 员工系统 ----------
 * 岗位：dev(开发) / art(美术) / prod(产品/项目) / mkt(市场)
 * 每名员工有 level(1-5)，薪资随 level 递增
 * 升级消耗资金，属性 +1（满 5 级封顶）
 * 解雇省工资，士气 -2
 * 薪资每月统一扣 */
const STAFF_ROLES=[
  {id:'dev',  name:'开发工程师',base:8000,  attrBoost:{gameplay:1,tech:1}},
  {id:'art',  name:'美术师',    base:7000,  attrBoost:{art:1}},
  {id:'prod', name:'产品经理',  base:9000,  attrBoost:{content:1,gameplay:1}},
  {id:'mkt',  name:'市场专员',  base:6000,  attrBoost:{content:1}},
];
function staffSalary(role){
  const r=STAFF_ROLES.find(x=>x.id===role);
  return r?r.base:5000;
}
function hireStaff(company, domain, role){
  const off=company.office;
  // 办公室容量限制
  if(off&&off.cap&&company.staffList.length>=off.cap)return {ok:false,reason:'办公室满了'};
  const cost=staffSalary(role)*2; // 签约费 = 2 月工资
  if(company.money<cost)return {ok:false,reason:'资金不足'};
  const lvl=ri(1,2);
  const emp={id:'emp_'+Date.now()+'_'+ri(1,99),role,lvl,salary:staffSalary(role)};
  company.money-=cost;
  company.staffList.push(emp);
  company._staffLog='👤 招了 1 名'+STAFF_ROLES.find(r=>r.id===role).name+'（Lv'+lvl+'，月薪 '+fmt$(emp.salary)+'）';
  return {ok:true,emp};
}
function fireStaff(company, id){
  const idx=company.staffList.findIndex(e=>e.id===id);
  if(idx<0)return false;
  company.staffList.splice(idx,1);
  company.morale=clamp((company.morale||50)-2,0,100);
  company._staffLog='😢 解雇了 1 名员工，士气 -2';
  return true;
}
function upgradeStaff(company, id){
  const emp=company.staffList.find(e=>e.id===id);
  if(!emp||emp.lvl>=5)return false;
  const cost=emp.salary*3; // 升级费 = 3 月工资
  if(company.money<cost)return false;
  company.money-=cost;
  emp.lvl++;
  emp.salary=Math.round(emp.salary*1.15);
  company._staffLog='⬆️ 员工升到 Lv'+emp.lvl+'（-'+fmt$(cost)+'）';
  return true;
}
function staffTeamScore(company){
  // 各岗位能力总和（供 develop 提升属性用）
  const team={dev:0,art:0,prod:0,mkt:0};
  company.staffList.forEach(e=>{ team[e.role]=(team[e.role]||0)+e.lvl; });
  // 无员工时给最低保障 1
  Object.keys(team).forEach(k=>{team[k]=Math.max(1,team[k]);});
  return team;
}

/* ---------- 公司初始（完整版） ---------- */
function initCompany(diff){
  const m=(diff&&diff.startMoney)||80;
  return{
    money:Math.round(m*1000),
    rep:10,
    fans:0,
    month:1,
    upgrades:{},
    office:null,          // {key,tier,rent,cap,name}
    staffList:[],         // 员工列表
    morale:50,            // 士气 0-100
    projectsShipped:0,
    totalEarn:0,
    peak:0,
    trend:{},
    eventCd:3,
    loan:0,               // 贷款
    _doneEndings:[],      // 已达成结局 id
  };
}

/* ---------- 立项：生成项目草稿 ---------- */
function greenlight(company, domain, choices){
  // choices: {platform, genre, audience, monetization, ambition}
  const proj={
    name:(domain.adjective||'')+' '+(choices.name||'新作品'),
    platform:choices.platform,
    genre:choices.genre,
    audience:choices.audience,
    monetization:choices.monetization||Object.keys(domain.monetization)[0],
    ambition:choices.ambition||Object.keys(domain.ambition)[0],
    attrs:{
      gameplay:+(choices.gameplay??5),
      art:+(choices.art??5),
      tech:+(choices.tech??5),
      content:+(choices.content??5),
    },
  };
  return proj;
}

/* ---------- 开发：投入团队 → 提升属性，消耗资金与月数 ---------- */
function develop(company, domain, proj, staffOverride){
  const amb=domain.ambition[proj.ambition]||domain.ambition[Object.keys(domain.ambition)[0]];
  const costMult=amb.costMult||1;
  // 团队加成（员工系统）
  const team=staffOverride?staffOverride:staffTeamScore(company);
  // 填充缺失岗位，避免 undefined*0.4 → NaN
  const teamFull={dev:team.dev||1,art:team.art||1,prod:team.prod||1,mkt:team.mkt||1};
  const avgLevel=(teamFull.dev+teamFull.art+teamFull.prod+teamFull.mkt)/4/2;
  // 工期（月）= 体量时间 × (4-属性均值)/4 + 2
  const avgAttr=(proj.attrs.gameplay+proj.attrs.art+proj.attrs.tech+proj.attrs.content)/4;
  const baseMonths=Math.max(2,Math.round(avgAttr*amb.timeMult*0.5));
  const months=clamp(Math.round(baseMonths - avgLevel*0.5 + 2),2,12);
  // 团队能力拉高对应属性
  const lift=(slots,attr,amount)=>{proj.attrs[attr]=clamp(proj.attrs[attr]+amount,0,10);};
  lift(['dev'],'gameplay',Math.round(teamFull.dev*0.4));
  lift(['dev'],'tech',Math.round(teamFull.dev*0.3));
  lift(['art'],'art',Math.round(teamFull.art*0.4));
  lift(['prod'],'content',Math.round(teamFull.prod*0.4));
  lift(['mkt'],'content',Math.round(teamFull.mkt*0.3));
  // 资金消耗
  const devCost=Math.round((10-avgAttr)*costMult*8000*(1+(months-2)*0.05));
  const budget=company.money;
  if(budget<devCost){
    const ratio=Math.max(0.3,budget/devCost);
    proj.attrs.gameplay=Math.max(1,Math.round(proj.attrs.gameplay*ratio));
    proj.attrs.content=Math.max(1,Math.round(proj.attrs.content*ratio));
  }
  company.money-=Math.min(budget,devCost);
  company.month+=months;
  // 研究/升级带来的属性提升
  if(company.upgrades['rd_'+proj.platform]){proj.attrs.tech+=1;}
  if(company.upgrades['rd_gpu']){proj.attrs.tech+=1;}
  if(company.upgrades['rd_ai']){proj.attrs.tech+=1;}
  proj._months=months;
  proj._devCost=devCost;
  return proj;
}

/* ---------- 发行：算评分 / 销量 / 收入 ---------- */
function ship(company, domain, proj, marketing){
  const c=company;
  const p=proj;
  const plat=domain.platform[p.platform]||domain.platform[Object.keys(domain.platform)[0]];
  // 兼容加成（题材×玩法强配）
  const compat=domain.compat[(p.genre+'|'+p.audience)]||0;
  // 平台-题材适配
  const aff=(domain.platformGenreAffinity[p.platform]&&domain.platformGenreAffinity[p.platform][p.genre])||0;
  // 趋势命中
  const trendHit=(c.trend[p.genre]||0);
  // 士气加成
  const moraleBonus=(c.morale||50)/50*0.3;
  // 综合评分（0-10 保留一位）
  const raw=(p.attrs.gameplay+p.attrs.art+p.attrs.tech+p.attrs.content)/4;
  let score=raw*0.65 + compat + aff + (trendHit>0?0.5:0) + (marketing||3)*0.25 + moraleBonus - (p._months>8?0.3:0);
  score=clamp(Math.round(score*10)/10,0,10);
  // 粉丝基础影响首月曝光
  const fanBoost=1+Math.log10((c.fans||100)+1)*0.08;
  // 销量（首月）
  const reach=plat.marketShare*(1+score/10*0.8)*fanBoost;
  const paying=domain.monetization[p.monetization].payingRate||0.15;
  let sales=Math.round(reach*1e5*paying);
  sales=Math.max(100,sales);
  // 首月收入
  const unit=domain.monetization[p.monetization].unit||20;
  const rev=Math.round(sales*unit*plat.royaltyRate);
  c.money+=rev;
  c.fans+=Math.round(sales*0.4);
  c.rep=clamp(c.rep+(score-5)*0.6,0,100);
  c.projectsShipped++;
  c.peak=Math.max(c.peak,rev);
  c.totalEarn+=rev;
  p.score=score; p.sales=sales; p.firstRevenue=rev; p.reach=reach;
  p.shipMonth=c.month;
  // 月度衰减曲线
  p.revCurve=makeRevenueCurve(domain,p.monetization,sales,unit);
  // 完整发行统计（供 UI 显示）
  p.shipStats={
    score:score,
    firstMonthSales:sales,
    firstMonthRev:rev,
    months:months(p._months),
    compat:compat,
    trendHit:trendHit,
    fanBoost:fanBoost,
    marketing:marketing||3,
  };
  return p;
}

function months(m){return m;}

function makeRevenueCurve(domain,mode,sales,unit){
  const m=domain.monetization[mode]||{};
  const decay=m.decayPerMonth||0.7;
  const cap=m.curveCap||6;
  const curve=[];
  for(let i=1;i<=cap;i++) curve.push(Math.round(sales*Math.pow(decay,i)*unit*(m.royaltyRate||0.7)));
  return curve;
}

/* ---------- 市场表现：月度结算（收入衰减 + 粉丝 + 声望） ---------- */
function perform(company, domain, proj){
  const p=proj;
  const mi=company.month;
  const curve=p.revCurve||[];
  const idx=(mi-p.shipMonth||0);
  const rev=(curve[idx]!==undefined)?curve[idx]:0;
  company.money+=rev;
  company.totalEarn+=rev;
  company.peak=Math.max(company.peak,rev);
  if(domain.monetization[p.monetization].isSub){company.fans+=Math.round((p.sales||0)*0.02);}
  return{rev};
}

/* ---------- 升级研究（restate） ---------- */
function restate(company, domain){
  const avail=[];
  Object.keys(domain.upgradeTree||{}).forEach(cat=>{
    (domain.upgradeTree[cat]||[]).forEach(u=>{
      if(company.upgrades[u.id])return;
      if(u.requires&&!company.upgrades[u.requires])return;
      if(company.money>=u.cost)avail.push({id:u.id,cat,label:u.label,cost:u.cost});
    });
  });
  return avail;
}

/* ---------- 趋势系统 ---------- */
function trendTick(company, domain){
  const t=domain.trend||{cycleMonths:6,bonusOnHit:0.5,bonusOnMiss:-0.3,weights:{}};
  const keys=Object.keys(t.weights||{});
  if(!keys.length)return;
  company.trend={};
  keys.forEach(k=>company.trend[k]=0);
  const hot=pick(keys);
  company.trend[hot]+=t.bonusOnHit||0.5;
  keys.forEach(k=>{if(k!==hot)company.trend[k]+=(t.bonusOnMiss||-0.3)*0.4;});
  return company.trend;
}

/* ---------- 事件抽签 ---------- */
function eventTick(company, domain){
  const pool=domain.events||[];
  if(!pool.length)return null;
  const e=pick(pool);
  if(chance(e.chance))return e;
  return null;
}
function applyEvent(company, domain, e){
  if(e.money)company.money+=e.money;
  if(e.rep)company.rep=clamp(company.rep+e.rep,0,100);
  if(e.fans)company.fans=Math.max(0,company.fans+e.fans);
  if(e.morale)company.morale=clamp((company.morale||50)+e.morale,0,100);
  return e;
}

/* ---------- 贷款系统（资金周转） ---------- */
function takeLoan(company, amount){
  if(company.money<0&&amount>0){
    company.loan+=amount;
    company.money+=amount;
    return true;
  }
  return false;
}
function repayLoan(company){
  if(company.loan>0&&company.money>0){
    const pay=Math.min(company.loan,company.money*0.5);
    company.money-=pay;
    company.loan-=pay;
    return pay;
  }
  return 0;
}

/* ---------- 月度成本（办公室租金 + 员工薪资） ---------- */
function monthlyUpkeep(company, domain){
  let cost=domain.upkeep||2000;
  // 办公室租金
  if(company.office)cost+=company.office.rent;
  // 员工工资
  company.staffList.forEach(e=>{cost+=e.salary;});
  return cost;
}

/* ---------- 破产检测 ---------- */
function isBankrupt(company){
  return company.money<0&&company.loan<=0;
}

/* ---------- 引擎入口（完整版） ---------- */
function createTycoonGame(domainKey, profiles, difficulty){
  const domain=profiles[domainKey];
  const company=initCompany(difficulty);
  const state={
    domain, company,
    project:null,
    lastResult:null,
    loopPhase:'greenlight',
    log:[],
  };
  state.log.push('🎬 '+domain.name+' 开公司！先租个办公室、招几个人，再立项第一款'+(domain.goods||'产品')+'。');
  trendTick(company, domain);

  // 内部：把 lastResult 指向 project（避免 ship 后多次 nextMonth 重复 perform）
  let _performUntil = 0; // perform 最多执行到第几月

  return{
    state,
    domain,

    /* 阶段 1：立项 */
    greenlight:choices=>{
      state.project=greenlight(company,domain,choices);
      state.loopPhase='develop';
      state.log.push('📋 立项：「'+state.project.name+'」（'+state.project.platform+' / '+state.project.genre+' / 体量 '+state.project.ambition+'）');
      return state;
    },

    /* 阶段 2：开发（可选传 staff 覆盖） */
    develop:staffOverride=>{
      state.project=develop(company,domain,state.project,staffOverride);
      state.loopPhase='ship';
      state.log.push('💻 开发完成，用时 '+state.project._months+' 个月（-'+fmt$(state.project._devCost||0)+'），准备发行。');
      return state;
    },

    /* 阶段 3：发行 */
    ship:marketing=>{
      state.project=ship(company,domain,state.project,marketing||3);
      state.loopPhase='perform';
      state.lastResult=state.project;
      _performUntil=state.project.shipMonth; // perform 只执行 1 次（发行当月已算了首月）
      state.log.push('🚀 发行！评分 '+state.project.score+'/10，首月 '+fmt$(state.project.firstRevenue)+'。');
      return state;
    },

    /* 月度推进 */
    nextMonth:()=>{
      const c=company;
      // 1. 市场表现（只算发行后衰减第 1 月）
      if(state.lastResult && c.month===_performUntil){
        perform(c,domain,state.lastResult);
        state.lastResult=null;
      }
      // 2. 月度成本（办公室 + 员工工资 + 基础维护）
      const upk=monthlyUpkeep(c,domain);
      c.money-=upk;
      // 3. 还贷款
      if(c.loan>0){ repayLoan(c); }
      // 4. 士气自然回复
      c.morale=clamp((c.morale||50)+1,0,100);
      // 5. 月份推进
      c.month++;
      // 6. 事件
      if(c.eventCd<=0){
        const ev=eventTick(c,domain);
        if(ev){ applyEvent(c,domain,ev); state.log.push(ev.text); c.eventCd=3; }
      } else c.eventCd--;
      // 7. 趋势轮转
      if(domain.trend&&domain.trend.cycleMonths&&c.month%domain.trend.cycleMonths===0) trendTick(c,domain);
      // 8. 破产检测
      if(isBankrupt(c)){
        state.loopPhase='bankrupt';
        state.log.push('💸 资金耗尽且无贷款可用——公司破产了。');
        c._bankrupt=true;
        return state;
      }
      state.loopPhase='greenlight';
      state.log.push('📅 第 '+c.month+' 月。资金 '+fmt$(c.money)+'（声望 '+Math.round(c.rep)+'，士气 '+Math.round(c.morale||50)+'）');
      return state;
    },

    /* 办公室 */
    rentOffice:officeKey=>{
      const ok=rentOffice(company,domain,officeKey);
      if(ok&&company._officeLog)state.log.push(company._officeLog);
      return ok;
    },

    /* 员工 */
    hire:role=>{
      const r=hireStaff(company,domain,role);
      if(r.ok&&company._staffLog)state.log.push(company._staffLog);
      return r;
    },
    fire:id=>{
      const ok=fireStaff(company,id);
      if(ok&&company._staffLog)state.log.push(company._staffLog);
      return ok;
    },
    upgradeEmp:id=>{
      const ok=upgradeStaff(company,id);
      if(ok&&company._staffLog)state.log.push(company._staffLog);
      return ok;
    },
    getTeam:()=>staffTeamScore(company),

    /* 升级研究 */
    buyUpgrade:id=>{
      const ups=restate(company,domain);
      const u=ups.find(x=>x.id===id); if(!u)return false;
      company.money-=u.cost; company.upgrades[id]=true;
      state.log.push('⬆️ 升级：'+u.label+'（-'+fmt$(u.cost)+'）');
      return true;
    },

    /* 结局 */
    endings:()=>{
      const list=[];
      const c=company;
      const defs=domain.endings||[];
      defs.forEach(d=>{
        if(!c._doneEndings||!c._doneEndings.includes(d.id))
        if(d.check(c))list.push(d);
      });
      // 破产结局（额外）
      if(c._bankrupt&&!list.find(x=>x.id==='bankrupt')){
        list.push({id:'bankrupt',n:'破产清算',d:'资金耗尽，公司被清算，留下一纸欠债',check:()=>false});
      }
      return list;
    },
    recordEnding:id=>{ if(!company._doneEndings)company._doneEndings=[]; company._doneEndings.push(id); },
  };
}

/* ---------- 存档序列化 ---------- */
function tycoonSave(state){
  return{
    ver:2,
    domain:state.domain.key,
    company:state.company,
    project:state.project,
    loopPhase:state.loopPhase,
    log:state.log.slice(-40),
  };
}
