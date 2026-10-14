"""Finish the evaluated-model comparison and report from train.py outputs."""
from pathlib import Path
import hashlib
import json
import pickle
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.linear_model import LassoCV, LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
DATA, OUT = ROOT / "data" / "BostonHousing.csv", ROOT / "results"
FIG = OUT / "figures"
FEATURES = ["CRIM","ZN","INDUS","CHAS","NOX","RM","AGE","DIS","RAD","TAX","PTRATIO","B","LSTAT"]

def save(path):
    plt.tight_layout(); plt.savefig(path, dpi=180, bbox_inches="tight"); plt.close()

def score(y, pred):
    mse = mean_squared_error(y, pred)
    return {"MAE": mean_absolute_error(y, pred), "MSE": mse, "RMSE": np.sqrt(mse), "R-squared": r2_score(y, pred)}

df = pd.read_csv(DATA)
X, y = df[FEATURES], df["MEDV"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=.2, random_state=0)
selection = pd.read_csv(OUT / "feature_selection_results.csv")
best = selection.loc[selection.groupby("Method")["CV RMSE"].idxmin()].copy()
rows, fitted = [], {}
for _, row in best.iterrows():
    method = row["Method"]
    features = row["Selected Features"].split(", ") if isinstance(row["Selected Features"], str) else []
    if method == "Lasso":
        model = Pipeline([("scaler", StandardScaler()), ("regressor", LassoCV(cv=5, random_state=0, max_iter=50000))]).fit(X_train, y_train)
        coef = model.named_steps["regressor"].coef_
        features = list(np.array(FEATURES)[np.abs(coef) > 1e-8])
    else:
        model = LinearRegression().fit(X_train[features], y_train)
    pred = model.predict(X_test if method == "Lasso" else X_test[features])
    rows.append({"Method": method, "Number of Features": len(features), "Selected Features": ", ".join(features), "CV RMSE": row["CV RMSE"], "CV R-squared": row["CV R-squared"], **score(y_test, pred)})
    fitted[method] = (model, features, pred)
comparison = pd.DataFrame(rows).sort_values("CV RMSE").reset_index(drop=True)
comparison.to_csv(OUT / "final_model_comparison.csv", index=False)

sns.set_theme(style="whitegrid")
plt.figure(figsize=(9, 5))
sns.barplot(data=comparison, x="RMSE", y="Method", hue="Method", palette="Blues_d", legend=False)
plt.xlabel("Test RMSE ($1000s); lower is better"); plt.title("Held-out test performance of CV-selected models")
save(FIG / "04_final_model_comparison.png")

final_method = comparison.iloc[0]["Method"]
model, selected, pred = fitted[final_method]
low, high = min(y_test.min(), pred.min()), max(y_test.max(), pred.max())
plt.figure(figsize=(6.8,5.5)); plt.scatter(y_test,pred,alpha=.75,color="#1f77b4")
plt.plot([low,high],[low,high],"--",color="#d62728",label="Perfect prediction")
plt.xlabel("Actual MEDV ($1000s)"); plt.ylabel("Predicted MEDV ($1000s)"); plt.title(f"Actual vs predicted — {final_method}"); plt.legend()
save(FIG / "05_actual_vs_predicted.png")

# Refitting ordinary least squares on the chosen feature subset gives coefficients in original units.
if final_method == "Lasso":
    raw = LinearRegression().fit(X_train[selected], y_train)
else:
    raw = model
coef = pd.DataFrame({"Feature": selected, "Coefficient": raw.coef_})
coef.loc[len(coef)] = ["Intercept", raw.intercept_]
coef.to_csv(OUT / "final_model_coefficients.csv", index=False)
plot = coef[coef.Feature != "Intercept"].sort_values("Coefficient")
plt.figure(figsize=(8,max(4,.45*len(plot)))); plt.barh(plot.Feature,plot.Coefficient,color=["#d62728" if x<0 else "#1f77b4" for x in plot.Coefficient])
plt.xlabel("Coefficient (original feature units)"); plt.title(f"{final_method} selected-model coefficients")
save(FIG / "06_coefficients.png")

pd.DataFrame({"Actual MEDV": y_test, "Predicted MEDV": pred, "Residual": y_test-pred}).to_csv(OUT / "test_predictions.csv",index=False)
with open(OUT / "boston_best_model.pkl","wb") as f: pickle.dump((final_method, model, selected),f)
report = {"dataset_shape":list(df.shape),"train_shape":list(X_train.shape),"test_shape":list(X_test.shape),"missing_values":df.isna().sum().to_dict(),"dataset_sha256":hashlib.sha256(DATA.read_bytes()).hexdigest(),"best_method_by_cv_rmse":final_method,"selected_features":selected,"final_test_metrics":score(y_test,pred),"kaggle_source":"https://www.kaggle.com/datasets/abhijithudayakumar/the-boston-housing-dataset","random_state":0}
(OUT / "report_data.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(comparison.to_string(index=False)); print(json.dumps(report,indent=2))
