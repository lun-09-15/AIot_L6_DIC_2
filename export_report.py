"""Export fitted pipelines, not manually entered benchmark numbers."""
import json
import hashlib
import platform
import shutil
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import sklearn


def export_report(g):
    root, out = g['ROOT'], g['OUT']
    dist = root / 'dist'
    dist.mkdir(exist_ok=True)
    records, models = [], []
    for method in g['methods'] + ['Lasso']:
        rows = g['results_df'][g['results_df']['Method'] == method]
        for _, row in rows.iterrows():
            k = int(row['Number of Features'])
            model = g['lasso_model'] if method == 'Lasso' else g['make_model'](method, k).fit(g['X_train'], g['y_train'])
            names = model.named_steps['preprocessor'].get_feature_names_out().tolist()
            scaler = model.named_steps['scaler']
            reg = model.named_steps['regressor']
            coef = np.zeros(len(names))
            selector = model.named_steps.get('selector', 'passthrough')
            mask = np.ones(len(names), dtype=bool) if selector == 'passthrough' else selector.get_support()
            coef[mask] = reg.coef_
            raw_coef = coef / scaler.scale_
            intercept = float(reg.intercept_ - np.dot(raw_coef, scaler.mean_))
            pred = model.predict(g['X_test'])
            encoded = model.named_steps['preprocessor'].transform(g['X_test'])
            np.testing.assert_allclose(encoded @ raw_coef + intercept, pred, rtol=1e-10, atol=1e-7)
            selected = g['get_selected_features'](model)
            best = model is g['lasso_model'] or k == len(g['get_selected_features'](g['best_models'][method]))
            item = dict(method=method, k=k, selected=[n.split('__', 1)[1] for n in selected], cv_rmse=float(row['CV RMSE']), cv_r2=float(row['CV R-squared']), best=best)
            item.update(g['evaluate'](g['y_test'], pred))
            item['intercept'] = intercept
            item['coefficients'] = {n.split('__', 1)[1]: float(c) for n,c in zip(names, raw_coef)}
            item['alpha'] = float(reg.alpha_) if method == 'Lasso' else None
            item['predictions'] = [dict(id=int(idx)+1, actual=float(actual), predicted=float(p), residual=float(actual-p)) for idx,actual,p in zip(g['y_test'].index,g['y_test'],pred)]
            models.append(item)
            records.append({key: value for key,value in item.items() if key not in ['coefficients','predictions']})
    baseline = g['make_model']('Forward Selection', 5).fit(g['X_train'],g['y_train'])
    data = dict(models=models, best_method=g['best_method'], dataset=g['df'].to_dict(orient='records'),
        correlation=g['df'].select_dtypes(include='number').corr().round(6).to_dict(),
        meta=dict(rows=len(g['df']), missing=int(g['df'].isna().sum().sum()), train_ids=(g['X_train'].index+1).tolist(), test_ids=(g['X_test'].index+1).tolist(), seed=0, cv_folds=5,
        generated_at=datetime.now(timezone.utc).isoformat(), python=platform.python_version(), sklearn=sklearn.__version__,
        dataset_sha256=hashlib.sha256((root/'data/50_Startups.csv').read_bytes()).hexdigest()),
        baseline=g['evaluate'](g['y_test'],baseline.predict(g['X_test'])))
    (out/'report_data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    (dist/'data.js').write_text('window.REPORT = '+json.dumps(data,ensure_ascii=False,allow_nan=False)+';\n',encoding='utf-8')
    if (dist/'app.js').exists():
        (dist/'report.js').write_text((dist/'data.js').read_text(encoding='utf-8-sig')+'\n'+(dist/'app.js').read_text(encoding='utf-8-sig'),encoding='utf-8')
    g['results_df'].to_csv(out/'feature_selection_results.csv',index=False,encoding='utf-8-sig')
    g['comparison_df'].to_csv(out/'final_model_comparison.csv',index=False,encoding='utf-8-sig')
    pd.DataFrame(records).to_csv(out/'all_models.csv',index=False,encoding='utf-8-sig')
    selected = next(m for m in models if m['method']==g['best_method'] and m['best'])
    pd.DataFrame(selected['predictions']).to_csv(out/'test_predictions.csv',index=False,encoding='utf-8-sig')
    for name in ['feature_selection_results.csv','final_model_comparison.csv','report_data.json','test_predictions.csv']:
        shutil.copyfile(out/name, dist/name)
    shutil.copyfile(root/'data/50_Startups.csv',dist/'50_Startups.csv')
    print('Verified all 21 exported equations against Python predictions. Website data exported.')
