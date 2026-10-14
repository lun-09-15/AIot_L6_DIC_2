"""Predict with the saved pipeline: python predict.py --rd 120000."""
import argparse
import pickle
from pathlib import Path
import pandas as pd

parser = argparse.ArgumentParser()
parser.add_argument('--rd', type=float, default=120000)
parser.add_argument('--admin', type=float, default=130000)
parser.add_argument('--marketing', type=float, default=250000)
parser.add_argument('--state', choices=['California','Florida','New York'], default='California')
args = parser.parse_args()
if min(args.rd,args.admin,args.marketing) < 0:
    parser.error('Spending must be non-negative.')
# Only load your own locally generated pickle file.
with (Path(__file__).resolve().parent/'results/startup_best_model.pkl').open('rb') as f:
    model = pickle.load(f)
row = pd.DataFrame({'R&D Spend':[args.rd],'Administration':[args.admin],'Marketing Spend':[args.marketing],'State':[args.state]})
print(f'Predicted Profit: ${model.predict(row)[0]:,.2f}')
