/* ============================================================
   房貸 × ETF 現金流儀表板 — script.js
   ============================================================

   目錄
   1. 假資料設定（未來替換成真實資料來源）
   2. 工具函式（格式化金額、百分比）
   3. 渲染函式（各卡片資料填入）
   4. 現金流進度條
   5. 頁面初始化
   6. 事件處理（按鈕等互動）
   ============================================================ */


/* ──────────────────────────────────────
   1. 假資料設定
   ★ 之後這一區可以替換成：
     - 使用者手動輸入（localStorage 儲存）
     - 讀取 JSON 設定檔
     - 串接外部 API（如台灣銀行利率 API）
────────────────────────────────────── */
const MOCK_DATA = {

  // 房貸區塊
  mortgage: {
    monthlyPayment: 28500,   // 每月還款（元）
    remainingPrincipal: 6820000, // 剩餘本金（元）
    interestRate: 2.16,      // 目前利率（%）
    remainingPeriods: 252,   // 剩餘期數（月）
  },

  // ETF 投資區塊
  etf: {
    marketValue: 1248000,    // 持有市值（元）
    costBasis: 1100000,      // 投入成本（元）
    // 報酬率與未實現損益由程式自動計算
  },

  // 現金管理區塊
  cash: {
    emergencyFund: 450000,   // 緊急預備金（元）
    available: 65000,        // 可加碼資金（元）
    fixedDeposit: 380000,    // 定存（元）
    monthlyInterest: 1420,   // 本月活儲利息（元）
  },

  // 本月現金流區塊
  cashflow: {
    income: 95000,           // 本月收入（元）
    expense: 68500,          // 本月支出（元）
    // 結餘由程式自動計算
  },
};


/* ──────────────────────────────────────
   2. 工具函式
────────────────────────────────────── */

/**
 * 將數字格式化為台灣常用金額顯示
 * 例：1248000 → "1,248,000"
 * 例：1248000, true → "124.8萬"（之後可啟用簡短模式）
 *
 * @param {number} num - 要格式化的數字
 * @param {boolean} [compact=false] - 是否使用萬為單位（預留）
 * @returns {string}
 */
function formatAmount(num, compact = false) {
  if (num === null || num === undefined) return '--';

  if (compact && Math.abs(num) >= 10000) {
    return (num / 10000).toFixed(1) + '萬';
  }

  return new Intl.NumberFormat('zh-TW').format(Math.round(num));
}

/**
 * 將小數格式化為百分比
 * 例：0.1345 → "+13.45%"
 *
 * @param {number} rate - 小數形式的比率（0.1345 代表 13.45%）
 * @param {boolean} [showSign=true] - 是否顯示正負號
 * @returns {string}
 */
function formatPercent(rate, showSign = true) {
  if (rate === null || rate === undefined) return '--';
  const pct = (rate * 100).toFixed(2);
  return showSign && rate > 0 ? `+${pct}%` : `${pct}%`;
}

/**
 * 安全取得 DOM 元素，避免 null 錯誤
 *
 * @param {string} id - 元素 id
 * @returns {HTMLElement|null}
 */
function el(id) {
  return document.getElementById(id);
}

/**
 * 設定元素文字，並觸發數字更新動畫
 *
 * @param {string} id - 元素 id
 * @param {string} text - 要顯示的文字
 */
function setText(id, text) {
  const element = el(id);
  if (!element) return;

  element.textContent = text;

  // 觸發數字閃爍動畫（CSS keyframe）
  element.classList.remove('number-update');
  // 強制 reflow，讓動畫可以重新播放
  void element.offsetWidth;
  element.classList.add('number-update');
}


/* ──────────────────────────────────────
   3. 渲染函式
────────────────────────────────────── */

/**
 * 渲染「房貸資訊」卡片
 */
function renderMortgage() {
  const d = MOCK_DATA.mortgage;

  setText('mortgageMonthly',  formatAmount(d.monthlyPayment));
  setText('mortgagePrincipal', formatAmount(d.remainingPrincipal) + ' 元');
  setText('mortgageRate',      d.interestRate.toFixed(2) + '%');
  setText('mortgagePeriods',   d.remainingPeriods + ' 月');
}

/**
 * 渲染「ETF 投資」卡片
 * 自動計算未實現損益與報酬率
 */
function renderETF() {
  const d = MOCK_DATA.etf;

  const profit = d.marketValue - d.costBasis;
  const returnRate = profit / d.costBasis; // 小數形式

  setText('etfMarketValue', formatAmount(d.marketValue));
  setText('etfCost',        formatAmount(d.costBasis) + ' 元');
  setText('etfProfit',      (profit >= 0 ? '+' : '') + formatAmount(profit) + ' 元');
  setText('etfReturnRate',  formatPercent(returnRate));

  // 徽章：報酬率（帶正負號）
  const badge = el('etfReturnBadge');
  if (badge) {
    badge.textContent = formatPercent(returnRate);
    badge.className = 'card-badge ' + (profit >= 0 ? 'badge--success' : 'badge--danger');
  }

  // 未實現損益顏色
  const profitEl = el('etfProfit');
  if (profitEl) {
    profitEl.className = 'stat-value ' + (profit >= 0 ? 'stat--green' : 'stat--red');
  }
  const rateEl = el('etfReturnRate');
  if (rateEl) {
    rateEl.className = 'stat-value ' + (returnRate >= 0 ? 'stat--green' : 'stat--red');
  }
}

/**
 * 渲染「現金管理」卡片
 */
function renderCash() {
  const d = MOCK_DATA.cash;

  setText('cashReserve',   formatAmount(d.emergencyFund));
  setText('cashAvailable', formatAmount(d.available) + ' 元');
  setText('cashDeposit',   formatAmount(d.fixedDeposit) + ' 元');
  setText('cashInterest',  '+' + formatAmount(d.monthlyInterest) + ' 元');
}

/**
 * 渲染「本月現金流」卡片
 * 並更新進度條與狀態徽章
 */
function renderCashflow() {
  const d = MOCK_DATA.cashflow;

  const balance = d.income - d.expense;

  setText('cfIncome',  '+' + formatAmount(d.income) + ' 元');
  setText('cfExpense', '-' + formatAmount(d.expense) + ' 元');
  setText('cfBalance', (balance >= 0 ? '+' : '') + formatAmount(balance) + ' 元');

  // 結餘顏色
  const balanceEl = el('cfBalance');
  if (balanceEl) {
    balanceEl.className = 'stat-value ' + (balance >= 0 ? 'stat--green' : 'stat--red');
  }

  // 狀態徽章
  const badge = el('cashflowStatusBadge');
  if (badge) {
    if (balance > 0) {
      badge.textContent = '現金正流';
      badge.className = 'card-badge badge--success';
    } else if (balance < 0) {
      badge.textContent = '現金負流';
      badge.className = 'card-badge badge--danger';
    } else {
      badge.textContent = '收支平衡';
      badge.className = 'card-badge badge--info';
    }
  }

  // 進度條（支出佔收入的比例）
  renderCashflowBar(d.expense, d.income);
}


/* ──────────────────────────────────────
   4. 現金流進度條
────────────────────────────────────── */

/**
 * 更新現金流進度條寬度
 * 進度條代表「支出佔收入的比例」
 * 100% = 支出剛好等於收入；超過 100% 則顯示為滿版（警示）
 *
 * @param {number} expense - 支出金額
 * @param {number} income  - 收入金額
 */
function renderCashflowBar(expense, income) {
  const fill = el('cashflowBarFill');
  if (!fill || income <= 0) return;

  const ratio = Math.min(expense / income, 1); // 最大 100%
  const percentage = (ratio * 100).toFixed(1);

  // 延遲一幀，確保 CSS transition 正常觸發
  requestAnimationFrame(() => {
    fill.style.width = percentage + '%';

    // 進度條顏色：支出比例越高，越偏紅
    if (ratio >= 0.9) {
      fill.style.background = 'var(--color-red)';
    } else if (ratio >= 0.7) {
      fill.style.background = 'linear-gradient(90deg, var(--color-orange) 0%, var(--color-red) 100%)';
    } else {
      fill.style.background = 'linear-gradient(90deg, var(--color-green) 0%, var(--color-orange) 100%)';
    }
  });
}


/* ──────────────────────────────────────
   5. 頁面初始化
────────────────────────────────────── */

/**
 * 填入頂部日期資訊
 */
function renderHeaderDate() {
  const dateEl = el('headerDate');
  if (!dateEl) return;

  const now = new Date();
  const options = { month: 'long', year: 'numeric' };
  const monthStr = now.toLocaleDateString('zh-TW', options);

  dateEl.innerHTML = `
    <span>${monthStr}</span><br>
    <span>更新時間 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}</span>
  `;
}

/**
 * 填入底部年份
 */
function renderFooterYear() {
  const el = document.getElementById('footerYear');
  if (el) el.textContent = `© ${new Date().getFullYear()} 個人財務儀表板`;
}

/**
 * 卡片依序滑入動畫
 * 使用 IntersectionObserver 支援捲動觸發（桌機）
 * 手機初次載入直接依時間差觸發
 */
function animateCards() {
  const cards = document.querySelectorAll('.card');

  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('card--visible');
    }, 80 * index); // 每張卡片相差 80ms
  });
}

/**
 * 主要初始化函式
 * DOMContentLoaded 後執行
 */
function init() {
  // 渲染所有卡片資料
  renderMortgage();
  renderETF();
  renderCash();
  renderCashflow();

  // 渲染日期與版權
  renderHeaderDate();
  renderFooterYear();

  // 啟動進場動畫（給 CSS 一幀準備時間）
  requestAnimationFrame(animateCards);
}

// DOM 準備完成後執行初始化
document.addEventListener('DOMContentLoaded', init);


/* ──────────────────────────────────────
   6. 事件處理
────────────────────────────────────── */

/**
 * 「開始試算」按鈕點擊事件
 * ★ 第二版：替換此函式為實際的試算功能或頁面跳轉
 */
function handleStartButton() {
  // 按鈕觸覺回饋（支援 Haptics 的行動裝置）
  if (navigator.vibrate) {
    navigator.vibrate(30);
  }

  // 第二版功能開發中提示
  const message =
    '⚡ 第二版功能開發中\n\n' +
    '即將推出：\n' +
    '• 房貸試算（本息 / 本金攤還）\n' +
    '• ETF 定期定額模擬\n' +
    '• 加碼策略（跌幅觸發）\n' +
    '• 25 個月現金流規劃';

  alert(message);
}

/* ──────────────────────────────────────
   預留擴充區域
   未來功能模組可在此加入：

   // 房貸試算
   function calcMortgage(principal, rate, periods) { ... }

   // ETF 加碼觸發判斷
   function checkDipTrigger(currentPrice, ma200) { ... }

   // 讀寫 localStorage（本地儲存使用者設定）
   function saveSettings(data) { ... }
   function loadSettings() { ... }

   // 定期更新（setInterval 每小時重新整理資料）
   // setInterval(init, 60 * 60 * 1000);
────────────────────────────────────── */
