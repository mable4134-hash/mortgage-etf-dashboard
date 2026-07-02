/* ============================================================
   房貸 × ETF 現金流儀表板 — script.js  v2
   ============================================================

   目錄
   1. 記憶體資料狀態（取代假資料）
   2. 工具函式
   3. 儀表板卡片渲染
   4. 表單展開 / 收合
   5. 試算核心邏輯
   6. 試算結果渲染
   7. 頁面初始化
   ============================================================ */


/* ──────────────────────────────────────
   1. 記憶體資料狀態
   所有使用者輸入都存在這個物件裡，
   不寫入 localStorage，關閉頁面即清除。
   ★ 未來升級：可改為 localStorage.setItem / getItem
────────────────────────────────────── */
const state = {
  mortgage: {
    principal: null,   // 貸款本金（元）
    rate:      null,   // 年利率（%）
    periods:   null,   // 期數（月）
  },
  etf: {
    cost:  null,       // 投入成本（元）
    value: null,       // 目前市值（元）
  },
  cash: {
    reserve:   null,   // 緊急預備金（元）
    available: null,   // 可加碼資金（元）
  },
  cashflow: {
    income:  null,     // 月收入（元）
    expense: null,     // 月支出（元）
  },
  // 試算完成後的結果快照
  result: null,
  // 表單是否展開中
  formOpen: false,
};


/* ──────────────────────────────────────
   2. 工具函式
────────────────────────────────────── */

/** 數字千分位格式化，null / undefined 回傳 '--' */
function fmt(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/** 百分比格式化，帶正負號 */
function fmtPct(rate, decimals = 2) {
  if (rate === null || rate === undefined || isNaN(rate)) return '--';
  const pct = (rate * 100).toFixed(decimals);
  return rate >= 0 ? `+${pct}%` : `${pct}%`;
}

/** 安全取得 DOM 元素 */
function el(id) { return document.getElementById(id); }

/** 設定元素文字，並觸發閃爍動畫 */
function setText(id, text) {
  const e = el(id);
  if (!e) return;
  e.textContent = text;
  e.classList.remove('number-update');
  void e.offsetWidth;
  e.classList.add('number-update');
}

/** 設定元素的顏色 class（清除舊的再加新的） */
function setColor(id, colorClass) {
  const e = el(id);
  if (!e) return;
  e.className = e.className
    .replace(/\b(result-val--\w+|stat--\w+)\b/g, '')
    .trim();
  if (colorClass) e.classList.add(colorClass);
}

/**
 * 等額本息月付金計算
 * 公式：M = P × r(1+r)^n / ((1+r)^n - 1)
 * @param {number} principal - 本金
 * @param {number} annualRate - 年利率（%）
 * @param {number} periods - 期數（月）
 * @returns {number} 月付金額
 */
function calcMonthlyPayment(principal, annualRate, periods) {
  const r = annualRate / 100 / 12; // 月利率
  if (r === 0) return principal / periods;
  const factor = Math.pow(1 + r, periods);
  return (principal * r * factor) / (factor - 1);
}


/* ──────────────────────────────────────
   3. 儀表板卡片渲染
   依 state 裡的資料更新四張卡片，
   沒有資料就顯示 '--'
────────────────────────────────────── */
function renderDashboard() {
  const { mortgage, etf, cash, cashflow } = state;

  // ── 房貸卡 ──
  if (mortgage.principal && mortgage.rate && mortgage.periods) {
    const monthly = calcMonthlyPayment(mortgage.principal, mortgage.rate, mortgage.periods);
    setText('mortgageMonthly',  fmt(Math.round(monthly)));
    setText('mortgagePrincipal', fmt(mortgage.principal) + ' 元');
    setText('mortgageRate',      mortgage.rate.toFixed(2) + '%');
    setText('mortgagePeriods',   mortgage.periods + ' 月');
  } else {
    ['mortgageMonthly','mortgagePrincipal','mortgageRate','mortgagePeriods']
      .forEach(id => setText(id, '--'));
  }

  // ── ETF 卡 ──
  if (etf.cost && etf.value) {
    const profit = etf.value - etf.cost;
    const rate = profit / etf.cost;
    setText('etfMarketValue', fmt(etf.value));
    setText('etfCost',        fmt(etf.cost) + ' 元');
    setText('etfProfit',      (profit >= 0 ? '+' : '') + fmt(Math.round(profit)) + ' 元');
    setText('etfReturnRate',  fmtPct(rate));
    const badge = el('etfReturnBadge');
    if (badge) {
      badge.textContent = fmtPct(rate);
      badge.className = 'card-badge ' + (profit >= 0 ? 'badge--success' : 'badge--danger');
    }
    setColor('etfProfit',     profit >= 0 ? 'stat--green' : 'stat--red');
    setColor('etfReturnRate', rate   >= 0 ? 'stat--green' : 'stat--red');
  } else {
    ['etfMarketValue','etfCost','etfProfit','etfReturnRate'].forEach(id => setText(id, '--'));
    const badge = el('etfReturnBadge');
    if (badge) { badge.textContent = '--'; badge.className = 'card-badge badge--info'; }
  }

  // ── 現金卡 ──
  if (cash.reserve !== null) {
    setText('cashReserve', fmt(cash.reserve));
    setText('cashAvailable', cash.available !== null ? fmt(cash.available) + ' 元' : '--');
    // 預備金可撐幾個月支出
    if (cashflow.expense) {
      const months = cash.reserve / cashflow.expense;
      setText('cashCoverage', months.toFixed(1) + ' 個月');
    } else {
      setText('cashCoverage', '--');
    }
  } else {
    ['cashReserve','cashAvailable','cashCoverage'].forEach(id => setText(id, '--'));
  }

  // ── 現金流卡 ──
  if (cashflow.income !== null && cashflow.expense !== null) {
    const balance = cashflow.income - cashflow.expense;
    setText('cfIncome',  '+' + fmt(cashflow.income) + ' 元');
    setText('cfExpense', '-' + fmt(cashflow.expense) + ' 元');
    setText('cfBalance', (balance >= 0 ? '+' : '') + fmt(Math.round(balance)) + ' 元');
    setColor('cfBalance', balance >= 0 ? 'stat--green' : 'stat--red');
    const badge = el('cashflowStatusBadge');
    if (badge) {
      badge.textContent = balance > 0 ? '現金正流' : balance < 0 ? '現金負流' : '收支平衡';
      badge.className = 'card-badge ' + (balance > 0 ? 'badge--success' : balance < 0 ? 'badge--danger' : 'badge--info');
    }
    renderCashflowBar(cashflow.expense, cashflow.income);
  } else {
    ['cfIncome','cfExpense','cfBalance'].forEach(id => setText(id, '--'));
  }
}

/** 更新現金流進度條 */
function renderCashflowBar(expense, income) {
  const fill = el('cashflowBarFill');
  if (!fill || !income) return;
  const ratio = Math.min(expense / income, 1);
  requestAnimationFrame(() => {
    fill.style.width = (ratio * 100).toFixed(1) + '%';
    fill.style.background = ratio >= 0.9
      ? 'var(--color-red)'
      : ratio >= 0.7
        ? 'linear-gradient(90deg, var(--color-orange), var(--color-red))'
        : 'linear-gradient(90deg, var(--color-green), var(--color-orange))';
  });
}


/* ──────────────────────────────────────
   4. 表單展開 / 收合
────────────────────────────────────── */
function toggleForm() {
  state.formOpen = !state.formOpen;
  const panel  = el('formPanel');
  const btn    = el('btnStart');
  const icon   = el('btnIcon');
  const label  = el('btnLabel');

  if (state.formOpen) {
    panel.classList.add('form-panel--open');
    panel.setAttribute('aria-hidden', 'false');
    btn.classList.add('btn-cta--active');
    icon.textContent  = '✕';
    label.textContent = '收合表單';
    // 滑動到表單位置
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  } else {
    panel.classList.remove('form-panel--open');
    panel.setAttribute('aria-hidden', 'true');
    btn.classList.remove('btn-cta--active');
    icon.textContent  = '⚡';
    label.textContent = '開始試算';
  }
}


/* ──────────────────────────────────────
   5. 試算核心邏輯
   讀取表單 → 驗證 → 寫入 state → 試算 → 渲染結果
────────────────────────────────────── */
function calculate() {
  clearError();
  clearInputErrors();

  // ── 讀取輸入值 ──
  const principal = parseFloat(el('inputPrincipal').value);
  const rate      = parseFloat(el('inputRate').value);
  const periods   = parseInt(el('inputPeriods').value, 10);
  const etfCost   = parseFloat(el('inputEtfCost').value);
  const etfValue  = parseFloat(el('inputEtfValue').value);
  const reserve   = parseFloat(el('inputReserve').value);
  const available = parseFloat(el('inputAvailable').value);
  const income    = parseFloat(el('inputIncome').value);
  const expense   = parseFloat(el('inputExpense').value);

  // ── 驗證（至少要有一組完整資料才能試算） ──
  const errors = [];

  // 房貸：三個欄位要嘛全填，要嘛全空
  const mortgageFilled = [principal, rate, periods].filter(v => !isNaN(v)).length;
  if (mortgageFilled > 0 && mortgageFilled < 3) {
    errors.push('房貸資料請填寫「本金、利率、期數」三個欄位');
    if (isNaN(principal)) el('inputPrincipal').classList.add('input--error');
    if (isNaN(rate))      el('inputRate').classList.add('input--error');
    if (isNaN(periods))   el('inputPeriods').classList.add('input--error');
  }
  if (!isNaN(rate) && (rate <= 0 || rate > 20)) {
    errors.push('年利率請輸入合理範圍（0.01% ~ 20%）');
    el('inputRate').classList.add('input--error');
  }
  if (!isNaN(periods) && periods < 1) {
    errors.push('貸款期數至少 1 個月');
    el('inputPeriods').classList.add('input--error');
  }

  // ETF：兩個欄位要嘛全填，要嘛全空
  const etfFilled = [etfCost, etfValue].filter(v => !isNaN(v)).length;
  if (etfFilled === 1) {
    errors.push('ETF 請同時填寫「投入成本」和「目前市值」');
    if (isNaN(etfCost))  el('inputEtfCost').classList.add('input--error');
    if (isNaN(etfValue)) el('inputEtfValue').classList.add('input--error');
  }

  // 現金流：兩個欄位要嘛全填，要嘛全空
  const cfFilled = [income, expense].filter(v => !isNaN(v)).length;
  if (cfFilled === 1) {
    errors.push('現金流請同時填寫「月收入」和「月支出」');
    if (isNaN(income))  el('inputIncome').classList.add('input--error');
    if (isNaN(expense)) el('inputExpense').classList.add('input--error');
  }

  // 是否至少有一組資料
  const hasAny = mortgageFilled === 3 || etfFilled === 2 || !isNaN(reserve) || cfFilled === 2;
  if (!hasAny && errors.length === 0) {
    errors.push('請至少填寫一組資料（房貸 / ETF / 現金 / 現金流）');
  }

  if (errors.length > 0) {
    showError(errors.join('\n'));
    return;
  }

  // ── 寫入 state ──
  state.mortgage.principal = isNaN(principal) ? null : principal;
  state.mortgage.rate      = isNaN(rate)      ? null : rate;
  state.mortgage.periods   = isNaN(periods)   ? null : periods;
  state.etf.cost           = isNaN(etfCost)   ? null : etfCost;
  state.etf.value          = isNaN(etfValue)  ? null : etfValue;
  state.cash.reserve       = isNaN(reserve)   ? null : reserve;
  state.cash.available     = isNaN(available) ? null : available;
  state.cashflow.income    = isNaN(income)    ? null : income;
  state.cashflow.expense   = isNaN(expense)   ? null : expense;

  // ── 試算 ──
  const monthly     = (mortgageFilled === 3)
    ? calcMonthlyPayment(principal, rate, periods) : null;
  const totalPay    = monthly ? monthly * periods : null;
  const totalInterest = totalPay ? totalPay - principal : null;

  const profit      = (etfFilled === 2) ? etfValue - etfCost : null;
  const returnRate  = (profit !== null && etfCost) ? profit / etfCost : null;

  const balance     = (cfFilled === 2) ? income - expense : null;
  const balanceAfterMortgage = (balance !== null && monthly !== null)
    ? balance - monthly : null;
  const savingsRate = (balance !== null && income)
    ? balance / income : null;
  const coverage    = (reserve && expense)
    ? reserve / expense : null;
  const profitVsMortgage = (profit !== null && monthly !== null)
    ? profit / monthly : null;

  // 快照存入 state
  state.result = {
    monthly, totalPay, totalInterest,
    profit, returnRate, profitVsMortgage,
    balance, balanceAfterMortgage, savingsRate, coverage,
  };

  // ── 更新儀表板卡片 ──
  renderDashboard();

  // ── 渲染結果卡片 ──
  renderResult();

  // ── 收合表單，捲動到結果 ──
  if (state.formOpen) toggleForm();
  setTimeout(() => {
    el('resultCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 300);
}


/* ──────────────────────────────────────
   6. 試算結果渲染
────────────────────────────────────── */
function renderResult() {
  const r   = state.result;
  const card = el('resultCard');
  if (!card) return;

  // 顯示卡片（重新觸發進場動畫）
  card.style.display = '';
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';

  // 時間戳
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  setText('resultTimeBadge', `試算於 ${time}`);

  // ── 房貸 ──
  if (r.monthly !== null) {
    setText('r_monthly',       fmt(Math.round(r.monthly)) + ' 元 / 月');
    setText('r_totalInterest', fmt(Math.round(r.totalInterest)) + ' 元');
    setText('r_totalPay',      fmt(Math.round(r.totalPay)) + ' 元');
    setColor('r_monthly',       'result-val--primary');
    setColor('r_totalInterest', 'result-val--orange');
  } else {
    setText('r_monthly', '未輸入');
    setText('r_totalInterest', '--');
    setText('r_totalPay', '--');
  }

  // ── ETF ──
  if (r.profit !== null) {
    const profitSign = r.profit >= 0 ? '+' : '';
    setText('r_profit',     profitSign + fmt(Math.round(r.profit)) + ' 元');
    setText('r_returnRate', fmtPct(r.returnRate));
    setColor('r_profit',     r.profit >= 0 ? 'result-val--green' : 'result-val--red');
    setColor('r_returnRate', r.returnRate >= 0 ? 'result-val--green' : 'result-val--red');

    if (r.profitVsMortgage !== null) {
      setText('r_profitVsMortgage',
        `相當於 ${r.profitVsMortgage.toFixed(1)} 個月房貸`);
      setColor('r_profitVsMortgage', r.profit >= 0 ? 'result-val--green' : 'result-val--red');
    } else {
      setText('r_profitVsMortgage', '--（未輸入房貸）');
    }
  } else {
    ['r_profit','r_returnRate','r_profitVsMortgage'].forEach(id => setText(id, '未輸入'));
  }

  // ── 現金流 ──
  if (r.balance !== null) {
    const balSign = r.balance >= 0 ? '+' : '';
    setText('r_balance', balSign + fmt(Math.round(r.balance)) + ' 元');
    setColor('r_balance', r.balance >= 0 ? 'result-val--green' : 'result-val--red');

    if (r.balanceAfterMortgage !== null) {
      const bamSign = r.balanceAfterMortgage >= 0 ? '+' : '';
      setText('r_balanceAfterMortgage', bamSign + fmt(Math.round(r.balanceAfterMortgage)) + ' 元');
      setColor('r_balanceAfterMortgage', r.balanceAfterMortgage >= 0 ? 'result-val--green' : 'result-val--red');
    } else {
      setText('r_balanceAfterMortgage', '--（未輸入房貸）');
    }

    setText('r_savingsRate', fmtPct(r.savingsRate));
    setColor('r_savingsRate',
      r.savingsRate >= 0.3 ? 'result-val--green'
      : r.savingsRate >= 0.1 ? 'result-val--orange'
      : 'result-val--red');
  } else {
    ['r_balance','r_balanceAfterMortgage','r_savingsRate'].forEach(id => setText(id, '未輸入'));
  }

  if (r.coverage !== null) {
    setText('r_coverage', r.coverage.toFixed(1) + ' 個月');
    setColor('r_coverage',
      r.coverage >= 6 ? 'result-val--green'
      : r.coverage >= 3 ? 'result-val--orange'
      : 'result-val--red');
  } else {
    setText('r_coverage', '--（未輸入預備金或支出）');
  }
}


/* ──────────────────────────────────────
   表單錯誤顯示 / 清除
────────────────────────────────────── */
function showError(msg) {
  const e = el('formError');
  if (!e) return;
  e.textContent = '⚠ ' + msg;
  e.classList.add('form-error--show');
}

function clearError() {
  const e = el('formError');
  if (!e) return;
  e.textContent = '';
  e.classList.remove('form-error--show');
}

function clearInputErrors() {
  document.querySelectorAll('.input--error')
    .forEach(el => el.classList.remove('input--error'));
}

/** 清除所有輸入與結果 */
function resetAll() {
  // 清空表單
  ['inputPrincipal','inputRate','inputPeriods',
   'inputEtfCost','inputEtfValue',
   'inputReserve','inputAvailable',
   'inputIncome','inputExpense'].forEach(id => {
    const e = el(id);
    if (e) e.value = '';
  });

  // 重置 state
  state.mortgage  = { principal: null, rate: null, periods: null };
  state.etf       = { cost: null, value: null };
  state.cash      = { reserve: null, available: null };
  state.cashflow  = { income: null, expense: null };
  state.result    = null;

  clearError();
  clearInputErrors();

  // 隱藏結果卡片
  const card = el('resultCard');
  if (card) card.style.display = 'none';

  // 重置儀表板顯示
  ['mortgageMonthly','mortgagePrincipal','mortgageRate','mortgagePeriods',
   'etfMarketValue','etfCost','etfProfit','etfReturnRate',
   'cashReserve','cashAvailable','cashCoverage',
   'cfIncome','cfExpense','cfBalance'].forEach(id => setText(id, '--'));
}


/* ──────────────────────────────────────
   7. 頁面初始化
────────────────────────────────────── */
function renderHeaderDate() {
  const e = el('headerDate');
  if (!e) return;
  const now = new Date();
  const monthStr = now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });
  e.innerHTML = `<span>${monthStr}</span><br>
    <span>更新 ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}</span>`;
}

function renderFooterYear() {
  const e = el('footerYear');
  if (e) e.textContent = `© ${new Date().getFullYear()} 個人財務儀表板`;
}

function animateCards() {
  document.querySelectorAll('.card').forEach((card, i) => {
    setTimeout(() => card.classList.add('card--visible'), 80 * i);
  });
}

function init() {
  renderHeaderDate();
  renderFooterYear();
  requestAnimationFrame(animateCards);
}

document.addEventListener('DOMContentLoaded', init);
