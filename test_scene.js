// 发展国 · 场景层（Phaser）无头测试
// 目的：验证 common/scene.js 对外接口（bind/update/pulse/doJump/animateProgressTo）
//      在无 Phaser / 无 DOM 环境下的降级行为，且不抛异常。
'use strict';
const fs = require('fs');
const vm = require('vm');

// 模拟极简 DOM（供 scene.js 顶部的 window/document 探测，走降级分支）
const fakeDoc = { getElementById: (id)=>({ style:{}, clientWidth:640, querySelector:null }) };
const sandbox = {
  window:{ Phaser: undefined },   // 故意不提供 Phaser → 走降级
  document: fakeDoc,
  console,
  Math,
};
sandbox.global = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

let code = fs.readFileSync('d:/work/GitHub/tycoon/tycoon-dev/common/scene.js','utf8');
vm.runInContext(code, sandbox, {filename:'scene.js'});

const scene = (sandbox.window && sandbox.window.scene) || sandbox.scene;
let pass=0, fail=0;
function assert(c,m){ if(!c){ console.error('❌ FAIL:', m); fail++; } else { console.log('  ✓', m); pass++; } }

console.log('=== scene.js 接口（降级模式，无 Phaser） ===');
assert(typeof scene === 'object' && scene!==null, '导出 scene 对象');
assert(typeof scene.bind==='function', 'bind() 是函数');
assert(typeof scene.update==='function', 'update() 是函数');
assert(typeof scene.pulse==='function', 'pulse() 是函数');
assert(typeof scene.doJump==='function', 'doJump() 是函数');
assert(typeof scene.animateProgressTo==='function', 'animateProgressTo() 是函数');

// 降级路径：Phaser 未加载 → bind 应安全返回 false，不抛异常
let bindResult;
let threw = false;
try { bindResult = scene.bind('scene'); } catch(e){ threw = true; }
assert(!threw, 'bind() 无异常（Phaser 缺失时降级）');
assert(bindResult===false, 'Phaser 缺失时 bind 返回 false（降级占位）');

// 其它方法在降级态下应静默 no-op，不抛异常
threw=false; try { scene.update({tier:2,phase:'develop',progress:.5}); scene.pulse(); scene.doJump(); scene.animateProgressTo(1,1800); } catch(e){ threw=true; }
assert(!threw, 'update/pulse/doJump/animateProgressTo 在降级态静默 no-op');

console.log('\n─── scene 层: '+pass+' 通过, '+fail+' 失败 ───');
if(fail>0) process.exit(1);
console.log('🎉 scene 层接口全部通过！');
