
// 发展国 · 无头逻辑测试
// 目的：验证引擎 4 个域核心循环、结局检测、事件、升级

global.window = {};
const fs = require('fs');

// 用 vm 模块加载文件（避免 eval 作用域问题）
const vm = require('vm');
const context = vm.createContext(global);
function loadFile(p){
  const code = fs.readFileSync(p,'utf8');
  vm.runInContext(code, context, {filename:p});
}

loadFile('d:/work/GitHub/tycoon/tycoon-dev/common/engine.js');
loadFile('d:/work/GitHub/tycoon/tycoon-dev/common/profiles.js');

let pass = 0, fail = 0;
function assert(cond, msg){
  if(!cond){ console.error('❌ FAIL:', msg); fail++; }
  else { console.log('  ✓', msg); pass++; }
}

console.log('=== Profiles 验证 ===');
const profs = global.window.PROFILES;
assert(profs && Object.keys(profs).length===4, '加载 4 个域');

function runFullCycle(domainKey, label){
  console.log('\n=== ' + label + ' (' + domainKey + ') ===');
  const game = global.createTycoonGame(domainKey, profs);
  const st = game.state, c = st.company, d = st.domain;

  assert(c.money>0, '初始资金 > 0');
  assert(c.month===1, '初始月份 = 1');
  assert(st.loopPhase==='greenlight', '初始 greenlight');
  assert(st.log.length>0, '有日志');

  // 立项
  const platKey = Object.keys(d.platform)[0];
  game.greenlight({platform:platKey,genre:d.genres[0],audience:d.audience[0],
    monetization:Object.keys(d.monetization)[0],
    ambition:Object.keys(d.ambition)[0]});
  assert(st.project!==null, '立项成功');
  assert(st.loopPhase==='develop', '进入 develop');
  assert(st.project.attrs.gameplay>0, '属性已生成');
  console.log('  立项:', st.project.name, st.project.platform, st.project.genre, 'attrs:', JSON.stringify(st.project.attrs));

  // 开发
  const m0=c.money;
  game.develop({dev:5,art:5,qa:5,mkt:5});
  assert(st.loopPhase==='ship', '进入 ship');
  assert(c.month>1, '月份推进');
  assert(c.money<=m0, '资金消耗');
  console.log('  开发后: 月份',c.month,'资金',c.money,'attrs:',JSON.stringify(st.project.attrs));

  // 发行
  game.ship(5);
  assert(st.loopPhase==='perform', '进入 perform');
  assert(st.lastResult!==null, '有发行结果');
  const score = st.lastResult.score;
  assert(score>=0&&score<=10, '评分 0-10 ('+score+')');
  assert(st.lastResult.sales>0, '销量 > 0 ('+st.lastResult.sales+')');
  assert(st.lastResult.firstRevenue>=0, '首月收入 >= 0 ('+st.lastResult.firstRevenue+')');
  console.log('  发行: 评分',score,'销量',st.lastResult.sales,'收入',st.lastResult.firstRevenue);

  // 多个月推进
  for(let i=0;i<5;i++){ const om=c.month; game.nextMonth(); assert(c.month>om,'月份推进 '+c.month); }
  console.log('  5月后: 月份',c.month,'资金',c.money,'粉丝',c.fans,'声望',c.rep.toFixed(1));

  // 再走一轮
  game.greenlight({platform:platKey,genre:d.genres[1]||d.genres[0],audience:d.audience[0],
    monetization:Object.keys(d.monetization)[0],ambition:Object.keys(d.ambition)[0]});
  game.develop({dev:7,art:7,qa:7,mkt:7});
  game.ship(7);
  assert(st.loopPhase==='perform','第二轮 perform');
  assert(c.projectsShipped>=2,'累计发行 >= 2 ('+c.projectsShipped+')');
  console.log('  第二轮发行成功, 累计:',c.projectsShipped);

  // 升级
  const ups = global.restate(c, d);
  console.log('  可购升级:', ups.map(u=>u.label+'('+fmt_$(u.cost)+')').join(', ') || '无');
  if(ups.length>0){
    const ok = game.buyUpgrade(ups[0].id);
    assert(ok===true, '购买升级成功: '+ups[0].label);
  }

  // 事件系统测试（跳过 3 个月让 eventCd 到 0）
  for(let i=0;i<3;i++) game.nextMonth();

  // 结局检测
  c.money = 25000000; c.projectsShipped = 3; c.rep = 96; c.month = 48; c.fans = 600000;
  const ends = game.endings();
  assert(ends.length>0, '达成结局, 数量:'+ends.length);
  console.log('  达成结局:', ends.map(e=>e.n).join(', '));
  ends.forEach(e=>game.recordEnding(e.id));
  const ends2 = game.endings();
  assert(ends2.length===0, '结局不重复');

  console.log('✅ '+label+' 全部通过');
}

// fmt$ 辅助（engine.js 里的）
function fmt_$(v){ return '¥'+Math.round(v).toLocaleString(); }

runFullCycle('game','游戏发展国');
runFullCycle('app','程序发展国');
runFullCycle('ai','AI发展国');
runFullCycle('design','设计发展国');

// 办公室系统测试
console.log('\n=== 办公室系统 ===');
const game2 = global.createTycoonGame('game', profs);
const c2 = game2.state.company;
// 初始无办公室
assert(c2.office===null, '初始无办公室');
// 租车库
const ok1 = game2.rentOffice('garage');
assert(ok1===true, '租车库成功');
assert(c2.office.key==='garage', '办公室 key=garage');
assert(c2.office.cap===3, '车库容量=3');
console.log('  租车库:', c2.office.name, '容量', c2.office.cap, '月租', c2.office.rent);
// 升小型办公室
const ok2 = game2.rentOffice('small');
assert(ok2===true, '升小型办公室成功');
assert(c2.office.cap===8, '小型办公室容量=8');

// 员工系统测试
console.log('\n=== 员工系统 ===');
const hire1 = game2.hire('dev');
assert(hire1.ok===true, '招 dev 成功');
assert(c2.staffList.length===1, '员工列表有1人');
console.log('  招了:', c2.staffList[0].role, 'Lv', c2.staffList[0].lvl, '月薪', c2.staffList[0].salary);
// 升级员工
const upOk = game2.upgradeEmp(c2.staffList[0].id);
assert(upOk===true, '升级员工成功');
assert(c2.staffList[0].lvl===2 || c2.staffList[0].lvl===3, '员工级别提升');
console.log('  升级后:', 'Lv', c2.staffList[0].lvl, '月薪', c2.staffList[0].salary);
// 团队能力
const team = game2.getTeam();
assert(team.dev>=2, '团队 dev 能力 >= 2');
console.log('  团队能力:', JSON.stringify(team));
// 解雇
const fireOk = game2.fire(c2.staffList[0].id);
assert(fireOk===true, '解雇员工成功');
assert(c2.staffList.length===0, '员工列表清空');

// 月度成本测试
console.log('\n=== 月度成本 ===');
const upk = global.monthlyUpkeep(c2, game2.state.domain);
assert(upk > 0, '月度成本 > 0 ('+upk+')');
console.log('  月度成本(含办公室租金):', upk);

// 破产测试
console.log('\n=== 破产系统 ===');
c2.money = -1000;
c2.loan = 0;
assert(global.isBankrupt(c2)===true, '资金<0且无贷款=破产');
c2.loan = 50000;
assert(global.isBankrupt(c2)===false, '有贷款=不破产');

// 事件系统测试
console.log('\n=== 事件系统 ===');
const game3 = global.createTycoonGame('game', profs);
const c3 = game3.state.company;
// 触发事件（eventCd 初值3，3个月后eventCd=0会抽签）
game3.state.log=[];
for(let i=0;i<5;i++) game3.nextMonth();
console.log('  5月后日志条数:', game3.state.log.length);
assert(game3.state.log.length>0, '有日志');

// 存档测试
const sd = global.tycoonSave(game2.state);
assert(sd.ver===2, '存档 ver=2');
assert(sd.domain==='game', '存档 domain=game');
assert(sd.company.office!==null, '存档包含办公室');
console.log('  存档包含办公室:', sd.company.office.name, '员工数:', sd.company.staffList.length);

console.log('\n─── 总结: '+pass+' 通过, '+fail+' 失败 ───');
if(fail>0) process.exit(1);
console.log('🎉 全部通过！');
