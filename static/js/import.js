// W1b: Tier-B file import (OFX/QIF/CSV) for the Expense Tracker.
// Adds an "Import" entry to the Share menu. Parses bank-export files into a
// normalized transaction list, lets the user assign a category to each group
// of similar transactions (remembered for next time via a small persisted
// keyword->category map), then sums the spending per (month, category) into a
// dedicated "Imported" column — auditable, and never overwrites manual entries.
// Everything is written into the existing `state` and routed through the
// existing save()/render(), so it picks up undo/redo, sync, and the W3
// versioned-save/merge flow for free.
(function(){
  'use strict';

  const MAX_SEEN = 4000;
  const IMPORT_COL_LABEL = 'Imported';

  // ── Persisted helpers (plain localStorage; not part of the synced blob — these
  //    are import-assistant memory, not financial data) ──────────────────────
  // Keyed per-account (window.__currentUser, set by the tracker's startup IIFE
  // before the wizard can be opened) — otherwise two accounts sharing the same
  // browser would see each other's "already imported" memory as false positives.
  function _seenKey(){ return 'fiapp_import_seen_v1_'+(window.__currentUser||'anon'); }
  function _mapKey(){ return 'fiapp_import_catmap_v1_'+(window.__currentUser||'anon'); }
  function loadSeen(){ try{ return new Set(JSON.parse(localStorage.getItem(_seenKey())||'[]')); }catch(_){ return new Set(); } }
  function saveSeen(set){
    let arr=[...set];
    if(arr.length>MAX_SEEN) arr=arr.slice(arr.length-MAX_SEEN);
    try{ localStorage.setItem(_seenKey(), JSON.stringify(arr)); }catch(_){}
  }
  function loadCatMap(){ try{ const m=JSON.parse(localStorage.getItem(_mapKey())||'{}'); return (m&&typeof m==='object')?m:{}; }catch(_){ return {}; } }
  function saveCatMap(map){ try{ localStorage.setItem(_mapKey(), JSON.stringify(map)); }catch(_){} }

  // Income-specific catmap — kept separate so "PAYROLL" → "Salary" memory never
  // collides with an expense category of the same keyword.
  const INCOME_STORAGE_KEY='fiapp_income_v1';
  const INCOME_DEFAULT_ROWS=['Salary','Freelance','Investments','Other Income'];
  const INCOME_CAT_COLORS={'Salary':'#bbf7d0','Freelance':'#bfdbfe','Investments':'#fed7aa','Other Income':'#e9d5ff'};
  const IMPORT_CURRENCIES=['USD','EUR','GBP','CHF','CAD','AUD','JPY','NZD','SEK','NOK','DKK','HKD','SGD','CNY','INR'];
  function _incomeMapKey(){ return 'fiapp_import_income_catmap_v1_'+(window.__currentUser||'anon'); }
  function loadIncomeCatMap(){ try{ const m=JSON.parse(localStorage.getItem(_incomeMapKey())||'{}'); return (m&&typeof m==='object')?m:{}; }catch(_){ return {}; } }
  function saveIncomeCatMap(map){ try{ localStorage.setItem(_incomeMapKey(),JSON.stringify(map)); }catch(_){} }

  function fingerprint(t){ return t.date+'|'+t.amount.toFixed(2)+'|'+t.description.trim().toLowerCase(); }
  function keywordFor(desc){
    const w=(desc||'').trim().toUpperCase().split(/[\s,.\-#*\/]+/).filter(Boolean)[0];
    return w||'(unknown)';
  }
  function mkBtn(text,cls,onClick){
    const b=document.createElement('button'); b.className=cls; b.textContent=text;
    b.addEventListener('click',onClick);
    return b;
  }

  // ── Format detection ─────────────────────────────────────────────────────
  function detectFormat(filename,text){
    const lower=(filename||'').toLowerCase();
    if(/\.(ofx|qfx)$/.test(lower)||/<OFX>/i.test(text)) return 'ofx';
    if(/\.qif$/.test(lower)||/^\s*!Type:/m.test(text)) return 'qif';
    return 'csv';
  }

  // ── OFX parser ───────────────────────────────────────────────────────────
  // OFX is SGML-ish — tags are commonly left unclosed — so we extract each
  // <STMTTRN> block by regex and pull fields out of it rather than using an
  // XML parser (which would choke on the malformed markup real exports use).
  function parseOFX(text){
    const out=[];
    const blocks=text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|<\/STMTTRN>|$)/gi)||[];
    blocks.forEach(b=>{
      const get=function(tag){ const m=b.match(new RegExp('<'+tag+'>\\s*([^<\\r\\n]*)','i')); return m?m[1].trim():''; };
      const dt=get('DTPOSTED');
      const amtStr=get('TRNAMT');
      const name=get('NAME')||get('PAYEE')||get('MEMO');
      if(!dt||!amtStr) return;
      const amt=parseFloat(amtStr.replace(/,/g,''));
      if(isNaN(amt)) return;
      const ymd=dt.match(/^(\d{4})(\d{2})(\d{2})/); // DTPOSTED like 20240315 or 20240315120000[-5:EST]
      if(!ymd) return;
      out.push({ date:ymd[1]+'-'+ymd[2]+'-'+ymd[3], amount:Math.abs(amt), sign:amt<0?'debit':'credit', description:name||'(no description)' });
    });
    return out;
  }

  // ── QIF parser ───────────────────────────────────────────────────────────
  function parseQIF(text){
    const out=[];
    const recs=text.split(/\r?\n\^\r?\n?/);
    recs.forEach(rec=>{
      const lines=rec.split(/\r?\n/);
      let date='',amount=null,payee='',memo='';
      lines.forEach(line=>{
        const code=line.charAt(0), val=line.slice(1).trim();
        if(code==='D') date=val;
        else if(code==='T'||code==='U') amount=parseFloat(val.replace(/,/g,''));
        else if(code==='P') payee=val;
        else if(code==='M') memo=memo||val;
      });
      if(!date||amount===null||isNaN(amount)) return;
      const iso=parseLooseDate(date);
      if(!iso) return;
      out.push({ date:iso, amount:Math.abs(amount), sign:amount<0?'debit':'credit', description:payee||memo||'(no description)' });
    });
    return out;
  }
  // QIF dates are typically MM/DD/YYYY (or MM/DD'YY); guard against the rare
  // file that's clearly DD/MM by checking whether the first part can be a month.
  function parseLooseDate(s){
    const m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.'](\d{2,4})/);
    if(!m) return null;
    let a=+m[1],b=+m[2],y=+m[3];
    if(y<100) y+=(y<70?2000:1900);
    let mo=a,d=b;
    if(a>12&&b<=12){ mo=b; d=a; }
    if(mo<1||mo>12||d<1||d>31) return null;
    return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }

  // ── CSV parser (handles quoted fields with embedded commas/newlines) ────
  function parseCSVText(text){
    const rows=[];
    let row=[],field='',inQuotes=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(inQuotes){
        if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQuotes=false; }
        else field+=c;
      } else {
        if(c==='"') inQuotes=true;
        else if(c===','){ row.push(field); field=''; }
        else if(c==='\n'){ row.push(field); rows.push(row); row=[]; field=''; }
        else if(c==='\r'){ /* skip — \n follows in CRLF */ }
        else field+=c;
      }
    }
    if(field.length||row.length){ row.push(field); rows.push(row); }
    return rows.filter(r=>r.length>1||(r[0]!==undefined&&r[0]!==''));
  }

  function applySignConvention(amount,convention){
    // 'neg-spend' (default): negative amounts represent spending — what most
    // bank/card exports do. 'pos-spend': positive amounts represent spending
    // (common for exports that already show spend as a positive "debit" figure).
    if(convention==='pos-spend') return { amount:Math.abs(amount), sign:amount>=0?'debit':'credit' };
    return { amount:Math.abs(amount), sign:amount<=0?'debit':'credit' };
  }

  function parseDateWithFormat(raw,fmt){
    const s=(raw||'').trim();
    const m=s.match(/^(\d{1,2}|\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);
    if(!m) return null;
    let y,mo,d;
    if(fmt==='YMD'){ y=+m[1]; mo=+m[2]; d=+m[3]; }
    else if(fmt==='DMY'){ d=+m[1]; mo=+m[2]; y=+m[3]; }
    else { mo=+m[1]; d=+m[2]; y=+m[3]; } // MDY
    if(y<100) y+=(y<70?2000:1900);
    if(mo<1||mo>12||d<1||d>31) return null;
    return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }

  // ── Category guessing ────────────────────────────────────────────────────
  // Linked rows (e.g. "Subscriptions") render every cell as a live computed
  // total from the Subscriptions tracker (virtualSubChildren()) — they never
  // read from state.cells. Writing imported amounts into one is a silent
  // black hole: the value is stored but can never be displayed or totaled.
  // So these rows must never be offered as import targets.
  function _isLinkedRow(r){ return !!(r&&(r.linked==='subscriptions'||r.snapshotLinkedRow)); }
  function buildCategoryOptions(){
    const set=new Set(CAT_KEYS);
    Object.values(state.rowsByMonth||{}).forEach(rows=>rows.forEach(r=>{ if(!r.parentId&&r.label&&!_isLinkedRow(r)) set.add(r.label); }));
    (state.rows||[]).forEach(r=>{ if(!r.parentId&&r.label&&!_isLinkedRow(r)) set.add(r.label); });
    return [...set].sort((a,b)=>a.localeCompare(b));
  }
  function guessCategory(keyword,sample,catMap){
    const rows=getRows(currentMK());
    if(catMap[keyword]){
      // Ignore stale remembered mappings that point at a linked row (e.g. an
      // older import once recorded "Subscriptions" before that became
      // unavailable as a target) — re-guess instead of proposing it again.
      const mappedRow=rows.find(function(r){ return !r.parentId&&r.label===catMap[keyword]; });
      if(!mappedRow||!_isLinkedRow(mappedRow)) return catMap[keyword];
    }
    const hay=(sample||'').toLowerCase();
    for(const r of rows){ if(!r.parentId&&r.label&&!_isLinkedRow(r)&&hay.includes(r.label.toLowerCase())) return r.label; }
    for(const cat of CAT_KEYS){
      const subs=CATEGORIES[cat]||[];
      if(subs.some(s=>hay.includes(s.toLowerCase()))) return cat;
    }
    return '';
  }
  // Looks for an existing tracked subscription whose service name appears in the
  // transaction description. Used to warn the user that an imported group may
  // duplicate something already billed via the Subscriptions tracker.
  //
  // Note: linked-subscription rows shown inside the expense tracker (e.g.
  // "Netflix" under "Subscriptions") are *virtual* — computed at render time by
  // virtualSubChildren() directly from the Subscriptions tracker's own data, and
  // never exist as real entries in getRows()/state.rows. So the source of truth
  // for "what subscriptions does this user track" is the Subscriptions tracker's
  // own blob, read the same way virtualSubChildren() does (via loadSubsState()
  // and its text-type "service name" column) — not the expense tracker's rows.
  function guessIncomeCategory(keyword,sample,catMap){
    if(catMap[keyword]) return catMap[keyword];
    const hay=(sample||'').toLowerCase();
    const hints={
      'Salary':      ['payroll','salary','wages','direct dep','employer'],
      'Freelance':   ['freelance','consulting','invoice','client','gig'],
      'Investments': ['dividend','capital gain','rental','interest','vanguard','fidelity','schwab'],
      'Other Income':['refund','reimbursement','gift','tax return','cashback']
    };
    for(const cat of Object.keys(hints)){
      if(hints[cat].some(function(s){ return hay.includes(s); })) return cat;
    }
    return '';
  }

  function buildIncomeCategoryOptions(){
    try{
      const blob=JSON.parse(localStorage.getItem(INCOME_STORAGE_KEY)||'null');
      if(blob&&Array.isArray(blob.rows)){
        const labels=blob.rows.filter(function(r){ return !r.parentId&&r.label; }).map(function(r){ return r.label; });
        if(labels.length) return labels.sort(function(a,b){ return a.localeCompare(b); });
      }
    }catch(_){}
    return INCOME_DEFAULT_ROWS.slice().sort();
  }

  function findLinkedSubscriptionMatch(sample){
    const hay=(sample||'').toLowerCase();
    if(!hay) return null;
    const subs=(typeof loadSubsState==='function')?loadSubsState():null;
    if(!subs||!Array.isArray(subs.rows)||!Array.isArray(subs.cols)) return null;
    const svcCol=subs.cols.find(function(c){ return c.ctype==='text'; });
    if(!svcCol) return null;
    for(const r of subs.rows){
      const label=subs.cells&&subs.cells[r.id+'|'+svcCol.id];
      if(label&&hay.includes(String(label).toLowerCase())) return String(label);
    }
    return null;
  }
  // When the chosen mapping settings produce zero matching transactions, inspect
  // the sample rows that ARE there and suggest the specific setting that's likely
  // wrong — rather than a generic "double-check your choices" dead end.
  function diagnoseMismatch(rows,skip,dateCol,amtCol,fmt,sign,creditCol){
    const tips=[];
    const sample=rows.slice(skip,skip+30).filter(function(r){ return r&&r.some(function(c){ return String(c||'').trim(); }); });
    if(!sample.length) return tips;

    const fmtNames={MDY:'MM/DD/YYYY (US)',DMY:'DD/MM/YYYY',YMD:'YYYY-MM-DD'};
    const counts={MDY:0,DMY:0,YMD:0};
    sample.forEach(function(r){
      Object.keys(counts).forEach(function(f){ if(parseDateWithFormat(r[dateCol],f)) counts[f]++; });
    });
    if(counts[fmt]<sample.length*0.5){
      const better=Object.keys(counts).filter(function(f){ return f!==fmt; })
        .sort(function(a,b){ return counts[b]-counts[a]; })[0];
      if(better&&counts[better]>counts[fmt]){
        tips.push('The dates in column '+(dateCol+1)+" don't look like "+fmtNames[fmt]+' — try "'+fmtNames[better]+'" instead.');
      }
    }

    if(creditCol<0){
      let pos=0,neg=0;
      sample.forEach(function(r){
        const v=parseFloat(String(r[amtCol]||'').replace(/[^0-9.\-]/g,''));
        if(!isNaN(v)){ if(v<0) neg++; else if(v>0) pos++; }
      });
      if(pos&&!neg&&sign==='neg-spend'){
        tips.push('Every amount in column '+(amtCol+1)+' looks positive — try "Positive amounts are spending" instead.');
      } else if(neg&&!pos&&sign==='pos-spend'){
        tips.push('Every amount in column '+(amtCol+1)+' looks negative — try "Negative amounts are spending" instead.');
      }
    }
    return tips;
  }

  // ── Wizard state machine ─────────────────────────────────────────────────
  let _wiz=null;

  function openImportWizard(){
    if(_isClosedMonth(currentMK())){ showToast('🔒 This month is locked — switch to an open month before importing.'); return; }
    if(localStorage.getItem('fiapp_template_dismissed')!=='1' && Object.keys(state.cells||{}).length===0 && getRows().length===0){
      showToast('Choose a starting template (or "Start blank") before importing.');
      return;
    }
    _wiz={ step:'pick', catMap:loadCatMap(), incomeCatMap:loadIncomeCatMap(), importCurrency:'USD' };
    const overlay=document.createElement('div'); overlay.className='share-overlay';
    const modal=document.createElement('div'); modal.className='share-modal'; modal.style.maxWidth='640px';
    overlay.appendChild(modal);
    overlay.addEventListener('click',function(e){ if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    _wiz.overlay=overlay; _wiz.modal=modal;
    renderWizStep();
  }

  function renderWizStep(){
    const m=_wiz.modal;
    m.innerHTML='';
    const h=document.createElement('h3'); h.textContent='Import transactions';
    m.appendChild(h);
    if(_wiz.step==='pick') renderPickStep(m);
    else if(_wiz.step==='map') renderMapStep(m);
    else if(_wiz.step==='review') renderReviewStep(m);
    else if(_wiz.step==='done') renderDoneStep(m);
  }

  // Step 1 — choose a file; OFX/QIF go straight to parsing, CSV needs mapping.
  function renderPickStep(m){
    const desc=document.createElement('p'); desc.className='share-hint';
    desc.textContent='Import spending from a bank export (.ofx, .qfx, .qif) or a spreadsheet (.csv). Imports are summed per category into a dedicated "Imported" column — your manual entries are never changed.';
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.ofx,.qfx,.qif,.csv,text/csv';
    const status=document.createElement('div'); status.className='paste-status'; status.textContent='No file selected.';
    const actions=document.createElement('div'); actions.className='share-actions';
    actions.appendChild(mkBtn('Cancel','btn btn-sm btn-ghost',function(){ _wiz.overlay.remove(); }));

    inp.addEventListener('change',async function(){
      const f=inp.files&&inp.files[0];
      if(!f) return;
      if(f.size>5*1024*1024){ status.textContent='⚠ That file is too large for an import (max 5 MB).'; status.className='paste-status bad'; return; }
      status.textContent='Reading…'; status.className='paste-status';
      let text;
      try{ text=await f.text(); }
      catch(e){ status.textContent='⚠ Could not read that file.'; status.className='paste-status bad'; return; }

      // Reject binary files (e.g. .xlsx, .png) early: decoding non-text bytes as
      // UTF-8 produces U+FFFD replacement characters, which a genuine .csv/.ofx/
      // .qfx/.qif export will never contain. Catching it here avoids showing the
      // user a garbled column preview for a format we can't parse anyway.
      if(/�/.test(text)){
        status.textContent='⚠ That file doesn’t look like a text export — FiApp can only import .csv, .ofx, .qfx or .qif files. If this is a spreadsheet, export/save it as CSV first.';
        status.className='paste-status bad';
        return;
      }

      const fmt=detectFormat(f.name,text);
      _wiz.format=fmt;
      if(fmt==='csv'){
        const rows=parseCSVText(text);
        if(rows.length<2){ status.textContent='⚠ That CSV has no data rows.'; status.className='paste-status bad'; return; }
        // Reject text that parses but isn't tabular transaction data (code,
        // templates, prose, ...). A real export has a consistent column count
        // across its rows — at least 2 columns, shared by most non-blank lines.
        // Free-form text mostly parses into single-column, wildly varying rows.
        const lenCounts={}; let nonBlank=0;
        rows.forEach(function(r){
          if(!r||r.every(function(c){ return !String(c||'').trim(); })) return;
          nonBlank++;
          lenCounts[r.length]=(lenCounts[r.length]||0)+1;
        });
        let modeLen=0,modeCount=0;
        Object.keys(lenCounts).forEach(function(len){ if(lenCounts[len]>modeCount){ modeCount=lenCounts[len]; modeLen=+len; } });
        if(nonBlank<2||modeLen<2||modeCount/nonBlank<0.7){
          status.textContent='⚠ That doesn’t look like tabular transaction data — FiApp expects a CSV with consistent columns for date, description, and amount.';
          status.className='paste-status bad';
          return;
        }
        _wiz.csvRows=rows;
        _wiz.step='map'; renderWizStep();
        return;
      }
      let txns;
      try{ txns=(fmt==='ofx')?parseOFX(text):parseQIF(text); }
      catch(e){ status.textContent='⚠ Could not parse that file — is it a valid '+fmt.toUpperCase()+' export?'; status.className='paste-status bad'; return; }
      const incomeTxnsOfx=txns.filter(function(t){ return t.sign==='credit'; });
      txns=txns.filter(function(t){ return t.sign==='debit'; });
      if(!txns.length&&!incomeTxnsOfx.length){ status.textContent='⚠ No transactions were found in that file.'; status.className='paste-status bad'; return; }
      finishParsing(txns,incomeTxnsOfx,0);
    });

    m.appendChild(desc); m.appendChild(inp); m.appendChild(status); m.appendChild(actions);
    setTimeout(function(){ inp.focus(); },20);
  }

  // Step 2 (CSV only) — preview rows, map columns, pick date format + sign convention.
  function renderMapStep(m){
    const rows=_wiz.csvRows;
    const previewRows=rows.slice(0,Math.min(6,rows.length));
    let ncols=1;
    rows.slice(0,20).forEach(function(r){ if(r.length>ncols) ncols=r.length; });

    const desc=document.createElement('p'); desc.className='share-hint';
    desc.textContent='Tell FiApp which columns hold the date, amount, and description, and how this file represents spending.';

    const tableWrap=document.createElement('div');
    tableWrap.style.cssText='overflow-x:auto;border:1px solid var(--panel-border);border-radius:6px;margin:.4rem 0;';
    const tbl=document.createElement('table'); tbl.style.cssText='border-collapse:collapse;font-size:.78rem;width:100%;';
    previewRows.forEach(function(r,ri){
      const tr=document.createElement('tr');
      for(let c=0;c<ncols;c++){
        const cell=document.createElement(ri===0?'th':'td');
        cell.textContent=(r[c]!==undefined)?r[c]:'';
        cell.style.cssText='padding:.3rem .5rem;border:1px solid var(--panel-border);white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;'+(ri===0?'background:var(--secondary-bg);font-weight:600;':'');
        tr.appendChild(cell);
      }
      tbl.appendChild(tr);
    });
    tableWrap.appendChild(tbl);

    const grid=document.createElement('div');
    grid.style.cssText='display:grid;grid-template-columns:auto 1fr;gap:.45rem .6rem;align-items:center;font-size:.85rem;margin-top:.4rem;';
    function lbl(t){ const s=document.createElement('span'); s.textContent=t; return s; }
    function selStyle(sel){ sel.style.cssText='padding:.35rem;border:1px solid var(--input-border);border-radius:5px;background:var(--input-bg);color:var(--fg);font-size:.85rem;'; return sel; }
    function colSelect(){
      const sel=selStyle(document.createElement('select'));
      for(let c=0;c<ncols;c++){
        const o=document.createElement('option'); o.value=String(c);
        const sample=(previewRows[0]&&previewRows[0][c])?(': "'+String(previewRows[0][c]).slice(0,24)+'"'):'';
        o.textContent='Column '+(c+1)+sample;
        sel.appendChild(o);
      }
      return sel;
    }

    const headerRow=(previewRows[0]||[]).map(function(s){ return String(s||'').toLowerCase(); });
    function guess(words){
      for(let c=0;c<headerRow.length;c++){ if(words.some(function(w){ return headerRow[c].indexOf(w)>=0; })) return c; }
      return -1;
    }
    const dateSel=colSelect(), amtSel=colSelect(), descSel=colSelect();
    const gDate=guess(['date']), gAmt=guess(['amount','amt','value','debit','money out','withdrawal']), gDesc=guess(['description','desc','memo','payee','merchant','narrative','name']);
    dateSel.value=String(gDate>=0?gDate:0);
    amtSel.value=String(gAmt>=0?gAmt:Math.min(ncols-1,2));
    descSel.value=String(gDesc>=0?gDesc:Math.min(ncols-1,1));

    const fmtSel=selStyle(document.createElement('select'));
    [['MDY','MM/DD/YYYY (US)'],['DMY','DD/MM/YYYY'],['YMD','YYYY-MM-DD']].forEach(function(p){
      const o=document.createElement('option'); o.value=p[0]; o.textContent=p[1]; fmtSel.appendChild(o);
    });
    const signSel=selStyle(document.createElement('select'));
    [['neg-spend','Negative amounts are spending (most banks)'],['pos-spend','Positive amounts are spending']].forEach(function(p){
      const o=document.createElement('option'); o.value=p[0]; o.textContent=p[1]; signSel.appendChild(o);
    });

    // Optional second amount column for files that split spending/income into
    // separate "Money Out"/"Money In" (or Debit/Credit) columns instead of one
    // signed column. When set, the sign-convention picker is hidden — it doesn't
    // apply once the columns themselves tell us which side a transaction is on.
    const creditSel=colSelect();
    const noCreditOpt=document.createElement('option'); noCreditOpt.value=''; noCreditOpt.textContent='— not used (single signed amount column) —';
    creditSel.insertBefore(noCreditOpt,creditSel.firstChild);
    creditSel.value='';
    const gCredit=guess(['money in','credit','deposit','paid in']);
    if(gCredit>=0&&gCredit!==(+amtSel.value)) creditSel.value=String(gCredit);

    const signLbl=lbl('Sign convention');
    const creditHint=document.createElement('span');
    creditHint.style.cssText='font-size:.74rem;color:var(--muted);grid-column:2;';
    creditHint.textContent='Pick this only if your file has separate spending/income columns (e.g. "Money Out" and "Money In") rather than one column with +/- amounts.';
    function updateAmountModeUI(){
      const twoCol=creditSel.value!=='';
      signLbl.style.display=twoCol?'none':'';
      signSel.style.display=twoCol?'none':'';
    }
    creditSel.addEventListener('change',updateAmountModeUI);

    const hasHeader=document.createElement('input'); hasHeader.type='checkbox'; hasHeader.checked=true;
    const hdrLabel=document.createElement('label'); hdrLabel.style.cssText='display:flex;align-items:center;gap:.4rem;';
    hdrLabel.appendChild(hasHeader); hdrLabel.appendChild(document.createTextNode('First row is a header (skip it)'));

    grid.appendChild(lbl('Date column'));        grid.appendChild(dateSel);
    grid.appendChild(lbl('Amount / spending column')); grid.appendChild(amtSel);
    grid.appendChild(lbl('Description column')); grid.appendChild(descSel);
    grid.appendChild(lbl('Separate income column')); grid.appendChild(creditSel);
    grid.appendChild(document.createElement('span')); grid.appendChild(creditHint);
    grid.appendChild(lbl('Date format'));        grid.appendChild(fmtSel);
    grid.appendChild(signLbl);    grid.appendChild(signSel);
    grid.appendChild(document.createElement('span')); grid.appendChild(hdrLabel);
    updateAmountModeUI();

    const status=document.createElement('div'); status.className='paste-status'; status.style.display='none';
    const actions=document.createElement('div'); actions.className='share-actions';
    actions.appendChild(mkBtn('Back','btn btn-sm btn-ghost',function(){ _wiz.step='pick'; renderWizStep(); }));
    actions.appendChild(mkBtn('Preview →','btn btn-sm',function(){
      const dateCol=+dateSel.value, amtCol=+amtSel.value, descCol=+descSel.value;
      const creditCol=creditSel.value===''?-1:+creditSel.value;
      const fmt=fmtSel.value, sign=signSel.value, skip=hasHeader.checked?1:0;
      const txns=[]; const incomeTxns=[]; let badRows=0;
      for(let i=skip;i<rows.length;i++){
        const r=rows[i];
        if(!r||r.every(function(c){ return !String(c||'').trim(); })) continue;
        const iso=parseDateWithFormat(r[dateCol],fmt);
        if(!iso){ badRows++; continue; }
        const description=String(r[descCol]!==undefined?r[descCol]:'').trim()||'(no description)';
        if(creditCol>=0){
          // Two-column mode: a "Money Out"/debit column and a separate
          // "Money In"/credit column. Whichever one has a parseable nonzero
          // value tells us which side of the ledger the row belongs to.
          const outAmt=parseFloat(String(r[amtCol]||'').replace(/[^0-9.\-]/g,''));
          const inAmt=parseFloat(String(r[creditCol]||'').replace(/[^0-9.\-]/g,''));
          if(!isNaN(outAmt)&&outAmt!==0){
            txns.push({ date:iso, amount:Math.abs(outAmt), sign:'debit', description:description });
          } else if(!isNaN(inAmt)&&inAmt!==0){
            incomeTxns.push({ date:iso, amount:Math.abs(inAmt), sign:'credit', description:description });
          } else {
            badRows++;
          }
        } else {
          const rawAmt=parseFloat(String(r[amtCol]||'').replace(/[^0-9.\-]/g,''));
          if(isNaN(rawAmt)){ badRows++; continue; }
          const sg=applySignConvention(rawAmt,sign);
          if(sg.sign!=='debit'){
            incomeTxns.push({ date:iso, amount:sg.amount, sign:'credit', description:description });
            continue;
          }
          txns.push({ date:iso, amount:sg.amount, sign:sg.sign, description:description });
        }
      }
      if(!txns.length&&!incomeTxns.length){
        const tips=diagnoseMismatch(rows,skip,dateCol,amtCol,fmt,sign,creditCol);
        status.textContent=tips.length
          ? '⚠ No transactions matched those settings. '+tips.join(' ')
          : '⚠ No transactions matched those settings — double-check the column and sign choices.';
        status.className='paste-status bad'; status.style.display='block';
        return;
      }
      finishParsing(txns,incomeTxns,badRows);
    }));

    m.appendChild(desc); m.appendChild(tableWrap); m.appendChild(grid); m.appendChild(status); m.appendChild(actions);
  }

  // Shared tail of parsing: dedupe against previously-imported fingerprints,
  // group the new ones by merchant keyword, and pre-fill a category guess.
  // incomeTxns (sign:'credit') are grouped separately and routed to the income tracker.
  function finishParsing(txns,incomeTxns,badRows){
    // Stashed so the "forget what's been imported" recovery path (below) can
    // re-run the dedup pass against a cleared memory without re-parsing the file.
    _wiz.lastTxns=txns; _wiz.lastIncomeTxns=incomeTxns||[]; _wiz.lastBadRows=badRows;
    const seen=loadSeen();
    const fresh=[];
    let dupCount=0;
    txns.forEach(function(t){
      const fp=fingerprint(t);
      if(seen.has(fp)) dupCount++;
      else fresh.push({ date:t.date, amount:t.amount, sign:t.sign, description:t.description, fp:fp });
    });
    _wiz.allCount=txns.length;
    _wiz.dupCount=dupCount;
    _wiz.badRows=badRows||0;

    const groups={};
    fresh.forEach(function(t){
      const kw=keywordFor(t.description);
      if(!groups[kw]) groups[kw]={ keyword:kw, sample:t.description, txns:[], total:0 };
      groups[kw].txns.push(t);
      groups[kw].total+=t.amount;
    });
    const list=Object.keys(groups).map(function(k){ return groups[k]; }).sort(function(a,b){ return b.total-a.total; });
    list.forEach(function(g){
      g.category=guessCategory(g.keyword,g.sample,_wiz.catMap);
      g.subsConflict=findLinkedSubscriptionMatch(g.sample);
    });

    // Income grouping — same keyword/fingerprint logic, separate category memory.
    // Income txns share the same `seen` set: a payroll deposit has a distinct
    // fingerprint from any expense, so there's no risk of double-routing.
    const freshIncome=[];
    (incomeTxns||[]).forEach(function(t){
      const fp=fingerprint(t);
      if(!seen.has(fp)) freshIncome.push(Object.assign({},t,{fp:fp}));
    });
    const incGroups={};
    freshIncome.forEach(function(t){
      const kw=keywordFor(t.description);
      if(!incGroups[kw]) incGroups[kw]={keyword:kw,sample:t.description,txns:[],total:0};
      incGroups[kw].txns.push(t); incGroups[kw].total+=t.amount;
    });
    _wiz.incomeGroups=Object.keys(incGroups).map(function(k){
      const g=incGroups[k];
      g.category=guessIncomeCategory(g.keyword,g.sample,_wiz.incomeCatMap);
      return g;
    }).sort(function(a,b){ return b.total-a.total; });
    _wiz.allIncomeCount=(incomeTxns||[]).length;

    _wiz.txns=fresh; _wiz.groups=list;
    _wiz.step='review'; renderWizStep();
  }

  // Step 3 — review groups, assign/confirm a category for each.
  function renderReviewStep(m){
    const summary=document.createElement('p'); summary.className='share-hint';
    let s='Found '+_wiz.allCount+' spending transaction'+(_wiz.allCount===1?'':'s');
    if(_wiz.allIncomeCount) s+=' and '+_wiz.allIncomeCount+' income transaction'+(_wiz.allIncomeCount===1?'':'s');
    s+='.';
    if(_wiz.dupCount) s+=' '+_wiz.dupCount+' '+(_wiz.dupCount===1?'was':'were')+' already imported (skipped).';
    if(_wiz.badRows) s+=' '+_wiz.badRows+' row'+(_wiz.badRows===1?'':'s')+' could not be read (skipped).';
    summary.textContent=s;
    m.appendChild(summary);

    if(!_wiz.txns.length&&!(_wiz.incomeGroups&&_wiz.incomeGroups.length)){
      const status=document.createElement('div'); status.className='paste-status ok';
      status.textContent='Nothing new to import — every matching transaction in this file has already been imported.';
      const hint=document.createElement('p'); hint.className='share-hint';
      hint.textContent="If you undid a previous import, FiApp's duplicate-detection memory won't know that — it still thinks those transactions are in your tracker. Use the button below to clear that memory, then try again.";
      const actions=document.createElement('div'); actions.className='share-actions';
      actions.appendChild(mkBtn('Forget previous imports & retry','btn btn-sm btn-ghost',function(){
        saveSeen(new Set());
        finishParsing(_wiz.lastTxns,_wiz.lastIncomeTxns,_wiz.lastBadRows);
      }));
      actions.appendChild(mkBtn('Close','btn btn-sm',function(){ _wiz.overlay.remove(); }));
      m.appendChild(status); m.appendChild(hint); m.appendChild(actions);
      return;
    }

    const desc=document.createElement('p'); desc.className='share-hint';
    desc.textContent='Assign a category to each group below — FiApp remembers your choice for future imports from the same source.';

    const catOptions=buildCategoryOptions();
    const list=document.createElement('div');
    list.style.cssText='display:flex;flex-direction:column;gap:.4rem;max-height:38vh;overflow-y:auto;border:1px solid var(--panel-border);border-radius:6px;padding:.5rem;';
    _wiz.groups.forEach(function(g){
      const card=document.createElement('div'); card.style.cssText='display:flex;flex-direction:column;gap:.35rem;';
      const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:.5rem;font-size:.83rem;flex-wrap:wrap;';
      const info=document.createElement('span'); info.style.cssText='flex:1;min-width:160px;';
      info.innerHTML='<strong>'+escapeHtml(g.keyword)+'</strong> <span style="color:var(--muted)">— '+escapeHtml(g.sample.slice(0,40))+' · '+g.txns.length+' transaction'+(g.txns.length===1?'':'s')+' · $'+g.total.toFixed(2)+'</span>';
      const sel=selStyleSmall(document.createElement('select'));
      const blank=document.createElement('option'); blank.value=''; blank.textContent='— choose category —'; sel.appendChild(blank);
      catOptions.forEach(function(c){ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
      sel.value=g.category||'';
      sel.addEventListener('change',function(){ g.category=sel.value; });
      row.appendChild(info); row.appendChild(sel);
      card.appendChild(row);

      // Warn when this group looks like a subscription already tracked
      // elsewhere — importing it here would double-count it.
      if(g.subsConflict){
        const warnRow=document.createElement('label');
        warnRow.style.cssText='display:flex;align-items:center;gap:.4rem;font-size:.78rem;color:var(--muted);background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:5px;padding:.35rem .5rem;';
        const cb=document.createElement('input'); cb.type='checkbox';
        cb.addEventListener('change',function(){
          g.skip=cb.checked;
          sel.disabled=cb.checked;
        });
        warnRow.appendChild(cb);
        const txt=document.createElement('span');
        txt.textContent='⚠ This looks like "'+g.subsConflict+'", which you already track as a subscription. Check this box to skip importing it here and avoid double-counting.';
        warnRow.appendChild(txt);
        card.appendChild(warnRow);
      }
      list.appendChild(card);
    });

    // Income section — only shown when the file had credit/income rows
    if(_wiz.incomeGroups&&_wiz.incomeGroups.length){
      const incHdr=document.createElement('div');
      incHdr.style.cssText='font-size:.76rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;padding:.6rem .2rem .2rem;';
      incHdr.textContent='Income — routes to income tracker';

      // Currency selector: income rows in the tracker may be set to a specific currency.
      // Tell us what currency the amounts in this file are in so we write to the right row.
      const currRow=document.createElement('div');
      currRow.style.cssText='display:flex;align-items:center;gap:.5rem;font-size:.82rem;padding:.1rem .2rem .4rem;flex-wrap:wrap;';
      const currLbl=document.createElement('span'); currLbl.textContent='Currency of these transactions:';
      const currSel=selStyleSmall(document.createElement('select'));
      IMPORT_CURRENCIES.forEach(function(c){ const o=document.createElement('option'); o.value=c; o.textContent=c; currSel.appendChild(o); });
      currSel.value=_wiz.importCurrency||'USD';
      currSel.addEventListener('change',function(){ _wiz.importCurrency=currSel.value; });
      currRow.appendChild(currLbl); currRow.appendChild(currSel);
      list.appendChild(incHdr); list.appendChild(currRow);
      const incOpts=buildIncomeCategoryOptions();
      _wiz.incomeGroups.forEach(function(g){
        const card=document.createElement('div');
        card.style.cssText='display:flex;flex-direction:column;gap:.35rem;background:rgba(187,247,208,.08);border-radius:5px;padding:.3rem .4rem;';
        const row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:.5rem;font-size:.83rem;flex-wrap:wrap;';
        const info=document.createElement('span'); info.style.cssText='flex:1;min-width:160px;';
        const badge=document.createElement('span');
        badge.style.cssText='background:#bbf7d0;color:#166534;border-radius:3px;padding:.1rem .35rem;font-size:.72rem;font-weight:600;margin-right:.3rem;';
        badge.textContent='income';
        const kw=document.createElement('strong'); kw.textContent=g.keyword;
        const detail=document.createElement('span'); detail.style.color='var(--muted)';
        detail.textContent=' — '+g.sample.slice(0,40)+' · '+g.txns.length+' transaction'+(g.txns.length===1?'':'s')+' · $'+g.total.toFixed(2);
        info.appendChild(badge); info.appendChild(kw); info.appendChild(detail);
        const sel=selStyleSmall(document.createElement('select'));
        const blank=document.createElement('option'); blank.value=''; blank.textContent='— choose income category —'; sel.appendChild(blank);
        incOpts.forEach(function(c){ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
        sel.value=g.category||'';
        sel.addEventListener('change',function(){ g.category=sel.value; });
        row.appendChild(info); row.appendChild(sel);
        card.appendChild(row);
        list.appendChild(card);
      });
    }

    const status=document.createElement('div'); status.className='paste-status'; status.style.display='none';
    const actions=document.createElement('div'); actions.className='share-actions';
    actions.appendChild(mkBtn('Back','btn btn-sm btn-ghost',function(){ _wiz.step=(_wiz.format==='csv'?'map':'pick'); renderWizStep(); }));
    actions.appendChild(mkBtn('Import →','btn btn-sm',function(){
      if(_wiz.groups.some(function(g){ return !g.skip&&!g.category; })||
         (_wiz.incomeGroups||[]).some(function(g){ return !g.category; })){
        status.textContent='⚠ Choose a category for every group before importing (or check the skip box for subscriptions you already track).';
        status.className='paste-status bad'; status.style.display='block';
        return;
      }
      doApply();
    }));

    m.appendChild(desc); m.appendChild(list); m.appendChild(status); m.appendChild(actions);
  }
  function selStyleSmall(sel){ sel.style.cssText='padding:.3rem;border:1px solid var(--input-border);border-radius:5px;background:var(--input-bg);color:var(--fg);font-size:.82rem;'; return sel; }

  // Step 4 — aggregate per (month, category), write into state, persist memory.
  function doApply(){
    const map=_wiz.catMap;
    _wiz.groups.forEach(function(g){ if(!g.skip) map[g.keyword]=g.category; });
    saveCatMap(map);

    // Save income category memory
    const incomeMap=_wiz.incomeCatMap;
    (_wiz.incomeGroups||[]).forEach(function(g){ if(g.category) incomeMap[g.keyword]=g.category; });
    saveIncomeCatMap(incomeMap);

    const buckets={}; // monthKey -> category -> { sum, fps:[] }
    _wiz.groups.forEach(function(g){
      if(g.skip) return;
      g.txns.forEach(function(t){
        const tmk=t.date.slice(0,7);
        if(!buckets[tmk]) buckets[tmk]={};
        if(!buckets[tmk][g.category]) buckets[tmk][g.category]={ sum:0, fps:[] };
        buckets[tmk][g.category].sum+=t.amount;
        buckets[tmk][g.category].fps.push(t.fp);
      });
    });

    const months=Object.keys(buckets).sort();
    let imported=0, rowsCreated=0, colsCreated=0, monthsCapped=0;
    const lockedMonths=[];
    const seen=loadSeen();

    snapshot();
    months.forEach(function(tmk){
      if(_isClosedMonth(tmk)){ lockedMonths.push(tmk); return; }
      if(!state.rowsByMonth) state.rowsByMonth={};
      if(!state.colsByMonth) state.colsByMonth={};
      if(!state.rowsByMonth[tmk]) state.rowsByMonth[tmk]=getRows(tmk).map(function(r){ return Object.assign({},r); });
      if(!state.colsByMonth[tmk]) state.colsByMonth[tmk]=getCols(tmk).map(function(c){ return Object.assign({},c); });
      const monthRows=state.rowsByMonth[tmk];
      const monthCols=state.colsByMonth[tmk];

      let impCol=monthCols.find(function(c){ return c.label===IMPORT_COL_LABEL; });
      if(!impCol){
        if(monthCols.length<MAX_COLS){ impCol={ id:uid(), label:IMPORT_COL_LABEL, width:160 }; monthCols.push(impCol); colsCreated++; }
        else { impCol=monthCols[monthCols.length-1]; }
      } else if(impCol.width<160){ impCol.width=160; }

      Object.keys(buckets[tmk]).forEach(function(cat){
        let row=monthRows.find(function(r){ return !r.parentId&&!_isLinkedRow(r)&&r.label===cat; });
        if(!row){
          if(monthRows.filter(function(r){ return !r.parentId; }).length>=MAX_ROWS){ monthsCapped++; return; }
          row={ id:uid(), label:cat, color:CAT_COLORS[cat]||'#e5e7eb', textColor:'#1f2937', height:36, parentId:null };
          monthRows.push(row); rowsCreated++;
        }
        const key=tmk+'|'+row.id+'|'+impCol.id;
        const existing=parseFloat(state.cells[key]||0)||0;
        const total=existing+buckets[tmk][cat].sum;
        state.cells[key]=String(parseFloat(total.toFixed(2)));
        buckets[tmk][cat].fps.forEach(function(fp){ if(!seen.has(fp)){ seen.add(fp); imported++; } });
      });
    });

    saveSeen(seen);
    save(); render(); syncIncomeInputs();

    // Build income buckets and apply to income tracker
    const incomeBuckets={};
    (_wiz.incomeGroups||[]).forEach(function(g){
      g.txns.forEach(function(t){
        const tmk=t.date.slice(0,7);
        if(!incomeBuckets[tmk]) incomeBuckets[tmk]={};
        if(!incomeBuckets[tmk][g.category]) incomeBuckets[tmk][g.category]={sum:0,fps:[]};
        incomeBuckets[tmk][g.category].sum+=t.amount;
        incomeBuckets[tmk][g.category].fps.push(t.fp);
      });
    });
    const ir=_applyIncomeRows(incomeBuckets,seen,_wiz.importCurrency||'USD');

    _wiz.applied={ count:imported+ir.imported, rowsCreated:rowsCreated+ir.rowsCreated, colsCreated:colsCreated+ir.colsCreated, monthsCapped:monthsCapped+ir.monthsCapped, lockedMonths:lockedMonths, months:months.length, incomeMonths:ir.months };
    _wiz.step='done';
    renderWizStep();
    // B (Playful): celebrate a finished import. No-op for Default/Quiet (gated inside fiappCelebrate).
    if(window.fiappCelebrate){
      var _n=(_wiz.applied&&_wiz.applied.count)||0;
      fiappCelebrate({confetti:true, mascot:'Import done'+(_n?', '+_n+' added':'')+'.'});
    }
  }

  // Write income transaction buckets directly into the income tracker's localStorage blob,
  // then sync to server. Called from doApply(); income.js is not loaded on this page.
  function _applyIncomeRows(buckets,seen,importCurrency){
    importCurrency=importCurrency||'USD';
    const monthKeys=Object.keys(buckets).sort();
    let imported=0,rowsCreated=0,colsCreated=0,monthsCapped=0;

    // Read income blob; synthesize a minimal valid blob if it has never been saved.
    let blob;
    try{ blob=JSON.parse(localStorage.getItem(INCOME_STORAGE_KEY)||'null'); }catch(_){}
    if(!blob||typeof blob!=='object'){
      blob={
        rows:INCOME_DEFAULT_ROWS.map(function(label){
          return {id:uid(),label:label,color:INCOME_CAT_COLORS[label]||'#e5e7eb',textColor:'#1f2937',height:36,parentId:null};
        }),
        cols:[{id:uid(),label:'Amount',width:160}],
        cells:{},cellTimes:{},collapsed:{},monthRowCurrencies:{},displayCurrency:'USD',
        headerColWidth:185,totalColWidth:110,rowsByMonth:{},colsByMonth:{}
      };
    }
    if(!blob.cells)              blob.cells={};
    if(!blob.cellTimes)          blob.cellTimes={};
    if(!blob.rowsByMonth)        blob.rowsByMonth={};
    if(!blob.colsByMonth)        blob.colsByMonth={};
    if(!blob.monthRowCurrencies) blob.monthRowCurrencies={};

    // Helper: currency assigned to a row in this month (falls back to tracker display currency)
    function rowCurrency(tmk,rowId){
      return blob.monthRowCurrencies[tmk+'|'+rowId]||(blob.displayCurrency||'USD');
    }

    const now=Date.now();
    monthKeys.forEach(function(tmk){
      // Fork month structure if not yet done (mirrors income.js's getRows/forkCurrentMonth pattern)
      if(!blob.rowsByMonth[tmk]) blob.rowsByMonth[tmk]=(blob.rows||[]).map(function(r){ return Object.assign({},r); });
      if(!blob.colsByMonth[tmk]) blob.colsByMonth[tmk]=(blob.cols||[]).map(function(c){ return Object.assign({},c); });
      const monthRows=blob.rowsByMonth[tmk];
      const monthCols=blob.colsByMonth[tmk];

      // Find or create "Imported" column (same label as expenses for consistency)
      let impCol=monthCols.find(function(c){ return c.label===IMPORT_COL_LABEL; });
      if(!impCol){
        if(monthCols.length<MAX_COLS){ impCol={id:uid(),label:IMPORT_COL_LABEL,width:160}; monthCols.push(impCol); colsCreated++; }
        else { impCol=monthCols[monthCols.length-1]; }
      } else if(impCol.width<160){ impCol.width=160; }

      Object.keys(buckets[tmk]).forEach(function(cat){
        // Find or create the top-level category row
        let isNew=false;
        let catRow=monthRows.find(function(r){ return !r.parentId&&r.label===cat; });
        if(!catRow){
          if(monthRows.filter(function(r){ return !r.parentId; }).length>=MAX_ROWS){ monthsCapped++; return; }
          catRow={id:uid(),label:cat,color:INCOME_CAT_COLORS[cat]||'#e5e7eb',textColor:'#1f2937',height:36,parentId:null};
          monthRows.push(catRow); rowsCreated++; isNew=true;
        }

        // Determine the row to write the cell into, honouring two constraints:
        //   1. income.js renders parent rows (with sub-children) as computed sums for every
        //      column — writing to the parent cell directly is invisible. Must use a child.
        //   2. The target row's currency must match importCurrency so the tracker converts
        //      correctly. If no matching row exists, create a sub-row labelled with the
        //      currency code so the user can see where the imported value landed.
        const kids=monthRows.filter(function(r){ return r.parentId===catRow.id; });
        let targetRow;
        if(kids.length){
          // Parent has children — find a child whose currency matches, or create one
          targetRow=kids.find(function(r){ return rowCurrency(tmk,r.id)===importCurrency; });
          if(!targetRow){
            targetRow={id:uid(),label:importCurrency,color:catRow.color,textColor:catRow.textColor||'#1f2937',height:32,parentId:catRow.id};
            monthRows.push(targetRow); rowsCreated++;
            blob.monthRowCurrencies[tmk+'|'+targetRow.id]=importCurrency;
          }
        } else {
          // No children — use the parent directly if currency matches (or if it was just
          // created, claim its currency); otherwise create a sub-row with the right currency.
          if(isNew||rowCurrency(tmk,catRow.id)===importCurrency){
            blob.monthRowCurrencies[tmk+'|'+catRow.id]=importCurrency;
            targetRow=catRow;
          } else {
            targetRow={id:uid(),label:importCurrency,color:catRow.color,textColor:catRow.textColor||'#1f2937',height:32,parentId:catRow.id};
            monthRows.push(targetRow); rowsCreated++;
            blob.monthRowCurrencies[tmk+'|'+targetRow.id]=importCurrency;
          }
        }

        const key=tmk+'|'+targetRow.id+'|'+impCol.id;
        const existing=parseFloat(blob.cells[key]||0)||0;
        blob.cells[key]=String(parseFloat((existing+buckets[tmk][cat].sum).toFixed(2)));
        blob.cellTimes[key]=now; // stamp explicitly — income.js's _stampCellTimes isn't available here
        buckets[tmk][cat].fps.forEach(function(fp){ if(!seen.has(fp)){ seen.add(fp); imported++; } });
      });
    });

    try{ localStorage.setItem(INCOME_STORAGE_KEY,JSON.stringify(blob)); }catch(_){}
    _saveIncomeBlob(blob,0,3); // async, non-blocking
    return {imported:imported,rowsCreated:rowsCreated,colsCreated:colsCreated,monthsCapped:monthsCapped,months:monthKeys.length};
  }

  // Mini sync for income tracker: POST the blob to /api/save/income, retrying on
  // 409 using the globally-available _mergeTrackerBlobs from tracker-sync.js.
  // Starting with base_version:0 is intentional — on first use it succeeds immediately;
  // for existing accounts it triggers one 409+merge cycle which the fixed merge handles correctly.
  function _saveIncomeBlob(blob,baseVersion,retriesLeft){
    if(!window.__currentUser) return;
    fetch('/api/save/income',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-CSRF-Token':window._CSRF||''},
      body:JSON.stringify({data:blob,base_version:baseVersion})
    }).then(function(r){
      if(r.ok) return;
      if(r.status===409&&retriesLeft>0) return r.json().then(function(resp){
        var sv=(resp&&typeof resp.server_version==='number')?resp.server_version:baseVersion;
        var lb=blob;
        try{ var raw=localStorage.getItem(INCOME_STORAGE_KEY); if(raw) lb=JSON.parse(raw); }catch(_){}
        var merged=_mergeTrackerBlobs(lb,resp&&resp.server_data);
        try{ localStorage.setItem(INCOME_STORAGE_KEY,JSON.stringify(merged)); }catch(_){}
        _saveIncomeBlob(merged,sv,retriesLeft-1);
      });
      // other errors: data is in localStorage; income tracker will sync on next visit
    }).catch(function(){});
  }

  function renderDoneStep(m){
    const a=_wiz.applied;
    const status=document.createElement('div'); status.className='paste-status ok';
    let s='✓ Imported '+a.count+' transaction'+(a.count===1?'':'s')+' across '+a.months+' month'+(a.months===1?'':'s')+'.';
    if(a.rowsCreated) s+=' Created '+a.rowsCreated+' new categor'+(a.rowsCreated===1?'y':'ies')+'.';
    if(a.colsCreated) s+=' Added an "Imported" column to '+a.colsCreated+' month'+(a.colsCreated===1?'':'s')+'.';
    if(a.monthsCapped) s+=' '+a.monthsCapped+' categor'+(a.monthsCapped===1?'y was':'ies were')+' skipped (20-row limit reached for that month).';
    if(a.lockedMonths&&a.lockedMonths.length){
      const fmtMk=function(mk){ const d=new Date(mk+'-02'); return d.toLocaleString('default',{month:'short',year:'numeric'}); };
      s+=' Skipped '+a.lockedMonths.map(fmtMk).join(', ')+(a.lockedMonths.length===1?' (closed month)':' (closed months)')+'.';
    }
    if(a.incomeMonths) s+=' Also sent '+a.incomeMonths+' income month'+(a.incomeMonths===1?'':'s')+' to the income tracker.';
    status.textContent=s;
    const actions=document.createElement('div'); actions.className='share-actions';
    actions.appendChild(mkBtn('Done','btn btn-sm',function(){ _wiz.overlay.remove(); }));
    m.appendChild(status); m.appendChild(actions);
  }

  window.openImportWizard=openImportWizard;
})();
