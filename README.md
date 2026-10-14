# Startup Lab — 50 Startups & Boston Housing 回歸研究

## Dataset Workbench

`dist/index.html` 提供資料集下拉選單，可載入內建的 **50 Startups** 或 **Boston Housing**，也能選取本機 CSV/TSV，或貼上可直接讀取的 CSV 網址。所有資料集共用 CRISP-DM 六階段、資料摘要、目標欄位選擇、五種特徵選擇方法切換與比較、80/20 測試集、5 折交叉驗證、RMSE/R²、實際與預測圖、殘差分布及數值相關性圖。來源下拉選單可切換內建資料，或展開本機 CSV 選擇與 CSV 網址輸入；載入後選單顯示目前資料集名稱。類別欄位轉為指示變數，數值缺失以訓練資料中位數補值。本機檔案和網址資料只在目前瀏覽器處理，不會上傳到本專案的伺服器。網址載入需要直接 CSV 連結且來源允許跨站讀取；Kaggle 頁面連結請先下載檔案再選取。

Boston Housing 的完整 CRISP-DM 分析程式、資料、結果與圖表在 `boston-housing/`。

以使用者提供的 CRISP-DM + 五種特徵選擇程式為基礎，製作繁體中文互動報告。內建資料的 Python 分析結果保存在 `results/` 與 `boston-housing/results/`；網站上的資料切換、特徵選擇、分數與圖表則由瀏覽器依目前資料集重新計算。兩者使用不同切分與實作，數值不一定相同；詳見 [workflow.md](workflow.md)。

## 網站畫面

以下七張截圖依實際操作順序展示首頁、選資料、探索資料與模型評估。圖中的分數是截圖當時所選資料與設定的結果。

**1. 首頁與資料探索入口**

![Startup Lab 首頁與資料探索入口](docs/screenshots/01-home.png)

**2. 資料集選擇與基本摘要**

![50 Startups 資料集選擇、資料列與欄位摘要](docs/screenshots/02-dataset-selector.png)

**3. 可切換欄位的散點圖與資料預覽**

![數值欄位散點圖與 CSV 資料預覽](docs/screenshots/03-scatter-preview.png)

**4. CRISP-DM 研究流程與預測目標設定**

![CRISP-DM 六階段與目標欄位選擇](docs/screenshots/04-crisp-dm.png)

**5. 五種特徵選擇方法與評估指標**

![特徵選擇方法、特徵數與模型評估指標](docs/screenshots/05-model-selection.png)

**6. 交叉驗證、預測與殘差圖表**

![交叉驗證曲線、實際與預測值及殘差分布](docs/screenshots/06-evaluation-charts.png)

**7. 數值欄位相關性表**

![數值欄位相關性熱度表](docs/screenshots/07-correlation.png)

## 立即瀏覽

直接開啟 `dist/index.html`。不需安裝套件，也不依賴 CDN；內建分析、圖表、方法切換、試算及本機 CSV 載入可離線使用。讀取線上 CSV 網址需要網路。

也可在專案資料夾執行：

```powershell
python -m http.server 8000 --directory dist
```

然後瀏覽 http://localhost:8000 。按 Ctrl+C 停止。

## 重跑分析（建議 Python 3.12）

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe train.py
.\.venv\Scripts\python.exe predict.py --rd 120000 --admin 130000 --marketing 250000 --state California
```

macOS / Linux 使用 `.venv/bin/python` 取代 `.\.venv\Scripts\python.exe`。套件首次安裝需要網路，訓練使用已附資料，不需要網路。訓練後 `results/` 與 `dist/data.js` 會自動更新。請重新整理網站。若要更新網站可下載的專案 ZIP，再執行 `python package_project.py`。

## 內容

| 路徑 | 用途 |
|---|---|
| `train.py` | 整理原程式 Markdown 轉義後的可執行版本；保留原模型流程 |
| `original/user_code.md` | 使用者提供的原始附件，完整保存供比對 |
| `export_report.py` | 從真實 Pipeline 匯出 21 組模型及公式，核對公式與 Python 預測 |
| `predict.py` | 載入保存的 Pipeline 執行新樣本預測 |
| `data/50_Startups.csv` | 原程式指定網址下載的資料快照 |
| `results/feature_selection_results.csv` | 四方法各 k=1–5，加上 Lasso 一列，共 21 列 |
| `results/final_model_comparison.csv` | 五方法各自 CV 最佳模型的測試指標 |
| `results/test_predictions.csv` | 最佳模型的 10 筆測試預測與殘差 |
| `results/report_data.json` | 全模型數據、切分編號、相關係數、版本及 SHA-256 |
| `results/startup_best_model.pkl` | 以 40 筆訓練的最佳模型及預處理；沒有重擬合全部 50 筆 |
| `results/figure_1.png` | 各方法特徵數對 CV RMSE / R² 曲線 |
| `results/figure_2.png` | 最佳模型實際 vs 預測散點圖 |
| `dist/` | 可部署於 GitHub Pages 等静態主機的完整網站 |
| `REPORT.md` | 文字研究報告 |
| `workflow.md` | 資料、訓練、網站互動與驗證流程 |
| `docs/screenshots/` | README 使用的七張網站畫面 |

## 方法與重現邊界

- 切分：40 訓練、10 測試，`random_state=0`；外層五折 `KFold(shuffle=True, random_state=0)`。
- 三個數值欄位 + State。`OneHotEncoder(drop='first')` 以 California 為基準，產生 Florida、New York；合計五特徵。Scaler 在每個外層訓練折擬合。
- Forward Selection、Backward Elimination：`SequentialFeatureSelector`，內層三折，以負 RMSE 選擇。Backward 並非 p-value 消除。
- RFE：線性回歸係數排序遞迴移除。SelectKBest：`f_regression` 單變量 F 檢定。四種方法以外層平均 CV RMSE 選 k，k=5 直接完整 OLS。
- Lasso：保留原始 `LassoCV(cv=5, random_state=0, max_iter=50000)`；非零係數門檻 1e-8。直接以 Lasso 係數預測，不重新用 OLS 擬合。
- 保留原程式的內層預處理限制：SFS / LassoCV 的內層切分前已完成該外層訓練資料的預處理。這並非完全巢狀的 preprocessing / tuning，內層估計可能受影響。
- 同一外層 CV 用於選 k / 方法，因此最佳 CV 分數有選擇偏誤。獨立測試集僅 10 筆，不可依探索出的測試分數反覆挑模型。
- 網站所有 k 的測試分數僅供描述探索；最佳模型仍由原程式的 CV 分數選定。
- 不提供 p-value、VIF 或 F-statistic 等原程式未計算的推論量；不宣稱統計顯著性。
- Windows 使用 `n_jobs=1` 避免程序重啟問題。這只調整平行度，不改演算法設定。
- 繪圖改為存檔，資料改讀本機快照，新增結構化匯出。未更換原演算法、切分或特徵數搜尋。
- 數值結果可能因套件 / BLAS 版本產生微小差異。重現版本已固定在 requirements.txt；實際版本記錄於 JSON。
- 上述切分、方法與主要結果描述的是 `train.py` 的 Python 實驗。網站互動評估在瀏覽器內另行計算，使用固定種子 42，並以 L1 權重排序實作網站上的 Lasso 選項；其數字不可直接視為 Python `LassoCV` 的輸出。
- pickle 僅用於載入本專案自行產生的模型；請勿載入不可信來源的 pickle。

## 主要結果

RFE 與 SelectKBest 都以 2 特徵達最低 CV RMSE 9,482.34（同分），保留 R&D Spend、Marketing Spend。按原程式方法順序選 RFE 保存。

保留測試集：RMSE **8,198.80**、R² **0.947439**。預設範例（研發 120,000、行政 130,000、行銷 250,000、California）預測 **149,124.69**。

## 原創性與來源

- 互動功能參考：https://huanchen1107.github.io/AIoT-DIC2-MultipleLR/
- 新網站的版面、CSS、JavaScript、繁體中文文案均重新撰寫；未複製參考頁的 HTML、CSS、JavaScript 或模型數值。
- 模型分析以使用者附件為基礎；附件中原先要求的兩張圖與特徵選擇表均有對應輸出。
- CSV 來源（原程式使用）：https://gist.githubusercontent.com/GaneshSparkz/b5662effbdae8746f7f7d8ed70c42b2d/raw/faf8b1a0d58e251f48a647d3881e7a960c3f0925/50_Startups.csv
- 資料來源沒有在此提供已驗證的原始蒐集方法或商業授權；本專案作為教學分析，未額外授予第三方資料的權利。

## GitHub Pages

網站無需建置。將 `dist/` 的檔案上傳到自己的 GitHub Pages 發布根目錄，或複製到儲存庫 `/docs` 再選擇該資料夾發布。所有資產使用相對路徑，可部署在子路徑。
