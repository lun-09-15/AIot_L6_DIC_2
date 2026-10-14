'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const datasets = window.DATASETS || {};
  let active = {...datasets.startups, id: 'startups'};
  let customUrl = null;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isNumber = value => typeof value === 'number' && Number.isFinite(value);
  const display = value => isNumber(value) ? value.toLocaleString('en-US', {maximumFractionDigits: 4}) : escapeHtml(value ?? '');

  function numericColumns(data) {
    return Object.keys(data.rows[0] || {}).filter(column => data.rows.some(row => isNumber(row[column])));
  }
  function missingCount(data) {
    return data.rows.reduce((total, row) => total + Object.values(row).filter(value => value === '' || value === null || value === undefined).length, 0);
  }
  function setOptions(select, columns, preferred) {
    select.innerHTML = columns.map(column => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`).join('');
    select.value = columns.includes(preferred) ? preferred : columns[0] || '';
  }
  function table(headers, rows) {
    return `<thead><tr>${headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${display(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  }
  function scatter(rows, xKey, yKey, hostId = 'dataset-chart') {
    const points = rows.filter(row => isNumber(row[xKey]) && isNumber(row[yKey])).map(row => ({x: row[xKey], y: row[yKey]}));
    const host = $(hostId);
    if (!points.length) { host.innerHTML = '<p class="note">請選擇兩個數值欄位以繪製圖表。</p>'; return; }
    const W = 760, H = 360, L = 66, R = 24, T = 24, B = 54;
    let xmin = Math.min(...points.map(point => point.x)), xmax = Math.max(...points.map(point => point.x));
    let ymin = Math.min(...points.map(point => point.y)), ymax = Math.max(...points.map(point => point.y));
    const expand = (min, max) => min === max ? [min - .5, max + .5] : [min - (max - min) * .06, max + (max - min) * .06];
    [xmin, xmax] = expand(xmin, xmax); [ymin, ymax] = expand(ymin, ymax);
    const x = value => L + (value - xmin) / (xmax - xmin) * (W - L - R);
    const y = value => H - B - (value - ymin) / (ymax - ymin) * (H - B - T);
    const tick = value => Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : Number(value).toLocaleString('en-US', {maximumFractionDigits: 2});
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(xKey)} 與 ${escapeHtml(yKey)} 的散點圖"><title>${escapeHtml(xKey)} 與 ${escapeHtml(yKey)} 的散點圖</title>`;
    for (let i = 0; i < 5; i++) {
      const value = ymin + (ymax - ymin) * i / 4;
      svg += `<line x1="${L}" y1="${y(value)}" x2="${W-R}" y2="${y(value)}" stroke="#dce4d4" stroke-dasharray="3 5"/><text x="${L-10}" y="${y(value)+4}" text-anchor="end" fill="#647763" font-size="11">${tick(value)}</text>`;
      const xv = xmin + (xmax - xmin) * i / 4;
      svg += `<text x="${x(xv)}" y="${H-B+22}" text-anchor="middle" fill="#647763" font-size="11">${tick(xv)}</text>`;
    }
    svg += points.map(point => `<circle cx="${x(point.x)}" cy="${y(point.y)}" r="3.5" fill="#4f7e5d" opacity=".66"><title>${escapeHtml(xKey)}: ${display(point.x)}; ${escapeHtml(yKey)}: ${display(point.y)}</title></circle>`).join('');
    svg += `<text x="${(L+W-R)/2}" y="${H-9}" text-anchor="middle" fill="#465b49" font-size="12">${escapeHtml(xKey)}</text><text x="18" y="${(H-B+T)/2}" text-anchor="middle" fill="#465b49" font-size="12" transform="rotate(-90 18 ${(H-B+T)/2})">${escapeHtml(yKey)}</text></svg>`;
    host.innerHTML = svg;
  }
  function render() {
    if (!active || !active.rows.length) return;
    const sourceSelect=$('dataset-select');
    sourceSelect.innerHTML=`<option value="startups">50 Startups · 新創獲利</option><option value="boston">Boston Housing · 房價中位數</option>${active.id==='custom'?`<option value="custom">目前資料：${escapeHtml(active.name)}</option>`:''}<optgroup label="載入自己的資料"><option value="local">從本機選擇 CSV…</option><option value="url">從 CSV 網址載入…</option></optgroup>`;
    sourceSelect.value=active.id;
    $('dataset-source-panel').hidden=true;$('local-source').hidden=true;$('url-source').hidden=true;
    const columns = Object.keys(active.rows[0]);
    const numeric = numericColumns(active);
    const target = numeric.includes(active.target) ? active.target : numeric[numeric.length - 1];
    const xDefault = active.id === 'boston' ? 'RM' : active.id === 'startups' ? 'R&D Spend' : numeric[0];
    $('active-dataset-name').textContent = active.name;
    $('active-dataset-description').textContent = active.description || '使用者從本機載入的資料集。';
    $('active-dataset-kicker').textContent = active.id === 'custom' ? 'LOCAL DATASET' : 'ACTIVE DATASET';
    $('active-dataset-download').textContent = active.id === 'custom' ? '下載目前資料 CSV ↓' : '下載目前 CSV ↓';
    $('active-dataset-download').href = active.id === 'custom' ? customUrl : (active.id === 'boston' ? 'BostonHousing.csv' : '50_Startups.csv');
    $('dataset-stats').innerHTML = `<div><span>資料列</span><strong>${active.rows.length.toLocaleString()}</strong></div><div><span>欄位數</span><strong>${columns.length}</strong></div><div><span>缺失值</span><strong>${missingCount(active).toLocaleString()}</strong></div>`;
    $('dataset-preview-note').textContent = `顯示前 ${Math.min(12, active.rows.length)} / ${active.rows.length.toLocaleString()} 筆`;
    $('dataset-table').innerHTML = table(columns, active.rows.slice(0, 12).map(row => columns.map(column => row[column])));
    setOptions($('dataset-x'), numeric, xDefault); setOptions($('dataset-y'), numeric, target);
    $('dataset-plot-note').textContent = `${active.source || '本機 CSV'} · ${numeric.length} 個可繪圖數值欄位`;
    const analysis = active.analysis;
    $('dataset-status').textContent = analysis ? `已載入 ${active.name}。既有分析最佳方法：${analysis.bestMethod}；Test RMSE ${analysis.testRmse.toFixed(4)}，Test R² ${analysis.testR2.toFixed(4)}。` : `已載入 ${active.name}。`;
    scatter(active.rows, $('dataset-x').value, $('dataset-y').value);
    const heroLabel = $('hero-chart')?.previousElementSibling;
    if (heroLabel) heroLabel.innerHTML = `<span>${escapeHtml(numeric[0] || 'DATA')} × ${escapeHtml(target || 'TARGET')}</span><span class="mini-tag">${active.rows.length.toLocaleString()} ROWS</span>`;
    if (numeric.length > 1 && target) scatter(active.rows, numeric[0], target, 'hero-chart');
    const heroFooter = $('hero-chart')?.nextElementSibling;
    if (heroFooter) heroFooter.innerHTML = `<span>${escapeHtml(active.name)} · ${active.rows.length.toLocaleString()} 筆資料</span><b>從資料走向洞察 ↗</b>`;
    renderDatasetReport();
  }
  function renderBostonCharts() {
    const data = window.BOSTON_ANALYSIS;
    const rows = datasets.boston.rows;
    const methods = ['Forward Selection','Backward Elimination','RFE','SelectKBest'];
    const colors = {'Forward Selection':'#4b79b8','Backward Elimination':'#e18a4b','RFE':'#4f9b68','SelectKBest':'#be5960'};
    const labels = {'Forward Selection':'Forward','Backward Elimination':'Backward','RFE':'RFE','SelectKBest':'SelectKBest'};
    const wrap = (w,h,label,body) => `<svg class="boston-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title>${body}</svg>`;
    const put = (id,svg) => { const host=$(id); if(host) host.innerHTML=svg; };
    const line = (x1,y1,x2,y2,color='#dce4d4',dash='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}"${dash?` stroke-dasharray="${dash}"`:''}/>`;
    const text = (x,y,value,anchor='middle',size=10,extra='') => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#647763" font-size="${size}" ${extra}>${escapeHtml(value)}</text>`;

    const features=Object.keys(rows[0]).filter(k=>typeof rows[0][k]==='number');
    const means=Object.fromEntries(features.map(k=>[k,rows.reduce((a,r)=>a+r[k],0)/rows.length]));
    const stds=Object.fromEntries(features.map(k=>[k,Math.sqrt(rows.reduce((a,r)=>a+(r[k]-means[k])**2,0)/(rows.length-1))]));
    const correlations=features.map(a=>features.map(b=>rows.reduce((sum,r)=>sum+((r[a]-means[a])/stds[a])*((r[b]-means[b])/stds[b]),0)/(rows.length-1)));
    const hw=590,hh=520,cell=28,left=104,top=26;
    let heat='';
    correlations.forEach((vals,i)=>vals.forEach((v,j)=>{
      const t=Math.abs(v), rgb=v>=0?`rgb(${Math.round(250-75*t)},${Math.round(247-174*t)},${Math.round(246-172*t)})`:`rgb(${Math.round(246-169*t)},${Math.round(247-155*t)},${Math.round(250-91*t)})`;
      heat+=`<rect x="${left+j*cell}" y="${top+i*cell}" width="${cell-1}" height="${cell-1}" rx="1" fill="${rgb}"><title>${features[i]} × ${features[j]}: ${v.toFixed(2)}</title></rect>`;
    }));
    features.forEach((f,i)=>{heat+=text(left-8,top+i*cell+18,f,'end',10);heat+=`<text x="${left+i*cell+cell/2}" y="${top+features.length*cell+10}" text-anchor="end" fill="#647763" font-size="10" transform="rotate(-48 ${left+i*cell+cell/2} ${top+features.length*cell+10})">${escapeHtml(f)}</text>`;});
    heat+=text(left,top+features.length*cell+76,'−1','start',9)+text(left+features.length*cell/2,top+features.length*cell+76,'0','middle',9)+text(left+features.length*cell,top+features.length*cell+76,'+1','end',9);
    put('boston-heatmap',wrap(hw,hh,'Boston Housing Pearson correlation matrix',heat));

    function lineChart(id,key,title,yLabel,precision=2){
      const dataRows=data.cvRows.filter(r=>methods.includes(r.method));
      const values=dataRows.map(r=>r[key]);let yMin=Math.min(...values),yMax=Math.max(...values);const pad=(yMax-yMin)*.12||.1;yMin-=pad;yMax+=pad;
      const W=620,H=340,L=54,R=16,T=20,B=76,x=v=>L+(v-1)/12*(W-L-R),y=v=>H-B-(v-yMin)/(yMax-yMin)*(H-T-B);
      let body='';for(let i=0;i<5;i++){const v=yMin+(yMax-yMin)*i/4;body+=line(L,y(v),W-R,y(v),'#dce4d4','3 5')+text(L-8,y(v)+3,v.toFixed(precision),'end',9);}for(let k=1;k<=13;k++){body+=line(x(k),T,x(k),H-B,'#edf0e8')+text(x(k),H-B+17,String(k),'middle',9);}
      methods.forEach((method,mi)=>{const pts=dataRows.filter(r=>r.method===method).sort((a,b)=>a.k-b.k);if(!pts.length)return;body+=`<polyline points="${pts.map(r=>`${x(r.k)},${y(r[key])}`).join(' ')}" fill="none" stroke="${colors[method]}" stroke-width="2.2" stroke-linejoin="round"/>`;pts.forEach(r=>{body+=`<circle cx="${x(r.k)}" cy="${y(r[key])}" r="3.3" fill="${colors[method]}"><title>${labels[method]} · k=${r.k} · ${title} ${r[key].toFixed(precision)}</title></circle>`;});});
      body+=text((L+W-R)/2,H-43,'保留特徵數 k','middle',10);
      const legendY=H-15;methods.forEach((m,i)=>{const col=i%2,row=Math.floor(i/2),lx=L+col*210,ly=legendY-13+row*16;body+=line(lx,ly,lx+20,ly,colors[m])+text(lx+26,ly+3,labels[m],'start',9);});
      put(id,wrap(W,H,title,body));
    }
    lineChart('boston-cv-rmse','rmse','Cross-validation RMSE','CV RMSE',2);
    lineChart('boston-cv-r2','r2','Cross-validation R²','CV R²',3);

    {
      const values=data.models,W=620,H=330,L=142,R=52,T=25,B=34,max=Math.max(...values.map(r=>r.rmse))*1.15,x=v=>L+v/max*(W-L-R),rowH=(H-T-B)/values.length;
      let body='';for(let i=0;i<=5;i++){const v=max*i/5;body+=line(x(v),T,x(v),H-B,'#dce4d4','3 5')+text(x(v),H-B+17,v.toFixed(1),'middle',9);}
      values.forEach((r,i)=>{const yy=T+i*rowH+5;body+=text(L-10,yy+rowH*.55,r.method,'end',9)+`<rect x="${L}" y="${yy}" width="${Math.max(2,x(r.rmse)-L)}" height="${rowH*.58}" rx="3" fill="${colors[r.method]||'#4f7e5d'}"><title>${r.method}: Test RMSE ${r.rmse.toFixed(4)} ($1000s)</title></rect>`+text(x(r.rmse)+6,yy+rowH*.42,r.rmse.toFixed(2),'start',9);});
      put('boston-models',wrap(W,H,'Boston Housing held-out test RMSE by model',body));
    }
    {
      const values=data.predictions,W=620,H=350,L=58,R=18,T=18,B=52,min=0,max=52,x=v=>L+(v-min)/(max-min)*(W-L-R),y=v=>H-B-(v-min)/(max-min)*(H-T-B);
      let body='';for(let v=0;v<=50;v+=10){body+=line(L,y(v),W-R,y(v),'#dce4d4','3 5')+line(x(v),T,x(v),H-B,'#edf0e8')+text(L-8,y(v)+3,String(v),'end',9)+text(x(v),H-B+17,String(v),'middle',9);}
      body+=line(x(min),y(min),x(max),y(max),'#8a9c7a','6 5');values.forEach((r,i)=>{body+=`<circle cx="${x(r.actual)}" cy="${y(r.predicted)}" r="3.3" fill="#4f7e5d" opacity=".72"><title>測試樣本 ${i+1} · 實際 ${r.actual.toFixed(1)} · 預測 ${r.predicted.toFixed(2)}</title></circle>`;});
      body+=text((L+W-R)/2,H-8,'實際 MEDV（千美元）','middle',10)+`<text x="14" y="${(T+H-B)/2}" text-anchor="middle" fill="#647763" font-size="10" transform="rotate(-90 14 ${(T+H-B)/2})">預測 MEDV（千美元）</text>`;
      put('boston-predictions',wrap(W,H,'Boston Housing actual versus predicted MEDV',body));
    }
    {
      const values=data.coefficients,W=620,H=390,L=82,R=34,T=18,B=35,min=Math.min(...values.map(r=>r.value))*1.1,max=Math.max(...values.map(r=>r.value))*1.1,x=v=>L+(v-min)/(max-min)*(W-L-R),rowH=(H-T-B)/values.length;
      let body='';[-15,-10,-5,0,5].forEach(v=>{if(v>=min&&v<=max)body+=line(x(v),T,x(v),H-B,'#dce4d4','3 5')+text(x(v),H-B+16,String(v),'middle',9);});
      values.forEach((r,i)=>{const yy=T+i*rowH+4,yMid=yy+rowH*.52,zero=x(0),end=x(r.value),barX=Math.min(zero,end),barW=Math.max(1,Math.abs(end-zero));body+=text(L-8,yMid+3,r.feature,'end',9)+`<rect x="${barX}" y="${yy}" width="${barW}" height="${rowH*.62}" rx="2" fill="${r.value<0?'#c95353':'#4b83ae'}"><title>${r.feature}: ${r.value.toFixed(3)}</title></rect>`;});
      body+=text((L+W-R)/2,H-4,'模型係數（原始特徵單位）','middle',10);
      put('boston-coefficients',wrap(W,H,'Boston Housing RFE model coefficients',body));
    }
  }

  function regressionFit(trainRows, testRows, featureDefs, target) {
    const usable = featureDefs.filter(f => {
      const vals = trainRows.map(r => r[f.key]).filter(isNumber);
      if (!vals.length) return false;
      let min=Infinity,max=-Infinity;for(const v of vals){if(v<min)min=v;if(v>max)max=v;}
      return max-min>1e-12;
    }).slice(0, Math.max(1,Math.min(40,trainRows.length-2)));
    const medians = usable.map(f => {
      const vals = trainRows.map(r => r[f.key]).filter(isNumber).sort((a,b)=>a-b);
      return vals.length % 2 ? vals[(vals.length-1)/2] : (vals[vals.length/2-1]+vals[vals.length/2])/2;
    });
    const means = usable.map((f,j) => trainRows.reduce((a,r)=>a+(isNumber(r[f.key])?r[f.key]:medians[j]),0)/trainRows.length);
    const scales = usable.map((f,j) => Math.sqrt(trainRows.reduce((a,r)=>a+((isNumber(r[f.key])?r[f.key]:medians[j])-means[j])**2,0)/trainRows.length) || 1);
    const vector = row => usable.map((f,j)=>((isNumber(row[f.key])?row[f.key]:medians[j])-means[j])/scales[j]);
    const p=usable.length, size=p+1, a=Array.from({length:size},()=>Array(size).fill(0)), b=Array(size).fill(0);
    for (const row of trainRows) {
      const x=[1,...vector(row)], y=row[target];
      for(let i=0;i<size;i++){b[i]+=x[i]*y;for(let j=0;j<size;j++)a[i][j]+=x[i]*x[j];}
    }
    for(let i=1;i<size;i++)a[i][i]+=1e-8;
    for(let i=0;i<size;i++){
      let pivot=i;for(let j=i+1;j<size;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
      if(Math.abs(a[pivot][i])<1e-12)continue;
      [a[i],a[pivot]]=[a[pivot],a[i]];[b[i],b[pivot]]=[b[pivot],b[i]];
      const div=a[i][i];for(let j=i;j<size;j++)a[i][j]/=div;b[i]/=div;
      for(let k=0;k<size;k++)if(k!==i){const factor=a[k][i];for(let j=i;j<size;j++)a[k][j]-=factor*a[i][j];b[k]-=factor*b[i];}
    }
    const predictions=testRows.map(row=>({actual:row[target],predicted:b[0]+vector(row).reduce((s,v,i)=>s+v*b[i+1],0)}));
    const mean=testRows.reduce((s,r)=>s+r[target],0)/testRows.length;
    const sse=predictions.reduce((s,r)=>s+(r.actual-r.predicted)**2,0),sst=predictions.reduce((s,r)=>s+(r.actual-mean)**2,0);
    return {predictions,rmse:Math.sqrt(sse/predictions.length),r2:sst?1-sse/sst:NaN,features:usable.length,terms:usable.map(f=>f.name)};
  }
  function customEvaluation(target) {
    const rows=active.rows.filter(r=>isNumber(r[target])).map(r=>({...r}));
    if(rows.length<15)throw new Error('至少需要 15 筆目標欄位為數值的資料，才能進行訓練與交叉驗證。');
    const defs=[];
    for(const column of Object.keys(rows[0])){
      if(column===target)continue;
      const values=rows.map(r=>r[column]), nums=values.filter(isNumber), present=values.filter(v=>v!==''&&v!==null&&v!==undefined);
      if(nums.length>=Math.max(3,Math.ceil(rows.length*.7))){defs.push({name:column,key:column});continue;}
      const cats=[...new Set(present.map(String))].sort((a,b)=>a.localeCompare(b));
      if(cats.length>=2&&cats.length<=12){for(const cat of cats.slice(1)){const key=`__cat_${defs.length}`;rows.forEach((r,i)=>{r[key]=String(values[i])===cat?1:0;});defs.push({name:`${column} = ${cat}`,key});}}
    }
    if(!defs.length)throw new Error('找不到可用的數值或低類別數量特徵。');
    const shuffled=[...rows].sort(()=>0);let seed=42;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    const testCount=Math.max(1,Math.ceil(shuffled.length*.2)),testRows=shuffled.slice(0,testCount),trainRows=shuffled.slice(testCount);
    const test=regressionFit(trainRows,testRows,defs,target);
    const folds=Math.min(5,trainRows.length),foldRows=Array.from({length:folds},()=>[]);
    trainRows.forEach((row,i)=>foldRows[i%folds].push(row));
    const scores=[];
    for(let i=0;i<folds;i++){
      const valid=foldRows[i],fit=trainRows.filter(r=>!valid.includes(r));
      scores.push(regressionFit(fit,valid,defs,target));
    }
    return {rows:rows.length,testRows:test.predictions,rmse:test.rmse,r2:test.r2,cvRmse:scores.reduce((s,x)=>s+x.rmse,0)/folds,cvR2:scores.reduce((s,x)=>s+x.r2,0)/folds,features:test.features,terms:test.terms,target,folds};
  }
  function renderCustomCharts(predictions) {
    const W=620,H=340,L=58,R=18,T=20,B=48;
    const step=Math.max(1,Math.ceil(predictions.length/1000)),points=predictions.filter((_,i)=>i%step===0),actual=points.map(p=>p.actual),pred=points.map(p=>p.predicted),all=[...actual,...pred];
    let min=Math.min(...all),max=Math.max(...all);const pad=(max-min)*.08||1;min-=pad;max+=pad;
    const x=v=>L+(v-min)/(max-min)*(W-L-R),y=v=>H-B-(v-min)/(max-min)*(H-T-B);
    let s='';for(let i=0;i<5;i++){const v=min+(max-min)*i/4;s+=`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="#dce4d4" stroke-dasharray="3 5"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" fill="#647763" font-size="10">${v.toFixed(1)}</text><text x="${x(v)}" y="${H-B+18}" text-anchor="middle" fill="#647763" font-size="10">${v.toFixed(1)}</text>`;}
    s+=`<line x1="${x(min)}" y1="${y(min)}" x2="${x(max)}" y2="${y(max)}" stroke="#8a9c7a" stroke-dasharray="6 5"/>`;
    points.forEach(p=>s+=`<circle cx="${x(p.actual)}" cy="${y(p.predicted)}" r="3.8" fill="#4f7e5d" opacity=".72"><title>實際 ${p.actual}；預測 ${p.predicted.toFixed(3)}</title></circle>`);
    $('custom-actual-chart').innerHTML=`<svg class="custom-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="測試集實際與預測值散點圖">${s}<text x="${(L+W-R)/2}" y="${H-8}" text-anchor="middle" fill="#465b49" font-size="11">實際值</text><text x="15" y="${(T+H-B)/2}" transform="rotate(-90 15 ${(T+H-B)/2})" text-anchor="middle" fill="#465b49" font-size="11">預測值</text></svg>`;
    const residuals=predictions.map(p=>p.actual-p.predicted),lo=Math.min(...residuals),hi=Math.max(...residuals),bins=8,span=hi-lo||1,counts=Array(bins).fill(0);
    residuals.forEach(r=>counts[Math.min(bins-1,Math.floor((r-lo)/span*bins))]++);
    const bw=(W-L-R)/bins,bmax=Math.max(...counts,1);let h=`<line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#9aa998"/>`;
    counts.forEach((n,i)=>{const bh=n/bmax*(H-T-B);h+=`<rect x="${L+i*bw+2}" y="${H-B-bh}" width="${Math.max(1,bw-4)}" height="${bh}" rx="2" fill="#8ca982"><title>${n} 筆殘差</title></rect><text x="${L+i*bw+bw/2}" y="${H-B+17}" text-anchor="middle" fill="#647763" font-size="9">${(lo+(i+.5)*span/bins).toFixed(1)}</text>`;});
    $('custom-residual-chart').innerHTML=`<svg class="custom-svg" viewBox="0 ${0} ${W} ${H}" role="img" aria-label="測試集預測殘差分布">${h}<text x="${(L+W-R)/2}" y="${H-7}" text-anchor="middle" fill="#465b49" font-size="11">殘差（實際 − 預測）</text></svg>`;
  }
  function renderCorrelation(rows,target){
    const host=$('report-correlation');if(!host)return;
    const columns=numericColumns({rows}).slice(0,12);
    if(!columns.includes(target)&&columns.length>=12)columns[columns.length-1]=target;
    $('report-correlation-caption').textContent=`顯示 ${columns.length} 個數值欄位`;
    const corr=(a,b)=>{const pairs=rows.filter(r=>isNumber(r[a])&&isNumber(r[b]));if(pairs.length<2)return 0;const ma=pairs.reduce((s,r)=>s+r[a],0)/pairs.length,mb=pairs.reduce((s,r)=>s+r[b],0)/pairs.length,va=Math.sqrt(pairs.reduce((s,r)=>s+(r[a]-ma)**2,0)),vb=Math.sqrt(pairs.reduce((s,r)=>s+(r[b]-mb)**2,0));return va&&vb?pairs.reduce((s,r)=>s+(r[a]-ma)*(r[b]-mb),0)/(va*vb):0;};
    const color=v=>v>=0?`rgba(173,50,54,${.12+Math.abs(v)*.78})`:`rgba(60,105,157,${.12+Math.abs(v)*.78})`;
    host.innerHTML=`<div class="correlation-scroll"><table class="correlation-table"><thead><tr><th></th>${columns.map(c=>`<th title="${escapeHtml(c)}">${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${columns.map(a=>`<tr><th title="${escapeHtml(a)}">${escapeHtml(a)}</th>${columns.map(b=>{const v=corr(a,b);return`<td style="background:${color(v)}" title="${escapeHtml(a)} × ${escapeHtml(b)}：${v.toFixed(2)}">${v.toFixed(1)}</td>`}).join('')}</tr>`).join('')}</tbody></table></div><div class="correlation-legend"><span>−1 負相關</span><i></i><span>0</span><i class="warm"></i><span>+1 正相關</span></div>`;
  }
  function runCustomEvaluation() {
    const target=$('custom-target')?.value;
    if(!target){$('custom-eval-metrics').innerHTML='';$('custom-actual-chart').innerHTML='';$('custom-residual-chart').innerHTML='';$('custom-eval-meta').textContent='資料中找不到數值目標欄位。';$('custom-eval-error').textContent='至少需要一個數值欄位作為預測目標。';return;}
    const host=$('custom-evaluation');host.hidden=false;
    try{
      const r=customEvaluation(target);
      $('custom-eval-error').textContent='';
      const metric=value=>Number.isFinite(value)?value.toFixed(4):'無法計算';
      $('report-target-name').textContent=target;$('report-row-count').textContent=r.rows.toLocaleString();$('report-feature-count').textContent=r.features.toLocaleString();
      $('custom-eval-metrics').innerHTML=`<div><span>CV RMSE <small>越低越好</small></span><strong>${metric(r.cvRmse)}</strong><p>${r.folds} 折交叉驗證</p></div><div><span>CV R² <small>越高越好</small></span><strong>${metric(r.cvR2)}</strong><p>訓練資料內交叉驗證</p></div><div><span>Test RMSE</span><strong>${metric(r.rmse)}</strong><p>保留測試資料</p></div><div><span>Test R²</span><strong>${metric(r.r2)}</strong><p>保留測試資料</p></div>`;
      $('custom-eval-meta').textContent=`目標：${target} · ${r.rows.toLocaleString()} 筆有效資料 · ${r.features} 個特徵 · 測試集 ${r.testRows.length} 筆。交叉驗證與測試集採固定亂數切分。`;
      $('custom-model-terms').innerHTML=`<h3>模型使用的特徵</h3><p>${r.terms.map(escapeHtml).join('、')||'無'}。類別欄位以參考類別方式轉成指示變數；數值缺失以訓練資料中位數補值。</p>`;
      renderCustomCharts(r.testRows);
      renderCorrelation(active.rows.filter(row=>isNumber(row[target])),target);
    }catch(error){$('custom-eval-metrics').innerHTML='';$('custom-actual-chart').innerHTML='';$('custom-residual-chart').innerHTML='';$('custom-eval-meta').textContent='資料尚不足以計算評估指標。';$('custom-eval-error').textContent=`無法執行評估：${error.message}`;}
  }

  function renderDatasetReport() {
    const report = $('dataset-report');
    const startupSections = ['startup-stats', 'research', 'explore', 'evaluation', 'predict', 'reproduce', 'methodology'].map($).filter(Boolean);
    report.hidden = false;
    startupSections.forEach(section => { section.hidden = true; });
    $('site-footer').hidden = false;
    const footerEdition = $('site-footer')?.querySelector('.edition');
    if (footerEdition) footerEdition.textContent = `${active.name.toUpperCase()} / RESEARCH NOTE`;
    const targets=numericColumns(active), columns=Object.keys(active.rows[0]||{}), target=targets.includes(active.target)?active.target:(targets.at(-1)||'');
    const targetData=active.rows.filter(r=>isNumber(r[target]));
    const categorical=columns.filter(c=>!targets.includes(c)).length;
    report.innerHTML = `<div class="section-head"><div><div class="eyebrow">01 / RESEARCH FRAMEWORK</div><h2>${escapeHtml(active.name)} 的 CRISP-DM 研究結果。</h2></div><p>每份資料都使用相同的研究、特徵選擇、模型評估與預測版面；下方所有摘要和圖表均由目前資料重新計算。</p></div><div class="process"><article><b>01</b><h3>商業理解</h3><p>以所選數值欄位為預測目標，檢視可用特徵與目標之間的關聯。</p></article><article><b>02</b><h3>資料理解</h3><p>${active.rows.length.toLocaleString()} 筆、${columns.length} 欄；${targets.length} 個數值欄位與 ${categorical} 個類別欄位，檢查缺失值與欄位分布。</p></article><article><b>03</b><h3>資料準備</h3><p>使用固定亂數切分訓練與測試資料；缺失數值以訓練集中位數補值，低基數類別欄位轉成指示變數。</p></article><article><b>04</b><h3>模型建立</h3><p>依目前資料動態建立可用特徵，以多元線性迴歸進行特徵選擇與預測。</p></article><article><b>05</b><h3>模型評估</h3><p>使用訓練資料五折交叉驗證及保留測試集，比較 RMSE、R²、實際預測值和殘差。</p></article><article><b>06</b><h3>部署應用</h3><p>切換或載入 CSV 後，重新計算整份報告；自訂資料只在目前瀏覽器中處理。</p></article></div><div class="metric-grid dataset-metrics"><div><span>預測目標</span><strong id="report-target-name">${escapeHtml(target||'無數值欄位')}</strong><p>可由下方選單切換</p></div><div><span>有效樣本</span><strong id="report-row-count">${targetData.length.toLocaleString()}</strong><p>目標欄位為數值的資料列</p></div><div><span>特徵數</span><strong id="report-feature-count">—</strong><p>模型實際使用欄位</p></div><div><span>缺失值</span><strong>${missingCount(active).toLocaleString()}</strong><p>整份資料欄位合計</p></div></div><div class="dataset-controls panel custom-target-controls"><label for="custom-target"><span class="label">預測目標欄位</span><select id="custom-target">${targets.map(c=>`<option value="${escapeHtml(c)}"${c===target?' selected':''}>${escapeHtml(c)}</option>`).join('')}</select></label><p>切換目標欄位後，評估指標和圖表會依目前資料重新計算。</p><p id="custom-eval-error" role="status" aria-live="polite"></p></div><section id="custom-evaluation" class="custom-evaluation"><div class="section-head"><div><div class="eyebrow">MODEL EVALUATION</div><h2>模型表現與預測診斷</h2></div><p id="custom-eval-meta"></p></div><div class="metric-grid dataset-metrics" id="custom-eval-metrics"></div><div class="chart-pair custom-chart-pair"><article class="panel"><div class="chart-title"><h3>實際值與預測值</h3><span>保留測試集</span></div><div id="custom-actual-chart" class="custom-chart-host"></div></article><article class="panel"><div class="chart-title"><h3>測試集殘差分布</h3><span>實際 − 預測</span></div><div id="custom-residual-chart" class="custom-chart-host"></div></article><article class="panel"><div class="chart-title"><h3>數值欄位相關性</h3><span id="report-correlation-caption"></span></div><div id="report-correlation" class="correlation-grid-host"></div></article></div><div class="panel dataset-report-note" id="custom-model-terms"></div><p class="note">所有資料集均使用相同評估流程；指標、模型特徵、相關性和預測圖均由目前載入的資料計算。</p></section>`;
    $('custom-target').addEventListener('change', event => { active.target=event.target.value; runCustomEvaluation(); });
    runCustomEvaluation();
  }

  function parseDelimited(text) {
    const first = text.split(/\r?\n/, 1)[0] || '';
    const delimiter = first.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ',';
    const matrix = [[]]; let field = '', quote = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i], next = text[i+1];
      if (char === '"' && quote && next === '"') { field += '"'; i++; }
      else if (char === '"') quote = !quote;
      else if (char === delimiter && !quote) { matrix.at(-1).push(field); field = ''; }
      else if ((char === '\n' || char === '\r') && !quote) { if (char === '\r' && next === '\n') i++; matrix.at(-1).push(field); field = ''; matrix.push([]); }
      else field += char;
    }
    if (field || matrix.at(-1).length) matrix.at(-1).push(field);
    const clean = matrix.filter(row => row.some(value => value.trim() !== ''));
    if (clean.length < 2) throw new Error('CSV 至少需要一列欄名與一列資料。');
    const headers = clean[0].map((header, index) => (header.trim() || `column_${index+1}`).replace(/^\uFEFF/, ''));
    const unique = headers.map((header, index) => headers.indexOf(header) === index ? header : `${header}_${index+1}`);
    const rows = clean.slice(1).map(row => Object.fromEntries(unique.map((header, index) => {
      const value = (row[index] || '').trim();
      const number = Number(value.replace(/,/g, ''));
      return [header, value !== '' && Number.isFinite(number) ? number : value];
    })));
    return {headers: unique, rows};
  }
  function loadText(text, filename, source) {
    try {
      const content = String(text).replace(/^\uFEFF/, '');
      if (/^\s*<(?:!doctype\s+html|html|head|body)\b/i.test(content)) throw new Error('網址回傳的是網頁，不是 CSV。請貼上 CSV 原始檔的直接連結。');
      const parsed = parseDelimited(content);
      if (!parsed.headers.length || !parsed.rows.length) throw new Error('找不到可用的欄位或資料列。');
      if (customUrl) URL.revokeObjectURL(customUrl);
      const blob = new Blob([content], {type: 'text/csv;charset=utf-8'});
      customUrl = URL.createObjectURL(blob);
      const target = [...parsed.headers].reverse().find(column => parsed.rows.some(row => isNumber(row[column]))) || parsed.headers.at(-1);
      active = {id: 'custom', name: filename, source, description: `已載入 ${filename}。可用下方 X、Y 選單檢視數值欄位關係。`, target, rows: parsed.rows};
      render();
      return true;
    } catch (error) {
      $('dataset-status').textContent = `無法讀取資料：${error.message}`;
      return false;
    }
  }
  function loadFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => loadText(String(event.target.result), file.name, '本機檔案（僅於瀏覽器讀取）');
    reader.onerror = () => { $('dataset-status').textContent = '無法讀取檔案，請確認檔案格式後重試。'; };
    reader.readAsText(file, 'utf-8');
  }
  async function loadUrl() {
    const input = $('dataset-url'), button = $('load-dataset-url'), raw = input.value.trim();
    if (!raw) { $('dataset-status').textContent = '請先貼上 CSV 網址。'; input.focus(); return; }
    let url;
    try { url = new URL(raw); if (!['https:', 'http:'].includes(url.protocol)) throw new Error(); }
    catch { $('dataset-status').textContent = '請輸入有效的 http 或 https 網址。'; input.focus(); return; }
    button.disabled = true;
    $('dataset-status').textContent = '正在讀取網址中的資料…';
    try {
      const response = await fetch(url.href, {mode: 'cors'});
      if (!response.ok) throw new Error(`伺服器回應 ${response.status}。`);
      const text = await response.text();
      const filename = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'dataset.csv').replace(/[?#].*$/, '');
      const loaded = loadText(text, filename, `網址資料 · ${url.hostname}`);
      if (loaded) $('dataset-select').value = 'custom';
    } catch (error) {
      const detail = error instanceof TypeError ? '瀏覽器無法直接讀取此網站（可能限制跨網站存取）。請下載 CSV 後使用「從電腦選取 CSV」。' : error.message;
      $('dataset-status').textContent = `網址載入失敗：${detail}`;
    } finally { button.disabled = false; }
  }
  $('dataset-select').addEventListener('change', event => {
    const chosen=event.target.value;
    if(chosen==='local'||chosen==='url'){$('dataset-source-panel').hidden=false;$('local-source').hidden=chosen!=='local';$('url-source').hidden=chosen!=='url';return;}
    if(chosen==='custom')return;
    if (customUrl) { URL.revokeObjectURL(customUrl); customUrl = null; }
    active = {...datasets[chosen], id: chosen};render();
  });
  $('choose-dataset-file').addEventListener('click',()=> $('dataset-file').click());
  $('dataset-file').addEventListener('change', event => {if(event.target.files[0])loadFile(event.target.files[0]);else $('dataset-select').value=active.id;} );
  $('load-dataset-url').addEventListener('click', loadUrl);
  $('dataset-url').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); loadUrl(); } });
  $('dataset-x').addEventListener('change', () => scatter(active.rows, $('dataset-x').value, $('dataset-y').value));
  $('dataset-y').addEventListener('change', () => scatter(active.rows, $('dataset-x').value, $('dataset-y').value));
  render();
})();
