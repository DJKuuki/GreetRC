export const categories=['全部','新手入门','疑难杂症','教程分享','测评推荐','飞友秀场','装备改装','建议反馈'];
const titles=['第一套穿越机配置，应该从哪里开始？','记录一次完整的装机流程','想聊聊数字图传的使用体验','周末飞行练习记录与复盘','关于模拟器练习的一些小问题','机架布局与走线方案分享','给社区页面的一点建议','小尺寸电影机的搭配思路','如何整理自己的调参记录？','今天完成了第一次装机','分享我的桌面维护工具','从练习到实飞的学习计划','接收机天线布局展示','我的轻量化配置清单','想给新手做一份入门导航','飞行记录应该保留哪些信息？','关于电池收纳的讨论','为下一套配置做准备'];
export const posts=titles.map((title,i)=>({id:`demo-${i+1}`,title,category:categories[1+i%7],author:['山风','青禾','远山','飞行笔记','小航'][i%5],date:`2026-09-${String(20-Math.floor(i/2)).padStart(2,'0')}`,body:'这是一篇用于展示论坛排版的示例帖子。\n\n这里可以写下问题背景、配置情况和自己的想法，也可以附上图片，与其他飞友交流。\n\n正文、评论和作者均为本地示例，不包含原站的真实讨论内容。',replies:i%6,views:120+i*37,pinned:i<2,tags:['装机分享','新手提问','飞行记录'][i%3]}));
export const scenes=['全部','自由花飞','竞速','电影机','远航','其他'];
export const builds=Array.from({length:12},(_,i)=>({id:`build-${i+1}`,title:['风行 5 · 日常花飞','轻羽 3.5 · 电影机','追风 5 · 竞速练习','远山 7 · 探索配置','小满 2.5 · 轻巧出行','晨光 5 · 入门训练'][i%6]+(i>=6?' II':''),scene:['自由花飞','电影机','竞速','远航','电影机','自由花飞'][i%6],size:[5,3.5,5,7,2.5,5][i%6],kv:[1950,2450,2100,1300,4500,1800][i%6],battery:i%3===1?'4S':'6S',author:['山风','青禾','远山'][i%3],date:`2026-09-${String(20-i).padStart(2,'0')}`,description:'用于展示整机配置卡片与部件清单的本地示例。',body:'整机配置以结构清晰、便于维护为设计目标。这里展示配置说明、搭建过程和飞行体验的排版。',cost:1600+i*180}));
export const battles=Array.from({length:6},(_,i)=>({id:`vs-${i+1}`,title:['第一套花飞配置，你会选择哪一个？','轻巧出行，还是更充裕的动力？','练习用机的两种搭配思路','同尺寸电影机，哪种方案更合适？','日常维护与重量，如何取舍？','给下一次装机投一票'][i],left:builds[i].id,right:builds[(i+1)%12].id,status:i===4?'已结束':i===5?'待开始':'投票中',tag:['新手友好','轻量化','性价比'][i%3],votes:[14+i*3,9+i*2]}));
export const crashes=Array.from({length:6},(_,i)=>({id:`crash-${i+1}`,title:['一次低空练习后的复盘','为机臂更换做一份记录','外场训练中的一次小意外','重新整理走线与固定方式','桨叶损坏后的维护笔记','完成维修，准备重新起飞'][i],size:i%2?3.5:5,damage:['轻微','中度','严重'][i%3],status:i%2?'维修中':'已修复',author:['山风','青禾'][i%2],date:`2026-09-${18-i}`,body:'这是一条本地复盘示例，用于展示事件经过、损坏部位、维修过程和经验总结的页面结构。'}));
export const sections=[
 {id:'start',title:'新手起飞前',label:'入门导航',desc:'建立整体认知，找到适合自己的学习路线。',articles:[['configuration-logic','选配逻辑总览'],['remote-controller','遥控器'],['simulator','模拟器']]},
 {id:'parts',title:'选配与部件',label:'部件资料',desc:'按部件拆开看，认识每个零件的作用与参数。',articles:[['rack','机架'],['telemetry','图传'],['brushless-motor','无刷电机'],['propeller','螺旋桨'],['flight-controller','飞塔 / AIO'],['gps','GPS'],['receiver','接收机'],['battery','电池'],['charger','充电器']]},
 {id:'build',title:'组装与调试',label:'装机实践',desc:'从零件到整机，用有序的步骤串起装机流程。',articles:[['assembly/beginner','5 寸花飞组装教程'],['assembly/beginner2','DJI O4 Pro 进阶装机'],['assembly/beginner3','3.5 寸圈圈机组装'],['debug','基础调试'],['betaflight-modes','BF 模式对照'],['betaflight-web-flash','Web 版固件烧写']]},
 {id:'compliance',title:'合规与延伸资源',label:'延伸阅读',desc:'飞行前需要了解的登记、安全与资料入口。',articles:[['safety','安全合规指南'],['uom-drone-registration','UOM 注册与登记']]},
];
export const articles=sections.flatMap(s=>s.articles.map(([path,title])=>({path,title,section:s.id})));
export const downloadCategories=['地面站','电调工具','遥控系统','黑匣子分析','驱动工具','官网集合'];
export const downloads=[['tool-1','Betaflight Configurator','地面站','BF'],['tool-2','INAV Configurator','地面站','IN'],['tool-3','KISS GUI','地面站','KS'],['tool-5','Mission Planner','地面站','MP'],['tool-6','ESC Configurator','电调工具','ESC'],['tool-7','AM32 Configurator','电调工具','AM'],['tool-8','EdgeTX Companion','遥控系统','TX'],['tool-9','ExpressLRS Configurator','遥控系统','EL'],['tool-10','Blackbox Explorer','黑匣子分析','BB'],['tool-11','USB 驱动工具','驱动工具','USB'],['tool-12','飞控与遥控系统资料','官网集合','WEB']].map(([id,title,category,mark])=>({id,title,category,mark}));

const officialDownloads = [
  ['https://betaflight.com/download', '飞控调参与固件更新，官网提供网页版与下载指引。'],
  ['https://github.com/iNavFlight/inav-configurator/releases', 'INAV 官方配置器发布页，按操作系统选择安装包。'],
  ['https://github.com/flyduino/kiss-gui/releases', 'KISS 飞控官方 GUI 发布与下载。'],
  ['https://ardupilot.org/planner/docs/mission-planner-installation.html', 'ArduPilot 官方地面站安装指南与 Mission Planner 下载入口。'],
  ['https://esc-configurator.com/', '在线配置电调与更新固件，无需下载桌面客户端。'],
  ['https://am32.ca/', 'AM32 官方在线配置器与固件资源。'],
  ['https://edgetx.org/getedgetx/', 'EdgeTX Companion、遥控器固件与配套资源下载。'],
  ['https://www.expresslrs.org/quick-start/installing-configurator/', 'ExpressLRS 官方配置器安装说明与发布入口。'],
  ['https://github.com/betaflight/blackbox-log-viewer/releases', 'Betaflight 官方黑匣子分析工具与网页版入口。'],
  ['https://github.com/ImpulseRC/ImpulseRC_Driver_Fixer', 'ImpulseRC 官方 USB 驱动修复工具。'],
  ['https://ardupilot.org/', 'ArduPilot 官方飞控文档、软件与社区资源。']
];
downloads.forEach((tool, index)=>{[tool.href, tool.description] = officialDownloads[index];});
