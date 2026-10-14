"""Boston Housing: CRISP-DM multiple linear regression experiment.

Uses the same five feature-selection approaches as the earlier Startups
analysis: forward selection, backward elimination, RFE, SelectKBest, and Lasso.
The included CSV is a 506-row copy of the Boston Housing data cited on Kaggle.
"""
from __future__ import annotations

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
from sklearn.feature_selection import RFE, SelectKBest, SequentialFeatureSelector, f_regression
from sklearn.linear_model import LassoCV, LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "BostonHousing.csv"
OUT = ROOT / "results"
FIG = OUT / "figures"
OUT.mkdir(exist_ok=True)
FIG.mkdir(exist_ok=True)

FEATURES = [
    "CRIM", "ZN", "INDUS", "CHAS", "NOX", "RM", "AGE", "DIS", "RAD",
    "TAX", "PTRATIO", "B", "LSTAT",
]
TARGET = "MEDV"
METHODS = ["Forward Selection", "Backward Elimination", "RFE", "SelectKBest"]
RANDOM_STATE = 0


def make_selector(method: str, k: int):
    estimator = LinearRegression()
    if method == "Forward Selection":
        return SequentialFeatureSelector(
            estimator, n_features_to_select=k, direction="forward",
            scoring="neg_root_mean_squared_error", cv=3,
        )
    if method == "Backward Elimination":
        return SequentialFeatureSelector(
            estimator, n_features_to_select=k, direction="backward",
            scoring="neg_root_mean_squared_error", cv=3,
        )
    if method == "RFE":
        return RFE(estimator, n_features_to_select=k)
    if method == "SelectKBest":
        return SelectKBest(score_func=f_regression, k=k)
    raise ValueError(method)


def make_model(method: str, k: int) -> Pipeline:
    selector = "passthrough" if k == len(FEATURES) else make_selector(method, k)
    return Pipeline([
        ("scaler", StandardScaler()),
        ("selector", selector),
        ("regressor", LinearRegression()),
    ])


def selected_features(model: Pipeline) -> list[str]:
    selector = model.named_steps.get("selector")
    if selector == "passthrough":
        return FEATURES.copy()
    if selector is not None:
        return np.array(FEATURES)[selector.get_support()].tolist()
    coefficients = model.named_steps["regressor"].coef_
    return np.array(FEATURES)[np.abs(coefficients) > 1e-8].tolist()


def metrics(y_true, y_pred) -> dict[str, float]:
    mse = mean_squared_error(y_true, y_pred)
    return {
        "MAE": mean_absolute_error(y_true, y_pred),
        "MSE": mse,
        "RMSE": np.sqrt(mse),
        "R-squared": r2_score(y_true, y_pred),
    }


def save_figure(path: Path) -> None:
    plt.tight_layout()
    plt.savefig(path, dpi=180, bbox_inches="tight")
    plt.close()


def main() -> None:
    # Phase 1 — Business understanding: estimate MEDV (thousands of USD).
    df = pd.read_csv(DATA)
    if list(df.columns) != FEATURES + [TARGET] or len(df) != 506:
        raise ValueError("BostonHousing.csv must contain 506 rows and the expected 14 columns.")
    X, y = df[FEATURES], df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )
    cv = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    scoring = {"RMSE": "neg_root_mean_squared_error", "R2": "r2"}

    # Phase 2 — data understanding charts.
    sns.set_theme(style="whitegrid", context="notebook")
    plt.figure(figsize=(12, 9))
    sns.heatmap(df.corr(numeric_only=True), cmap="vlag", center=0, square=True)
    plt.title("Boston Housing — Pearson correlation matrix")
    save_figure(FIG / "01_correlation_heatmap.png")

    plt.figure(figsize=(8, 5))
    sns.histplot(y, bins=24, kde=True, color="#1f77b4")
    plt.xlabel("MEDV (median value, $1000s)")
    plt.title("Target distribution")
    save_figure(FIG / "02_target_distribution.png")

    # Phase 3–5 — preprocessing, modelling and validation.
    all_rows: list[dict] = []
    best_models: dict[str, Pipeline] = {}
    for method in METHODS:
        method_rows = []
        for k in range(1, len(FEATURES) + 1):
            model = make_model(method, k)
            scores = cross_validate(model, X_train, y_train, cv=cv, scoring=scoring, n_jobs=1)
            row = {
                "Method": method,
                "Number of Features": k,
                "CV RMSE": -scores["test_RMSE"].mean(),
                "CV R-squared": scores["test_R2"].mean(),
            }
            fitted = make_model(method, k).fit(X_train, y_train)
            row["Selected Features"] = ", ".join(selected_features(fitted))
            method_rows.append(row)
        best_row = min(method_rows, key=lambda item: item["CV RMSE"])
        best_models[method] = make_model(method, best_row["Number of Features"]).fit(X_train, y_train)
        all_rows.extend(method_rows)

    lasso_model = Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", LassoCV(cv=5, random_state=RANDOM_STATE, max_iter=50000)),
    ])
    lasso_scores = cross_validate(lasso_model, X_train, y_train, cv=cv, scoring=scoring, n_jobs=1)
    lasso_model.fit(X_train, y_train)
    lasso_features = selected_features(lasso_model)
    all_rows.append({
        "Method": "Lasso", "Number of Features": len(lasso_features),
        "CV RMSE": -lasso_scores["test_RMSE"].mean(),
        "CV R-squared": lasso_scores["test_R2"].mean(),
        "Selected Features": ", ".join(lasso_features),
    })
    best_models["Lasso"] = lasso_model

    selection = pd.DataFrame(all_rows)
    selection.to_csv(OUT / "feature_selection_results.csv", index=False)

    fig, axes = plt.subplots(1, 2, figsize=(15, 5.5))
    for method in METHODS:
        part = selection[selection["Method"] == method]
        axes[0].plot(part["Number of Features"], part["CV RMSE"], marker="o", label=method)
        axes[1].plot(part["Number of Features"], part["CV R-squared"], marker="o", label=method)
    axes[0].set(title="Cross-validation error", xlabel="Selected features (k)", ylabel="CV RMSE ($1000s)")
    axes[1].set(title="Cross-validation explanatory power", xlabel="Selected features (k)", ylabel="CV R²")
    for ax in axes:
        ax.set_xticks(range(1, len(FEATURES) + 1))
        ax.legend(fontsize=8)
    save_figure(FIG / "03_cv_by_feature_count.png")

    comparison_rows = []
    for method, model in best_models.items():
        pred = model.predict(X_test)
        row = {"Method": method, **metrics(y_test, pred)}
        row["Number of Features"] = len(selected_features(model))
        row["Selected Features"] = ", ".join(selected_features(model))
        comparison_rows.append(row)
    comparison = pd.DataFrame(comparison_rows).sort_values("CV RMSE" if "CV RMSE" in comparison_rows[0] else "RMSE")
    # Attach validation metrics of each selected configuration for transparent model choice.
    cv_best = selection.loc[selection.groupby("Method")["CV RMSE"].idxmin(), ["Method", "CV RMSE", "CV R-squared"]]
    comparison = comparison.merge(cv_best, on="Method", how="left").sort_values("CV RMSE")
    comparison.to_csv(OUT / "final_model_comparison.csv", index=False)

    plt.figure(figsize=(9, 5))
    sns.barplot(data=comparison, x="RMSE", y="Method", hue="Method", legend=False, palette="Blues_d")
    plt.xlabel("Test RMSE ($1000s); lower is better")
    plt.title("Held-out test performance of each CV-selected model")
    save_figure(FIG / "04_final_model_comparison.png")

    final_method = comparison.iloc[0]["Method"]
    final_model = best_models[final_method]
    final_pred = final_model.predict(X_test)
    low = min(y_test.min(), final_pred.min())
    high = max(y_test.max(), final_pred.max())
    plt.figure(figsize=(6.8, 5.5))
    plt.scatter(y_test, final_pred, alpha=.75, color="#1f77b4")
    plt.plot([low, high], [low, high], "--", color="#d62728", label="Perfect prediction")
    plt.xlabel("Actual MEDV ($1000s)")
    plt.ylabel("Predicted MEDV ($1000s)")
    plt.title(f"Actual vs predicted — {final_method}")
    plt.legend()
    save_figure(FIG / "05_actual_vs_predicted.png")

    # Coefficients are reported on original feature scale by refitting selected columns.
    selected = selected_features(final_model)
    plain = LinearRegression().fit(X_train[selected], y_train)
    coefficients = pd.DataFrame({"Feature": selected, "Coefficient": plain.coef_})
    coefficients.loc[len(coefficients)] = ["Intercept", plain.intercept_]
    coefficients.to_csv(OUT / "final_model_coefficients.csv", index=False)
    chart = coefficients[coefficients["Feature"] != "Intercept"].sort_values("Coefficient")
    plt.figure(figsize=(8, max(4, .45 * len(chart))))
    colors = ["#d62728" if x < 0 else "#1f77b4" for x in chart["Coefficient"]]
    plt.barh(chart["Feature"], chart["Coefficient"], color=colors)
    plt.xlabel("Coefficient (original feature units)")
    plt.title(f"{final_method} selected-model coefficients")
    save_figure(FIG / "06_coefficients.png")

    errors = pd.DataFrame({"Actual MEDV": y_test, "Predicted MEDV": final_pred})
    errors["Residual"] = errors["Actual MEDV"] - errors["Predicted MEDV"]
    errors.to_csv(OUT / "test_predictions.csv", index=False)
    with open(OUT / "boston_best_model.pkl", "wb") as file:
        pickle.dump(final_model, file)

    dataset_sha256 = hashlib.sha256(DATA.read_bytes()).hexdigest()
    report = {
        "dataset_shape": list(df.shape), "train_shape": list(X_train.shape), "test_shape": list(X_test.shape),
        "missing_values": df.isna().sum().to_dict(), "dataset_sha256": dataset_sha256,
        "best_method_by_cv_rmse": final_method,
        "selected_features": selected,
        "final_test_metrics": metrics(y_test, final_pred),
        "kaggle_source": "https://www.kaggle.com/datasets/abhijithudayakumar/the-boston-housing-dataset",
        "random_state": RANDOM_STATE,
    }
    (OUT / "report_data.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
