# Boston Housing — Multiple Linear Regression

以 **MEDV**（自有住宅價格中位數，單位為千美元）為目標，沿用上一份作業的 CRISP-DM 流程與五種特徵選擇法：Forward Selection、Backward Elimination、RFE、SelectKBest、Lasso。

## 資料

- 資料集：506 筆、13 個輸入特徵、1 個目標欄位
- Kaggle 來源：[The Boston Housing Dataset](https://www.kaggle.com/datasets/abhijithudayakumar/the-boston-housing-dataset)
- 本專案資料檔：`data/BostonHousing.csv`
- 資料 SHA-256：`a2153ecb4790298c1259b0630c912abe8a4ed69bc45d6db76c9facf9461709b7`

Boston Housing 是歷史資料集；其中 `B` 欄位源自帶有種族意涵的舊式轉換公式。此分析僅用於機器學習與特徵選擇的課堂練習，不能用於房價、貸款或任何個人決策。

## CRISP-DM 流程

1. **商業理解**：以多元線性迴歸預測 MEDV。
2. **資料理解**：檢查 506 筆資料、缺失值、目標分布與相關性。
3. **資料準備**：所有欄位皆為數值；採 80/20 固定切分（`random_state=0`），並於 Pipeline 內標準化。
4. **模型建立**：比較四種 k=1…13 的選擇法，加上 LassoCV。
5. **模型評估**：訓練資料以 5-fold CV 選擇模型，最後只在 102 筆保留測試集評估一次。
6. **部署準備**：保存最佳模型、預測明細、比較表與圖表。

## 本次結果

以 CV RMSE 選出的最佳模型為 **RFE，保留 11 個特徵**：`CRIM, ZN, CHAS, NOX, RM, DIS, RAD, TAX, PTRATIO, B, LSTAT`。

| 指標 | 結果 |
| --- | ---: |
| 5-fold CV RMSE | 4.6060 |
| 5-fold CV R² | 0.7456 |
| Test MAE | 3.8429 |
| Test RMSE | 5.7814 |
| Test R² | 0.5895 |

CV 指標用來選模；測試集只有 102 筆，因此結果是這次固定切分下的估計，不能視為通用的房價預測能力或因果結論。

## 執行方式

```powershell
python -m pip install -r requirements.txt
python train.py
python generate_charts.py
```

`train.py` 從頭重跑選擇與交叉驗證；`generate_charts.py` 會讀取 `feature_selection_results.csv`，生成最後的比較圖、散點圖、係數圖與摘要資料。

## 產出

- `results/feature_selection_results.csv`：四種方法各 k 值與 Lasso 的驗證結果
- `results/final_model_comparison.csv`：五種方法各自最佳設定的保留測試集比較
- `results/test_predictions.csv`：最佳模型的實際值、預測值與殘差
- `results/boston_best_model.pkl`：保存的最佳模型
- `results/figures/`：六張分析圖表
