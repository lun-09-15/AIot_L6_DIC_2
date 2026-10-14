'use strict';
const D = window.REPORT;
const $ = id => document.getElementById(id);
const methods = ['Forward Selection','Backward Elimination','RFE','SelectKBest','Lasso'];
const explanations = {
 'Forward Selection':'由少到多逐步加入特徵，以內層 3 折 CV 的 RMSE 評估候選組合。',
 'Backward Elimination':'由完整特徵逐步移除，以內層 3 折 CV 評估；這不是以 p-value 為門檻的消除法。',
 'RFE':'以標準化後的線性迴歸係數，逐步移除權重最小的特徵。',
 'SelectKBest':'使用 f_regression 對每個特徵做單變量 F 檢定，保留分數最高的 k 個。',
 'Lasso':'LassoCV 以內層 5 折 CV 選擇 alpha；L1 懲罰使部分係數歸零，直接以 Lasso 預測。'
};
let method = D.best_method;
let current = D.models.find(m => m.method === method && m.best);
const fmt = (v,d=2) => Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const money = v => '$'+fmt(v);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chips = names => names.map(s=>`<span class="chip">${esc(s)}</span>`).join('');
function table(id, headers, rows, highlight=-1){
 $(id).innerHTML = `<thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr class="${i===highlight?'highlight':''}">${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
}
function chart(id, points, options={}){
 const W=500,H=295,L=65,R=22,T=28,B=52;
 let xmin=options.xmin??Math.min(...points.map(p=>p.x)), xmax=options.xmax??Math.max(...points.map(p=>p.x));
 let ymin=options.ymin??Math.min(...points.map(p=>p.y)), ymax=options.ymax??Math.max(...points.map(p=>p.y));
 if(xmin===xmax){xmin-=.5;xmax+=.5} if(ymin===ymax){ymin-=.05;ymax+=.05}
 if(!options.scatter){let pad=(ymax-ymin)*.25;ymin-=pad;ymax+=pad}
 const x=v=>L+(v-xmin)/(xmax-xmin)*(W-L-R), y=v=>H-B-(v-ymin)/(ymax-ymin)*(H-B-T);
 const num=v=>options.decimals?fmt(v,3):(Math.abs(v)>=1000?fmt(v/1000,1)+'k':fmt(v,0));
 let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(options.title||'分析圖表')}"><title>${esc(options.title||'分析圖表')}</title>`;
 for(let i=0;i<5;i++){let v=ymin+(ymax-ymin)*i/4; s+=`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#dce4d4" stroke-dasharray="3 5"/><text x="${L-12}" y="${y(v)+4}" text-anchor="end" fill="#647763" font-size="10">${num(v)}</text>`}
 const ticks=options.scatter?[xmin,(xmin+xmax)/2,xmax]:[1,2,3,4,5];
 ticks.forEach(v=>{s+=`<text x="${x(v)}" y="${H-B+22}" text-anchor="middle" fill="#647763" font-size="10">${options.scatter?(v/1000).toFixed(0)+'k':v}</text>`});
 if(options.diagonal)s+=`<path d="M${x(xmin)},${y(xmin)} L${x(xmax)},${y(xmax)}" fill="none" stroke="#91a382" stroke-dasharray="6 5"/>`;
 if(!options.scatter&&points.length>1)s+=`<polyline points="${points.map(p=>`${x(p.x)},${y(p.y)}`).join(' ')}" fill="none" stroke="#346b4e" stroke-width="2.2"/>`;
 points.forEach(p=>{s+=`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="${p.active?6:options.scatter?4:4.5}" fill="${p.active?'#256c48':options.scatter?'#6d9463':'#fff'}" stroke="${options.scatter?'#ebf0df':'#346b4e'}" stroke-width="${p.active?3:1.5}" opacity=".95"><title>${esc(p.label||`${p.x}: ${p.y}`)}</title></circle>`});
 s+=`<text x="${(L+W-R)/2}" y="${H-7}" text-anchor="middle" fill="#647763" font-size="10">${esc(options.xlabel||'保留特徵數 k')}</text></svg>`;
 $(id).innerHTML=s;
}
function render(){
 $('method-tabs').innerHTML=methods.map(m=>`<button type="button" class="${m===method?'active':''}" aria-pressed="${m===method}" data-method="${m}">${m}</button>`).join('');
 const rows=D.models.filter(m=>m.method===method), best=rows.find(m=>m.best);
 $('k-buttons').innerHTML=rows.map(m=>`<button type="button" class="${m===current?'active':''}" aria-pressed="${m===current}" aria-label="${method==='Lasso'?'Lasso 自動選擇':'保留'} ${m.k} 個特徵" data-k="${m.k}">${m.k}</button>`).join('');
 $('selection-note').textContent=method==='Lasso'?`自動選擇 ${current.k} 個特徵 · α = ${fmt(current.alpha)}`:`此方法 CV 最佳：k = ${best.k} · RMSE ${money(best.cv_rmse)}`;
 $('method-description').textContent=explanations[method]+(current.k===5&&method!=='Lasso'?' k = 5 不進行選擇，直接使用完整 OLS。':'');
 $('cv-rmse').textContent=money(current.cv_rmse);$('cv-r2').textContent=fmt(current.cv_r2,4);$('test-rmse').textContent=money(current.RMSE);$('test-r2').textContent=fmt(current['R-squared'],4);
 $('selected-features').innerHTML=chips(current.selected);
 chart('rmse-chart',rows.map(m=>({x:m.k,y:m.cv_rmse,active:m===current,label:`k=${m.k} · CV RMSE ${money(m.cv_rmse)}`})),{xmin:1,xmax:5,title:method+' 的交叉驗證 RMSE'});
 chart('r2-chart',rows.map(m=>({x:m.k,y:m.cv_r2,active:m===current,label:`k=${m.k} · CV R² ${fmt(m.cv_r2,4)}`})),{xmin:1,xmax:5,decimals:true,title:method+' 的交叉驗證 R²'});
 table('selection-table',['特徵數 k','保留特徵','CV RMSE ↓','CV R² ↑','CV 選擇'],rows.map(m=>[m.k,chips(m.selected),money(m.cv_rmse),fmt(m.cv_r2,4),m.best?'✓ 此方法最佳':'—']),rows.indexOf(current));
 const low=40000,high=200000;
 chart('actual-chart',current.predictions.map(p=>({x:p.actual,y:p.predicted,label:`樣本 ${p.id} · 實際 ${money(p.actual)} · 預測 ${money(p.predicted)}`})),{scatter:true,diagonal:true,xmin:low,xmax:high,ymin:low,ymax:high,xlabel:'實際 Profit / USD（縱軸：預測 Profit）',title:'測試集實際獲利與預測獲利散點圖'});
 $('coefficient-list').innerHTML=`<div class="coef-row"><span>Intercept / 截距</span><b>${fmt(current.intercept,4)}</b></div>`+Object.entries(current.coefficients).map(([n,c])=>`<div class="coef-row ${!current.selected.includes(n)?'muted':''}"><span>${esc(n)}${!current.selected.includes(n)?' · 未選取':''}</span><b>${fmt(c,4)}</b></div>`).join('');
 table('residual-table',['Sample ID','實際獲利','預測獲利','殘差','絕對誤差'],[...current.predictions].sort((a,b)=>Math.abs(b.residual)-Math.abs(a.residual)).map(p=>['#'+p.id,money(p.actual),money(p.predicted),money(p.residual),money(Math.abs(p.residual))]));
 $('equation').textContent='Profit = '+fmt(current.intercept,4)+Object.entries(current.coefficients).filter(([,c])=>Math.abs(c)>1e-8).map(([n,c])=>` ${c>=0?'+':'−'} ${fmt(Math.abs(c),6)} × ${n}`).join('');
 predict();
}
function predict(){
 const ids=['rd','admin','marketing'];
 if(ids.some(id=>!$(id).checkValidity()||!Number.isFinite($(id).valueAsNumber))){$('prediction').textContent='請輸入有效金額';$('range-note').textContent='三項支出皆須為大於或等於 0 的數字。';return}
 const values={'R&D Spend':+$('rd').value,'Administration':+$('admin').value,'Marketing Spend':+$('marketing').value,'State_Florida':Number($('state').value==='Florida'),'State_New York':Number($('state').value==='New York')};
 let result=current.intercept;Object.entries(current.coefficients).forEach(([n,c])=>result+=c*values[n]);
 $('prediction').textContent=money(result);$('prediction-model').textContent=`${method} · ${current.k} 個特徵 · 即時更新`;
 const outside=Object.entries(values).filter(([n,v])=>!n.startsWith('State_')&&(v<Math.min(...D.dataset.map(r=>r[n]))||v>Math.max(...D.dataset.map(r=>r[n])))).map(([n])=>n);
 $('range-note').textContent=outside.length?'超出原始樣本範圍：'+outside.join('、')+'。此結果屬於外推，可信度較低。':'輸入位於資料集各欄位範圍內；這不代表此組合已被樣本涵蓋。';
}
$('method-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-method]');if(!b)return;method=b.dataset.method;current=D.models.find(m=>m.method===method&&m.best);render()});
$('k-buttons').addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(!b)return;current=D.models.find(m=>m.method===method&&m.k===Number(b.dataset.k));render()});
$('prediction-form').addEventListener('input',predict);$('prediction-form').addEventListener('change',predict);$('prediction-form').addEventListener('submit',e=>e.preventDefault());$('prediction-form').addEventListener('reset',()=>setTimeout(predict,0));
chart('hero-chart',D.dataset.map((r,i)=>({x:r['R&D Spend'],y:r.Profit,label:`樣本 ${i+1} · 研發 ${money(r['R&D Spend'])} · 獲利 ${money(r.Profit)}`})),{scatter:true,xmin:0,xmax:180000,ymin:0,ymax:220000,xlabel:'研發支出 / USD（縱軸：Profit）',title:'50 家新創的研發支出與獲利'});
$('data-summary').textContent=`${D.meta.rows} 筆資料 · 缺失值 ${D.meta.missing} · 3 個州別 · 研發支出與 Profit 的 Pearson r = ${fmt(D.correlation.Profit['R&D Spend'],3)}（全樣本描述統計）`;
const cols=['R&D Spend','Administration','Marketing Spend','State','Profit'];table('data-table',cols,D.dataset.slice(0,5).map(r=>cols.map(c=>typeof r[c]==='number'?money(r[c]):esc(r[c]))));
const finalists=D.models.filter(m=>m.best),winner=finalists.find(m=>m.method===D.best_method);
const tied=finalists.filter(m=>Math.abs(m.cv_rmse-winner.cv_rmse)<1e-6).map(m=>m.method);
$('insight').innerHTML=`<strong>本次發現：${esc(tied.join(' 與 '))} 的最佳 CV RMSE 相同，皆選擇 ${chips(winner.selected)}。</strong><br>依原程式順序保存 ${esc(D.best_method)}。CV RMSE 為 ${money(winner.cv_rmse)}；測試 RMSE 為 ${money(winner.RMSE)}。完整 5 特徵基準的測試 RMSE 為 ${money(D.baseline.RMSE)}。這是本次固定切分的結果，並不證明更多特徵必然造成過度擬合。`;
table('comparison-table',['方法','特徵數','保留特徵','CV RMSE ↓','Test MAE ↓','Test MSE ↓','Test RMSE ↓','Test R² ↑'],finalists.map(m=>[esc(m.method),m.k,chips(m.selected),money(m.cv_rmse),money(m.MAE),fmt(m.MSE),money(m.RMSE),fmt(m['R-squared'],4)]),finalists.indexOf(winner));
$('provenance').textContent=`實驗：Python ${D.meta.python} · scikit-learn ${D.meta.sklearn} · seed ${D.meta.seed} · 資料 SHA-256 ${D.meta.dataset_sha256.slice(0,16)}…`;
render();

