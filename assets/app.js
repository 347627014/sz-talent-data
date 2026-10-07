/* 深圳分公司网运线人才管理平台 */
(function () {
'use strict';

var D = window.__DATA__;
if (!D) { document.body.innerHTML = '<p style="padding:40px">数据文件 data.js 未加载成功</p>'; return; }

var DT = D.dict, PEOPLE = D.people, TAGS = D.tags;
var CAT_NAME = DT.cat;                       // 认证 / 实战 / 理论 / 通用能力 / 实操
var CAT_CLS  = ['b-cat0', 'b-cat1', 'b-cat2', 'b-cat3', 'b-cat4'];
var LVL_CLS  = { 'L1': 'b-l1', 'L2': 'b-l2', 'L3': 'b-l3', 'L4': 'b-l4' };
var BAR_CLS  = { 1: 'g1', 2: 'g2', 3: 'g3', 4: 'g4' };
var LVNAME   = ['', 'L1', 'L2', 'L3', 'L4'];
var EXAMS    = D.exams || [];
var M = window.__MATCH__ || {
  updated: '', note: '',
  l1: { total: 0, matched: 0, rate: 0, rows: [] },
  l2: { total: 0, matched: 0, rate: 0, rows: [] }
};

/* ============================ 基础工具 ============================ */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function dv(k, i) { return DT[k] && DT[k][i] != null ? DT[k][i] : ''; }
function fmt(n) { return (n || 0).toLocaleString('zh-CN'); }
function maskName(n) {
  n = String(n || '');
  if (n.length <= 1) return n;
  return n.charAt(0) + new Array(n.length).join('*');
}
function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function nowTs() { return Math.floor(Date.now() / 1000); }
function parseDate(s) {
  if (!s || /^9999/.test(s)) return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function daysLeft(s) {
  var d = parseDate(s);
  if (!d) return null;
  return Math.round((d - today()) / 86400000);
}
function dateText(s) {
  if (!s) return '—';
  if (/^9999/.test(s)) return '长期有效';
  return s;
}
function examStatusClass(st) {
  if (!st) return '';
  if (st.indexOf('报名中') >= 0) return 'status-reg';
  if (st.indexOf('填报中') >= 0) return 'status-fill';
  if (st.indexOf('进行中') >= 0) return 'status-run';
  if (st.indexOf('过期') >= 0) return 'status-expired';
  return '';
}

/* 人员对象 */
function P(i) {
  var a = PEOPLE[i];
  return {
    i: i, code: a[0], name: a[1],
    dept: dv('dept', a[2]), full: dv('full', a[3]),
    grade: dv('grade', a[4]), start: dv('date', a[5]), end: dv('date', a[6]),
    status: dv('status', a[7]),
    gradeLvl: a[8], maxTagLvl: a[9], bestLvl: a[10], hasL3: !!a[11],
    expert: a[12] ? {
      level: dv('explevel', a[12][0]), cat: dv('expcat', a[12][1]),
      sub: dv('expsub', a[12][2]), dir: dv('expdir', a[12][3]), unit: dv('dept', a[12][4])
    } : null,
    tagIdx: a[13]
  };
}
/* 标签对象 */
function T(i) {
  var t = TAGS[i];
  return {
    i: i, kind: dv('kind', t[0]), lvl: dv('lvl', t[1]),
    start: dv('date', t[2]), end: dv('date', t[3]),
    l1: dv('l1', t[4]), l2: dv('l2', t[5]), l3: dv('l3', t[6]),
    status: dv('status', t[7]), src: dv('src', t[8]), cat: t[9],
    cname: dv('cname', t[10])
  };
}

/* ============================ 预计算 ============================ */
var ALL = PEOPLE.map(function (_, i) { return i; });
var IDX_BY_CODE = {};
ALL.forEach(function (i) { IDX_BY_CODE[PEOPLE[i][0]] = i; });
var NAME_LOWER = PEOPLE.map(function (p) { return String(p[1] || '').toLowerCase(); });

var CERTED   = ALL.filter(function (i) { return !!PEOPLE[i][4]; });          // 有工程师等级认证
var L3_PEOPLE= ALL.filter(function (i) { return PEOPLE[i][10] >= 3; });      // L3 及以上
var EXPERTS  = ALL.filter(function (i) { return !!PEOPLE[i][12]; });
/* L3 达标口径（严格）：仅认「云网工程师等级」达到 L3。
   实战 / 理论 / 通用能力 类子标签等级不计入工程师 L3/L4 判定（对齐集团等级认证证书）。 */
var L3BASIS = 'grade';
function l3ok(p) { return p.gradeLvl >= 3; }
function expOkArr()  { return EXPERTS.filter(function (i) { return l3ok(P(i)); }); }
function expBadArr() { return EXPERTS.filter(function (i) { return !l3ok(P(i)); }); }
function setBasis(b) {
  L3BASIS = b;
  renderDashboard(); renderExpert(); renderDept();
}

/* 到期 */
function expiryList(within, source) {
  var out = [];
  (source === 'tag' ? ALL : CERTED).forEach(function (i) {
    var p = P(i);
    if (source === 'tag') {
      p.tagIdx.forEach(function (ti) {
        var t = T(ti);
        var d = daysLeft(t.end);
        if (d != null && d <= within) out.push({ i: i, end: t.end, d: d, kind: t.kind, lvl: t.lvl, cat: t.cat, tag: true });
      });
    } else {
      var d2 = daysLeft(p.end);
      if (d2 != null && d2 <= within) out.push({ i: i, end: p.end, d: d2, kind: p.grade, lvl: p.grade, cat: -1, tag: false });
    }
  });
  return out.sort(function (a, b) { return a.d - b.d; });
}
var EXPIRE_90 = expiryList(90, 'cert');

/* 部门聚合 */
function deptAgg() {
  var m = {};
  ALL.forEach(function (i) {
    var p = P(i), k = p.dept || '未匹配部门';
    if (!m[k]) m[k] = { name: k, n: 0, l3: 0, exp: 0, cert: 0 };
    m[k].n++;
    if (p.bestLvl >= 3) m[k].l3++;
    if (PEOPLE[i][12]) m[k].exp++;
    if (PEOPLE[i][4]) m[k].cert++;
  });
  return Object.keys(m).map(function (k) { return m[k]; })
    .sort(function (a, b) { return b.n - a.n; });
}
var DEPTS = deptAgg();
var HIDE_DEPT = ['派驻单位', '线路维护中心', '班子成员', '未匹配部门'];
function isHiddenDept(name) { return HIDE_DEPT.some(function (s) { return (name || '').indexOf(s) >= 0; }); }
var DEPTS_VISIBLE = DEPTS.filter(function (d) { return !isHiddenDept(d.name); });
var DEPT_NAMES = DEPTS_VISIBLE.map(function (d) { return d.name; });

/* 部门人才视图：部门口径统一采用「云网工程师认证明细」的所属部门（p.dept），
   与整体人才视图/专家/到期预警一致；不再单独维护部门视图目标清单。
   统计范围 = 明细中的全部云网工程师，按 p.dept 分组。 */
var DEPT_MEMBERS = {};   // dept -> [person index i]
var DEPT_AGG2 = {};       // dept -> {total, cert}
ALL.forEach(function (i) {
  var p = P(i), k = p.dept || '未匹配部门';
  (DEPT_MEMBERS[k] = DEPT_MEMBERS[k] || []).push(i);
  var b = DEPT_AGG2[k] = DEPT_AGG2[k] || { total: 0, cert: 0 };
  b.total++;
  if (PEOPLE[i][4]) b.cert++;
});
var DEPT_UNITS = Object.keys(DEPT_MEMBERS)
  .filter(function (u) { return !isHiddenDept(u); })
  .sort(function (a, b) { return DEPT_MEMBERS[b].length - DEPT_MEMBERS[a].length; });

/* 标签聚合（一次性扫描） */
var L1_COUNT = {}, KIND_COUNT = {}, CAT_COUNT = [0, 0, 0, 0], LVL_COUNT = {}, L2_BY_L1 = {};
TAGS.forEach(function (t) {
  var l1 = dv('l1', t[4]) || '未分类', l2 = dv('l2', t[5]) || '', k = dv('kind', t[0]) || '未分类';
  L1_COUNT[l1] = (L1_COUNT[l1] || 0) + 1;
  KIND_COUNT[k] = (KIND_COUNT[k] || 0) + 1;
  CAT_COUNT[t[9]]++;
  var lv = dv('lvl', t[1]); if (lv) LVL_COUNT[lv] = (LVL_COUNT[lv] || 0) + 1;
  if (!L2_BY_L1[l1]) L2_BY_L1[l1] = {};
  if (l2) L2_BY_L1[l1][l2] = 1;
});
function topObj(obj, n) {
  return Object.keys(obj).map(function (k) { return { name: k, v: obj[k] }; })
    .sort(function (a, b) { return b.v - a.v; }).slice(0, n);
}
var TOP_L1 = topObj(L1_COUNT, 12);
var TOP_KIND = topObj(KIND_COUNT, 15);

/* 等级分布 */
var GRADE_COUNT = {};
CERTED.forEach(function (i) { var g = dv('grade', PEOPLE[i][4]) || '未定级'; GRADE_COUNT[g] = (GRADE_COUNT[g] || 0) + 1; });
var GRADE_ROWS = Object.keys(GRADE_COUNT).map(function (k) {
  var m = /L([1-4])/.exec(k);
  return { name: k, v: GRADE_COUNT[k], lv: m ? +m[1] : 0 };
}).sort(function (a, b) { return a.lv - b.lv; });

/* ============================ 图表 ============================ */
function barChart(rows, opt) {
  opt = opt || {};
  var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
  return rows.map(function (r, n) {
    var cls = opt.cls ? opt.cls(r, n) : '';
    var pct = (r.v / max * 100).toFixed(1);
    var val = opt.val ? opt.val(r) : fmt(r.v) + ' 人';
    var clickCls = opt.click ? ' bar-click' : '';
    var actCls = (opt.active && opt.active(r, n)) ? ' bar-active' : '';
    return '<div class="bar-row ' + cls + clickCls + actCls + '"' +
      (opt.click ? ' data-bclick="' + opt.click + '" data-bidx="' + n + '" title="点击查看明细"' : '') + '>' +
      '<div class="bar-label" title="' + esc(r.name) + '">' + esc(r.name) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="bar-val">' + val + '</div></div>';
  }).join('');
}

function donut(items, size) {
  size = size || 168;
  var total = items.reduce(function (a, b) { return a + b.value; }, 0) || 1;
  var R = size / 2 - 14, cx = size / 2, cy = size / 2, sw = 26;
  var C = 2 * Math.PI * R, off = 0, seg = '';
  items.forEach(function (it) {
    if (!it.value) return;
    var len = C * it.value / total;
    seg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="' + it.color +
      '" stroke-width="' + sw + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) +
      '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
    off += len;
  });
  var pctTxt = '';
  if (items.length) {
    var big = items.slice().sort(function (a, b) { return b.value - a.value; })[0];
    pctTxt = '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="21" font-weight="700" fill="#16242F">' +
      fmt(big.value) + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 15) + '" text-anchor="middle" font-size="11" fill="#8296A6">' + esc(big.name) + '</text>';
  }
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' + seg + pctTxt + '</svg>';
}

function donutBlock(items, elChart, elLegend) {
  var total = items.reduce(function (a, b) { return a + b.value; }, 0) || 1;
  var legend = items.map(function (it) {
    return '<div class="lg-row"><span class="lg-dot" style="background:' + it.color + '"></span>' +
      '<span class="lg-name">' + esc(it.name) + '</span>' +
      '<span class="lg-num">' + fmt(it.value) + '</span>' +
      '<span class="lg-pct">' + (it.value / total * 100).toFixed(1) + '%</span></div>';
  }).join('');
  $(elChart).innerHTML = '<div class="donut-wrap"><div>' + donut(items) + '</div>' +
    '<div class="donut-legend">' + legend + '</div></div>';
  if (elLegend) $(elLegend).innerHTML = '';
}

/* ============================ 视图切换 ============================ */
var VIEW_META = {
  dashboard: ['整体视图', '深圳分公司网运线人才认证全景'],
  search:    ['人员认证检索与指引', '姓名 + 人力编码 双重验证，同步查看个人认证信息与认证缺口'],
  exam:      ['认证报名信息', '报名入口：人才云-个人中心-在线认证-认证详细报名及考试'],
  expert:    ['专家 L3 认证', '一/二/三级专家 L3 认证达标情况与缺口提醒'],
  expiry:    ['到期预警', '认证有效期到期提醒，便于提前安排复证'],
  notice:    ['公告与政策', '集团与省公司认证相关政策要点'],
  dept:      ['部门人才视图', '按部门查看人才结构、认证覆盖与专家分布'],
  work:      ['认证规则查询', '25年云网工程师认证规则与标签合成规则查询'],
  match:     ['人岗匹配情况', '考核云网线人员岗位与所持认证是否匹配（L1 按岗位所需认证 / L2 任一 L2+ 认证）']
};
function switchView(v) {
  $$('.nav-item').forEach(function (a) { a.classList.toggle('active', a.dataset.view === v); });
  $$('.view').forEach(function (s) { s.classList.toggle('active', s.id === 'view-' + v); });
  $('#viewTitle').textContent = VIEW_META[v][0];
  $('#viewDesc').textContent = VIEW_META[v][1];
  window.scrollTo(0, 0);
}
$$('.nav-item').forEach(function (a) {
  a.addEventListener('click', function () { switchView(a.dataset.view); });
});
document.addEventListener('click', function (e) {
  var g = e.target.closest('[data-goto]');
  if (!g) return;
  var dp = g.dataset ? g.dataset.dept : '';
  if (dp && dp.indexOf('（通报数据）') < 0) {
    // 汇总表点部门名 → 跳到人岗匹配明细，并自动按该部门筛选
    var inL1 = (M.l1.rows || []).some(function (r) { return r.dept === dp; });
    MF.cat = inL1 ? 'l1' : 'l2';
    MF.unit = ''; MF.dept = dp; MF.state = 'all'; MF.page = 1;
    switchView(g.dataset.goto);
    renderMatch();          // switchView 只切视图不重绘，必须显式重渲染，否则看起来"点了没反应"
    return;
  }
  switchView(g.dataset.goto);
});

/* ============================ 整体视图 ============================ */
function renderDashboard() {
  var m = D.meta;
  $('#kpiRow').innerHTML = [
    kpi('认证人数', fmt(CERTED.length), '人', '覆盖 ' + DEPTS.length + ' 个部门', 'k-dk'),
    kpi('专家在聘人数（云网类）', fmt(EXPERTS.length), '人', '一/二/三级专家合计', ''),
    kpi('L3 及以上人才', fmt(L3_PEOPLE.length), '人', '按云网工程师等级（认证）严格口径', 'k-ok'),
    kpi('专家 L3 未达标', fmt(expBadArr().length), '人', '需尽快安排 L3 认证', 'k-red'),
    kpi('90 天内到期', fmt(EXPIRE_90.length), '人', '等级认证即将失效', 'k-warn')
  ].join('');

  $('#chartGrade').innerHTML = barChart(GRADE_ROWS, {
    cls: function (r) { return BAR_CLS[r.lv] || ''; },
    val: function (r) { return fmt(r.v) + ' 人'; }
  });
  $('#gradeTotal').textContent = '共 ' + fmt(CERTED.length) + ' 人';

  renderProgressTables();

  renderExpertSummary();
  renderMatchDash();
  renderMatchUnitTable();
  renderDashNotice();
}
function kpi(label, val, unit, sub, cls) {
  return '<div class="kpi ' + (cls || '') + '"><div class="kpi-label">' + esc(label) + '</div>' +
    '<div class="kpi-value">' + val + '<small>' + esc(unit || '') + '</small></div>' +
    '<div class="kpi-sub">' + esc(sub) + '</div></div>';
}
function renderExpertSummary() {
  var levels = ['一级专家', '二级专家', '三级专家'];
  var html = levels.map(function (L) {
    var all = EXPERTS.filter(function (i) { return dv('explevel', PEOPLE[i][12][0]) === L; });
    var ok = all.filter(function (i) { return PEOPLE[i][11]; });
    var rate = all.length ? (ok.length / all.length * 100) : 0;
    return '<div class="bar-row ' + (rate < 60 ? 'hl' : '') + '">' +
      '<div class="bar-label">' + L + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + rate.toFixed(1) + '%"></div></div>' +
      '<div class="bar-val">' + ok.length + '/' + all.length + ' · ' + rate.toFixed(0) + '%</div></div>';
  }).join('');

  $('#expertSummary').innerHTML = html;
}

/* ============================ 公告 ============================ */
var NOTICES = [
  {
    hl: true,
    title: '关于云网工程师、研发工程师云网运营相关专业认证工作有关要求的通知',
    meta: '中国电信云运业〔2024〕72号 · 云网运营部',
    text: '<ul>' +
      '<li><strong>认证专业：</strong>云网工程师运营相关专业设 <strong>L1—L4</strong> 四个等级，涵盖 IT上云（内部/客户方向）、云网运营-云网指挥调度、IP、传输、核心网、业务平台、无线网、接入网、动环、应急通信、资源运营、客户网络产品及业务交付运营等专业。</li>' +
      '<li><strong>分级认证方式：</strong>L1 以理论 + 实操考试为主；L2 增加<strong>实战业绩评价</strong>；L3 增加<strong>省级项目实战历练</strong>（本岗位工作经历、项目、课题等）；L4 增加<strong>集团级项目实战历练</strong>。</li>' +
      '<li><strong>组织分工：</strong>L1—L3 理论考试由集团统一组织；实操考试与实战评审由各单位按认证标准组织实施。L4 由集团统一组织实战评审。</li>' +
      '</ul>'
  },
  {
    title: '认证有效期与续期规则（重点）',
    meta: '有效期管理',
    text: '<div class="kv-grid">' +
      kv('理论考试通过标签', '2 年有效') +
      kv('实操考试 / 实战评审标签', '1 年有效') +
      kv('等级认证通过标签', '3 年有效（以点亮日期起算）') +
      '</div>' +
      '<ul style="margin-top:10px">' +
      '<li>理论、实操、实战评审各环节<strong>分别点亮</strong>，全部点亮后该等级认证标签才点亮。</li>' +
      '<li><strong>续期规则：</strong>认证到期后，实操考试通过标签<strong>长期保留有效</strong>，员工需重新参加理论考试和实战评审。</li>' +
      '<li>原则上工程师认证<strong>不允许跨级报名</strong>。</li>' +
      '</ul>'
  },
  {
    title: '专家人才认证政策（与专家 L3 认证直接相关）',
    meta: '报名资格',
    text: '<div class="notice-warn"><svg viewBox="0 0 20 20"><path d="M10 2 1 18h18zm-1 6v5h2V8zm0 6v2h2v-2z" fill="currentColor"/></svg>' +
      '<span>2025 年底前在聘高级专家可直接报名对应专业 <strong>L4</strong> 级认证；<strong>省内专家可直接报名对应专业 L3 级认证</strong>。</span></div>' +
      '<ul>' +
      '<li>本平台据此对一/二/三级专家设置 <strong>L3 认证达标校验</strong>，未取得 L3 及以上认证的人员在专家看板与检索结果中均作强提醒。</li>' +
      '<li>IT上云（内部方向）、云网运营-云网指挥调度、无线网（网络运维方向）、接入网等 2024 年新设专业，1 年内可酌情放开跨级报名限制。</li>' +
      '</ul>'
  },
  {
    title: '考风考纪与其他组织要求',
    meta: '组织要求',
    text: '<ul>' +
      '<li>涉及数字化业务平台、核心业务系统等<strong>关键维护人员须 100% 通过认证</strong>。</li>' +
      '<li>实操考试应在实操环境中开展；集团将组织抽查，违规举办的考试成绩作废并全网通报。</li>' +
      '<li>考生如有违纪，成绩作废，<strong>一年内</strong>不得报名参加工程师认证考试；违纪记录作为<strong>三年内</strong>不得参加评优评先、专家评定等活动的重要参考依据。</li>' +
      '</ul>'
  }
];
function kv(k, v) { return '<div class="kv"><div class="kv-k">' + esc(k) + '</div><div class="kv-v">' + esc(v) + '</div></div>'; }

function renderNotices() {
  var guide = (D.guide || []).filter(function (g) { return g[1]; });
  var guideHtml = guide.length ? '<div class="notice-card"><div class="nc-top"><div class="nc-title">云网工程师负责专业清单</div>' +
    '<span class="nc-meta">来源：《云网运营岗位认证指引》20260615 云网更新</span></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:6px">' +
    guide.map(function (g) { return '<span class="badge b-l1">' + esc(g[1]) + '</span>'; }).join('') +
    '</div></div>' : '';

  $('#noticeBody').innerHTML = NOTICES.map(function (n) {
    return '<div class="notice-card' + (n.hl ? ' hl' : '') + '">' +
      '<div class="nc-top"><div class="nc-title">' + esc(n.title) + '</div>' +
      '<span class="nc-meta">' + esc(n.meta) + '</span></div>' +
      '<div class="nc-text">' + n.text + '</div></div>';
  }).join('') + guideHtml +
    '<div class="foot-note">数据来源：' + esc(D.meta.src_detail) + '、' + esc(D.meta.src_subtag) + '、' +
    esc(D.meta.src_roster) + '、' + esc(D.meta.src_expert) + '；部门优先采用认证导出表，导出表为「深圳分公司本部」时回退《附件1-人员名单》L 列，共回退 ' +
    D.meta.dept_fallback + ' 人。政策文本摘录自《关于云网工程师、研发工程师云网运营相关专业认证工作有关要求的通知》。</div>';
}
function renderDashNotice() {
  $('#dashNotice').innerHTML = NOTICES.slice(0, 2).map(function (n) {
    return '<div class="notice-card' + (n.hl ? ' hl' : '') + '" style="margin-bottom:0">' +
      '<div class="nc-top"><div class="nc-title">' + esc(n.title) + '</div>' +
      '<span class="nc-meta">' + esc(n.meta) + '</span></div>' +
      '<div class="nc-text">' + n.text + '</div></div><div style="height:12px"></div>';
  }).join('');
}

function renderProgressTables() {
  var pr = D.progress || {};
  var pd = pr.dept || [], ps = pr.spec || [];
  var HIDE_PROGRESS = ['人员虚拟部门', '班子成员', '线路维护中心', '派驻单位', '未匹配部门'];
  // 按单位列表截图中的顺序排列（先市公司职能部门，再区分公司，再专业中心/工作组）
  var DEPT_ORDER = [
    '办公室（党委办公室、乡村振兴办）',
    '人力资源部（企业管理部）',
    '销售部',
    '财务部',
    '网络部（网信安部、应急通信办公室）',
    '科技创新部',
    '客户服务部',
    '政企客户部',
    '纪委办公室',
    '党群工作部',
    '工会',
    '安全保卫部（后勤服务中心）',
    '共建共享工作组',
    '宝安分公司',
    '福田分公司',
    '龙岗分公司',
    '南山分公司',
    '龙华分公司',
    '罗湖分公司',
    '光明分公司',
    '坪山大鹏分公司',
    '盐田分公司',
    '前海自贸区分公司',
    '深汕特别合作区分公司',
    '客户经营中心',
    '标准化运营中心（商业客户拓展中心、客户服务调度中心）',
    '大政务运营服务中心（校园客户中心）',
    '大企业运营服务中心',
    'AI中台/集成交付中心',
    'IT及业务稽核中心（综合服务支撑中心、法律合规中心）',
    '客响建设中心',
    '采购供应中心',
    '智能云网调度运营中心（客户网络运营中心）',
    '综合维护中心',
    '算力及IDC拓展运营中心',
    '战新研发中心（大数据人工智能中心）',
    '无线网络运营中心',
    '深圳市蛇口通讯有限公司'
  ];
  function isHidden(name) { return HIDE_PROGRESS.some(function (s) { return (name || '').indexOf(s) >= 0; }); }
  var hideDept = [], hideSpec = [];
  pd = pd.filter(function (r) {
    if (isHidden(r[0])) { hideDept.push(r[0]); return false; }
    return true;
  });
  ps = ps.filter(function (r) {
    if (isHidden(r[0])) { hideSpec.push(r[0]); return false; }
    return true;
  });
  // 按单位列表顺序排列；未在列表中的排最后，再按中文名排序
  pd.sort(function (a, b) {
    var ia = DEPT_ORDER.indexOf(a[0]), ib = DEPT_ORDER.indexOf(b[0]);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a[0].localeCompare(b[0], 'zh');
  });
  if (!pd.length && !ps.length) {
    $('#progressTables').innerHTML = '<div class="empty">认证进度数据未加载</div>';
    return;
  }
  function fmtCell(c, header) {
    if (c === null || c === undefined || c === '') return '<span class="na">—</span>';
    var s = String(c).trim();
    if (!s) return '<span class="na">—</span>';
    var n = Number(s.replace(/,/g, ''));
    if (header.indexOf('占比') >= 0 && !isNaN(n) && isFinite(n)) {
      return (n * 100).toFixed(1) + '%';
    }
    if (!isNaN(n) && isFinite(n) && s.indexOf('/') < 0) {
      return Number.isInteger(n) ? String(n) : n.toFixed(1);
    }
    return esc(s);
  }
  function cellClass(header) {
    if (header.indexOf('认证') >= 0) return 'col-cert';
    if (header.indexOf('占比') >= 0) return 'col-ratio';
    return '';
  }
  function ths(arr) {
    return '<tr>' + arr.map(function (h) {
      var cls = cellClass(h);
      return '<th' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(h) + '</th>';
    }).join('') + '</tr>';
  }
  function rows(arr, headers) {
    return arr.map(function (r) {
      return '<tr>' + r.map(function (c, i) {
        var cls = cellClass(headers[i] || '');
        return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + fmtCell(c, headers[i] || '') + '</td>';
      }).join('') + '</tr>';
    }).join('');
  }
  var hd1 = ['部门', '总人数', 'L1认证', 'L1占比', 'L2认证', 'L2占比', 'L3认证', 'L3占比'];
  // 源数据列序：0部门 1L1认证 2L1理论 3L1实战 4L1实操 5L1占比 6L2认证 … 15L3占比 —— 仅保留 认证/占比 列
  var KEEP_IDX = [0, 1, 5, 6, 10, 11, 15];
  // 占比按展示认证人数计算：Lx占比 = Lx认证 / (L1认证 + L2认证 + L3认证)
  pd = pd.map(function (r) {
    var row = KEEP_IDX.map(function (i) { return r[i]; });
    var l1 = Number(row[1]) || 0, l2 = Number(row[3]) || 0, l3 = Number(row[5]) || 0;
    var total = l1 + l2 + l3;
    // 在「部门」后插入「总人数」
    row.splice(1, 0, total);
    if (total) {
      row[3] = Math.round(l1 / total * 10000) / 10000;   // L1占比
      row[5] = Math.round(l2 / total * 10000) / 10000;   // L2占比
      row[7] = Math.round(l3 / total * 10000) / 10000;   // L3占比
    } else {
      row[3] = row[5] = row[7] = null;
    }
    return row;
  });
  var html = '<div class="progress-tables">';
  if (pd.length) {
    html += '<div class="pt-block">' +
      '<div class="table-wrap"><table class="data-table compact">' +
      ths(hd1) +
      '<tbody>' + rows(pd, hd1) + '</tbody></table></div></div>';
  }
  html += '</div>';
  $('#progressTables').innerHTML = html;
}

/* ============================ 认证检索 ============================ */
var selPerson = null;

function searchNames(q, limit) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return [];
  var out = [];
  for (var i = 0; i < NAME_LOWER.length; i++) {
    if (NAME_LOWER[i].indexOf(q) >= 0) { out.push(i); if (out.length >= (limit || 60)) break; }
  }
  return out;
}
function renderSuggest(q) {
  var box = $('#suggest');
  var list = searchNames(q, 40);
  if (!list.length) {
    box.innerHTML = '<div class="sg-empty">未找到匹配人员，请确认姓名后重试</div>';
    box.classList.add('show'); return;
  }
  box.innerHTML = list.map(function (i) {
    var p = P(i);
    return '<div class="sg-item" data-idx="' + i + '">' +
      '<span class="sg-name">' + esc(maskName(p.name)) + '</span>' +
      '<span class="sg-dept">' + esc(p.dept) + '</span>' +
      '<span class="sg-code">' + (p.expert ? '<span class="badge b-l3">专家</span>' : '') + '</span></div>';
  }).join('') + (list.length >= 40 ? '<div class="sg-more">仅显示前 40 条，请输入更完整的姓名</div>' : '');
  box.classList.add('show');
}
function hideSuggest() { $('#suggest').classList.remove('show'); }

$('#sName').addEventListener('input', function () {
  selPerson = null;
  $('#resultBox').innerHTML = '';
  $('#verifyMsg').className = 'verify-msg';
});
$('#suggest').addEventListener('click', function (e) {
  var it = e.target.closest('.sg-item'); if (!it) return;
  var p = P(+it.dataset.idx);
  selPerson = p;
  $('#sName').value = p.name;
  hideSuggest();
  $('#sCode').focus();
});
document.addEventListener('click', function (e) {
  if (!e.target.closest('.input-wrap')) hideSuggest();
});

function showMsg(txt, ok) {
  var el = $('#verifyMsg');
  el.innerHTML = txt;
  el.className = 'verify-msg show ' + (ok ? 'ok' : 'err');
}

$('#btnReset').addEventListener('click', function () {
  $('#sName').value = ''; $('#sCode').value = '';
  selPerson = null; $('#resultBox').innerHTML = ''; $('#guideResultBox').innerHTML = '';
  $('#verifyMsg').className = 'verify-msg'; hideSuggest();
});

$('#btnQuery').addEventListener('click', doQuery);
$('#searchExport').addEventListener('click', function () {
  if (!selPerson) { alert('请先查询并通过身份验证，再导出该人员的三级标签明细。'); return; }
  var p = selPerson;
  var tags = p.tagIdx.map(T);
  var rows = tags.map(function (t) {
    return [p.name, p.code, p.dept, t.l1, t.l2, t.l3,
            CAT_NAME[t.cat] || t.kind || '', t.lvl || '', t.start || '', t.end || ''];
  });
  downloadCSV('人员三级标签明细_' + (p.name || '') + '_' + stamp() + '.csv',
    ['姓名', '人力编码', '部门', '一级标签', '二级标签', '三级标签', '种类', '标签等级', '开始时间', '结束时间'],
    rows);
});
$('#sCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') doQuery(); });

/* ============================ 各专业认证查询 ============================ */
/* 按「专业 + 认证类型（认证/实操/实战·项目多选）+ 等级」检索持证人员。
   专业取自 DT.kind（三级标签归一化后的专业基名，如 IP、传输、AIDC规划建设），支持下拉选择 + 模糊输入。 */
var CQ = { pro: '', lvl: '', hits: [], page: 1 };
var CQ_SIZE = 25;
var CAT_LABEL = ['认证', '实战/项目', '理论', '通用能力', '实操'];   // 与 DT.cat 顺序一致

function cqMsg(t, ok) {
  var el = $('#cqMsg');
  el.textContent = t || '';
  el.className = 'cq-tip' + (t ? (ok ? ' ok' : ' err') : '');
}

function cqPopulate() {
  // 认证名称候选列表：去重、按中文排序（cname 来自三级标签，存在大量重复，须去重）
  CQ.candidates = Array.from(new Set(DT.cname)).sort(function (a, b) { return a.localeCompare(b, 'zh'); });
  cqDropdownItems(CQ.candidates);
}

function cqDropdownItems(items) {
  var ul = $('#cqProDropdown');
  if (!items.length) {
    ul.innerHTML = '<li class="empty">无匹配认证名称</li>';
    return;
  }
  ul.innerHTML = items.map(function (k) {
    return '<li data-value="' + esc(k) + '" title="' + esc(k) + '">' + esc(k) + '</li>';
  }).join('');
}

function cqShowDropdown(show) {
  var ul = $('#cqProDropdown');
  if (show) ul.classList.add('show'); else ul.classList.remove('show');
}

function cqToggleDropdown() {
  var showing = $('#cqProDropdown').classList.contains('show');
  if (showing) { cqShowDropdown(false); }
  else { cqDropdownItems(CQ.candidates); cqShowDropdown(true); }
}

function cqFilterCandidates(text) {
  var low = text.toLowerCase();
  var items = CQ.candidates.filter(function (k) { return k.toLowerCase().indexOf(low) >= 0; });
  cqDropdownItems(items);
  cqShowDropdown(true);
}

function cqRun(resetPage) {
  if (resetPage) CQ.page = 1;
  var pro = $('#cqPro').value.trim();
  CQ.pro = pro;
  CQ.lvl = $('#cqLvl').value.trim();
  if (!pro) { cqMsg('请先选择或输入认证名称。', false); $('#cqResult').innerHTML = ''; $('#cqPager').innerHTML = ''; return; }

  var proLow = pro.toLowerCase();
  // 认证名称匹配：若输入值与候选列表某一项完全一致，则仅精确匹配该名称；
  // 否则按子串模糊匹配（支持输入部分关键字查出多个相关认证名称）
  var exact = DT.cname.indexOf(pro) >= 0;
  var matchedPros = exact ? [pro] : DT.cname.filter(function (k) {
    return k.toLowerCase().indexOf(proLow) >= 0;
  });

  var hits = [];
  ALL.forEach(function (i) {
    var p = P(i);
    var tags = p.tagIdx.map(T).filter(function (t) {
      if (CQ.lvl && t.lvl !== CQ.lvl) return false;
      return matchedPros.indexOf(t.cname) >= 0;
    });
    if (tags.length) hits.push({ p: p, tags: tags });
  });

  // 结果按部门、姓名稳定排序，便于浏览
  hits.sort(function (a, b) {
    var d = (a.p.dept || '').localeCompare(b.p.dept || '', 'zh');
    return d !== 0 ? d : (a.p.name || '').localeCompare(b.p.name || '', 'zh');
  });
  CQ.hits = hits;

  if (!hits.length) {
    cqMsg('未找到满足「' + esc(pro) + (CQ.lvl ? ' · ' + esc(CQ.lvl) : '') + '」的持证人员。', false);
    $('#cqResult').innerHTML = '<div class="cq-empty">无匹配人员，请调整认证名称后重试。</div>';
    $('#cqPager').innerHTML = '';
    return;
  }
  var proText = matchedPros.length === 1 ? matchedPros[0]
    : ('含「' + pro + '」的 ' + matchedPros.length + ' 个认证名称');
  cqMsg('已匹配认证名称：' + esc(proText) +
        (CQ.lvl ? ' · ' + CQ.lvl : '') + '。', true);
  cqRender();
}

function cqPersonCard(h) {
  var p = h.p;
  var chips = h.tags.map(function (t) {
    return '<span class="badge ' + CAT_CLS[t.cat] + '">' +
      esc(t.l3) + (t.lvl ? ' · ' + esc(t.lvl) : '') + '</span>';
  }).join('');
  var init = (p.name || '?').charAt(0);
  return '<div class="cq-person">' +
    '<div class="cq-avatar">' + esc(init) + '</div>' +
    '<div class="cq-p-info">' +
      '<div class="cq-p-name">' + esc(p.name) + '</div>' +
      '<div class="cq-p-sub">' + esc(p.dept || '未匹配部门') +
        ' · 人力编码 ' + esc(p.code) +
        (p.grade ? ' · ' + esc(p.grade) : '') + '</div>' +
    '</div>' +
    '<div class="cq-p-tags">' + chips + '</div>' +
  '</div>';
}

function cqRender() {
  var total = CQ.hits.length;
  var pages = Math.max(1, Math.ceil(total / CQ_SIZE));
  if (CQ.page > pages) CQ.page = pages;
  var slice = CQ.hits.slice((CQ.page - 1) * CQ_SIZE, CQ.page * CQ_SIZE);
  $('#cqResult').innerHTML =
    '<div class="cq-count">共匹配 <strong>' + fmt(total) + '</strong> 名人员（当前页 ' +
      slice.length + ' 条）</div>' + slice.map(cqPersonCard).join('');
  pager('#cqPager', total, CQ_SIZE, CQ.page, function (n) { CQ.page = n; cqRender(); });
}

cqPopulate();
$('#cqBtn').addEventListener('click', function () { CQ.page = 1; cqRun(true); });
$('#cqExport').addEventListener('click', function () {
  if (!CQ.hits.length) { alert('当前无可导出的人员，请先执行查询。'); return; }
  var rows = [];
  CQ.hits.forEach(function (h) {
    var p = h.p;
    h.tags.forEach(function (t) {
      rows.push([p.name, p.code, p.dept, p.grade || '', t.l1, t.l2, t.l3,
                 CAT_NAME[t.cat] || t.kind || '', t.lvl || '', t.start || '', t.end || '']);
    });
  });
  downloadCSV('各专业认证人员_' + stamp() + '.csv',
    ['姓名', '人力编码', '部门', '云网工程师等级', '一级标签', '二级标签', '三级标签', '种类', '标签等级', '开始时间', '结束时间'],
    rows);
});
$('#cqLvl').addEventListener('change', function () { CQ.page = 1; cqRun(true); });
$('#cqPro').addEventListener('keydown', function (e) { if (e.key === 'Enter') { CQ.page = 1; cqRun(true); } });
$('#cqPro').addEventListener('input', function () { cqFilterCandidates(this.value); });
$('#cqPro').addEventListener('focus', function () { cqFilterCandidates(this.value); });
$('#cqProToggle').addEventListener('click', function (e) { e.stopPropagation(); cqToggleDropdown(); });
$('#cqProDropdown').addEventListener('click', function (e) {
  var li = e.target.closest('li[data-value]');
  if (!li) return;
  $('#cqPro').value = li.getAttribute('data-value');
  cqShowDropdown(false);
});
document.addEventListener('click', function (e) { if (!e.target.closest('.cq-combo')) cqShowDropdown(false); });
$('#cqReset').addEventListener('click', function () {
  $('#cqPro').value = ''; $('#cqLvl').value = '';
  CQ = { pro: '', lvl: '', hits: [], page: 1, candidates: CQ.candidates };
  cqShowDropdown(false);
  cqMsg(''); $('#cqResult').innerHTML = '<div class="cq-empty">请选择或输入认证名称后点击「查询人员」。</div>';
  $('#cqPager').innerHTML = '';
});

function doQuery() {
  var name = $('#sName').value.trim();
  var code = $('#sCode').value.trim().replace(/\s/g, '');
  if (!name) { showMsg('请先输入姓名。'); $('#sName').focus(); return; }
  if (!code) { showMsg('请输入人力编码以完成身份验证。'); $('#sCode').focus(); return; }

  var cands = searchNames(name, 500).map(P);
  if (!cands.length) { showMsg('未找到姓名为「' + esc(name) + '」的人员，请核对后重试。'); $('#resultBox').innerHTML = ''; $('#guideResultBox').innerHTML = ''; return; }

  var hit = cands.filter(function (p) { return p.code === code; })[0];
  if (!hit) {
    var byCode = IDX_BY_CODE[code];
    showMsg(byCode !== undefined
      ? '人力编码与姓名不匹配。该编码对应人员为「' + esc(maskName(P(byCode).name)) + '」，请核对姓名后重试。'
      : '验证未通过：人力编码不存在或与姓名不匹配，无法查看认证信息。');
    $('#resultBox').innerHTML = ''; $('#guideResultBox').innerHTML = '';
    return;
  }
  if (cands.length > 1) {
    showMsg('姓名「' + esc(name) + '」存在 ' + cands.length + ' 位同名人员，已按人力编码精确定位。', true);
  } else {
    showMsg('身份验证通过。', true);
  }
  selPerson = hit;
  renderResult(hit);
  renderGuide(PEOPLE[hit.i], computeGuide(PEOPLE[hit.i]));
}

function renderResult(p) {
  var lv = p.bestLvl;
  var d = daysLeft(p.end);
  var vPct = 0, vCls = '', vTxt = '—';
  if (p.start && p.end && !/^9999/.test(p.end)) {
    var s = parseDate(p.start), e = parseDate(p.end);
    if (s && e) {
      vPct = Math.min(100, Math.max(0, (today() - s) / (e - s) * 100));
      if (d != null) {
        vTxt = d >= 0 ? '剩余 ' + d + ' 天' : '已过期 ' + (-d) + ' 天';
        vCls = d < 0 ? 'bad' : (d <= 90 ? 'warn' : '');
      }
    }
  } else if (/^9999/.test(p.end)) { vPct = 100; vTxt = '长期有效'; }

  var expHtml = '';
  if (p.expert) {
    expHtml = l3ok(p)
      ? '<div class="notice-warn" style="background:var(--ok-lt);border-color:#BFE5D3;color:var(--ok)">' +
        '<svg viewBox="0 0 20 20"><path d="M8.6 13.6 4.9 10l-1.4 1.4 5.1 5.1L17 7.1l-1.4-1.4z" fill="currentColor"/></svg>' +
        '<span>专家人才（' + esc(p.expert.level) + '）已满足 L3 认证要求（最高等级 ' + LVNAME[lv] + '）。</span></div>'
      : '<div class="notice-warn">' +
        '<svg viewBox="0 0 20 20"><path d="M10 2 1 18h18zm-1 6v5h2V8zm0 6v2h2v-2z" fill="currentColor"/></svg>' +
        '<span>强提醒：该人员为<strong>' + esc(p.expert.level) + '</strong>，当前最高等级仅 <strong>' +
        (lv ? LVNAME[lv] : '无有效等级') + '</strong>，<strong>尚未取得 L3 认证</strong>，请尽快安排 L3 认证报名。</span></div>';
  }

  var badges = ['<span class="badge">' + esc(p.dept) + '</span>'];
  if (p.expert) badges.push('<span class="badge ' + (l3ok(p) ? 'b-ok' : 'b-bad') + '">' + esc(p.expert.level) + (l3ok(p) ? ' · L3达标' : ' · 缺L3') + '</span>');
  if (lv) badges.push('<span class="badge ' + LVL_CLS['L' + lv] + '">最高等级 ' + LVNAME[lv] + '</span>');

  var tags = p.tagIdx.map(T);
  var catCnt = [0, 0, 0, 0];
  tags.forEach(function (t) { catCnt[t.cat]++; });

  $('#resultBox').innerHTML =
    '<div class="result-card">' +
      '<div class="rc-head"><div>' +
        '<div class="rc-name">' + esc(p.name) + '</div>' +
        '<div class="rc-code">人力编码 ' + esc(p.code) + (p.full ? ' · ' + esc(p.full) : '') + '</div>' +
      '</div><div class="rc-head-badges">' + badges.join('') + '</div></div>' +
      '<div class="rc-body">' + expHtml +
        '<div class="info-grid">' +
          ic('姓名', p.name) +
          ic('所属部门', p.dept, p.full ? '全称：' + p.full : '', p.full ? 'sm' : '') +
          ic('云网工程师等级', p.grade || '暂无等级认证', p.grade ? '' : '未在认证明细中查到', p.grade ? '' : 'muted') +
          ic('认证状态', p.status || '—', '', 'sm') +
          ic('标签认证开始时间', dateText(p.start), '', 'sm') +
          ic('标签认证结束时间', dateText(p.end), d != null ? (d >= 0 ? '剩余 ' + d + ' 天' : '已过期') : '', 'sm') +
          ic('三级标签数量', tags.length + ' 条',
             '认证 ' + catCnt[0] + ' · 实战 ' + catCnt[1] + ' · 理论 ' + catCnt[2] + ' · 通用能力 ' + catCnt[3], 'sm') +
          ic('专家信息', p.expert ? (p.expert.level + ' / ' + p.expert.sub) : '非在聘专家',
             p.expert ? ('专业分类：' + p.expert.cat) : '', p.expert ? 'sm' : 'muted') +
        '</div>' +
        (p.start || p.end ? '<div class="validity"><div class="v-head"><span>认证有效期进度</span><span>' + vTxt + '</span></div>' +
          '<div class="v-track"><div class="v-fill ' + vCls + '" style="width:' + vPct.toFixed(1) + '%"></div></div>' +
          '<div class="v-foot"><span>' + dateText(p.start) + '</span><span>' + dateText(p.end) + '</span></div></div>' : '') +
        '<div class="tags-section">' +
          '<div class="ts-head"><div class="ts-title">三级标签信息</div>' +
            '<div class="ts-sum">共 ' + tags.length + ' 条子标签记录</div></div>' +
          '<div class="tag-tools"><button class="btn tags-btn" id="btnTags">查看三级标签明细</button></div>' +
          '<div id="tagDetail"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="mini-note">提示：以上信息来源于人才云导出数据，部门已按人力编码与《附件1-人员名单》核对修正。' +
    '如需更正请联系网络部规划运营团队。</div>';

  $('#btnTags').addEventListener('click', function () {
    var el = $('#tagDetail');
    if (el.innerHTML) { el.innerHTML = ''; this.textContent = '查看三级标签明细'; return; }
    this.textContent = '收起三级标签明细';
    el.innerHTML = tagTableHtml(tags, false);
  });
}
function ic(label, val, sub, cls, key, active) {
  return '<div class="info-cell' + (key ? ' kpi-click' : '') + (active ? ' kpi-active' : '') + '"' +
    (key ? ' data-ickey="' + key + '" title="点击查看明细"' : '') + '>' +
    '<div class="ic-label">' + esc(label) + '</div>' +
    '<div class="ic-value ' + (cls || '') + '">' + esc(val) + '</div>' +
    (sub ? '<div class="ic-sub">' + esc(sub) + '</div>' : '') + '</div>';
}

/* ============================ 标签表格 ============================ */
function tagTableHtml(tags, showName) {
  if (!tags.length) return '<div class="empty">暂无三级标签记录</div>';
  tags = tags.slice().sort(function (a, b) { return (b.lvl || '').localeCompare(a.lvl || ''); });
  return '<div class="table-wrap" style="margin-top:6px"><table><thead><tr>' +
    (showName ? '<th>姓名</th><th>部门</th>' : '') +
    '<th>一级标签</th><th>二级标签</th><th>三级标签（原文）</th><th>种类</th><th>标签种类</th>' +
    '<th>标签等级</th><th>开始时间</th><th>结束时间</th><th>状态</th></tr></thead><tbody>' +
    tags.map(function (t) {
      var d = daysLeft(t.end);
      var endTxt = dateText(t.end);
      var endCls = (d != null && d < 0) ? ' style="color:var(--accent);font-weight:600"' : '';
      return '<tr>' +
        (showName ? '<td class="nowrap">' + esc(t._name || '') + '</td><td>' + esc(t._dept || '') + '</td>' : '') +
        '<td>' + esc(t.l1) + '</td><td>' + esc(t.l2) + '</td>' +
        '<td>' + esc(t.l3) + '</td>' +
        '<td class="nowrap">' + esc(t.kind) + '</td>' +
        '<td><span class="badge ' + CAT_CLS[t.cat] + '">' + CAT_NAME[t.cat] + '</span></td>' +
        '<td>' + (t.lvl ? '<span class="badge ' + LVL_CLS[t.lvl] + '">' + t.lvl + '</span>' : '<span class="badge b-gray">—</span>') + '</td>' +
        '<td class="nowrap">' + dateText(t.start) + '</td>' +
        '<td class="nowrap"' + endCls + '>' + endTxt + '</td>' +
        '<td>' + esc(t.status || '—') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

/* ============================ 专家 L3 看板 ============================ */
var EF = { level: 'all', state: 'all', dept: '', cat: '' };
var EXP_LIST = [];
function renderExpert() {
  var strict = L3BASIS === 'grade';
  var okN = expOkArr().length, badN = expBadArr().length;
  var rate = EXPERTS.length ? (okN / EXPERTS.length * 100) : 0;
  $('#expertKpi').innerHTML = [
    kpi('在聘专家总数', fmt(EXPERTS.length), '人', '一级 62 / 二级 95 / 三级 115', 'k-dk'),
    kpi('L3 认证达标', fmt(okN), '人', strict ? '工程师等级达 L3' : '工程师等级或子标签达 L3', 'k-ok'),
    kpi('L3 未达标', fmt(badN), '人', strict ? '等级未达 L3' : '两者均未达 L3', 'k-red'),
    kpi('整体达标率', rate.toFixed(1), '%', '按专家人数计', 'k-warn')
  ].join('');

  var al = $('#expertAlert');
  al.className = 'alert-banner' + (badN ? '' : ' ok');
  al.innerHTML = '<svg class="ab-icon" viewBox="0 0 20 20"><path d="M10 2 1 18h18zm-1 6v5h2V8zm0 6v2h2v-2z" fill="currentColor"/></svg>' +
    '<div><div class="ab-title">' + (badN
      ? '强提醒：' + badN + ' 名在聘专家尚未取得 L3 认证'
      : '全部在聘专家均已取得 L3 认证') + '</div>' +
    '<div class="ab-text">按集团《中国电信云运业〔2024〕72号》要求，省内专家可直接报名对应专业 <strong>L3 级认证</strong>；' +
    '专家人才须具备 L3 认证。请各部门对未达标人员优先安排 L3 认证报名与实战评审。</div></div>';

  var cats = {};
  EXPERTS.forEach(function (i) { var c = dv('expcat', PEOPLE[i][12][1]); if (c) cats[c] = 1; });
  var eDepts = {};
  EXPERTS.forEach(function (i) { eDepts[P(i).dept] = 1; });

  $('#expertFilter').innerHTML =
    segHtml('level', ['all:全部层次', '一级专家:一级专家', '二级专家:二级专家', '三级专家:三级专家'], EF.level) +
    segHtml('state', ['all:全部', 'bad:未达标', 'ok:已达标'], EF.state) +
    '<select id="efDept"><option value="">全部部门</option>' +
      Object.keys(eDepts).sort().map(function (d) {
        return '<option' + (d === EF.dept ? ' selected' : '') + '>' + esc(d) + '</option>';
      }).join('') + '</select>' +
    '<select id="efCat"><option value="">全部分类</option>' +
      Object.keys(cats).sort().map(function (d) {
        return '<option' + (d === EF.cat ? ' selected' : '') + '>' + esc(d) + '</option>';
      }).join('') + '</select>' +
    '<span class="f-label" id="efCount"></span>';

  $$('#expertFilter .seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      EF[b.dataset.field] = b.dataset.val;
      renderExpert();
    });
  });
  $('#efDept').addEventListener('change', function () { EF.dept = this.value; renderExpert(); });
  $('#efCat').addEventListener('change', function () { EF.cat = this.value; renderExpert(); });

  var list = EXPERTS.filter(function (i) {
    var p = P(i), e = p.expert;
    if (EF.level !== 'all' && e.level !== EF.level) return false;
    if (EF.state === 'bad' && l3ok(p)) return false;
    if (EF.state === 'ok' && !l3ok(p)) return false;
    if (EF.dept && p.dept !== EF.dept) return false;
    if (EF.cat && e.cat !== EF.cat) return false;
    return true;
  });
  var order = { '一级专家': 1, '二级专家': 2, '三级专家': 3 };
  list.sort(function (a, b) {
    var pa = P(a), pb = P(b);
    if (l3ok(pa) !== l3ok(pb)) return l3ok(pa) ? 1 : -1;
    var oa = order[pa.expert.level] || 9, ob = order[pb.expert.level] || 9;
    if (oa !== ob) return oa - ob;
    return pb.expert.unit.localeCompare(pa.expert.unit) || 0;
  });

  EXP_LIST = list;
  $('#efCount').textContent = '共 ' + list.length + ' 人';
  $('#expertCount').textContent = '共 ' + EXPERTS.length + ' 人';

  $('#expertTable').innerHTML = '<table><thead><tr>' +
    '<th>姓名</th><th>所在单位 / 部门</th><th>专家层次</th><th>专业分类</th><th>子专业</th>' +
    '<th>云网工程师等级</th><th>最高标签等级</th><th>L3 认证状态</th><th>操作</th></tr></thead><tbody>' +
    (list.length ? list.map(function (i) {
      var p = P(i), e = p.expert;
      return '<tr' + (l3ok(p) ? '' : ' class="row-danger"') + '>' +
        '<td class="nowrap"><strong>' + esc(p.name) + '</strong></td>' +
        '<td>' + esc(p.dept) + '</td>' +
        '<td class="nowrap"><span class="badge b-gray">' + esc(e.level) + '</span></td>' +
        '<td>' + esc(e.cat) + '</td><td class="nowrap">' + esc(e.sub) + (e.dir && e.dir !== e.sub ? ' · ' + esc(e.dir) : '') + '</td>' +
        '<td class="nowrap">' + (p.grade ? '<span class="badge ' + (LVL_CLS['L' + p.gradeLvl] || 'b-gray') + '">' + esc(p.grade) + '</span>' : '<span class="badge b-gray">无</span>') + '</td>' +
        '<td class="nowrap">' + (p.maxTagLvl ? '<span class="badge ' + LVL_CLS['L' + p.maxTagLvl] + '">' + LVNAME[p.maxTagLvl] + '</span>' : '<span class="badge b-gray">无</span>') + '</td>' +
        '<td class="nowrap">' + (l3ok(p)
          ? '<span class="badge b-ok">✓ L3 达标</span>'
          : '<span class="badge b-solid-red">✕ 缺 L3</span>') + '</td>' +
        '<td class="nowrap"><span class="row-link" data-detail="' + i + '">查看详情</span></td></tr>';
    }).join('') : '<tr><td colspan="9"><div class="empty">无符合条件的专家</div></td></tr>') +
    '</tbody></table>';

  $$('#expertTable [data-detail]').forEach(function (el) {
    el.addEventListener('click', function () { openDetail(+el.dataset.detail); });
  });
}
$('#expertExport').addEventListener('click', function () {
  var rows = EXP_LIST.map(function (i) {
    var p = P(i), e = p.expert;
    return [p.name, p.code, p.dept, e.level, e.cat, e.sub, e.dir,
            p.grade || '无', LVNAME[p.maxTagLvl] || '无', LVNAME[p.bestLvl] || '无',
            l3ok(p) ? '达标' : '缺L3', p.start, p.end,
            l3ok(p) ? '' : '尽快报名对应专业 L3 认证（省内专家可直接报名 L3）'];
  });
  downloadCSV('专家L3认证情况_' + stamp() + '.csv',
    ['姓名', '人力编码', '所在单位', '专家层次', '专业分类', '子专业', '方向',
     '云网工程师等级', '最高标签等级', '最高等级', 'L3认证状态', '认证开始', '认证结束', '建议动作'], rows);
});

function segHtml(field, items, cur) {
  return '<div class="seg">' + items.map(function (s) {
    var kv = s.split(':');
    return '<button data-field="' + field + '" data-val="' + esc(kv[0]) + '"' +
      (String(cur) === kv[0] ? ' class="on"' : '') + '>' + esc(kv[1]) + '</button>';
  }).join('') + '</div>';
}

/* 详情弹窗 */
function openDetail(i) {
  var p = P(i);
  var tags = p.tagIdx.map(T);
  var l3tags = tags.filter(function (t) { return t.lvl === 'L3' || t.lvl === 'L4'; });
  $('#modalTitle').textContent = p.name + ' · 认证详情';
  var e = p.expert;
  $('#modalBody').innerHTML =
    (e && !l3ok(p) ? '<div class="notice-warn"><svg viewBox="0 0 20 20"><path d="M10 2 1 18h18zm-1 6v5h2V8zm0 6v2h2v-2z" fill="currentColor"/></svg>' +
      '<span>强提醒：' + esc(e.level) + '「' + esc(p.name) + '」当前最高等级 ' + (p.bestLvl ? LVNAME[p.bestLvl] : '无') +
      '，<strong>尚未取得 L3 认证</strong>，请尽快安排 L3 认证。</span></div>' : '') +
    '<div class="info-grid">' +
      ic('姓名', p.name) + ic('人力编码', p.code, '', 'sm') +
      ic('所属部门', p.dept, p.full, 'sm') +
      ic('云网工程师等级', p.grade || '无', '', 'sm') +
      ic('标签认证开始时间', dateText(p.start), '', 'sm') +
      ic('标签认证结束时间', dateText(p.end), '', 'sm') +
      ic('三级标签总数', tags.length + ' 条', '其中 L3/L4 ' + l3tags.length + ' 条', 'sm') +
      ic('专家信息', e ? e.level + ' · ' + e.sub : '非在聘专家', e ? e.cat : '', e ? 'sm' : 'muted') +
    '</div>' +
    '<div style="margin-top:18px"><div class="ts-title" style="margin-bottom:8px">三级标签明细（' + tags.length + ' 条）</div></div>' +
    tagTableHtml(tags, false);
  $('#modal').classList.add('show');
}
$$('[data-close]').forEach(function (el) {
  el.addEventListener('click', function () { $('#modal').classList.remove('show'); });
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') $('#modal').classList.remove('show');
});

function sel(id, ph, opts, cur) {
  return '<select id="' + id + '"><option value="">' + esc(ph) + '</option>' +
    opts.map(function (o) { return '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
    '</select>';
}
/* ============================ 到期预警 ============================ */
var XF = { days: 90, src: 'cert', unit: '', page: 1 };
var XF_SIZE = 25;
// 人员所属单位：优先取人岗匹配清单中的单位，否则按部门名推断
var MATCH_UNIT_MAP = {};
(M.l1.rows || []).concat(M.l2.rows || []).forEach(function (r) {
  if (r.code && r.unit && !MATCH_UNIT_MAP[r.code]) MATCH_UNIT_MAP[r.code] = r.unit;
});
var UNIT_PREFIX = [['宝安', '宝安分公司'], ['福田', '福田分公司'], ['龙岗', '龙岗分公司'],
  ['南山', '南山分公司'], ['龙华', '龙华分公司'], ['罗湖', '罗湖分公司'], ['光明', '光明分公司'],
  ['坪山', '坪山大鹏分公司'], ['大鹏', '坪山大鹏分公司'], ['盐田', '盐田分公司'],
  ['前海', '前海自贸区分公司'], ['深汕', '深汕特别合作区分公司'],
  ['蛇口', '深圳市蛇口通讯有限公司'], ['高新', '深圳高新区信息网有限公司']];
function unitOfPerson(p) {
  if (MATCH_UNIT_MAP[p.code]) return MATCH_UNIT_MAP[p.code];
  var d = p.dept || '';
  if (/分公司$/.test(d)) return d;
  for (var i = 0; i < UNIT_PREFIX.length; i++) {
    if (d.indexOf(UNIT_PREFIX[i][0]) === 0) return UNIT_PREFIX[i][1];
  }
  return '深圳分公司本部';
}
function renderExpiryFilter() {
  var depts = {};
  expiryList(XF.days, XF.src).forEach(function (r) {
    var d = P(r.i).dept;
    if (DEPT_NAMES.indexOf(d) >= 0) depts[d] = 1;
  });
  $('#expiryFilter').innerHTML =
    segHtml('src', ['cert:等级认证', 'tag:三级子标签'], XF.src) +
    segHtml('days', ['30:30天内', '90:90天内', '180:180天内', '365:1年内'], String(XF.days)) +
    '<select id="xfDept"><option value="">全部部门</option>' + Object.keys(depts).sort(function (a, b) { return a.localeCompare(b, 'zh'); }).map(function (u) {
      return '<option' + (u === XF.dept ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '</select>' +
    '<span class="f-label" id="xfCount"></span>';
  $$('#expiryFilter .seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.dataset.field, v = b.dataset.val;
      if (f === 'days') XF.days = +v; else XF[f] = v;
      XF.dept = ''; XF.page = 1; renderExpiryFilter(); renderExpiryTable();
    });
  });
  $('#xfDept').addEventListener('change', function () { XF.dept = this.value; XF.page = 1; renderExpiryTable(); });
}
function expiryRows() {
  return expiryList(XF.days, XF.src).filter(function (r) {
    return !XF.dept || P(r.i).dept === XF.dept;
  });
}
function renderExpiryTable() {
  var rows = expiryRows();
  var pages = Math.max(1, Math.ceil(rows.length / XF_SIZE));
  if (XF.page > pages) XF.page = pages;
  var slice = rows.slice((XF.page - 1) * XF_SIZE, XF.page * XF_SIZE);
  var overdue = rows.filter(function (r) { return r.d < 0; }).length;
  $('#xfCount').textContent = '共 ' + fmt(rows.length) + ' 条';
  $('#expiryCount').textContent = XF.days + ' 天内 · ' + fmt(rows.length) + ' 条';

  var al = $('#expiryAlert');
  al.className = 'alert-banner';
  al.innerHTML = '<svg class="ab-icon" viewBox="0 0 20 20"><path d="M10 2 1 18h18zm-1 6v5h2V8zm0 6v2h2v-2z" fill="currentColor"/></svg>' +
    '<div><div class="ab-title">' + (XF.src === 'cert' ? '等级认证' : '三级子标签') + '到期预警：' +
    fmt(rows.length) + ' 条记录将在 ' + XF.days + ' 天内到期，其中已过期 ' + fmt(overdue) + ' 条</div>' +
    '<div class="ab-text">按集团规则，等级认证标签有效期 <strong>3 年</strong>；到期后实操考试标签长期保留，' +
    '需重新参加<strong>理论考试</strong>与<strong>实战评审</strong>。建议提前 90 天组织复证报名。</div></div>';

  $('#expiryTable').innerHTML = '<table><thead><tr>' +
    '<th>姓名</th><th>部门</th><th>认证 / 标签</th><th>等级</th><th>结束时间</th><th>剩余天数</th><th>状态</th></tr></thead><tbody>' +
    (slice.length ? slice.map(function (r) {
      var p = P(r.i);
      var cls = r.d < 0 ? 'b-solid-red' : (r.d <= 30 ? 'b-bad' : (r.d <= 90 ? 'b-warn' : 'b-gray'));
      var txt = r.d < 0 ? '已过期 ' + (-r.d) + ' 天' : '剩余 ' + r.d + ' 天';
      return '<tr' + (r.d < 0 ? ' class="row-danger"' : '') + '>' +
        '<td class="nowrap">' + esc(p.name) + '</td>' +
        '<td>' + esc(p.dept) + '</td>' +
        '<td>' + esc(r.tag ? (r.kind || r.l3 || '—') : (p.grade || '—')) +
          (r.tag && r.cat >= 0 ? ' <span class="badge ' + CAT_CLS[r.cat] + '">' + CAT_NAME[r.cat] + '</span>' : '') + '</td>' +
        '<td class="nowrap">' + (r.lvl ? '<span class="badge ' + (LVL_CLS[r.lvl] || 'b-gray') + '">' + esc(r.lvl) + '</span>' : '<span class="badge b-gray">—</span>') + '</td>' +
        '<td class="nowrap">' + dateText(r.end) + '</td>' +
        '<td class="nowrap"><span class="badge ' + cls + '">' + txt + '</span></td>' +
        '<td>' + esc(p.status || '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty">该时间范围内无到期记录</div></td></tr>') +
    '</tbody></table>';
  pager('#expiryPager', rows.length, XF_SIZE, XF.page, function (n) { XF.page = n; renderExpiryTable(); });
}
$('#expiryExport').addEventListener('click', function () {
  var rows = expiryRows().map(function (r) {
    var p = P(r.i);
    return [p.name, p.code, p.dept,
            r.tag ? (r.kind || '') : (p.grade || ''),
            r.lvl || '', r.end,
            r.d < 0 ? ('已过期' + (-r.d) + '天') : ('剩余' + r.d + '天'),
            r.tag ? '三级子标签' : '等级认证'];
  });
  downloadCSV('认证到期预警_' + (XF.src === 'cert' ? '等级认证' : '子标签') + '_' + XF.days + '天内_' + stamp() + '.csv',
    ['姓名', '人力编码', '部门', '认证/标签', '等级', '结束时间', '剩余天数', '类型'], rows);
});

/* ============================ 部门视图 ============================ */
/* 部门人才视图：部门口径统一采用「云网工程师认证明细」的所属部门（p.dept），
   与整体人才视图/专家/到期预警一致；不再单独维护部门视图目标清单。 */
var DF = { unit: '', page: 1, kw: '', pro: '', lvl: '', special: '', gradeVal: '' };   // unit=''=全部单位
var DF_SIZE = 25;
/* special：汇总下钻过滤（点 KPI 卡/图表条后生效）''=无；
   cert=已认证、l3plus=L3及以上、exp=在聘专家、grade=指定工程师等级(gradeVal) */
var DF_SPECIAL_LABEL = { cert: '已认证', l3plus: 'L3 及以上', exp: '在聘专家' };
/* 部门视图头部当前渲染的图表行数据（供点击下钻取行名） */
var DEPT_HEAD_ROWS = { grade: [], pro: [] };
/* 当前部门范围（''=全部单位 → 明细中的全部云网工程师） */
function deptScopeMembers() { return DF.unit ? (DEPT_MEMBERS[DF.unit] || []) : ALL; }
/* 检索过滤：姓名/编码(MSS)关键词 + 专业名称 + 等级。
   专业/等级按「认证」类三级标签匹配（与 TOP10 同口径）；检索只过滤名册表，不影响上方 KPI 与图表。 */
function deptSearchFilter(members) {
  var kw = (DF.kw || '').trim().toLowerCase();
  return members.filter(function (i) {
    var p = P(i);
    if (kw && (p.name + ' ' + p.code + ' ' + p.dept).toLowerCase().indexOf(kw) < 0) return false;
    /* 汇总下钻：与 KPI 卡同口径 */
    if (DF.special === 'cert' && !p.grade) return false;
    if (DF.special === 'l3plus' && !(p.gradeLvl >= 3)) return false;
    if (DF.special === 'exp' && !p.expert) return false;
    if (DF.special === 'grade') {
      /* 「未认证」条目匹配 grade 为空的人员，其余按等级名精确匹配 */
      var gv = DF.gradeVal;
      if (gv === '未认证' ? !!p.grade : p.grade !== gv) return false;
    }
    if (DF.pro || DF.lvl) {
      var hit = false;
      for (var s = 0; s < p.tagIdx.length; s++) {
        var ti = p.tagIdx[s];
        if (dv('cat', TAGS[ti][9]) !== '认证') continue;
        if (DF.pro && dv('kind', TAGS[ti][0]) !== DF.pro) continue;
        if (DF.lvl && dv('lvl', TAGS[ti][1]) !== DF.lvl) continue;
        hit = true; break;
      }
      if (!hit) return false;
    }
    return true;
  });
}
/* 当前部门范围内的「认证」类专业候选（供专业下拉） */
function deptCertKinds() {
  var set = {};
  deptScopeMembers().forEach(function (i) {
    P(i).tagIdx.forEach(function (ti) {
      if (dv('cat', TAGS[ti][9]) !== '认证') return;
      var k = dv('kind', TAGS[ti][0]);
      if (k) set[k] = 1;
    });
  });
  return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'zh'); });
}
function renderDeptFilter() {
  $('#deptFilter').innerHTML = '<select id="dfDept">' +
    '<option value=""' + (DF.unit ? '' : ' selected') + '>全部单位</option>' +
    DEPT_UNITS.map(function (u) {
      return '<option value="' + esc(u) + '"' + (u === DF.unit ? ' selected' : '') + '>' + esc(u) + '</option>';
    }).join('') + '</select>';
  buildDeptSearchBar();
  $('#dfDept').addEventListener('change', function () {
    DF.unit = this.value; DF.pro = ''; DF.lvl = ''; DF.special = ''; DF.gradeVal = ''; DF.page = 1;
    buildDeptSearchBar();   // 换部门后刷新专业候选（重置专业/等级）
    renderDept();
  });
}
/* 人员检索栏：姓名/编码(MSS) + 专业名称 + 等级，置于名册表上方。
   仅在初始化与切换部门时重建（此时输入框失焦可接受）；输入关键词/筛选只重绘表格，不重建本栏。 */
function buildDeptSearchBar() {
  $('#deptSearchBar').innerHTML =
    '<input id="dfKw" class="input" type="text" placeholder="搜索姓名 / 编码(MSS)…" value="' + esc(DF.kw) + '">' +
    '<select id="dfPro"><option value="">全部专业</option>' +
      deptCertKinds().map(function (k) {
        return '<option value="' + esc(k) + '"' + (k === DF.pro ? ' selected' : '') + '>' + esc(k) + '</option>';
      }).join('') + '</select>' +
    '<select id="dfLvl"><option value="">全部等级</option>' +
      ['L1', 'L2', 'L3', 'L4'].map(function (l) {
        return '<option value="' + l + '"' + (l === DF.lvl ? ' selected' : '') + '>' + l + '</option>';
      }).join('') + '</select>' +
    '<span class="f-label" id="dfCount"></span>';
  $('#dfKw').addEventListener('input', function () { DF.kw = this.value; DF.page = 1; renderDept(); });
  $('#dfPro').addEventListener('change', function () { DF.pro = this.value; DF.page = 1; renderDept(); });
  $('#dfLvl').addEventListener('change', function () { DF.lvl = this.value; DF.page = 1; renderDept(); });
}
/* KPI 与两张图表：始终按「当前部门全量人员」统计，不随下方检索变化 */
function renderDeptHead(members) {
  var rows = members.map(function (i) { return { p: P(i), found: true }; });
  var certCount = rows.filter(function (r) { return !!r.p.grade; }).length;
  var l3Count = rows.filter(function (r) { return r.p.gradeLvl >= 3; }).length;
  var expCount = rows.filter(function (r) { return !!r.p.expert; }).length;
  var expBad = rows.filter(function (r) { return r.p.expert && !l3ok(r.p); });
  var gc = {}, kcPerson = {};
  rows.forEach(function (r) {
    var g = r.p.grade || '未认证'; gc[g] = (gc[g] || 0) + 1;
    var seenKind = {};
    r.p.tagIdx.forEach(function (ti) {
      // 仅统计「认证」类标签，排除 理论 / 实战 / 实操 / 通用能力
      if (dv('cat', TAGS[ti][9]) !== '认证') return;
      var k = dv('kind', TAGS[ti][0]);
      if (!k) return;
      if (!seenKind[k]) { seenKind[k] = 1; kcPerson[k] = (kcPerson[k] || 0) + 1; }
    });
  });
  var gcRows = Object.keys(gc).map(function (k) {
    var m = /L([1-4])/.exec(k);
    return { name: k, v: gc[k], lv: m ? +m[1] : 0 };
  }).sort(function (a, b) { return a.lv - b.lv; });
  var kcRows = topObj(kcPerson, 10);
  var scopeTxt = DF.unit ? '部门内' : '全部单位';

  var head = '<div style="padding:18px">' +
    '<div class="info-grid">' +
      ic(DF.unit ? '部门人数' : '人员总数', members.length + ' 人', '认证明细部门口径 · 点击查看全部', '', 'all', false) +
      ic('已认证人数', certCount + ' 人', members.length ? (certCount / members.length * 100).toFixed(1) + '% 覆盖率 · 点击查看明细' : '', 'sm', 'cert', DF.special === 'cert') +
      ic('L3 及以上', l3Count + ' 人', '点击查看明细', '', 'l3plus', DF.special === 'l3plus') +
      ic('在聘专家', expCount + ' 人', (expBad.length ? expBad.length + ' 人缺 L3' : (expCount ? '全部达标' : '')) + (expCount ? ' · 点击查看明细' : ''), expBad.length ? '' : 'sm', 'exp', DF.special === 'exp') +
    '</div>' +
    (expBad.length ? '<div class="notice-warn"><svg viewBox="0 0 20 20"><path d="M10 2 1 18h18zm-1 6v5h2V8zm0 6v2h2v-2z" fill="currentColor"/></svg>' +
      '<span>强提醒：' + (DF.unit ? '本部门' : '当前范围') + '有 <strong>' + expBad.length + '</strong> 名专家尚未取得 L3 认证：' +
      expBad.slice(0, 5).map(function (r) {
        var p = r.p;
        return esc(p.name) + (p.expert && p.expert.level ? '（' + esc(p.expert.level) + '）' : '');
      }).join('、') +
      (expBad.length > 5 ? ' 等 ' + expBad.length + ' 人' : '') +
      '，请在专家看板中优先跟进。</span></div>' : '') +
    '<div class="grid-2" style="margin-top:16px">' +
      '<div><div class="ts-title" style="margin-bottom:10px">工程师等级分布（' + scopeTxt + '）<span class="chart-hint">· 点击条目查看明细</span></div>' +
        (gcRows.length ? barChart(gcRows, {
          cls: function (r) { return BAR_CLS[r.lv] || ''; },
          click: 'grade',
          active: function (r) { return DF.special === 'grade' && DF.gradeVal === r.name; }
        }) : '<div class="empty">无数据</div>') + '</div>' +
      '<div><div class="ts-title" style="margin-bottom:10px">已认证专业人数 TOP10（' + scopeTxt + '）<span class="chart-hint">· 点击条目查看明细</span></div>' +
        (kcRows.length ? barChart(kcRows, {
          cls: function () { return 'g2'; },
          val: function (r) { return r.v + ' 人'; },
          click: 'pro',
          active: function (r) { return DF.pro === r.name; }
        }) : '<div class="empty">无数据</div>') + '</div>' +
    '</div></div>';

  $('#deptHead').innerHTML = head;
  DEPT_HEAD_ROWS = { grade: gcRows, pro: kcRows };
}

/* 汇总下钻：点击 KPI 卡 / 图表条 → 名册表按该口径过滤（再点同项取消）。
   下钻是「聚焦」语义：清除其他检索条件，只保留本次点击的口径，保证名册数 = 汇总数。 */
function deptDrill(type, name) {
  if (type === 'all') {                       // 点「部门人数」= 清空全部筛选
    DF.kw = ''; DF.pro = ''; DF.lvl = ''; DF.special = ''; DF.gradeVal = '';
  } else if (type === 'grade') {              // 等级分布条目
    if (DF.special === 'grade' && DF.gradeVal === name) { DF.special = ''; DF.gradeVal = ''; }
    else { DF.kw = ''; DF.pro = ''; DF.lvl = ''; DF.special = 'grade'; DF.gradeVal = name; }
  } else if (type === 'pro') {                // TOP10 专业条目（与专业下拉联动）
    if (DF.pro === name) { DF.pro = ''; }
    else { DF.kw = ''; DF.lvl = ''; DF.special = ''; DF.gradeVal = ''; DF.pro = name; }
  } else {                                    // cert / l3plus / exp KPI 卡
    if (DF.special === type) { DF.special = ''; DF.gradeVal = ''; }
    else { DF.kw = ''; DF.pro = ''; DF.lvl = ''; DF.gradeVal = ''; DF.special = type; }
  }
  DF.page = 1;
  syncDeptSearchBar();
  renderDept();
}
/* 同步检索栏控件显示（不重建，避免丢焦点；下钻由点击触发，本就无输入焦点） */
function syncDeptSearchBar() {
  var kw = $('#dfKw'), pro = $('#dfPro'), lvl = $('#dfLvl');
  if (kw) kw.value = DF.kw;
  if (pro) pro.value = DF.pro;
  if (lvl) lvl.value = DF.lvl;
}
/* 事件委托：绑定一次，KPI 卡与图表条共用 */
function bindDeptHeadClick() {
  $('#deptHead').addEventListener('click', function (e) {
    var cell = e.target.closest('[data-ickey]');
    if (cell) { deptDrill(cell.dataset.ickey, null); return; }
    var bar = e.target.closest('[data-bclick]');
    if (bar) {
      var list = DEPT_HEAD_ROWS[bar.dataset.bclick] || [];
      var row = list[+bar.dataset.bidx];
      if (row) deptDrill(bar.dataset.bclick, row.name);
    }
  });
}

function renderDept() {
  var allMembers = deptScopeMembers();
  var hasFilter = !!((DF.kw || '').trim() || DF.pro || DF.lvl || DF.special);
  var members = deptSearchFilter(allMembers);
  renderDeptHead(allMembers);   // KPI/图表固定按部门全量，检索只影响名册表
  var spLbl = DF.special === 'grade' ? ('等级：' + DF.gradeVal) : (DF_SPECIAL_LABEL[DF.special] || '');
  $('#dfCount').textContent = hasFilter
    ? '匹配 ' + members.length + ' / ' + allMembers.length + ' 人' + (spLbl ? ' · ' + spLbl : '')
    : '共 ' + allMembers.length + ' 人（认证明细口径）';
  if (!members.length) {
    $('#deptTable').innerHTML = '<div class="empty">' + (hasFilter ? '没有符合条件的人员' : '该部门暂无人员') + '</div>';
    return;
  }
  // pi 保留 people 主档下标，供点击弹窗
  var rows = members.map(function (i) { return { p: P(i), pi: i, found: true }; });

  var pages = Math.max(1, Math.ceil(members.length / DF_SIZE));
  if (DF.page > pages) DF.page = pages;
  var sliceRows = rows.slice((DF.page - 1) * DF_SIZE, DF.page * DF_SIZE);

  var table = '<div class="table-wrap"><table><thead><tr>' +
    '<th>姓名</th><th>所属部门</th><th>云网工程师等级</th><th>最高标签等级</th>' +
    '<th>标签数</th><th>认证开始</th><th>认证结束</th><th>专家</th></tr></thead><tbody>' +
    sliceRows.map(function (r) {
      var p = r.p;
      return '<tr data-pi="' + r.pi + '" title="点击查看认证详情"' + (r.found && p.expert && !l3ok(p) ? ' class="row-danger"' : '') + '>' +
        '<td class="nowrap">' + esc(p.name) + '</td>' +
        '<td>' + esc(p.dept) + '</td>' +
        '<td class="nowrap">' + (r.found && p.grade ? '<span class="badge ' + (LVL_CLS['L' + p.gradeLvl] || 'b-gray') + '">' + esc(p.grade) + '</span>' : '<span class="badge b-gray">未认证</span>') + '</td>' +
        '<td class="nowrap">' + (r.found && p.maxTagLvl ? '<span class="badge ' + LVL_CLS['L' + p.maxTagLvl] + '">' + LVNAME[p.maxTagLvl] + '</span>' : '<span class="badge b-gray">无</span>') + '</td>' +
        '<td>' + (r.found ? p.tagIdx.length : '—') + '</td>' +
        '<td class="nowrap">' + (r.found ? dateText(p.start) : '—') + '</td>' +
        '<td class="nowrap">' + (r.found ? dateText(p.end) : '—') + '</td>' +
        '<td class="nowrap">' + (r.found && p.expert
          ? '<span class="badge ' + (l3ok(p) ? 'b-ok' : 'b-solid-red') + '">' + esc(p.expert.level) + (l3ok(p) ? '' : ' 缺L3') + '</span>'
          : '<span class="badge b-gray">—</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div id="dfPager"></div>';

  $('#deptTable').innerHTML = table;
  pager('#dfPager', members.length, DF_SIZE, DF.page, function (n) { DF.page = n; renderDept(); });
  // 点击行弹出该人员认证详情（与人才池「详情」弹窗一致）
  $$('#deptTable tr[data-pi]').forEach(function (tr) {
    tr.addEventListener('click', function () { openDetail(+tr.dataset.pi); });
  });
}
$('#deptExport').addEventListener('click', function () {
  var members = deptScopeMembers();
  var rows = members.map(function (i) {
    var p = P(i);
    return [p.name, p.code, p.dept,
            p.grade ? p.grade : '未认证',
            LVNAME[p.maxTagLvl] || '无', LVNAME[p.bestLvl] || '无',
            p.tagIdx.length, p.start, p.end, p.status,
            p.expert ? p.expert.level : '', p.expert ? (l3ok(p) ? '达标' : '缺L3') : ''];
  });
  downloadCSV('部门人才名册_' + (DF.unit || '全部单位') + '_' + stamp() + '.csv',
    ['姓名', '人力编码', '部门', '工程师等级', '最高标签等级', '最高等级', '标签数',
     '认证开始', '认证结束', '状态', '专家层次', '专家L3状态'], rows);
});

/* ============================ 工作视图：认证规则查询 ============================ */
var WORK = { tab: 'detail', kw: '', page: 1 };
var WORK_SIZE = 25;
var WORK_TABS = [
  { k: 'detail', l: '规则明细（云网/研发）' },
  { k: 'summary', l: '规则汇总' },
  { k: 'qualification', l: '从业标签' }
];
var RULE_INDEX = {};   // 三级标签 -> row
var RULE_NAMES = [];
var RULE_PROS = [];     // 专业（去等级后的前缀）
var RULE_LEVELS = [];   // 等级 L1-L6
var RULE_MAP = {};      // (pro|lvl) -> [rows]
function splitProLvl(name) {
  var m = /^([\s\S]*?)\s*L([1-6])$/i.exec(name);
  if (!m) return null;
  return { pro: m[1].trim(), lvl: 'L' + m[2].toUpperCase() };
}
// 去掉子标签末尾的「种类后缀」：专业Lx（理论）/（实操）/（实战/项目）→ 专业Lx
// 例：「MSS运营式开发L2（理论）」→「MSS运营式开发L2」，便于按「专业+等级」归一匹配
function stripKindSuffix(s) {
  return String(s || '').replace(/[（(][^（）()]*[）)]\s*$/, '').trim();
}
// 规范化「专业+等级」key：先去种类后缀，再剥离「前缀-」只保留短专业名
// 兼容：规则长名「客户网络产品及业务交付运营-5G定制网L1」、子标签短名「5G定制网L1」、
//       带种类后缀的子标签「MSS运营式开发L2（理论）」→ 统一归一为「5G定制网|L1」「MSS运营式开发|L2」
function canonPro(l3) {
  if (!l3) return '';
  var core = stripKindSuffix(l3);
  var pl = splitProLvl(core);
  if (!pl) return '';
  var pro = pl.pro.indexOf('-') >= 0 ? pl.pro.split('-').pop() : pl.pro;
  return pro + '|' + pl.lvl;
}
function buildRuleIndex() {
  var d = D.rules && D.rules.detail ? D.rules.detail.rows : [];
  RULE_INDEX = {}; RULE_NAMES = []; RULE_PROS = []; RULE_LEVELS = []; RULE_MAP = {};
  var pros = {}, lvls = {};
  d.forEach(function (r) {
    var name = String(r[3] || '').trim();
    if (!name) return;
    RULE_INDEX[name] = r;
    RULE_NAMES.push(name);
    var pl = splitProLvl(name);
    if (!pl) return;
    pros[pl.pro] = 1; lvls[pl.lvl] = 1;
    var key = pl.pro + '|' + pl.lvl;
    if (!RULE_MAP[key]) RULE_MAP[key] = [];
    RULE_MAP[key].push(r);
  });
  RULE_PROS = Object.keys(pros).sort(function (a, b) { return a.localeCompare(b, 'zh'); });
  RULE_LEVELS = Object.keys(lvls).sort();
}
function queryByPL(pro, lvl) {
  if (!pro) return [];
  if (!lvl) {
    // 仅输入专业、未选等级：返回该专业全部等级规则
    var out = [];
    RULE_LEVELS.forEach(function (l) {
      var rows = RULE_MAP[pro + '|' + l];
      if (rows) out = out.concat(rows);
    });
    return out;
  }
  return RULE_MAP[pro + '|' + lvl] || [];
}
function renderRuleCard(r) {
  function c(i) { return String(r[i] || '').trim(); }
  function has(i) { return !!r[i] && String(r[i]).trim(); }
  function reqCard(label, name, code, src, color) {
    if (!name) return '';
    return '<div class="req-card ' + color + '">' +
      '<div class="req-type">' + esc(label) + '</div>' +
      '<div class="req-name">' + esc(name) + '</div>' +
      '<div class="req-meta">编码：' + esc(code || '—') + ' · 来源：' + esc(src || '—') + '</div>' +
      '</div>';
  }
  // 解析合成规则中的附加要求（如「+ 通用能力」「+ 从业标签」），避免与已列出的理论/实操/实战重复
  function extraReqs() {
    var synth = c(5);
    if (!synth) return [];
    var parts = synth.split('=');
    var last = parts[parts.length - 1].trim();
    if (!last) return [];
    function norm(s) { return String(s).replace(/\s+/g, ''); }
    var seen = {};
    var listed = [c(7), c(10), c(13), c(3)].filter(Boolean);
    listed.forEach(function (x) { seen[x] = true; });
    return last.split('+').map(function (x) { return x.trim(); }).filter(function (x) {
      if (!x) return false;
      // 若额外要求与已列出的认证要求实质相同（去空格后互为子串），则视为重复
      var nx = norm(x);
      var dup = listed.some(function (y) {
        var ny = norm(y);
        return ny.indexOf(nx) >= 0 || nx.indexOf(ny) >= 0;
      });
      if (dup || seen[x]) return false;
      seen[x] = true;
      return true;
    });
  }
  var extras = extraReqs();
  var commonExtras = extras.filter(function (x) { return x === '通用能力'; });
  var otherExtras = extras.filter(function (x) { return x !== '通用能力'; });
  var reqs = '';
  if (has(7) || has(10) || has(13) || commonExtras.length || otherExtras.length) {
    reqs = '<div class="req-list">' +
      reqCard('理论认证', c(7), c(8), c(9), 'req-theory') +
      reqCard('实操认证', c(10), c(11), c(12), 'req-practice') +
      reqCard('实战/项目认证', c(13), c(14), c(15), 'req-project') +
      commonExtras.map(function (x) { return reqCard('通用能力', x, '', '', 'req-common'); }).join('') +
      otherExtras.map(function (x) { return reqCard('其他要求', x, '', '', 'req-extra'); }).join('') +
      '</div>';
  } else {
    reqs = '<div class="rule-empty" style="margin:12px 0">该等级暂无明确合成规则或仅需满足前置条件</div>';
  }
  var lv = (c(3).match(/L[1-6]/) || [''])[0];
  var headTags = commonExtras.map(function (x) {
    return '<span class="rule-head-tag">' + esc(x) + '</span>';
  }).join('');
  return '<div class="rule-card">' +
    '<div class="rule-card-head">' +
      '<div class="rule-tag-lv">' + (lv || '—') + '</div>' +
      '<div>' +
        '<div class="rule-tag-name">' + esc(c(3)) + '</div>' +
        '<div class="rule-tag-path">' + esc(c(0)) + ' / ' + esc(c(1)) + ' / ' + esc(c(2)) + '</div>' +
        (headTags ? '<div class="rule-head-tags">' + headTags + '</div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="rule-section"><div class="rule-sec-title">认证要求</div>' + reqs + '</div>' +
    (c(5) ? '<div class="rule-section"><div class="rule-sec-title">合成规则</div><div class="rule-text">' + esc(c(5)).replace(/\n/g, '<br>') + '</div></div>' : '') +
    (c(6) ? '<div class="rule-section"><div class="rule-sec-title">前置条件</div><div class="rule-text">' + esc(c(6)).replace(/\n/g, '<br>') + '</div></div>' : '') +
    '</div>';
}
function renderRuleResult(rows) {
  var box = $('#ruleResult');
  if (!rows || !rows.length) {
    box.innerHTML = '<div class="rule-empty">请选择「专业」与「等级」后查询；当前未找到匹配的认证规则</div>';
    return;
  }
  box.innerHTML = rows.map(renderRuleCard).join('');
}
function doRuleQuery() {
  var pro = $('#rulePro').value.trim();
  var lvl = $('#ruleLvl').value.trim();
  if (!pro) {
    renderRuleResult(null);
    return;
  }
  // 输入的专业不在规则库中：给出明确提示（避免空结果让用户困惑）
  if (RULE_PROS.indexOf(pro) < 0) {
    $('#ruleResult').innerHTML = '<div class="rule-empty">未找到「' + esc(pro) + '」相关专业，请从下拉列表中选择或输入完整专业名称</div>';
    return;
  }
  renderRuleResult(queryByPL(pro, lvl));
}
function renderWorkTabs() {
  $('#workTabs').innerHTML = WORK_TABS.map(function (t) {
    return '<button class="' + (WORK.tab === t.k ? 'on' : '') + '" data-tab="' + t.k + '">' + esc(t.l) + '</button>';
  }).join('');
  $$('#workTabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      WORK.tab = this.dataset.tab; WORK.page = 1; WORK.kw = ''; $('#workSearch').value = '';
      renderWorkTabs(); renderWorkTable();
    });
  });
}
function renderWorkTable() {
  var src = D.rules[WORK.tab] || { headers: [], rows: [] };
  var kw = WORK.kw.toLowerCase();
  var rows = src.rows.filter(function (r) {
    if (!kw) return true;
    return r.some(function (c) { return String(c || '').toLowerCase().indexOf(kw) >= 0; });
  });
  var pages = Math.max(1, Math.ceil(rows.length / WORK_SIZE));
  if (WORK.page > pages) WORK.page = pages;
  var slice = rows.slice((WORK.page - 1) * WORK_SIZE, WORK.page * WORK_SIZE);
  var html = '<table class="data-table compact"><thead><tr>' +
    src.headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
    '</tr></thead><tbody>' +
    (slice.length ? slice.map(function (r) {
      return '<tr>' + r.map(function (c) {
        var s = String(c || '').replace(/\n/g, '<br>');
        return '<td>' + (s ? s : '<span class="na">—</span>') + '</td>';
      }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + src.headers.length + '"><div class="empty">无匹配规则</div></td></tr>') +
    '</tbody></table>';
  $('#workTable').innerHTML = html;
  $('#workCount').textContent = '共 ' + fmt(rows.length) + ' 条';
  pager('#workPager', rows.length, WORK_SIZE, WORK.page, function (n) { WORK.page = n; renderWorkTable(); });
}
function renderWork() {
  buildRuleIndex();
  // 填充「专业」输入框的自定义下拉候选列表，支持输入+下拉选择
  ruleProPopulate();
  // 填充「等级」下拉（L1-L6）
  $('#ruleLvl').innerHTML = '<option value="">选择等级</option>' +
    RULE_LEVELS.map(function (l) { return '<option value="' + esc(l) + '">' + esc(l) + '</option>'; }).join('');
  renderRuleResult(null);
  renderWorkTabs(); renderWorkTable();
}

function ruleProPopulate() {
  RULE_PROS_CANDIDATES = RULE_PROS.slice();
  ruleProDropdownItems(RULE_PROS_CANDIDATES);
}

function ruleProDropdownItems(items) {
  var ul = $('#ruleProDropdown');
  if (!items.length) {
    ul.innerHTML = '<li class="empty">无匹配专业</li>';
    return;
  }
  ul.innerHTML = items.map(function (k) {
    return '<li data-value="' + esc(k) + '" title="' + esc(k) + '">' + esc(k) + '</li>';
  }).join('');
}

function ruleProShowDropdown(show) {
  var ul = $('#ruleProDropdown');
  if (show) ul.classList.add('show'); else ul.classList.remove('show');
}

function ruleProToggleDropdown() {
  var showing = $('#ruleProDropdown').classList.contains('show');
  if (showing) { ruleProShowDropdown(false); }
  else { ruleProDropdownItems(RULE_PROS_CANDIDATES); ruleProShowDropdown(true); }
}

function ruleProFilter(text) {
  var low = text.toLowerCase();
  var items = RULE_PROS_CANDIDATES.filter(function (k) { return k.toLowerCase().indexOf(low) >= 0; });
  ruleProDropdownItems(items);
  ruleProShowDropdown(true);
}

// 专业输入框：支持输入过程中实时提示 + 选中/回车触发查询
var RULE_PROS_CANDIDATES = [];
var ruleProTimer;
$('#rulePro').addEventListener('input', function () {
  ruleProFilter(this.value);
  clearTimeout(ruleProTimer);
  if (!this.value.trim()) { doRuleQuery(); return; }
  ruleProTimer = setTimeout(doRuleQuery, 200);
});
$('#rulePro').addEventListener('focus', function () { ruleProFilter(this.value); });
$('#ruleProToggle').addEventListener('click', function (e) { e.stopPropagation(); ruleProToggleDropdown(); });
$('#ruleProDropdown').addEventListener('click', function (e) {
  var li = e.target.closest('li[data-value]');
  if (!li) return;
  $('#rulePro').value = li.getAttribute('data-value');
  ruleProShowDropdown(false);
  doRuleQuery();
});
document.addEventListener('click', function (e) { if (!e.target.closest('.rule-combo')) ruleProShowDropdown(false); });
$('#rulePro').addEventListener('change', doRuleQuery);
$('#rulePro').addEventListener('keydown', function (e) { if (e.key === 'Enter') doRuleQuery(); });
$('#ruleLvl').addEventListener('change', doRuleQuery);
$('#ruleQueryBtn').addEventListener('click', doRuleQuery);
$('#ruleRawToggle').addEventListener('click', function () {
  var el = $('#ruleRaw');
  var show = el.style.display === 'none';
  el.style.display = show ? 'block' : 'none';
  this.textContent = show ? '收起 ▲' : '展开 ▼';
});
$('#workSearch').addEventListener('input', function () {
  WORK.kw = this.value.trim(); WORK.page = 1; renderWorkTable();
});

/* ============================ 认证报名 ============================ */
var EXAM = { status: '', name: '', dir: '', lvl: '', kw: '', page: 1 };
var EXAM_SIZE = 10;
var EXAM_LIST = [];

function renderExamSummary() {
  var box = $('#examSummary');
  var stats = D.exam_stats || {};
  if (!stats.status || !stats.status.length) {
    box.innerHTML = '';
    return;
  }
  // 状态统计：转成卡片
  var statusRows = stats.status;
  var statusHtml = '<div class="exam-summary-title">报名状态统计</div>' +
    '<div class="exam-status-cards">' +
    statusRows.map(function (row) {
      var name = row[0] || '—';
      var cnt = row[1] || 0;
      var pct = row[2] || '';
      var cls = name === '已过期' ? 'st-expired' : name === '进行中' ? 'st-run' : name === '认证报名中' ? 'st-reg' : name === '评审材料填报中' ? 'st-fill' : 'st-total';
      return '<div class="exam-status-card ' + cls + '">' +
        '<div class="exam-status-n">' + esc(String(cnt)) + '</div>' +
        '<div class="exam-status-l">' + esc(name) + '</div>' +
        '<div class="exam-status-p">' + esc(pct) + '</div>' +
      '</div>';
    }).join('') + '</div>';

  box.innerHTML = '<div class="exam-summary-box">' + statusHtml + '</div>';
}

function examUnique(keyFn) {
  var m = {};
  EXAMS.forEach(function (e) { if (keyFn(e)) m[keyFn(e)] = 1; });
  return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'zh'); });
}
function renderExamFilters() {
  $('#examStatus').innerHTML = '<option value="">全部状态</option>' +
    examUnique(function (e) { return e.status; }).map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
  $('#examName').innerHTML = '<option value="">全部认证名称</option>' +
    examUnique(function (e) { return e.name; }).map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
  $('#examDir').innerHTML = '<option value="">全部认证方向</option>' +
    examUnique(function (e) { return e.direction; }).map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');
  $('#examLvl').innerHTML = '<option value="">全部等级</option>' +
    ['L1','L2','L3','L4','L5','L6'].map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
}
function renderExamCard(e) {
  var expired = e.reg_end_sort && e.reg_end_sort < nowTs();
  var statusClass = expired ? 'status-expired' : examStatusClass(e.status);
  var badge = '<span class="exam-status ' + statusClass + '">' + esc(e.status) + '</span>';
  if (expired) badge += '<span class="exam-status status-expired">已过期</span>';
  var regRange = (e.reg_start || '—') + ' 至 ' + (e.reg_end || '—');
  var examRange = (e.exam_start || '—') + (e.exam_end ? ' ~ ' + e.exam_end : '');
  var matRange = (e.material_start || '—') + (e.material_end ? ' ~ ' + e.material_end : '');
  return '<div class="exam-card ' + (expired ? 'expired' : '') + '">' +
    '<div class="exam-card-head">' +
      '<div class="exam-card-title">' + esc(e.title) + '</div>' +
      '<div class="exam-card-badges">' + badge + '</div>' +
    '</div>' +
    '<div class="exam-card-meta">' +
      '<span><b>认证名称</b>' + esc(e.name) + '</span>' +
      '<span><b>认证方向</b>' + esc(e.direction) + '</span>' +
      '<span><b>等级</b>' + esc(e.level) + '</span>' +
    '</div>' +
    '<div class="exam-card-dates">' +
      '<div><i class="dt-icon dt-reg"></i><b>认证报名时间</b><span>' + regRange + '</span></div>' +
      '<div><i class="dt-icon dt-exam"></i><b>理论考试时间</b><span>' + examRange + '</span></div>' +
      (e.material_start ? '<div><i class="dt-icon dt-mat"></i><b>评审材料填报</b><span>' + matRange + '</span></div>' : '') +
    '</div>' +
  '</div>';
}
function renderExam() {
  if (!EXAMS.length) {
    $('#examList').innerHTML = '<div class="empty">暂无考试报名数据</div>';
    $('#examCount').textContent = '0 条';
    return;
  }
  var kw = EXAM.kw.trim().toLowerCase();
  var list = EXAMS.filter(function (e) {
    if (EXAM.status && e.status !== EXAM.status) return false;
    if (EXAM.name && e.name !== EXAM.name) return false;
    if (EXAM.dir && e.direction !== EXAM.dir) return false;
    if (EXAM.lvl && (e.level || '').indexOf(EXAM.lvl) < 0) return false;
    if (kw) {
      var txt = (e.title + '|' + e.name + '|' + e.direction + '|' + e.level).toLowerCase();
      return txt.indexOf(kw) >= 0;
    }
    return true;
  });
  var now = nowTs();
  // 排序：① 未过期且已知截止时间 ② 已过期且已知截止时间 ③ 截止时间缺失/未知
  // 避免旧数据因截止时间解析为空而排在最前面
  list.sort(function (a, b) {
    function key(e) {
      var s = e.reg_end_sort || 0;
      if (!s) return 2;          // 截止时间未知 -> 最底
      return s < now ? 1 : 0;    // 0=未过期(最前), 1=已过期(中间)
    }
    var ak = key(a), bk = key(b);
    if (ak !== bk) return ak - bk;
    return (a.reg_end_sort || 0) - (b.reg_end_sort || 0);
  });
  $('#examCount').textContent = fmt(list.length) + ' 条';
  EXAM_LIST = list;
  var pages = Math.max(1, Math.ceil(list.length / EXAM_SIZE));
  if (EXAM.page > pages) EXAM.page = pages;
  var slice = list.slice((EXAM.page - 1) * EXAM_SIZE, EXAM.page * EXAM_SIZE);
  $('#examList').innerHTML = slice.length ? slice.map(renderExamCard).join('') :
    '<div class="empty">无匹配报名批次</div>';
  // 专业方向筛选状态条
  var ci = $('#examCrossInfo');
  if (ci) {
    if (EXAM.dir) {
      ci.innerHTML = '<span class="xchip">已按专业方向筛选：<b>' + esc(EXAM.dir) + '</b>' +
        ' <button id="examCrossClear" class="xchip-x" type="button">✕ 清除</button></span>';
      $('#examCrossClear').addEventListener('click', function () { resetExam(); });
    } else { ci.innerHTML = ''; }
  }
  pager('#examPager', list.length, EXAM_SIZE, EXAM.page, function (n) { EXAM.page = n; renderExam(); });
}
function doExamQuery() {
  EXAM.status = $('#examStatus').value;
  EXAM.name = $('#examName').value;
  EXAM.dir = $('#examDir').value;
  EXAM.lvl = $('#examLvl').value;
  EXAM.kw = $('#examKw').value;
  EXAM.page = 1;
  renderExam();
}
function resetExam() {
  EXAM = { status: '', name: '', dir: '', lvl: '', kw: '', page: 1 };
  $('#examStatus').value = ''; $('#examName').value = '';
  $('#examDir').value = ''; $('#examLvl').value = ''; $('#examKw').value = '';
  renderExam();
}
$('#examStatus').addEventListener('change', doExamQuery);
$('#examName').addEventListener('change', doExamQuery);
$('#examDir').addEventListener('change', doExamQuery);
$('#examLvl').addEventListener('change', doExamQuery);
$('#examKw').addEventListener('input', function () { doExamQuery(); });
$('#examQueryBtn').addEventListener('click', doExamQuery);
$('#examResetBtn').addEventListener('click', resetExam);
$('#examExport').addEventListener('click', function () {
  if (!EXAM_LIST.length) { alert('当前无可导出的报名批次，请先执行查询。'); return; }
  var rows = EXAM_LIST.map(function (e) {
    return [e.title, e.name, e.direction, e.level, e.status,
            e.reg_start || '', e.reg_end || '', e.exam_start || '', e.exam_end || '',
            e.material_start || '', e.material_end || ''];
  });
  downloadCSV('认证报名批次_' + stamp() + '.csv',
    ['批次标题', '认证名称', '认证方向', '等级', '状态',
     '报名开始', '报名截止', '理论考试开始', '理论考试结束', '评审材料开始', '评审材料结束'], rows);
});

/* 兼容旧调用：保留 CSV 作为 fallback（内部不再使用，但保留以防万一） */
function csvCell(v) {
  v = String(v == null ? '' : v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function downloadCSV(filename, headers, rows) {
  if (!rows.length) { alert('当前筛选结果为空，无可导出数据。'); return; }
  var csv = '\ufeff' + [headers.map(csvCell).join(',')]
    .concat(rows.map(function (r) { return r.map(csvCell).join(','); })).join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
}
function stamp() {
  var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
}

/* ============================ L3 人才池 ============================ */
var PF = { dept: '', lvl: '', exp: '', page: 1 };
var PF_SIZE = 25;
function poolArr() { return ALL.filter(function (i) { return l3ok(P(i)); }); }
function poolFiltered() {
  return poolArr().filter(function (i) {
    var p = P(i);
    if (PF.dept && p.dept !== PF.dept) return false;
    if (PF.lvl && p.bestLvl !== +PF.lvl) return false;
    if (PF.exp === 'yes' && !p.expert) return false;
    if (PF.exp === 'no' && p.expert) return false;
    return true;
  });
}
function renderPoolFilter() {
  var dpts = {};
  poolArr().forEach(function (i) { dpts[P(i).dept] = 1; });
  $('#poolFilter').innerHTML =
    sel('pfDept', '全部部门', Object.keys(dpts).sort(), PF.dept) +
    sel('pfLvl', '全部等级', ['3', '4'], PF.lvl) +
    sel('pfExp', '不限', ['yes', 'no'], PF.exp) +
    '<span class="f-label" id="pfCount"></span>';
  $('#pfDept').addEventListener('change', function () { PF.dept = this.value; PF.page = 1; renderPool(); });
  $('#pfLvl').addEventListener('change', function () { PF.lvl = this.value; PF.page = 1; renderPool(); });
  $('#pfExp').addEventListener('change', function () { PF.exp = this.value; PF.page = 1; renderPool(); });
}
function renderPool() {
  renderPoolFilter();
  var list = poolFiltered();
  var pages = Math.max(1, Math.ceil(list.length / PF_SIZE));
  if (PF.page > pages) PF.page = pages;
  var slice = list.slice((PF.page - 1) * PF_SIZE, PF.page * PF_SIZE);
  var mask = $('#poolMask').checked;

  var byLvl = { 3: 0, 4: 0 };
  var inExpert = 0, deptCnt = {};
  var poolAll = poolArr();
  poolAll.forEach(function (i) {
    var p = P(i);
    byLvl[p.bestLvl] = (byLvl[p.bestLvl] || 0) + 1;
    if (p.expert) inExpert++;
    deptCnt[p.dept] = (deptCnt[p.dept] || 0) + 1;
  });
  var topDept = topObj(deptCnt, 1)[0];

  $('#poolKpi').innerHTML = [
    kpi('L3 及以上人才', fmt(poolAll.length), '人',
        (ALL.length ? (poolAll.length / ALL.length * 100).toFixed(1) : 0) + '% 占认证人数', 'k-dk'),
    kpi('其中 L3', fmt(byLvl[3] || 0), '人', '具备 L3 等级', 'k-warn'),
    kpi('其中 L4', fmt(byLvl[4] || 0), '人', '最高等级人才', ''),
    kpi('已聘为专家', fmt(inExpert), '人',
        '后备池 ' + fmt(poolAll.length - inExpert) + ' 人', 'k-ok'),
    kpi('人数最多部门', topDept ? topDept.name : '—', '', topDept ? (topDept.v + ' 人') : '', '')
  ].join('');
  $('#pfCount').textContent = '共 ' + fmt(list.length) + ' 人';

  $('#poolTable').innerHTML = '<table><thead><tr>' +
    '<th>姓名</th><th>所属部门</th><th>工程师等级</th><th>最高标签等级</th><th>最高等级</th>' +
    '<th>标签总数</th><th>L3+标签数</th><th>认证开始</th><th>认证结束</th><th>专家</th><th>操作</th>' +
    '</tr></thead><tbody>' +
    (slice.length ? slice.map(function (i) {
      var p = P(i);
      var n3 = p.tagIdx.filter(function (ti) { var l = dv('lvl', TAGS[ti][1]); return l === 'L3' || l === 'L4'; }).length;
      return '<tr' + (p.expert && !l3ok(p) ? ' class="row-danger"' : '') + '>' +
        '<td class="nowrap">' + esc(mask ? maskName(p.name) : p.name) + '</td>' +
        '<td>' + esc(p.dept) + '</td>' +
        '<td class="nowrap">' + (p.grade ? '<span class="badge ' + (LVL_CLS['L' + p.gradeLvl] || 'b-gray') + '">' + esc(p.grade) + '</span>' : '<span class="badge b-gray">未认证</span>') + '</td>' +
        '<td class="nowrap">' + (p.maxTagLvl ? '<span class="badge ' + LVL_CLS['L' + p.maxTagLvl] + '">' + LVNAME[p.maxTagLvl] + '</span>' : '<span class="badge b-gray">无</span>') + '</td>' +
        '<td class="nowrap"><strong>' + (p.bestLvl ? LVNAME[p.bestLvl] : '—') + '</strong></td>' +
        '<td>' + p.tagIdx.length + '</td><td>' + n3 + '</td>' +
        '<td class="nowrap">' + dateText(p.start) + '</td>' +
        '<td class="nowrap">' + dateText(p.end) + '</td>' +
        '<td class="nowrap">' + (p.expert
          ? '<span class="badge ' + (l3ok(p) ? 'b-ok' : 'b-solid-red') + '">' + esc(p.expert.level) + '</span>'
          : '<span class="badge b-gray">—</span>') + '</td>' +
        '<td class="nowrap"><span class="row-link" data-detail="' + i + '">详情</span></td></tr>';
    }).join('') : '<tr><td colspan="11"><div class="empty">无符合条件的人才</div></td></tr>') +
    '</tbody></table>';
  pager('#poolPager', list.length, PF_SIZE, PF.page, function (n) { PF.page = n; renderPool(); });
  $$('#poolTable [data-detail]').forEach(function (el) {
    el.addEventListener('click', function () { openDetail(+el.dataset.detail); });
  });
}
/* ============================ 分页 ============================ */
function pager(el, total, size, cur, cb) {
  var pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) { $(el).innerHTML = ''; return; }
  var nums = [];
  var s = Math.max(1, cur - 2), e = Math.min(pages, s + 4);
  s = Math.max(1, e - 4);
  for (var i = s; i <= e; i++) nums.push(i);
  $(el).innerHTML = '<div class="pager">' +
    '<button' + (cur <= 1 ? ' disabled' : '') + ' data-p="' + (cur - 1) + '">上一页</button>' +
    (s > 1 ? '<button data-p="1">1</button><span style="color:var(--tx-3)">…</span>' : '') +
    nums.map(function (n) {
      return '<button class="' + (n === cur ? 'on' : '') + '" data-p="' + n + '">' + n + '</button>';
    }).join('') +
    (e < pages ? '<span style="color:var(--tx-3)">…</span><button data-p="' + pages + '">' + pages + '</button>' : '') +
    '<button' + (cur >= pages ? ' disabled' : '') + ' data-p="' + (cur + 1) + '">下一页</button>' +
    '<span class="p-info">共 ' + fmt(total) + ' 条 / ' + pages + ' 页</span></div>';
  $$('#' + el.slice(1) + ' button[data-p]').forEach(function (b) {
    b.addEventListener('click', function () { cb(+b.dataset.p); });
  });
}

/* ============================ 全局检索 ============================ */
$('#globalSearch').addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var q = this.value.trim();
  if (!q) return;
  switchView('search');
  $('#sName').value = q;
  renderSuggest(q);
  $('#sCode').focus();
});

/* ============================ 认证指引 ============================ */
// 归一化标签名：去掉等级 Lx 与括号等级，用于跨数据源对齐（人员子标签 ↔ 规则要求标签）
function normLabel(s) {
  s = (s || '').trim();
  if (!s) return '';
  s = s.replace(/(?<![0-9])L[1-6](?![0-9])/g, '');          // 去掉 L1-L6
  s = s.replace(/[（(]\s*L[1-6]\s*-\s*L[1-6]\s*[）)]/g, '');  // 去 （Lx-Ly）
  s = s.replace(/[（(]\s*L[1-6]\s*[）)]/g, '');              // 去 （Lx）
  s = s.replace(/\s+([（(])/g, '$1');                        // 括号前多余空格
  return s.trim();
}
var PERSON_BY_CODE = {};
function buildPersonIndex() {
  PERSON_BY_CODE = {};
  (D.people || []).forEach(function (p) { PERSON_BY_CODE[String(p[0]).trim()] = p; });
}
var CERT_RULES = [], RULE_BY_KEY = {};
function buildCertIndex() {
  CERT_RULES = (D.rules && D.rules.detail) ? D.rules.detail.rows : [];
  RULE_BY_KEY = {};
  CERT_RULES.forEach(function (r) {
    var pl = splitProLvl(r[3] || '');
    if (pl) { var k = pl.pro + '|' + pl.lvl; if (!RULE_BY_KEY[k]) RULE_BY_KEY[k] = r; }
  });
}
var CAT_NAMES = ['认证', '实战', '理论', '通用能力', '实操'];
function personTags(p) {
  var dL3 = D.dict.l3;
  return (p[13] || []).map(function (ti) {
    var t = D.tags[ti];
    var l3 = dL3[t[6]] || '';
    var pl = splitProLvl(l3);
    return {
      l3: l3,
      pro: pl ? pl.pro : '',
      lvl: pl ? pl.lvl : '',
      key: canonPro(l3),
      cat: CAT_NAMES[t[9]] || '认证',
      norm: normLabel(l3)
    };
  });
}
// 按证书全名定位规则：兼容「子标签短名」与「规则长名」的专业前缀漂移
// 例：人员持有 5G定制网L1，规则三级标签为 客户网络产品及业务交付运营-5G定制网L1
function findRuleByCertName(name) {
  if (!name) return null;
  for (var i = 0; i < CERT_RULES.length; i++) {
    var t = CERT_RULES[i][3] || '';
    if (t === name || t.indexOf('-' + name) >= 0 || t.endsWith(name)) return CERT_RULES[i];
  }
  return null;
}
// 计算某人所有相关认证及缺口
// 匹配原则：① 用「完整标签（含等级）」精确匹配，不做归一化；② 高等级标签不覆盖低等级，低等级也不满足高等级
// ③ 专业名做前缀归一（canonPro），兼容「子标签短名」与「规则长名」的前缀漂移
function computeGuide(p) {
  var tags = personTags(p);
  // 已持有「认证」类标签 -> 该认证视为已完成（按规范化 key）
  var certDoneMap = {};
  tags.forEach(function (t) { if (t.cat === '认证' && t.key) certDoneMap[t.key] = true; });
  // 子项（理论/实操/实战）是否满足：要求「专业+等级+种类」完全一致才算达成（高不覆盖低）
  function subDone(reqLabel, kind) {
    return tags.some(function (t) {
      if (t.cat !== kind && t.cat !== '认证') return false;
      // 优先精确匹配（处理「云计算规划L2实战业绩评价达标」等不规则标签）
      if (t.l3 === reqLabel) return true;
      // 再用规范化 key 匹配（处理带后缀/前缀漂移）
      var key = canonPro(reqLabel);
      return key && t.key === key;
    });
  }
  // ruleKeys: 因持有「认证/理论/实操/实战」标签而需要关注的认证（key 沿用 RULE_BY_KEY 原始 key，便于回查规则）
  var ruleKeys = {}, heldCert = {};
  tags.forEach(function (t) {
    if (t.cat === '认证') {
      var r = findRuleByCertName(t.l3);
      if (r) {
        var pl = splitProLvl(r[3]);
        if (pl) { var k = pl.pro + '|' + pl.lvl; ruleKeys[k] = true; }
      }
      else { heldCert[t.l3] = t.l3; }
    } else {
      // 理论/实操/实战 子标签：按完整标签名精确匹配或规范化 key 匹配，避免空 key 误命中
      for (var k in RULE_BY_KEY) {
        var rr = RULE_BY_KEY[k];
        var reqs = [rr[7], rr[10], rr[13]];
        if (reqs.some(function (lab) {
            if (!lab) return false;
            if (lab === t.l3) return true;                       // 完整标签名精确匹配
            var key = canonPro(lab);
            return key && key === t.key;                          // 非空规范化 key 匹配
          })) { ruleKeys[k] = true; break; }
      }
    }
  });
  var out = [], seen = {};
  Object.keys(ruleKeys).forEach(function (k) {
    var r = RULE_BY_KEY[k];
    if (!r) return;
    var ckey = canonPro(r[3]);                                  // 规范化 key，用于回查 certDoneMap
    var certDone = !!(ckey && certDoneMap[ckey]);              // 已持有「种类=认证」标签则视为已获得该认证
    var compDefs = [
      { kind: '理论', label: r[7] },
      { kind: '实操', label: r[10] },
      { kind: '实战', label: r[13] }
    ].filter(function (c) { return !!c.label; });
    var comps = compDefs.map(function (c) {
      var done = certDone || subDone(c.label, c.kind);
      return { kind: c.kind, label: c.label, done: done };
    });
    var missingDefs = compDefs.filter(function (c) { return !(certDone || subDone(c.label, c.kind)); });
    var missing = missingDefs.map(function (c) { return c.label; });
    // 可报名考试：只推荐「缺项」子项种类对应的考试；同种类无匹配时提示「待省公司通知」
    var exams = [], seenKinds = {};
    missingDefs.forEach(function (c) {
      var k = c.kind;
      if (!k || seenKinds[k]) return;
      seenKinds[k] = true;
      var matches = findExamMatches(r[3], [k], 1);
      if (matches.length) {
        exams = exams.concat(matches);
      } else {
        exams.push({ kind: k, pending: true });
      }
    });
    out.push({
      cert: r[3],
      alias: (r[5] || '').split('=')[0].trim(),
      synth: r[5] || '',
      prereq: r[6] || '',
      comps: comps,
      done: compDefs.length === 0 ? true : missing.length === 0,
      missing: missing,
      exams: exams
    });
    seen[k] = true;
  });
  // 已获得认证但规则库未收录：如实告知，无法分析子项
  Object.keys(heldCert).forEach(function (k) {
    if (seen[k]) return;
    out.push({ cert: heldCert[k], alias: '', synth: '', prereq: '', comps: [], done: true, missing: [], noRule: true });
  });
  out.sort(function (a, b) { return (a.missing.length ? 0 : 1) - (b.missing.length ? 0 : 1); });
  return out;
}
function findExamMatches(cert, kinds, limit) {
  if (!EXAMS.length) return [];
  var pl = splitProLvl(cert);
  var pro = pl ? pl.pro : cert.replace(/L[1-6]$/i, '').trim();
  var lvl = (cert.match(/L([1-6])$/i) || ['', ''])[1];
  lvl = lvl ? 'L' + lvl.toUpperCase() : '';
  function score(e) {
    var n = e.name, d = e.direction;
    if (!pro || !n) return 0;
    if (n === pro || d === pro) return 100;
    if (n.indexOf(pro) >= 0 || pro.indexOf(n) >= 0 || (d && d.indexOf(pro) >= 0) || (pro.indexOf(d) >= 0 && d)) return 50;
    return 0;
  }
  return EXAMS.filter(function (e) {
    if (kinds && kinds.length && kinds.indexOf(e.kind) < 0) return false;
    return score(e) > 0 && (!lvl || (e.level || '').indexOf(lvl) >= 0);
  }).sort(function (a, b) {
    // 截止时间未知的排后面；有截止时间的按升序
    var as = a.reg_end_sort || 0, bs = b.reg_end_sort || 0;
    if (!as && !bs) return 0;
    if (!as) return 1;
    if (!bs) return -1;
    return as - bs;
  }).slice(0, limit || 3);
}
function renderCertCard(r) {
  var head = '<div class="cert-head"><div class="cert-name">' + esc(r.cert) + '</div>' +
    (r.alias ? '<div class="cert-alias">' + esc(r.alias) + '</div>' : '') +
    '<div class="cert-badge ' + (r.done ? 'b-ok' : 'b-warn') + '">' + (r.done ? '已具备' : '缺项待完成') + '</div></div>';
  var chips = r.noRule
    ? '<span class="na">规则库未收录该认证，暂无法分析子项</span>'
    : (r.comps.length ? r.comps.map(function (c) {
        return '<span class="cert-chip ' + (c.done ? 'chip-ok' : 'chip-no') + '">' + (c.done ? '✓ ' : '✗ ') + esc(c.kind) + '：' + esc(c.label) + '</span>';
      }).join('') : '<span class="na">该等级无明确子项要求</span>');
  var line = '';
  if (r.noRule) {
    line = '<div class="cert-ok-line">已获得 <b>' + esc(r.cert) + '</b> 认证 ✅（规则库未收录，暂无法分析子项）</div>';
  } else if (r.done) {
    line = '<div class="cert-ok-line">已获得 <b>' + esc(r.cert) + '</b> 认证 ✅</div>';
  } else if (r.missing.length) {
    var txt = r.missing.length === 1 ? r.missing[0] : r.missing.slice(0, -1).join('、') + ' 和 ' + r.missing[r.missing.length - 1];
    line = '<div class="cert-missing">还需完成 <b>' + esc(txt) + '</b> 才能获得 <b>' + esc(r.cert) + '</b> 认证</div>';
  }
  var extra = '';
  if (r.synth) extra += '<div class="cert-rule"><span>合成规则</span>' + esc(r.synth).replace(/\n/g, '<br>') + '</div>';
  if (r.prereq) extra += '<div class="cert-rule"><span>前置条件</span>' + esc(r.prereq).replace(/\n/g, '<br>') + '</div>';
  function examDateBlock(e) {
    if (e.kind === '理论') return ['理论考试', e.exam_start, e.exam_end];
    if (e.kind === '实操') return ['实操考试', e.exam_start, e.exam_end];
    if (e.kind === '实战') return ['实战/项目评审', e.material_start, e.material_end];
    return ['考试', e.exam_start, e.exam_end];
  }
  function examKindLabel(k) {
    if (k === '理论') return '理论考试';
    if (k === '实操') return '实操考试';
    if (k === '实战') return '实战/项目评审';
    return '考试';
  }
  var examHtml = '';
  if (!r.done && r.exams && r.exams.length) {
    examHtml = '<div class="cert-exams"><div class="cert-exam-title">可报名考试</div>' +
      r.exams.map(function (e) {
        if (e.pending) {
          return '<div class="cert-exam-row pending">' +
            '<div class="exam-row-title">' + esc(examKindLabel(e.kind)) + '<span class="exam-status status-pending">待省公司通知</span></div>' +
          '</div>';
        }
        var expired = e.reg_end_sort && e.reg_end_sort < nowTs();
        var sc = expired ? 'status-expired' : examStatusClass(e.status);
        var dateBlock = examDateBlock(e);
        var dateTxt = dateBlock[1] ? esc(dateBlock[1] + (dateBlock[2] ? ' ~ ' + dateBlock[2] : '')) : '—';
        return '<div class="cert-exam-row ' + (expired ? 'expired' : '') + '">' +
          '<div class="exam-row-title">' + esc(e.title) + '<span class="exam-status ' + sc + '">' + esc(e.status) + '</span>' + (expired ? '<span class="exam-status status-expired">已过期</span>' : '') + '</div>' +
          '<div class="exam-row-meta"><b>报名截止</b>' + esc(e.reg_end || '—') + (expired ? ' <span class="expired-text">（报名已截止）</span>' : '') + '</div>' +
          '<div class="exam-row-meta"><b>' + esc(dateBlock[0]) + '</b>' + dateTxt + '</div>' +
        '</div>';
      }).join('') + '</div>';
  }
  return '<div class="cert-card ' + (r.done ? 'cert-done' : 'cert-todo') + '">' + head +
    '<div class="cert-comps">' + chips + '</div>' + line + extra + examHtml + '</div>';
}
function renderGuide(p, results) {
  var grade = D.dict.grade[p[4]] || '';
  var html = '<div class="guide-person">' +
    '<div class="gp-avatar">' + esc((p[1] || '?').slice(0, 1)) + '</div>' +
    '<div class="gp-info"><div class="gp-name">' + esc(p[1]) + '</div>' +
    '<div class="gp-meta">MSS编号 ' + esc(p[0]) + ' ｜ 当前云网工程师等级：<b>' + esc(grade || '—') + '</b></div></div></div>';
  if (!results.length) {
    html += '<div class="empty">该人员暂无可匹配的认证进度（规则库中无对应认证项，或尚未持有任何子标签）。</div>';
  } else {
    var doneN = results.filter(function (r) { return r.done; }).length;
    html += '<div class="guide-summary">共匹配 <b>' + results.length + '</b> 项认证：' +
      '<span class="ok">已完成 ' + doneN + '</span> ｜ <span class="warn">进行中 ' + (results.length - doneN) + '</span></div>';
    html += results.map(renderCertCard).join('');
  }
  $('#guideResultBox').innerHTML = html;
}

/* ============================ 人岗匹配 ============================ */
var MF = { cat: 'l1', unit: '', dept: '', state: 'all', kw: '', page: 1 };
var M_SIZE = 15;

function matchRows() {
  var pool = M[MF.cat].rows || [];
  var kw = (MF.kw || '').trim().toLowerCase();
  return pool.filter(function (r) {
    if (MF.unit && r.unit !== MF.unit) return false;
    if (MF.dept && r.dept !== MF.dept) return false;
    if (MF.state === 'ok' && !r.match) return false;
    if (MF.state === 'bad' && (r.match || r.na)) return false;
    if (MF.state === 'na' && !r.na) return false;
    if (kw) {
      var hay = (r.name + ' ' + r.code + ' ' + r.unit + ' ' + r.dept + ' ' + (r.post || '') + ' ' + (r.base || '')).toLowerCase();
      if (hay.indexOf(kw) < 0) return false;
    }
    return true;
  });
}

function matchReqHtml(r) {
  if (r.required && r.required.length) {
    return r.required.map(function (rq, i) {
      var ok = r.satisfied[i];
      return '<span class="m-req ' + (ok ? 'ok' : 'miss') + '">' + esc(rq) + (ok ? ' ✓' : '') + '</span>';
    }).join('');
  }
  return '<span class="m-req any">任一 L2 及以上认证</span>';
}
/* 「云网工程师L1~L4」是岗位等级（职级序列），不是认证证书；人岗匹配页只展示项目认证，故过滤掉。
   注意：仅过滤展示，L2 匹配判定仍依赖该等级（持有云网工程师L2 及以上即算 L2 人岗匹配）。 */
var GRADE_ONLY_RE = /^云网工程师L[0-9]+$/;
function splitObtained(r) {
  var all = (r.obtained || []).filter(function (c) { return c && !GRADE_ONLY_RE.test(c); });
  var grades = (r.obtained || []).filter(function (c) { return c && GRADE_ONLY_RE.test(c); });
  return { certs: all, grades: grades };
}
function matchObtainedHtml(r) {
  // 只展示项目认证；「云网工程师Lx」岗位等级不在此列显示（仍参与 L2 匹配计算）
  var sp = splitObtained(r);
  if (!sp.certs.length) return '<span class="m-none">—</span>';
  return sp.certs.map(function (c) { return '<span class="m-cert">' + esc(c) + '</span>'; }).join('');
}

/* 人岗匹配通报口径：蛇口通讯/高新区信息网（8月13日通报，用户无其明细认证数据） */
var REPORTED_UNITS = {
  '深圳市蛇口通讯有限公司': { l1m: 20, l1t: 21, l2m: 0, l2t: 0 },
  '深圳高新区信息网有限公司': { l1m: 5, l1t: 10, l2m: 0, l2t: 10 }
};

// 基于平台数据 + 通报调整后的整体统计（用于 KPI 卡片）
function reportedTotals() {
  var l1m = M.l1.matched, l1t = M.l1.total, l2m = M.l2.matched, l2t = M.l2.total;
  Object.keys(REPORTED_UNITS).forEach(function (u) {
    var rep = REPORTED_UNITS[u];
    var cur = { l1m: 0, l1t: 0, l2m: 0, l2t: 0 };
    (M.l1.rows || []).forEach(function (r) { if (r.unit === u) { cur.l1t++; if (r.match) cur.l1m++; } });
    (M.l2.rows || []).forEach(function (r) { if (r.unit === u) { cur.l2t++; if (r.match) cur.l2m++; } });
    l1m += rep.l1m - cur.l1m;
    l1t += rep.l1t - cur.l1t;
    l2m += rep.l2m - cur.l2m;
    l2t += rep.l2t - cur.l2t;
  });
  return {
    matched: l1m, total: l1t, rate: l1t ? l1m / l1t : 0,
    l2matched: l2m, l2total: l2t, l2rate: l2t ? l2m / l2t : 0
  };
}

/* 首页总视图卡片 */
function renderMatchDash() {
  var t = reportedTotals();
  var l1gap = t.total - t.matched, l2gap = t.l2total - t.l2matched;
  $('#matchDash').innerHTML =
    '<div class="panel-head"><h2>人岗匹配情况</h2>' +
      '<span class="panel-tag">数据更新 ' + esc(M.updated) + '</span>' +
      '<button class="btn-link" data-goto="match">进入人岗匹配看板 →</button></div>' +
    '<div class="panel-body match-dash-body">' +
      '<div class="md-card"><div class="md-k">L1 人岗匹配（任一所需认证匹配即完成）</div>' +
        '<div class="md-v">' + fmt(t.matched) + '<small>/' + fmt(t.total) + '</small></div>' +
        '<div class="md-bar"><div class="md-fill" style="width:' + (t.rate * 100).toFixed(1) + '%"></div></div>' +
        '<div class="md-rate">匹配率 ' + (t.rate * 100).toFixed(1) + '% ｜ 缺口 ' + fmt(l1gap) + ' 人</div></div>' +
      '<div class="md-card"><div class="md-k">L2 人岗匹配（任一 L2+ 认证）</div>' +
        '<div class="md-v">' + fmt(t.l2matched) + '<small>/' + fmt(t.l2total) + '</small></div>' +
        '<div class="md-bar"><div class="md-fill green" style="width:' + (t.l2rate * 100).toFixed(1) + '%"></div></div>' +
        '<div class="md-rate">匹配率 ' + (t.l2rate * 100).toFixed(1) + '% ｜ 缺口 ' + fmt(l2gap) + ' 人</div></div>' +
    '</div>';
}

/* 人岗匹配：按部门汇总 + L1 匹配率排名
   规则：按 L1 人岗匹配率从高到低排名；L1 达 100% 的标绿（超过三个则全部标绿）；排名末三位标红；
        无 L1 目标人数的部门与通报数据行不参与排名，列在末尾且不着色。 */
var RANK_BOTTOM = 3;      // 末三名标红
function matchDeptAgg() {
  var depts = {};
  ['l1', 'l2'].forEach(function (cat) {
    (M[cat].rows || []).forEach(function (r) {
      var d = (r.dept || '').trim() || '未匹配部门';
      if (!depts[d]) depts[d] = { dept: d, l1t: 0, l1m: 0, l2t: 0, l2m: 0 };
      if (cat === 'l1') { depts[d].l1t++; if (r.match) depts[d].l1m++; }
      else { depts[d].l2t++; if (r.match) depts[d].l2m++; }
    });
  });
  var all = Object.keys(depts).filter(function (d) {
    var x = depts[d];
    return x.l1t || x.l2t;          // 目标人数全为 0 的空行不显示
  }).map(function (d) { return depts[d]; });
  // 参与排名：有 L1 目标人数的部门，按 L1 匹配率降序（相同则目标人数多的在前，再按部门名）
  var ranked = all.filter(function (x) { return x.l1t > 0; }).sort(function (a, b) {
    var ra = a.l1m / a.l1t, rb = b.l1m / b.l1t;
    if (ra !== rb) return rb - ra;
    if (a.l1t !== b.l1t) return b.l1t - a.l1t;
    return (a.dept || '').localeCompare(b.dept || '');
  });
  var n = ranked.length;
  ranked.forEach(function (x, i) {
    x.rank = i + 1;
    x.l1rate = x.l1m / x.l1t * 100;
    x.cls = x.l1rate >= 100 ? 'ok' : (i >= n - RANK_BOTTOM ? 'low' : 'mid');
  });
  // 不参与排名：无 L1 目标人数的部门
  var unranked = all.filter(function (x) { return x.l1t === 0; }).sort(function (a, b) {
    return (a.dept || '').localeCompare(b.dept || '');
  }).map(function (x) {
    x.rank = null; x.l1rate = null; x.cls = 'na';
    x.tag = 'L2 名单独有';      // 仅出现在 L2 目标清单、L1 名单没有该部门
    return x;
  });
  // 通报补录：蛇口通讯/高新区信息网只有单位级总数、没有部门明细 → 单独列在表末并标注
  var reported = Object.keys(REPORTED_UNITS).map(function (u) {
    var rep = REPORTED_UNITS[u];
    return { dept: u + '（通报数据）', l1m: rep.l1m, l1t: rep.l1t, l2m: rep.l2m, l2t: rep.l2t,
             reported: true, rank: null, l1rate: null, cls: 'na' };
  });
  var grand = { dept: '总计', l1t: 0, l1m: 0, l2t: 0, l2m: 0 };
  ranked.concat(unranked, reported).forEach(function (x) {
    grand.l1t += x.l1t; grand.l1m += x.l1m; grand.l2t += x.l2t; grand.l2m += x.l2m;
  });
  return { depts: ranked, unranked: unranked, reported: reported, grand: grand };
}
function matchRateRowHtml(x) {
  var l2rate = x.l2t ? (x.l2m / x.l2t * 100) : 0;
  var l2RateCls = l2rate >= 55 ? 'ok' : 'low';
  var name = x.reported
    ? '<span class="mut-dept-plain">' + esc(x.dept) + '</span>'
    : '<button class="btn-link mut-dept" data-goto="match" data-dept="' + esc(x.dept) + '" title="点击查看该部门明细">' + esc(x.dept) + '</button>';
  if (x.tag) name += '<div class="mut-tag">' + esc(x.tag) + '</div>';
  return '<tr' + (x.cls === 'ok' ? ' class="mut-top"' : (x.cls === 'low' ? ' class="mut-bottom"' : '')) + '>' +
    '<td class="mut-rank">' + (x.rank || '—') + '</td>' +
    '<td class="mut-unit">' + name + '</td>' +
    '<td>' + fmt(x.l1m) + '</td>' +
    '<td>' + fmt(x.l1t) + '</td>' +
    '<td class="mut-rate ' + x.cls + '">' + (x.l1rate === null ? '—' : x.l1rate.toFixed(1) + '%') + '</td>' +
    '<td>' + fmt(x.l2m) + '</td>' +
    '<td>' + fmt(x.l2t) + '</td>' +
    '<td class="mut-rate ' + l2RateCls + '">' + (x.l2t ? l2rate.toFixed(1) + '%' : '—') + '</td>' +
    '</tr>';
}
/* 首页 / 人岗匹配页共用的「按部门」汇总表
   showDetail=true 才输出「查看明细 →」（人岗匹配页顶部已在本页，按钮无效故不输出） */
function matchDeptTableHtml(showDetail) {
  var data = matchDeptAgg();
  var body = data.depts.map(matchRateRowHtml).join('')
          + data.unranked.map(matchRateRowHtml).join('')
          + data.reported.map(matchRateRowHtml).join('');
  var g = data.grand;
  var gl1 = g.l1t ? (g.l1m / g.l1t * 100) : 0;
  var gl2 = g.l2t ? (g.l2m / g.l2t * 100) : 0;
  body += '<tr class="mut-grand">' +
    '<td></td>' +
    '<td>总计</td>' +
    '<td>' + fmt(g.l1m) + '</td>' +
    '<td>' + fmt(g.l1t) + '</td>' +
    '<td class="mut-rate ' + (gl1 >= 100 ? 'ok' : 'low') + '">' + (g.l1t ? gl1.toFixed(1) + '%' : '—') + '</td>' +
    '<td>' + fmt(g.l2m) + '</td>' +
    '<td>' + fmt(g.l2t) + '</td>' +
    '<td class="mut-rate ' + (gl2 >= 55 ? 'ok' : 'low') + '">' + (g.l2t ? gl2.toFixed(1) + '%' : '—') + '</td>' +
    '</tr>';

  return '<div class="panel-head"><h2>人岗匹配情况（按部门）</h2>' +
    '<span class="panel-tag">目标：L1 100% · L2 55%</span>' +
    (showDetail ? '<button class="btn-link" data-goto="match">查看明细 →</button>' : '') + '</div>' +
    '<div class="panel-body no-pad">' +
      '<div class="table-wrap mut-wrap">' +
        '<table class="mut-table"><thead><tr>' +
          '<th>排名</th><th>部门</th><th>L1人数</th><th>L1目标人数</th>' +
          '<th>L1人岗匹配率</th><th>L2人数</th><th>L2目标人数</th>' +
          '<th>L2人岗匹配率</th>' +
        '</tr></thead><tbody>' + body + '</tbody></table>' +
      '</div>' +
      '<div class="mut-note">按「任职部门名称」统计，默认按 L1 人岗匹配率从高到低排名；' +
      '<b class="ok-txt">绿色</b>为 L1 匹配率已达 100% 的部门，<b class="low-txt">红色</b>为排名末三位；' +
      '部门名可点击查看该部门人岗匹配明细。' +
      '深圳市蛇口通讯有限公司、深圳高新区信息网有限公司仅有单位级通报数据、无部门明细，单独列于表末且不参与排名。' +
      '标「L2 名单独有」的部门只出现在 L2 目标清单、L1 名单中没有，故无 L1 目标与排名。</div>' +
    '</div>';
}
function renderMatchUnitTable() { $('#matchUnitTable').innerHTML = matchDeptTableHtml(true); }


/* 人岗匹配看板 */
function renderMatch() {
  var t = reportedTotals();
  $('#matchKpi').innerHTML = [
    kpi('L1 人岗匹配', fmt(t.matched) + '/' + fmt(t.total), '人', '匹配率 ' + (t.rate * 100).toFixed(1) + '%', ''),
    kpi('L1 未匹配（缺口）', fmt(t.total - t.matched), '人', '需补充对应认证', 'k-red'),
    kpi('L2 人岗匹配', fmt(t.l2matched) + '/' + fmt(t.l2total), '人', '匹配率 ' + (t.l2rate * 100).toFixed(1) + '%', 'k-ok'),
    kpi('L2 未匹配（缺口）', fmt(t.l2total - t.l2matched), '人', '需至少一项 L2+ 认证', 'k-warn')
  ].join('');
  $('#matchUpdated').textContent = '数据更新 ' + esc(M.updated) + ' · 蛇口通讯/高新区信息网采用通报数据';

  var units = {}, depts = {};
  (M[MF.cat].rows || []).forEach(function (r) {
    if (r.unit) units[r.unit] = 1;
    if (r.dept && (!MF.unit || r.unit === MF.unit)) depts[r.dept] = 1;
  });
  $('#matchFilter').innerHTML =
    segHtml('cat', ['l1:L1（任一所需认证匹配）', 'l2:L2（任一 L2+ 认证）'], MF.cat) +
    '<select id="mfUnit"><option value="">全部单位</option>' + Object.keys(units).sort().map(function (u) {
      return '<option' + (u === MF.unit ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '</select>' +
    '<select id="mfDept"><option value="">全部部门</option>' + Object.keys(depts).sort().map(function (d) {
      return '<option' + (d === MF.dept ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select>' +
    '<select id="mfState">' +
      '<option value="all"' + (MF.state === 'all' ? ' selected' : '') + '>全部状态</option>' +
      '<option value="ok"' + (MF.state === 'ok' ? ' selected' : '') + '>已匹配</option>' +
      '<option value="bad"' + (MF.state === 'bad' ? ' selected' : '') + '>未匹配</option></select>' +
    '<input id="mfKw" class="input" placeholder="搜索姓名/编码/岗位…" value="' + esc(MF.kw) + '">' +
    '<span class="f-label" id="mfCount"></span>';

  $$('#matchFilter .seg button').forEach(function (b) {
    b.addEventListener('click', function () { MF.cat = b.dataset.val; MF.unit = ''; MF.dept = ''; MF.state = 'all'; MF.page = 1; renderMatch(); });
  });
  $('#mfUnit').addEventListener('change', function () { MF.unit = this.value; MF.dept = ''; MF.page = 1; renderMatch(); });
  $('#mfDept').addEventListener('change', function () { MF.dept = this.value; MF.page = 1; renderMatch(); });
  $('#mfState').addEventListener('change', function () { MF.state = this.value; MF.page = 1; renderMatch(); });
  $('#mfKw').addEventListener('input', function () { MF.kw = this.value; MF.page = 1; renderMatchTable(); });
  $('#matchExport').addEventListener('click', exportMatch);

  // 人岗匹配页顶部：不再输出「查看明细 →」（本页即明细，按钮无效）
  $('#matchUnitTableTop').innerHTML = matchDeptTableHtml(false);
  renderMatchTable();
}

function renderMatchTable() {
  var rows = matchRows();
  $('#mfCount').textContent = '共 ' + fmt(rows.length) + ' 人';
  var slice = rows.slice((MF.page - 1) * M_SIZE, MF.page * M_SIZE);
  if (!slice.length) {
    $('#matchTable').innerHTML = '<div class="empty">没有符合条件的人员</div>';
    $('#matchPager').innerHTML = '';
    return;
  }
  var body = slice.map(function (r, n) {
    var abs = (MF.page - 1) * M_SIZE + n;
    var st = r.na ? '<span class="badge b-muted">不适用</span>'
      : (r.match ? '<span class="badge b-ok">已匹配</span>' : '<span class="badge b-bad">未匹配</span>');
    return '<tr data-mi="' + abs + '">' +
      '<td class="m-name">' + esc(r.name) + '<div class="m-code">' + esc(r.code) + '</div></td>' +
      '<td>' + esc(r.dept || '—') + '</td>' +
      '<td>' + esc(r.post || r.base || '—') + '</td>' +
      '<td class="m-reqs">' + matchReqHtml(r) + '</td>' +
      '<td class="m-obt">' + matchObtainedHtml(r) + '</td>' +
      '<td>' + st + '</td></tr>';
  }).join('');
  $('#matchTable').innerHTML = '<table><thead><tr>' +
    '<th>姓名</th><th>部门</th><th>岗位</th><th>所需认证</th><th>已获认证</th><th>状态</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table>';
  $$('#matchTable tr[data-mi]').forEach(function (tr) {
    tr.addEventListener('click', function () { openMatchDetail(+tr.dataset.mi); });
  });
  pager('#matchPager', rows.length, M_SIZE, MF.page, function (pg) { MF.page = pg; renderMatchTable(); });
}

function openMatchDetail(abs) {
  var rows = matchRows();
  var r = rows[abs];
  if (!r) return;
  $('#modalTitle').textContent = r.name + ' · 人岗匹配详情';
  var head = '<div class="info-grid">' +
    ic('姓名', r.name) + ic('人力编码', r.code, '', 'sm') +
    ic('单位', r.unit, '', 'sm') + ic('部门', r.dept, '', 'sm') +
    ic('岗位', r.post || '—', r.base ? '基准岗位：' + r.base : '', 'sm') +
    ic('人岗匹配', r.na ? '不适用' : (r.match ? '已匹配' : '未匹配'), '', 'sm') + '</div>';
  var reqBlock;
  if (MF.cat === 'l1') {
    var reqRows = (r.required || []).map(function (rq, i) {
      var ok = r.satisfied[i];
      return '<tr><td><span class="m-status ' + (ok ? 'ok' : 'miss') + '">' + (ok ? '✓' : '—') + '</span></td><td>' + esc(rq) + '</td></tr>';
    }).join('');
    reqBlock = '<div class="ts-title" style="margin:14px 0 8px">所需认证（' + (r.required ? r.required.length : 0) + ' 项，任意一项匹配即完成）</div>' +
      '<table class="tbl"><thead><tr><th style="width:42px">达成</th><th>认证名称</th></tr></thead><tbody>' + reqRows + '</tbody></table>';
  } else {
    reqBlock = '<div class="ts-title" style="margin:14px 0 8px">匹配规则</div>' +
      '<div class="m-rule">需持有 <b>任一 L2 及以上认证</b>。当前' + (r.match ? '已满足' : '未满足') + '。</div>';
  }
  var obt = (r.obtained && r.obtained.length)
    ? r.obtained.map(function (c) { return '<span class="m-cert">' + esc(c) + '</span>'; }).join('')
    : '<span class="m-none">无认证记录</span>';
  $('#modalBody').innerHTML = head + reqBlock +
    '<div class="ts-title" style="margin:14px 0 8px">已获认证（' + (r.obtained ? r.obtained.length : 0) + ' 项）</div>' +
    '<div class="m-obt-wrap">' + obt + '</div>';
  $('#modal').classList.add('show');
}

function exportMatch() {
  var rows = matchRows();
  var head = ['姓名', '人力编码', '单位', '部门', '岗位', '基准岗位', '所需认证', '已获认证', '是否匹配'];
  var lines = [head.join(',')];
  rows.forEach(function (r) {
    var req = (r.required && r.required.length) ? r.required.join('；') : (MF.cat === 'l2' ? '任一L2及以上认证' : '');
    var obt = (r.obtained || []).join('；');
    var st = r.na ? '不适用' : (r.match ? '已匹配' : '未匹配');
    lines.push([r.name, r.code, r.unit, r.dept, r.post || '', r.base || '', req, obt, st]
      .map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','));
  });
  var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '人岗匹配_' + (MF.cat === 'l1' ? 'L1' : 'L2') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}

/* ============================ 初始化 ============================ */
function init() {
  var m = D.meta;
  $('#sideMeta').innerHTML =
    '认证 ' + fmt(CERTED.length) + ' 人 · 专家 ' + fmt(EXPERTS.length) + ' 人<br>' +
    '子标签 ' + fmt(TAGS.length) + ' 条<br>更新 ' + esc(m.generated);
  $('#today').textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  var nb = $('#navExpBadge');
  if (expBadArr().length) { nb.textContent = expBadArr().length; nb.classList.add('show'); }
  var xb = $('#navExpiryBadge');
  if (EXPIRE_90.length) { xb.textContent = EXPIRE_90.length; xb.classList.add('show'); }

  renderDashboard();
  renderNotices();
  renderExpert();
  renderExpiryFilter(); renderExpiryTable();
  renderDeptFilter();
  bindDeptHeadClick();
  renderDept();
  renderWork();
  renderExamFilters(); renderExamSummary(); renderExam();
  renderMatchDash();
  renderMatch();
  buildPersonIndex();
  buildCertIndex();
}
init();

})();
