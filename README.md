# Mortgage ETF Dashboard

## 專案介紹
一個純前端、手機優先的個人資產負債儀表板，幫助你在同一個畫面掌握資產配置、負債狀況、現金流與財務目標的達成進度。

## 功能
- Dashboard（首頁總覽：淨資產、資產／負債概況、房貸概況）
- 資產管理
- 負債管理（含房貸試算引擎 Mortgage Engine：等額本息／等額本金、提前還款試算；車貸／信貸簡易貸款追蹤）
- 收入管理
- 固定支出
- 每月生活費
- 財務目標（Goals）
- 財務健康分析
- 資產配置分析
- 開發測試模式（Developer Tools，僅供開發／驗收使用）

## localStorage Key

| Key | 用途 | 資料型態 |
|---|---|---|
| `nw_assets` | 資產清單（現金、股票／ETF、不動產、定存、其他） | Array |
| `nw_debts` | 負債清單（房貸、車貸、信貸、信用卡、其他）。房貸含 `originalAmount`（原始貸款金額）、`totalMonths`（貸款總期數）、`startDate`（起貸日期）、`repaymentMethod`（還款方式：equalPayment 本息平均攤還／equalPrincipal 本金平均攤還），每月應繳與已還期數改由 Mortgage Engine 自動計算，不再存於資料中。車貸／信貸維持 `monthlyPayment`（每月應繳）與 `remainingMonths`（剩餺期數）手動維護 | Array |
| `nw_income` | 每月收入清單 | Array |
| `nw_expenses` | 每月固定支出清單 | Array |
| `nw_living_expense` | 每月生活費（單一數字，不分類） | Number |
| `nw_goals` | 財務目標清單（含自訂目標的「目前金額」） | Array |

## 專案結構
```
index.html
style.css
app.js
```

單一頁面應用（SPA），純前端運作，無後端、無 API，所有資料僅儲存在使用者瀏覽器的 localStorage。

## 未來規劃（Roadmap）
- [ ] 車貸／信貸比照房貸沿用 Mortgage Engine，補上完整攤還與提前還款試算
- [ ] 資產／負債歷史趨勢（需評估是否新增歷史記錄型資料結構）
- [ ] 資料匯出／匯入（JSON 備份與還原）
- [ ] 多幣別支援
- [ ] 更細緻的財務健康分析權重自訂

