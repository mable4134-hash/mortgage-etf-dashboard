/* ══════════════════════════════════════════
   cashflow.js（v5.5 重構）
   收入／固定支出／每月生活費 CRUD 與現金流計算
   原規格建議架構未列出對應模組名稱，依「高內聚、低耦合」原則獨立拆分於此，
   避免與 dashboard.js 混雜（此為模組化調整，非新增功能，所有函式與原程式碼完全一致）
   依賴：storage.js、utils.js、config.js、mortgage.js（房貸實際負擔計入現金流）
══════════════════════════════════════════ */

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
/* ══════════════════════════════════════════
   health.js（v5.5 重構）
   財務健康分數／等級／五項指標／規則式建議
   依賴：storage.js、utils.js、mortgage.js、goals.js、cashflow.js（getLivingExpense）
══════════════════════════════════════════ */

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

