# Changelog

所有版本紀錄都會寫在這份文件，新版本加在最上方。

---

## v5.5 － Refactor Edition（架構重構版）

### ♻️ Refactor
- 完成專案模組化：`app.js`（2335 行）拆分為 5 個 JS 模組（`core.js`／`mortgage.js`／`entities.js`／`finance.js`／`app.js`）；`style.css`（452 行）拆分為 4 個 CSS 模組（`base.css`／`dashboard.css`／`features.css`／`responsive.css`）。初版原規劃拆為 12+12 個更細的檔案，依 Mable 回饋（檔案數過多、日常維護與上傳不便）合併為目前的粒度，同樣保持模組化與高內聚、低耦合，僅檔案數量與分組方式調整
- 所有函式以「純搬移」方式拆分，逐一比對搬移前後每個函式的原始碼字元，確認完全一致，未修改任何邏輯／公式／計算結果
- 整理共用函式集中至 `utils.js`（格式化、DOM 存取、表單錯誤提示）與 `storage.js`（LocalStorage 存取與所有 key 定義）
- `renderAll()` 統一收斂於 `app.js`，作為唯一的渲染入口，避免跨模組互相呼叫造成依賴混亂

### 本版本不新增任何新功能、不修改 UI、不修改任何公式、不修改 localStorage 格式

### Compatibility
- Mortgage Engine、財務健康、投資中心、Goals、Demo Mode、Onboarding 邏輯完全未修改（逐字元比對）
- localStorage 完全相容 v5.0／v5.1／v5.1.1，包含 `monthlyMortgageSubsidy`／`monthlySubsidy`（相容讀取）／Auto／Manual 模式皆正常運作
- 已完成健康檢查：Node.js 語法驗證（單一模組＋合併後）、HTML div 標籤配對（352/352）、無重複函式、`renderAll()` 涵蓋完整、HTML↔JS 交叉比對皆通過
- 已用 Node.js 合併全部 12 個模組模擬執行，驗證房貸引擎、房貸補貼、投資中心、Goals 等核心計算函式皆正常運作且結果正確

詳細的資料夾架構、模組職責、拆分統計與相容性確認，請見本次交付說明。

## v5.1.1 － 修正房貸補貼輸入介面

### Fixed
- 新增／編輯房貸 Modal 補上「每月房貸補貼（元）」輸入欄位（v5.1 首頁已顯示補貼資訊，但當時欄位放置在較不易發現的位置；本版本依需求調整順序並確認全流程可用）
- 欄位放置順序調整為：貸款總期數 → 每月房貸補貼 → 起貸日期 → 還款方式
- 編輯房貸時正確帶入目前已儲存的補貼金額；重新儲存後首頁「房貸月付／房貸補貼／薪資實際負擔」三項數字立即同步更新

### Changed
- 房貸補貼資料儲存欄位由 `monthlySubsidy` 正式更名為 `monthlyMortgageSubsidy`，新增 `getMortgageSubsidyValue()` 統一讀取，優先讀取新欄位，若新欄位不存在則回退讀取 v5.1 的舊欄位名稱 `monthlySubsidy`，確保 v5.1 期間建立的資料不會遺失

### Compatibility
- Mortgage Engine、房貸試算、提前還款、財務健康分數、Goals、投資中心、Demo Mode、Onboarding 及所有 v5.1 既有功能未修改（逐一比對核心函式，與 v5.1 完全一致）
- 舊資料完全相容：三種情境皆已用 Node.js 模擬驗證 —— (1) 沒有任何補貼欄位（v5.0 以前）視為補貼 0 元；(2) 僅有 v5.1 舊欄位 `monthlySubsidy` 時正確回退讀取；(3) 兩種欄位同時存在時，以新欄位 `monthlyMortgageSubsidy` 為準
- 本版本僅調整 `getMortgageActualBurden`／`getMortgageSubsidySummary`／`editItem`／`saveItem` 四個函式，並新增 `getMortgageSubsidyValue` 輔助函式；其餘所有函式逐字元比對與 v5.1 完全一致
- 已完成健康檢查：Node.js 語法驗證、HTML div 標籤配對（352/352）、重複函式名稱掃描、`renderAll()` 涵蓋率驗證、HTML↔JS ID／onclick 雙向交叉比對，皆通過

## v5.1 － Cashflow Optimization（現金流優化：房貸補貼機制）

### Added
- 房貸資料新增「每月房貸補貼（元，選填）」欄位，預設為 0；留空時視為 0，不影響任何舊資料
- 新增 `getMortgageActualBurden()`／`getMortgageSubsidySummary()`／`getTotalLoanActualBurden()`：直接沿用既有 Mortgage Engine 計算月付金，未建立第二套公式；補貼後實際負擔＝房貸月付金－補貼，最低不小於 0
- 首頁「每月現金流」卡片新增「🏦 房貸補貼」區塊，顯示房貸月付／房貸補貼／薪資實際負擔三項數字；沒有房貸資料時自動隱藏
- 首頁「每月可存金額」公式修正為：每月收入－固定支出－生活費－所有貸款實際月負擔（目前為房貸月付金－補貼，最低 0）

### Changed
- 資產／負債新增編輯表單：房貸類型新增補貼欄位與說明文字
- 固定支出頁與新增／編輯表單：房貸類型新增提示，說明房貸月付金已由負債頁自動計算並計入首頁現金流，此處若仍記錄房貸類固定支出會被重複扣一次
- 首頁現金流卡片底部說明文字，更新為納入「貸款實際月負擔」的估算依據

### Compatibility
- Mortgage Engine、房貸試算、提前還款、財務健康分數、Goals、投資中心、Demo Mode、Onboarding 及所有 v5.0 既有功能未修改（逐一比對核心函式，與 v5.0 完全一致）
- 舊資料完全相容：房貸沒有 `monthlySubsidy` 欄位時，一律視為 0 元補貼，行為與 v5.0 完全相同，不會產生任何錯誤或異常數字（已用 Node.js 模擬驗證）
- 已完成健康檢查：Node.js 語法驗證、HTML div 標籤配對（352/352）、重複函式／常數名稱掃描、`renderAll()` 涵蓋率驗證、HTML↔JS ID／onclick 雙向交叉比對，皆通過；並對受保護的核心函式（Mortgage Engine、房貸試算、提前還款、財務健康、Goals、投資中心、Demo Mode、Onboarding）逐字元比對，確認與 v5.0 完全一致，僅 `onTypeChange`／`saveItem`／`editItem`／`clearForm`／`renderCashflow`／`renderExpensePage`／`openExpenseModal`／`editExpense` 為本版本刻意調整的表單與現金流邏輯
- 已用 Node.js 模擬驗證：補貼後實際負擔計算結果與規格範例一致（月付 15,176.5 元、補貼 10,965.5 元 → 實際負擔 4,211 元）；補貼金額超過月付金時，實際負擔正確floor 於 0；舊資料（無補貼欄位）計算結果與有欄位但值為 0 完全相同

### ⚠️ 規格判斷與已知限制（新增，請詳閱）
1. **僅房貸支援補貼欄位**：規格公式「所有貸款實際月負擔＝房貸月付金－每月房貸補貼」僅定義房貸。本版本僅在房貸資料新增補貼欄位，車貸／信貸（`SIMPLE_LOAN_TYPES`）暫不支援補貼，其既有 `monthlyPayment` 欄位也**未**被計入首頁「所有貸款實際月負擔」，避免對車貸／信貸引入與本次修正房貸相同的新重複計算風險。相關聚合函式已依可擴充架構撰寫，未來如需支援車貸／信貸補貼，可比照房貸方式加總，不需更動首頁公式的呼叫方式。
2. **與固定支出頁「房貸」類型可能重複計算（沿用既有已知問題，本版本新增提示但未強制处理）**：固定支出頁本來就有「房貸」類型可手動記錄月付金；本版本讓「負債」頁的房貸資料開始自動計入首頁現金流後，若使用者同時在固定支出頁也記錄了房貸類支出，會被重複扣兩次。已在固定支出頁與新增／編輯表單加入提示，引導使用者移除固定支出頁的房貸類記錄；但基於「保持完全向下相容、不得造成任何舊資料錯誤」的要求，本版本不會自動刪除或警告既有的固定支出資料。
3. **財務健康分析「房貸負擔率」不受影響**：依規格「不可修改」，財務健康分析仍使用房貸的**原始月付金**（未扣除補貼）計算房貸負擔率，與首頁「每月可存金額」使用補貼後的實際負擔不同，屬本版本已知的設計取捨，與 v5.0 對投資市值的處理方式一致。

## v5.0 － Investment Center（投資中心）

> 📌 版本順序備註：v5.0 原規格書以 v4.1 為基礎，後續依需求調整為以 v4.2（房貸體驗優化）為基礎重新建置，因此本版本同時包含 v4.2 與 v5.0 的所有變更。

### Added
- 📈 投資中心：新增獨立頁面（`page-investment`）與底部導覽項目，風格沿用既有設計系統
- 完整 CRUD：投資類型（ETF／股票／基金／REITs／債券／其他）、名稱、持有數量（支援小數）、平均成本、最新價格（手動輸入，不串接任何 API）
- 自動即時計算（不可手動輸入）：投資成本＝平均成本×持有數量；目前市值＝最新價格×持有數量；未實現損益＝市值－成本；報酬率＝損益÷成本×100%
- 投資頁橫幅：加總投資成本／目前市值／未實現損益／報酬率
- 首頁新增「📈 投資總覽」卡片，加總所有投資資料，無資料時顯示提示文字並提供快速新增連結
- 投資清單依類型分組，每筆卡片顯示名稱、類型、持有數量、平均成本、最新價格、投資成本、目前市值、未實現損益、報酬率，提供編輯／刪除
- Empty State：沿用 v4.0 建立的一致風格空資料提示卡
- 新增獨立 localStorage key：`investments`

### Changed
- 首頁「總資產」／「淨資產」納入投資市值：`總資產 = 既有資產總和（現金＋股票/ETF＋不動產＋定存＋其他，不變）＋ 投資市值（新增）`
- 資產頁「股票／ETF」類型的新增／編輯表單，以及資產頁該類型的列表區塊，新增提示訊息引導使用者改用投資中心管理，避免與投資中心重複計算總資產（純提示文字，不影響任何既有資料與計算）
- 設定頁「清除所有資料」與開發工具「清除所有資料」，新增清除 `investments` key，確保「清除所有資料」名副其實涵蓋投資資料
- 版本號更新為 5.0，所有頁面 Footer 同步更新
- README 更新：新增投資中心說明、`investments` key 說明、已知限制與規格判斷段落

### Compatibility
- Mortgage Engine 未修改（逐一比對 `buildAmortizationSchedule`／`mortgageEngine`／`mortgagePrepaymentSimulation`／`isMortgageReady` 等核心函式，與 v4.1／v4.2 完全一致）
- v4.2 新增的房貸剩餘本金 Auto／Manual 機制未修改（逐一比對 `getRemainingPrincipalMode`／`mortgageEngineAutoRemaining`／`syncAutoMortgagePrincipals`，與 v4.2 完全一致）；`onTypeChange()` 僅在 v4.2 版本尾端追加 3 行 ETF 提示切換邏輯，其餘房貸相關邏輯逐行比對未變動
- 財務健康計算未修改（逐一比對 `scoreIndicator`／`renderHealthCard`／`renderHealthOverview` 等核心函式，與 v4.1 完全一致；注意：其內部計算仍只讀 `nw_assets`／`nw_debts`，不納入投資市值，故負債比等指標不受本版影響，也不會反映投資市值）
- Goals 計算未修改（逐一比對 `getCurrentByType`／`getGoalCurrent`／`goalBarColor` 等核心函式，與 v4.1 完全一致；注意：「淨資產」目標進度同樣不納入投資市值）
- Demo Mode、Onboarding 相關函式（`loadDemoData`／`getDemoDataset`／`isDemoMode`／`buildOwnData`／`startOnboarding`／`renderOnboarding`／`hasAnyData`）逐一比對，與 v4.1 完全一致，未修改
- 既有 localStorage 結構（`nw_assets`／`nw_debts`／`nw_income`／`nw_expenses`／`nw_living_expense`／`nw_goals`／`nw_onboarding_completed`／`nw_demo_mode`）未修改，僅新增獨立的 `investments` key
- 所有 v4.1／v4.2 既有功能（Hero Banner、Demo 模式、系統資訊、清除資料、Footer、房貸剩餘本金選填與每日自動更新、手機版錯誤訊息定位）未修改
- 已完成健康檢查：Node.js 語法驗證、HTML div 標籤配對（334/334）、重複函式／常數名稱掃描、`renderAll()` 涵蓋率驗證、HTML↔JS ID／onclick 雙向交叉比對，皆通過；並對受保護的核心函式進行 v4.1／v4.2／v5.0 三版逐字元比對，確認完全一致
- 已用 Node.js 模擬驗證：房貸 auto 模式剩餘本金與投資中心市值可同時正確計入首頁總資產（現金 100,000 元＋投資市值 92,300 元＝合計 192,300 元，驗證通過）

### ⚠️ 規格判斷與已知限制（已與 Mable 確認）
1. **總資產公式**：v5.0 規格書提供的公式（現金＋投資＋其他資產＋房屋）省略了「定存」。為避免影響既有資產功能，實作採「既有資產總和不變＋投資市值疊加」的方式，定存仍計入總資產。
2. **與資產頁「股票／ETF」類型並存但不同步**：兩者是獨立機制，若同一筆持股在兩邊都輸入會被重複計算。本版本維持相容性、不強制遷移或刪除既有資料，僅新增提示引導改用投資中心；後續版本再評估是否整合或淘汰舊有 ETF 輸入方式。
3. **與淨資產相關計算不同步**：財務健康分析、資產配置分析、Goals 淨資產目標，依規格「不可修改」維持不納入投資市值，可能與首頁頂部總資產／淨資產數字不一致。

## v4.2 － Mortgage UX Improvement（房貸體驗優化）

### Added
- 房貸「剩餘本金」改為選填：新增／編輯房貸時可以留空，placeholder 顯示「留空將自動計算目前剩餘本金」，並在欄位下方新增提示說明
- 自動計算剩餘本金：留空時，直接呼叫既有 Mortgage Engine（`mortgageEngine`／`buildAmortizationSchedule`），依原始貸款金額、年利率、貸款總期數、起貸日期、還款方式推算目前剩餘本金，未另外建立第二套公式、未使用簡化估算
- 新增 `remainingPrincipalMode`（`auto`／`manual`）欄位：留空時記錄為 `auto`，手動輸入時記錄為 `manual`；舊資料（v4.1 以前建立、無此欄位）一律視為 `manual`，維持原本行為
- 每日自動更新：每次載入儀表板時（`renderAll()` 開頭），自動重新計算所有 `auto` 模式房貸的剩餘本金並寫回，讓房貸餘額隨時間自然遞減；`manual` 模式完全不受影響，永遠使用者輸入值優先

### Fixed（手機版）
- 驗證失敗時，自動捲動到第一個錯誤欄位並 focus，套用於資產／負債新增編輯表單，以及 Goals／收入／固定支出／生活費表單
- 錯誤訊息與輸入欄位新增 `scroll-margin`，避免被下方固定的儲存／取消按鈕遮住
- Modal 底部安全間距（`padding-bottom`）由 16px 提高到 24px，加大安全區

### Compatibility
- Mortgage Engine 核心公式未修改（`buildAmortizationSchedule`／`mortgageEngine`／`simulatePayoff`／`mortgagePrepaymentSimulation`／`isMortgageReady` 逐字元比對，與 v4.1 完全一致）
- 財務健康分數未修改（`scoreIndicator`／`renderHealthCard`／`renderHealthOverview` 等逐字元比對，與 v4.1 完全一致）
- 房貸試算器、提前還款功能未修改（`itemHTML`／`simulatePrepay`／`renderMortgageSummary` 逐字元比對，與 v4.1 完全一致）
- 資產負債計算未修改（`renderSummary`／`renderAssetPage`／`renderDebtPage`／`payLoanMonth` 逐字元比對，與 v4.1 完全一致）—— 新增的每日同步（`syncAutoMortgagePrincipals`）在這些函式讀取資料「之前」先把 auto 模式房貸的 `amount` 更新好，讓既有計算不必修改就能自動反映最新剩餘本金
- Demo Mode、Onboarding、資料完整度等 v4.1 功能未修改（逐字元比對一致）
- 舊資料完全相容：既有房貸（無 `remainingPrincipalMode` 欄位）預設視為 `manual`，行為與 v4.1 完全相同，不會被自動改寫
- 已完成健康檢查：Node.js 語法驗證、HTML div 標籤配對、重複函式／常數名稱掃描、`renderAll()` 涵蓋率驗證、HTML↔JS ID／onclick 雙向交叉比對，皆通過；並針對受保護的核心函式進行 v4.1／v4.2 逐字元比對，確認完全一致
- 已用 Node.js 模擬驗證：auto 模式在剩餘本金被竄改為異常值後，下次 `syncAutoMortgagePrincipals()` 會自動修正回引擎試算值；manual 模式完全不受同步影響

## v4.1 － Product Polish（產品化）

### Added
- Hero Banner：首頁最上方新增產品簡介橫幅（🏠 Personal Finance Dashboard），含「立即開始」按鈕，點擊後平滑捲動至 Dashboard 主要區塊
- Demo Mode：首頁新增「👀 體驗 Demo」區塊，提供「載入示範資料」與「建立自己的資料」兩個按鈕
  - 示範資料涵蓋現金、ETF、房貸、收入、固定支出、Goals，讓所有 Dashboard 卡片都有資料可展示
  - 若偵測到使用者已有資料，載入示範資料前會先跳出確認視窗，不會無預警覆蓋
  - 示範資料實際寫入既有 `nw_assets`／`nw_debts`／... 等 key（新增 `nw_demo_mode` 布林旗標僅供 UI 判斷，不算獨立資料結構），可透過「建立自己的資料」一鍵清除示範資料
- System Information：工具頁新增「⚙️ 設定」卡片，內含「ℹ 系統資訊」— 顯示 Version、更新日期，並提供 GitHub Repository、README、CHANGELOG 三個可點擊開啟的連結
- Clear All Data：設定卡片新增「🗑 清除所有資料」，按下後跳出「確定要清除所有資料嗎？此動作無法復原。」確認視窗，確認後清除所有 localStorage 並重新整理頁面，回到首次使用狀態
- Footer Redesign：所有頁面底部統一改為新版 Footer（Personal Finance Dashboard／Version 4.1／MIT License／GitHub 連結），取代原本的版本徽章

### Changed
- README 更新：新增產品特色、功能介紹、畫面截圖（待補）、快速開始、v4.1 更新內容，並補上 `nw_demo_mode` 的 localStorage 說明
- Footer 更新：`asset`／`debt`／`goals`／`tools`／`home` 五個頁面底部的版本徽章統一改為新版 Footer 元件

### Compatibility
- 完全相容 Version 4.0，未新增任何財務功能
- Mortgage Engine 未修改（`buildAmortizationSchedule`／`mortgageEngine`／`mortgagePrepaymentSimulation` 等核心函式逐一比對，維持原樣）
- 財務健康計算未修改（`scoreIndicator`／`renderHealthCard`／`renderHealthOverview` 等核心函式逐一比對，維持原樣）
- Goals 計算未修改（`getCurrentByType`／`getGoalCurrent`／`goalBarColor` 等核心函式逐一比對，維持原樣）
- 所有既有 CRUD 流程未修改
- localStorage 結構未修改，僅新增 `nw_demo_mode` 這一個純 UI 用途的旗標
- `renderAll()` 已納入本版新增的 `renderDemoSection()`／`renderSystemInfo()`，確保頁面切換與資料異動時同步更新
- 已完成健康檢查：Node.js 語法驗證、HTML div 標籤配對、重複函式／常數名稱掃描、`renderAll()` 涵蓋率驗證、HTML↔JS ID／onclick 雙向交叉比對，皆通過

> 📌 開發備註：本次盤點發現專案知識庫中儲存的 `app.js` 為 v2.3 舊版（缺少 Mortgage Engine／Onboarding 等 v4.0 功能），與 `index.html`／`style.css`／README／CHANGELOG 所描述的 v4.0 內容不一致，判斷應為誤存的舊檔。本版已改以與 v4.0 文件相符的完整版 `app.js` 為基礎進行開發，並在此記錄供之後比對；建議之後重新上傳 v4.1 三個檔案以更新知識庫版本。

## v4.0 － Onboarding（新手引導）
- 首頁新增「👋 新手引導」歡迎卡片：僅在完全沒有任何資料時顯示，列出四個起步步驟，按下「開始建立」後自動切換到資產頁，並永久標記已完成（新增 `nw_onboarding_completed` 旗標，不影響既有資料結構）
- 首頁新增「📋 資料完整度」卡片：Progress Bar＋百分比，列出資產／負債／收入／固定支出／Goals／Mortgage 六項完成狀態；Mortgage 僅在使用者已建立房貸時才納入百分比計算
- 首頁新增「⚡ 快速新增」：四個按鈕直接切換至對應頁面（資產／負債／收入／Goals），不新增 CRUD 邏輯
- 資產、負債、收入、固定支出、Goals 五個頁面的空資料狀態，統一改為一致風格的提示卡：說明用途＋建立按鈕，取代原本單純的空白文字
- 本版僅涉及 UI／導覽邏輯，未修改 Mortgage Engine、財務健康計算、Goals 計算、任何 CRUD 或既有 localStorage 結構；已針對所有計算函式逐一比對驗證，確認與 v3.1.1 完全一致，無回歸問題
- 所有頁面底部版本號同步更新為 v4.0

## v3.1.1 － 首頁體驗優化
- 整合首頁兩張財務健康卡片為一張：頂部保留財務健康分數／等級（沿用原計算公式，等級由三級改為四級 🟢優良／🟡尚可／🟠待改善／🔴高風險），下方改為五項指標：負債比、每月儲蓄率、緊急預備金月數、房貸負擔率、財務目標完成率
- 移除「資產負債比」指標（與負債比重複，保留較容易理解的負債比）
- 新增「財務目標完成率」指標，取所有 Goals 完成率的平均值
- AI 建議依風險程度排序（🔴 高風險 → 🟡 注意 → 🟢 良好），最多顯示 5 則
- 首頁移除資產配置圓餅圖與負債配置圓餅圖，保留原本的占比列表分析
- 移除 Chart.js CDN 與所有相關的圓餅圖 JavaScript／HTML／CSS，減少頁面載入資源
- 未新增任何 localStorage、未影響既有新增／編輯／刪除流程、未修改 Mortgage Engine
- 所有頁面底部版本號同步更新為 v3.1.1

## v3.1 － Financial Health（財務健康分析）
- 首頁新增「📊 財務健康」卡片：資產負債比、負債比、每月儲蓄率、緊急預備金月數、房貸負擔率，完全利用現有資料計算，未新增任何輸入欄位
- 每項指標依合理區間分級（🟢 良好／🟡 注意／🔴 偏高），並在卡片底部產生 2～5 條規則式建議（依可用資料自動增減，非串接外部 AI）
- 首頁新增「資產配置圓餅圖」與「負債配置圓餅圖」，使用 Chart.js 繪製，深色主題、支援手機，沒有資料時自動隱藏整個區塊
- 房貸負擔率沿用 Mortgage Engine 的月付金計算結果，緊急預備金月數沿用（現金＋定存）與（固定支出＋生活費）既有資料
- 原有「財務健康分析」評分卡（負債比／固定支出率／儲蓄率＋總分等級）維持不變，兩張卡片並存
- 未新增任何 localStorage、未影響既有新增／編輯／刪除流程、未修改 Mortgage Engine 核心計算邏輯
- 所有頁面底部版本號同步更新為 v3.1

## v3.0 － Mortgage Engine（房貸試算引擎）
- 房貸資料結構調整：新增「原始貸款金額」「貸款總期數」「起貸日期」「還款方式（本息平均攤還／本金平均攤還）」；「每月應繳」「剩餺期數」改由系統自動計算，不再手動輸入。「剩餺本金」「年利率」維持可手動修正
- 新增獨立封裝的 Mortgage Engine（`mortgageEngine()`），採標準銀行公式計算等額本息／等額本金攤還排程，月利率＝年利率÷12，計算過程不中途四捨五入，只在畫面顯示時四捨五入至整數元
- 房貸資訊卡新增：原始貸款金額、剩餘本金、已還本金、已付利息、每月應繳金額、已還期數／總期數、年利率、還款進度 Progress Bar
- 房貸資訊卡新增「提前還款試算」：輸入提前還款金額，立即試算預估可節省利息與縮短期數，僅供試算不修改任何原始資料
- 首頁新增「🏦 房貸概況」，彙總所有房貸的剩餘本金／每月應繳／已還本金／已付利息／還款進度；沒有房貸資料時自動隱藏
- 車貸、信貸、信用卡與其他負債維持 v2.4 原有模式，不受影響
- 資料不完整的房貸（尚未填妥原始貸款金額／總期數／起貸日期）會顯示提示訊息，不會顯示錯誤或空白數字
- 首頁／資產管理／收入／固定支出／每月生活費／Goals／Developer Tools 皆未受影響
- 所有頁面底部版本號同步更新為 v3.0

## v2.4 － Loan Center（貸款中心）
- 房貸／車貸／信貸新增欄位：每月應繳金額、剩餘期數（信用卡與其他負債維持原模式）
- 負債頁每筆貸款新增「貸款資訊卡」：剩餘本金／年利率／每月應繳／剩餘期數
- 負債頁頂部新增「🏦 每月貸款支出」，自動加總房貸＋車貸＋信貸（不含信用卡與其他負債）
- 每筆貸款新增「本月已還款」按鈕，僅將剩餘期數 -1，暫不涉及本金攤還計算
- 程式架構保留擴充空間，供 v2.5 加入本息／本金平均攤還、提前還款、利息分析
- 首頁／資產頁／工具頁／Goals 頁未變動，僅修改負債頁與共用的新增／編輯表單
- 首頁底部版本號同步更新為 v2.4

## v2.3 － Developer Test Mode（開發測試模式）
- 工具頁新增可折疊的「🧪 開發工具」區塊，預設收合
- 新增「載入測試資料」：一鍵建立資產（約 12 筆，涵蓋現金／ETF／定存／不動產／其他）、負債（5 筆）、收入、固定支出、生活費、Goals（淨資產／ETF／緊急預備金／自訂旅遊基金）
- 新增「清除所有資料」：清空本專案使用的所有 localStorage，附二次確認提示
- 操作後不需重新整理頁面，所有畫面即時更新
- 新增 README.md、CHANGELOG.md
- 修正版本標記顯示：首頁底部改為顯示當前版本號，資產／負債／工具／Goals 頁移除各自過時的版號殘留文字

## v2.2 － Goal Engine（Goals 邏輯重構）
- 重構 Goals 目前金額的計算邏輯：依目標類型分流，不再共用同一套公式
- 自動類型（淨資產／現金活存／ETF／定存／緊急預備金）維持自動計算
- 自訂目標改為使用者自行輸入「目前金額」，不再誤用淨資產等自動計算值
- 修正緊急預備金公式：現金／活存＋定存（原本只算現金）
- 修正完成率公式，統一夾在 0%～100% 之間，不再出現負百分比
- Goal 卡片新增「目前 / 目標」金額顯示與「還差 XX 元／🎉 已達成目標」

## v2.1 － Cash Flow Optimization（現金流最佳化）
- 工具頁新增「每月生活費」單一數字欄位（`nw_living_expense`）
- 首頁現金流卡片重新計算：預估每月可存金額 ＝ 收入－固定支出－生活費
- 現金流卡片新增每月收入／固定支出／生活費／預估可存金額四項資訊，並附估算說明文字
- 首頁移除版本號與 Changelog 卡片
- Goals 完成率加上防負數保護

## v2.0 － Asset Allocation Center（資產配置中心）
- 首頁新增「資產配置分析」卡片，依現金／股票ETF／不動產／定存／其他自動統計占比
- 依占比由高到低排序，並顯示 Progress Bar
- 新增配置摘要（目前最大資產）與集中度提醒（單一資產占比 > 70% 顯示警示）

---

*v1.9 以前為專案初始版本，涵蓋資產、負債、收入、固定支出、財務健康分析與 Goals 的基礎功能，未留有正式 Changelog 紀錄。*
