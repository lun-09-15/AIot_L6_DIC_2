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
  function scatter(rows, xKey, yKey) {
    const points = rows.filter(row => isNumber(row[xKey]) && isNumber(row[yKey])).map(row => ({x: row[xKey], y: row[yKey]}));
    const host = $('dataset-chart');
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

  function renderDatasetReport() {
    const report = $('dataset-report');
    const startupSections = ['startup-stats', 'research', 'explore', 'evaluation', 'predict'].map($).filter(Boolean);
    const isStartup = active.id === 'startups';
    report.hidden = isStartup;
    startupSections.forEach(section => { section.hidden = !isStartup; });
    $('site-footer').hidden = !isStartup;
    if (isStartup) return;
    if (active.id === 'boston') {
      report.innerHTML = `<div class="section-head"><div><div class="eyebrow">01–04 / BOSTON HOUSING REPORT</div><h2>Boston Housing 的 CRISP-DM 研究結果。</h2></div><p>此區會隨資料集切換；不沿用 50 Startups 的研究敘述或模型指標。</p></div><div class="process"><article><b>01</b><h3>商業理解</h3><p>以 MEDV（自有住宅價格中位數，千美元）為目標，探索住宅、區位與社經條件的關聯。</p></article><article><b>02</b><h3>資料理解</h3><p>506 筆、14 欄數值資料；包含 CRIM、RM、LSTAT 與 MEDV，無缺失值。</p></article><article><b>03</b><h3>資料準備</h3><p>固定 80/20 切分，訓練資料內標準化；所有欄位均為數值特徵。</p></article><article><b>04</b><h3>模型建立</h3><p>比較 Forward、Backward、RFE、SelectKBest 與 Lasso 五種特徵選擇方法。</p></article><article><b>05</b><h3>模型評估</h3><p>以 5-fold CV 選模，再使用保留測試集衡量 RMSE 與 R²。</p></article><article><b>06</b><h3>部署應用</h3><p>保留可重跑的 Python 程式、模型、比較表與圖表，供後續檢視與重現。</p></article></div><div class="metric-grid dataset-metrics"><div><span>最佳方法</span><strong>RFE</strong><p>依交叉驗證結果選定</p></div><div><span>Test RMSE</span><strong>5.7814</strong><p>MEDV 的原始單位</p></div><div><span>Test R²</span><strong>0.5895</strong><p>保留測試資料</p></div><div><span>資料規模</span><strong>506 × 14</strong><p>樣本數 × 欄位數</p></div></div><div class="chart-pair boston-figures"><article class="panel"><div class="chart-title"><h3>特徵相關性</h3><span>14 個數值欄位</span></div><div id="boston-heatmap" class="boston-chart-host"></div></article><article class="panel"><div class="chart-title"><h3>交叉驗證 RMSE</h3><span>依特徵數比較四種方法</span></div><div id="boston-cv-rmse" class="boston-chart-host"></div></article><article class="panel"><div class="chart-title"><h3>交叉驗證 R²</h3><span>依特徵數比較四種方法</span></div><div id="boston-cv-r2" class="boston-chart-host"></div></article><article class="panel"><div class="chart-title"><h3>最終模型比較</h3><span>Test RMSE（千美元）</span></div><div id="boston-models" class="boston-chart-host"></div></article><article class="panel"><div class="chart-title"><h3>實際值與預測值</h3><span>RFE 保留測試集</span></div><div id="boston-predictions" class="boston-chart-host"></div></article><article class="panel"><div class="chart-title"><h3>RFE 特徵係數</h3><span>11 個保留特徵</span></div><div id="boston-coefficients" class="boston-chart-host"></div></article></div><div class="panel dataset-report-note"><h3>完整 Boston Housing 分析</h3><p>完整的特徵選擇比較、係數、預測與圖表已收錄於專案的 <code>boston-housing/</code> 資料夾。</p></div>`;
      renderBostonCharts();
    } else {
      report.innerHTML = `<div class="section-head"><div><div class="eyebrow">CUSTOM DATASET</div><h2>${escapeHtml(active.name)} 的資料檢視。</h2></div><p>此檔案只在瀏覽器本機讀取，尚未執行預先訓練的回歸模型。</p></div><div class="panel dataset-report-note"><h3>下一步</h3><p>可使用上方欄位選單探索數值關係與資料預覽。若要建立 CRISP-DM 模型，需要另外指定目標欄位、資料切分與驗證流程。</p></div>`;
    }
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
  function loadFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = parseDelimited(String(event.target.result));
        if (customUrl) URL.revokeObjectURL(customUrl);
        customUrl = URL.createObjectURL(file);
        active = {id: 'custom', name: file.name, source: '本機檔案（僅於瀏覽器讀取）', description: `已從你的電腦載入 ${file.name}。可用下方 X、Y 選單檢視數值欄位關係。`, target: parsed.headers.at(-1), rows: parsed.rows};
        render();
      } catch (error) { $('dataset-status').textContent = `無法讀取檔案：${error.message}`; }
    };
    reader.readAsText(file, 'utf-8');
  }
  $('load-dataset').addEventListener('click', () => {
    const chosen = $('dataset-select').value;
    if (chosen === 'custom') { $('dataset-file').click(); return; }
    if (customUrl) { URL.revokeObjectURL(customUrl); customUrl = null; }
    active = {...datasets[chosen], id: chosen};
    render();
  });
  $('dataset-file').addEventListener('change', event => loadFile(event.target.files[0]));
  $('dataset-x').addEventListener('change', () => scatter(active.rows, $('dataset-x').value, $('dataset-y').value));
  $('dataset-y').addEventListener('change', () => scatter(active.rows, $('dataset-x').value, $('dataset-y').value));
  render();
})();
