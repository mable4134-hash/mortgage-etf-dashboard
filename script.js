/* ============================================================
   房貸 × ETF 現金流儀表板 — script.js  v3
   ============================================================
   資料全部存在 localStorage，key 如下：
     dashboard_mortgage  → { principal, rate, periods }
     dashboard_cash      → { reserve, available }
     dashboard_cashflow  → { income, expense }
     dashboard_etf_list  → [ { name, cost, value }, ... ]
   ============================================================ */

/* ──────────────────────────────────────
   localStorage 讀寫工具
────────────────────────────────────── */
const LS = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
};

const KEYS = {
  mortgage:  'dashboard_mortgage',
  cash:      'dashboard_cash',
  cashflow:  'dashboard_cashflow',
  etfList:   'dashboard_etf_list',
};

/* ──────────────────────────────────────
   格式化工具
────────────────────────────────────── */
function fmt(num, dec = 0) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(num);
}
function fmtPct(rate, dec = 2) {
  if (rate === null || rate === undefined || isNaN(rate)) return '--';
  const p = (rate * 100).toFixed(dec);
  return rate >= 0 ? `+${p}%` : `${p}%`;
}
function el(id) { return document.getElementById(id); }
function setText(id, text) {
  const e = el(id); if (!e) return;
  e.textContent = text;
  e.classList.remove('number-update'); void e.offsetWidth; e.classList.add('number-update');
}
function setClass(id, cls) {
  const e = el(id); if (!e) return;
  // 移除所有顏色 class，再加新的
  e.className = e.className.replace(/\b(stat--\w+|result-val--\w+|metric--\w+)\b/g, '').trim();
  if (cls) e.classList.add(cls);
}

/* ──────────────────────────────────────
   等額本息月付金
────────────────────────────────────── */
function calcMonthly(principal, annualRate, periods) {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / periods;
  const f = Math.pow(1 + r, periods);
  return (principal * r * f) / (f - 1);
}

/* ══════════════════════════════════════
   資產總覽卡片
══════════════════════════════════════ */
function renderOverview() {
  const mortgage  = LS.get(KEYS.mortgage,  {});
  const cash      = LS.get(KEYS.cash,      {});
  const etfList   = LS.get(KEYS.etfList,   []);

  const etfTotal  = etfList.reduce((s, e) => s + (parseFloat(e.value) || 0), 0);
  const cashTotal = (parseFloat(cash.reserve) || 0) + (parseFloat(cash.available) || 0);
  const totalAsset = etfTotal + cashTotal;
  const debt       = parseFloat(mortgage.principal) || 0;
  const netAsset   = totalAsset - debt;
  const netRate    = totalAsset > 0 ? netAsset / totalAsset : null;

  // 更新顯示
  const now = new Date();
  const badge = el('overviewDate');
  if (badge) badge.textContent = now.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) + ' 更新';

  setText('overviewNet',     fmt(Math.round(netAsset)));
  setClass('overviewNet',    netAsset >= 0 ? 'metric--green' : '');

  setText('overviewTotal',   fmt(Math.round(totalAsset)) + ' 元');
  setText('overviewDebt',    debt > 0 ? '-' + fmt(debt) + ' 元' : '--');
  setText('overviewNetRate', netRate !== null ? fmtPct(netRate) : '--');
  setClass('overviewNetRate', netRate !== null && netRate >= 0 ? 'stat--green' : 'stat--red');
}

/* ══════════════════════════════════════
   房貸卡片
══════════════════════════════════════ */
function renderMortgage() {
  const d = LS.get(KEYS.mortgage, {});
  const { principal, rate, periods } = d;
  if (principal && rate && periods) {
    const monthly = calcMonthly(parseFloat(principal), parseFloat(rate), parseInt(periods));
    setText('mortgageMonthly',   fmt(Math.round(monthly)));
    setText('mortgagePrincipal', fmt(principal) + ' 元');
    setText('mortgageRate',      parseFloat(rate).toFixed(2) + '%');
    setText('mortgagePeriods',   periods + ' 月');
  } else {
    ['mortgageMonthly','mortgagePrincipal','mortgageRate','mortgagePeriods']
      .forEach(id => setText(id, '--'));
  }
}

/* ══════════════════════════════════════
   ETF 多筆卡片
══════════════════════════════════════ */
function renderEtfList() {
  const list = LS.get(KEYS.etfList, []);
  const container = el('etfList');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<p class="etf-empty">尚未新增任何持股，請點下方按鈕新增</p>';
    setText('etfTotalValue',  '--');
    setText('etfTotalCost',   '--');
    setText('etfTotalProfit', '--');
    setText('etfTotalReturn', '--');
    const badge = el('etfReturnBadge');
    if (badge) { badge.textContent = '--'; badge.className = 'card-badge badge--info'; }
    return;
  }

  // 建立每筆 ETF 的 HTML
  container.innerHTML = list.map((item, i) => {
    const cost   = parseFloat(item.cost)  || 0;
    const value  = parseFloat(item.value) || 0;
    const profit = value - cost;
    const rate   = cost > 0 ? profit / cost : 0;
    const isPos  = profit >= 0;
    const valueColor  = isPos ? 'color:var(--color-green)'  : 'color:var(--color-red)';
    const returnColor = isPos ? 'color:var(--color-green)'  : 'color:var(--color-red)';
    const sign = isPos ? '+' : '';

    return `
      <div class="etf-item">
        <div class="etf-item-info">
          <div class="etf-item-name">${escapeHtml(item.name)}</div>
          <div class="etf-item-sub">成本 ${fmt(cost)} 元</div>
        </div>
        <div class="etf-item-right">
          <div class="etf-item-value" style="${valueColor}">${fmt(value)} 元</div>
          <div class="etf-item-return" style="${returnColor}">${sign}${fmt(Math.round(profit))} (${fmtPct(rate)})</div>
        </div>
        <div class="etf-item-actions">
          <button class="btn-icon-sm" onclick="editEtf(${i})" title="編輯">✎</button>
          <button class="btn-icon-sm btn-delete" onclick="deleteEtf(${i})" title="刪除">✕</button>
        </div>
      </div>`;
  }).join('');

  // 加總
  const totalValue  = list.reduce((s, e) => s + (parseFloat(e.value) || 0), 0);
  const totalCost   = list.reduce((s, e) => s + (parseFloat(e.cost)  || 0), 0);
  const totalProfit = totalValue - totalCost;
  const totalReturn = totalCost > 0 ? totalProfit / totalCost : null;

  setText('etfTotalValue',  fmt(Math.round(totalValue)));
  setText('etfTotalCost',   fmt(Math.round(totalCost)) + ' 元');
  setText('etfTotalProfit', (totalProfit >= 0 ? '+' : '') + fmt(Math.round(totalProfit)) + ' 元');
  setText('etfTotalReturn', totalReturn !== null ? fmtPct(totalReturn) : '--');

  setClass('etfTotalProfit', totalProfit >= 0 ? 'stat--green' : 'stat--red');
  setClass('etfTotalReturn', totalReturn !== null && totalReturn >= 0 ? 'stat--green' : 'stat--red');

  const badge = el('etfReturnBadge');
  if (badge) {
    badge.textContent = totalReturn !== null ? fmtPct(totalReturn) : '--';
    badge.className = 'card-badge ' + (totalProfit >= 0 ? 'badge--success' : 'badge--danger');
  }
}

// XSS 防護
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ETF 表單：開啟新增 */
function openEtfForm() {
  el('etfEditIndex').value = -1;
  el('etfFormTitle').textContent = '新增持股';
  el('etfInputName').value  = '';
  el('etfInputCost').value  = '';
  el('etfInputValue').value = '';
  clearInlineError('etfFormError');
  el('etfForm').style.display = 'flex';
  el('btnAddEtf').style.display = 'none';
  el('etfInputName').focus();
}

/* ETF 表單：開啟編輯 */
function editEtf(index) {
  const list = LS.get(KEYS.etfList, []);
  const item = list[index];
  if (!item) return;
  el('etfEditIndex').value   = index;
  el('etfFormTitle').textContent = '編輯持股';
  el('etfInputName').value   = item.name;
  el('etfInputCost').value   = item.cost;
  el('etfInputValue').value  = item.value;
  clearInlineError('etfFormError');
  el('etfForm').style.display = 'flex';
  el('btnAddEtf').style.display = 'none';
  el('etfInputName').focus();
}

/* ETF 表單：關閉 */
function closeEtfForm() {
  el('etfForm').style.display = 'none';
  el('btnAddEtf').style.display = '';
}

/* ETF 表單：儲存 */
function saveEtf() {
  const name  = el('etfInputName').value.trim();
  const cost  = parseFloat(el('etfInputCost').value);
  const value = parseFloat(el('etfInputValue').value);

  if (!name) { showInlineError('etfFormError', '請輸入名稱（例：0050）'); return; }
  if (isNaN(cost) || cost < 0)  { showInlineError('etfFormError', '請輸入有效的投入成本'); return; }
  if (isNaN(value) || value < 0){ showInlineError('etfFormError', '請輸入有效的目前市值'); return; }

  const list  = LS.get(KEYS.etfList, []);
  const index = parseInt(el('etfEditIndex').value);

  if (index >= 0) {
    list[index] = { name, cost, value };
  } else {
    list.push({ name, cost, value });
  }

  LS.set(KEYS.etfList, list);
  closeEtfForm();
  renderEtfList();
  renderOverview();
  renderResultIfExists();
}

/* ETF：刪除 */
function deleteEtf(index) {
  const list = LS.get(KEYS.etfList, []);
  list.splice(index, 1);
  LS.set(KEYS.etfList, list);
  renderEtfList();
  renderOverview();
  renderResultIfExists();
}

/* ══════════════════════════════════════
   現金卡片
══════════════════════════════════════ */
function renderCash() {
  const d  = LS.get(KEYS.cash, {});
  const cf = LS.get(KEYS.cashflow, {});
  const reserve   = parseFloat(d.reserve);
  const available = parseFloat(d.available);
  const expense   = parseFloat(cf.expense);

  if (!isNaN(reserve)) {
    setText('cashReserve',   fmt(reserve));
    setText('cashAvailable', !isNaN(available) ? fmt(available) + ' 元' : '--');
    setText('cashCoverage',  (!isNaN(expense) && expense > 0)
      ? (reserve / expense).toFixed(1) + ' 個月' : '--');
  } else {
    ['cashReserve','cashAvailable','cashCoverage'].forEach(id => setText(id, '--'));
  }
}

/* ══════════════════════════════════════
   現金流卡片
══════════════════════════════════════ */
function renderCashflow() {
  const d = LS.get(KEYS.cashflow, {});
  const income  = parseFloat(d.income);
  const expense = parseFloat(d.expense);

  if (!isNaN(income) && !isNaN(expense)) {
    const balance = income - expense;
    setText('cfIncome',  '+' + fmt(income) + ' 元');
    setText('cfExpense', '-' + fmt(expense) + ' 元');
    setText('cfBalance', (balance >= 0 ? '+' : '') + fmt(Math.round(balance)) + ' 元');
    setClass('cfBalance', balance >= 0 ? 'stat--green' : 'stat--red');

    const badge = el('cashflowStatusBadge');
    if (badge) {
      badge.textContent = balance > 0 ? '現金正流' : balance < 0 ? '現金負流' : '收支平衡';
      badge.className = 'card-badge ' + (balance > 0 ? 'badge--success' : balance < 0 ? 'badge--danger' : 'badge--info');
    }

    // 進度條
    const fill = el('cashflowBarFill');
    if (fill && income > 0) {
      const ratio = Math.min(expense / income, 1);
      requestAnimationFrame(() => {
        fill.style.width = (ratio * 100).toFixed(1) + '%';
        fill.style.background = ratio >= .9
          ? 'var(--color-red)'
          : ratio >= .7
            ? 'linear-gradient(90deg,var(--color-orange),var(--color-red))'
            : 'linear-gradient(90deg,var(--color-green),var(--color-orange))';
      });
    }
  } else {
    ['cfIncome','cfExpense','cfBalance'].forEach(id => setText(id, '--'));
  }
}

/* ══════════════════════════════════════
   展開表單（基本資料）
══════════════════════════════════════ */
function toggleForm() {
  const panel = el('formPanel');
  const isOpen = panel.classList.contains('form-panel--open');

  if (!isOpen) {
    // 展開時把已存的資料填回表單
    const m  = LS.get(KEYS.mortgage, {});
    const ca = LS.get(KEYS.cash, {});
    const cf = LS.get(KEYS.cashflow, {});
    if (m.principal) el('inputPrincipal').value = m.principal;
    if (m.rate)      el('inputRate').value      = m.rate;
    if (m.periods)   el('inputPeriods').value   = m.periods;
    if (ca.reserve)  el('inputReserve').value   = ca.reserve;
    if (ca.available)el('inputAvailable').value = ca.available;
    if (cf.income)   el('inputIncome').value    = cf.income;
    if (cf.expense)  el('inputExpense').value   = cf.expense;

    panel.classList.add('form-panel--open');
    panel.setAttribute('aria-hidden','false');
    el('btnStart').classList.add('btn-cta--active');
    el('btnIcon').textContent  = '✕';
    el('btnLabel').textContent = '收合表單';
    setTimeout(() => panel.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
  } else {
    panel.classList.remove('form-panel--open');
    panel.setAttribute('aria-hidden','true');
    el('btnStart').classList.remove('btn-cta--active');
    el('btnIcon').textContent  = '⚡';
    el('btnLabel').textContent = '編輯基本資料';
  }
}

/* ══════════════════════════════════════
   儲存基本資料
══════════════════════════════════════ */
function saveBasicData() {
  clearFormError();

  const principal = parseFloat(el('inputPrincipal').value);
  const rate      = parseFloat(el('inputRate').value);
  const periods   = parseInt(el('inputPeriods').value);
  const reserve   = parseFloat(el('inputReserve').value);
  const available = parseFloat(el('inputAvailable').value);
  const income    = parseFloat(el('inputIncome').value);
  const expense   = parseFloat(el('inputExpense').value);

  // 驗證：房貸三欄要嘛全填要嘛全空
  const mFilled = [principal, rate, periods].filter(v => !isNaN(v)).length;
  if (mFilled > 0 && mFilled < 3) {
    showFormError('房貸資料請同時填寫「本金、利率、期數」三個欄位');
    return;
  }
  if (!isNaN(rate) && (rate <= 0 || rate > 20)) {
    showFormError('年利率請輸入合理範圍（0.01% ～ 20%）');
    return;
  }

  // 現金流兩欄要嘛全填要嘛全空
  const cfFilled = [income, expense].filter(v => !isNaN(v)).length;
  if (cfFilled === 1) {
    showFormError('現金流請同時填寫「月收入」和「月支出」');
    return;
  }

  // 寫入 localStorage
  if (mFilled === 3) {
    LS.set(KEYS.mortgage, { principal, rate, periods });
  } else if (mFilled === 0) {
    LS.remove(KEYS.mortgage);
  }

  LS.set(KEYS.cash, {
    reserve:   isNaN(reserve)   ? null : reserve,
    available: isNaN(available) ? null : available,
  });

  if (cfFilled === 2) {
    LS.set(KEYS.cashflow, { income, expense });
  } else if (cfFilled === 0) {
    LS.remove(KEYS.cashflow);
  }

  // 重新渲染所有區塊
  renderAll();
  renderResult();

  // 收合表單
  toggleForm();
}

/* ══════════════════════════════════════
   試算結果
══════════════════════════════════════ */
function renderResult() {
  const m  = LS.get(KEYS.mortgage,  {});
  const cf = LS.get(KEYS.cashflow,  {});
  const ca = LS.get(KEYS.cash,      {});

  const principal = parseFloat(m.principal);
  const rate      = parseFloat(m.rate);
  const periods   = parseInt(m.periods);
  const income    = parseFloat(cf.income);
  const expense   = parseFloat(cf.expense);
  const reserve   = parseFloat(ca.reserve);

  const hasMortgage = !isNaN(principal) && !isNaN(rate) && !isNaN(periods);
  const hasCf       = !isNaN(income) && !isNaN(expense);

  if (!hasMortgage && !hasCf) {
    el('resultCard').style.display = 'none';
    return;
  }

  el('resultCard').style.display = '';
  el('resultCard').classList.remove('result-animate');
  void el('resultCard').offsetWidth;
  el('resultCard').classList.add('result-animate');

  const now = new Date();
  setText('resultTimeBadge',
    `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')} 更新`);

  // 房貸
  if (hasMortgage) {
    const monthly = calcMonthly(principal, rate, periods);
    const totalPay = monthly * periods;
    const totalInterest = totalPay - principal;
    setText('r_monthly',       fmt(Math.round(monthly)) + ' 元 / 月');
    setText('r_totalInterest', fmt(Math.round(totalInterest)) + ' 元');
    setText('r_totalPay',      fmt(Math.round(totalPay)) + ' 元');
    setClass('r_monthly',       'result-val--primary');
    setClass('r_totalInterest', 'result-val--orange');

    // 現金流 + 房貸
    if (hasCf) {
      const balance = income - expense;
      const balAfter = balance - monthly;
      const savings  = income > 0 ? balance / income : null;
      const coverage = (!isNaN(reserve) && expense > 0) ? reserve / expense : null;

      setText('r_balance',  (balance >= 0 ? '+' : '') + fmt(Math.round(balance)) + ' 元');
      setClass('r_balance', balance >= 0 ? 'result-val--green' : 'result-val--red');

      setText('r_balanceAfterMortgage', (balAfter >= 0 ? '+' : '') + fmt(Math.round(balAfter)) + ' 元');
      setClass('r_balanceAfterMortgage', balAfter >= 0 ? 'result-val--green' : 'result-val--red');

      setText('r_savingsRate', savings !== null ? fmtPct(savings) : '--');
      setClass('r_savingsRate',
        savings >= .3 ? 'result-val--green' : savings >= .1 ? 'result-val--orange' : 'result-val--red');

      setText('r_coverage', coverage !== null ? coverage.toFixed(1) + ' 個月' : '--');
      setClass('r_coverage',
        coverage >= 6 ? 'result-val--green' : coverage >= 3 ? 'result-val--orange' : 'result-val--red');
    } else {
      ['r_balance','r_balanceAfterMortgage','r_savingsRate','r_coverage']
        .forEach(id => setText(id, '（未輸入現金流）'));
    }
  } else {
    ['r_monthly','r_totalInterest','r_totalPay'].forEach(id => setText(id, '（未輸入房貸）'));
    if (hasCf) {
      const balance  = income - expense;
      const savings  = income > 0 ? balance / income : null;
      const coverage = (!isNaN(reserve) && expense > 0) ? reserve / expense : null;
      setText('r_balance', (balance >= 0 ? '+' : '') + fmt(Math.round(balance)) + ' 元');
      setClass('r_balance', balance >= 0 ? 'result-val--green' : 'result-val--red');
      setText('r_balanceAfterMortgage', '（未輸入房貸）');
      setText('r_savingsRate', savings !== null ? fmtPct(savings) : '--');
      setText('r_coverage', coverage !== null ? coverage.toFixed(1) + ' 個月' : '--');
    }
  }
}

function renderResultIfExists() {
  if (el('resultCard') && el('resultCard').style.display !== 'none') {
    renderResult();
  }
}

/* ══════════════════════════════════════
   清除全部資料
══════════════════════════════════════ */
function clearAllData() {
  if (!confirm('確定要清除所有資料嗎？此操作無法復原。')) return;
  Object.values(KEYS).forEach(k => LS.remove(k));
  ['inputPrincipal','inputRate','inputPeriods',
   'inputReserve','inputAvailable','inputIncome','inputExpense']
    .forEach(id => { const e = el(id); if (e) e.value = ''; });
  renderAll();
  el('resultCard').style.display = 'none';
  toggleForm(); // 收合表單
}

/* ══════════════════════════════════════
   錯誤工具
══════════════════════════════════════ */
function showFormError(msg) {
  const e = el('formError'); if (!e) return;
  e.textContent = '⚠ ' + msg; e.classList.add('form-error--show');
}
function clearFormError() {
  const e = el('formError'); if (!e) return;
  e.textContent = ''; e.classList.remove('form-error--show');
}
function showInlineError(id, msg) {
  const e = el(id); if (!e) return;
  e.textContent = '⚠ ' + msg; e.classList.add('form-error--show');
}
function clearInlineError(id) {
  const e = el(id); if (!e) return;
  e.textContent = ''; e.classList.remove('form-error--show');
}

/* ══════════════════════════════════════
   全部重新渲染
══════════════════════════════════════ */
function renderAll() {
  renderMortgage();
  renderEtfList();
  renderCash();
  renderCashflow();
  renderOverview();   // 總覽最後算，依賴其他資料
}

/* ══════════════════════════════════════
   頁面初始化
══════════════════════════════════════ */
function renderHeaderDate() {
  const e = el('headerDate'); if (!e) return;
  const now = new Date();
  e.innerHTML = `<span>${now.toLocaleDateString('zh-TW',{year:'numeric',month:'long'})}</span><br>
    <span>更新 ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}</span>`;
}

function animateCards() {
  document.querySelectorAll('.card').forEach((c, i) => {
    setTimeout(() => c.classList.add('card--visible'), 80 * i);
  });
}

function init() {
  renderHeaderDate();
  el('footerYear').textContent = `© ${new Date().getFullYear()} 個人財務儀表板`;
  renderAll();
  renderResult();        // 若 localStorage 有資料，直接顯示結果
  requestAnimationFrame(animateCards);
}

document.addEventListener('DOMContentLoaded', init);
