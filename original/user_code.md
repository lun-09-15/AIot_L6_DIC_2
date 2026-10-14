

\# ==========================================================

\# 50 Startups - Multiple Linear Regression

\# CRISP-DM + Top 5 Feature Selection Methods

\# ==========================================================



import pandas as pd

import numpy as np

import matplotlib.pyplot as plt



from sklearn.model_selection import (

    train_test_split,

    KFold,

    cross_validate

)

from sklearn.preprocessing import (

    OneHotEncoder,

    StandardScaler

)

from sklearn.compose import ColumnTransformer

from sklearn.pipeline import Pipeline

from sklearn.linear_model import LinearRegression, LassoCV

from sklearn.feature_selection import (

    SequentialFeatureSelector,

    RFE,

    SelectKBest,

    f_regression

)

from sklearn.metrics import (

    mean_absolute_error,

    mean_squared_error,

    r2_score

)



\# ==========================================================

\# Phase 1: Business Understanding

\# ==========================================================

\# Objective: Predict startup Profit

\# Algorithm: Multiple Linear Regression





\# ==========================================================

\# Phase 2: Data Understanding

\# ==========================================================

url = (

    "https\://gist.githubusercontent.com/GaneshSparkz/"

    "b5662effbdae8746f7f7d8ed70c42b2d/raw/"

    "faf8b1a0d58e251f48a647d3881e7a960c3f0925/"

    "50_Startups.csv"

)



df = pd.read_csv(url)



print("First 5 Rows:")

print(df.head())



print("\nDataset Shape:", df.shape)

print("\nMissing Values:")

print(df.isnull().sum())



print("\nCorrelation Matrix:")

print(df.select_dtypes(include="number").corr())





\# ==========================================================

\# Phase 3: Data Preparation

\# ==========================================================

**X** = df.drop(columns=["Profit"])

y = df["Profit"]



numeric_features = [

    "R&D Spend",

    "Administration",

    "Marketing Spend"

]



categorical_features = ["State"]



\# Split dataset: 80% training / 20% testing

X_train, X_test, y_train, y_test = train_test_split(

    **X**,

    y,

    test_size=0.2,

    random_state=0

)



\# Preprocessing is fitted inside each training fold

def make_preprocessor():

    return ColumnTransformer([

        ("num", "passthrough", numeric_features),

        ("cat", OneHotEncoder(

            drop="first",

            handle_unknown="ignore",

            sparse_output=False

        ), categorical_features)

    ])



cv = KFold(

    n_splits=5,

    shuffle=True,

    random_state=0

)



scoring = {

    "RMSE": "neg_root_mean_squared_error",

    "R2": "r2"

}





\# ==========================================================

\# Phase 4: Modeling

\# ==========================================================

def make_selector(method, k):

    estimator = LinearRegression()



    if method == "Forward Selection":

        return SequentialFeatureSelector(

            estimator,

            n_features_to_select=k,

            direction="forward",

            scoring="neg_root_mean_squared_error",

            cv=3

        )



    elif method == "Backward Elimination":

        return SequentialFeatureSelector(

            estimator,

            n_features_to_select=k,

            direction="backward",

            scoring="neg_root_mean_squared_error",

            cv=3

        )



    elif method == "RFE":

        return RFE(

            estimator,

            n_features_to_select=k

        )



    elif method == "SelectKBest":

        return SelectKBest(

            score_func=f_regression,

            k=k

        )





def make_model(method, k):

    # With 5 features, no selection is needed.

    selector = (

        "passthrough"

        if k == 5

        else make_selector(method, k)

    )



    return Pipeline([

        ("preprocessor", make_preprocessor()),

        ("scaler", StandardScaler()),

        ("selector", selector),

        ("regressor", LinearRegression())

    ])





\# ==========================================================

\# Phase 5: Evaluation

\# ==========================================================

def evaluate(y_true, y_pred):

    return {

        "MAE": mean_absolute_error(y_true, y_pred),

        "MSE": mean_squared_error(y_true, y_pred),

        "RMSE": np.sqrt(mean_squared_error(y_true, y_pred)),

        "R-squared": r2_score(y_true, y_pred)

    }





def get_selected_features(model):

    feature_names = model.named_steps[

        "preprocessor"

    ].get_feature_names_out()



    if "selector" in model.named_steps:

        selector = model.named_steps["selector"]



        if selector != "passthrough":

            return feature_names[

                selector.get_support()

            ].tolist()



        return feature_names.tolist()



    # Lasso: selected coefficients

    coefficients = model.named_steps["regressor"].coef\_



    return feature_names[

        np.abs(coefficients) > 1e-8

    ].tolist()





\# ==========================================================

\# Phase 5.1: Compare Feature Selection Methods

\# ==========================================================

methods = [

    "Forward Selection",

    "Backward Elimination",

    "RFE",

    "SelectKBest"

]



all_results = []

best_models = {}



for method in methods:



    print(f"\n========== {method} ==========")



    method_results = []



    for k in range(1, 6):



        model = make_model(method, k)



        # Cross-validation on training data

        scores = cross_validate(

            model,

            X_train,

            y_train,

            cv=cv,

            scoring=scoring,

            n_jobs=-1

        )



        cv_rmse = -scores["test_RMSE"].mean()

        cv_r2 = scores["test_R2"].mean()



        method_results.append({

            "Method": method,

            "Number of Features": k,

            "CV RMSE": cv_rmse,

            "CV R-squared": cv_r2

        })



    # Select feature count using CV RMSE

    method_df = pd.DataFrame(method_results)

    best_index = method_df["CV RMSE"].idxmin()

    best_k = int(method_df.loc[

        best_index, "Number of Features"

    ])



    # Fit chosen model on full training set

    best_model = make_model(method, best_k)

    best_model.fit(X_train, y_train)



    selected = get_selected_features(best_model)



    for row in method_results:

        model_k = make_model(

            method, row["Number of Features"]

        )

        model_k.fit(X_train, y_train)



        row["Selected Features"] = (

            get_selected_features(model_k)

        )



    all_results.extend(method_results)

    best_models[method] = best_model



    print(f"Best Feature Count: {best_k}")

    print(f"Selected Features: {selected}")





\# ==========================================================

\# Phase 5.2: Lasso Feature Selection

\# ==========================================================

lasso_model = Pipeline([

    ("preprocessor", make_preprocessor()),

    ("scaler", StandardScaler()),

    ("regressor", LassoCV(

        cv=5,

        random_state=0,

        max_iter=50000

    ))

])



lasso_scores = cross_validate(

    lasso_model,

    X_train,

    y_train,

    cv=cv,

    scoring=scoring,

    n_jobs=-1

)



lasso_cv_rmse = -lasso_scores["test_RMSE"].mean()

lasso_cv_r2 = lasso_scores["test_R2"].mean()



lasso_model.fit(X_train, y_train)



lasso_selected = get_selected_features(lasso_model)



print("\n========== Lasso ==========")

print("Selected Features:", lasso_selected)

print("Best Alpha:",

      lasso_model.named_steps["regressor"].alpha\_)



best_models["Lasso"] = lasso_model





\# ==========================================================

\# Phase 5.3: Feature Selection Results Table

\# ==========================================================

results_df = pd.DataFrame(all_results)



\# Lasso produces one selected feature subset

lasso_row = pd.DataFrame([{

    "Method": "Lasso",

    "Number of Features": len(lasso_selected),

    "CV RMSE": lasso_cv_rmse,

    "CV R-squared": lasso_cv_r2,

    "Selected Features": lasso_selected

}])



results_df = pd.concat(

    [results_df, lasso_row],

    ignore_index=True

)



print("\n========== Feature Selection Results ==========")



display_columns = [

    "Method",

    "Number of Features",

    "Selected Features",

    "CV RMSE",

    "CV R-squared"

]



print(

    results_df[display_columns].to_string(index=False)

)





\# ==========================================================

\# Phase 5.4: RMSE and R-squared Visualization

\# ==========================================================

fig, axes = plt.subplots(1, 2, figsize=(14, 5))



for method in methods:



    subset = results_df[

        results_df["Method"] == method

    ]



    axes[0].plot(

        subset["Number of Features"],

        subset["CV RMSE"],

        marker="o",

        label=method

    )



    axes[1].plot(

        subset["Number of Features"],

        subset["CV R-squared"],

        marker="o",

        label=method

    )



axes[0].set_title("RMSE by Number of Features")

axes[0].set_xlabel("Number of Features")

axes[0].set_ylabel("CV RMSE")

axes[0].set_xticks(range(1, 6))

axes[0].legend()

axes[0].grid(True)



axes[1].set_title("R-squared by Number of Features")

axes[1].set_xlabel("Number of Features")

axes[1].set_ylabel("CV R-squared")

axes[1].set_xticks(range(1, 6))

axes[1].legend()

axes[1].grid(True)



plt.tight_layout()

plt.show()





\# ==========================================================

\# Phase 5.5: Final Model Comparison

\# ==========================================================

comparison_results = []



for method, model in best_models.items():



    y_pred = model.predict(X_test)

    metrics = evaluate(y_test, y_pred)



    selected = get_selected_features(model)



    comparison_results.append({

        "Method": method,

        "Number of Features": len(selected),

        "Selected Features": selected,

        \*\*metrics

    })



comparison_df = pd.DataFrame(comparison_results)



print("\n========== Final Model Comparison ==========")

print(comparison_df.to_string(index=False))





\# ==========================================================

\# Phase 5.6: Actual vs Predicted Visualization

\# ==========================================================

\# Display the results of the model with lowest

\# independently measured CV RMSE.



best_method = min(

    methods + ["Lasso"],

    key=lambda m: (

        results_df.loc[

            results_df["Method"] == m,

            "CV RMSE"

        ].min()

    )

)



final_model = best_models[best_method]

final_pred = final_model.predict(X_test)



plt.figure(figsize=(7, 5))

plt.scatter(y_test, final_pred, alpha=0.7)



minimum = min(y_test.min(), final_pred.min())

maximum = max(y_test.max(), final_pred.max())



plt.plot(

    [minimum, maximum],

    [minimum, maximum],

    "r--",

    label="Perfect Prediction"

)



plt.xlabel("Actual Profit")

plt.ylabel("Predicted Profit")

plt.title(f"Actual vs Predicted ({best_method})")

plt.legend()

plt.grid(True)

plt.show()



print("\nBest Method by CV RMSE:", best_method)

print("Selected Features:",

      get_selected_features(final_model))





\# ==========================================================

\# Phase 6: Deployment

\# ==========================================================

import pickle



with open("startup_best_model.pkl", "wb") as f:

    pickle.dump(final_model, f)



print("\nModel saved: startup_best_model.pkl")



\# Predict a new startup

new_startup = pd.DataFrame({

    "R&D Spend": [120000],

    "Administration": [130000],

    "Marketing Spend": [250000],

    "State": ["California"]

})



prediction = final_model.predict(new_startup)



print(f"Predicted Profit: ${prediction[0]:,.2f}")
