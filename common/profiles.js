/* ============================================================================
 * 发展国 · 产品域 profile（换皮数据层）
 * ----------------------------------------------------------------------------
 * 每款游戏 = 一份 profile。引擎 engine.js 零改动复用。
 * 本土化文案：把「游戏公司」语境换成对应互联网/科技行业。
 * ==========================================================================*/

/* ---------- 通用：平台 / 受众 / 货币化（按域可覆盖） ---------- */
const PLATFORMS={
  h5:  {name:'H5网页',marketShare:1.0,royaltyRate:0.7},
  app: {name:'手机App',marketShare:1.4,royaltyRate:0.7},
  pc:  {name:'PC端',marketShare:0.9,royaltyRate:0.85},
  mini:{name:'小程序',marketShare:1.2,royaltyRate:0.6},
};
const AUD={casual:'大众',core:'硬核',kids:'亲子',pro:'专业'};
const MONO={
  f2p:{name:'广告+内购',unit:2,royaltyRate:0.8,payingRate:0.08,isSub:false,decayPerMonth:0.8},
  buy:{name:'买断制',unit:30,royaltyRate:0.7,payingRate:0.12,isSub:false,decayPerMonth:0.6},
  sub:{name:'订阅制',unit:8,royaltyRate:0.75,payingRate:0.05,isSub:true,decayPerMonth:0.9},
  onp:{name:'项目定制',unit:200,royaltyRate:0.9,payingRate:0.02,isSub:false,decayPerMonth:0.4},
};

/* ---------- 结局定义（达成条件函数） ---------- */
const ENDS={
  tycoon:c=>c.money>=20000000&&c.projectsShipped>=3,      // 千万资金+3款产品
  legend:c=>c.rep>=95&&c.month>=36,                          // 声望95+3年
  star:  c=>(c.fans||0)>=500000,                              // 50万粉丝
};

/* ================= 1 · 游戏发展国 ================= */
const GAME_DOMAIN={
  key:'game', name:'游戏', goods:'游戏', adjective:'爆款',
  vocab:{good:'游戏',unit:'款',company:'游戏工作室'},
  platform:{...PLATFORMS},
  audience: Object.keys(AUD),
  genres: ['RPG','动作','休闲','模拟','解谜','SLG'],
  compat: {'RPG|casual':2,'dongzuo|core':2,'SLG|pro':1.5,'xiuxian|kids':2,'moni|casual':1,'jiemi|core':1.5},
  platformGenreAffinity:{ h5:{xiuxian:1,rpg:-1}, app:{rpg:1,slg:1}, pc:{dongzuo:1,rpg:1}, mini:{xiuxian:2,kids:1} },
  monetization:{...MONO},
  ambition:{ s:{costMult:.5,timeMult:.6}, m:{costMult:1,timeMult:1}, l:{costMult:2.2,timeMult:1.8} },
  offices:{
    garage:{name:'车库',tier:1,cap:3,rent:2000},
    small: {name:'小型办公室',tier:2,cap:8,rent:8000},
    big:   {name:'大型办公室',tier:3,cap:20,rent:30000},
    hq:    {name:'旗舰总部',tier:4,cap:50,rent:100000},
  },
  upkeep:3000,
  trend:{cycleMonths:6,bonusOnHit:0.5,bonusOnMiss:-0.3,weights:{genre:0,platform:0,audience:0}},
  events:[
    {cat:'good',chance:.12,effect:0,text:'📈 某主播玩你家游戏，单周销量翻倍！(+¥20万)',money:200000},
    {cat:'bad',chance:.12,effect:0,text:'🐛 重大 bug 集中爆发，口碑下滑',rep:-8},
    {cat:'bad',chance:.08,effect:0,text:'📜 被大厂抄袭，首发热度被截胡',money:-150000},
    {cat:'good',chance:.1,effect:0,text:'🎮 海外同步发行，外汇入账',money:120000,fans:20000},
    {cat:'neutral',chance:.15,effect:0,text:'🏆 冲一下版号，排队等待'},
    {cat:'good',chance:.08,effect:0,text:'🌟 拿到一笔游戏基金投资',money:500000},
  ],
  upgradeTree:{
    rd:[
      {id:'rd_app',label:'App 研发组',cost:200000,requires:null},
      {id:'rd_pc',label:'PC 研发组',cost:350000,requires:'rd_app'},
      {id:'rd_3a',label:'3A 工作室',cost:800000,requires:'rd_pc'},
    ],
    mkt:[
      {id:'mkt_social',label:'社媒营销团队',cost:150000,requires:null},
      {id:'mkt_influencer',label:'主播合作',cost:400000,requires:'mkt_social'},
    ],
    biz:[
      {id:'biz_ip',label:'自有 IP 库',cost:600000,requires:null},
      {id:'biz_global',label:'全球发行',cost:1000000,requires:'biz_ip'},
    ],
  },
  endings:[
    {id:'tycoon',n:'游戏大亨',d:'千万资金 + 3 款游戏，你上市了',check:ENDS.tycoon},
    {id:'legend',n:'行业传奇',d:'声望 95，整个行业都认你这块招牌',check:ENDS.legend},
    {id:'star',n:'顶流 IP 厂',d:'50 万粉丝，你家 IP 全网顶流',check:ENDS.star},
    {id:'hoF',n:'名人堂',d:'多款作品评分 ≥32 入选名人堂，可自由出续作',check:c=>{
      // 简化判定：声望高 + 多作品（名人堂门槛的代理指标）
      return c.rep>=88 && c.projectsShipped>=4;
    }},
  ],
};

/* ================= 2 · 程序发展国 ================= */
const APP_DOMAIN={
  key:'app', name:'程序', goods:'软件/应用', adjective:'神器',
  vocab:{good:'产品',unit:'款',company:'软件团队'},
  platform:{...PLATFORMS},
  audience: Object.keys(AUD),
  genres: ['工具','社交','电商','效率','内容'],
  compat: {'gongju|pro':2,'shaojiao|casual':2,'xiao|pro':1.5,'dianshang|casual':1,'neirong|casual':2},
  platformGenreAffinity:{ app:{shaojiao:1,dianshang:1,gongju:0}, mini:{xiao:2,gongju:1}, h5:{neirong:1}, pc:{gongju:1} },
  monetization:{...MONO},
  ambition:{ s:{costMult:.5,timeMult:.6}, m:{costMult:1,timeMult:1}, l:{costMult:2.2,timeMult:1.8} },
  offices:{
    garage:{name:'车库',tier:1,cap:3,rent:2000},
    small: {name:'小型办公室',tier:2,cap:8,rent:8000},
    big:   {name:'大型办公室',tier:3,cap:20,rent:30000},
    hq:    {name:'旗舰总部',tier:4,cap:50,rent:100000},
  },
  upkeep:3000,
  trend:{cycleMonths:6,bonusOnHit:0.5,bonusOnMiss:-0.3,weights:{genre:0,platform:0,audience:0}},
  events:[
    {cat:'good',chance:.12,effect:0,text:'🚀 被一家大厂收购核心团队 +¥30万',money:300000},
    {cat:'bad',chance:.1,effect:0,text:'🐞 线上事故，赔付违约金',money:-200000},
    {cat:'good',chance:.1,effect:0,text:'⭐ 入选应用商店精选，下载暴涨',money:80000,fans:30000},
    {cat:'bad',chance:.08,effect:0,text:'📉 竞品免费，用户流失',fans:-20000},
    {cat:'good',chance:.08,effect:0,text:'🤝 拿到一笔 A 轮融资',money:600000},
    {cat:'neutral',chance:.15,effect:0,text:'📝 过一下等保合规，排队中'},
  ],
  upgradeTree:{
    rd:[
      {id:'rd_api',label:'开放平台 API',cost:250000,requires:null},
      {id:'rd_cloud',label:'云服务中台',cost:400000,requires:'rd_api'},
      {id:'rd_edge',label:'端云一体引擎',cost:800000,requires:'rd_cloud'},
    ],
    mkt:[
      {id:'mkt_aso',label:'ASO 优化组',cost:150000,requires:null},
      {id:'mkt_kol',label:'达人投放',cost:400000,requires:'mkt_aso'},
    ],
    biz:[
      {id:'biz_b2b',label:'B 端业务线',cost:500000,requires:null},
      {id:'biz_oversea',label:'出海发行',cost:900000,requires:'biz_b2b'},
    ],
  },
  endings:[
    {id:'tycoon',n:'独角兽程序厂',d:'千万资金 + 3 款产品，估值破亿',check:ENDS.tycoon},
    {id:'legend',n:'工具之王',d:'声望 95，开发者圈都认你这块招牌',check:ENDS.legend},
    {id:'star',n:'国民 App 缔造者',d:'50 万用户，你家产品人手一个',check:ENDS.star},
  ],
};

/* ================= 3 · AI 发展国 ================= */
const AI_DOMAIN={
  key:'ai', name:'AI', goods:'AI 产品', adjective:'神器',
  vocab:{good:'模型/产品',unit:'款',company:'AI 实验室'},
  platform:{...PLATFORMS},
  audience: Object.keys(AUD),
  genres: ['大模型','Agent','多模态','搜索','办公'],
  compat: {'daxing|pro':2,'agent|casual':2,'bangong|pro':1.5,'duomotai|core':1.5,'sousuo|casual':1},
  platformGenreAffinity:{ pc:{daxing:2,bangong:1}, app:{agent:1,duomotai:1}, h5:{sousuo:1} },
  monetization:{...MONO},
  ambition:{ s:{costMult:.5,timeMult:.6}, m:{costMult:1,timeMult:1}, l:{costMult:3,timeMult:2} },
  offices:{
    garage:{name:'实验室（合租）',tier:1,cap:5,rent:5000},
    small: {name:'小型实验室',tier:2,cap:12,rent:20000},
    big:   {name:'中型 AI 实验室',tier:3,cap:30,rent:60000},
    hq:    {name:'旗舰 AI 中心',tier:4,cap:80,rent:200000},
  },
  upkeep:6000,   // AI 烧钱，维护更高
  trend:{cycleMonths:3,bonusOnHit:0.7,bonusOnMiss:-0.5,weights:{genre:0,platform:0,audience:0}}, // 风口轮转快
  events:[
    {cat:'good',chance:.14,effect:0,text:'🧠 跑出一个 SOTA 模型，论文上顶会',money:200000,rep:6},
    {cat:'bad',chance:.14,effect:0,text:'🔥 显卡不够用，算力账单爆表',money:-300000},
    {cat:'bad',chance:.08,effect:0,text:'📦 核心模型权重泄露，被同行抄走',rep:-10},
    {cat:'good',chance:.1,effect:0,text:'🤖 某大厂找上门要授权 API +¥40万',money:400000},
    {cat:'neutral',chance:.15,effect:0,text:'⚖️ 过一下算法备案，排队中'},
    {cat:'good',chance:.08,effect:0,text:'💰 拿到一笔 AI 专项基金',money:500000},
  ],
  upgradeTree:{
    rd:[
      {id:'rd_gpu',label:'自建算力集群',cost:500000,requires:null},
      {id:'rd_multimodal',label:'多模态团队',cost:700000,requires:'rd_gpu'},
      {id:'rd_agent',label:'Agent 平台',cost:900000,requires:'rd_multimodal'},
    ],
    mkt:[
      {id:'mkt_paper',label:'学术 PR 组',cost:200000,requires:null},
      {id:'mkt_eco',label:'开发者生态',cost:450000,requires:'mkt_paper'},
    ],
    biz:[
      {id:'biz_api',label:'API 商业化',cost:400000,requires:null},
      {id:'biz_model',label:'模型出海',cost:1000000,requires:'biz_api'},
    ],
  },
  endings:[
    {id:'tycoon',n:'AI 巨擘',d:'千万资金 + 3 款 AI 产品，你定义了行业',check:ENDS.tycoon},
    {id:'legend',n:'顶流实验室',d:'声望 95，全球都认你这块招牌',check:ENDS.legend},
    {id:'star',n:'模型顶流',d:'50 万开发者，你家 API 全网在用',check:ENDS.star},
  ],
};

/* ================= 4 · 设计发展国 ================= */
const DESIGN_DOMAIN={
  key:'design', name:'设计', goods:'设计产品/服务', adjective:'美作',
  vocab:{good:'设计作品',unit:'款',company:'设计工作室'},
  platform:{...PLATFORMS},
  audience: Object.keys(AUD),
  genres: ['UI','品牌','插画','国潮','3D'],
  compat: {'guchao|casual':2,'ui|pro':2,'pinpai|pro':1.5,'chahua|kids':2,'sd|core':1.5},
  platformGenreAffinity:{ h5:{chahua:1,guchao:1}, app:{ui:1}, pc:{sd:2,pinpai:1}, mini:{guchao:1} },
  monetization:{...MONO},
  ambition:{ s:{costMult:.5,timeMult:.6}, m:{costMult:1,timeMult:1}, l:{costMult:2,timeMult:1.8} },
  offices:{
    garage:{name:'工作室（合租）',tier:1,cap:4,rent:1500},
    small: {name:'小型工作室',tier:2,cap:10,rent:6000},
    big:   {name:'中型设计中心',tier:3,cap:25,rent:20000},
    hq:    {name:'旗舰设计总部',tier:4,cap:60,rent:80000},
  },
  upkeep:2500,
  trend:{cycleMonths:6,bonusOnHit:0.5,bonusOnMiss:-0.3,weights:{genre:0,platform:0,audience:0}},
  events:[
    {cat:'good',chance:.12,effect:0,text:'🎨 设计作品拿下一个国际奖 +¥15万',money:150000,rep:4},
    {cat:'bad',chance:.1,effect:0,text:'📋 客户反复改需求，成本超支',money:-80000},
    {cat:'good',chance:.1,effect:0,text:'🌸 国潮 IP 联名，周边卖爆',money:120000,fans:15000},
    {cat:'neutral',chance:.15,effect:0,text:'✏️ 攒一下作品集，冲奖中'},
    {cat:'good',chance:.08,effect:0,text:'🤝 一家品牌找你们做长期设计顾问',money:200000},
  ],
  upgradeTree:{
    rd:[
      {id:'rd_3d',label:'3D 渲染组',cost:200000,requires:null},
      {id:'rd_motion',label:'动效组',cost:300000,requires:'rd_3d'},
      {id:'rd_ai',label:'AI 设计工具',cost:500000,requires:'rd_motion'},
    ],
    mkt:[
      {id:'mkt_brand',label:'品牌 IP 运营',cost:150000,requires:null},
      {id:'mkt_social',label:'社媒矩阵',cost:350000,requires:'mkt_brand'},
    ],
    biz:[
      {id:'biz_ip',label:'自有 IP 授权',cost:400000,requires:null},
      {id:'biz_global',label:'海外品牌合作',cost:800000,requires:'biz_ip'},
    ],
  },
  endings:[
    {id:'tycoon',n:'设计帝国',d:'千万资金 + 3 款设计产品，你定义了审美',check:ENDS.tycoon},
    {id:'legend',n:'设计大神',d:'声望 95，整个行业都认你这块招牌',check:ENDS.legend},
    {id:'star',n:'国民 IP 厂',d:'50 万粉丝，你家 IP 全网出圈',check:ENDS.star},
  ],
};

/* ---------- 导出：所有产品域（换皮就加这里） ---------- */
window.PROFILES={game:GAME_DOMAIN,app:APP_DOMAIN,ai:AI_DOMAIN,design:DESIGN_DOMAIN};
