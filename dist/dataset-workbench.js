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
