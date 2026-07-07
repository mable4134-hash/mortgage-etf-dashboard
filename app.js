/* ══ 設定 ══ */
const ASSET_TYPES=[
  {value:'cash',    label:'現金 / 活存', icon:'💵', cls:'icon--cash'},
  {value:'etf',     label:'股票 / ETF',  icon:'📈', cls:'icon--etf'},
  {value:'house',   label:'不動產',       icon:'🏠', cls:'icon--house'},
  {value:'deposit', label:'定期存款',     icon:'🏦', cls:'icon--deposit'},
  {value:'other',   label:'其他資產',     icon:'📦', cls:'icon--other'},
];
const DEBT_TYPES=[
  {value:'mortgage',label:'房貸',     icon:'🏠', cls:'icon--mortgage'},
  {value:'carloan', label:'車貸',     icon:'🚗', cls:'icon--carloan'},
  {value:'personal',label:'信貸',     icon:'💳', cls:'icon--personal'},
  {value:'credit',  label:'信用卡',   icon:'💰', cls:'icon--credit'},
  {value:'other',   label:'其他負債', icon:'📋', cls:'icon--debt-other'},
];

/* ══ localStorage ══ */
const LS={
  get(k,fb=[]){try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb}catch{return fb}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},
};
const KEY_A='nw_assets', KEY_D='nw_debts';
const KEY_LE='nw_living_expense';

/* ══ 工具 ══ */
function fmt(n){if(n===null||n===undefined||isNaN(n))return'--';return new Intl.NumberFormat('zh-TW').format(Math.round(n))}
function fmtPct(r){if(r===null||isNaN(r))return null;const p=(r*100).toFixed(2);return r>=0?`+${p}%`:`${p}%`}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function el(id){return document.getElementById(id)}
function setText(id,t){const e=el(id);if(e)e.textContent=t}
function getType(mode,val){return(mode==='asset'?ASSET_TYPES:DEBT_TYPES).find(t=>t.value===val)||(mode==='asset'?ASSET_TYPES:DEBT_TYPES).at(-1)}

/* ══ 頁面切換 ══ */
const PAGE_META={
  home: {title:'資產負債儀表板', sub:'Net Worth Tracker'},
  asset:{title:'資產管理',       sub:'Asset Management'},
  debt: {title:'負債管理',       sub:'Debt Management'},
  goals:{title:'財務目標',       sub:'Financial Goals'},
  tools:{title:'財務工具',       sub:'Financial Tools'},
};
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
function renderSummary(){
  const assets=LS.get(KEY_A), debts=LS.get(KEY_D);
  const totalA=assets.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const totalD=debts.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
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
  setText('homeassetTotal',assets.length?fmt(totalA)+' 元':'');
  setText('homeDebtTotal',debts.length?fmt(totalD)+' 元':'');
}

/* ══ 產生 item HTML ══ */
function itemHTML(item,mode,index){
  const t=getType(mode,item.type);
  const amt=parseFloat(item.amount)||0;
  const cost=parseFloat(item.cost);
  const hasReturn=item.type==='etf'&&!isNaN(cost)&&cost>0;
  const profit=hasReturn?amt-cost:null;
  const rate=hasReturn?profit/cost:null;
  const pctStr=hasReturn?fmtPct(rate):null;
  const pColor=profit!==null&&profit>=0?'var(--green)':'var(--red)';
  const meta=[];
  if(item.note)meta.push(esc(item.note));
  if(hasReturn)meta.push('成本 '+fmt(cost)+' 元');
  if(item.rate&&mode==='debt')meta.push('年利率 '+parseFloat(item.rate).toFixed(2)+'%');
  return`<div class="item-card fade-in">
    <div class="item-icon ${t.cls}">${t.icon}</div>
    <div class="item-body">
      <div class="item-name">${esc(item.name)||t.label}</div>
      <div class="item-meta">${t.label}${meta.length?' · '+meta.join(' · '):''}</div>
    </div>
    <div class="item-right">
      <div class="item-value ${mode==='asset'?'val--green':'val--red'}">${mode==='debt'?'-':''}${fmt(amt)} 元</div>
      ${pctStr?`<div class="item-sub" style="color:${pColor}">${pctStr}（${profit>=0?'+':''}${fmt(profit)}）</div>`:''}
    </div>
    <div class="item-actions">
      <button class="btn-sm" onclick="editItem('${mode}',${index})">✎</button>
      <button class="btn-sm del" onclick="deleteItem('${mode}',${index})">✕</button>
    </div>
  </div>`;
}

/* ══ 渲染首頁概況（v1.4） ══ */
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
function renderAssetPage(){
  const assets=LS.get(KEY_A);
  const total=assets.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  setText('assetBannerTotal',fmt(total));
  setText('assetBannerSub',assets.length+' 筆資產');

  const c=el('assetPageList');
  if(!c)return;
  if(!assets.length){
    c.innerHTML='<div class="empty-hint">尚未新增任何資產<br>點下方按鈕開始新增</div>';
    return;
  }

  // 依類型分組顯示
  const ORDER=['cash','etf','house','deposit','other'];
  const grouped={};
  assets.forEach((a,i)=>{
    const k=a.type||'other';
    if(!grouped[k])grouped[k]=[];
    grouped[k].push({...a,_idx:i});
  });

  c.innerHTML=ORDER.filter(k=>grouped[k]).map(k=>{
    const t=getType('asset',k);
    const items=grouped[k];
    const subtotal=items.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
    return`<div class="asset-group">
      <div class="asset-group-header">
        <div class="asset-group-label"><span class="asset-group-icon">${t.icon}</span>${t.label}</div>
        <div class="asset-group-total val--green">${fmt(subtotal)} 元</div>
      </div>
      ${items.map(a=>itemHTML(a,'asset',a._idx)).join('')}
    </div>`;
  }).join('');
}

/* ══ 渲染負債頁 ══ */
function renderDebtPage(){
  const debts=LS.get(KEY_D);
  const total=debts.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  setText('debtBannerTotal',fmt(total));
  setText('debtBannerSub',debts.length+' 筆負債');

  const c=el('debtPageList');
  if(!c)return;
  if(!debts.length){
    c.innerHTML='<div class="empty-hint">尚未新增任何負債<br>點下方按鈕開始新增</div>';
    return;
  }

  // 依類型分組
  const ORDER=['mortgage','carloan','personal','credit','other'];
  const grouped={};
  debts.forEach((d,i)=>{
    const k=d.type||'other';
    if(!grouped[k])grouped[k]=[];
    grouped[k].push({...d,_idx:i});
  });

  c.innerHTML=ORDER.filter(k=>grouped[k]).map(k=>{
    const t=getType('debt',k);
    const items=grouped[k];
    const subtotal=items.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
    return`<div class="asset-group">
      <div class="asset-group-header">
        <div class="asset-group-label"><span class="asset-group-icon">${t.icon}</span>${t.label}</div>
        <div class="asset-group-total val--red">${fmt(subtotal)} 元</div>
      </div>
      ${items.map(d=>itemHTML(d,'debt',d._idx)).join('')}
    </div>`;
  }).join('');
}

/* ══ 每月生活費（v2.1） ══
   單一數字，不分類、不記帳，僅新增這一個 localStorage key */
function getLivingExpense(){
  const n = parseFloat(LS.get(KEY_LE, 0));
  return isNaN(n) ? 0 : n;
}

function renderLivingExpense(){
  const val = getLivingExpense();
  setText('livingBannerTotal', fmt(val));
  const input = el('livingInput');
  // 避免使用者正在輸入時被重新渲染蓋掉
  if(input && document.activeElement !== input){
    input.value = val ? val : '';
  }
}

function saveLivingExpense(){
  const amount = parseFloat(el('livingInput').value);
  if(isNaN(amount) || amount < 0){ showFieldErr('livingError','請輸入有效金額（≥ 0）'); return; }
  LS.set(KEY_LE, amount);
  clearErr('livingError');
  renderLivingExpense();
  renderCashflow();
}

/* ══ 渲染現金流卡片（v2.1：加入每月生活費） ══ */
function renderCashflow(){
  const incomeList   = LS.get(KEY_I);
  const expenseList  = LS.get(KEY_E);
  const totalIncome   = incomeList.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const totalExpense  = expenseList.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const livingExpense = getLivingExpense();

  // 預估每月可存金額 ＝ 收入－固定支出－生活費
  const disposable = totalIncome - totalExpense - livingExpense;

  const isPos = disposable >= 0;
  const dot   = el('cashflowDot');
  const main  = el('cfDisposable');

  if(dot){
    dot.style.background = isPos ? 'var(--green)' : 'var(--red)';
    dot.style.boxShadow  = isPos ? '0 0 5px var(--green)' : '0 0 5px var(--red)';
  }
  if(main){
    main.textContent = (isPos ? '+' : '') + fmt(Math.round(disposable));
    main.style.color = isPos ? 'var(--green)' : 'var(--red)';
    main.style.textShadow = isPos
      ? '0 0 24px rgba(34,211,168,.25)'
      : '0 0 24px rgba(239,68,68,.2)';
  }

  // 每月收入、固定支出、每月生活費
  setText('cfIncome',  totalIncome    ? fmt(totalIncome)   + ' 元' : '--');
  setText('cfExpense', totalExpense   ? fmt(totalExpense)  + ' 元' : '--');
  setText('cfLiving',  livingExpense  ? fmt(livingExpense) + ' 元' : '--');
}

/* ══════════════════════════════════════════
   財務健康分析（v1.8）
   所有權重集中在 FH_WEIGHTS，方便日後調整
══════════════════════════════════════════ */
const FH_WEIGHTS = { debtRatio: 0.4, expRatio: 0.3, savRate: 0.3 };

/**
 * 單項指標評分（0~100）
 * @param {number} value  - 實際數值（比率，0~1）
 * @param {'debt'|'exp'|'sav'} type
 */
function scoreIndicator(value, type) {
  if (value === null || isNaN(value)) return null;
  if (type === 'debt') {
    // 負債比：<40% 滿分，40~60% 線性遞減，>60% 0分
    if (value < 0.4)  return 100;
    if (value > 0.6)  return 0;
    return Math.round((0.6 - value) / 0.2 * 100);
  }
  if (type === 'exp') {
    // 固定支出率：<50% 滿分，50~70% 線性遞減，>70% 0分
    if (value < 0.5)  return 100;
    if (value > 0.7)  return 0;
    return Math.round((0.7 - value) / 0.2 * 100);
  }
  if (type === 'sav') {
    // 儲蓄率：≥30% 滿分，10~30% 線性，<10% 0分
    if (value >= 0.3) return 100;
    if (value < 0.1)  return 0;
    return Math.round((value - 0.1) / 0.2 * 100);
  }
  return 0;
}

/** 顏色輔助 */
function indicatorColor(value, type) {
  if (value === null || isNaN(value)) return 'var(--tm)';
  if (type === 'debt') return value < 0.4 ? 'var(--green)' : value < 0.6 ? 'var(--orange)' : 'var(--red)';
  if (type === 'exp')  return value < 0.5 ? 'var(--green)' : value < 0.7 ? 'var(--orange)' : 'var(--red)';
  if (type === 'sav')  return value >= 0.3 ? 'var(--green)' : value >= 0.1 ? 'var(--orange)' : 'var(--red)';
  return 'var(--t2)';
}

/** 渲染財務健康卡片 */
function renderHealthCard() {
  const assets   = LS.get(KEY_A);
  const debts    = LS.get(KEY_D);
  const incomes  = LS.get(KEY_I);
  const expenses = LS.get(KEY_E);

  const totalAsset   = assets.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const totalDebt    = debts.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  const totalIncome  = incomes.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const totalExpense = expenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const disposable   = totalIncome - totalExpense;

  // 三項比率（null 表示資料不足）
  const debtRatio = totalAsset  > 0 ? totalDebt    / totalAsset  : null;
  const expRatio  = totalIncome > 0 ? totalExpense / totalIncome : null;
  const savRate   = totalIncome > 0 ? disposable   / totalIncome : null;

  // 各項評分
  const sDebt = scoreIndicator(debtRatio, 'debt');
  const sExp  = scoreIndicator(expRatio,  'exp');
  const sSav  = scoreIndicator(savRate,   'sav');

  // 加權總分（只計算有資料的項目，按比例重新分配）
  let totalScore = null;
  const scored = [];
  if (sDebt !== null) scored.push({ s: sDebt, w: FH_WEIGHTS.debtRatio });
  if (sExp  !== null) scored.push({ s: sExp,  w: FH_WEIGHTS.expRatio });
  if (sSav  !== null) scored.push({ s: sSav,  w: FH_WEIGHTS.savRate });
  if (scored.length > 0) {
    const wSum = scored.reduce((a,x)=>a+x.w,0);
    totalScore = Math.round(scored.reduce((a,x)=>a+x.s*x.w,0) / wSum);
  }

  // 等級
  const grade = totalScore === null ? null
    : totalScore >= 80 ? { label:'優良', color:'var(--green)', bg:'var(--gbg)' }
    : totalScore >= 60 ? { label:'普通', color:'var(--orange)', bg:'var(--obg)' }
    :                    { label:'注意', color:'var(--red)',    bg:'var(--rbg)' };

  // ── 更新 DOM ──
  const dot = el('healthDot');
  const badge = el('healthGrade');
  const scoreEl = el('healthScore');
  const barFill = el('healthBarFill');

  if (grade) {
    if (dot)   { dot.style.background = grade.color; dot.style.boxShadow = `0 0 5px ${grade.color}`; }
    if (badge) { badge.textContent = grade.label; badge.style.color = grade.color; badge.style.background = grade.bg; }
    if (scoreEl){ scoreEl.textContent = totalScore; scoreEl.style.color = grade.color; }
    if (barFill){
      barFill.style.background = grade.color;
      requestAnimationFrame(()=>{ barFill.style.width = totalScore + '%'; });
    }
  } else {
    if (dot)    { dot.style.background = 'var(--tm)'; dot.style.boxShadow = 'none'; }
    if (badge)  { badge.textContent = '資料不足'; badge.style.color = 'var(--tm)'; badge.style.background = 'var(--stat)'; }
    if (scoreEl){ scoreEl.textContent = '--'; scoreEl.style.color = 'var(--t2)'; }
    if (barFill){ barFill.style.width = '0%'; }
  }

  // 三項指標
  function setMetric(dotId, valId, value, type, display) {
    const c = indicatorColor(value, type);
    const d = el(dotId); if(d){ d.style.background = c; d.style.boxShadow = `0 0 4px ${c}`; }
    const v = el(valId); if(v){ v.textContent = display; v.style.color = c; }
  }
  setMetric('debtRatioDot','debtRatioVal', debtRatio,'debt', debtRatio!==null ? (debtRatio*100).toFixed(1)+'%' : '--');
  setMetric('expRatioDot', 'expRatioVal',  expRatio, 'exp',  expRatio !==null ? (expRatio *100).toFixed(1)+'%' : '--');
  setMetric('savRatioDot', 'savRatioVal',  savRate,  'sav',  savRate  !==null ? (savRate  *100).toFixed(1)+'%' : '--');
}

/* ══════════════════════════════════════════
   資產配置分析（v2.0）
   僅讀取既有 nw_assets 進行統計，不新增 localStorage
══════════════════════════════════════════ */
const ALLOC_BAR_COLOR = {
  cash:    'var(--green)',
  etf:     'var(--blue)',
  house:   'var(--purple)',
  deposit: 'var(--orange)',
  other:   'var(--t2)',
};
const ALLOC_ORDER = ['cash','etf','house','deposit','other'];
const ALLOC_CONCENTRATION_THRESHOLD = 0.7; // 70%

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

function renderAll(){renderSummary();renderHomeOverview();renderLivingExpense();renderCashflow();renderHealthCard();renderAssetAllocation();renderGoalsSummary();renderAssetPage();renderDebtPage();renderExpensePage();renderIncomePage();renderGoalsPage()}

/* ══════════════════════════════════════════
   Goals（v1.9）
══════════════════════════════════════════ */
const KEY_G = 'nw_goals';

const GOAL_TYPES = {
  networth:  { label:'淨資產',      icon:'🏠', cls:'icon--house'   },
  cash:      { label:'現金／活存',   icon:'💰', cls:'icon--cash'    },
  etf:       { label:'股票／ETF',    icon:'📈', cls:'icon--etf'     },
  deposit:   { label:'定存',         icon:'🏦', cls:'icon--deposit' },
  emergency: { label:'緊急預備金',   icon:'🚨', cls:'icon--other'   },
  custom:    { label:'自訂',         icon:'🎯', cls:'icon--cash'    },
};

/**
 * 依目標類型自動讀取目前金額
 * 讀取現有 localStorage，不新增任何 key
 * custom（自訂目標）不自動計算，回傳 null，由使用者自行輸入
 */
function getCurrentByType(type) {
  const assets  = LS.get(KEY_A);
  const debts   = LS.get(KEY_D);
  const totalA  = assets.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const totalD  = debts.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  const cashTotal    = assets.filter(a=>a.type==='cash').reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const depositTotal = assets.filter(a=>a.type==='deposit').reduce((s,a)=>s+(parseFloat(a.amount)||0),0);

  if (type === 'networth')  return totalA - totalD;
  if (type === 'cash')      return cashTotal;
  if (type === 'etf')       return assets.filter(a=>a.type==='etf').reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  if (type === 'deposit')   return depositTotal;
  if (type === 'emergency') return cashTotal + depositTotal;
  return null; // custom：不自動計算，由使用者輸入
}

/**
 * 取得目標的「目前金額」
 * - 自動類型：呼叫 getCurrentByType() 計算
 * - 自訂目標（custom）：直接讀取使用者輸入的 g.current，不引用任何自動計算值
 */
function getGoalCurrent(g) {
  if (g.type === 'custom') return parseFloat(g.current) || 0;
  return getCurrentByType(g.type) || 0;
}

/** 進度條顏色 */
function goalBarColor(pct) {
  if (pct >= 80) return 'var(--green)';
  if (pct >= 50) return 'var(--orange)';
  return 'var(--red)';
}

/** 渲染 Goals 頁 */
function renderGoalsPage() {
  const list = LS.get(KEY_G);
  setText('goalsSubtitle', list.length ? list.length + ' 個目標' : '追蹤你的財務里程碑');
  const c = el('goalsPageList');
  if (!c) return;
  if (!list.length) {
    c.innerHTML = '<div class="empty-hint">尚未設定任何目標<br>點下方按鈕開始新增</div>';
    return;
  }
  c.innerHTML = list.map((g, i) => {
    const t       = GOAL_TYPES[g.type] || GOAL_TYPES.custom;
    const target  = parseFloat(g.target) || 0;
    const current = getGoalCurrent(g);
    const pct     = target > 0 ? Math.max(0, Math.min(Math.round(current / target * 100), 100)) : 0;
    const color   = goalBarColor(pct);
    const remain  = target - current;
    const remainHTML = remain > 0
      ? `<div class="goal-remain">還差 ${fmt(remain)} 元</div>`
      : `<div class="goal-remain goal-remain--done">🎉 已達成目標</div>`;
    return `<div class="goal-card">
      <div class="goal-card-header">
        <div class="goal-card-left">
          <div class="goal-card-icon ${t.cls}">${t.icon}</div>
          <div>
            <div class="goal-card-name">${esc(g.name)}</div>
            <div class="goal-card-note">${g.note ? esc(g.note) : t.label}</div>
          </div>
        </div>
        <div class="goal-card-pct" style="color:${color}">${pct}%</div>
      </div>
      <div class="goal-bar-bg">
        <div class="goal-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="goal-card-footer">
        <div class="goal-amounts">
          ${fmt(Math.round(current))} / ${fmt(target)} 元
        </div>
        <div class="goal-actions">
          <button class="btn-sm" onclick="editGoal(${i})">✎</button>
          <button class="btn-sm del" onclick="deleteGoal(${i})">✕</button>
        </div>
      </div>
      ${remainHTML}
    </div>`;
  }).join('');
}

/** 首頁摘要：完成率最高的 3 個 */
function renderGoalsSummary() {
  const list = LS.get(KEY_G);
  const c = el('homeGoalsSummary');
  if (!c) return;
  if (!list.length) {
    c.innerHTML = '<div class="overview-empty">尚未設定任何目標 · <span style="color:var(--green);cursor:pointer" onclick="goTo(\'goals\')">立即新增 ›</span></div>';
    return;
  }
  // 計算各目標完成率並排序
  const ranked = list.map((g, i) => {
    const target  = parseFloat(g.target) || 0;
    const current = getGoalCurrent(g);
    const pct     = target > 0 ? Math.max(0, Math.min(Math.round(current / target * 100), 100)) : 0;
    return { g, i, pct };
  }).sort((a, b) => b.pct - a.pct).slice(0, 3);

  c.innerHTML = ranked.map(({ g, pct }) => {
    const t     = GOAL_TYPES[g.type] || GOAL_TYPES.custom;
    const color = goalBarColor(pct);
    return `<div class="goal-summary-row">
      <div class="goal-summary-left">
        <div class="goal-summary-icon">${t.icon}</div>
        <div class="goal-summary-name">${esc(g.name)}</div>
      </div>
      <div class="goal-summary-right">
        <div class="goal-mini-bar-bg">
          <div class="goal-mini-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="goal-summary-pct" style="color:${color}">${pct}%</div>
      </div>
    </div>`;
  }).join('');
}

/* ══ Goals Modal ══ */
let _goalEditIdx = -1;

function openGoalModal() {
  _goalEditIdx = -1;
  el('gfType').value   = 'networth';
  el('gfName').value   = '';
  el('gfTarget').value = '';
  el('gfCurrent').value= '';
  el('gfNote').value   = '';
  clearErr('gfError');
  onGoalTypeChange();
  setText('goalModalTitle', '新增財務目標');
  el('goalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => el('gfName').focus(), 320);
}

function editGoal(index) {
  const list = LS.get(KEY_G);
  const item = list[index]; if (!item) return;
  _goalEditIdx = index;
  el('gfType').value   = item.type   || 'networth';
  el('gfName').value   = item.name   || '';
  el('gfTarget').value = item.target || '';
  el('gfCurrent').value= item.type === 'custom' ? (item.current || '') : '';
  el('gfNote').value   = item.note   || '';
  clearErr('gfError');
  onGoalTypeChange();
  setText('goalModalTitle', '編輯財務目標');
  el('goalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeGoalModal() {
  el('goalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleGoalOverlayClick(e) {
  if (e.target === el('goalOverlay')) closeGoalModal();
}

/** 依目標類型切換「目前金額」欄位的顯示／隱藏 */
function onGoalTypeChange() {
  const isCustom = el('gfType').value === 'custom';
  const group = el('gfCurrentGroup');
  const note  = el('gfAutoNote');
  if (group) group.style.display = isCustom ? 'flex' : 'none';
  if (note)  note.style.display  = isCustom ? 'none' : 'block';
}

function saveGoal() {
  const type   = el('gfType').value;
  const name   = el('gfName').value.trim();
  const target = parseFloat(el('gfTarget').value);
  const note   = el('gfNote').value.trim();
  if (!name)                  { showFieldErr('gfError', '請輸入目標名稱'); return; }
  if (isNaN(target)||target<=0){ showFieldErr('gfError', '請輸入有效目標金額（> 0）'); return; }

  const item = { type, name, target, note };

  if (type === 'custom') {
    const current = parseFloat(el('gfCurrent').value);
    if (isNaN(current) || current < 0) { showFieldErr('gfError', '請輸入有效目前金額（≥ 0）'); return; }
    item.current = current;
  }

  const list = LS.get(KEY_G);
  if (_goalEditIdx >= 0) list[_goalEditIdx] = item; else list.push(item);
  LS.set(KEY_G, list);
  closeGoalModal();
  renderGoalsPage();
  renderGoalsSummary();
}

function deleteGoal(index) {
  const list = LS.get(KEY_G);
  if (!list[index]) return;
  if (!confirm(`確定刪除「${list[index].name || '此目標'}」？`)) return;
  list.splice(index, 1);
  LS.set(KEY_G, list);
  renderGoalsPage();
  renderGoalsSummary();
}

/* ══ 收入類型設定 ══ */
const INCOME_TYPES={
  salary:   {label:'薪資', icon:'💼', cls:'icon--cash'},
  bonus:    {label:'獎金', icon:'🎁', cls:'icon--deposit'},
  rent:     {label:'租金', icon:'🏠', cls:'icon--house'},
  dividend: {label:'股息', icon:'📈', cls:'icon--etf'},
  interest: {label:'利息', icon:'🏦', cls:'icon--deposit'},
  parttime: {label:'兼職', icon:'⚡', cls:'icon--other'},
  other:    {label:'其他', icon:'📋', cls:'icon--debt-other'},
};
const KEY_I='nw_income';

/* ══ 渲染收入區塊 ══ */
function renderIncomePage(){
  const list=LS.get(KEY_I);
  const total=list.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  setText('incomeBannerTotal',fmt(total));
  setText('incomeBannerSub',list.length+' 筆收入');

  const c=el('incomePageList');
  if(!c)return;
  if(!list.length){
    c.innerHTML='<div class="empty-hint">尚未新增任何收入<br>點下方按鈕開始新增</div>';
    return;
  }

  const ORDER=['salary','bonus','rent','dividend','interest','parttime','other'];
  const grouped={};
  list.forEach((e,i)=>{
    const k=e.type||'other';
    if(!grouped[k])grouped[k]=[];
    grouped[k].push({...e,_idx:i});
  });

  c.innerHTML=ORDER.filter(k=>grouped[k]).map(k=>{
    const t=INCOME_TYPES[k]||INCOME_TYPES.other;
    const items=grouped[k];
    const subtotal=items.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
    return`<div class="asset-group">
      <div class="asset-group-header">
        <div class="asset-group-label"><span class="asset-group-icon">${t.icon}</span>${t.label}</div>
        <div class="asset-group-total val--green">${fmt(subtotal)} 元 / 月</div>
      </div>
      ${items.map(e=>`<div class="item-card">
        <div class="item-icon ${t.cls}">${t.icon}</div>
        <div class="item-body">
          <div class="item-name">${esc(e.name)||t.label}</div>
          <div class="item-meta">${t.label}</div>
        </div>
        <div class="item-right">
          <div class="item-value val--green">${fmt(parseFloat(e.amount)||0)} 元 / 月</div>
        </div>
        <div class="item-actions">
          <button class="btn-sm" onclick="editIncome(${e._idx})">✎</button>
          <button class="btn-sm del" onclick="deleteIncome(${e._idx})">✕</button>
        </div>
      </div>`).join('')}
    </div>`;
  }).join('');
}

/* ══ 收入 Modal ══ */
let _incomeEditIdx=-1;

function openIncomeModal(){
  _incomeEditIdx=-1;
  el('ifType').value='salary';
  el('ifName').value='';
  el('ifAmount').value='';
  clearErr('ifError');
  setText('incomeModalTitle','新增每月收入');
  el('incomeOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>el('ifName').focus(),320);
}

function editIncome(index){
  const list=LS.get(KEY_I);
  const item=list[index];if(!item)return;
  _incomeEditIdx=index;
  el('ifType').value=item.type||'salary';
  el('ifName').value=item.name||'';
  el('ifAmount').value=item.amount||'';
  clearErr('ifError');
  setText('incomeModalTitle','編輯每月收入');
  el('incomeOverlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeIncomeModal(){
  el('incomeOverlay').classList.remove('open');
  document.body.style.overflow='';
}

function handleIncomeOverlayClick(e){
  if(e.target===el('incomeOverlay'))closeIncomeModal();
}

function saveIncome(){
  const type=el('ifType').value;
  const name=el('ifName').value.trim();
  const amount=parseFloat(el('ifAmount').value);
  if(!name){showFieldErr('ifError','請輸入名稱');return}
  if(isNaN(amount)||amount<0){showFieldErr('ifError','請輸入有效金額（≥ 0）');return}
  const item={type,name,amount};
  const list=LS.get(KEY_I);
  if(_incomeEditIdx>=0)list[_incomeEditIdx]=item;else list.push(item);
  LS.set(KEY_I,list);
  closeIncomeModal();
  renderIncomePage();
}

function deleteIncome(index){
  const list=LS.get(KEY_I);
  if(!list[index])return;
  if(!confirm(`確定刪除「${list[index].name||'此項目'}」？`))return;
  list.splice(index,1);LS.set(KEY_I,list);renderIncomePage();
}

/* ══ 支出類型設定 ══ */
const EXPENSE_TYPES={
  mortgage: {label:'房貸',   icon:'🏠', cls:'icon--mortgage'},
  carloan:  {label:'車貸',   icon:'🚗', cls:'icon--carloan'},
  personal: {label:'信貸',   icon:'💳', cls:'icon--personal'},
  credit:   {label:'信用卡', icon:'💰', cls:'icon--credit'},
  insurance:{label:'保險',   icon:'🔰', cls:'icon--other'},
  telecom:  {label:'電信',   icon:'📱', cls:'icon--cash'},
  utility:  {label:'水電',   icon:'💡', cls:'icon--deposit'},
  other:    {label:'其他',   icon:'📋', cls:'icon--debt-other'},
};
const KEY_E='nw_expenses';

/* ══ 渲染支出頁 ══ */
function renderExpensePage(){
  const list=LS.get(KEY_E);
  const total=list.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  setText('expenseBannerTotal',fmt(total));
  setText('expenseBannerSub',list.length+' 筆支出');

  const c=el('expensePageList');
  if(!c)return;
  if(!list.length){
    c.innerHTML='<div class="empty-hint">尚未新增任何固定支出<br>點下方按鈕開始新增</div>';
    return;
  }

  // 依類型分組
  const ORDER=['mortgage','carloan','personal','credit','insurance','telecom','utility','other'];
  const grouped={};
  list.forEach((e,i)=>{
    const k=e.type||'other';
    if(!grouped[k])grouped[k]=[];
    grouped[k].push({...e,_idx:i});
  });

  c.innerHTML=ORDER.filter(k=>grouped[k]).map(k=>{
    const t=EXPENSE_TYPES[k]||EXPENSE_TYPES.other;
    const items=grouped[k];
    const subtotal=items.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
    return`<div class="asset-group">
      <div class="asset-group-header">
        <div class="asset-group-label"><span class="asset-group-icon">${t.icon}</span>${t.label}</div>
        <div class="asset-group-total val--orange">${fmt(subtotal)} 元 / 月</div>
      </div>
      ${items.map(e=>`<div class="item-card">
        <div class="item-icon ${t.cls}">${t.icon}</div>
        <div class="item-body">
          <div class="item-name">${esc(e.name)||t.label}</div>
          <div class="item-meta">${t.label}</div>
        </div>
        <div class="item-right">
          <div class="item-value val--orange">${fmt(parseFloat(e.amount)||0)} 元 / 月</div>
        </div>
        <div class="item-actions">
          <button class="btn-sm" onclick="editExpense(${e._idx})">✎</button>
          <button class="btn-sm del" onclick="deleteExpense(${e._idx})">✕</button>
        </div>
      </div>`).join('')}
    </div>`;
  }).join('');
}

/* ══ 支出 Modal ══ */
let _expenseEditIdx=-1;

function openExpenseModal(){
  _expenseEditIdx=-1;
  el('efType').value='other';
  el('efName').value='';
  el('efAmount').value='';
  clearErr('efError');
  setText('expenseModalTitle','新增固定支出');
  el('expenseOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>el('efName').focus(),320);
}

function editExpense(index){
  const list=LS.get(KEY_E);
  const item=list[index];if(!item)return;
  _expenseEditIdx=index;
  el('efType').value=item.type||'other';
  el('efName').value=item.name||'';
  el('efAmount').value=item.amount||'';
  clearErr('efError');
  setText('expenseModalTitle','編輯固定支出');
  el('expenseOverlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeExpenseModal(){
  el('expenseOverlay').classList.remove('open');
  document.body.style.overflow='';
}

function handleExpenseOverlayClick(e){
  if(e.target===el('expenseOverlay'))closeExpenseModal();
}

function saveExpense(){
  const type=el('efType').value;
  const name=el('efName').value.trim();
  const amount=parseFloat(el('efAmount').value);
  if(!name){showFieldErr('efError','請輸入名稱');return}
  if(isNaN(amount)||amount<0){showFieldErr('efError','請輸入有效金額（≥ 0）');return}
  const item={type,name,amount};
  const list=LS.get(KEY_E);
  if(_expenseEditIdx>=0)list[_expenseEditIdx]=item;else list.push(item);
  LS.set(KEY_E,list);
  closeExpenseModal();
  renderExpensePage();
}

function deleteExpense(index){
  const list=LS.get(KEY_E);
  if(!list[index])return;
  if(!confirm(`確定刪除「${list[index].name||'此項目'}」？`))return;
  list.splice(index,1);LS.set(KEY_E,list);renderExpensePage();
}

function showFieldErr(id,msg){const e=el(id);if(!e)return;e.textContent='⚠ '+msg;e.classList.add('show')}
function clearErr(id){const e=el(id);if(!e)return;e.textContent='';e.classList.remove('show')}

/* ══ Modal ══ */
let _mode='asset', _editIdx=-1;

function openModal(mode){
  _mode=mode;_editIdx=-1;
  buildSelect(mode);clearForm();
  setText('modalTitle',mode==='asset'?'新增資產':'新增負債');
  el('modalOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>el('fName').focus(),320);
}

function editItem(mode,index){
  _mode=mode;_editIdx=index;
  const list=LS.get(mode==='asset'?KEY_A:KEY_D);
  const item=list[index];if(!item)return;
  buildSelect(mode);clearForm();
  setText('modalTitle',mode==='asset'?'編輯資產':'編輯負債');
  el('fType').value=item.type||'';
  el('fName').value=item.name||'';
  el('fAmount').value=item.amount||'';
  el('fCost').value=item.cost||'';
  el('fRate').value=item.rate||'';
  el('fNote').value=item.note||'';
  onTypeChange();
  el('modalOverlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeModal(){
  el('modalOverlay').classList.remove('open');
  document.body.style.overflow='';
}
function handleOverlayClick(e){if(e.target===el('modalOverlay'))closeModal()}

const NAME_PH={cash:'例：第一銀行活存、iLEO',etf:'例：0050 元大台灣50',house:'例：台北市房屋',deposit:'例：一銀定存 2 年期',mortgage:'例：玉山房貸',carloan:'例：中租車貸',personal:'例：國泰信貸',credit:'例：台新信用卡'};

function buildSelect(mode){
  const types=mode==='asset'?ASSET_TYPES:DEBT_TYPES;
  el('fType').innerHTML=types.map(t=>`<option value="${t.value}">${t.icon} ${t.label}</option>`).join('');
  onTypeChange();
}
function onTypeChange(){
  const v=el('fType').value;
  el('fCostGroup').style.display=v==='etf'?'flex':'none';
  el('fRateGroup').style.display=['mortgage','carloan','personal','credit'].includes(v)?'flex':'none';
  el('fName').placeholder=NAME_PH[v]||'請輸入名稱';
}
function clearForm(){
  ['fName','fAmount','fCost','fRate','fNote'].forEach(id=>{const e=el(id);if(e)e.value=''});
  const fe=el('fError');if(fe){fe.textContent='';fe.classList.remove('show')}
}
function showErr(msg){const e=el('fError');if(!e)return;e.textContent='⚠ '+msg;e.classList.add('show')}

function saveItem(){
  const type=el('fType').value;
  const name=el('fName').value.trim();
  const amount=parseFloat(el('fAmount').value);
  const cost=parseFloat(el('fCost').value);
  const rate=parseFloat(el('fRate').value);
  const note=el('fNote').value.trim();
  if(!name){showErr('請輸入名稱');return}
  if(isNaN(amount)||amount<0){showErr('請輸入有效金額（≥ 0）');return}
  if(!isNaN(rate)&&(rate<0||rate>50)){showErr('利率請輸入合理範圍');return}
  const item={type,name,amount};
  if(!isNaN(cost)&&cost>=0)item.cost=cost;
  if(!isNaN(rate)&&rate>=0)item.rate=rate;
  if(note)item.note=note;
  const key=_mode==='asset'?KEY_A:KEY_D;
  const list=LS.get(key);
  if(_editIdx>=0)list[_editIdx]=item;else list.push(item);
  LS.set(key,list);
  closeModal();renderAll();
}

function deleteItem(mode,index){
  const key=mode==='asset'?KEY_A:KEY_D;
  const list=LS.get(key);
  if(!list[index])return;
  if(!confirm(`確定刪除「${list[index].name||'此項目'}」？`))return;
  list.splice(index,1);LS.set(key,list);renderAll();
}

/* ══════════════════════════════════════════
   開發工具（v2.3）
   僅供開發／驗收測試使用，不影響一般使用者功能
══════════════════════════════════════════ */

/** 折疊區塊開關 */
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
    {type:'mortgage', name:'玉山房貸',       amount:8000000, rate:2.1},
    {type:'carloan',  name:'中租車貸',       amount:500000,  rate:3.5},
    {type:'personal', name:'國泰信貸',       amount:200000,  rate:5.88},
    {type:'credit',   name:'台新信用卡',     amount:30000},
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

  renderAll(); // 不需重新整理，立即更新所有頁面
}

/** 清除所有資料（不影響 UI 偏好，只清本專案用到的 localStorage） */
function clearAllData(){
  if(!confirm('確定要清除所有資料嗎？')) return;

  [KEY_A, KEY_D, KEY_I, KEY_E, KEY_G, KEY_LE].forEach(k=>{
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
