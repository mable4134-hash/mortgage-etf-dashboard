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
/* 貸款類負債：這三種類型會有貸款資訊卡
   - 房貸（mortgage）：v3.0 起改用 Mortgage Engine 完整攤還計算（見下方區塊）
   - 車貸／信貸（carloan／personal）：維持 v2.4 的簡易模式（手動維護每月應繳／剩餘期數）
   之後若車貸／信貸要比照房貸升級完整攤還功能，直接沿用 Mortgage Engine 架構即可，
   不要在其他地方寫死這幾個字串，一律引用 LOAN_TYPES／SIMPLE_LOAN_TYPES */
const LOAN_TYPES=['mortgage','carloan','personal'];
const SIMPLE_LOAN_TYPES=['carloan','personal'];

/* ══════════════════════════════════════════
   Mortgage Engine（v3.0）
   房貸攤還計算獨立封裝於此，未來車貸／信貸若需完整攤還功能可直接沿用。
   計算基礎：月利率 = 年利率 ÷ 12；計算過程不中途四捨五入，只在畫面顯示時四捨五入至整數元。
══════════════════════════════════════════ */
const REPAY_METHOD_LABEL = { equalPayment:'本息平均攤還', equalPrincipal:'本金平均攤還' };

/**
 * 建立完整攤還排程（每期本金／利息／應繳金額／期末剩餘本金）
 * 支援「本息平均攤還」與「本金平均攤還」兩種正式銀行公式，非簡化估算。
 */
function buildAmortizationSchedule(originalAmount, annualRatePct, totalMonths, method){
  const P = parseFloat(originalAmount) || 0;
  const n = parseInt(totalMonths, 10) || 0;
  const r = (parseFloat(annualRatePct) || 0) / 100 / 12; // 月利率
  const schedule = [];
  if (P <= 0 || n <= 0) return schedule;

  if (method === 'equalPrincipal') {
    // 本金平均攤還（等額本金）：每期本金固定，利息隨剩餘本金遞減
    const principalPortion = P / n;
    let remaining = P;
    for (let i = 0; i < n; i++) {
      const interestPortion = remaining * r;
      const actualPrincipal = Math.min(principalPortion, remaining);
      remaining = Math.max(0, remaining - actualPrincipal);
      schedule.push({ payment: actualPrincipal + interestPortion, principalPortion: actualPrincipal, interestPortion, remaining });
    }
  } else {
    // 本息平均攤還（等額本息）：M = P × r × (1+r)^n ÷ ((1+r)^n − 1)
    const factor = Math.pow(1 + r, n);
    const M = r === 0 ? P / n : P * r * factor / (factor - 1);
    let remaining = P;
    for (let i = 0; i < n; i++) {
      const interestPortion = remaining * r;
      let principalPortion = M - interestPortion;
      if (i === n - 1) principalPortion = remaining; // 最後一期修正尾差，避免累積誤差
      principalPortion = Math.max(0, Math.min(principalPortion, remaining));
      remaining = Math.max(0, remaining - principalPortion);
      schedule.push({ payment: principalPortion + interestPortion, principalPortion, interestPortion, remaining });
    }
  }
  return schedule;
}

/** 計算起貸日至今的完整月數（未滿一個月不計入），用來推算已還期數 */
function monthsBetween(startDate, endDate){
  if (!startDate) return 0;
  const start = new Date(startDate);
  const end = endDate || new Date();
  if (isNaN(start.getTime())) return 0;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Mortgage Engine 主入口：依貸款條件計算完整房貸現況
 * @param {object} loan - { originalAmount, currentPrincipal, rate, totalMonths, startDate, repaymentMethod }
 * 回傳：每月應繳金額／已還期數／剩餺期數／已還本金／已付利息／還款進度(%) 等
 */
function mortgageEngine(loan){
  const originalAmount = parseFloat(loan.originalAmount) || 0;
  const currentPrincipal = parseFloat(loan.currentPrincipal);
  const totalMonths = parseInt(loan.totalMonths, 10) || 0;
  const method = loan.repaymentMethod === 'equalPrincipal' ? 'equalPrincipal' : 'equalPayment';

  const schedule = buildAmortizationSchedule(originalAmount, loan.rate, totalMonths, method);
  const hasSchedule = schedule.length > 0;

  const paidMonths = hasSchedule ? Math.min(monthsBetween(loan.startDate), totalMonths) : 0;
  const remainingMonths = hasSchedule ? Math.max(0, totalMonths - paidMonths) : 0;

  const currentPeriod = hasSchedule
    ? (schedule[Math.min(paidMonths, totalMonths - 1)] || schedule[schedule.length - 1])
    : null;
  const monthlyPayment = currentPeriod ? currentPeriod.payment : 0;

  // 剩餺本金以使用者維護的欄位為準（可手動修正，會與理論排程略有落差，屬正常情況）
  const scheduleRemaining = hasSchedule ? (schedule[Math.max(0, paidMonths - 1)]?.remaining ?? originalAmount) : originalAmount;
  const remainingPrincipal = !isNaN(currentPrincipal) ? currentPrincipal : scheduleRemaining;
  const paidPrincipal = Math.max(0, originalAmount - remainingPrincipal);

  // 已付利息：採理論攤還排程中，累積到「已還期數」的利息加總
  const paidInterest = hasSchedule
    ? schedule.slice(0, paidMonths).reduce((s, p) => s + p.interestPortion, 0)
    : 0;

  const progressPct = totalMonths > 0 ? Math.max(0, Math.min(100, Math.round(paidMonths / totalMonths * 100))) : 0;

  return {
    originalAmount, remainingPrincipal, paidPrincipal, paidInterest,
    monthlyPayment, paidMonths, remainingMonths, totalMonths, progressPct, schedule,
  };
}

/**
 * 依固定月付金／固定本金逐期試算，直到還清或超過安全上限為止
 * method==='equalPrincipal' 時 fixedParam 為每期固定本金，否則為固定月付金
 */
function simulatePayoff(principal, monthlyRate, method, fixedParam, capMonths){
  let remaining = principal;
  let totalInterest = 0;
  let months = 0;
  const hardCap = Math.max((capMonths || 0) * 2, 1200); // 防止極端參數造成無窮迴圈
  while (remaining > 0.5 && months < hardCap) {
    const interest = remaining * monthlyRate;
    let principalPortion;
    if (method === 'equalPrincipal') {
      principalPortion = Math.min(fixedParam, remaining);
    } else {
      principalPortion = fixedParam - interest;
      if (principalPortion <= 0) return { months: Infinity, totalInterest: Infinity, payoff: false };
      principalPortion = Math.min(principalPortion, remaining);
    }
    totalInterest += interest;
    remaining -= principalPortion;
    months++;
  }
  return { months, totalInterest, payoff: remaining <= 0.5 };
}

/**
 * 提前還款試算（v3.0）：僅試算，不修改任何原始資料
 * 情境：現在立刻多繳一筆金額直接沖抵本金，之後仍按原本的月付金／攤還方式走完剩餘期數，
 * 比較「有提前還款」與「沒有提前還款」兩種情境的總利息與總期數差異。
 */
function mortgagePrepaymentSimulation(loan, prepayAmount){
  const engine = mortgageEngine(loan);
  const extra = parseFloat(prepayAmount) || 0;
  if (extra <= 0 || engine.remainingMonths <= 0 || engine.remainingPrincipal <= 0) {
    return { valid: false, interestSaved: 0, monthsSaved: 0 };
  }
  const r = (parseFloat(loan.rate) || 0) / 100 / 12;
  const method = loan.repaymentMethod === 'equalPrincipal' ? 'equalPrincipal' : 'equalPayment';
  const fixedParam = method === 'equalPrincipal'
    ? (parseFloat(loan.originalAmount) || 0) / (parseInt(loan.totalMonths, 10) || 1)
    : engine.monthlyPayment;

  const original = simulatePayoff(engine.remainingPrincipal, r, method, fixedParam, engine.remainingMonths);
  const newPrincipal = Math.max(0, engine.remainingPrincipal - extra);
  const withPrepay = simulatePayoff(newPrincipal, r, method, fixedParam, engine.remainingMonths);

  if (!original.payoff || !withPrepay.payoff) {
    return { valid: false, interestSaved: 0, monthsSaved: 0 };
  }

  return {
    valid: true,
    interestSaved: Math.max(0, original.totalInterest - withPrepay.totalInterest),
    monthsSaved: Math.max(0, original.months - withPrepay.months),
  };
}

/** 判斷這筆房貸是否已填妥完整條件，足以啟用 Mortgage Engine 自動試算 */
function isMortgageReady(item){
  return !isNaN(parseFloat(item.originalAmount)) && parseFloat(item.originalAmount) > 0
    && !isNaN(parseInt(item.totalMonths, 10)) && parseInt(item.totalMonths, 10) > 0
    && !!item.startDate;
}
/** 將負債資料轉成 Mortgage Engine 所需的輸入格式 */
function getMortgageLoanInput(item){
  return {
    originalAmount: item.originalAmount,
    currentPrincipal: item.amount,
    rate: item.rate,
    totalMonths: item.totalMonths,
    startDate: item.startDate,
    repaymentMethod: item.repaymentMethod,
  };
}

/* ══════════════════════════════════════════
   房貸剩餘本金 Auto / Manual 模式（v4.2）
   完全沿用既有 Mortgage Engine（buildAmortizationSchedule／mortgageEngine），
   不建立第二套公式、不使用簡化估算。
   Mortgage Engine 原本就支援「currentPrincipal 留空時，改用攤還排程推算的剩餘本金」，
   這裡只是明確地以此方式呼叫，並把結果同步寫回 localStorage 供既有的
   資產負債計算／財務健康／房貸試算等既有函式（皆未修改）直接讀取使用。
══════════════════════════════════════════ */

/** 取得這筆房貸目前的剩餘本金模式：'auto' 或 'manual'。
 *  舊資料（v4.1 以前建立、無此欄位）一律視為 'manual'，維持原本行為，確保向下相容。 */
function getRemainingPrincipalMode(item){
  return item.remainingPrincipalMode === 'auto' ? 'auto' : 'manual';
}

/** 直接呼叫既有 Mortgage Engine，強制忽略 item.amount，改用攤還排程推算目前剩餘本金
 *  （與 mortgageEngine() 內建的 fallback 邏輯完全相同，僅明確化呼叫方式，非新公式） */
function mortgageEngineAutoRemaining(item){
  const loan = getMortgageLoanInput(item);
  loan.currentPrincipal = undefined; // 強制走攤還排程計算，不受舊值影響
  return mortgageEngine(loan).remainingPrincipal;
}

/** 每次載入儀表板時執行一次：把所有「auto 模式」且資料已填妥的房貸，
 *  依今天日期重新計算剩餘本金並寫回 localStorage，讓房貸餘額自然隨時間遞減。
 *  manual 模式的房貸完全不受影響，維持使用者輸入值。 */
function syncAutoMortgagePrincipals(){
  const debts = LS.get(KEY_D);
  let changed = false;
  debts.forEach(d=>{
    if(d.type==='mortgage' && getRemainingPrincipalMode(d)==='auto' && isMortgageReady(d)){
      const newAmount = mortgageEngineAutoRemaining(d);
      if(d.amount !== newAmount){ d.amount = newAmount; changed = true; }
    }
  });
  if(changed) LS.set(KEY_D, debts);
}

/* ══════════════════════════════════════════
   房貸補貼機制（v5.1 / v5.1.1 修正輸入介面）
   讓「每月可存金額」正確反映房貸月付金，並支援「部分房貸由預留資金補貼」的情境
   （例如增貸後預留活存補貼房貸），使用者薪資實際負擔的金額可能低於銀行扣款金額。
   完全沿用既有 Mortgage Engine 計算月付金，不建立第二套公式。
   儲存欄位為 monthlyMortgageSubsidy；沒有此欄位（含 v5.0 以前、以及短暫存在於
   v5.1 的舊欄位名稱 monthlySubsidy）的資料一律視為補貼 0 元，行為與之前版本相同。
══════════════════════════════════════════ */

/** 單一房貸「補貼後實際負擔」＝房貸月付金－每月房貸補貼，最低不得小於 0。 */
/** v5.1.1：讀取房貸的每月補貼金額。正式欄位為 monthlyMortgageSubsidy；
 *  為相容 v5.1 曾使用過的欄位名稱 monthlySubsidy，若正式欄位不存在則回退讀取舊欄位；
 *  兩者皆無時視為 0 元，不影響任何舊資料。 */
function getMortgageSubsidyValue(item){
  if(item.monthlyMortgageSubsidy !== undefined) return parseFloat(item.monthlyMortgageSubsidy) || 0;
  return parseFloat(item.monthlySubsidy) || 0; // 相容 v5.1 舊欄位名稱
}

function getMortgageActualBurden(item){
  if(!isMortgageReady(item)) return 0;
  const monthlyPayment = mortgageEngine(getMortgageLoanInput(item)).monthlyPayment;
  const subsidy = getMortgageSubsidyValue(item);
  return Math.max(0, monthlyPayment - subsidy);
}

/** 彙總目前所有房貸的月付金／補貼／補貼後實際負擔，供首頁現金流卡片「🏦 房貸補貼」區塊顯示。
 *  僅房貸資料已填妥（isMortgageReady）者才納入計算；完全沒有房貸資料時三項皆為 0。 */
function getMortgageSubsidySummary(){
  const mortgages = LS.get(KEY_D).filter(d=>d.type==='mortgage' && isMortgageReady(d));
  let totalMonthlyPayment=0, totalSubsidy=0, totalActualBurden=0;
  mortgages.forEach(d=>{
    const monthlyPayment = mortgageEngine(getMortgageLoanInput(d)).monthlyPayment;
    const subsidy = getMortgageSubsidyValue(d);
    totalMonthlyPayment += monthlyPayment;
    totalSubsidy += subsidy;
    totalActualBurden += Math.max(0, monthlyPayment - subsidy);
  });
  return { count: mortgages.length, totalMonthlyPayment, totalSubsidy, totalActualBurden };
}

/** 所有貸款的「補貼後實際月負擔」加總，用於首頁每月可存金額公式。
 *  目前僅房貸支援補貼欄位。架構上以「逐筆貸款計算後加總」的方式撰寫（而非寫死單一房貸），
 *  未來若車貸／信貸（SIMPLE_LOAN_TYPES）也支援補貼欄位，可在此比照房貸的方式一併加總，
 *  不需更動這個函式的呼叫方式或首頁現金流的公式。 */
function getTotalLoanActualBurden(){
  let total = getMortgageSubsidySummary().totalActualBurden;
  // 預留擴充：SIMPLE_LOAN_TYPES（車貸／信貸）目前僅有既有的 monthlyPayment 欄位、尚未支援補貼欄位，
  // 故本版本不納入車貸／信貸的月付金，避免與固定支出頁既有的車貸／信貸紀錄產生新的重複計算問題。
  return total;
}


const LS={
  get(k,fb=[]){try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb}catch{return fb}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},
};
const KEY_A='nw_assets', KEY_D='nw_debts';
const KEY_LE='nw_living_expense';
/* 新手引導旗標（v4.0）：僅記錄「使用者是否已看過／完成過首次引導」，
   不屬於任何財務資料，不影響既有 nw_assets／nw_debts／... 等資料結構 */
const KEY_OB='nw_onboarding_completed';
/* Demo 模式旗標（v4.1）：僅標記目前畫面上的資料是否為一鍵載入的示範資料，
   不屬於財務資料本身，Demo 資料實際上仍寫入既有的 nw_assets／nw_debts／... 等 key，
   不新增任何獨立的示範資料結構 */
const KEY_DEMO='nw_demo_mode';
/* 投資中心（v5.0）：獨立資料 key「investments」，不使用 nw_ 前綴、不共用既有 nw_assets 結構，
   與資產頁既有的「股票／ETF」類型是兩套獨立機制，不會互相同步 */
const KEY_INV='investments';

/* ══ 系統資訊（v5.0，純展示用途） ══ */
const APP_VERSION='5.1.1';
const APP_UPDATE_DATE='2026-07-25';
const GITHUB_REPO_URL='https://github.com/mable4134-hash/mortgage-etf-dashboard';

/* ══ 工具 ══ */
function fmt(n){if(n===null||n===undefined||isNaN(n))return'--';return new Intl.NumberFormat('zh-TW').format(Math.round(n))}
function fmtPct(r){if(r===null||isNaN(r))return null;const p=(r*100).toFixed(2);return r>=0?`+${p}%`:`${p}%`}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

/** 產生一致風格的「空資料提示卡」（v4.0），取代單純的空白文字，說明用途並提供 CTA 按鈕 */
function emptyStateHTML(icon, title, benefits, ctaText, ctaOnclick){
  return `<div class="empty-state-card">
    <div class="empty-state-icon">${icon}</div>
    <div class="empty-state-title">${title}</div>
    <div class="empty-state-benefits">
      <div class="empty-state-benefits-label">建立後即可用於：</div>
      <ul>${benefits.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
    </div>
    <button class="empty-state-cta" onclick="${ctaOnclick}">${esc(ctaText)}</button>
  </div>`;
}
function el(id){return document.getElementById(id)}
function setText(id,t){const e=el(id);if(e)e.textContent=t}
function getType(mode,val){return(mode==='asset'?ASSET_TYPES:DEBT_TYPES).find(t=>t.value===val)||(mode==='asset'?ASSET_TYPES:DEBT_TYPES).at(-1)}

/* ══ 頁面切換 ══ */
const PAGE_META={
  home: {title:'資產負債儀表板', sub:'Net Worth Tracker'},
  asset:{title:'資產管理',       sub:'Asset Management'},
  debt: {title:'負債管理',       sub:'Debt Management'},
  investment:{title:'投資中心',  sub:'Investment Center'},
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
function itemHTML(item,mode,index){
  const t=getType(mode,item.type);
  const amt=parseFloat(item.amount)||0;
  const cost=parseFloat(item.cost);
  const hasReturn=item.type==='etf'&&!isNaN(cost)&&cost>0;
  const profit=hasReturn?amt-cost:null;
  const rateReturn=hasReturn?profit/cost:null;
  const pctStr=hasReturn?fmtPct(rateReturn):null;
  const pColor=profit!==null&&profit>=0?'var(--green)':'var(--red)';
  const isMortgage=mode==='debt'&&item.type==='mortgage';
  const isSimpleLoan=mode==='debt'&&SIMPLE_LOAN_TYPES.includes(item.type);
  const isLoan=isMortgage||isSimpleLoan;
  const meta=[];
  if(item.note)meta.push(esc(item.note));
  if(hasReturn)meta.push('成本 '+fmt(cost)+' 元');
  // 貸款類負債的年利率已經在下方貸款資訊卡顯示，這裡不重複列出
  if(item.rate&&mode==='debt'&&!isLoan)meta.push('年利率 '+parseFloat(item.rate).toFixed(2)+'%');

  const topRow=`<div class="item-card-top">
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

  if(!isLoan){
    return `<div class="item-card fade-in">${topRow}</div>`;
  }

  if(isSimpleLoan){
    // ══ 車貸／信貸：維持 v2.4 簡易貸款資訊卡（手動維護每月應繳／剩餘期數） ══
    const loanRate = parseFloat(item.rate);
    const monthlyPayment = parseFloat(item.monthlyPayment);
    const remainingMonths = parseInt(item.remainingMonths, 10);
    const hasRemaining = !isNaN(remainingMonths);

    const loanDetail = `<div class="loan-detail">
      <div class="loan-detail-item">
        <div class="loan-detail-label">剩餘本金</div>
        <div class="loan-detail-value">${fmt(amt)} 元</div>
      </div>
      <div class="loan-detail-item">
        <div class="loan-detail-label">年利率</div>
        <div class="loan-detail-value">${!isNaN(loanRate)?loanRate.toFixed(2)+'%':'--'}</div>
      </div>
      <div class="loan-detail-item">
        <div class="loan-detail-label">每月應繳</div>
        <div class="loan-detail-value">${!isNaN(monthlyPayment)?fmt(monthlyPayment)+' 元':'--'}</div>
      </div>
      <div class="loan-detail-item">
        <div class="loan-detail-label">剩餘期數</div>
        <div class="loan-detail-value">${hasRemaining?remainingMonths+' 期':'--'}</div>
      </div>
    </div>
    <button class="loan-pay-btn" onclick="payLoanMonth(${index})" ${hasRemaining&&remainingMonths<=0?'disabled':''}>
      ${hasRemaining&&remainingMonths<=0?'🎉 已繳清期數':'✅ 本月已還款'}
    </button>`;

    return `<div class="item-card item-card--loan fade-in">${topRow}${loanDetail}</div>`;
  }

  // ══ 房貸（v3.0 Mortgage Engine） ══
  if(!isMortgageReady(item)){
    const loanRate = parseFloat(item.rate);
    return `<div class="item-card item-card--loan fade-in">${topRow}
      <div class="loan-detail">
        <div class="loan-detail-item">
          <div class="loan-detail-label">剩餘本金</div>
          <div class="loan-detail-value">${fmt(amt)} 元</div>
        </div>
        <div class="loan-detail-item">
          <div class="loan-detail-label">年利率</div>
          <div class="loan-detail-value">${!isNaN(loanRate)?loanRate.toFixed(2)+'%':'--'}</div>
        </div>
      </div>
      <div class="mortgage-incomplete-hint">📝 補齊「原始貸款金額」「貸款總期數」「起貸日期」「還款方式」後，即可自動試算每月應繳、已還本金、已付利息與提前還款效果。</div>
    </div>`;
  }

  const r = mortgageEngine(getMortgageLoanInput(item));
  const methodLabel = REPAY_METHOD_LABEL[item.repaymentMethod] || REPAY_METHOD_LABEL.equalPayment;

  const mortgageDetail = `<div class="loan-detail">
    <div class="loan-detail-item">
      <div class="loan-detail-label">🏠 原始貸款金額</div>
      <div class="loan-detail-value">${fmt(r.originalAmount)} 元</div>
    </div>
    <div class="loan-detail-item">
      <div class="loan-detail-label">💰 剩餘本金</div>
      <div class="loan-detail-value">${fmt(r.remainingPrincipal)} 元</div>
    </div>
    <div class="loan-detail-item">
      <div class="loan-detail-label">📉 已還本金</div>
      <div class="loan-detail-value">${fmt(r.paidPrincipal)} 元</div>
    </div>
    <div class="loan-detail-item">
      <div class="loan-detail-label">💵 已付利息</div>
      <div class="loan-detail-value">${fmt(r.paidInterest)} 元</div>
    </div>
    <div class="loan-detail-item">
      <div class="loan-detail-label">📅 每月應繳金額</div>
      <div class="loan-detail-value">${fmt(r.monthlyPayment)} 元</div>
    </div>
    <div class="loan-detail-item">
      <div class="loan-detail-label">📆 已還期數</div>
      <div class="loan-detail-value">${r.paidMonths} / ${r.totalMonths} 期</div>
    </div>
    <div class="loan-detail-item">
      <div class="loan-detail-label">📈 年利率</div>
      <div class="loan-detail-value">${(parseFloat(item.rate)||0).toFixed(2)}%</div>
    </div>
    <div class="loan-detail-item">
      <div class="loan-detail-label">還款方式</div>
      <div class="loan-detail-value">${methodLabel}</div>
    </div>
  </div>
  <div class="mortgage-progress">
    <div class="mortgage-progress-label"><span>📊 還款進度</span><span>${r.progressPct}%</span></div>
    <div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${r.progressPct}%;background:var(--purple)"></div></div>
  </div>
  <div class="mortgage-prepay">
    <div class="mortgage-prepay-title">💡 提前還款試算</div>
    <div class="mortgage-prepay-row">
      <input class="form-input" id="prepayInput_${index}" type="number" placeholder="例：200000" min="0" inputmode="numeric"/>
      <button class="btn-sm-action" onclick="simulatePrepay(${index})">試算</button>
    </div>
    <div class="mortgage-prepay-result" id="prepayResult_${index}"></div>
    <div class="mortgage-prepay-hint">⚠️ 僅供試算，不會修改任何原始資料。</div>
  </div>`;

  return `<div class="item-card item-card--loan item-card--mortgage fade-in">${topRow}${mortgageDetail}</div>`;
}

/** 提前還款試算按鈕：讀取輸入金額，呼叫 Mortgage Engine 試算並顯示結果（v3.0） */
function simulatePrepay(index){
  const list = LS.get(KEY_D);
  const item = list[index];
  if(!item) return;
  const inputEl = el('prepayInput_'+index);
  const resultEl = el('prepayResult_'+index);
  if(!inputEl || !resultEl) return;
  const extra = parseFloat(inputEl.value);
  if(isNaN(extra) || extra <= 0){
    resultEl.innerHTML = '<div class="mortgage-prepay-error">請輸入有效的提前還款金額（大於 0）</div>';
    return;
  }
  const sim = mortgagePrepaymentSimulation(getMortgageLoanInput(item), extra);
  if(!sim.valid){
    resultEl.innerHTML = '<div class="mortgage-prepay-error">目前貸款條件無法試算，請確認原始貸款金額、總期數、年利率、起貸日期是否都已填寫。</div>';
    return;
  }
  resultEl.innerHTML = `
    <div class="mortgage-prepay-stat"><span>預估可節省利息</span><span class="val--green">${fmt(sim.interestSaved)} 元</span></div>
    <div class="mortgage-prepay-stat"><span>預估可縮短期數</span><span class="val--green">${sim.monthsSaved} 期</span></div>
  `;
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
    c.innerHTML=emptyStateHTML('💰','尚未建立任何資產',['淨資產計算','資產配置分析','財務健康評估'],'➕ 新增資產',"openModal('asset')");
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
    // v5.0：股票／ETF 類型持續提示改用投資中心管理，避免與投資中心重複計算總資產（純提示，不影響資料）
    const etfHintHTML = k==='etf'
      ? `<div class="info-hint-box" style="margin-bottom:8px">💡 建議改用 <span class="info-hint-link" onclick="goTo('investment')">投資中心</span> 管理股票／ETF，可記錄持有數量與價格並自動試算損益、報酬率；若同一筆持股在這裡與投資中心都有輸入，總資產會重複計算。</div>`
      : '';
    return`<div class="asset-group">
      <div class="asset-group-header">
        <div class="asset-group-label"><span class="asset-group-icon">${t.icon}</span>${t.label}</div>
        <div class="asset-group-total val--green">${fmt(subtotal)} 元</div>
      </div>
      ${etfHintHTML}
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

  // 每月貸款支出（v3.0）：房貸（Mortgage Engine 自動計算）＋車貸＋信貸（手動維護），信用卡與其他負債不列入
  const loanMonthlyTotal = debts.reduce((s,d)=>{
    if(d.type==='mortgage') return s + (isMortgageReady(d) ? mortgageEngine(getMortgageLoanInput(d)).monthlyPayment : 0);
    if(SIMPLE_LOAN_TYPES.includes(d.type)) return s + (parseFloat(d.monthlyPayment)||0);
    return s;
  },0);
  setText('loanMonthlyTotal', loanMonthlyTotal ? fmt(loanMonthlyTotal) : '--');

  const c=el('debtPageList');
  if(!c)return;
  if(!debts.length){
    c.innerHTML=emptyStateHTML('📉','尚未建立任何負債',['淨資產計算','負債比分析','財務健康評估'],'➕ 新增負債',"openModal('debt')");
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

/** 本月已還款（v2.4）：僅扣除一個月期數，不動任何本金／攤還計算
 *  這裡刻意保持單純，v2.5 會在此基礎上加入本息／本金攤還與提前還款邏輯 */
function payLoanMonth(index){
  const list = LS.get(KEY_D);
  const item = list[index];
  if(!item) return;
  const current = parseInt(item.remainingMonths, 10);
  if(isNaN(current) || current <= 0){
    alert('尚未設定剩餘期數，或期數已還清');
    return;
  }
  item.remainingMonths = current - 1;
  LS.set(KEY_D, list);
  renderDebtPage();
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
  if(isNaN(amount) || amount < 0){ showFieldErr('livingError','請輸入有效金額（≥ 0）','livingInput'); return; }
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
  const loanBurden    = getTotalLoanActualBurden(); // v5.1：所有貸款補貼後實際月負擔（目前為房貸月付金－房貸補貼，最低 0）

  // v5.1：預估每月可存金額 ＝ 收入－固定支出－生活費－所有貸款實際月負擔
  const disposable = totalIncome - totalExpense - livingExpense - loanBurden;

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

  // v5.1：🏦 房貸補貼區塊，只有在有房貸資料時顯示
  const subsidyInfo = getMortgageSubsidySummary();
  const subsidySection = el('cfMortgageSubsidySection');
  if(subsidySection){
    if(subsidyInfo.count){
      subsidySection.style.display='';
      setText('cfMortgagePayment', fmt(subsidyInfo.totalMonthlyPayment)+' 元');
      setText('cfMortgageSubsidy', fmt(subsidyInfo.totalSubsidy)+' 元');
      setText('cfMortgageActualBurden', fmt(subsidyInfo.totalActualBurden)+' 元');
    } else {
      subsidySection.style.display='none';
    }
  }
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

  // 等級（v3.1.1：四級 🟢優良／🟡尚可／🟠待改善／🔴高風險，分數計算公式不變）
  const grade = totalScore === null ? null
    : totalScore >= 80 ? { label:'🟢 優良',   color:'var(--green)',  bg:'var(--gbg)' }
    : totalScore >= 65 ? { label:'🟡 尚可',   color:'var(--yellow)', bg:'var(--ybg)' }
    : totalScore >= 45 ? { label:'🟠 待改善', color:'var(--orange)', bg:'var(--obg)' }
    :                    { label:'🔴 高風險', color:'var(--red)',    bg:'var(--rbg)' };

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
  // 註：負債比／固定支出率／儲蓄率的個別指標顯示已併入下方「📊 財務健康」五項指標卡（renderHealthOverview），
  // 這裡只負責分數與等級，避免同一份資料在畫面上重複呈現。
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

/** 首頁「🏦 房貸概況」（v3.0）：彙總所有房貸，若無房貸資料則自動隱藏整個區塊 */
function renderMortgageSummary(){
  const debts = LS.get(KEY_D);
  const mortgages = debts.filter(d=>d.type==='mortgage');
  const section = el('mortgageSummarySection');
  if(!section) return;

  if(!mortgages.length){
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  let totalRemaining=0, totalMonthly=0, totalPaidPrincipal=0, totalPaidInterest=0, totalOriginal=0, readyCount=0;
  mortgages.forEach(m=>{
    totalRemaining += parseFloat(m.amount)||0;
    if(isMortgageReady(m)){
      const r = mortgageEngine(getMortgageLoanInput(m));
      totalMonthly += r.monthlyPayment;
      totalPaidPrincipal += r.paidPrincipal;
      totalPaidInterest += r.paidInterest;
      totalOriginal += r.originalAmount;
      readyCount++;
    }
  });

  setText('mortgageSumRemaining', fmt(totalRemaining));
  setText('mortgageSumMonthly', readyCount ? fmt(totalMonthly) : '--');
  setText('mortgageSumPaidPrincipal', readyCount ? fmt(totalPaidPrincipal) : '--');
  setText('mortgageSumPaidInterest', readyCount ? fmt(totalPaidInterest) : '--');

  const progressPct = (readyCount && totalOriginal>0) ? Math.round(totalPaidPrincipal/totalOriginal*100) : 0;
  setText('mortgageSumProgress', readyCount ? progressPct+'%' : '--');
  const fill = el('mortgageSumProgressFill');
  if(fill) fill.style.width = (readyCount?progressPct:0)+'%';
}

/* ══════════════════════════════════════════
   📊 財務健康（v3.1）
   完全利用現有資料計算，不新增任何 localStorage
══════════════════════════════════════════ */

/** 分級小工具：回傳 {emoji, color} */
function healthGradeDebtRatio(ratio){ // 負債比：越低越好
  if(ratio===null) return {emoji:'⚪',color:'var(--tm)'};
  if(ratio<0.4) return {emoji:'🟢',color:'var(--green)'};
  if(ratio<=0.6) return {emoji:'🟡',color:'var(--yellow)'};
  return {emoji:'🔴',color:'var(--red)'};
}
function healthGradeSavRate(rate){ // 儲蓄率：越高越好
  if(rate===null) return {emoji:'⚪',color:'var(--tm)'};
  if(rate>=0.3) return {emoji:'🟢',color:'var(--green)'};
  if(rate>=0.1) return {emoji:'🟡',color:'var(--yellow)'};
  return {emoji:'🔴',color:'var(--red)'};
}
function healthGradeEmergency(months){ // 緊急預備金月數：越高越好
  if(months===null) return {emoji:'⚪',color:'var(--tm)'};
  if(months===Infinity||months>=6) return {emoji:'🟢',color:'var(--green)'};
  if(months>=3) return {emoji:'🟡',color:'var(--yellow)'};
  return {emoji:'🔴',color:'var(--red)'};
}
function healthGradeMortgageBurden(rate,hasMortgage){ // 房貸負擔率：越低越好；無房貸視為良好
  if(!hasMortgage) return {emoji:'🟢',color:'var(--green)'};
  if(rate===null) return {emoji:'⚪',color:'var(--tm)'};
  if(rate<0.3) return {emoji:'🟢',color:'var(--green)'};
  if(rate<=0.4) return {emoji:'🟡',color:'var(--yellow)'};
  return {emoji:'🔴',color:'var(--red)'};
}
function healthGradeGoalCompletion(pct){ // 財務目標完成率：越高越好（門檻沿用 Goals 頁 goalBarColor 的區間）
  if(pct===null) return {emoji:'⚪',color:'var(--tm)'};
  if(pct>=80) return {emoji:'🟢',color:'var(--green)'};
  if(pct>=50) return {emoji:'🟡',color:'var(--yellow)'};
  return {emoji:'🔴',color:'var(--red)'};
}

/** 設定單一指標的 dot 顏色與數值文字＋顏色＋分級 emoji */
function setHealthMetric(dotId, valId, grade, display){
  const d = el(dotId); if(d){ d.style.background = grade.color; d.style.boxShadow = grade.color==='var(--tm)' ? 'none' : `0 0 4px ${grade.color}`; }
  const v = el(valId); if(v){ v.textContent = display+' '+grade.emoji; v.style.color = grade.color; }
}

/** 依五項指標的分級狀況，產生最多 5 條規則式建議（非 AI，固定邏輯判斷），
 *  並依風險程度排序：🔴 高風險 → 🟡 注意 → 🟢 良好 */
function buildHealthSuggestions(m){
  const tips=[]; // {text, sev} sev: 0=紅(高風險) 1=黃(注意) 2=綠(良好)
  if(m.debtRatio!==null){
    if(m.debtRatio<0.4) tips.push({text:'✓ 負債比控制良好。', sev:2});
    else if(m.debtRatio<=0.6) tips.push({text:'⚠ 負債比偏高，建議留意舉債速度。', sev:1});
    else tips.push({text:'⚠ 負債比過高，建議優先降低負債。', sev:0});
  }
  if(m.savRate!==null){
    if(m.savRate>=0.3) tips.push({text:'✓ 每月儲蓄率良好。', sev:2});
    else if(m.savRate>=0.1) tips.push({text:'⚠ 儲蓄率偏低，可檢視固定支出結構。', sev:1});
    else tips.push({text:'⚠ 儲蓄率過低，建議檢討收支狀況。', sev:0});
  }
  if(m.emergencyMonths!==null){
    if(m.emergencyMonths===Infinity||m.emergencyMonths>=6) tips.push({text:'✓ 緊急預備金充足。', sev:2});
    else if(m.emergencyMonths>=3) tips.push({text:'⚠ 緊急預備金略顯不足，建議增加現金部位。', sev:1});
    else tips.push({text:'⚠ 緊急預備金明顯不足，建議優先累積。', sev:0});
  }
  if(m.hasMortgage && m.mortgageBurden!==null){
    if(m.mortgageBurden<0.3) tips.push({text:'✓ 房貸負擔率健康。', sev:2});
    else if(m.mortgageBurden<=0.4) tips.push({text:'⚠ 房貸負擔率偏高，建議留意每月現金流壓力。', sev:1});
    else tips.push({text:'⚠ 房貸負擔率過高，建議評估收入成長或部分還款計畫。', sev:0});
  }
  if(m.goalCompletion!==null){
    if(m.goalCompletion>=80) tips.push({text:'✓ 財務目標進度良好。', sev:2});
    else if(m.goalCompletion>=50) tips.push({text:'⚠ 財務目標完成率中等，可檢視存款進度。', sev:1});
    else tips.push({text:'⚠ 財務目標完成率偏低，建議檢視儲蓄計畫。', sev:0});
  }
  tips.sort((a,b)=>a.sev-b.sev); // 紅→黃→綠
  return tips.slice(0,5).map(t=>t.text);
}

/** 渲染「📊 財務健康」卡片的五項指標與建議（v3.1.1：與分數／等級合併為同一張卡片） */
function renderHealthOverview(){
  const assets   = LS.get(KEY_A);
  const debts    = LS.get(KEY_D);
  const incomes  = LS.get(KEY_I);
  const expenses = LS.get(KEY_E);
  const goals    = LS.get(KEY_G);
  const living   = getLivingExpense();

  const totalAsset   = assets.reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const totalIncome  = incomes.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const totalExpense = expenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const totalDebt    = debts.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  const cashTotal    = assets.filter(a=>a.type==='cash').reduce((s,a)=>s+(parseFloat(a.amount)||0),0);
  const depositTotal = assets.filter(a=>a.type==='deposit').reduce((s,a)=>s+(parseFloat(a.amount)||0),0);

  // 1. 負債比＝總負債 ÷ 總資產
  const debtRatio = totalAsset>0 ? totalDebt/totalAsset : null;
  // 2. 每月儲蓄率（沿用目前公式：可支配 ÷ 月收入，可支配＝收入－固定支出）
  const disposable = totalIncome - totalExpense;
  const savRate = totalIncome>0 ? disposable/totalIncome : null;
  // 3. 緊急預備金月數＝（現金＋定存）÷（固定支出＋生活費）
  const monthlyBurn = totalExpense + living;
  const emergencyMonths = monthlyBurn>0 ? (cashTotal+depositTotal)/monthlyBurn : ((cashTotal+depositTotal)>0?Infinity:null);
  // 4. 房貸負擔率＝房貸月付 ÷ 每月收入
  const hasMortgage = debts.some(d=>d.type==='mortgage');
  const mortgageMonthly = debts.filter(d=>d.type==='mortgage'&&isMortgageReady(d))
    .reduce((s,d)=>s+mortgageEngine(getMortgageLoanInput(d)).monthlyPayment,0);
  const mortgageBurden = (hasMortgage && totalIncome>0) ? mortgageMonthly/totalIncome : null;
  // 5. 財務目標完成率＝所有目標完成率的平均
  const goalCompletion = goals.length ? (goals.reduce((s,g)=>{
    const target = parseFloat(g.target)||0;
    const current = getGoalCurrent(g);
    const pct = target>0 ? Math.max(0,Math.min(100, current/target*100)) : 0;
    return s+pct;
  },0) / goals.length) : null;

  setHealthMetric('hoDebtRatioDot','hoDebtRatioVal', healthGradeDebtRatio(debtRatio),
    debtRatio===null?'--':(debtRatio*100).toFixed(1)+'%');
  setHealthMetric('hoSavRateDot','hoSavRateVal', healthGradeSavRate(savRate),
    savRate===null?'--':(savRate*100).toFixed(1)+'%');
  setHealthMetric('hoEmergencyDot','hoEmergencyVal', healthGradeEmergency(emergencyMonths),
    emergencyMonths===null?'--':emergencyMonths===Infinity?'∞':emergencyMonths.toFixed(1)+' 個月');
  setHealthMetric('hoMortgageBurdenDot','hoMortgageBurdenVal', healthGradeMortgageBurden(mortgageBurden,hasMortgage),
    !hasMortgage?'無房貸':mortgageBurden===null?'--':(mortgageBurden*100).toFixed(1)+'%');
  setHealthMetric('hoGoalDot','hoGoalVal', healthGradeGoalCompletion(goalCompletion),
    goalCompletion===null?'--':goalCompletion.toFixed(1)+'%');

  const tips = buildHealthSuggestions({debtRatio,savRate,emergencyMonths,mortgageBurden,hasMortgage,goalCompletion});
  const listEl = el('healthSuggestList');
  if(listEl){
    listEl.innerHTML = tips.length
      ? tips.map(t=>`<li>${t}</li>`).join('')
      : '<li class="health-suggest-empty">尚無足夠資料可提供建議，請先新增資產、負債、收入與支出資料。</li>';
  }
}

/* ══════════════════════════════════════════
   新手引導 Onboarding（v4.0）
   純 UI／導覽邏輯，不涉及任何財務計算或既有資料結構
══════════════════════════════════════════ */

/** 是否已完成過一次引導（使用者按過「開始建立」就會是 true，之後永久不再顯示） */
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
const INVESTMENT_TYPES=[
  {value:'etf',   label:'ETF',   icon:'📈', cls:'icon--inv-etf'},
  {value:'stock', label:'股票',  icon:'📊', cls:'icon--inv-stock'},
  {value:'fund',  label:'基金',  icon:'🧺', cls:'icon--inv-fund'},
  {value:'reits', label:'REITs', icon:'🏢', cls:'icon--inv-reits'},
  {value:'bond',  label:'債券',  icon:'📜', cls:'icon--inv-bond'},
  {value:'other', label:'其他',  icon:'📦', cls:'icon--inv-other'},
];
function getInvType(val){ return INVESTMENT_TYPES.find(t=>t.value===val) || INVESTMENT_TYPES.at(-1); }

/** 單筆投資的自動計算：投資成本／目前市值／未實現損益／報酬率（全部即時計算，不可手動輸入） */
function investmentItemCalc(item){
  const quantity = parseFloat(item.quantity) || 0;
  const avgCost  = parseFloat(item.avgCost)   || 0;
  const price    = parseFloat(item.latestPrice) || 0;
  const cost        = avgCost * quantity;
  const marketValue = price * quantity;
  const pl          = marketValue - cost;
  const returnRate  = cost > 0 ? (pl / cost * 100) : null;
  return { quantity, avgCost, price, cost, marketValue, pl, returnRate };
}

/** 所有投資資料自動加總（用於首頁「📈 投資總覽」卡片與投資頁橫幅） */
function getInvestmentTotals(){
  const list = LS.get(KEY_INV);
  let totalCost=0, totalMarketValue=0;
  list.forEach(inv=>{
    const c = investmentItemCalc(inv);
    totalCost += c.cost;
    totalMarketValue += c.marketValue;
  });
  const totalPL = totalMarketValue - totalCost;
  const returnRate = totalCost > 0 ? (totalPL / totalCost * 100) : null;
  return { count: list.length, totalCost, totalMarketValue, totalPL, returnRate };
}

function fmtReturnRate(rate){
  if (rate === null || isNaN(rate)) return '--';
  return (rate >= 0 ? '+' : '') + rate.toFixed(2) + '%';
}

/** 產生單筆投資項目卡片 HTML */
function investmentItemHTML(item, index){
  const t = getInvType(item.type);
  const c = investmentItemCalc(item);
  const plColor = c.pl >= 0 ? 'var(--green)' : 'var(--red)';
  return `<div class="item-card item-card--loan fade-in">
    <div class="item-card-top">
      <div class="item-icon ${t.cls}">${t.icon}</div>
      <div class="item-body">
        <div class="item-name">${esc(item.name)||t.label}</div>
        <div class="item-meta">${t.label} · 持有 ${c.quantity} 單位</div>
      </div>
      <div class="item-right">
        <div class="item-value val--blue">${fmt(c.marketValue)} 元</div>
        <div class="item-sub" style="color:${plColor}">${fmtReturnRate(c.returnRate)}（${c.pl>=0?'+':''}${fmt(c.pl)}）</div>
      </div>
      <div class="item-actions">
        <button class="btn-sm" onclick="editInvestment(${index})">✎</button>
        <button class="btn-sm del" onclick="deleteInvestment(${index})">✕</button>
      </div>
    </div>
    <div class="loan-detail">
      <div class="loan-detail-item">
        <div class="loan-detail-label">持有數量</div>
        <div class="loan-detail-value">${c.quantity}</div>
      </div>
      <div class="loan-detail-item">
        <div class="loan-detail-label">平均成本</div>
        <div class="loan-detail-value">${fmt(c.avgCost)} 元</div>
      </div>
      <div class="loan-detail-item">
        <div class="loan-detail-label">最新價格</div>
        <div class="loan-detail-value">${fmt(c.price)} 元</div>
      </div>
      <div class="loan-detail-item">
        <div class="loan-detail-label">投資成本</div>
        <div class="loan-detail-value">${fmt(c.cost)} 元</div>
      </div>
      <div class="loan-detail-item">
        <div class="loan-detail-label">目前市值</div>
        <div class="loan-detail-value val--blue">${fmt(c.marketValue)} 元</div>
      </div>
      <div class="loan-detail-item">
        <div class="loan-detail-label">未實現損益</div>
        <div class="loan-detail-value" style="color:${plColor}">${c.pl>=0?'+':''}${fmt(c.pl)} 元</div>
      </div>
      <div class="loan-detail-item">
        <div class="loan-detail-label">報酬率</div>
        <div class="loan-detail-value" style="color:${plColor}">${fmtReturnRate(c.returnRate)}</div>
      </div>
    </div>
  </div>`;
}

/** 渲染投資頁：橫幅總計＋依類型分組列表；沒有資料時顯示 Empty State */
function renderInvestmentPage(){
  const list = LS.get(KEY_INV);
  const totals = getInvestmentTotals();

  setText('invBannerMarketValue', fmt(totals.totalMarketValue));
  setText('invBannerCost', fmt(totals.totalCost));
  const plEl = el('invBannerPL');
  if(plEl){
    plEl.textContent = (totals.totalPL>=0?'+':'') + fmt(totals.totalPL) + ' 元';
    plEl.style.color = totals.count ? (totals.totalPL>=0?'var(--green)':'var(--red)') : 'var(--t1)';
  }
  setText('invBannerReturnRate', totals.count ? '報酬率 '+fmtReturnRate(totals.returnRate) : '--');

  const c = el('investmentPageList');
  if(!c) return;
  if(!list.length){
    c.innerHTML = emptyStateHTML('📈','尚未建立任何投資',['投資成本','市值','損益','報酬率'],'➕ 新增第一筆投資','openInvestmentModal()');
    return;
  }

  const ORDER=['etf','stock','fund','reits','bond','other'];
  const grouped={};
  list.forEach((inv,i)=>{
    const k=inv.type||'other';
    if(!grouped[k])grouped[k]=[];
    grouped[k].push({...inv,_idx:i});
  });

  c.innerHTML = ORDER.filter(k=>grouped[k]).map(k=>{
    const t = getInvType(k);
    const items = grouped[k];
    const subtotal = items.reduce((s,inv)=>s+investmentItemCalc(inv).marketValue,0);
    return `<div class="asset-group">
      <div class="asset-group-header">
        <div class="asset-group-label"><span class="asset-group-icon">${t.icon}</span>${t.label}</div>
        <div class="asset-group-total val--blue">${fmt(subtotal)} 元</div>
      </div>
      ${items.map(inv=>investmentItemHTML(inv,inv._idx)).join('')}
    </div>`;
  }).join('');
}

/** 首頁「📈 投資總覽」卡片：所有投資資料自動加總 */
function renderHomeInvestmentSummary(){
  const totals = getInvestmentTotals();
  const c = el('homeInvestSummary');
  if(!c) return;
  if(!totals.count){
    c.innerHTML = '<div class="overview-empty">尚未新增任何投資 · <span style="color:var(--green);cursor:pointer" onclick="goTo(\'investment\')">立即新增 ›</span></div>';
    return;
  }
  const plColor = totals.totalPL>=0?'var(--green)':'var(--red)';
  c.innerHTML = `<div class="mortgage-summary-grid" style="margin-top:0">
    <div class="mortgage-summary-item">
      <div class="mortgage-summary-item-label">投資成本</div>
      <div class="mortgage-summary-item-value">${fmt(totals.totalCost)}</div>
    </div>
    <div class="mortgage-summary-item">
      <div class="mortgage-summary-item-label">目前市值</div>
      <div class="mortgage-summary-item-value val--blue">${fmt(totals.totalMarketValue)}</div>
    </div>
    <div class="mortgage-summary-item">
      <div class="mortgage-summary-item-label">未實現損益</div>
      <div class="mortgage-summary-item-value" style="color:${plColor}">${totals.totalPL>=0?'+':''}${fmt(totals.totalPL)}</div>
    </div>
    <div class="mortgage-summary-item">
      <div class="mortgage-summary-item-label">報酬率</div>
      <div class="mortgage-summary-item-value" style="color:${plColor}">${fmtReturnRate(totals.returnRate)}</div>
    </div>
  </div>`;
}

/* ══ 投資 Modal（CRUD） ══ */
let _invEditIdx=-1;

function openInvestmentModal(){
  _invEditIdx=-1;
  el('invType').value='etf';
  el('invName').value='';
  el('invQuantity').value='';
  el('invAvgCost').value='';
  el('invPrice').value='';
  clearErr('invError');
  setText('investmentModalTitle','新增投資');
  el('investmentOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>el('invName').focus(),320);
}

function editInvestment(index){
  const list=LS.get(KEY_INV);
  const item=list[index]; if(!item) return;
  _invEditIdx=index;
  el('invType').value=item.type||'etf';
  el('invName').value=item.name||'';
  el('invQuantity').value=item.quantity||'';
  el('invAvgCost').value=item.avgCost||'';
  el('invPrice').value=item.latestPrice||'';
  clearErr('invError');
  setText('investmentModalTitle','編輯投資');
  el('investmentOverlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeInvestmentModal(){
  el('investmentOverlay').classList.remove('open');
  document.body.style.overflow='';
}

function handleInvestmentOverlayClick(e){
  if(e.target===el('investmentOverlay')) closeInvestmentModal();
}

function saveInvestment(){
  const type = el('invType').value;
  const name = el('invName').value.trim();
  const quantity = parseFloat(el('invQuantity').value);
  const avgCost = parseFloat(el('invAvgCost').value);
  const latestPrice = parseFloat(el('invPrice').value);

  if(!name){ showFieldErr('invError','請輸入名稱','invName'); return; }
  if(isNaN(quantity)||quantity<=0){ showFieldErr('invError','請輸入有效持有數量（> 0）','invQuantity'); return; }
  if(isNaN(avgCost)||avgCost<0){ showFieldErr('invError','請輸入有效平均成本（≥ 0）','invAvgCost'); return; }
  if(isNaN(latestPrice)||latestPrice<0){ showFieldErr('invError','請輸入有效最新價格（≥ 0）','invPrice'); return; }

  const item = { type, name, quantity, avgCost, latestPrice };
  const list = LS.get(KEY_INV);
  if(_invEditIdx>=0) list[_invEditIdx]=item; else list.push(item);
  LS.set(KEY_INV, list);
  closeInvestmentModal();
  renderInvestmentPage();
  renderHomeInvestmentSummary();
  renderSummary(); // v5.0 資產同步：投資市值變動會影響首頁總資產／淨資產
}

function deleteInvestment(index){
  const list=LS.get(KEY_INV);
  if(!list[index]) return;
  if(!confirm(`確定刪除「${list[index].name||'此筆投資'}」？`)) return;
  list.splice(index,1);
  LS.set(KEY_INV, list);
  renderInvestmentPage();
  renderHomeInvestmentSummary();
  renderSummary();
}

function renderAll(){syncAutoMortgagePrincipals();renderSummary();renderHomeOverview();renderLivingExpense();renderCashflow();renderHealthCard();renderHealthOverview();renderAssetAllocation();renderMortgageSummary();renderGoalsSummary();renderOnboarding();renderDataCompleteness();renderDemoSection();renderSystemInfo();renderAssetPage();renderDebtPage();renderExpensePage();renderIncomePage();renderGoalsPage();renderInvestmentPage();renderHomeInvestmentSummary()}


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
    c.innerHTML = emptyStateHTML('🎯','尚未建立財務目標',['達成率追蹤','剩餘金額試算'],'建立第一個目標','openGoalModal()');
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
  if (!name)                  { showFieldErr('gfError', '請輸入目標名稱', 'gfName'); return; }
  if (isNaN(target)||target<=0){ showFieldErr('gfError', '請輸入有效目標金額（> 0）', 'gfTarget'); return; }

  const item = { type, name, target, note };

  if (type === 'custom') {
    const current = parseFloat(el('gfCurrent').value);
    if (isNaN(current) || current < 0) { showFieldErr('gfError', '請輸入有效目前金額（≥ 0）', 'gfCurrent'); return; }
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
    c.innerHTML=emptyStateHTML('💰','尚未建立收入',['現金流分析','儲蓄率計算','財務健康評估'],'➕ 新增收入','openIncomeModal()');
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
  if(!name){showFieldErr('ifError','請輸入名稱','ifName');return}
  if(isNaN(amount)||amount<0){showFieldErr('ifError','請輸入有效金額（≥ 0）','ifAmount');return}
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
    c.innerHTML=emptyStateHTML('💸','尚未建立固定支出',['現金流分析','儲蓄率計算','財務健康評估'],'➕ 新增固定支出','openExpenseModal()');
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
    // v5.1：房貸類固定支出持續提示，房貸月付金已由負債頁自動計入首頁現金流，避免重複計算（純提示，不影響資料）
    const mortgageHintHTML = k==='mortgage'
      ? `<div class="info-hint-box" style="margin-bottom:8px">💡 房貸月付金已由「負債」頁的房貸資料自動計算，並計入首頁「每月可存金額」；此處的房貸類固定支出會被重複扣一次，建議移除或改記其他類型。</div>`
      : '';
    return`<div class="asset-group">
      <div class="asset-group-header">
        <div class="asset-group-label"><span class="asset-group-icon">${t.icon}</span>${t.label}</div>
        <div class="asset-group-total val--orange">${fmt(subtotal)} 元 / 月</div>
      </div>
      ${mortgageHintHTML}
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

/** v5.1：固定支出類型為「房貸」時顯示重複計算提醒（房貸月付金已由負債頁自動計入首頁現金流） */
function onExpenseTypeChange(){
  const hint = el('efMortgageHint');
  if(hint) hint.style.display = (el('efType').value==='mortgage') ? 'block' : 'none';
}

function openExpenseModal(){
  _expenseEditIdx=-1;
  el('efType').value='other';
  el('efName').value='';
  el('efAmount').value='';
  clearErr('efError');
  onExpenseTypeChange();
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
  onExpenseTypeChange();
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
  if(!name){showFieldErr('efError','請輸入名稱','efName');return}
  if(isNaN(amount)||amount<0){showFieldErr('efError','請輸入有效金額（≥ 0）','efAmount');return}
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

/** v4.2：驗證失敗時，將對應欄位捲動至可視範圍並自動 focus，避免錯誤訊息被底部按鈕遮住 */
function scrollAndFocusField(fieldId){
  const field = el(fieldId);
  if(!field) return;
  field.scrollIntoView({behavior:'smooth', block:'center'});
  setTimeout(()=>{ field.focus(); }, 300);
}
function showFieldErr(id,msg,fieldId){const e=el(id);if(!e)return;e.textContent='⚠ '+msg;e.classList.add('show');if(fieldId)scrollAndFocusField(fieldId)}
function clearErr(id){const e=el(id);if(!e)return;e.textContent='';e.classList.remove('show')}

/* ══ Modal ══ */
let _mode='asset', _editIdx=-1;

function openModal(mode){
  _mode=mode;_editIdx=-1;
  clearForm();buildSelect(mode);
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
  const isAutoMortgage = mode==='debt' && item.type==='mortgage' && getRemainingPrincipalMode(item)==='auto';
  el('fAmount').value=isAutoMortgage?'':(item.amount||'');
  el('fCost').value=item.cost||'';
  el('fRate').value=item.rate||'';
  el('fNote').value=item.note||'';
  el('fMonthly').value=item.monthlyPayment||'';
  el('fRemaining').value=item.remainingMonths||'';
  el('fOriginal').value=item.originalAmount||'';
  el('fTotalMonths').value=item.totalMonths||'';
  el('fStartDate').value=item.startDate||'';
  if(el('fRepayMethod'))el('fRepayMethod').value=item.repaymentMethod||'equalPayment';
  if(el('fMonthlySubsidy'))el('fMonthlySubsidy').value=getMortgageSubsidyValue(item)||'';
  onTypeChange();
  // v4.2：auto 模式的房貸，欄位保持空白（避免重新儲存時被誤判為手動輸入），
  // 但以 placeholder 顯示目前自動計算的剩餘本金供參考
  if(isAutoMortgage){
    const fAmountEl=el('fAmount');
    if(fAmountEl) fAmountEl.placeholder='目前自動計算約 '+fmt(item.amount)+' 元（留空繼續自動更新）';
  }
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
  const isMortgageType = _mode==='debt' && v==='mortgage';
  const isSimpleLoanType = _mode==='debt' && SIMPLE_LOAN_TYPES.includes(v);
  el('fCostGroup').style.display=v==='etf'?'flex':'none';
  el('fRateGroup').style.display=['mortgage','carloan','personal','credit'].includes(v)?'flex':'none';
  el('fOriginalGroup').style.display=isMortgageType?'flex':'none';
  el('fTotalMonthsGroup').style.display=isMortgageType?'flex':'none';
  el('fStartDateGroup').style.display=isMortgageType?'flex':'none';
  el('fRepayMethodGroup').style.display=isMortgageType?'flex':'none';
  el('fMonthlySubsidyGroup').style.display=isMortgageType?'flex':'none';
  el('fMonthlyGroup').style.display=isSimpleLoanType?'flex':'none';
  el('fRemainingGroup').style.display=isSimpleLoanType?'flex':'none';
  const amountLabel=el('fAmountLabel');
  if(amountLabel)amountLabel.textContent=(isMortgageType||isSimpleLoanType)?'剩餘本金（元）':'金額（元）';
  el('fName').placeholder=NAME_PH[v]||'請輸入名稱';
  // v4.2：房貸剩餘本金改為選填，留空時自動計算；顯示提示並更新 placeholder
  const fAmountEl=el('fAmount');
  const amountHint=el('fAmountHint');
  if(isMortgageType){
    if(fAmountEl && !fAmountEl.value) fAmountEl.placeholder='留空將自動計算目前剩餘本金';
    if(amountHint) amountHint.style.display='block';
  } else {
    if(fAmountEl) fAmountEl.placeholder='例：500000';
    if(amountHint) amountHint.style.display='none';
  }
  // v5.0：股票／ETF 提示改用投資中心管理，避免與投資中心重複計算總資產（純提示，不影響資料與計算）
  const etfHint=el('fEtfHint');
  if(etfHint) etfHint.style.display=(_mode==='asset' && v==='etf')?'block':'none';
}
function clearForm(){
  ['fName','fAmount','fCost','fRate','fNote','fMonthly','fRemaining','fOriginal','fTotalMonths','fStartDate','fMonthlySubsidy'].forEach(id=>{const e=el(id);if(e)e.value=''});
  const rm=el('fRepayMethod');if(rm)rm.value='equalPayment';
  const fe=el('fError');if(fe){fe.textContent='';fe.classList.remove('show')}
}
function showErr(msg,fieldId){const e=el('fError');if(!e)return;e.textContent='⚠ '+msg;e.classList.add('show');if(fieldId)scrollAndFocusField(fieldId)}

function saveItem(){
  const type=el('fType').value;
  const name=el('fName').value.trim();
  const amountRaw=el('fAmount').value.trim();
  const amount=parseFloat(amountRaw);
  const cost=parseFloat(el('fCost').value);
  const rate=parseFloat(el('fRate').value);
  const note=el('fNote').value.trim();
  const monthlyPayment=parseFloat(el('fMonthly').value);
  const remainingMonths=parseInt(el('fRemaining').value,10);
  const originalAmount=parseFloat(el('fOriginal').value);
  const totalMonths=parseInt(el('fTotalMonths').value,10);
  const startDate=el('fStartDate').value;
  const repaymentMethod=el('fRepayMethod')?el('fRepayMethod').value:'equalPayment';
  const monthlySubsidy=parseFloat(el('fMonthlySubsidy')?el('fMonthlySubsidy').value:'');

  const isMortgageType = _mode==='debt' && type==='mortgage';
  const isSimpleLoanType = _mode==='debt' && SIMPLE_LOAN_TYPES.includes(type);

  if(!name){showErr('請輸入名稱','fName');return}
  // v4.2：房貸的剩餘本金改為選填，留空時將自動計算；其他類型維持必填
  if(isMortgageType){
    if(amountRaw!=='' && (isNaN(amount)||amount<0)){showErr('剩餘本金請輸入有效金額（≥ 0），或留空以自動計算','fAmount');return}
  } else {
    if(isNaN(amount)||amount<0){showErr('請輸入有效金額（≥ 0）','fAmount');return}
  }
  if(!isNaN(rate)&&(rate<0||rate>50)){showErr('利率請輸入合理範圍','fRate');return}
  // v5.1：每月房貸補貼為選填，若有輸入須為有效非負數
  if(isMortgageType && !isNaN(monthlySubsidy) && monthlySubsidy<0){showErr('每月房貸補貼請輸入有效數字（≥ 0）','fMonthlySubsidy');return}

  if(isSimpleLoanType && !isNaN(monthlyPayment) && monthlyPayment<0){showErr('每月應繳金額請輸入有效數字（≥ 0）','fMonthly');return}
  if(isSimpleLoanType && !isNaN(remainingMonths) && remainingMonths<0){showErr('剩餘期數請輸入有效數字（≥ 0）','fRemaining');return}
  if(isMortgageType && !isNaN(originalAmount) && originalAmount<0){showErr('原始貸款金額請輸入有效數字（≥ 0）','fOriginal');return}
  if(isMortgageType && !isNaN(totalMonths) && totalMonths<0){showErr('貸款總期數請輸入有效數字（≥ 0）','fTotalMonths');return}

  const item={type,name};
  if(!isNaN(cost)&&cost>=0)item.cost=cost;
  if(!isNaN(rate)&&rate>=0)item.rate=rate;
  if(note)item.note=note;
  if(isSimpleLoanType){
    if(!isNaN(monthlyPayment)&&monthlyPayment>=0)item.monthlyPayment=monthlyPayment;
    if(!isNaN(remainingMonths)&&remainingMonths>=0)item.remainingMonths=remainingMonths;
  }
  if(isMortgageType){
    if(!isNaN(originalAmount)&&originalAmount>=0)item.originalAmount=originalAmount;
    if(!isNaN(totalMonths)&&totalMonths>=0)item.totalMonths=totalMonths;
    if(startDate)item.startDate=startDate;
    item.repaymentMethod=repaymentMethod;
    // v5.1：每月房貸補貼，留空或 0 則不寫入（讀取端一律以 parseFloat(...)||0 處理，等同 0 元，維持向下相容）
    if(!isNaN(monthlySubsidy)&&monthlySubsidy>0)item.monthlyMortgageSubsidy=monthlySubsidy;
  }

  // v4.2：依剩餘本金欄位是否留空，決定 auto／manual 模式（功能三：手動輸入優先，功能四：模式標記）
  if(isMortgageType){
    if(amountRaw===''){
      item.remainingPrincipalMode='auto';
      // 直接呼叫既有 Mortgage Engine 計算初始值，不建立第二套公式；之後每次載入由 syncAutoMortgagePrincipals() 依當天日期自動更新
      item.amount = isMortgageReady(item) ? mortgageEngineAutoRemaining(item) : 0;
    } else {
      item.amount = amount;
      item.remainingPrincipalMode='manual';
    }
  } else {
    item.amount = amount;
  }

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
