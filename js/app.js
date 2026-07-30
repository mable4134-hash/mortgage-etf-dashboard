
/* ══════════════════════════════════════════
   dashboard.js（v5.5 重構）
   首頁統計與首頁卡片：總資產／淨資產、資產概況、資產配置分析、
   新手引導、資料完整度、Demo 模式、系統資訊、清除所有資料
   依賴：storage.js、utils.js、config.js、investment.js（getInvestmentTotals）
══════════════════════════════════════════ */

function renderSummary(){
  const assets=LS.get(KEY_A), debts=LS.get(KEY_D);
  const totalAssetsOnly=assets.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const totalD=debts.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  // v5.0 資產同步：首頁「總資產」／「淨資產」納入投資市值，公式＝現金＋股票/ETF＋不動產＋定存＋其他資產＋投資市值。
  // 規格原文公式省略了「定存」，為避免影響既有資產功能，這裡採「既有資產總和（不變）＋投資市值（新增）」的疊加方式，不刪減既有項目。
  // 注意：資產配置分析／財務健康／Goals 的淨資產計算維持只讀 nw_assets（依規格不可修改），不會納入投資市值，因此可能與此處數字不同。
  const investTotals=getInvestmentTotals();
  const totalA=totalAssetsOnly+investTotals.totalMarketValue;
  const net=totalA-totalD;
  const netEl=el('sNet');
  if(netEl){
    netEl.textContent=fmt(net);
    netEl.style.color=net>=0?'var(--green)':net<0?'var(--red)':'var(--t1)';
    netEl.style.textShadow=net>=0?'0 0 32px rgba(34,211,168,.25)':net<0?'0 0 32px rgba(239,68,68,.2)':'none';
  }
  setText('sAsset',fmt(totalA));
  setText('sDebt',fmt(totalD));
  setText('sAssetCount',assets.length+' 筆');
  setText('sDebtCount',debts.length+' 筆');
  // 資產概況（下方明細列表）維持只顯示 nw_assets 加總，與其下方逐筆列表一致，不混入投資中心數字
  setText('homeassetTotal',assets.length?fmt(totalAssetsOnly)+' 元':'');
  setText('homeDebtTotal',debts.length?fmt(totalD)+' 元':'');
}

/* ══ 產生 item HTML ══ */

function renderHomeOverview(){
  const assets=LS.get(KEY_A);
  const debts=LS.get(KEY_D);
  const totalA=assets.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const totalD=debts.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  setText('homeassetTotal',assets.length?fmt(totalA)+' 元':'');
  setText('homeDebtTotal',debts.length?fmt(totalD)+' 元':'');

  // 資產概況：依類型加總
  const aContainer=el('homeAssetOverview');
  if(aContainer){
    if(!assets.length){
      aContainer.innerHTML='<div class="overview-empty">尚未新增任何資產</div>';
    } else {
      const A_ORDER=['cash','etf','house','deposit','other'];
      const aGroup={};
      assets.forEach(a=>{const k=a.type||'other';if(!aGroup[k])aGroup[k]={total:0,count:0};aGroup[k].total+=parseFloat(a.amount)||0;aGroup[k].count++});
      aContainer.innerHTML=A_ORDER.filter(k=>aGroup[k]).map(k=>{
        const t=getType('asset',k);
        const g=aGroup[k];
        const pct=totalA>0?((g.total/totalA)*100).toFixed(1):'0';
        return`<div class="overview-row">
          <div class="overview-row-left">
            <div class="overview-row-icon ${t.cls}">${t.icon}</div>
            <div>
              <div class="overview-row-name">${t.label}</div>
              <div class="overview-row-count">${g.count} 筆</div>
            </div>
          </div>
          <div class="overview-row-right">
            <div class="overview-row-amount val--green">${fmt(g.total)} 元</div>
            <div class="overview-row-pct">${pct}%</div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // 負債概況：依類型加總
  const dContainer=el('homeDebtOverview');
  if(dContainer){
    if(!debts.length){
      dContainer.innerHTML='<div class="overview-empty">尚未新增任何負債</div>';
    } else {
      const D_ORDER=['mortgage','carloan','personal','credit','other'];
      const dGroup={};
      debts.forEach(d=>{const k=d.type||'other';if(!dGroup[k])dGroup[k]={total:0,count:0};dGroup[k].total+=parseFloat(d.amount)||0;dGroup[k].count++});
      dContainer.innerHTML=D_ORDER.filter(k=>dGroup[k]).map(k=>{
        const t=getType('debt',k);
        const g=dGroup[k];
        const pct=totalD>0?((g.total/totalD)*100).toFixed(1):'0';
        return`<div class="overview-row">
          <div class="overview-row-left">
            <div class="overview-row-icon ${t.cls}">${t.icon}</div>
            <div>
              <div class="overview-row-name">${t.label}</div>
              <div class="overview-row-count">${g.count} 筆</div>
            </div>
          </div>
          <div class="overview-row-right">
            <div class="overview-row-amount val--red">-${fmt(g.total)} 元</div>
            <div class="overview-row-pct">${pct}%</div>
          </div>
        </div>`;
      }).join('');
    }
  }
}

/* ══ 渲染資產頁 ══ */

function renderAssetAllocation() {
  const assets = LS.get(KEY_A);
  const card = el('allocCard');
  const dot  = el('allocDot');
  if (!card) return;

  const totalA = assets.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);

  if (!assets.length || totalA <= 0) {
    card.innerHTML = '<div class="overview-empty">尚未新增任何資產</div>';
    if (dot) { dot.style.background = 'var(--tm)'; dot.style.boxShadow = 'none'; }
    return;
  }

  // 依類型加總
  const group = {};
  assets.forEach(a=>{
    const k = a.type || 'other';
    group[k] = (group[k] || 0) + (parseFloat(a.amount) || 0);
  });

  // 依占比由高到低排序
  const rows = ALLOC_ORDER.filter(k=>group[k]).map(k=>{
    const t = getType('asset', k);
    const amount = group[k];
    const pct = amount / totalA * 100;
    return { key:k, t, amount, pct };
  }).sort((a,b)=>b.pct - a.pct);

  if (dot) { dot.style.background = 'var(--blue)'; dot.style.boxShadow = '0 0 5px var(--blue)'; }

  // 配置摘要：最大資產
  const top = rows[0];
  const summaryHTML = `<div class="alloc-summary">
    <div class="alloc-summary-icon">${top.t.icon}</div>
    <div class="alloc-summary-text">
      <div class="alloc-summary-label">目前最大資產</div>
      <div class="alloc-summary-value">${top.t.label}（${top.pct.toFixed(0)}%）</div>
    </div>
  </div>`;

  // 各類資產列表
  const listHTML = `<div class="alloc-list">${rows.map(r=>{
    const color = ALLOC_BAR_COLOR[r.key] || 'var(--t2)';
    return `<div class="alloc-row">
      <div class="alloc-row-top">
        <div class="alloc-row-left">
          <span class="alloc-row-icon">${r.t.icon}</span>
          <span class="alloc-row-name">${r.t.label}</span>
        </div>
        <div class="alloc-row-right">
          <span class="alloc-row-amount">${fmt(r.amount)} 元</span>
          <span class="alloc-row-pct" style="color:${color}">${r.pct.toFixed(0)}%</span>
        </div>
      </div>
      <div class="alloc-bar-bg">
        <div class="alloc-bar-fill" style="width:${r.pct}%;background:${color}"></div>
      </div>
    </div>`;
  }).join('')}</div>`;

  // 集中度提醒（固定文字，非 AI 判斷）
  const isConcentrated = (top.pct / 100) > ALLOC_CONCENTRATION_THRESHOLD;
  const alertHTML = isConcentrated
    ? `<div class="alloc-alert alloc-alert--warn">⚠️ 資產配置較集中，請留意風險。</div>`
    : `<div class="alloc-alert alloc-alert--ok">✅ 資產配置分布正常。</div>`;

  card.innerHTML = summaryHTML + '<div class="cashflow-divider"></div>' + listHTML + alertHTML;
}

/** 首頁「🏦 房貸概況」（v3.0）：彙總所有房貸，若無房貸資料則自動隱藏整個區塊 */

function isOnboardingDone(){
  return LS.get(KEY_OB, false) === true;
}
/** 是否完全沒有任何財務資料（資產／負債／收入／支出／Goals 皆為空） */

function hasAnyData(){
  return LS.get(KEY_A).length>0 || LS.get(KEY_D).length>0 || LS.get(KEY_I).length>0
      || LS.get(KEY_E).length>0 || LS.get(KEY_G).length>0;
}

/** 渲染首頁歡迎卡片：僅在「未完成引導」且「完全沒有資料」時顯示 */

function renderOnboarding(){
  const card = el('onboardingCard');
  if(!card) return;
  card.style.display = (!isOnboardingDone() && !hasAnyData()) ? '' : 'none';
}

/** 「開始建立」按鈕：標記引導已完成（往後不再出現），並直接切換到資產頁 */

function startOnboarding(){
  LS.set(KEY_OB, true);
  renderOnboarding();
  goTo('asset');
}

/* ══════════════════════════════════════════
   資料完整度 Data Completeness（v4.0）
   僅檢查「是否有資料」，不涉及任何金額計算
══════════════════════════════════════════ */

/** 計算六個項目的完成狀態；Mortgage 只有在使用者已建立房貸時才納入百分比計算 */

function getDataCompleteness(){
  const hasMortgage = LS.get(KEY_D).some(d=>d.type==='mortgage');
  const items = [
    { label:'資產',     done: LS.get(KEY_A).length>0 },
    { label:'負債',     done: LS.get(KEY_D).length>0 },
    { label:'收入',     done: LS.get(KEY_I).length>0 },
    { label:'固定支出', done: LS.get(KEY_E).length>0 },
    { label:'Goals',    done: LS.get(KEY_G).length>0 },
    { label:'Mortgage', done: hasMortgage, excluded: !hasMortgage },
  ];
  const countable = items.filter(i=>!i.excluded);
  const doneCount = countable.filter(i=>i.done).length;
  const pct = countable.length ? Math.round(doneCount/countable.length*100) : 0;
  return { items, pct };
}


function renderDataCompleteness(){
  const { items, pct } = getDataCompleteness();
  setText('completenessPct', pct+'%');
  const fill = el('completenessFill');
  if(fill) fill.style.width = pct+'%';
  const listEl = el('completenessList');
  if(listEl){
    listEl.innerHTML = items.map(i=>
      `<div class="completeness-row"><span>${i.done?'✅':'⚪'}</span><span>${esc(i.label)}</span></div>`
    ).join('');
  }
}

/* ══════════════════════════════════════════
   🏠 Hero Banner（v4.1）
   純導覽功能：捲動至 Dashboard 主要區塊，不涉及任何資料
══════════════════════════════════════════ */

function scrollToDashboard(){
  const target = el('dashboardAnchor');
  if(target) target.scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ══════════════════════════════════════════
   👀 Demo 模式（v4.1）
   Demo 資料實際寫入既有 nw_assets／nw_debts／nw_income／nw_expenses／
   nw_living_expense／nw_goals 等既有 key，不新增獨立的示範資料結構；
   僅另外用 nw_demo_mode 這個布林旗標標記「目前畫面上的資料是否為示範資料」，
   純粹用於 UI 顯示（Badge／清除按鈕），不影響任何計算邏輯
══════════════════════════════════════════ */

function isDemoMode(){
  return LS.get(KEY_DEMO, false) === true;
}

/** 產生完整涵蓋現金／ETF／房貸／收入／固定支出／Goals 的示範資料集 */

function getDemoDataset(){
  return {
    assets: [
      {type:'cash',    name:'示範．第一銀行活存', amount:180000},
      {type:'cash',    name:'示範．國泰世華活存', amount:65000},
      {type:'etf',     name:'示範．0050 元大台灣50', amount:520000, cost:430000},
      {type:'etf',     name:'示範．VOO', amount:260000, cost:200000},
      {type:'deposit', name:'示範．一銀定存 2 年期', amount:200000, rate:2.16},
      {type:'house',   name:'示範．台北市信義區房屋', amount:13000000},
      {type:'other',   name:'示範．黃金存摺', amount:40000},
    ],
    debts: [
      {type:'mortgage', name:'示範．玉山房貸', amount:8200000, rate:2.1, originalAmount:9000000, totalMonths:360, startDate:'2023-06-01', repaymentMethod:'equalPayment'},
      {type:'credit',   name:'示範．台新信用卡', amount:12000},
    ],
    income: [
      {type:'salary',   name:'示範．正職薪資', amount:70000},
      {type:'dividend', name:'示範．ETF 股息', amount:9000},
    ],
    expense: [
      {type:'mortgage',  name:'示範．玉山房貸月付', amount:29500},
      {type:'telecom',   name:'示範．電信費', amount:999},
      {type:'utility',   name:'示範．水電瓦斯', amount:2800},
    ],
    living: 22000,
    goals: [
      {type:'networth',  name:'示範．存到 600 萬淨資產', target:6000000, note:'2029 年前達成'},
      {type:'etf',       name:'示範．ETF 累積到 100 萬', target:1000000, note:''},
      {type:'emergency', name:'示範．緊急預備金 6 個月', target:250000, note:''},
    ],
  };
}

/** 載入示範資料：若目前已有任何資料（不論是使用者資料或先前的示範資料），先跳出確認視窗再覆蓋 */

function loadDemoData(){
  if(hasAnyData()){
    const msg = isDemoMode()
      ? '要重新載入一組全新的示範資料嗎？目前畫面上的示範資料將會被取代。'
      : '目前已有資料，載入示範資料將會覆蓋目前的資產、負債、收入、支出、生活費與 Goals，確定要繼續嗎？';
    if(!confirm(msg)) return;
  }
  const demo = getDemoDataset();
  LS.set(KEY_A, demo.assets);
  LS.set(KEY_D, demo.debts);
  LS.set(KEY_I, demo.income);
  LS.set(KEY_E, demo.expense);
  LS.set(KEY_LE, demo.living);
  LS.set(KEY_G, demo.goals);
  LS.set(KEY_OB, true); // 示範資料已足夠展示，視同完成新手引導，不再顯示歡迎卡片
  LS.set(KEY_DEMO, true);
  renderAll();
  scrollToDashboard();
}

/** 「建立自己的資料」：若目前是示範模式，先確認並清空示範資料，再導向資產頁開始建立；
 *  若原本就不是示範模式（例如已有使用者自己的資料），則單純導向資產頁，不清除任何資料 */

function buildOwnData(){
  if(isDemoMode()){
    if(!confirm('這將清除目前的示範資料，開始建立你自己的資料，確定嗎？')) return;
    [KEY_A, KEY_D, KEY_I, KEY_E, KEY_G, KEY_LE].forEach(k=>{ try{ localStorage.removeItem(k); }catch{} });
    LS.set(KEY_DEMO, false);
    renderAll();
  }
  goTo('asset');
}

/** 渲染 Demo 區塊：目前是否為示範模式的 Badge 顯示 */

function renderDemoSection(){
  const badge = el('demoBadge');
  if(badge) badge.style.display = isDemoMode() ? '' : 'none';
}

/* ══════════════════════════════════════════
   ⚙️ 設定／系統資訊（v4.1）
   純展示與連結，不涉及任何財務計算
══════════════════════════════════════════ */

function renderSystemInfo(){
  setText('sysVersion', 'v'+APP_VERSION);
  setText('sysUpdateDate', APP_UPDATE_DATE);
  const ghLink = el('sysGithubLink'); if(ghLink) ghLink.href = GITHUB_REPO_URL;
  const readmeLink = el('sysReadmeLink'); if(readmeLink) readmeLink.href = GITHUB_REPO_URL + '/blob/main/README.md';
  const changelogLink = el('sysChangelogLink'); if(changelogLink) changelogLink.href = GITHUB_REPO_URL + '/blob/main/CHANGELOG.md';
  ['footerGithubLink1','footerGithubLink2','footerGithubLink3','footerGithubLink4','footerGithubLink5'].forEach(id=>{
    const a = el(id); if(a) a.href = GITHUB_REPO_URL;
  });
}

/** 一鍵清除所有資料（設定頁）：確認後清空所有本專案使用的 localStorage 並重新整理，回到初始使用狀態 */

function resetAllData(){
  if(!confirm('確定要清除所有資料嗎？\n\n此動作無法復原。')) return;
  [KEY_A, KEY_D, KEY_I, KEY_E, KEY_G, KEY_LE, KEY_OB, KEY_DEMO, KEY_INV].forEach(k=>{
    try{ localStorage.removeItem(k); }catch{}
  });
  location.reload();
}

/* ══════════════════════════════════════════
   📈 投資中心 Investment Center（v5.0）
   獨立資料 key「investments」，與資產頁既有的「股票／ETF」類型是兩套獨立機制，
   不共用資料、不互相同步。每筆投資皆為使用者手動輸入持有數量／成本／最新價格，
   不串接任何股票／ETF API，不做即時行情。
══════════════════════════════════════════ */
/* ══════════════════════════════════════════
   app.js（v5.5 重構）
   應用程式初始化、頁面導覽（goTo）、renderAll() 統一渲染入口、開發工具、事件註冊
   依賴：所有其他模組（必須最後載入）
══════════════════════════════════════════ */

function goTo(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const target=el('page-'+page);
  if(target){target.classList.add('active');window.scrollTo(0,0)}
  const meta=PAGE_META[page]||{};
  setText('headerTitle',meta.title||'');
  setText('headerSub',meta.sub||'');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const nb=el('nav-'+page);
  if(nb)nb.classList.add('active');
}

/* ══ 渲染總覽 ══ */

function renderAll(){syncAutoMortgagePrincipals();renderSummary();renderHomeOverview();renderLivingExpense();renderCashflow();renderHealthCard();renderHealthOverview();renderAssetAllocation();renderMortgageSummary();renderGoalsSummary();renderOnboarding();renderDataCompleteness();renderDemoSection();renderSystemInfo();renderAssetPage();renderDebtPage();renderExpensePage();renderIncomePage();renderGoalsPage();renderInvestmentPage();renderHomeInvestmentSummary()}


/* ══════════════════════════════════════════
   Goals（v1.9）
══════════════════════════════════════════ */

function toggleDevTools(){
  const body  = el('devToolsBody');
  const arrow = el('devToggleArrow');
  if(!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if(arrow) arrow.textContent = isOpen ? '▾' : '▴';
}

/** 載入測試資料：涵蓋資產／負債／收入／支出／生活費／Goals 各類型 */

function loadTestData(){
  if(!confirm('這會覆蓋目前的資產、負債、收入、支出、生活費與 Goals 資料，確定要載入測試資料嗎？')) return;

  const testAssets = [
    {type:'cash',    name:'第一銀行活存',       amount:150000},
    {type:'cash',    name:'國泰世華活存',       amount:60000},
    {type:'cash',    name:'兆豐銀行活存',       amount:40000},
    {type:'cash',    name:'現金／零用金',       amount:15000},
    {type:'etf',     name:'0050 元大台灣50',    amount:500000, cost:420000},
    {type:'etf',     name:'00919 群益台灣精選高息', amount:300000, cost:280000},
    {type:'etf',     name:'VOO',               amount:200000, cost:150000},
    {type:'deposit', name:'一銀定存 2 年期',    amount:300000, rate:2.16},
    {type:'deposit', name:'王道銀行定存',       amount:150000, rate:2.5},
    {type:'house',   name:'台北市信義區房屋',   amount:12000000},
    {type:'other',   name:'黃金存摺',           amount:50000},
    {type:'other',   name:'虛擬貨幣',           amount:30000},
  ];

  const testDebts = [
    {type:'mortgage', name:'玉山房貸', amount:8000000, rate:2.1, originalAmount:9000000, totalMonths:360, startDate:'2023-03-05', repaymentMethod:'equalPayment'},
    {type:'carloan',  name:'中租車貸', amount:500000,  rate:3.5, monthlyPayment:15000, remainingMonths:36},
    {type:'personal', name:'國泰信貸', amount:200000,  rate:5.88, monthlyPayment:8500,  remainingMonths:24},
    {type:'credit',   name:'台新信用卡', amount:30000},
    {type:'credit',   name:'中國信託信用卡', amount:15000},
  ];

  const testIncome = [
    {type:'salary',   name:'正職薪資',    amount:65000},
    {type:'dividend', name:'0050 股息',   amount:8000},
    {type:'rent',     name:'租金收入',    amount:15000},
  ];

  const testExpense = [
    {type:'mortgage',  name:'玉山房貸月付', amount:28500},
    {type:'telecom',   name:'台灣大哥大',   amount:999},
    {type:'utility',   name:'水電瓦斯',     amount:3000},
    {type:'insurance', name:'保險費',       amount:5000},
  ];

  const testGoals = [
    {type:'networth',  name:'存到 500 萬淨資產',   target:5000000, note:'2028 年前達成'},
    {type:'etf',       name:'ETF 累積到 100 萬',   target:1000000, note:''},
    {type:'emergency', name:'緊急預備金 6 個月',   target:300000,  note:''},
    {type:'custom',    name:'旅遊基金', target:150000, current:35000, note:'日本自由行'},
  ];

  LS.set(KEY_A, testAssets);
  LS.set(KEY_D, testDebts);
  LS.set(KEY_I, testIncome);
  LS.set(KEY_E, testExpense);
  LS.set(KEY_LE, 20000);
  LS.set(KEY_G, testGoals);
  LS.set(KEY_DEMO, false); // 開發測試資料與 v4.1 示範資料（Demo）是兩套獨立機制，載入測試資料時關閉示範模式旗標

  renderAll(); // 不需重新整理，立即更新所有頁面
}

/** 清除所有資料（不影響 UI 偏好，只清本專案用到的 localStorage） */

function clearAllData(){
  if(!confirm('確定要清除所有資料嗎？')) return;

  [KEY_A, KEY_D, KEY_I, KEY_E, KEY_G, KEY_LE, KEY_DEMO, KEY_INV].forEach(k=>{
    try{ localStorage.removeItem(k); }catch{}
  });

  renderAll();
}

/* ══ 初始化 ══ */

function init(){
  const now=new Date();
  const hd=el('hDate');
  if(hd)hd.innerHTML=`<div>${now.toLocaleDateString('zh-TW',{year:'numeric',month:'long'})}</div><div>更新 ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}</div>`;
  renderAll();
  goTo('home');
}
document.addEventListener('DOMContentLoaded',init);

