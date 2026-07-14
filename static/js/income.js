const STORAGE_KEY = 'fiapp_income_v1';
const UNDO_KEY    = 'fiapp_income_undo_v1';
const REDO_KEY    = 'fiapp_income_redo_v1';
const PUSH_KEY    = 'fiapp_income_push_v1';
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CELL_CURRENCIES  = ['AED','AUD','BRL','CAD','CHF','CNY','EUR','GBP','HKD','INR','JPY','KRW','MXN','MYR','SAR','SGD','THB','USD'];


const ratesCache = {};
let ratesReady   = false;
let currentRate  = 1;
let _ratesStaleDate = null; // set when rates came from the offline fallback (rates-utils stale:true)
function _staleNote(){
  return _ratesStaleDate ? ' · offline rates from '+new Date(_ratesStaleDate).toLocaleDateString() : '';
}
async function fetchAndCacheUSDRates(){
  if(ratesReady) return;
  try{
    const obj=await fiappGetRates('USD');
    const rates=obj.rates;
    if(rates&&typeof rates==='object'&&!Array.isArray(rates)){
      Object.keys(rates).forEach(k=>{const STORAGE_KEY = 'fiapp_income_v1';
const UNDO_KEY    = 'fiapp_income_undo_v1';
const REDO_KEY    = 'fiapp_income_redo_v1';
const PUSH_KEY    = 'fiapp_income_push_v1';
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CELL_CURRENCIES  = ['AED','AUD','BRL','CAD','CHF','CNY','EUR','GBP','HKD','INR','JPY','KRW','MXN','MYR','SAR','SGD','THB','USD'];


const ratesCache = {};
let ratesReady   = false;
let currentRate  = 1;
let _ratesStaleDate = null; // set when rates came from the offline fallback (rates-utils stale:true)
function _staleNote(){
  return _ratesStaleDate ? ' · offline rates from '+new Date(_ratesStaleDate).toLocaleDateString() : '';
}
async function fetchAndCacheUSDRates(){
  if(ratesReady) return;
  try{
    const obj=await fiappGetRates('USD');
    const rates=obj.rates;
    if(rates&&typeof rates==='object'&&!Array.isArray(rates)){
      Object.keys(rates).forEach(k=>{
        if(/^[A-Z]{2,5}$/.test(k)&&typeof rates[k]==='number') ratesCache[k]=rates[k];
      });
      ratesReady=true;
      _ratesStaleDate=obj.stale?obj.fetched_at:null;
    }
  }catch(e){ console.warn('FiApp: rate fetch failed -',e.message); }
}
async function ensureRate(currency){
  if(!currency||currency==='USD'||ratesCache[currency]) return;
  await fetchAndCacheUSDRates();
}
function rowCurrency(monthKey, rowId){ return (state.monthRowCurrencies||{})[monthKey+'|'+rowId]||'USD'; }
function setRowCurrency(monthKey, rowId, cur){
  if(!state.monthRowCurrencies) state.monthRowCurrencies={};
  state.monthRowCurrencies[monthKey+'|'+rowId]=cur; save();
}
function amountToUSD(rawAmt, monthKey, rowId){
  if(!rawAmt) return 0;
  const cur=rowCurrency(monthKey, rowId);
  if(cur==='USD') return rawAmt;
  const rate=ratesCache[cur];
  return rate?rawAmt/rate:rawAmt;
}
function getAllUsedCurrencies(){
  const set=new Set(CELL_CURRENCIES);
  Object.values(state.monthRowCurrencies||{}).forEach(c=>{ if(c) set.add(c); });
  return [...set];
}

function showConvFields(cur,rate){
  currentRate=rate;
  document.getElementById('conv-lbl').textContent='Total ('+cur+')';
  document.getElementById('conv-wrap').style.display='';
  updateSummaryBar();
}
function hideConvFields(){
  currentRate=1;
  document.getElementById('conv-wrap').style.display='none';
  document.getElementById('curr-note').textContent='';
  updateSummaryBar();
}
function onCurrencyChange(){
  const sel=document.getElementById('curr-sel');
  const cur=sel.value;
  const otherInp=document.getElementById('curr-other-inp');
  const otherBtn=document.getElementById('curr-other-btn');
  if(cur==='__other__'){
    otherInp.style.display='inline-block'; otherBtn.style.display='inline-block';
    document.getElementById('curr-note').textContent='Enter a currency code then click OK.';
    return;
  }
  otherInp.style.display='none'; otherBtn.style.display='none';
  state.displayCurrency=cur; save();
  if(cur==='USD'){ hideConvFields(); return; }
  document.getElementById('curr-note').textContent='Fetching…';
  if(ratesCache[cur]){
    document.getElementById('curr-note').textContent='1 USD = '+ratesCache[cur].toFixed(4)+' '+cur+_staleNote();
    showConvFields(cur,ratesCache[cur]); return;
  }
  fiappGetRates('USD').then(obj=>{
      const rates=obj.rates;
      if(rates&&typeof rates==='object'&&!Array.isArray(rates)){
        Object.keys(rates).forEach(k=>{if(/^[A-Z]{2,5}$/.test(k)&&typeof rates[k]==='number') ratesCache[k]=rates[k];});
        ratesReady=true;
        _ratesStaleDate=obj.stale?obj.fetched_at:null;
      }
      const rate=ratesCache[cur];
      if(!rate){document.getElementById('curr-note').textContent='Unknown currency: '+cur;return;}
      document.getElementById('curr-note').textContent='1 USD = '+rate.toFixed(4)+' '+cur+_staleNote();
      showConvFields(cur,rate);
    }).catch(()=>{document.getElementById('curr-note').textContent='Network error';});
}
function applyOtherCurrency(){
  const raw=(document.getElementById('curr-other-inp').value||'').trim().toUpperCase();
  if(!raw||!/^[A-Z]{2,5}$/.test(raw)){document.getElementById('curr-note').textContent='Invalid code (2–5 letters).';return;}
  if(raw==='USD'){state.displayCurrency='USD';save();hideConvFields();document.getElementById('curr-sel').value='USD';return;}
  document.getElementById('curr-note').textContent='Fetching…';
  fiappGetRates('USD').then(obj=>{
      const rates=obj.rates;
      if(rates&&typeof rates==='object'){
        Object.keys(rates).forEach(k=>{if(/^[A-Z]{2,5}$/.test(k)&&typeof rates[k]==='number') ratesCache[k]=rates[k];});
        ratesReady=true;
        _ratesStaleDate=obj.stale?obj.fetched_at:null;
      }
      const rate=ratesCache[raw];
      if(!rate){document.getElementById('curr-note').textContent='Unknown currency: '+raw;return;}
      
      const sel=document.getElementById('curr-sel');
      if(![...sel.options].find(o=>o.value===raw)){
        const opt=document.createElement('option'); opt.value=raw; opt.textContent=raw; opt.dataset.custom='1';
        sel.insertBefore(opt, sel.querySelector('option[value="__other__"]'));
      }
      sel.value=raw;
      document.getElementById('curr-other-inp').style.display='none';
      document.getElementById('curr-other-btn').style.display='none';
      state.displayCurrency=raw; save();
      document.getElementById('curr-note').textContent='1 USD = '+rate.toFixed(4)+' '+raw+_staleNote();
      showConvFields(raw,rate);
    }).catch(()=>{document.getElementById('curr-note').textContent='Network error';});
}
function showCellCurrencyOther(wrap, sel, row){
  sel.style.display='none';
  const form=document.createElement('span'); form.className='curr-other-cell';
  const inp=document.createElement('input'); inp.type='text'; inp.maxLength=5; inp.placeholder='VND';
  const ok=document.createElement('button'); ok.textContent='✓'; ok.title='Apply'; ok.setAttribute('aria-label','Apply');
  const cancel=document.createElement('button'); cancel.textContent='✕'; cancel.title='Cancel'; cancel.className='x'; cancel.setAttribute('aria-label','Cancel');
  form.appendChild(inp); form.appendChild(ok); form.appendChild(cancel);
  wrap.appendChild(form);
  setTimeout(()=>inp.focus(),20);
  function showErr(msg){ const old=document.querySelector('.curr-other-err'); if(old) old.remove(); const e=document.createElement('span'); e.className='curr-other-err'; e.textContent=msg; const r=inp.getBoundingClientRect(); e.style.top=(r.bottom+4)+'px'; e.style.left=r.left+'px'; document.body.appendChild(e); }
  function close(){ form.remove(); const old=document.querySelector('.curr-other-err'); if(old) old.remove(); sel.style.display=''; sel.value=rowCurrency(currentMK(), row.id); }
  async function apply(){
    const code=inp.value.trim().toUpperCase();
    if(!code){showErr('Enter a code.');return;}
    if(!/^[A-Z]{2,5}$/.test(code)){showErr('2–5 letters only.');return;}
    if(code==='USD'){setRowCurrency(currentMK(), row.id, code);close();render();renderChart();return;}
    ok.disabled=true; ok.textContent='…';
    await ensureRate(code);
    if(!ratesCache[code]){showErr('Unknown: '+code);ok.disabled=false;ok.textContent='✓';return;}
    setRowCurrency(currentMK(), row.id, code); close(); render(); renderChart();
  }
  ok.addEventListener('click',e=>{e.stopPropagation();apply();});
  cancel.addEventListener('click',e=>{e.stopPropagation();close();});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}if(e.key==='Escape'){close();}});
}

const CATEGORIES = {
  'Salary':       ['Base Pay','Overtime','Bonus','Commission','Tips'],
  'Freelance':    ['Client Work','Consulting','Side Projects','Gigs'],
  'Investments':  ['Dividends','Capital Gains','Rental Income','Interest Income'],
  'Other Income': ['Gifts','Tax Refund','Reimbursements','Miscellaneous'],
};
const CAT_KEYS = Object.keys(CATEGORIES);
const CAT_COLORS = {
  'Salary':'#bbf7d0','Freelance':'#bfdbfe','Investments':'#fed7aa','Other Income':'#e9d5ff',
};
function uid(){ return '_'+Math.random().toString(36).slice(2,9); }


function freshState(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();
  return {
    rows:[
      {id:uid(),label:'Salary',      color:'#bbf7d0',textColor:'#1f2937',height:36,parentId:null},
      {id:uid(),label:'Freelance',   color:'#bfdbfe',textColor:'#1f2937',height:36,parentId:null},
      {id:uid(),label:'Investments', color:'#fed7aa',textColor:'#1f2937',height:36,parentId:null},
      {id:uid(),label:'Other Income',color:'#e9d5ff',textColor:'#1f2937',height:36,parentId:null},
    ],
    cols:[
      {id:uid(),label:'Amount',width:160},
    ],
    headerColWidth:235, totalColWidth:110,
    cells:{}, cellTimes:{}, collapsed:{}, monthRowCurrencies:{},
    displayCurrency:'USD',
    currentYear:y, currentMonth:m,
    rowsByMonth:{}, colsByMonth:{},
    recurringRules:[],
  };
}
function loadState(){
  try{
    if(isWalkthroughActive()){
      // If the user already saved income this walkthrough session, show it so that
      // navigating Back doesn't wipe their entry. Session flag set by save(), cleared by _restore().
      if(localStorage.getItem('fiapp_income_wt_session')==='1'){
        const r=localStorage.getItem(STORAGE_KEY);
        if(r){try{
          const s=JSON.parse(r);
          if(s&&Array.isArray(s.rows)){
            // Same defensive backfill as the normal path below - a walkthrough
            // sandbox blob missing a field (e.g. state.collapsed) would otherwise
            // crash render() instead of falling back to a default.
            if(!s.cells) s.cells={};
            if(!s.cellTimes) s.cellTimes={};
            if(!s.collapsed) s.collapsed={};
            if(!s.monthRowCurrencies) s.monthRowCurrencies={};
            if(!s.rowsByMonth) s.rowsByMonth={};
            if(!s.colsByMonth) s.colsByMonth={};
            if(!Array.isArray(s.recurringRules)) s.recurringRules=[];
            return s;
          }
        }catch(_){}}
      }
      return freshState();
    }
  }catch(_){}
  try{
    const r=localStorage.getItem(STORAGE_KEY);
    if(r){
      const s=JSON.parse(r);
      if(!s.cells)          s.cells={};
      if(!s.cellTimes)      s.cellTimes={};
      if(!s.collapsed)      s.collapsed={};
      if(!s.monthRowCurrencies)  s.monthRowCurrencies={};
      if(!s.displayCurrency) s.displayCurrency='USD';
      if(!Array.isArray(s.rows)) s.rows=freshState().rows;
      if(!Array.isArray(s.cols)) s.cols=freshState().cols;
      if(!s.rowsByMonth)    s.rowsByMonth={};
      if(!s.colsByMonth)    s.colsByMonth={};
      if(!Array.isArray(s.recurringRules)) s.recurringRules=[];
      // The old default Source-column width (185) truncates the default category names;
      // widen columns that were never manually resized so e.g. 'Other Income' shows in full.
      if(s.headerColWidth===185) s.headerColWidth=235;
      // The last-viewed month is per-device view state and persists across visits
      // (matching the Expense tracker), so we keep s.currentYear/currentMonth as saved.
      return s;
    }
  }catch(e){ console.warn('FiApp: loadState failed, using fresh state -',e.message); }
  return freshState();
}
let state=loadState();
// B (Playful first-entry): months that already had data when this session started, so a
// later edit to an already-populated month is never mistaken for "first entry of a new
// month". Populated from the server-synced state once startup finishes (see below).
let _monthsWithDataAtLoad=null;

const MAX_ROWS=20;
const MAX_COLS=12;
function getRows(mk2){ return effectiveRowsForMonth(state, mk2||currentMK()); }
function getCols(mk2){ return effectiveColsForMonth(state, mk2||currentMK()); }
function forkCurrentMonth(){
  const mk2=currentMK();
  const _wasNew=!(state.rowsByMonth&&state.rowsByMonth[mk2]);
  if(!state.rowsByMonth) state.rowsByMonth={};
  if(!state.colsByMonth) state.colsByMonth={};
  if(_wasNew) _recFillNewMonth(mk2);
  if(!state.rowsByMonth[mk2]) state.rowsByMonth[mk2]=(state.rows||[]).map(r=>({...r}));
  if(!state.colsByMonth[mk2]) state.colsByMonth[mk2]=(state.cols||[]).map(c=>({...c}));
}
// ── Recurring rules: state accessors + writers (pure logic lives in recurring-core.js) ──
function _recRules(){ if(!Array.isArray(state.recurringRules)) state.recurringRules=[]; return state.recurringRules; }
function _recRuleFor(rowId){ return _recRules().find(r=>r.rowId===rowId)||null; }
function _monthTotalForRow(rowId, mk2){
  const cols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
  return cols.reduce((s,c)=> s+(parseFloat((state.cells||{})[mk2+'|'+rowId+'|'+c.id]||0)||0), 0);
}
function _existingMonths(){
  const set={};
  Object.keys(state.cells||{}).forEach(k=>{ set[k.split('|')[0]]=1; });
  Object.keys(state.rowsByMonth||{}).forEach(mk2=>{ set[mk2]=1; });
  Object.keys(state.colsByMonth||{}).forEach(mk2=>{ set[mk2]=1; });
  set[currentMK()]=1;
  return Object.keys(set);
}
// A top-level row lives in state.rows and so "exists" in every month via
// effectiveRowsForMonth's fallback, even ones never forked yet. A sub-source row only
// exists in the specific months whose fork explicitly includes it (addSubRow writes into
// state.rowsByMonth, never state.rows) - so this check is a no-op restriction for ordinary
// rows and a real one for sub-sources, without needing to special-case child rows.
function _rowExistsInMonth(rowId, mk2){ return getRows(mk2).some(r=>r.id===rowId); }
function _recOptsFor(rowId){
  return { existingMonths:_existingMonths().filter(mk2=>_rowExistsInMonth(rowId, mk2)), isLocked:_isClosedMonth,
           getMonthTotal:function(mk2){ return _monthTotalForRow(rowId, mk2); } };
}
function _ensureMonthForked(mk2){
  if(!state.rowsByMonth) state.rowsByMonth={};
  if(!state.colsByMonth) state.colsByMonth={};
  if(!state.rowsByMonth[mk2]) state.rowsByMonth[mk2]=(state.rows||[]).map(r=>({...r}));
  if(!state.colsByMonth[mk2]) state.colsByMonth[mk2]=(state.cols||[]).map(c=>({...c}));
}
function _recWriteMonth(rule, mk2){
  _ensureMonthForked(mk2);
  const cols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
  if(!state.cells) state.cells={};
  const val=FiRecurring.ruleValueForMonth(rule, mk2);
  cols.forEach((c,i)=>{
    const key=mk2+'|'+rule.rowId+'|'+c.id;
    if(rule.mode==='monthly'){ state.cells[key]=(i===0?String(val):'0'); }
    else { const w=(rule.weekly&&rule.weekly[i]!=null)?rule.weekly[i]:(i===0?val:0); state.cells[key]=String(w); }
    if(state.cellTimes) state.cellTimes[key]=Date.now();
  });
  // Apply the rule's chosen currency to the month it just wrote (inlined rather than
  // calling setRowCurrency, which saves immediately - the caller saves once, in bulk).
  if(rule.currency){
    if(!state.monthRowCurrencies) state.monthRowCurrencies={};
    state.monthRowCurrencies[mk2+'|'+rule.rowId]=rule.currency;
  }
}
function _recFillNewMonth(mk2){
  if(_isClosedMonth(mk2)) return false;
  let wrote=false;
  _recRules().forEach(rule=>{
    if(rule.draft) return;
    if(!FiRecurring.monthInScope(rule, mk2)) return;
    // A sub-source only exists in months whose fork explicitly added it - a brand-new
    // month forks from the top-level state.rows, which never contains sub-sources, so
    // silently skip rather than write an orphaned cell for a row that won't render here.
    if(!_rowExistsInMonth(rule.rowId, mk2)) return;
    if(_monthTotalForRow(rule.rowId, mk2)!==0) return;
    _recWriteMonth(rule, mk2); wrote=true;
  });
  return wrote;
}
function markRowRecurring(rowId, on){
  [state.rows].concat(Object.values(state.rowsByMonth||{})).forEach(arr=>{
    const r=(arr||[]).find(x=>x.id===rowId); if(r) r.recurring=!!on;
  });
}
function _recEligible(row, isChild){
  return !!row && !row.linked && !row.snapshotLinkedRow && !hasChildren(row.id);
}
function _recMkLabel(mk2){
  const p=String(mk2||'').split('-'); if(p.length<2) return mk2||'';
  const d=new Date(Number(p[0]), Number(p[1])-1, 1);
  return d.toLocaleDateString(undefined,{month:'short',year:'numeric'});
}
function _recUnlockMonth(mk2){ if(state.closedMonths) delete state.closedMonths[mk2]; }

function _recModal(){
  const overlay=document.createElement('div');
  overlay.className='rec-modal-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:var(--overlay,rgba(0,0,0,.5));z-index:20000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  const panel=document.createElement('div');
  panel.className='rec-modal';
  panel.style.cssText='background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:14px;max-width:420px;width:100%;max-height:90vh;overflow:auto;padding:1.1rem 1.2rem;box-shadow:var(--elev-3,0 12px 32px rgba(0,0,0,.4));';
  overlay.appendChild(panel);
  function close(){ overlay.remove(); document.removeEventListener('keydown',esc); }
  function esc(e){ if(e.key==='Escape') close(); }
  overlay.addEventListener('pointerdown',e=>{ if(e.target===overlay) close(); });
  document.addEventListener('keydown',esc);
  document.body.appendChild(overlay);
  return {overlay:overlay, panel:panel, close:close};
}

// Inline "type a custom code" affordance for the recurring modal's currency select,
// mirroring showCellCurrencyOther's validate-via-ensureRate pattern but reverting to an
// explicit caller-supplied value (the modal has no single row/month to read back from).
function _recCurrencyOther(wrap, sel, revertVal){
  sel.style.display='none';
  const form=document.createElement('span'); form.className='curr-other-cell';
  const inp=document.createElement('input'); inp.type='text'; inp.maxLength=5; inp.placeholder='VND';
  inp.style.cssText='font-size:16px;width:80px;';
  const ok=document.createElement('button'); ok.type='button'; ok.textContent='✓'; ok.title='Apply'; ok.setAttribute('aria-label','Apply');
  const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='✕'; cancel.title='Cancel'; cancel.className='x'; cancel.setAttribute('aria-label','Cancel');
  form.appendChild(inp); form.appendChild(ok); form.appendChild(cancel);
  wrap.appendChild(form);
  setTimeout(()=>inp.focus(),20);
  function showErr(msg){
    const old=document.querySelector('.curr-other-err'); if(old) old.remove();
    const e=document.createElement('span'); e.className='curr-other-err'; e.textContent=msg;
    const r=inp.getBoundingClientRect(); e.style.top=(r.bottom+4)+'px'; e.style.left=r.left+'px';
    document.body.appendChild(e);
  }
  function close(){ form.remove(); const old=document.querySelector('.curr-other-err'); if(old) old.remove(); sel.style.display=''; }
  function commit(code){
    if(!Array.prototype.some.call(sel.options, o=>o.value===code)){
      const opt=document.createElement('option'); opt.value=code; opt.textContent=code;
      sel.insertBefore(opt, sel.querySelector('option[value="__other__"]'));
    }
    sel.value=code; close();
  }
  async function apply(){
    const code=inp.value.trim().toUpperCase();
    if(!code){ showErr('Enter a code.'); return; }
    if(!/^[A-Z]{2,5}$/.test(code)){ showErr('2-5 letters only.'); return; }
    if(code==='USD'){ commit(code); return; }
    ok.disabled=true; ok.textContent='…';
    await ensureRate(code);
    if(!ratesCache[code]){ showErr('Unknown: '+code); ok.disabled=false; ok.textContent='✓'; return; }
    commit(code);
  }
  ok.addEventListener('click',e=>{e.stopPropagation();apply();});
  cancel.addEventListener('click',e=>{e.stopPropagation();sel.value=revertVal;close();});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}if(e.key==='Escape'){sel.value=revertVal;close();}});
}

function openRecurringConfig(rowId){
  const row=getRows().find(r=>r.id===rowId)||(state.rows||[]).find(r=>r.id===rowId);
  if(!row) return;
  const existing=_recRuleFor(rowId);
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : {
    rowId:rowId, amount:_monthTotalForRow(rowId,currentMK())||0, mode:'monthly', weekly:null,
    scope:{type:'future', anchor:currentMK(), start:null, end:null}, overrides:{}, exceptions:[], draft:false };
  if(!draft.scope) draft.scope={type:'future', anchor:currentMK(), start:null, end:null};
  if(!draft.scope.anchor) draft.scope.anchor=currentMK();

  const m=_recModal();
  const h=document.createElement('h3'); h.style.cssText='margin:0 0 .9rem;font-size:1.02rem;color:var(--fg);';
  h.textContent='Recurring: '+(row.label||'Source'); m.panel.appendChild(h);

  const amtLbl=document.createElement('label'); amtLbl.style.cssText='display:block;font-size:.8rem;color:var(--muted);margin-bottom:1rem;';
  amtLbl.appendChild(document.createTextNode('Amount per month'));
  const amt=document.createElement('input'); amt.type='number'; amt.step='0.01'; amt.min='0'; amt.value=draft.amount||0;
  amt.style.cssText='display:block;width:100%;margin-top:.35rem;padding:.55rem;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg,var(--panel-bg));color:var(--fg);font-size:16px;box-sizing:border-box;';
  amtLbl.appendChild(amt); m.panel.appendChild(amtLbl);

  // Per-month overrides pin specific months to a custom amount that otherwise shadows the
  // base amount above with no on-screen sign (this is the desync bug). Surface any pins here
  // with a one-click reset so a rule can never silently apply a value the modal isn't showing.
  if(existing && existing.overrides){
    const _pins=Object.keys(existing.overrides).filter(mk2=>Math.abs((existing.overrides[mk2]||0)-(existing.amount||0))>1e-9).sort();
    if(_pins.length){
      const ov=document.createElement('div'); ov.style.cssText='font-size:.78rem;color:var(--fg);background:var(--hover-bg,rgba(0,0,0,.05));border:1px solid var(--input-border);border-radius:8px;padding:.55rem .6rem;margin-bottom:1rem;line-height:1.5;';
      const t=document.createElement('div');
      t.textContent=_pins.length+(_pins.length>1?' months are':' month is')+' pinned to a custom amount ('+_pins.map(mk2=>_recMkLabel(mk2)+': '+fmt(existing.overrides[mk2])).join(', ')+'), so the amount above does not apply there.';
      ov.appendChild(t);
      const rb=document.createElement('button'); rb.type='button'; rb.textContent='Reset those months to the amount above';
      rb.style.cssText='margin-top:.5rem;padding:.4rem .7rem;border-radius:999px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-size:.78rem;';
      rb.addEventListener('click',()=>{
        const a=parseFloat(amt.value); const live=_recRuleFor(rowId);
        if(live && !isNaN(a) && a>=0) live.amount=a;
        m.close(); _recResetOverrides(rowId);
      });
      ov.appendChild(rb); m.panel.appendChild(ov);
    }
  }

  const curLbl=document.createElement('label'); curLbl.style.cssText='display:block;font-size:.8rem;color:var(--muted);margin-bottom:1rem;';
  curLbl.appendChild(document.createTextNode('Currency'));
  const curWrap=document.createElement('div'); curWrap.style.cssText='margin-top:.35rem;';
  const curSel=document.createElement('select');
  // .cell-curr-sel is the class glass-picker.js already intercepts on desktop (turns the
  // native popup into the app's glass scroll-wheel) - reuse it instead of a bespoke select,
  // exactly like the per-row currency pickers elsewhere in this tracker. The inline width
  // below overrides that class's narrower max-width rule (inline specificity always wins).
  curSel.className='cell-curr-sel';
  curSel.style.cssText='display:block;width:100%;max-width:none;padding:.55rem;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg,var(--panel-bg));color:var(--fg);font-size:16px;box-sizing:border-box;';
  const _recCurCodes=getAllUsedCurrencies();
  const _recCurVal=draft.currency||rowCurrency(currentMK(), rowId);
  if(!_recCurCodes.includes(_recCurVal)) _recCurCodes.push(_recCurVal);
  _recCurCodes.sort().forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; if(c===_recCurVal) o.selected=true; curSel.appendChild(o); });
  const curOtherOpt=document.createElement('option'); curOtherOpt.value='__other__'; curOtherOpt.textContent='Other…'; curSel.appendChild(curOtherOpt);
  curWrap.appendChild(curSel);
  curSel.addEventListener('change',()=>{
    if(curSel.value==='__other__') _recCurrencyOther(curWrap, curSel, _recCurVal);
  });
  curLbl.appendChild(curWrap); m.panel.appendChild(curLbl);

  const scLbl=document.createElement('div'); scLbl.style.cssText='font-size:.8rem;color:var(--muted);margin-bottom:.35rem;'; scLbl.textContent='Applies to'; m.panel.appendChild(scLbl);
  if(row.parentId){
    const scNote=document.createElement('div'); scNote.style.cssText='font-size:.76rem;color:var(--muted);margin-bottom:.5rem;line-height:1.4;';
    scNote.textContent='Only applies to months that already have this sub-source - it won\'t create it elsewhere.';
    m.panel.appendChild(scNote);
  }
  const scWrap=document.createElement('div'); scWrap.style.cssText='display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.6rem;';
  const rangeWrap=document.createElement('div'); rangeWrap.style.cssText='display:none;gap:.4rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap;';
  const rStart=document.createElement('input'); rStart.type='month'; rStart.value=draft.scope.start||currentMK();
  const rEnd=document.createElement('input'); rEnd.type='month'; rEnd.value=draft.scope.end||currentMK();
  // Bound the range picker to the same +-1 year window the app already enforces for
  // month navigation (minY/minM..maxY/maxM, see isAtMin/isAtMax above) - not an invented
  // horizon.
  const _recRangeMin=mk(minY,minM), _recRangeMax=mk(maxY,maxM);
  [rStart,rEnd].forEach(x=>{ x.min=_recRangeMin; x.max=_recRangeMax; x.style.cssText='padding:.4rem;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg,var(--panel-bg));color:var(--fg);font-size:16px;'; });
  const rArrow=document.createElement('span'); rArrow.textContent='to'; rArrow.style.cssText='color:var(--muted);font-size:.85rem;';
  rangeWrap.appendChild(rStart); rangeWrap.appendChild(rArrow); rangeWrap.appendChild(rEnd);

  // A continuous date range can't express "only months that have this sub-source" when its
  // existence has gaps, so subcategory rows get a checklist of exactly the valid months
  // instead of Custom range - the picker itself can no longer offer an invalid month.
  const specWrap=document.createElement('div'); specWrap.style.cssText='display:none;flex-direction:column;gap:.3rem;max-height:180px;overflow-y:auto;border:1px solid var(--input-border);border-radius:8px;padding:.5rem;margin-bottom:1rem;';
  const _specMonths=row.parentId?_existingMonths().filter(mk2=>_rowExistsInMonth(rowId,mk2)).sort():[];
  if(!Array.isArray(draft.scope.months)) draft.scope.months=[];
  function renderSpecList(){
    specWrap.innerHTML='';
    if(!_specMonths.length){
      const none=document.createElement('div'); none.style.cssText='font-size:.8rem;color:var(--muted);'; none.textContent='This sub-source has no months with data yet.';
      specWrap.appendChild(none); return;
    }
    _specMonths.forEach(mk2=>{
      const lbl=document.createElement('label'); lbl.style.cssText='display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:var(--fg);cursor:pointer;';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=draft.scope.months.indexOf(mk2)>=0;
      cb.addEventListener('change',()=>{
        const i=draft.scope.months.indexOf(mk2);
        if(cb.checked){ if(i<0) draft.scope.months.push(mk2); } else if(i>=0) draft.scope.months.splice(i,1);
      });
      lbl.appendChild(cb); lbl.appendChild(document.createTextNode(_recMkLabel(mk2)));
      specWrap.appendChild(lbl);
    });
  }
  renderSpecList();

  function renderScopeBtns(){
    scWrap.innerHTML='';
    const opts=row.parentId
      ? [['future','All future months'],['past','All past months'],['all','All months'],['specific','Specific months']]
      : [['future','All future months'],['past','All past months'],['all','All months'],['range','Custom range']];
    opts.forEach(o=>{
      const active=draft.scope.type===o[0];
      const b=document.createElement('button'); b.type='button'; b.textContent=o[1];
      b.style.cssText='padding:.4rem .7rem;border-radius:999px;border:1px solid var(--input-border);cursor:pointer;font-size:.8rem;background:'+(active?'var(--accent)':'transparent')+';color:'+(active?'#fff':'var(--fg)')+';';
      b.addEventListener('click',()=>{
        draft.scope.type=o[0];
        if(o[0]==='future'||o[0]==='past'){ draft.scope.anchor=currentMK(); draft.scope.start=null; draft.scope.end=null; }
        else if(o[0]==='all'){ draft.scope.start=null; draft.scope.end=null; }
        else if(o[0]==='specific'){
          if(!draft.scope.months.length && _specMonths.indexOf(currentMK())>=0) draft.scope.months=[currentMK()];
          renderSpecList();
        }
        rangeWrap.style.display=o[0]==='range'?'flex':'none';
        specWrap.style.display=o[0]==='specific'?'flex':'none';
        renderScopeBtns();
      });
      scWrap.appendChild(b);
    });
  }
  renderScopeBtns(); m.panel.appendChild(scWrap);
  rangeWrap.style.display=draft.scope.type==='range'?'flex':'none';
  m.panel.appendChild(rangeWrap);
  specWrap.style.display=draft.scope.type==='specific'?'flex':'none';
  m.panel.appendChild(specWrap);

  const fb=document.createElement('div'); fb.style.cssText='font-size:.8rem;color:var(--sem-bad,#b91c1c);min-height:1em;margin-bottom:.6rem;'; m.panel.appendChild(fb);

  const actions=document.createElement('div'); actions.style.cssText='display:flex;gap:.5rem;';
  const saveBtn=document.createElement('button'); saveBtn.type='button'; saveBtn.className='btn'; saveBtn.textContent=existing?'Update recurring':'Make recurring';
  saveBtn.style.cssText='flex:2;padding:.6rem;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:.9rem;';
  const cancelBtn=document.createElement('button'); cancelBtn.type='button'; cancelBtn.textContent='Cancel';
  cancelBtn.style.cssText='flex:1;padding:.6rem;border-radius:8px;border:1px solid var(--input-border);background:transparent;color:var(--fg);cursor:pointer;font-size:.9rem;';
  cancelBtn.addEventListener('click',m.close);
  saveBtn.addEventListener('click',()=>{
    const a=parseFloat(amt.value); if(isNaN(a)||a<0){ fb.textContent='Enter a valid amount.'; return; }
    if(curSel.value==='__other__'){ fb.textContent='Finish entering the custom currency code first.'; return; }
    draft.amount=a; draft.mode='monthly'; draft.weekly=null; draft.currency=curSel.value;
    if(draft.scope.type==='range'){
      draft.scope.start=rStart.value||null; draft.scope.end=rEnd.value||null;
      if(draft.scope.start&&draft.scope.end&&draft.scope.start>draft.scope.end){ fb.textContent='Range start is after end.'; return; }
      if((draft.scope.start&&(draft.scope.start<_recRangeMin||draft.scope.start>_recRangeMax))||
         (draft.scope.end&&(draft.scope.end<_recRangeMin||draft.scope.end>_recRangeMax))){
        fb.textContent='Pick a range within '+_recRangeMin.slice(0,4)+'-'+_recRangeMax.slice(0,4)+'.'; return;
      }
    } else if(draft.scope.type==='specific' && !draft.scope.months.length){
      fb.textContent='Pick at least one month.'; return;
    }
    m.close();
    commitRecurring(draft);
  });
  actions.appendChild(saveBtn); actions.appendChild(cancelBtn); m.panel.appendChild(actions);

  // Delink/Remove live here (not just the mobile gear menu) so they're reachable regardless
  // of viewport - the gear button is mobile-only (styles.css .row-gear-btn), but this modal
  // opens from both the mobile gear and the desktop 🔁 button.
  if(existing){
    const _isExcepted=(existing.exceptions||[]).indexOf(currentMK())>=0;
    const sec=document.createElement('div'); sec.style.cssText='display:flex;gap:.9rem;justify-content:center;margin-top:.9rem;padding-top:.8rem;border-top:1px solid var(--input-border);';
    const linkBtn=document.createElement('button'); linkBtn.type='button';
    linkBtn.textContent=_isExcepted?'🔗 Relink this month':'⛓ Delink this month';
    linkBtn.style.cssText='background:none;border:none;color:var(--muted);cursor:pointer;font-size:.78rem;padding:.2rem;';
    linkBtn.addEventListener('click',()=>{ m.close(); _isExcepted?relinkMonth(rowId, currentMK()):delinkMonth(rowId, currentMK()); });
    const removeBtn=document.createElement('button'); removeBtn.type='button'; removeBtn.textContent='✖ Remove recurring';
    removeBtn.style.cssText='background:none;border:none;color:var(--sem-bad,#b91c1c);cursor:pointer;font-size:.78rem;padding:.2rem;';
    removeBtn.addEventListener('click',()=>{ m.close(); removeRecurring(rowId); });
    sec.appendChild(linkBtn); sec.appendChild(removeBtn); m.panel.appendChild(sec);
  }
  amt.focus();
}

// Apply a rule to all its fillable months, mark the row, and commit. If clashes exist the
// rule is stored as a draft and the draft banner drives resolution. Writes can span every
// month in scope (e.g. "All future months"), so this snapshots the rule + every cell it's
// about to touch first and hands a single Undo back through the toast - one click reverts
// the whole multi-month write, instead of fixing each month by hand.
function commitRecurring(draft){
  const opts=_recOptsFor(draft.rowId);
  const clashes=FiRecurring.detectClashes(draft, opts);
  const rules=_recRules();
  const idx=rules.findIndex(r=>r.rowId===draft.rowId);
  const prevRule=idx>=0?JSON.parse(JSON.stringify(rules[idx])):null;
  function undoCommit(){
    const rr=_recRules(); const i2=rr.findIndex(r=>r.rowId===draft.rowId);
    if(prevRule){ if(i2>=0) rr[i2]=prevRule; else rr.push(prevRule); }
    else if(i2>=0){ rr.splice(i2,1); }
    markRowRecurring(draft.rowId, !!prevRule);
  }
  if(clashes.length){
    draft.draft=true;
    if(idx>=0) rules[idx]=draft; else rules.push(draft);
    markRowRecurring(draft.rowId, true);
    save(); render(); _recDraftBannerRefresh();
    showToast('🔁 Recurring needs review', false, 5000, ()=>{ undoCommit(); save(); render(); _recDraftBannerRefresh(); });
    return;
  }
  const fillMonths=FiRecurring.fillableMonths(draft, opts);
  const prevCellsByMonth={};
  fillMonths.forEach(mk2=>{
    const cols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
    const snap={};
    cols.forEach(c=>{ const key=mk2+'|'+draft.rowId+'|'+c.id; snap[key]=Object.prototype.hasOwnProperty.call(state.cells||{},key)?state.cells[key]:undefined; });
    prevCellsByMonth[mk2]=snap;
  });
  draft.draft=false;
  fillMonths.forEach(mk2=>_recWriteMonth(draft, mk2));
  if(idx>=0) rules[idx]=draft; else rules.push(draft);
  markRowRecurring(draft.rowId, true);
  save(); render(); _recDraftBannerRefresh();
  showToast('🔁 Recurring saved - '+fillMonths.length+' month'+(fillMonths.length===1?'':'s')+' updated', false, 5000, ()=>{
    undoCommit();
    Object.keys(prevCellsByMonth).forEach(mk2=>{
      const snap=prevCellsByMonth[mk2];
      if(!state.cells) state.cells={};
      Object.keys(snap).forEach(key=>{ if(snap[key]===undefined) delete state.cells[key]; else state.cells[key]=snap[key]; });
    });
    save(); render(); _recDraftBannerRefresh();
    showToast('↩ Recurring change undone.', false, 1800);
  });
}

function _writeMonthlyValue(rowId, mk2, val){
  _ensureMonthForked(mk2);
  const cols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
  if(!state.cells) state.cells={};
  cols.forEach((c,i)=>{
    const key=mk2+'|'+rowId+'|'+c.id;
    state.cells[key]=(i===0?String(val):'0');
    if(state.cellTimes) state.cellTimes[key]=Date.now();
  });
}

function _onRecurringCellEdit(rowId, mk2, newTotal){
  const rule=_recRuleFor(rowId);
  if(!rule){ _writeMonthlyValue(rowId, mk2, newTotal); save(); render(); return; }
  const curVal=FiRecurring.ruleValueForMonth(rule, mk2);
  if(Math.abs(curVal-newTotal)<1e-9){ _writeMonthlyValue(rowId, mk2, newTotal); save(); render(); return; }

  const m=_recModal();
  const h=document.createElement('h3'); h.style.cssText='margin:0 0 .5rem;font-size:1rem;color:var(--fg);';
  h.textContent='Apply this change to:'; m.panel.appendChild(h);
  const sub=document.createElement('p'); sub.style.cssText='margin:0 0 1rem;font-size:.82rem;color:var(--muted);';
  sub.textContent='This is a recurring source. Choose which months take the new amount.';
  m.panel.appendChild(sub);
  function opt(label, fn){
    const b=document.createElement('button'); b.type='button'; b.textContent=label;
    b.style.cssText='display:block;width:100%;margin-bottom:.5rem;padding:.6rem;border-radius:8px;border:1px solid var(--input-border);background:transparent;color:var(--fg);cursor:pointer;font-size:.9rem;text-align:left;';
    b.addEventListener('click',fn); m.panel.appendChild(b); return b;
  }
  opt('All months', ()=>{ m.close(); rule.amount=newTotal; rule.mode='monthly'; rule.weekly=null; rule.overrides={}; commitRecurring(rule); });
  opt('Specific months...', ()=>{ m.close(); _pickSpecificMonths(rule, newTotal); });
  opt('This month only', ()=>{ m.close(); if(!rule.overrides) rule.overrides={}; rule.overrides[mk2]=newTotal; _writeMonthlyValue(rowId, mk2, newTotal); save(); render(); _recDraftBannerRefresh(); });
  const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel';
  cancel.style.cssText='display:block;width:100%;margin-top:.3rem;padding:.55rem;border-radius:8px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:.85rem;';
  cancel.addEventListener('click',()=>{ m.close(); render(); });
  m.panel.appendChild(cancel);
}

function _pickSpecificMonths(rule, newTotal){
  const months=_existingMonths().filter(mk2=>FiRecurring.monthInScope(rule, mk2) && _rowExistsInMonth(rule.rowId, mk2)).sort();
  const m=_recModal();
  const h=document.createElement('h3'); h.style.cssText='margin:0 0 .8rem;font-size:1rem;color:var(--fg);'; h.textContent='Which months?'; m.panel.appendChild(h);
  const boxes={};
  months.forEach(mk2=>{
    const lbl=document.createElement('label'); lbl.style.cssText='display:flex;align-items:center;gap:.5rem;padding:.35rem 0;font-size:.9rem;color:var(--fg);';
    const cb=document.createElement('input'); cb.type='checkbox'; if(_isClosedMonth(mk2)){ cb.disabled=true; }
    boxes[mk2]=cb; lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(_recMkLabel(mk2)+(_isClosedMonth(mk2)?' (locked)':'')));
    m.panel.appendChild(lbl);
  });
  const actions=document.createElement('div'); actions.style.cssText='display:flex;gap:.5rem;margin-top:1rem;';
  const ok=document.createElement('button'); ok.type='button'; ok.textContent='Apply'; ok.style.cssText='flex:2;padding:.6rem;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;';
  const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel'; cancel.style.cssText='flex:1;padding:.6rem;border-radius:8px;border:1px solid var(--input-border);background:transparent;color:var(--fg);cursor:pointer;';
  cancel.addEventListener('click',()=>{ m.close(); render(); });
  ok.addEventListener('click',()=>{
    if(!rule.overrides) rule.overrides={};
    months.forEach(mk2=>{ if(boxes[mk2]&&boxes[mk2].checked){ rule.overrides[mk2]=newTotal; _writeMonthlyValue(rule.rowId, mk2, newTotal); } });
    m.close(); save(); render(); _recDraftBannerRefresh();
  });
  actions.appendChild(ok); actions.appendChild(cancel); m.panel.appendChild(actions);
}

function delinkMonth(rowId, mk2){
  const rule=_recRuleFor(rowId); if(!rule) return;
  if(!rule.exceptions) rule.exceptions=[];
  if(rule.exceptions.indexOf(mk2)<0) rule.exceptions.push(mk2);
  if(rule.overrides) delete rule.overrides[mk2];
  save(); render(); _recDraftBannerRefresh();
  showToast('Delinked '+_recMkLabel(mk2)+' from recurring', false, 5000, ()=>relinkMonth(rowId, mk2, true));
}

// Undo a delink, or manually re-include a month a rule's range/anchor still covers but that
// was previously excepted out. Re-applies the rule's value the same way commitRecurring does
// (skip if locked/mismatched -> draft for review, exactly like any other clash).
function relinkMonth(rowId, mk2, silent){
  const rule=_recRuleFor(rowId); if(!rule) return;
  if(rule.exceptions){ const i=rule.exceptions.indexOf(mk2); if(i>=0) rule.exceptions.splice(i,1); }
  if(!FiRecurring.monthInScope(rule, mk2)){
    save(); render(); _recDraftBannerRefresh();
    if(!silent) showToast(_recMkLabel(mk2)+' is outside this rule\'s scope, so relinking it alone had no effect.');
    return;
  }
  const opts=_recOptsFor(rowId);
  const clash=FiRecurring.detectClashes(rule, {existingMonths:[mk2], getMonthTotal:opts.getMonthTotal, isLocked:opts.isLocked});
  if(clash.length){
    rule.draft=true; markRowRecurring(rowId, true);
    save(); render(); _recDraftBannerRefresh();
    if(!silent) showToast('Relinked '+_recMkLabel(mk2)+' - needs review before it applies.');
    return;
  }
  _recWriteMonth(rule, mk2);
  save(); render(); _recDraftBannerRefresh();
  if(!silent) showToast('Relinked '+_recMkLabel(mk2)+' to recurring');
}

function removeRecurring(rowId){
  const rules=_recRules(); const idx=rules.findIndex(r=>r.rowId===rowId);
  if(idx>=0) rules.splice(idx,1);
  markRowRecurring(rowId, false);
  save(); render(); _recDraftBannerRefresh();
}

function _resolveClash(rowId, mk2, choice){
  const rule=_recRuleFor(rowId); if(!rule) return;
  if(choice==='apply'){
    if(_isClosedMonth(mk2)) _recUnlockMonth(mk2);
    _recWriteMonth(rule, mk2);
  } else {
    if(!rule.exceptions) rule.exceptions=[];
    if(rule.exceptions.indexOf(mk2)<0) rule.exceptions.push(mk2);
  }
  const opts=_recOptsFor(rowId);
  const remaining=FiRecurring.detectClashes(rule, opts);
  if(!remaining.length){
    rule.draft=false;
    FiRecurring.fillableMonths(rule, opts).forEach(m2=>_recWriteMonth(rule, m2));
  }
  save(); render(); _recDraftBannerRefresh();
}

// Clear every per-month override and rewrite the rule's in-scope, unlocked months from the
// base amount, so the amount shown in the config modal governs all of them again. Backs the
// modal's "reset those months" control.
function _recResetOverrides(rowId){
  const rule=_recRuleFor(rowId); if(!rule) return;
  rule.overrides={}; rule.draft=false;
  _existingMonths().filter(mk2=>FiRecurring.monthInScope(rule,mk2)&&_rowExistsInMonth(rowId,mk2)&&!_isClosedMonth(mk2))
    .forEach(mk2=>_recWriteMonth(rule,mk2));
  save(); render(); _recDraftBannerRefresh();
  showToast('Reset to '+fmt(rule.amount)+'/mo');
}

let _recDraftBannerEl=null;
function _recDraftBannerRefresh(){
  const drafts=_recRules().filter(r=>r.draft);
  let items=[];
  drafts.forEach(rule=>{
    const row=(state.rows||[]).find(r=>r.id===rule.rowId)||{};
    FiRecurring.detectClashes(rule, _recOptsFor(rule.rowId)).forEach(c=>{
      items.push({rowId:rule.rowId, label:row.label||'Source', mk:c.mk, reason:c.reason, want:c.want, have:c.have});
    });
  });
  if(_recDraftBannerEl){ _recDraftBannerEl.remove(); _recDraftBannerEl=null; }
  if(!items.length) return;
  const b=document.createElement('div'); b.className='rec-draft-banner';
  const head=document.createElement('div'); head.className='rec-draft-head';
  head.textContent='Recurring needs review - '+items.length+' month'+(items.length>1?'s':'')+' conflict before it can be applied.';
  b.appendChild(head);
  items.forEach(it=>{
    const row=document.createElement('div'); row.className='rec-draft-item';
    const txt=document.createElement('button'); txt.type='button'; txt.className='rec-draft-jump';
    txt.textContent=it.label+' - '+_recMkLabel(it.mk)+' ('+(it.reason==='locked'?'locked':'different value')+')';
    txt.addEventListener('click',()=>{ jumpToMonth(it.mk); });
    const ap=document.createElement('button'); ap.type='button'; ap.className='rec-draft-apply'; ap.textContent='Apply here';
    ap.addEventListener('click',()=>_confirmApplyClash(it));
    const sk=document.createElement('button'); sk.type='button'; sk.className='rec-draft-skip'; sk.textContent='Skip';
    sk.addEventListener('click',()=>_resolveClash(it.rowId, it.mk, 'skip'));
    row.appendChild(txt); row.appendChild(ap); row.appendChild(sk); b.appendChild(row);
  });
  document.body.appendChild(b); _recDraftBannerEl=b;
}
// Preview exactly what "Apply here" will overwrite before it does, so applying a conflict is
// never blind - the value written is the rule's, which may be a per-month override, not the
// base amount shown in the config modal.
function _confirmApplyClash(it){
  const m=_recModal();
  const h=document.createElement('h3'); h.style.cssText='margin:0 0 .6rem;font-size:1rem;color:var(--fg);';
  h.textContent='Apply recurring to '+_recMkLabel(it.mk)+'?'; m.panel.appendChild(h);
  const p=document.createElement('p'); p.style.cssText='margin:0 0 1rem;font-size:.85rem;color:var(--muted);line-height:1.5;';
  p.textContent = it.reason==='locked'
    ? it.label+' in '+_recMkLabel(it.mk)+' is a locked month. Applying unlocks it and sets it to '+fmt(it.want)+'.'
    : it.label+' in '+_recMkLabel(it.mk)+' currently holds '+fmt(it.have)+'. Applying replaces it with '+fmt(it.want)+'.';
  m.panel.appendChild(p);
  const actions=document.createElement('div'); actions.style.cssText='display:flex;gap:.5rem;';
  const ok=document.createElement('button'); ok.type='button'; ok.textContent='Replace with '+fmt(it.want);
  ok.style.cssText='flex:2;padding:.6rem;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:.9rem;';
  ok.addEventListener('click',()=>{ m.close(); _resolveClash(it.rowId, it.mk, 'apply'); });
  const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel';
  cancel.style.cssText='flex:1;padding:.6rem;border-radius:8px;border:1px solid var(--input-border);background:transparent;color:var(--fg);cursor:pointer;font-size:.9rem;';
  cancel.addEventListener('click',m.close);
  actions.appendChild(ok); actions.appendChild(cancel); m.panel.appendChild(actions);
}
function copyStructureFromPrevMonth(){
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  const mk2=currentMK();
  const [y,mo]=mk2.split('-').map(Number);
  const prev=new Date(y,mo-2);
  const prevMk=prev.getFullYear()+'-'+String(prev.getMonth()+1).padStart(2,'0');
  const prevRows=getRows(prevMk), prevCols=getCols(prevMk);
  if(!prevRows.length){showToast('No rows in previous month.');return;}
  const alreadyForked=state.rowsByMonth&&state.rowsByMonth[mk2];
  if(alreadyForked&&!confirm('This month already has its own structure. Overwrite with previous month\'s rows/columns?')) return;
  if(!state.rowsByMonth) state.rowsByMonth={};
  if(!state.colsByMonth) state.colsByMonth={};
  state.rowsByMonth[mk2]=prevRows.map(r=>({...r}));
  state.colsByMonth[mk2]=prevCols.map(c=>({...c}));
  save(); render();
  showToast('Copied structure from previous month');
}
function copyStructureFromMonth(sourceMk){
  const mk2=currentMK();
  if(_isClosedMonth(mk2)){showToast('🔒 Month is locked.');return;}
  if(sourceMk===mk2){showToast('Already on that month.');return;}
  const srcRows=getRows(sourceMk),srcCols=getCols(sourceMk);
  if(!srcRows.length){showToast('No rows in that month.');return;}
  const alreadyForked=state.rowsByMonth&&state.rowsByMonth[mk2];
  if(alreadyForked&&!confirm('This month already has its own structure. Overwrite with '+sourceMk+'\'s rows/columns?')) return;
  if(!state.rowsByMonth) state.rowsByMonth={};
  if(!state.colsByMonth) state.colsByMonth={};
  state.rowsByMonth[mk2]=srcRows.map(r=>({...r}));
  state.colsByMonth[mk2]=srcCols.map(c=>({...c}));
  save(); render();
  showToast('Copied structure from '+sourceMk);
}
function copyMonthToTargets(sourceMk, targetMks, overwrite){
  snapshot();
  const srcRows=getRows(sourceMk);
  const srcCols=getCols(sourceMk);
  targetMks.forEach(tMk=>{
    if(!state.rowsByMonth) state.rowsByMonth={};
    if(!state.colsByMonth) state.colsByMonth={};
    state.rowsByMonth[tMk]=srcRows.map(r=>({...r}));
    state.colsByMonth[tMk]=srcCols.map(c=>({...c}));
    Object.keys(state.cells).forEach(k=>{
      if(!k.startsWith(sourceMk+'|')) return;
      const newKey=tMk+k.slice(sourceMk.length);
      if(overwrite||!state.cells[newKey]) state.cells[newKey]=state.cells[k];
    });
    if(state.monthRowCurrencies){
      Object.keys(state.monthRowCurrencies).forEach(k=>{
        if(!k.startsWith(sourceMk+'|')) return;
        const newKey=tMk+k.slice(sourceMk.length);
        if(overwrite||!state.monthRowCurrencies[newKey])
          state.monthRowCurrencies[newKey]=state.monthRowCurrencies[k];
      });
    }
  });
  save(); render();
  showToast('Copied to '+targetMks.length+' month'+(targetMks.length>1?'s':'')+'.');
}

function openCopyToDropdown(e){
  const sourceMk=currentMK();
  const months=new Set();

  // Valid range: intersection of (source ±12) and (today ±12)
  // i.e. only months that are both near the source AND accessible via normal navigation
  const [_sy,_sm]=sourceMk.split('-');
  const srcDate=new Date(+_sy,+_sm-1,1);
  const today=new Date(); const todayDate=new Date(today.getFullYear(),today.getMonth(),1);
  const startDate=new Date(Math.max(
    new Date(srcDate).setMonth(srcDate.getMonth()-12),
    new Date(todayDate).setMonth(todayDate.getMonth()-12)
  ));
  const endDate=new Date(Math.min(
    new Date(srcDate).setMonth(srcDate.getMonth()+12),
    new Date(todayDate).setMonth(todayDate.getMonth()+12)
  ));
  const sweep=new Date(startDate);
  while(sweep<=endDate){
    const m=sweep.getFullYear()+'-'+String(sweep.getMonth()+1).padStart(2,'0');
    if(m!==sourceMk) months.add(m);
    sweep.setMonth(sweep.getMonth()+1);
  }

  const opts=[...months].sort();
  const menu=document.getElementById('dd-copy-to-menu');
  menu.innerHTML='';
  if(!opts.length){
    const em=document.createElement('div');em.style.cssText='padding:.5rem .75rem;font-size:.83rem;color:var(--muted);white-space:nowrap;';
    em.textContent='No other months available.';menu.appendChild(em);
    toggleDropdown('dd-copy-to',e);return;
  }
  const [sy,sm]=sourceMk.split('-');
  const hd=document.createElement('div');hd.className='copy-to-hd';
  hd.textContent='Copy '+new Date(+sy,+sm-1,1).toLocaleString('default',{month:'long',year:'numeric'})+' to:';
  menu.appendChild(hd);
  const pillsDiv=document.createElement('div');pillsDiv.className='copy-to-pills';
  opts.forEach(m=>{
    const [y,mo]=m.split('-');
    const pill=document.createElement('span');
    pill.className='copy-to-pill';
    pill.dataset.mk=m;
    pill.textContent=new Date(+y,+mo-1,1).toLocaleString('default',{month:'short',year:'numeric'});
    pill.addEventListener('click',ev=>{ev.stopPropagation();pill.classList.toggle('selected');});
    pillsDiv.appendChild(pill);
  });
  menu.appendChild(pillsDiv);
  const hr=document.createElement('hr');hr.className='copy-to-divider';menu.appendChild(hr);
  const copyBtn=document.createElement('button');copyBtn.className='copy-to-copy-btn';copyBtn.textContent='Copy';
  copyBtn.addEventListener('click',ev=>{
    ev.stopPropagation();
    const selected=[...menu.querySelectorAll('.copy-to-pill.selected')].map(p=>p.dataset.mk);
    if(!selected.length){showToast('Select at least one month.');return;}
    menu.classList.remove('open');
    copyMonthToTargets(sourceMk,selected,true);
  });
  menu.appendChild(copyBtn);
  toggleDropdown('dd-copy-to',e);
}

function showMonthCopyPicker(){
  const months=new Set();
  Object.keys(state.rowsByMonth||{}).forEach(m=>months.add(m));
  Object.keys(state.cells||{}).forEach(k=>{const m=k.split('|')[0];if(m&&m.match(/^\d{4}-\d{2}$/))months.add(m);});
  const cur=currentMK();
  const opts=[...months].filter(m=>m!==cur).sort();
  if(!opts.length){showToast('No other months with data found.');return;}
  const overlay=document.createElement('div');overlay.className='share-overlay';
  const modal=document.createElement('div');modal.className='share-modal';modal.style.maxWidth='340px';
  const h=document.createElement('h3');h.textContent='Copy structure from month';
  const sel=document.createElement('select');sel.style.cssText='width:100%;padding:.5rem;border:1px solid var(--input-border);border-radius:6px;background:var(--input-bg);color:var(--fg);font-size:.9rem;margin:.5rem 0;';
  opts.forEach(m=>{const o=document.createElement('option');o.value=m;const [y,mo]=m.split('-');o.textContent=new Date(+y,+mo-1,1).toLocaleString('default',{month:'long',year:'numeric'});sel.appendChild(o);});
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem;';
  const confirmBtn=document.createElement('button');confirmBtn.className='btn btn-sm';confirmBtn.textContent='Copy';
  confirmBtn.addEventListener('click',()=>{copyStructureFromMonth(sel.value);overlay.remove();});
  const cancelBtn=document.createElement('button');cancelBtn.className='btn btn-sm btn-ghost';cancelBtn.textContent='Cancel';
  cancelBtn.addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  actions.appendChild(cancelBtn);actions.appendChild(confirmBtn);
  modal.appendChild(h);modal.appendChild(sel);modal.appendChild(actions);
  overlay.appendChild(modal);document.body.appendChild(overlay);
}


var _sync=createSyncManager(STORAGE_KEY,'/api/save/income','/api/load/income',{
  getState:function(){return state;},
  onReload:function(){state=loadState();render();},
  onMerge:showToast,
  showQuotaWarning:showSaveQuotaWarning
});
var syncToServer=_sync.syncToServer;
var loadFromServer=_sync.loadFromServer;
var setSyncStatus=_sync.setSyncStatus;
var saveLocal=_sync.saveLocal;
// Stamps state.cellTimes[key]=now for any cell whose value changed since the last
// save, by diffing against the snapshot still sitting in localStorage (saveLocal()
// is about to overwrite it). One diff on every save() uniformly catches every way
// `cells` can change — typing, paste, bulk delete, import, undo/redo — without
// scattering Date.now() stamps across mutation sites. A key that just vanished
// (delete) gets stamped too: that's what marks it as a tombstone for the merge.
function _stampCellTimes(){
  if(!state.cellTimes) state.cellTimes={};
  let prevCells={};
  try{
    const prev=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(prev&&prev.cells) prevCells=prev.cells;
  }catch(_){}
  const now=Date.now();
  const keys=new Set([...Object.keys(prevCells),...Object.keys(state.cells)]);
  keys.forEach(k=>{ if(prevCells[k]!==state.cells[k]) state.cellTimes[k]=now; });
}
function save(){
  _stampCellTimes();
  saveLocal();
  // Mark that income was saved this walkthrough session so loadState() can restore it on Back.
  if(isWalkthroughActive())localStorage.setItem('fiapp_income_wt_session','1');
  try{ localStorage.setItem(PUSH_KEY, JSON.stringify({mk:currentMK(),total:grandTotal(),ts:Date.now()})); }catch{}
  syncToServer();
  document.dispatchEvent(new CustomEvent('fiapp-income-saved'));
  try{ _maybeCelebrateFirstEntry(currentMK()); }catch(_){}
}
function showSaveQuotaWarning(){
  if(document.getElementById('quota-warn')) return;
  const el=document.createElement('div'); el.id='quota-warn'; el.className='error';
  el.setAttribute('aria-live','polite');
  el.setAttribute('aria-atomic','true');
  el.style.cssText='position:fixed;bottom:calc(1rem + env(safe-area-inset-bottom, 0px));left:50%;transform:translateX(-50%);z-index:99999;max-width:420px;text-align:center;padding:.6rem 1rem;';
  el.textContent='⚠ Storage full - latest changes could not be saved. Export your data and clear some rows.';
  document.body.appendChild(el); setTimeout(()=>el.remove(),8000);
}
function showToast(msg, isError=false, duration=4000, undoCb=null){
  const el=document.createElement('div');
  el.setAttribute('data-wt-toast','1');
  el.setAttribute('aria-live','polite');
  el.setAttribute('aria-atomic','true');
  el.className=isError?'error':'success';
  el.style.cssText='position:fixed;bottom:calc(1rem + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);z-index:99999;max-width:480px;padding:.6rem 1rem;display:flex;align-items:center;gap:.75rem;white-space:pre-wrap;';
  const txt=document.createElement('span'); txt.textContent=msg; el.appendChild(txt);
  if(undoCb){
    const btn=document.createElement('button');
    btn.textContent='Undo';
    btn.style.cssText='background:none;border:1px solid currentColor;border-radius:4px;padding:.15rem .5rem;cursor:pointer;font-size:.85rem;color:inherit;white-space:nowrap;';
    btn.addEventListener('click',()=>{ undoCb(); el.remove(); });
    el.appendChild(btn);
  }
  document.body.appendChild(el); setTimeout(()=>el.remove(),duration);
}


let undoByMonth={}, redoByMonth={};
function loadHistory(){
  try{
    const u=sessionStorage.getItem(UNDO_KEY); if(u){const p=JSON.parse(u); if(p&&!Array.isArray(p)) undoByMonth=p;}
    const r=sessionStorage.getItem(REDO_KEY); if(r){const p=JSON.parse(r); if(p&&!Array.isArray(p)) redoByMonth=p;}
  }catch{}
}
function saveHistory(){
  try{
    sessionStorage.setItem(UNDO_KEY,JSON.stringify(undoByMonth));
    sessionStorage.setItem(REDO_KEY,JSON.stringify(redoByMonth));
  }catch{}
}
function _captureSlice(mk2){
  const mkPrefix=mk2+'|';
  const cellsSlice={};
  Object.keys(state.cells||{}).forEach(k=>{if(k.startsWith(mkPrefix)) cellsSlice[k]=state.cells[k];});
  return {
    cells:cellsSlice,
    rows:state.rowsByMonth?.[mk2]?JSON.parse(JSON.stringify(state.rowsByMonth[mk2])):null,
    cols:state.colsByMonth?.[mk2]?JSON.parse(JSON.stringify(state.colsByMonth[mk2])):null
  };
}
function _applySlice(mk2,entry){
  const mkPrefix=mk2+'|';
  if(!state.cells) state.cells={};
  Object.keys(state.cells).forEach(k=>{if(k.startsWith(mkPrefix)) delete state.cells[k];});
  Object.assign(state.cells,entry.cells);
  if(entry.rows!==null){if(!state.rowsByMonth) state.rowsByMonth={}; state.rowsByMonth[mk2]=entry.rows;}
  else if(state.rowsByMonth) delete state.rowsByMonth[mk2];
  if(entry.cols!==null){if(!state.colsByMonth) state.colsByMonth={}; state.colsByMonth[mk2]=entry.cols;}
  else if(state.colsByMonth) delete state.colsByMonth[mk2];
}
function _flashChangedRows(beforeCells,afterCells){
  const changed=new Set();
  const allKeys=new Set([...Object.keys(beforeCells||{}),...Object.keys(afterCells||{})]);
  allKeys.forEach(k=>{if((beforeCells||{})[k]!==(afterCells||{})[k]){const parts=k.split('|');if(parts.length>=3) changed.add(parts[1]);}});
  if(!changed.size) return;
  changed.forEach(rowId=>{
    const el=document.querySelector('tr[data-row-id="'+rowId+'"],div.mc-card[data-row-id="'+rowId+'"]');
    if(!el) return;
    el.style.transition='background-color 0s';
    el.style.backgroundColor='rgba(99,102,241,0.2)';
    requestAnimationFrame(()=>{el.style.transition='background-color 1.2s ease-out';el.style.backgroundColor='';});
  });
}
function snapshot(){
  const mk2=currentMK();
  if(!undoByMonth[mk2]) undoByMonth[mk2]=[];
  undoByMonth[mk2].push(_captureSlice(mk2));
  if(undoByMonth[mk2].length>60) undoByMonth[mk2].shift();
  if(!redoByMonth[mk2]) redoByMonth[mk2]=[];
  redoByMonth[mk2]=[];
  saveHistory(); updateHistBtns();
}
function undo(){
  const mk2=currentMK();
  if(_isClosedMonth(mk2)){showToast('🔒 Month is locked.');return;}
  const stack=undoByMonth[mk2];
  if(!stack||!stack.length) return;
  const beforeCells=Object.assign({},state.cells);
  if(!redoByMonth[mk2]) redoByMonth[mk2]=[];
  redoByMonth[mk2].push(_captureSlice(mk2));
  _applySlice(mk2,stack.pop());
  save(); saveHistory(); render(); updateHistBtns();
  _flashChangedRows(beforeCells,state.cells);
  showToast('↩ Undone.', false, 1800);
}
function redo(){
  const mk2=currentMK();
  if(_isClosedMonth(mk2)){showToast('🔒 Month is locked.');return;}
  const stack=redoByMonth[mk2];
  if(!stack||!stack.length) return;
  const beforeCells=Object.assign({},state.cells);
  if(!undoByMonth[mk2]) undoByMonth[mk2]=[];
  undoByMonth[mk2].push(_captureSlice(mk2));
  _applySlice(mk2,stack.pop());
  save(); saveHistory(); render(); updateHistBtns();
  _flashChangedRows(beforeCells,state.cells);
  showToast('↪ Redone.', false, 1800);
}
function updateHistBtns(){ const mk2=currentMK(); const u=document.getElementById('undo-btn'),r=document.getElementById('redo-btn'); if(u)u.disabled=!(undoByMonth[mk2]&&undoByMonth[mk2].length); if(r)r.disabled=!(redoByMonth[mk2]&&redoByMonth[mk2].length); }
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key==='z'){e.preventDefault();undo();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='z'))){e.preventDefault();redo();}
});


const today=new Date();
function mk(y,m){ return String(y)+'-'+String(m+1).padStart(2,'0'); }
function currentMK(){ return mk(state.currentYear,state.currentMonth); }
const minY=today.getFullYear()-1, minM=today.getMonth();
const maxY=today.getFullYear()+1, maxM=today.getMonth();
function isAtMin(){ return state.currentYear<minY||(state.currentYear===minY&&state.currentMonth<=minM); }
function isAtMax(){ return state.currentYear>maxY||(state.currentYear===maxY&&state.currentMonth>=maxM); }
function shiftMonth(d){
  let y=state.currentYear, m=state.currentMonth+d;
  if(m<0){y--;m=11;} if(m>11){y++;m=0;}
  state.currentYear=y; state.currentMonth=m;
  saveLocal(); updateMonthNav(); render(); updateHistBtns();
}
function populateMonthJump(){
  const sel=document.getElementById('month-jump'); if(!sel) return;
  const curMk=mk(state.currentYear,state.currentMonth);
  sel.innerHTML='';
  for(let y=minY;y<=maxY;y++){
    for(let m2=0;m2<12;m2++){
      if(y===minY&&m2<minM) continue;
      if(y===maxY&&m2>maxM) continue;
      const opt=document.createElement('option');
      const isClosed=_isClosedMonth(mk(y,m2));
      opt.value=mk(y,m2); opt.textContent=(isClosed?'🔒 ':'')+MONTHS_FULL[m2]+' '+y;
      if(mk(y,m2)===curMk) opt.selected=true;
      sel.appendChild(opt);
    }
  }
}
function jumpToMonth(mkStr){
  const parts=mkStr.split('-');
  state.currentYear=parseInt(parts[0],10);
  state.currentMonth=parseInt(parts[1],10)-1;
  const _mk=currentMK();
  if(!(state.rowsByMonth&&state.rowsByMonth[_mk]) && _recRules().some(r=>!r.draft&&FiRecurring.monthInScope(r,_mk))){
    if(_recFillNewMonth(_mk)) save();
  }
  saveLocal(); updateMonthNav(); render(); updateHistBtns();
}
function updateMonthNav(){
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  const sm=document.getElementById('summary-month');
  if(sm){
    sm.textContent=label;
    sm.querySelectorAll('.forecast-badge').forEach(b=>b.remove());
    if(isForecastMonth()){const b=document.createElement('span');b.className='forecast-badge';b.textContent='📋 Forecast';sm.appendChild(b);}
  }
  document.getElementById('prev-btn').disabled=isAtMin();
  document.getElementById('next-btn').disabled=isAtMax();
  populateMonthJump();
  updateForecastUI();
  updateCloseBar();
  updateMonthContextNote();
}
// W2: explain the per-month "fork" inline — rows, columns, and per-row
// currencies are each month's own copy (see forkCurrentMonth()), which
// surprises people editing a past/future month expecting it to affect "now".
// Plain orientation text, kept deliberately distinct from the close-bar's
// "closed/locked" vocabulary (that's about edit permission, not data scoping).
function updateMonthContextNote(){
  const note=document.getElementById('month-context-note');
  if(!note) return;
  const now=new Date();
  if(currentMK()===mk(now.getFullYear(),now.getMonth())){ note.style.display='none'; return; }
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  note.textContent='📅 Viewing '+label+' - sources, columns, and currencies here belong to '+label+' only; other months keep their own.';
  note.style.display='block';
}

// ── Monthly Close Flow ────────────────────────────────────────────────────
function _hasDataForMonth(mk2){
  return Object.keys(state.cells||{}).some(k=>k.startsWith(mk2+'|')&&parseFloat(state.cells[k])>0);
}
// B (Playful): first time a fresh month gains income data this session, fire a one-off
// celebration. Personality-gated (near-instant no-op for Default/Quiet) and idempotent per
// month/session via sessionStorage. Caller wraps in try/catch so it can never break save().
function _maybeCelebrateFirstEntry(mk2){
  if(!window.fiappCelebrate || (window.fiappPersonality&&fiappPersonality()!=='playful')) return;
  if(_monthsWithDataAtLoad&&_monthsWithDataAtLoad.has(mk2)) return; // already had data before this session
  var key='fiapp_firstentry_inc_'+mk2;
  try{ if(sessionStorage.getItem(key)) return; }catch(_){ return; }
  if(!_hasDataForMonth(mk2)) return;
  try{ sessionStorage.setItem(key,'1'); }catch(_){}
  fiappCelebrate({confetti:true, mascot:'First income logged. Nice.'});
}
function _isPastMonth(){
  const now=new Date();
  const nowMk=mk(now.getFullYear(),now.getMonth());
  return currentMK()<nowMk;
}
function _isClosedMonth(mk2){
  return !!(state.closedMonths&&state.closedMonths[mk2]);
}
function reopenMonth(){
  const mk2=currentMK();
  if(state.closedMonths) delete state.closedMonths[mk2];
  saveLocal(); save();
  updateCloseBar(); populateMonthJump(); render();
}
function _incomeTotalForMonth(mk2){
  let total=0;
  const rows=getRows(mk2);
  rows.filter(r=>!r.parentId).forEach(row=>{
    const kids=rows.filter(c=>c.parentId===row.id);
    if(kids.length){ kids.forEach(child=>{ (state.cols||[]).forEach(col=>{ total+=parseFloat((state.cells||{})[mk2+'|'+child.id+'|'+col.id]||0)||0; }); }); }
    else { (state.cols||[]).forEach(col=>{ total+=parseFloat((state.cells||{})[mk2+'|'+row.id+'|'+col.id]||0)||0; }); }
  });
  return total;
}
function updateCloseBar(){
  const bar=document.getElementById('close-bar');
  if(!bar) return;
  const mk2=currentMK();
  const btn=bar.querySelector('button');
  if(_isClosedMonth(mk2)){
    document.getElementById('close-bar-text').innerHTML='🔒 <strong>Closed</strong> - this month is locked.';
    if(btn){ btn.textContent='Reopen ↩'; btn.onclick=reopenMonth; }
    bar.style.display='flex'; return;
  }
  if(!_isPastMonth()||!_hasDataForMonth(mk2)){
    bar.style.display='none'; return;
  }
  if(btn){ btn.textContent='Review & close ✓'; btn.onclick=openCloseModal; }
  const total=_incomeTotalForMonth(mk2);
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  document.getElementById('close-bar-text').textContent='📋 Close '+label+'? - $'+total.toFixed(2)+' income logged';
  bar.style.display='flex';
}
function openCloseModal(){
  const mk2=currentMK();
  const total=_incomeTotalForMonth(mk2);
  let py=state.currentYear, pm=state.currentMonth-1;
  if(pm<0){py--;pm=11;}
  const pmk2=mk(py,pm);
  const prevTotal=_incomeTotalForMonth(pmk2);
  const delta=prevTotal>0?total-prevTotal:null;
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  let details='<strong>'+escapeHtml(label)+'</strong><br>Income logged: $'+total.toFixed(2);
  if(delta!==null){ details+='<br><span style="color:var(--muted);font-size:.85rem">'+(delta>=0?'↑ $'+delta.toFixed(2)+' vs prev month':'↓ $'+Math.abs(delta).toFixed(2)+' vs prev month')+'</span>'; }
  let topRow='', topVal=0;
  const rows=getRows(mk2);
  rows.filter(r=>!r.parentId).forEach(row=>{
    const kids=rows.filter(c=>c.parentId===row.id);
    let rowTotal=0;
    if(kids.length){ kids.forEach(child=>{ (state.cols||[]).forEach(col=>{ rowTotal+=parseFloat((state.cells||{})[mk2+'|'+child.id+'|'+col.id]||0)||0; }); }); }
    else { (state.cols||[]).forEach(col=>{ rowTotal+=parseFloat((state.cells||{})[mk2+'|'+row.id+'|'+col.id]||0)||0; }); }
    if(rowTotal>topVal){ topVal=rowTotal; topRow=row.label; }
  });
  if(topRow) details+='<br><span style="color:var(--muted);font-size:.85rem">Top source: '+escapeHtml(topRow)+' ($'+topVal.toFixed(2)+')</span>';
  document.getElementById('close-modal-body').innerHTML=details;
  const overlay=document.getElementById('close-modal-overlay');
  if(!overlay) return;
  overlay.style.display='flex';
  _trapModalFocus(overlay);
}
function confirmClose(){
  const mk2=currentMK();
  if(!state.closedMonths) state.closedMonths={};
  state.closedMonths[mk2]=Date.now();
  saveLocal(); save();
  _closeModalOverlay();
  updateCloseBar();
  populateMonthJump();
  // Re-render so the month's read-only state applies immediately, not only after nav.
  render();
  if(window.fiappCelebrate){
    const total=_incomeTotalForMonth(mk2);
    let py=state.currentYear, pm=state.currentMonth-1;
    if(pm<0){py--;pm=11;}
    const prevTotal=_incomeTotalForMonth(mk(py,pm));
    const _up=prevTotal>0&&total>prevTotal;
    fiappCelebrate({confetti:true, big:_up, mascot:_up?'Month closed - income is up. Nice.':'Month closed.'});
  }
}
function cancelClose(){
  _closeModalOverlay();
}
// W8c: focus trap + Esc-close + focus restore for the close-month dialog —
// extends the pattern the small popups already use (Esc removes, focus the
// first control) to a full dialog with multiple controls and a real backdrop.
let _closeModalOpener=null;
function _modalFocusables(overlay){
  return Array.from(overlay.querySelectorAll('button:not([disabled]),[tabindex]:not([tabindex="-1"])'));
}
function _modalKeydown(e){
  const overlay=document.getElementById('close-modal-overlay');
  if(!overlay||overlay.style.display==='none') return;
  if(e.key==='Escape'){ e.preventDefault(); cancelClose(); return; }
  if(e.key==='Tab'){
    const f=_modalFocusables(overlay);
    if(!f.length) return;
    const first=f[0], last=f[f.length-1];
    if(e.shiftKey){ if(document.activeElement===first){ e.preventDefault(); last.focus(); } }
    else { if(document.activeElement===last){ e.preventDefault(); first.focus(); } }
  }
}
function _trapModalFocus(overlay){
  _closeModalOpener=document.activeElement;
  document.addEventListener('keydown',_modalKeydown);
  const f=_modalFocusables(overlay);
  if(f.length) f[0].focus();
}
function _closeModalOverlay(){
  const overlay=document.getElementById('close-modal-overlay');
  if(overlay) overlay.style.display='none';
  document.removeEventListener('keydown',_modalKeydown);
  if(_closeModalOpener&&typeof _closeModalOpener.focus==='function') _closeModalOpener.focus();
  _closeModalOpener=null;
}

function isForecastMonth(){
  const now=new Date();
  return state.currentYear>now.getFullYear()||(state.currentYear===now.getFullYear()&&state.currentMonth>now.getMonth());
}
function updateForecastUI(){
  const fc=isForecastMonth();
  const bar=document.getElementById('forecast-bar');
  if(bar) bar.style.display=fc?'flex':'none';
  const sb=document.getElementById('summary-bar');
  if(sb) sb.classList.toggle('forecast-panel',fc);
}
function copyLastMonth(){
  if(!isForecastMonth()) return;
  snapshot();
  let py=state.currentYear, pm=state.currentMonth-1;
  if(pm<0){py--;pm=11;}
  const prevMk=mk(py,pm), curMk=currentMK();
  let copied=0;
  Object.keys(state.cells).forEach(k=>{
    if(!k.startsWith(prevMk+'|')) return;
    const newKey=curMk+k.slice(prevMk.length);
    if(!state.cells[newKey]){state.cells[newKey]=state.cells[k];copied++;}
  });
  save(); render();
  showForecastToast(copied?`Copied ${copied} values from ${MONTHS_SHORT[pm]} ${py}.`:'All cells already have values - nothing to copy.');
}
function useAverages(){
  if(!isForecastMonth()) return;
  snapshot();
  const curMk=currentMK();
  const srcMonths=[];
  for(let i=1;i<=3;i++){
    let pm=state.currentMonth-i, py=state.currentYear;
    if(pm<0){py--;pm+=12;}
    srcMonths.push(mk(py,pm));
  }
  let filled=0, hasHistory=false;
  getRows().forEach(r=>{
    getCols().forEach(col=>{

      const usdVals=srcMonths.map(m=>{
        const raw=safeNum(state.cells[m+'|'+r.id+'|'+col.id]);
        return raw>0 ? amountToUSD(raw,m,r.id) : 0;
      }).filter(v=>v>0);
      if(!usdVals.length) return;
      hasHistory=true;
      const avg=(usdVals.reduce((a,b)=>a+b,0)/usdVals.length).toFixed(2);
      state.cells[curMk+'|'+r.id+'|'+col.id]=avg;
      filled++;
    });
  });
  save(); render();
  showForecastToast(hasHistory?`Updated ${filled} cells using up to 3-month averages.`:'No historical data found in the 3 months before this forecast period.');
}
function showForecastToast(msg){
  let t=document.getElementById('forecast-toast');
  if(!t){t=document.createElement('div');t.id='forecast-toast';t.className='forecast-toast';t.setAttribute('aria-live','polite');t.setAttribute('aria-atomic','true');document.body.appendChild(t);}
  t.textContent=msg; t.classList.add('show');
  clearTimeout(window._fcToastT);
  window._fcToastT=setTimeout(()=>t.classList.remove('show'),3500);
}


function ck(rId,cId){ return currentMK()+'|'+rId+'|'+cId; }
function getRawCell(rId,cId){ return state.cells[ck(rId,cId)]||''; }
function getCell(rId,cId){ return safeNum(state.cells[ck(rId,cId)]); }
function setCell(rId,cId,v){ state.cells[ck(rId,cId)]=v; save(); }


function children(rId, mk2){ return getRows(mk2).filter(r=>r.parentId===rId); }
function hasChildren(rId, mk2){ return getRows(mk2).some(r=>r.parentId===rId); }
function isCollapsed(rId){ return state.collapsed[rId]===true; }


function rowTotalUSD(rId){

  const kids=children(rId);
  if(kids.length) return kids.reduce((s,c)=>s+rowTotalUSD(c.id),0);
  return getCols().reduce((s,col)=>s+amountToUSD(getCell(rId,col.id), currentMK(), rId),0);
}
function rowTotal(rId){
  
  const usd=rowTotalUSD(rId);
  return usd*currentRate;
}
function grandTotal(){
  const usd=getRows().filter(r=>!r.parentId).reduce((s,r)=>s+rowTotalUSD(r.id),0);
  return usd;
}
function salaryTotal(){

  return getRows()
    .filter(r=>!r.parentId && r.label.trim().toLowerCase()==='salary')
    .reduce((s,r)=>s+rowTotalUSD(r.id),0);
}
function grandTotalDisplay(){
  return grandTotal()*currentRate;
}
function colTotal(cId){
  return getRows().filter(r=>!r.parentId).reduce((s,r)=>{
    if(hasChildren(r.id)) return s+children(r.id).reduce((cs,c)=>cs+amountToUSD(getCell(c.id,cId), currentMK(), c.id),0);
    return s+amountToUSD(getCell(r.id,cId), currentMK(), r.id);
  },0);
}
function fmt(n){ return '$'+Math.max(0,n).toFixed(2); }

function updateRowTotal(rId){
  const el=document.getElementById('rt-'+rId); if(el) el.textContent=fmt(rowTotal(rId));
  const row=getRows().find(r=>r.id===rId);
  if(row&&row.parentId){ updateRowTotal(row.parentId); updateParentSumCells(row.parentId); }
}
function updateParentSumCells(pId){
  getCols().forEach(col=>{
    const el=document.getElementById('ps-'+pId+'-'+col.id);
    if(el){
      const s=children(pId).reduce((t,c)=>t+getCell(c.id,col.id),0);
      el.textContent=s>0?fmt(s):'';
    }
  });
}
function updateColFooter(cId){
  const el=document.getElementById('ct-'+cId); if(el) el.textContent=fmt(colTotal(cId));
}
function updateGrandTotal(){
  const el=document.getElementById('gt'); if(el) el.textContent=fmt(grandTotal());
  getCols().forEach(col=>updateColFooter(col.id));
  updateSummaryBar();
}
function updateAll(rId){ updateRowTotal(rId); updateGrandTotal(); if(chartVisible) renderChart(); }


// W2: empty-state teaching for the per-row currency selector — explains it
// the first time there's a row to show it on. Hidden permanently once
// dismissed, or once the user has actually used it (set a non-default currency).
function updateCurrencyHint(){
  const el=document.getElementById('currency-hint');
  if(!el) return;
  if(localStorage.getItem('fiapp_currency_hint_dismissed')==='1' || getRows().filter(r=>!r.parentId).length===0 || Object.keys(state.monthRowCurrencies||{}).length>0){
    el.style.display='none';
    return;
  }
  el.style.display='flex';
  const dismissBtn=document.getElementById('currency-hint-dismiss');
  if(dismissBtn) dismissBtn.onclick=function(){
    localStorage.setItem('fiapp_currency_hint_dismissed','1');
    el.style.display='none';
  };
}
// Batch D Wave 4: stat-strip delta vs last month, alongside the pre-existing totals.
function _prevMK(mk2){
  var parts=mk2.split('-'); var py=parseInt(parts[0],10), pm=parseInt(parts[1],10)-1;
  pm--; if(pm<0){py--;pm=11;}
  return mk(py,pm);
}
function _prevMonthTotalUSD(mk2){
  return getRows(mk2).filter(function(r){return !r.parentId;}).reduce(function(s,r){return s+rowTotalForMonthKey(r.id,mk2);},0);
}
function updateSummaryBar(){
  const totalUSD=grandTotal();
  const el=document.getElementById('disp-total');
  const annualEl=document.getElementById('disp-annual');
  const convEl=document.getElementById('disp-conv');
  if(el) el.textContent=totalUSD>0?'$'+totalUSD.toFixed(2):'$0.00';
  const deltaEl=document.getElementById('stat-total-delta');
  if(deltaEl){
    const prevUSD=_prevMonthTotalUSD(_prevMK(currentMK()));
    if(prevUSD>0){
      const pct=Math.round((totalUSD-prevUSD)/prevUSD*100);
      deltaEl.className='stat-delta '+(pct>0?'good':pct<0?'bad':'neutral');
      deltaEl.innerHTML='<svg class="fi-ico" aria-hidden="true"><use href="/static/icons/ui-sprite.svg?v='+(window.ASSET_V||'')+'#'+(pct>=0?'fi-arrow-up-right':'fi-arrow-down-right')+'"/></svg>'+
        (pct>=0?'+':'')+pct+'% vs last month';
    } else {
      deltaEl.className='stat-delta neutral';
      deltaEl.textContent='';
    }
  }
  if(annualEl) annualEl.textContent=totalUSD>0?'$'+(totalUSD*12).toFixed(2):'-';
  if(convEl&&currentRate!==1){
    const cur=state.displayCurrency||'USD';
    convEl.textContent=totalUSD>0?cur+' '+(totalUSD*currentRate).toFixed(2):'-';
    const annualConvEl=document.getElementById('conv-annual');
    if(annualConvEl) annualConvEl.textContent=totalUSD>0?cur+' '+(totalUSD*12*currentRate).toFixed(2):'-';
  }
  
  const salaryUSD=salaryTotal();
  const taxLink=document.getElementById('tax-calc-link');
  if(taxLink&&salaryUSD>0){
    taxLink.href='/tax?annual='+Math.round(salaryUSD*12);
    taxLink.style.display='';
  } else if(taxLink){
    taxLink.style.display='none';
  }
}


function toggleCollapse(rowId){ snapshot(); state.collapsed[rowId]=!isCollapsed(rowId); save(); render(); }
function expandAll(){ snapshot(); getRows().filter(r=>!r.parentId&&hasChildren(r.id)).forEach(r=>state.collapsed[r.id]=false); save(); render(); }
function collapseAll(){ snapshot(); getRows().filter(r=>!r.parentId&&hasChildren(r.id)).forEach(r=>state.collapsed[r.id]=true); save(); render(); }


let openMenu=null;
function closeMenu(){ if(openMenu){openMenu.remove();openMenu=null;} }
document.addEventListener('click',e=>{ if(!e.target.closest('.sub-dropdown')&&!e.target.closest('.sub-menu')) closeMenu(); });

let _gearMenuEl=null;
function _closeGearMenu(){ if(_gearMenuEl){_gearMenuEl.remove();_gearMenuEl=null;} }
document.addEventListener('pointerdown',e=>{ if(!e.target.closest('.row-gear-menu')&&!e.target.closest('.row-gear-btn')) _closeGearMenu(); });

function _openGearMenu(btn, row, rhTd, swatch, textSwatch, isChild){
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  _closeGearMenu();
  document.querySelectorAll('input[data-gear-clr]').forEach(el=>el.remove());

  const menu=document.createElement('div'); menu.className='row-gear-menu';

  function mBtn(label,fn){
    const b=document.createElement('button');b.textContent=label;
    b.addEventListener('click',e=>{e.stopPropagation();_closeGearMenu();fn();});
    menu.appendChild(b);
  }

  function mColorItem(labelText, initVal, onInput){
    const id='_gc_'+Math.random().toString(36).slice(2,8);
    const inp=document.createElement('input');
    inp.type='color';inp.id=id;inp.value=initVal;
    inp.setAttribute('data-gear-clr','1');
    inp.style.cssText='position:fixed;opacity:0;top:50%;left:50%;pointer-events:none;';
    inp.addEventListener('input',()=>onInput(inp.value));
    inp.addEventListener('change',()=>{ _closeGearMenu();save();inp.remove(); });
    document.body.appendChild(inp);
    const lbl=document.createElement('label');lbl.htmlFor=id;lbl.textContent=labelText;
    lbl.addEventListener('click',e=>e.stopPropagation());
    menu.appendChild(lbl);
  }

  mColorItem('🎨 Background colour', row.color||'#ffffff',
    v=>{ row.color=v;rhTd.style.backgroundColor=v;if(swatch)swatch.style.backgroundColor=v;if(textSwatch)textSwatch.style.backgroundColor=v; }
  );
  mColorItem('🔤 Text colour', row.textColor||'#1f2937',
    v=>{ row.textColor=v;const lbl=rhTd.querySelector('.row-label');if(lbl)lbl.style.color=v;if(textSwatch)textSwatch.style.color=v; }
  );

  if(!isChild){
    mBtn('＋ Add sub-source',()=>{ showSubMenu(btn,row); });
  }
  if(_recEligible(row, isChild)){
    const _rule=_recRuleFor(row.id);
    mBtn(_rule?'🔁 Edit recurring':'🔁 Mark recurring',()=>{ openRecurringConfig(row.id); });
    if(_rule){
      const _isExcepted=(_rule.exceptions||[]).indexOf(currentMK())>=0;
      mBtn(_isExcepted?'🔗 Relink this month':'⛓ Delink this month',()=>{ _isExcepted?relinkMonth(row.id, currentMK()):delinkMonth(row.id, currentMK()); });
      mBtn('✖ Remove recurring',()=>{ removeRecurring(row.id); });
    }
  }
  mBtn('🗑 Delete row',()=>{ deleteRow(row.id); });

  const r=btn.getBoundingClientRect();
  const left=Math.max(4,Math.min(r.left,window.innerWidth-180));
  menu.style.cssText=`position:fixed;top:${r.bottom+4}px;left:${left}px;z-index:9999;`;
  document.body.appendChild(menu);
  _gearMenuEl=menu;
  // Flip upward if menu clips the bottom of the viewport
  const mh=menu.getBoundingClientRect().height;
  if(r.bottom+4+mh>window.innerHeight-8){
    menu.style.top=Math.max(8,r.top-4-mh)+'px';
  }
}

function renderOtherForm(menu, row){
  menu.innerHTML='';
  const f=document.createElement('div'); f.className='sub-other-form';
  const inp=document.createElement('input'); inp.type='text'; inp.placeholder='Custom sub-source'; inp.maxLength=40;
  const err=document.createElement('span'); err.className='sub-other-err';
  const btnRow=document.createElement('div'); btnRow.className='row';
  const ok=document.createElement('button'); ok.className='ok'; ok.textContent='Add';
  const cancel=document.createElement('button'); cancel.className='cancel'; cancel.textContent='Cancel';
  btnRow.appendChild(ok); btnRow.appendChild(cancel);
  f.appendChild(inp); f.appendChild(err); f.appendChild(btnRow);
  menu.appendChild(f);
  setTimeout(()=>inp.focus(),20);

  function tryAdd(){
    const name=inp.value.trim(); err.textContent='';
    if(!name){ err.textContent='Enter a name.'; return; }
    const lower=name.toLowerCase();
    const existing=children(row.id).map(c=>c.label.toLowerCase());
    const mainCat=CAT_KEYS.find(k=>k===row.label)||CAT_KEYS.find(k=>CATEGORIES[k].includes(row.label));
    const builtins = mainCat ? CATEGORIES[mainCat].map(s=>s.toLowerCase()) : [];
    if(existing.includes(lower)||builtins.includes(lower)){
      err.textContent='"'+name+'" already exists in this category.'; return;
    }
    addSubRow(row,name); closeMenu();
  }
  ok.addEventListener('click',e=>{e.stopPropagation();tryAdd();});
  cancel.addEventListener('click',e=>{e.stopPropagation();closeMenu();});
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();tryAdd();} if(e.key==='Escape'){closeMenu();} });
}

function showSubMenu(btn, row){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  closeMenu();
  let subs=[];
  const mainCat=CAT_KEYS.find(k=>k===row.label)||CAT_KEYS.find(k=>CATEGORIES[k].includes(row.label));
  if(mainCat) subs=CATEGORIES[mainCat].filter(s=>!children(row.id).some(c=>c.label===s));

  const menu=document.createElement('div'); menu.className='sub-menu';

  if(mainCat&&subs.length){
    subs.forEach(s=>{
      const item=document.createElement('button'); item.className='sub-menu-item'; item.textContent=s;
      item.addEventListener('click',e=>{e.stopPropagation();addSubRow(row,s);closeMenu();});
      menu.appendChild(item);
    });
  } else if(!mainCat) {
    CAT_KEYS.forEach(cat=>{
      const g=document.createElement('div'); g.className='sub-menu-group'; g.textContent=cat; menu.appendChild(g);
      CATEGORIES[cat].forEach(s=>{
        const item=document.createElement('button'); item.className='sub-menu-item'; item.textContent=s;
        item.addEventListener('click',e=>{e.stopPropagation();addSubRow(row,s);closeMenu();});
        menu.appendChild(item);
      });
    });
  }

  const other=document.createElement('button'); other.className='sub-menu-item sub-other'; other.textContent='+ Other (custom)…';
  other.addEventListener('click',e=>{e.stopPropagation();renderOtherForm(menu,row);});
  menu.appendChild(other);

  const rect=btn.getBoundingClientRect();
  menu.style.top=(rect.bottom+4)+'px';
  menu.style.left=rect.left+'px';
  document.body.appendChild(menu);
  openMenu=menu;
  const mRect=menu.getBoundingClientRect();
  if(mRect.bottom > window.innerHeight - 8){
    menu.style.top=(rect.top - menu.offsetHeight - 4)+'px';
  }
  if(mRect.right > window.innerWidth - 8){
    menu.style.left=Math.max(4, window.innerWidth - mRect.width - 8)+'px';
  }
}


function addRow(){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  forkCurrentMonth();
  const mk2=currentMK();
  if(getRows(mk2).filter(r=>!r.parentId).length>=MAX_ROWS){showToast('Maximum '+MAX_ROWS+' rows per month.');return;}
  snapshot();
  const usedLabels=getRows(mk2).filter(r=>!r.parentId).map(r=>r.label);
  const nextCat=CAT_KEYS.find(k=>!usedLabels.includes(k))||'Salary';
  state.rowsByMonth[mk2].push({id:uid(),label:nextCat,color:CAT_COLORS[nextCat]||'#e5e7eb',textColor:'#1f2937',height:36,parentId:null});
  save(); render();
}
function addSubRow(parentRow, subLabel){
  forkCurrentMonth();
  const mk2=currentMK();
  if(getRows(mk2).length>=MAX_ROWS){showToast('Maximum '+MAX_ROWS+' rows per month.');return;}
  snapshot();
  const rows=state.rowsByMonth[mk2];
  const parentIdx=rows.findIndex(r=>r.id===parentRow.id);
  const kids=rows.reduce((acc,r,i)=>r.parentId===parentRow.id?[...acc,i]:acc,[]);
  const insertIdx=kids.length?Math.max(...kids)+1:parentIdx+1;
  rows.splice(insertIdx,0,{id:uid(),label:subLabel,color:parentRow.color,textColor:parentRow.textColor||'#1f2937',height:32,parentId:parentRow.id});
  state.collapsed[parentRow.id]=false;
  save(); render();
}
function addCol(){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  forkCurrentMonth();
  const mk2=currentMK();
  if(getCols(mk2).length>=MAX_COLS){showToast('Maximum '+MAX_COLS+' columns per month.');return;}
  snapshot();
  state.colsByMonth[mk2].push({id:uid(),label:'New Column',width:120});
  save(); render();
}
function deleteRow(id){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  forkCurrentMonth();
  snapshot();
  const mk2=currentMK();
  const rowToDelete=getRows(mk2).find(r=>r.id===id);
  const parentId=rowToDelete?rowToDelete.parentId:null;
  const kids=getRows(mk2).filter(r=>r.parentId===id).map(r=>r.id);
  const toDelete=[id,...kids];
  state.rowsByMonth[mk2]=getRows(mk2).filter(r=>!toDelete.includes(r.id));
  Object.keys(state.cells).forEach(k=>{ if(toDelete.some(d=>k.includes('|'+d+'|'))) delete state.cells[k]; });
  const lastChildGone=parentId&&!getRows(mk2).some(r=>r.parentId===parentId);
  if(lastChildGone){
    Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|'+parentId+'|')) delete state.cells[k]; });
  }
  save();
  if(lastChildGone){
    render();
  } else {
    (function(){var tbody=document.querySelector('#sheet tbody');if(!tbody){render();return;}toDelete.forEach(function(rId){var tr=tbody.querySelector('[data-tr-row-id="'+rId+'"]');if(tr)tr.remove();});updateGrandTotal();})();
  }
  showToast('Row deleted.', false, 5000, undo);
}
function deleteCol(id){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  forkCurrentMonth();
  snapshot();
  const mk2=currentMK();
  state.colsByMonth[mk2]=getCols(mk2).filter(c=>c.id!==id);
  Object.keys(state.cells).filter(k=>k.endsWith('|'+id)).forEach(k=>delete state.cells[k]);
  save(); render();
  showToast('Column deleted.', false, 5000, undo);
}

function moveParentRow(fromId, toId, before){
  if(fromId===toId) return;
  forkCurrentMonth();
  snapshot();
  const mk2=currentMK();
  const rows=state.rowsByMonth[mk2];
  const fromGroup=[fromId,...rows.filter(r=>r.parentId===fromId).map(r=>r.id)];
  const fromRows=fromGroup.map(id=>rows.find(r=>r.id===id)).filter(Boolean);
  state.rowsByMonth[mk2]=rows.filter(r=>!fromGroup.includes(r.id));
  const arr=state.rowsByMonth[mk2];
  const toParentIdx=arr.findIndex(r=>r.id===toId);
  if(toParentIdx===-1){arr.push(...fromRows);save();render();return;}
  if(before){
    arr.splice(toParentIdx,0,...fromRows);
  } else {
    const toKids=arr.reduce((acc,r,i)=>r.parentId===toId?[...acc,i]:acc,[]);
    const insertAfter=toKids.length?Math.max(...toKids):toParentIdx;
    arr.splice(insertAfter+1,0,...fromRows);
  }
  save(); render();
}
let _dragRowId=null;
let _activeDropEl=null;
let _dragColId=null;


function escapeHtml(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function safeNum(v,max=1e12){
  const n=parseFloat(v);
  return (isFinite(n)&&n>=-max&&n<=max)?n:0;
}


let chartInstance=null, chartVisible=false, chartMode='monthly', chartType='bar';
function toggleChart(){
  chartVisible=!chartVisible;
  document.getElementById('chart-section').style.display=chartVisible?'block':'none';
  document.getElementById('chart-btn').textContent=chartVisible?'📊 Hide Chart':'📊 Chart';
  if(chartVisible) renderChart();
}
function setChartMode(mode){
  chartMode=mode;
  document.getElementById('chart-mode-m').classList.toggle('active',mode==='monthly');
  document.getElementById('chart-mode-y').classList.toggle('active',mode==='yearly');
  renderChart();
}
function setChartType(type){
  chartType=type;
  document.getElementById('chart-type-bar').classList.toggle('active',type==='bar');
  document.getElementById('chart-type-doughnut').classList.toggle('active',type==='doughnut');
  renderChart();
}
function rowTotalForMonthKey(rId, monthKey){
  const kids=getRows(monthKey).filter(r=>r.parentId===rId);
  if(kids.length) return kids.reduce((s,c)=>s+rowTotalForMonthKey(c.id,monthKey),0);
  return getCols(monthKey).reduce((s,col)=>{
    const k=monthKey+'|'+rId+'|'+col.id;
    return s+amountToUSD(parseFloat(state.cells[k])||0, monthKey, rId);
  },0);
}
function rowTotalForYear(rId,year){
  let t=0; for(let m=0;m<12;m++) t+=rowTotalForMonthKey(rId,mk(year,m)); return t;
}
function renderChart(){
  if(!chartVisible) return;
  const topRows=getRows().filter(r=>!r.parentId);
  let data, topLabel;
  if(chartMode==='yearly'){
    data=topRows.map(r=>({label:r.label,value:rowTotalForYear(r.id,state.currentYear),color:r.color})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
    topLabel='Top Income - '+state.currentYear;
  } else {
    data=topRows.map(r=>({label:r.label,value:rowTotal(r.id),color:r.color})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
    topLabel='Top Income - '+MONTHS_SHORT[state.currentMonth]+' '+state.currentYear;
  }
  const _chartCanvas=document.getElementById('inc-chart');
  if(_chartCanvas){
    _chartCanvas.setAttribute('role','img');
    _chartCanvas.setAttribute('aria-label', data.length
      ? topLabel+'. Top: '+data.slice(0,3).map(d=>d.label+' $'+parseFloat(d.value.toFixed(2))).join(', ')+(data.length>3?', and '+(data.length-3)+' more':'')+'.'
      : topLabel+'. No data to display.');
  }
  if(!data.length){
    if(chartInstance){chartInstance.destroy();chartInstance=null;}
    renderTop3([],topLabel);return;
  }
  const colors=data.map(d=>d.color||'#bbf7d0');
  const vals=data.map(d=>parseFloat(d.value.toFixed(2)));
  const labels=data.map(d=>d.label);
  const isDark=document.documentElement.classList.contains('dark');
  const fgColor=isDark?'#e2e8f0':'#1f2937';
  const gridColor=isDark?'rgba(255,255,255,.1)':'rgba(0,0,0,.08)';
  // Update in place when the chart type hasn't changed — a theme change or a data edit
  // then just recolors/reflows the existing chart instead of replaying the entrance
  // animation that a destroy+recreate would trigger.
  if(chartInstance && chartInstance.config.type===chartType){
    chartInstance.data.labels=labels;
    const ds=chartInstance.data.datasets[0];
    ds.data=vals; ds.backgroundColor=colors;
    if(chartType==='doughnut'){
      ds.borderColor=isDark?'#1e293b':'#fff';
      chartInstance.options.plugins.legend.labels.color=fgColor;
    } else {
      chartInstance.options.scales.x.ticks.color=fgColor;
      chartInstance.options.scales.x.grid.color=gridColor;
      chartInstance.options.scales.x.border.color=gridColor;
      chartInstance.options.scales.y.ticks.color=fgColor;
      chartInstance.options.scales.y.grid.color=gridColor;
      chartInstance.options.scales.y.border.color=gridColor;
    }
    chartInstance.update();
    renderTop3(data,topLabel);
    return;
  }
  if(chartInstance){chartInstance.destroy();chartInstance=null;}
  if(chartType==='doughnut'){
    chartInstance=new Chart(document.getElementById('inc-chart'),{
      type:'doughnut',
      data:{labels,datasets:[{data:vals,backgroundColor:colors,borderWidth:2,borderColor:isDark?'#1e293b':'#fff',hoverOffset:8}]},
      options:{
        responsive:true,maintainAspectRatio:true,
        plugins:{
          legend:{display:true,position:'right',labels:{color:fgColor,boxWidth:14,padding:10,font:{size:12}}},
          tooltip:{callbacks:{label:ctx=>' '+ctx.label+': $'+ctx.parsed.toFixed(2)+' ('+(ctx.parsed/ctx.dataset.data.reduce((a,b)=>a+b,0)*100).toFixed(1)+'%)'}}
        }
      }
    });
  } else {
    chartInstance=new Chart(document.getElementById('inc-chart'),{
      type:'bar',
      data:{labels,datasets:[{label:'$ Amount',data:vals,backgroundColor:colors,borderRadius:4}]},
      options:{
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' $'+ctx.parsed.y.toFixed(2)}}},
        scales:{
          x:{ticks:{color:fgColor},grid:{color:gridColor},border:{color:gridColor}},
          y:{beginAtZero:true,ticks:{color:fgColor,callback:v=>'$'+v},grid:{color:gridColor},border:{color:gridColor}}
        },
        responsive:true,maintainAspectRatio:true
      }
    });
  }
  renderTop3(data,topLabel);
}
function renderTop3(data,label){
  const top=(data||[]).slice(0,3);
  const el=document.getElementById('top3');
  if(!top.length){el.innerHTML='';return;}
  el.innerHTML='<h4>'+escapeHtml(label||'Top 3')+'</h4><ol>'+top.map(t=>`<li><strong>${escapeHtml(t.label)}</strong> - $${parseFloat(t.value.toFixed(2))}</li>`).join('')+'</ol>';
}


let resetTimer=null;
function resetAll(e){
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  const btn=document.getElementById('reset-btn');
  if(btn.dataset.arm){
    clearTimeout(resetTimer); delete btn.dataset.arm; btn.textContent='⚠ Reset'; btn.classList.remove('armed');
    snapshot();
    const mk=currentMK();
    Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk+'|')) delete state.cells[k]; });
    if(state.rowsByMonth) delete state.rowsByMonth[mk];
    if(state.colsByMonth) delete state.colsByMonth[mk];
    if(state.monthRowCurrencies) Object.keys(state.monthRowCurrencies).forEach(k=>{ if(k.startsWith(mk+'|')) delete state.monthRowCurrencies[k]; });
    save(); render();
  } else {
    if(e) e.stopPropagation();
    btn.dataset.arm='1'; btn.textContent='⚠ Sure?'; btn.classList.add('armed');
    resetTimer=setTimeout(()=>{delete btn.dataset.arm;btn.textContent='⚠ Reset';btn.classList.remove('armed');},2500);
  }
}


function attachColResize(handle,col){
  handle.addEventListener('mousedown',e=>{
    if(_isClosedMonth(currentMK()))return;
    e.preventDefault();handle.classList.add('dragging');
    const sx=e.clientX,sw=col.width,cEl=document.getElementById('cg-'+col.id);
    const mv=e=>{col.width=Math.max(55,sw+e.clientX-sx);if(cEl)cEl.style.width=col.width+'px';};
    const up=()=>{handle.classList.remove('dragging');save();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}
function attachHdrResize(handle){
  handle.addEventListener('mousedown',e=>{
    e.preventDefault();handle.classList.add('dragging');
    const sx=e.clientX,sw=state.headerColWidth,cEl=document.getElementById('cg-hdr');
    const mv=e=>{state.headerColWidth=Math.max(100,sw+e.clientX-sx);if(cEl)cEl.style.width=state.headerColWidth+'px';};
    const up=()=>{handle.classList.remove('dragging');save();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}
function attachRowResize(handle,row,tr){
  handle.addEventListener('mousedown',e=>{
    if(_isClosedMonth(currentMK()))return;
    e.preventDefault();handle.classList.add('dragging');
    const sy=e.clientY,sh=row.height||36;
    const mv=e=>{row.height=Math.max(26,sh+e.clientY-sy);tr.style.height=row.height+'px';};
    const up=()=>{handle.classList.remove('dragging');save();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}


function renderTableHeader(table){
  const cg=document.createElement('colgroup');
  const _mob=window.innerWidth<640;
  const _vw=window.innerWidth;
  // Mobile: label ~43% vw, data cols 115px. Table scrolls ~30px to show Total — better than cramping.
  const _hdrW=_mob?Math.max(150,Math.round(_vw*0.43)):state.headerColWidth||235;
  const _dataW=_mob?115:null;
  const hc=document.createElement('col');hc.id='cg-hdr';hc.style.width=_hdrW+'px';cg.appendChild(hc);
  getCols().forEach(col=>{const c=document.createElement('col');c.id='cg-'+col.id;c.style.width=(_mob?_dataW:col.width||120)+'px';cg.appendChild(c);});
  const tc=document.createElement('col');tc.style.width=(state.totalColWidth||110)+'px';cg.appendChild(tc);
  const dc=document.createElement('col');dc.style.width='32px';cg.appendChild(dc);
  table.appendChild(cg);
  const thead=document.createElement('thead'),htr=document.createElement('tr');
  const corner=document.createElement('th');
  const ci=document.createElement('div');ci.className='th-inner';
  const cl=document.createElement('span');cl.style.cssText='font-weight:600;color:var(--muted);font-size:.83rem;';cl.textContent='Source';ci.appendChild(cl);
  corner.appendChild(ci);
  const chr=document.createElement('div');chr.className='col-resize';attachHdrResize(chr);corner.appendChild(chr);
  htr.appendChild(corner);
  getCols().forEach(col=>{
    const th=document.createElement('th');
    th.dataset.colId=col.id;
    const inner=document.createElement('div');inner.className='th-inner';
    const cdh=document.createElement('span');cdh.className='col-drag-handle';cdh.textContent='⠿';cdh.title='Drag to reorder column';cdh.setAttribute('aria-label','Drag to reorder column');cdh.setAttribute('role','img');
    cdh.addEventListener('pointerdown',e=>{
      if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
      e.preventDefault();cdh.setPointerCapture(e.pointerId);_dragColId=col.id;
      const onMove=e=>{
        document.querySelectorAll('.th-drop-before,.th-drop-after').forEach(el=>el.classList.remove('th-drop-before','th-drop-after'));
        const over=document.elementFromPoint(e.clientX,e.clientY);
        const tTh=over&&over.closest('th[data-col-id]');
        if(tTh&&tTh.dataset.colId!==_dragColId){const r=tTh.getBoundingClientRect();tTh.classList.add(e.clientX<r.left+r.width/2?'th-drop-before':'th-drop-after');}
      };
      const onUp=e=>{
        cdh.removeEventListener('pointermove',onMove);cdh.removeEventListener('pointerup',onUp);
        document.querySelectorAll('.th-drop-before,.th-drop-after').forEach(el=>el.classList.remove('th-drop-before','th-drop-after'));
        const over=document.elementFromPoint(e.clientX,e.clientY);
        const tTh=over&&over.closest('th[data-col-id]');
        if(tTh&&tTh.dataset.colId!==_dragColId){
          forkCurrentMonth();const mk2=currentMK();const cols=state.colsByMonth[mk2];
          const fromIdx=cols.findIndex(c=>c.id===_dragColId);
          if(fromIdx!==-1){const r=tTh.getBoundingClientRect();const before=e.clientX<r.left+r.width/2;snapshot();
            const [moved]=cols.splice(fromIdx,1);const insertAt=cols.findIndex(c=>c.id===tTh.dataset.colId);
            cols.splice(insertAt!==-1?(before?insertAt:insertAt+1):cols.length,0,moved);save();render();}
        }
        _dragColId=null;
      };
      cdh.addEventListener('pointermove',onMove);cdh.addEventListener('pointerup',onUp);
    });
    inner.appendChild(cdh);
    const lbl=document.createElement('input');lbl.type='text';lbl.className='th-label';lbl.size=1;lbl.value=col.label;lbl.setAttribute('aria-label','Column name');
    if(_isClosedMonth(currentMK())) lbl.disabled=true;
    lbl.addEventListener('blur',()=>{col.label=lbl.value.trim()||col.label;save();});
    lbl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lbl.blur();}});
    inner.appendChild(lbl);
    const del=document.createElement('button');del.className='col-del';del.title='Delete column';del.textContent='×';del.setAttribute('aria-label','Delete column');del.addEventListener('click',()=>deleteCol(col.id));inner.appendChild(del);
    th.appendChild(inner);
    const cr=document.createElement('div');cr.className='col-resize';attachColResize(cr,col);th.appendChild(cr);
    htr.appendChild(th);
  });
  const tth=document.createElement('th');tth.className='th-total';
  const thi=document.createElement('div');thi.className='th-inner';
  const thl=document.createElement('span');thl.style.cssText='font-weight:700;color:var(--total-fg);font-size:.85rem;';
  thl.textContent='Total';thi.appendChild(thl);tth.appendChild(thi);htr.appendChild(tth);
  const act=document.createElement('th');act.style.cssText='background:#f9fafb;border:1px dashed #d1d5db;';
  const acb=document.createElement('button');acb.className='btn-add-col';acb.textContent='+';acb.title='Add column';acb.addEventListener('click',addCol);act.appendChild(acb);htr.appendChild(act);
  thead.appendChild(htr);table.appendChild(thead);
}

function renderTableBody(table){
  const tbody=document.createElement('tbody');
  function renderRow(row){
    const isChild=!!row.parentId, hasKids=hasChildren(row.id), collapsed=isCollapsed(row.id);
    const tr=document.createElement('tr');tr.style.height=(row.height||36)+'px';tr.dataset.trRowId=row.id;
    if(isChild) tr.classList.add('child-row');
    const rhTd=document.createElement('td');rhTd.className='rh-cell';rhTd.style.backgroundColor=row.color;
    const rhIn=document.createElement('div');rhIn.className='rh-inner';
    if(!isChild){
      const dh=document.createElement('span');dh.className='drag-handle';dh.textContent='⠿';dh.title='Drag to reorder';dh.setAttribute('aria-label','Drag to reorder');dh.setAttribute('role','img');
      dh.addEventListener('pointerdown',e=>{
        if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
        e.preventDefault();dh.setPointerCapture(e.pointerId);
        _dragRowId=row.id;tr.classList.add('tr-dragging');
        const onMove=e=>{
          if(_activeDropEl){_activeDropEl.classList.remove('tr-drop-before','tr-drop-after');_activeDropEl=null;}
          const el=document.elementFromPoint(e.clientX,e.clientY);
          const tTr=el&&el.closest('tr[data-row-id]');
          if(tTr&&tTr.dataset.rowId!==_dragRowId){
            const r=tTr.getBoundingClientRect();
            tTr.classList.add(e.clientY<r.top+r.height/2?'tr-drop-before':'tr-drop-after');
            _activeDropEl=tTr;
          }
        };
        const onUp=()=>{
          dh.removeEventListener('pointermove',onMove);dh.removeEventListener('pointerup',onUp);
          tr.classList.remove('tr-dragging');
          const targetEl=_activeDropEl;
          const isBefore=targetEl&&targetEl.classList.contains('tr-drop-before');
          if(_activeDropEl){_activeDropEl.classList.remove('tr-drop-before','tr-drop-after');_activeDropEl=null;}
          if(targetEl){const targetId=targetEl.dataset.rowId;if(targetId&&targetId!==_dragRowId)moveParentRow(_dragRowId,targetId,isBefore);}
          _dragRowId=null;
        };
        dh.addEventListener('pointermove',onMove);dh.addEventListener('pointerup',onUp);
      });
      rhIn.appendChild(dh);
      tr.dataset.rowId=row.id;
    }
    if(hasKids){
      const cb=document.createElement('button');cb.className='collapse-btn';cb.title=collapsed?'Expand':'Collapse';cb.textContent=collapsed?'▸':'▾';
      cb.addEventListener('click',()=>toggleCollapse(row.id));rhIn.appendChild(cb);
    }
    const colorWrap=document.createElement('div');colorWrap.className='color-swatch-wrap tip-host';colorWrap.dataset.tip='Row background colour';
    const swatch=document.createElement('div');swatch.className='color-swatch';swatch.style.backgroundColor=row.color;
    const cInp=document.createElement('input');cInp.type='color';cInp.className='color-inp-overlay';cInp.value=row.color;cInp.setAttribute('aria-label','Row background colour');
    if(_isClosedMonth(currentMK())) cInp.disabled=true;
    cInp.addEventListener('input',()=>{row.color=cInp.value;rhTd.style.backgroundColor=cInp.value;swatch.style.backgroundColor=cInp.value;textSwatch.style.backgroundColor=cInp.value;});
    cInp.addEventListener('change',save);
    colorWrap.appendChild(swatch);colorWrap.appendChild(cInp);
    const tcWrap=document.createElement('div');tcWrap.className='color-swatch-wrap tip-host';tcWrap.dataset.tip='Row text colour';
    const textSwatch=document.createElement('div');textSwatch.className='text-color-swatch';textSwatch.textContent='A';textSwatch.style.color=row.textColor||'#1f2937';textSwatch.style.backgroundColor=row.color||'#ffffff';
    const tcInp=document.createElement('input');tcInp.type='color';tcInp.className='color-inp-overlay';tcInp.value=row.textColor||'#1f2937';tcInp.setAttribute('aria-label','Row text colour');
    if(_isClosedMonth(currentMK())) tcInp.disabled=true;
    tcInp.addEventListener('input',()=>{row.textColor=tcInp.value;rowLabel.style.color=tcInp.value;textSwatch.style.color=tcInp.value;});
    tcInp.addEventListener('change',save);
    tcWrap.appendChild(textSwatch);tcWrap.appendChild(tcInp);
    const rowLabel=document.createElement('input');rowLabel.type='text';rowLabel.className='row-label';rowLabel.size=1;rowLabel.value=row.label;rowLabel.setAttribute('aria-label','Source name');
    rowLabel.style.color=row.textColor||'#1f2937';
    if(_isClosedMonth(currentMK())) rowLabel.disabled=true;
    rowLabel.addEventListener('blur',()=>{row.label=rowLabel.value.trim()||row.label;save();});
    rowLabel.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();rowLabel.blur();}});
    rhIn.appendChild(colorWrap);rhIn.appendChild(tcWrap);rhIn.appendChild(rowLabel);
    // row.recurring is a row-wide flag (true if ANY month is governed by a rule), so it stays
    // true after delinking just the viewed month - check monthInScope too, or a delinked month
    // still shows the badge and reads as "still part of the chain" when it isn't anymore.
    {
      const _badgeRule=row.recurring?_recRuleFor(row.id):null;
      if(_badgeRule && FiRecurring.monthInScope(_badgeRule, currentMK())){const rb=document.createElement('span');rb.className='row-recur-badge';rb.textContent='🔁';rb.title='Recurring';rb.setAttribute('aria-label','Recurring');rb.style.cssText='font-size:.75em;opacity:.6;margin-left:.25rem;pointer-events:none;flex-shrink:0;';rhIn.appendChild(rb);}
    }
    if(!isChild){
      const dd=document.createElement('div');dd.className='sub-dropdown';
      const addBtn=document.createElement('button');addBtn.className='sub-add-btn';addBtn.textContent='+Sub';addBtn.title='Add sub-source';
      addBtn.addEventListener('click',e=>{e.stopPropagation();showSubMenu(addBtn,row);});
      dd.appendChild(addBtn);
      rhIn.appendChild(dd);
    }
    // Desktop recurring entry - available on sub-source rows too (mobile uses the gear menu).
    if(_recEligible(row, isChild)){
      const _rule=_recRuleFor(row.id);
      const recBtn=document.createElement('button');recBtn.className='sub-add-btn recur-mark-btn';
      recBtn.textContent='🔁';recBtn.title=_rule?'Edit recurring':'Mark recurring';recBtn.setAttribute('aria-label',_rule?'Edit recurring':'Mark recurring');
      if(_rule) recBtn.classList.add('active');
      recBtn.addEventListener('click',e=>{e.stopPropagation();openRecurringConfig(row.id);});
      rhIn.appendChild(recBtn);
    }
    {
      // Row options gear: was desktop-parent-only, but _openGearMenu already branches
      // correctly on isChild for every item it offers (colours, recurring, delete), so
      // sub-source rows get the same menu (minus +Sub, which stays parent-only above).
      const gearBtn=document.createElement('button');
      gearBtn.className='row-gear-btn';gearBtn.textContent='⚙';gearBtn.title='Row options';gearBtn.setAttribute('aria-label','Row options');
      gearBtn.addEventListener('click',e=>{ e.stopPropagation();_openGearMenu(gearBtn,row,rhTd,swatch,textSwatch,isChild); });
      rhIn.appendChild(gearBtn);
    }
    rhTd.appendChild(rhIn);
    const rr=document.createElement('div');rr.className='row-resize';attachRowResize(rr,row,tr);rhTd.appendChild(rr);
    tr.appendChild(rhTd);
    getCols().forEach(col=>{
      const td=document.createElement('td');
      if(hasKids){
        const span=document.createElement('span');span.className='parent-sum';span.id='ps-'+row.id+'-'+col.id;
        const s=children(row.id).reduce((t,c)=>t+getCell(c.id,col.id),0);
        span.title='Sum of sub-sources';
        span.textContent=s>0?fmt(s):'';td.appendChild(span);
      } else {
        const wrap=document.createElement('div'); wrap.className='cost-wrap';
        const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='0.01';inp.inputMode='decimal';inp.className='num-input c-num';
        inp.setAttribute('aria-label',((row.label||'Source')+' '+(col.label||'')).trim()+' amount');
        if(_isClosedMonth(currentMK())) inp.disabled=true;
        const stored=getRawCell(row.id,col.id);inp.value=stored!==''?stored:'';
        inp.addEventListener('input',()=>{ inp.value=inp.value.replace(/[^0-9.]/g,''); });
        inp.addEventListener('focus',()=>snapshot());
        inp.addEventListener('change',()=>{
          if(inp.value!==''&&isNaN(parseFloat(inp.value))) return;
          if(parseFloat(inp.value)<0) inp.value='0';
          // Recurring source: route the change through the propagation dialog (month total).
          if(_recRuleFor(row.id)){
            const _cols=(state.colsByMonth&&state.colsByMonth[currentMK()])||state.cols||[];
            let _tot=0; _cols.forEach(cc=>{ _tot += (cc.id===col.id ? (parseFloat(inp.value)||0) : (parseFloat((state.cells||{})[currentMK()+'|'+row.id+'|'+cc.id]||0)||0)); });
            _onRecurringCellEdit(row.id, currentMK(), _tot);
            return;
          }
          if(inp.value===''){
            delete state.cells[ck(row.id,col.id)]; save(); updateAll(row.id); return;
          }
          setCell(row.id,col.id,inp.value);
          ensureRate(rowCurrency(currentMK(), row.id)).then(()=>updateAll(row.id));
        });
        wrap.appendChild(inp);
        const cur=rowCurrency(currentMK(), row.id);
        const sel=document.createElement('select'); sel.className='cell-curr-sel'; sel.title='Currency for this row';
        // Actually disabling (not just guarding mousedown) is what stops the native
        // option list from opening - a preventDefault-on-mousedown guard doesn't
        // reliably block it, so the walkthrough overlay was clickable underneath.
        if(_isClosedMonth(currentMK())||isWalkthroughActive()) sel.disabled=true;
        const codes=getAllUsedCurrencies();
        if(!codes.includes(cur)) codes.push(cur);
        codes.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; if(c===cur) o.selected=true; sel.appendChild(o); });
        const otherOpt=document.createElement('option'); otherOpt.value='__other__'; otherOpt.textContent='Other…'; sel.appendChild(otherOpt);
        sel.addEventListener('mousedown',e=>{
          if(isWalkthroughActive()){e.preventDefault();sel.blur();showToast('🧭 Finish or skip the walkthrough to use this.');}
        });
        sel.addEventListener('change',()=>{
          if(sel.value==='__other__'){ showCellCurrencyOther(wrap,sel,row); return; }
          setRowCurrency(currentMK(), row.id, sel.value);
          ensureRate(sel.value).then(()=>{ updateAll(row.id); renderChart(); });
        });
        wrap.appendChild(sel);
        td.appendChild(wrap);
      }
      tr.appendChild(td);
    });
    const totTd=document.createElement('td');totTd.className='th-total';
    const totInner=document.createElement('div');totInner.style.cssText='display:flex;align-items:center;justify-content:flex-end;';
    const totSpan=document.createElement('span');totSpan.className='total-val';totSpan.id='rt-'+row.id;
    totSpan.textContent=fmt(rowTotal(row.id));totInner.appendChild(totSpan);totTd.appendChild(totInner);tr.appendChild(totTd);
    const delTd=document.createElement('td');delTd.className='del-td';
    const delBtn=document.createElement('button');delBtn.className='row-del';delBtn.title='Delete row';delBtn.setAttribute('aria-label','Delete row');delBtn.textContent='🗑';
    delBtn.addEventListener('click',()=>deleteRow(row.id));delTd.appendChild(delBtn);tr.appendChild(delTd);
    tbody.appendChild(tr);
    if(!isChild&&!collapsed){ children(row.id).forEach(renderRow); }
  }
  getRows().filter(r=>!r.parentId).forEach(renderRow);
  if(getRows().length===0){
    const etr=document.createElement('tr');const etd=document.createElement('td');etd.colSpan=getCols().length+3;
    etd.style.cssText='text-align:center;padding:1.1rem .75rem;color:var(--muted);font-size:.88rem;border:none;';
    etd.textContent='Add your first row to start tracking.';etr.appendChild(etd);tbody.appendChild(etr);
  }
  const atr=document.createElement('tr');const atd=document.createElement('td');atd.colSpan=getCols().length+3;atd.style.cssText='border:none;padding:3px 0;';
  const arb=document.createElement('button');arb.className='btn-add-row';arb.textContent='+ Add Row';arb.addEventListener('click',addRow);
  atd.appendChild(arb);atr.appendChild(atd);tbody.appendChild(atr);
  table.appendChild(tbody);
}

function renderFooter(table){
  const tfoot=document.createElement('tfoot'),ftr=document.createElement('tr');
  const fl=document.createElement('td');fl.style.cssText='font-weight:700;padding:4px 8px;font-size:.85rem;';fl.textContent='TOTAL';ftr.appendChild(fl);
  getCols().forEach(col=>{
    const ftd=document.createElement('td'); ftd.className='week-total-cell';
    const fs=document.createElement('span');fs.className='gtotal-val';fs.id='ct-'+col.id;
    fs.textContent=fmt(colTotal(col.id));
    ftd.appendChild(fs); ftr.appendChild(ftd);
  });
  const gtd=document.createElement('td');gtd.className='gtotal-cell'+(isForecastMonth()?' forecast-total':'');
  const gs=document.createElement('span');gs.className='gtotal-val';gs.id='gt';gs.textContent=fmt(grandTotal());gtd.appendChild(gs);ftr.appendChild(gtd);
  ftr.appendChild(document.createElement('td'));
  tfoot.appendChild(ftr);table.appendChild(tfoot);
}

let _expandedCardId=null;

// ── Mobile carousel layout ────────────────────────────────────────────────
const _MC_LAYOUT_KEY='fiapp_mc_layout_v1';
let _mcPanel=0; // carousel mode: 0=summary, 1=cards
window._mcSetPanel=function(i){_mcPanel=i;}; // called by walkthrough in base.html
// Ensure mobile cards are visible for walkthrough steps that need them
window._wtShowCards=function(){
  if(window.innerWidth>=640) return;
  if(getRows().length===0){
    forkCurrentMonth();
    var mk2=currentMK();
    if(!state.rowsByMonth[mk2]) state.rowsByMonth[mk2]=[];
    ['Salary','Freelance','Investments','Other Income'].forEach(function(l){
      if(state.rowsByMonth[mk2].length>=MAX_ROWS) return;
      state.rowsByMonth[mk2].push({id:uid(),label:l,color:'#d1fae5',textColor:'#1f2937',height:36,parentId:null});
    });
  }
  _setMCLayout('carousel'); _mcPanel=1; render();
};
function _getMCLayout(){try{return localStorage.getItem(_MC_LAYOUT_KEY)||'default';}catch(e){return 'default';}}
function _setMCLayout(v){try{localStorage.setItem(_MC_LAYOUT_KEY,v);}catch(e){}}
function _applyMobileLayout(){
  if(window.innerWidth>=640) return;
  const oldCtrl=document.getElementById('mc-layout-controls'); if(oldCtrl) oldCtrl.remove();
  window._mcShowForTarget=null;
  const summaryEl=document.getElementById('summary-bar');
  const cardsEl=document.getElementById('inc-mobile-cards');
  if(!summaryEl||!cardsEl) return;
  summaryEl.classList.remove('mc-panel-hidden'); cardsEl.classList.remove('mc-panel-hidden');
  const isCarousel=_getMCLayout()==='carousel';
  const ctrl=document.createElement('div'); ctrl.id='mc-layout-controls';
  const toggleBtn=document.createElement('button'); toggleBtn.className='mc-layout-btn';
  toggleBtn.textContent=isCarousel?'⊞ Scroll view':'⊟ Carousel view';
  toggleBtn.addEventListener('click',()=>{_setMCLayout(isCarousel?'default':'carousel');if(!isCarousel) _mcPanel=0;render();});
  ctrl.appendChild(toggleBtn);
  if(isCarousel){
    const panels=[summaryEl,cardsEl]; const labels=['Summary','Cards'];
    panels.forEach((p,i)=>p.setAttribute('data-mc-panel',String(i)));
    const nav=document.createElement('div'); nav.className='mc-panel-nav';
    function showPanel(i){
      _mcPanel=i; panels.forEach((p,j)=>p.classList.toggle('mc-panel-hidden',j!==i));
      nav.querySelectorAll('.mc-panel-dot').forEach((d,j)=>d.classList.toggle('active',j===i));
      const lbl=nav.querySelector('.mc-panel-label'); if(lbl) lbl.textContent=labels[i];
    }
    window._mcShowForTarget=function(el){
      const idx=panels.findIndex(function(p){return p===el||p.contains(el);});
      if(idx>=0) showPanel(idx);
    };
    const prevBtn=document.createElement('button'); prevBtn.className='mc-panel-arrow mc-panel-prev'; prevBtn.textContent='◀';
    prevBtn.addEventListener('click',()=>showPanel((_mcPanel-1+panels.length)%panels.length));
    const dotsWrap=document.createElement('div'); dotsWrap.className='mc-panel-dots';
    labels.forEach((_,i)=>{const dot=document.createElement('span');dot.className='mc-panel-dot';dot.addEventListener('click',()=>showPanel(i));dotsWrap.appendChild(dot);});
    const labelEl=document.createElement('span'); labelEl.className='mc-panel-label';
    const nextBtn=document.createElement('button'); nextBtn.className='mc-panel-arrow mc-panel-next'; nextBtn.textContent='▶';
    nextBtn.addEventListener('click',()=>showPanel((_mcPanel+1)%panels.length));
    nav.appendChild(prevBtn); nav.appendChild(dotsWrap); nav.appendChild(labelEl); nav.appendChild(nextBtn);
    ctrl.appendChild(nav); showPanel(_mcPanel);
  }
  summaryEl.parentNode.insertBefore(ctrl,summaryEl);
}

function render(){
  const _sy=window.scrollY;
  const MOBILE=window.innerWidth<640;
  const sheetWrap=document.getElementById('inc-sheet-wrap');
  const cardsDiv=document.getElementById('inc-mobile-cards');
  const table=document.getElementById('sheet'); table.innerHTML='';
  if(MOBILE){
    if(sheetWrap) sheetWrap.style.display='none';
    if(cardsDiv) cardsDiv.style.display='';
    renderMobileCards();
    _applyMobileLayout();
  } else {
    if(sheetWrap) sheetWrap.style.display='';
    if(cardsDiv) cardsDiv.style.display='none';
    const _oldNav=document.getElementById('mc-layout-controls'); if(_oldNav) _oldNav.remove();
    window._mcShowForTarget=null;
    const _sumEl=document.getElementById('summary-bar'); if(_sumEl) _sumEl.classList.remove('mc-panel-hidden');
    renderTableHeader(table);
    renderTableBody(table);
    renderFooter(table);
  }
  updateSummaryBar();
  updateCurrencyHint();
  if(chartVisible) renderChart();
  adjustBodyWidth();
  updateForecastUI();
  try{ _recDraftBannerRefresh(); }catch(_){}
  const tbl=document.getElementById('sheet');
  if(tbl) tbl.classList.toggle('forecast',isForecastMonth());
  const hasSubcats=getRows().some(r=>r.parentId);
  const eb=document.getElementById('expand-btn'), cb2=document.getElementById('collapse-btn');
  if(eb) eb.style.display=hasSubcats?'':'none';
  if(cb2) cb2.style.display=hasSubcats?'':'none';
  (function(){
    const el=document.getElementById('del-col-items'); if(!el) return;
    el.innerHTML='';
    const cols=getCols(); if(cols.length<=1) return;
    const sep=document.createElement('hr'); sep.style.cssText='margin:.3rem 0;border:none;border-top:1px solid var(--panel-border);';
    el.appendChild(sep);
    cols.forEach(function(col){
      const btn=document.createElement('button');
      btn.textContent='× '+col.label;
      btn.addEventListener('click',function(){ deleteCol(col.id); });
      el.appendChild(btn);
    });
  })();
  requestAnimationFrame(function(){window.scrollTo(0,_sy);});
}

function renderMobileCards(){
  const container=document.getElementById('inc-mobile-cards');
  if(!container) return;
  container.innerHTML='';
  const cols=getCols();

  function buildCard(row){
    const isChild=!!row.parentId;
    const hasKids=hasChildren(row.id);
    const canEdit=!hasKids;
    const isExpanded=_expandedCardId===row.id;
    const cur=rowCurrency(currentMK(),row.id);

    const card=document.createElement('div');
    card.className='mc-card'+(isChild?' mc-child':'')+(isExpanded?' mc-active':'');
    card.dataset.rowId=row.id;
    if(row.color) card.style.backgroundColor=row.color;
    if(row.textColor) card.style.setProperty('--row-text',row.textColor);

    const top=document.createElement('div');
    top.className='mc-top'+(isExpanded?'':' mc-top-only');

    const drag=document.createElement('span');drag.className='mc-drag';drag.textContent='⠿';drag.setAttribute('aria-label','Drag to reorder');
    top.appendChild(drag);

    const main=document.createElement('div');main.className='mc-main';
    const hdr=document.createElement('div');hdr.className='mc-hdr';

    const nameEl=document.createElement('span');nameEl.className='mc-name';nameEl.textContent=row.label;
    if(row.textColor) nameEl.style.color=row.textColor;
    hdr.appendChild(nameEl);

    const totalEl=document.createElement('span');totalEl.className='mc-total';totalEl.textContent=fmt(rowTotal(row.id));hdr.appendChild(totalEl);

    const gear=document.createElement('button');gear.className='mc-gear';gear.textContent='⚙';gear.setAttribute('aria-label','Row options');
    gear.addEventListener('click',e=>{e.stopPropagation();_openGearMenu(gear,row,card,null,null,isChild);});
    hdr.appendChild(gear);
    main.appendChild(hdr);

    const weeksEl=document.createElement('div');weeksEl.className='mc-weeks';
    cols.forEach(col=>{
      const wk=document.createElement('div');wk.className='mc-wk';
      const lbl=document.createElement('div');lbl.className='mc-wl';lbl.textContent=col.label;
      const v=hasKids?children(row.id).reduce((s,c)=>s+getCell(c.id,col.id),0):getCell(row.id,col.id);
      const val=document.createElement('div');val.className='mc-wv'+(v===0?' mc-wv-empty':'');
      val.textContent=v>0?fmt(v):'-';
      wk.appendChild(lbl);wk.appendChild(val);
      if(v>0&&!hasKids){const cc=document.createElement('div');cc.className='mc-wc';cc.textContent=cur;wk.appendChild(cc);}
      weeksEl.appendChild(wk);
    });
    main.appendChild(weeksEl);

    const hint=document.createElement('div');
    if(!canEdit){
      hint.className='mc-hint-subs';hint.textContent='edit via subcategories below';
    } else {
      hint.className='mc-hint-edit';hint.textContent='tap to edit ✏️';
      card.style.cursor='pointer';
      card.addEventListener('click',e=>{
        if(e.target.closest('.mc-gear')) return;
        if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
        _expandedCardId=isExpanded?null:row.id;
        renderMobileCards();
      });
    }
    main.appendChild(hint);
    top.appendChild(main);
    card.appendChild(top);

    if(isExpanded){
      const form=document.createElement('div');form.className='mc-form';
      form.addEventListener('click',e=>e.stopPropagation());
      const grid=document.createElement('div');grid.className='mc-form-grid';
      const inputs=[];
      const codes=getAllUsedCurrencies();
      if(!codes.includes(cur)) codes.push(cur);
      cols.forEach(col=>{
        const ef=document.createElement('div');ef.className='mc-ef';
        const lbl=document.createElement('div');lbl.className='mc-el';lbl.textContent=col.label;
        const er=document.createElement('div');er.className='mc-er';
        const inp=document.createElement('input');inp.type='number';inp.inputMode='decimal';inp.className='mc-ei';
        inp.value=getRawCell(row.id,col.id)||'';
        const sel=document.createElement('select');sel.className='mc-ec';
        codes.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;if(c===cur)o.selected=true;sel.appendChild(o);});
        er.appendChild(inp);er.appendChild(sel);
        inputs.push({inp,sel,col});
        ef.appendChild(lbl);ef.appendChild(er);grid.appendChild(ef);
      });
      form.appendChild(grid);
      const btns=document.createElement('div');btns.className='mc-ebtns';
      const cancelBtn=document.createElement('button');cancelBtn.className='mc-ecancel';cancelBtn.textContent='Cancel';
      cancelBtn.addEventListener('click',e=>{e.stopPropagation();_expandedCardId=null;renderMobileCards();});
      const saveBtn=document.createElement('button');saveBtn.className='mc-esave';saveBtn.textContent='Save';
      saveBtn.addEventListener('click',e=>{
        e.stopPropagation();
        snapshot();
        const newCur=inputs[0].sel.value;
        setRowCurrency(currentMK(),row.id,newCur);
        inputs.forEach(({inp,col})=>{
          const v=inp.value.trim();
          if(v===''||isNaN(parseFloat(v))) delete state.cells[ck(row.id,col.id)];
          else state.cells[ck(row.id,col.id)]=v;
        });
        _expandedCardId=null;
        save();
        ensureRate(newCur).then(()=>render());
      });
      btns.appendChild(cancelBtn);btns.appendChild(saveBtn);form.appendChild(btns);
      card.appendChild(form);
      setTimeout(()=>{ const first=form.querySelector('.mc-ei'); if(first) first.focus(); },50);
    }

    container.appendChild(card);
  }

  getRows().filter(r=>!r.parentId).forEach(row=>{
    buildCard(row);
    if(!isCollapsed(row.id)) children(row.id).forEach(buildCard);
  });

  if(_expandedCardId){
    container.querySelectorAll('.mc-card').forEach(c=>{
      if(c.dataset.rowId!==_expandedCardId) c.classList.add('mc-dim');
    });
  }
}


function adjustBodyWidth(){
  // Centring is handled in CSS: the wider .app-canvas.canvas-wide column is centred in the
  // viewport (margin:0 auto) and the table is centred inside it (margin-inline:auto), and the
  // .sheet-wrap scrolls horizontally when the table is genuinely wider than that column.
  // We no longer shrink-wrap the <body> to the table — because the body sits to the right of
  // the fixed sidebar (margin:0), sizing it to the table jammed the whole block to the left
  // with dead space on the right, and capped tables couldn't scroll. Clear any stale inline cap.
  document.body.style.maxWidth='';
}
window.addEventListener('resize',adjustBodyWidth);
let _resizeRenderTimer=null;
let _lastRenderW=window.innerWidth;
window.addEventListener('resize',()=>{
  // Only re-render when WIDTH changes (keyboard open/close only changes height — re-rendering
  // on height-only resize destroys the focused input and closes the keyboard immediately).
  const w=window.innerWidth;
  if(w===_lastRenderW) return;
  _lastRenderW=w;
  clearTimeout(_resizeRenderTimer);
  _resizeRenderTimer=setTimeout(()=>render(),300);
});


function expPad(s,n){ s=String(s); return s.length>=n?s:s+' '.repeat(n-s.length); }
function expCsvEsc(v){
  let s=String(v==null?'':v);
  // Formula-injection guard: a leading quote neutralizes spreadsheet formula triggers
  // (=,+,-,@, tab, CR) in free-text cells. Skipped when the cell is a genuine number
  // (e.g. "-50.00") so legitimate negative amounts aren't corrupted.
  if(/^[=+\-@\t\r]/.test(s)&&isNaN(Number(s))) s="'"+s;
  return /[,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}

function buildRowsArray(){
  const colLabels=getCols().map(c=>c.label);
  const header=['Source','Sub-source',...colLabels,'Total'];
  const out=[header];
  getRows().filter(r=>!r.parentId).forEach(parent=>{
    const kids=children(parent.id);
    if(kids.length){
      const vals=getCols().map(col=>{
        const s=kids.reduce((t,c)=>t+getCell(c.id,col.id),0);
        return s?s.toFixed(2):'';
      });
      out.push([parent.label,'',...vals,rowTotal(parent.id).toFixed(2)]);
      kids.forEach(kid=>{
        const kVals=getCols().map(col=>{ const v=getCell(kid.id,col.id); return v?v.toFixed(2):''; });
        out.push(['',kid.label,...kVals,rowTotal(kid.id).toFixed(2)]);
      });
    } else {
      const vals=getCols().map(col=>{ const v=getCell(parent.id,col.id); return v?v.toFixed(2):''; });
      out.push([parent.label,'',...vals,rowTotal(parent.id).toFixed(2)]);
    }
  });
  const totals=getCols().map(col=>colTotal(col.id).toFixed(2));
  out.push(['TOTAL','',...totals,grandTotal().toFixed(2)]);
  return out;
}

function buildCsv(){
  return buildRowsArray().map(r=>r.map(expCsvEsc).join(',')).join('\r\n');
}
function buildJson(){
  const mk2=currentMK();
  const topRows=getRows().filter(r=>!r.parentId);
  const rowsOut=topRows.map(parent=>{
    const kids=children(parent.id);
    const colVals={};
    getCols().forEach(col=>{ colVals[col.label]=getCell(parent.id,col.id)||undefined; });
    return {
      label:parent.label,color:parent.color,textColor:parent.textColor,
      total:rowTotal(parent.id),amounts:colVals,
      subsources:kids.map(kid=>{
        const kv={};
        getCols().forEach(col=>{ kv[col.label]=getCell(kid.id,col.id)||undefined; });
        return {label:kid.label,total:rowTotal(kid.id),amounts:kv};
      })
    };
  });
  return JSON.stringify({
    month:mk2,
    monthName:MONTHS_FULL[state.currentMonth]+' '+state.currentYear,
    columns:getCols().map(c=>c.label),
    rows:rowsOut,
    totals:{grand:grandTotal(),perColumn:Object.fromEntries(getCols().map(col=>[col.label,colTotal(col.id)]))}
  },null,2);
}
function buildTxt(){
  const rows=buildRowsArray();
  const widths=rows[0].map((_,ci)=>Math.max(...rows.map(r=>String(r[ci]||'').length)));
  const sep=widths.map(w=>'-'.repeat(w+2)).join('+');
  return rows.map((r,ri)=>{
    const line='|'+r.map((v,ci)=>' '+expPad(v,widths[ci])+' ').join('|')+'|';
    return ri===0||ri===rows.length-1?sep+'\n'+line+'\n'+sep:line;
  }).join('\n');
}
function buildTsv(){
  return buildRowsArray()
    .map(r=>r.map(v=>String(v==null?'':v).replace(/[\t\r\n]/g,' ')).join('\t'))
    .join('\r\n');
}

function gmailHref(subject, body){
  return 'https://mail.google.com/mail/?view=cm&fs=1&tf=1'
       + '&su='+encodeURIComponent(subject)
       + '&body='+encodeURIComponent(body);
}

function clipboardWrite(text){
  if(navigator.clipboard){
    return navigator.clipboard.writeText(text).then(()=>true).catch(()=>fallback());
  }
  return Promise.resolve(fallback());
  function fallback(){
    const tmp=document.createElement('textarea');
    tmp.value=text;tmp.style.position='fixed';tmp.style.opacity='0';
    document.body.appendChild(tmp);tmp.select();
    let ok=false;try{ok=document.execCommand('copy');}catch{}
    tmp.remove();return ok;
  }
}

function showExportFlash(msg){
  const f=document.getElementById('export-flash');if(!f) return;
  f.textContent=msg;f.classList.add('show');
  clearTimeout(window._exportFlashT);
  window._exportFlashT=setTimeout(()=>f.classList.remove('show'),2500);
}



function encodeBlob(obj){
  return 'FIAPP-'+obj.kind+'-V1:'+btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function decodeBlob(str){
  const m=String(str).trim().match(/^FIAPP-([A-Z\-]+)-V1:([A-Za-z0-9+/=]+)\s*$/);
  if(!m) throw new Error('Not a FiApp paste-blob.');
  let obj;
  try{ obj=JSON.parse(decodeURIComponent(escape(atob(m[2])))); }
  catch(e){ throw new Error('Blob is corrupted or incomplete - could not decode.'); }
  if(typeof obj!=='object'||obj===null) throw new Error('Invalid blob: unexpected format.');
  if(obj.kind!==m[1]) throw new Error('Blob kind mismatch.');
  if(!Array.isArray(obj.rows)) throw new Error('Invalid blob: missing rows array.');
  if(!Array.isArray(obj.cols)) throw new Error('Invalid blob: missing cols array.');
  if(obj.kind==='INC-MONTH'){
    if(typeof obj.cells!=='object'||Array.isArray(obj.cells)) throw new Error('Invalid blob: bad cells object.');
    if(typeof obj.monthKey!=='string') throw new Error('Invalid blob: missing monthKey.');
  }
  if(obj.kind==='INC-FULL'){
    if(typeof obj.cellsByMonth!=='object'||Array.isArray(obj.cellsByMonth)) throw new Error('Invalid blob: bad cellsByMonth.');
  }
  if(obj.rows.length>500)  throw new Error('Blob rejected: too many rows (max 500).');
  if(obj.cols.length>52)   throw new Error('Blob rejected: too many columns (max 52).');
  if(obj.kind==='INC-FULL'){
    let totalCells=0;
    Object.values(obj.cellsByMonth).forEach(mc=>{ if(mc&&typeof mc==='object') totalCells+=Object.keys(mc).length; });
    if(totalCells>50000) throw new Error('Blob rejected: too many cells (max 50,000).');
    if(Object.keys(obj.cellsByMonth).length>120) throw new Error('Blob rejected: too many months (max 120).');
  } else if(obj.cells){
    if(Object.keys(obj.cells).length>50000) throw new Error('Blob rejected: too many cells (max 50,000).');
  }
  return obj;
}

function buildIncMonthBlob(){
  const mk2=currentMK();
  const cells={};
  Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|')) cells[k]=state.cells[k]; });
  const rowCurrencies={};
  Object.keys(state.monthRowCurrencies||{}).forEach(k=>{ if(k.startsWith(mk2+'|')) rowCurrencies[k]=state.monthRowCurrencies[k]; });
  const rowsByMonth={}; if(state.rowsByMonth&&state.rowsByMonth[mk2]) rowsByMonth[mk2]=JSON.parse(JSON.stringify(state.rowsByMonth[mk2]));
  const colsByMonth={}; if(state.colsByMonth&&state.colsByMonth[mk2]) colsByMonth[mk2]=JSON.parse(JSON.stringify(state.colsByMonth[mk2]));
  return {
    kind:'INC-MONTH', v:1, monthKey:mk2,
    rows:JSON.parse(JSON.stringify(getRows())),
    cols:JSON.parse(JSON.stringify(getCols())),
    rowsByMonth, colsByMonth,
    cells,
    rowCurrencies,
    headerColWidth:state.headerColWidth, totalColWidth:state.totalColWidth,
  };
}
function buildIncFullBlob(){
  const cellsByMonth={};
  Object.keys(state.cells).forEach(k=>{
    const mk2=k.split('|')[0];
    (cellsByMonth[mk2]=cellsByMonth[mk2]||{})[k]=state.cells[k];
  });
  return {
    kind:'INC-FULL', v:1,
    rows:JSON.parse(JSON.stringify(state.rows)),
    cols:JSON.parse(JSON.stringify(state.cols)),
    rowsByMonth:JSON.parse(JSON.stringify(state.rowsByMonth||{})),
    colsByMonth:JSON.parse(JSON.stringify(state.colsByMonth||{})),
    cellsByMonth,
    collapsed:JSON.parse(JSON.stringify(state.collapsed||{})),
    rowCurrencies:JSON.parse(JSON.stringify(state.monthRowCurrencies||{})),
    displayCurrency:state.displayCurrency||'USD',
    headerColWidth:state.headerColWidth, totalColWidth:state.totalColWidth,
    currentYear:state.currentYear, currentMonth:state.currentMonth,
  };
}

function _mergeRowsCols(blobRows, blobCols){
  const labelToId={};
  state.rows.forEach(r=>{ if(!r.parentId) labelToId[r.label]=r.id; });
  const childKeyToId={};
  state.rows.forEach(r=>{
    if(r.parentId){
      const parent=state.rows.find(x=>x.id===r.parentId);
      if(parent) childKeyToId[parent.label+'|'+r.label]=r.id;
    }
  });
  const blobRowIdMap={};
  blobRows.filter(r=>!r.parentId).forEach(br=>{
    if(labelToId[br.label]){
      blobRowIdMap[br.id]=labelToId[br.label];
    } else {
      const newId=uid();
      const nr=Object.assign({},br,{id:newId});
      state.rows.push(nr);
      blobRowIdMap[br.id]=newId;
      labelToId[br.label]=newId;
    }
  });
  blobRows.filter(r=>r.parentId).forEach(br=>{
    const blobParent=blobRows.find(p=>p.id===br.parentId);
    const parentLabel=blobParent?blobParent.label:'';
    const localParentId=blobRowIdMap[br.parentId];
    const key=parentLabel+'|'+br.label;
    if(childKeyToId[key]){
      blobRowIdMap[br.id]=childKeyToId[key];
    } else {
      const newId=uid();
      const nr=Object.assign({},br,{id:newId,parentId:localParentId});
      const parentIdx=state.rows.findIndex(r=>r.id===localParentId);
      const lastKidIdx=state.rows.reduce((acc,r,i)=>r.parentId===localParentId?i:acc, parentIdx);
      state.rows.splice(lastKidIdx+1,0,nr);
      blobRowIdMap[br.id]=newId;
      childKeyToId[key]=newId;
    }
  });
  const colLblToId={};
  state.cols.forEach(c=>colLblToId[c.label]=c.id);
  const blobColIdMap={};
  blobCols.forEach(bc=>{
    if(colLblToId[bc.label]) blobColIdMap[bc.id]=colLblToId[bc.label];
    else {
      const newId=uid();
      const nc=Object.assign({},bc,{id:newId});
      state.cols.push(nc);
      blobColIdMap[bc.id]=newId;
      colLblToId[bc.label]=newId;
    }
  });
  return {blobRowIdMap, blobColIdMap};
}

function importIncMonth(blob){
  const mk2=currentMK();
  if(_isClosedMonth(mk2)){showToast('🔒 Month is locked.');return;}
  Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|')) delete state.cells[k]; });
  const {blobRowIdMap, blobColIdMap}=_mergeRowsCols(blob.rows||[], blob.cols||[]);
  Object.entries(blob.cells||{}).forEach(([k,v])=>{
    const parts=k.split('|');
    const rId=blobRowIdMap[parts[1]], cId=blobColIdMap[parts[2]];
    if(rId&&cId) state.cells[mk2+'|'+rId+'|'+cId]=v;
  });
  if(blob.rowsByMonth&&blob.rowsByMonth[blob.monthKey]){
    if(!state.rowsByMonth) state.rowsByMonth={};
    state.rowsByMonth[mk2]=JSON.parse(JSON.stringify(blob.rowsByMonth[blob.monthKey]));
  }
  if(blob.colsByMonth&&blob.colsByMonth[blob.monthKey]){
    if(!state.colsByMonth) state.colsByMonth={};
    state.colsByMonth[mk2]=JSON.parse(JSON.stringify(blob.colsByMonth[blob.monthKey]));
  }
}

function importIncFull(blob, selectedMonths){
  const {blobRowIdMap, blobColIdMap}=_mergeRowsCols(blob.rows||[], blob.cols||[]);
  if(blob.rowsByMonth){ if(!state.rowsByMonth) state.rowsByMonth={}; Object.assign(state.rowsByMonth, JSON.parse(JSON.stringify(blob.rowsByMonth))); }
  if(blob.colsByMonth){ if(!state.colsByMonth) state.colsByMonth={}; Object.assign(state.colsByMonth, JSON.parse(JSON.stringify(blob.colsByMonth))); }
  selectedMonths.forEach(mk2=>{
    Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|')) delete state.cells[k]; });
    const blobMonthCells=(blob.cellsByMonth||{})[mk2]||{};
    Object.entries(blobMonthCells).forEach(([k,v])=>{
      const parts=k.split('|');
      const rId=blobRowIdMap[parts[1]], cId=blobColIdMap[parts[2]];
      if(rId&&cId) state.cells[mk2+'|'+rId+'|'+cId]=v;
    });
  });
}


function openPasteModal(){
  const overlay=document.createElement('div');overlay.className='share-overlay';
  const modal=document.createElement('div');modal.className='share-modal';
  const h=document.createElement('h3');h.textContent='Paste FiApp income data';
  const desc=document.createElement('span');desc.className='share-hint';desc.textContent='Paste a FIAPP-INC-… block copied from another Income Tracker. Pastes are undoable with Ctrl+Z.';
  const ta=document.createElement('textarea');ta.placeholder='Paste FIAPP-INC-… block here';
  const status=document.createElement('div');status.className='paste-status';status.textContent='Waiting for input…';
  const actions=document.createElement('div');actions.className='share-actions';
  const applyBtn=document.createElement('button');applyBtn.className='btn btn-sm';applyBtn.textContent='Apply';applyBtn.disabled=true;
  const cancelBtn=document.createElement('button');cancelBtn.className='btn btn-sm btn-ghost';cancelBtn.textContent='Cancel';
  let parsed=null;
  function refresh(){
    const v=ta.value.trim();
    if(!v){ status.textContent='Waiting for input…'; status.className='paste-status'; applyBtn.disabled=true; parsed=null; return; }
    try{
      const obj=decodeBlob(v);
      parsed=obj;
      let label='';
      if(obj.kind==='INC-MONTH'){
        const [yy,mm]=obj.monthKey.split('-');
        label='This month - '+MONTHS_FULL[parseInt(mm,10)-1]+' '+yy;
      } else if(obj.kind==='INC-FULL'){
        const months=Object.keys(obj.cellsByMonth||{}).filter(k=>Object.keys(obj.cellsByMonth[k]).length).length;
        if(months===0){
          status.textContent='⚠ This blob has no month data - the income tracker was empty when it was copied.';
          status.className='paste-status bad';
          applyBtn.disabled=true;
          parsed=null;
          return;
        }
        label='Full data - '+months+' month'+(months===1?'':'s');
      } else {
        throw new Error('This blob is from a different tracker ('+obj.kind+'). Open the matching tracker page to paste it.');
      }
      status.textContent='Detected: '+label;status.className='paste-status ok';applyBtn.disabled=false;
    }catch(err){
      status.textContent='⚠ '+err.message+' Make sure you copied the entire FIAPP-… line.';
      status.className='paste-status bad';applyBtn.disabled=true;parsed=null;
    }
  }
  ta.addEventListener('input',refresh);
  ta.addEventListener('paste',()=>setTimeout(refresh,30));
  applyBtn.addEventListener('click',()=>{
    if(!parsed) return;
    if(parsed.kind==='INC-MONTH'){
      snapshot();importIncMonth(parsed);save();render();
      overlay.remove();showExportFlash('✓ Pasted (this month)');
    } else if(parsed.kind==='INC-FULL'){
      overlay.remove();showMonthPicker(parsed);
    }
  });
  cancelBtn.addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  actions.appendChild(applyBtn);actions.appendChild(cancelBtn);
  modal.appendChild(h);modal.appendChild(desc);modal.appendChild(ta);modal.appendChild(status);modal.appendChild(actions);
  overlay.appendChild(modal);document.body.appendChild(overlay);
  setTimeout(()=>ta.focus(),20);
}

function showMonthPicker(blob){
  const overlay=document.createElement('div');overlay.className='share-overlay';
  const modal=document.createElement('div');modal.className='share-modal';
  const h=document.createElement('h3');h.textContent='Choose months to overwrite';
  const desc=document.createElement('span');desc.className='share-hint';desc.textContent='Pick which months from the pasted blob to apply. Months you don\'t pick stay untouched.';
  const months=Object.keys(blob.cellsByMonth||{}).filter(k=>Object.keys(blob.cellsByMonth[k]).length).sort();
  const tools=document.createElement('div');tools.className='picker-tools';
  const allBtn=document.createElement('button');allBtn.textContent='All';
  const noneBtn=document.createElement('button');noneBtn.textContent='None';
  tools.appendChild(allBtn);tools.appendChild(noneBtn);
  const list=document.createElement('div');list.className='month-picker';
  const checks=[];
  months.forEach(mk2=>{
    const lbl=document.createElement('label');
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;cb.value=mk2;
    const [yy,mm]=mk2.split('-');
    const cellCount=Object.keys(blob.cellsByMonth[mk2]).length;
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' '+MONTHS_FULL[parseInt(mm,10)-1]+' '+yy+'   ('+cellCount+' values)'));
    list.appendChild(lbl);checks.push(cb);
  });
  allBtn.addEventListener('click',()=>checks.forEach(c=>c.checked=true));
  noneBtn.addEventListener('click',()=>checks.forEach(c=>c.checked=false));
  const actions=document.createElement('div');actions.className='share-actions';
  const applyBtn=document.createElement('button');applyBtn.className='btn btn-sm';applyBtn.textContent='Apply selected';
  const cancelBtn=document.createElement('button');cancelBtn.className='btn btn-sm btn-ghost';cancelBtn.textContent='Cancel';
  applyBtn.addEventListener('click',()=>{
    const sel=checks.filter(c=>c.checked).map(c=>c.value);
    if(!sel.length){ showToast('Pick at least one month, or click Cancel.'); return; }
    snapshot();importIncFull(blob,sel);save();render();
    overlay.remove();showExportFlash('✓ Pasted '+sel.length+' month'+(sel.length===1?'':'s'));
  });
  cancelBtn.addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  actions.appendChild(applyBtn);actions.appendChild(cancelBtn);
  modal.appendChild(h);modal.appendChild(desc);modal.appendChild(tools);modal.appendChild(list);modal.appendChild(actions);
  overlay.appendChild(modal);document.body.appendChild(overlay);
}

function downloadBlob(filename, blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function downloadText(filename, text, mime){
  downloadBlob(filename,new Blob([text],{type:mime||'text/plain;charset=utf-8'}));
}

let _xlsxLoaded=false,_xlsxLoading=null;
function lazyLoadXlsx(){
  if(_xlsxLoaded) return Promise.resolve();
  if(_xlsxLoading) return _xlsxLoading;
  _xlsxLoading=new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='/static/js/vendor/xlsx.full.min.js';
    s.onload=()=>{_xlsxLoaded=true;res();};
    s.onerror=()=>rej(new Error('Failed to load XLSX library'));
    document.head.appendChild(s);
  });
  return _xlsxLoading;
}
function exportXlsx(filename){
  lazyLoadXlsx().then(()=>{
    const ws=XLSX.utils.aoa_to_sheet(buildRowsArray());
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Income');
    XLSX.writeFile(wb,filename);
  }).catch(err=>showToast('Could not load XLSX library: '+err.message));
}

let _openExportMenu=null;
// Hover-to-open, click-to-select: the submenu opens on mouseenter and stays open while
// the pointer is over either the Export button or the submenu itself, closing shortly
// after the pointer leaves both - like a native nested menu, instead of requiring a
// click just to see the options.
let _exportCloseTimer=null;
function _cancelExportClose(){ if(_exportCloseTimer){clearTimeout(_exportCloseTimer);_exportCloseTimer=null;} }
function _scheduleExportClose(){ _exportCloseTimer=setTimeout(closeExportMenu,200); }
function closeExportMenu(){
  if(_openExportMenu){_openExportMenu.remove();_openExportMenu=null;}
  document.removeEventListener('click',closeExportMenu,true);
}
function showExportMenu(ev){
  ev.stopPropagation();
  if(_openExportMenu) return;
  const ym=String(state.currentYear)+'-'+String(state.currentMonth+1).padStart(2,'0');
  const base='income-'+ym;
  const menu=document.createElement('div');menu.className='export-menu';
  const formats=[
    {label:'📄 CSV',  fn:()=>downloadText(base+'.csv',buildCsv(),'text/csv;charset=utf-8')},
    {label:'{ } JSON',fn:()=>downloadText(base+'.json',buildJson(),'application/json')},
    {label:'📃 TXT',  fn:()=>downloadText(base+'.txt',buildTxt(),'text/plain;charset=utf-8')},
    {label:'📊 XLSX', fn:()=>exportXlsx(base+'.xlsx')},
    {label:'📋 Copy table - This month', fn:()=>clipboardWrite(encodeBlob(buildIncMonthBlob())).then(ok=>showExportFlash(ok?'✓ Copied (this month)':'Copy failed'))},
    {label:'📋 Copy table - Full data',  fn:()=>clipboardWrite(encodeBlob(buildIncFullBlob())).then(ok=>showExportFlash(ok?'✓ Copied (full)':'Copy failed'))},
  ];
  formats.forEach(f=>{
    const btn=document.createElement('button');btn.textContent=f.label;
    btn.addEventListener('click',e=>{e.stopPropagation();closeExportMenu();closeDropdown('dd-more');f.fn();});
    menu.appendChild(btn);
  });
  // Flyout beside the Export row itself, not up near the "..." toggle: the parent overflow
  // menu now stays open while this submenu is shown (hover-driven), so there's no reason
  // to anchor near the toggle anymore - that only made sense when opening Export used to
  // close the parent list out from under it. Anchor to the right edge of the parent menu,
  // vertically aligned with the Export row, like a native nested menu.
  const exportRect=document.getElementById('export-btn').getBoundingClientRect();
  const parentRect=document.getElementById('dd-more-menu').getBoundingClientRect();
  menu.style.top=exportRect.top+'px';
  menu.style.left=(parentRect.right+4)+'px';
  menu.addEventListener('mouseenter',_cancelExportClose);
  menu.addEventListener('mouseleave',_scheduleExportClose);
  document.body.appendChild(menu);
  _openExportMenu=menu;
  if(menu.getBoundingClientRect().right > window.innerWidth - 8){
    menu.style.left=Math.max(4, parentRect.left - menu.offsetWidth - 4)+'px';
  }
  if(menu.getBoundingClientRect().bottom > window.innerHeight - 8){
    menu.style.top=Math.max(4, window.innerHeight - menu.offsetHeight - 8)+'px';
  }
  setTimeout(()=>document.addEventListener('click',closeExportMenu,true),50);
}

async function shareSheet(){
  const text=buildTxt();
  const title='FiApp Income - '+MONTHS_SHORT[state.currentMonth]+' '+state.currentYear;
  const isMobile=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if(isMobile&&navigator.share){
    try{await navigator.share({title,text});return;}catch(e){if(e.name==='AbortError')return;}
  }
  showShareModal(title,text);
}
function showShareModal(title,text){
  const overlay=document.createElement('div');overlay.className='share-overlay';
  const modal=document.createElement('div');modal.className='share-modal';
  const h=document.createElement('h3');h.textContent='Share - '+title;
  const ta=document.createElement('textarea');ta.readOnly=true;ta.value=text;
  const hint=document.createElement('span');hint.className='share-hint';
  hint.textContent='Copy puts a tab-separated version on your clipboard - pastes cleanly into Word, Docs, Excel and Sheets.';

  const tsv=buildTsv();
  const MAX_BODY=1500;
  const bodyText=text.length>MAX_BODY?text.slice(0,MAX_BODY)+'\n…(truncated - use Export for full data)':text;

  const actions=document.createElement('div');actions.className='share-actions';
  const flash=document.createElement('span');flash.className='share-flash';

  const copyBtn=document.createElement('button');copyBtn.className='btn btn-sm';copyBtn.textContent='📋 Copy';
  copyBtn.addEventListener('click',()=>{
    clipboardWrite(tsv).then(ok=>{
      flash.textContent=ok?'Copied (TSV)!':'Copy failed';
      setTimeout(()=>flash.textContent='',1800);
    });
  });

  const emailTextBtn=document.createElement('a');emailTextBtn.className='btn btn-sm';emailTextBtn.textContent='📧 Email as Text';
  emailTextBtn.href=gmailHref(title,bodyText);emailTextBtn.target='_blank';emailTextBtn.rel='noopener noreferrer';

  const ym=String(state.currentYear)+'-'+String(state.currentMonth+1).padStart(2,'0');
  const xlsxBody='I\'m sharing my FiApp income spreadsheet. Open FiApp at https://fiapp.onrender.com/income to view your own data.\n\nAttached XLSX file (saved to your Downloads folder): income-'+ym+'.xlsx';
  const emailXlsxBtn=document.createElement('a');emailXlsxBtn.className='btn btn-sm';emailXlsxBtn.textContent='📧 Email as XLSX';
  emailXlsxBtn.href=gmailHref(title,xlsxBody);emailXlsxBtn.target='_blank';emailXlsxBtn.rel='noopener noreferrer';
  emailXlsxBtn.addEventListener('click',()=>{
    exportXlsx('income-'+ym+'.xlsx');
    flash.textContent='XLSX downloading - drag it into Gmail to attach.';
    setTimeout(()=>flash.textContent='',5000);
  });

  const blobStr=encodeBlob(buildIncMonthBlob());
  const blobBody='Here is my income data for '+MONTHS_SHORT[state.currentMonth]+' '+state.currentYear+'.\n\nPaste this block into the FiApp Income Tracker at https://fiapp.onrender.com/income using the 📋 Paste button to load the data:\n\n'+blobStr;
  const emailBlobBtn=document.createElement('a');emailBlobBtn.className='btn btn-sm';emailBlobBtn.textContent='📧 Email as FiApp Paste-link';
  emailBlobBtn.href=gmailHref(title,blobBody.slice(0,2000));emailBlobBtn.target='_blank';emailBlobBtn.rel='noopener noreferrer';

  const closeBtn=document.createElement('button');closeBtn.className='btn btn-sm btn-ghost';closeBtn.textContent='Close';
  closeBtn.addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});

  actions.appendChild(flash);actions.appendChild(copyBtn);actions.appendChild(emailTextBtn);actions.appendChild(emailXlsxBtn);actions.appendChild(emailBlobBtn);
  actions.appendChild(closeBtn);
  modal.appendChild(h);modal.appendChild(ta);modal.appendChild(hint);modal.appendChild(actions);
  overlay.appendChild(modal);document.body.appendChild(overlay);
}


(()=>{
  const tip=document.createElement('div');tip.id='swatch-tip';document.body.appendChild(tip);
  document.addEventListener('mouseover',e=>{
    const host=e.target.closest('.tip-host[data-tip]');
    if(!host||!host.closest('.rh-inner')){tip.classList.remove('show');return;}
    tip.textContent=host.dataset.tip;
    const r=host.getBoundingClientRect();
    tip.style.left=(r.left+r.width/2)+'px';
    tip.style.top=(r.top-8)+'px';
    tip.style.transform='translate(-50%,-100%)';
    tip.classList.add('show');
  });
  document.addEventListener('mouseout',e=>{
    const host=e.target.closest('.tip-host[data-tip]');
    if(host&&host.closest('.rh-inner')) tip.classList.remove('show');
  });
  document.addEventListener('touchstart',e=>{
    const host=e.target.closest('.tip-host[data-tip]');
    if(!host||!host.closest('.rh-inner')){tip.classList.remove('show');return;}
    tip.textContent=host.dataset.tip;
    const r=host.getBoundingClientRect();
    tip.style.left=(r.left+r.width/2)+'px';
    tip.style.top=(r.top-8)+'px';
    tip.style.transform='translate(-50%,-100%)';
    tip.classList.add('show');
  },{passive:true});
  document.addEventListener('touchend',e=>{
    setTimeout(()=>{ tip.classList.remove('show'); },600);
  },{passive:true});
})();

function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function _esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}

(async()=>{
  // Local-first: render whatever this device already has BEFORE any network I/O,
  // so a dead or stalled connection can never blank the tracker.
  try{ state=loadState(); }catch(e){ console.warn('FiApp: loadState failed',e); state=freshState(); }
  try{ _monthsWithDataAtLoad=new Set(Object.keys(state.cells||{}).filter(k=>parseFloat(state.cells[k])>0).map(k=>k.split('|')[0])); }catch(e){ _monthsWithDataAtLoad=new Set(); }
  try{ loadHistory(); }catch(e){}
  try{ updateHistBtns(); }catch(e){}
  try{ updateMonthNav(); }catch(e){ console.error('FiApp: updateMonthNav failed',e); }

  // Non-blocking on purpose: rate fetches must never delay first render (a
  // stalled network would otherwise blank the tracker for up to 15s). The
  // .then callbacks update the note / re-render when rates arrive.
  function _initCurrencyUI(){
    const dc=state.displayCurrency||'USD';
    const dcSel=document.getElementById('curr-sel');
    if(dc!=='USD'&&dcSel){
      if(![...dcSel.options].find(o=>o.value===dc)){
        const opt=document.createElement('option'); opt.value=dc; opt.textContent=dc; opt.dataset.custom='1';
        dcSel.insertBefore(opt, dcSel.querySelector('option[value="__other__"]'));
      }
      dcSel.value=dc;
      ensureRate(dc).then(()=>{
        if(ratesCache[dc]){
          const cn=document.getElementById('curr-note'); if(cn) cn.textContent='1 USD = '+ratesCache[dc].toFixed(4)+' '+dc+_staleNote();
          showConvFields(dc,ratesCache[dc]);
        }
      }).catch(()=>{});
    }
  }
  try{ _initCurrencyUI(); }catch(e){ console.warn('FiApp: currency init failed',e); }
  try{
    const usedCurs=[...new Set(Object.values(state.monthRowCurrencies||{}).filter(c=>c&&c!=='USD'))];
    // Re-render once rates land so non-USD rows show converted values.
    if(usedCurs.length) fetchAndCacheUSDRates().then(()=>{ try{ render(); }catch(_){} }).catch(()=>{});
  }catch(e){}
  try{ render(); }catch(e){ console.error('FiApp: render failed',e); }
  // D (Playful): one-off, dismissable orientation tip, once per session. No-op for
  // Default/Quiet (gated inside fiappMascotTip) and skipped while the walkthrough runs.
  try{ if(window.fiappMascotTip && !(typeof isWalkthroughActive==='function'&&isWalkthroughActive())) fiappMascotTip('Tip: income is tracked per month too. Use the month picker up top to switch.','inc-tip'); }catch(_){}

  // Background: establish auth (bounded), refresh from the server, re-render on change.
  try{
    const me=await window.fiappFetchTimeout('/auth/me',5000).then(r=>r.json());
    window.__currentUser=me.username||null;
    const badge=document.getElementById('auth-badge-container');
    if(badge){
      if(me.username){
        badge.innerHTML='<div class="acct-menu-wrap">'
          +'<button class="btn-ghost btn-sm" id="dyn-acct-menu-btn">👤 '+_esc(me.username)+'</button>'
          +'<div class="acct-dropdown">'
          +'<a href="/account" class="acct-item">⚙ Account settings</a>'
          +'<button class="acct-item acct-logout" id="dyn-logout-btn">⬅ Log out</button>'
          +'</div>'
          +'</div>';
        var _dynAcct=document.getElementById('dyn-acct-menu-btn');
        if(_dynAcct) _dynAcct.addEventListener('click',function(e){toggleAcctMenu(e.currentTarget);});
        var _dynLogout=document.getElementById('dyn-logout-btn');
        if(_dynLogout) _dynLogout.addEventListener('click',function(e){logOutStep(e.currentTarget);});
      } else {
        badge.innerHTML='<a class="btn-ghost btn-sm" href="/login">Log in</a>';
      }
    }
  }catch(e){ window.__currentUser=null; }
  if(!window.__currentUser) setSyncStatus('Offline','');

  const _preRaw=localStorage.getItem(STORAGE_KEY);
  try{ await loadFromServer(); }catch(e){ console.warn('FiApp: loadFromServer failed',e); }
  // JSONB round-trips reorder object keys, so raw strings can differ even when the
  // data is identical; compare semantically (_deepEqual is a tracker-sync.js global)
  // so a plain online load doesn't force a focus-destroying cosmetic re-render.
  const _blobChanged=(pre,key)=>{
    const post=localStorage.getItem(key);
    if(post===pre) return false;
    try{ return !_deepEqual(JSON.parse(pre||'null'),JSON.parse(post||'null')); }catch(_){ return true; }
  };
  if(_blobChanged(_preRaw,STORAGE_KEY)){
    try{ state=loadState(); }catch(e){}
    try{ _monthsWithDataAtLoad=new Set(Object.keys(state.cells||{}).filter(k=>parseFloat(state.cells[k])>0).map(k=>k.split('|')[0])); }catch(e){ _monthsWithDataAtLoad=new Set(); }
    try{ updateMonthNav(); }catch(e){}
    try{ _initCurrencyUI(); }catch(e){}
    try{
      const usedCurs=[...new Set(Object.values(state.monthRowCurrencies||{}).filter(c=>c&&c!=='USD'))];
      // Server sync can introduce new non-USD row currencies; fetch rates for them
      // (no-op when the full USD table is already cached this session).
      if(usedCurs.length) fetchAndCacheUSDRates().then(()=>{ try{ render(); }catch(_){} }).catch(()=>{});
    }catch(e){}
    try{ render(); }catch(e){ console.error('FiApp: render failed',e); }
  }
})();

function openHelp(){ document.getElementById('help-modal').style.display='flex'; }
function closeHelp(){ document.getElementById('help-modal').style.display='none'; }
function toggleDropdown(id, e){
  e && e.stopPropagation();
  const wrap = document.getElementById(id);
  const menu = document.getElementById(id+'-menu');
  const isOpen = menu.classList.contains('open');
  // "Copy to" (#dd-copy-to) nests inside the "..." overflow menu (#dd-more-menu) so it can
  // sit alongside the other copy actions. Its menu is position:absolute relative to its own
  // #dd-copy-to wrapper, so if the ancestor dd-more-menu were closed (display:none) here,
  // the nested menu would render invisible even with .open set. Skip closing any open menu
  // that is itself an ancestor of the dropdown being toggled.
  document.querySelectorAll('.dropdown-menu.open').forEach(m=>{ if(!wrap || !m.contains(wrap)) m.classList.remove('open'); });
  if(!isOpen) menu.classList.add('open');
}
function closeDropdown(id){ document.getElementById(id+'-menu').classList.remove('open'); }
document.addEventListener('click', ()=>{ document.querySelectorAll('.dropdown-menu.open').forEach(m=>m.classList.remove('open')); });
document.addEventListener('keydown',function(e){ if(e.key==='Escape') document.querySelectorAll('.dropdown-menu.open').forEach(function(m){m.classList.remove('open');}); });

// Batch D Wave 4: mobile quick-add sheet. Income's grid isn't a fixed weekly layout
// like expenses (columns vary per row set), so the target is simply that row's first
// column, written additively in the row's own currency (no cross-currency conversion -
// the amount typed is assumed to already be in that row's set currency).
function openQuickAdd(){
  var sheet=document.getElementById('qa-sheet');
  var backdrop=document.getElementById('qa-backdrop');
  if(!sheet||!backdrop) return;
  var chips=document.getElementById('qa-chips');
  chips.innerHTML='';
  // Offer every directly-editable (leaf) source: childless top-level rows AND subcategories.
  // A parent that has subcategories is excluded because its cell is a computed sum of its
  // children. Subcategories are labelled "Parent > Child" so they read distinctly.
  var _qaRows=getRows();
  _qaRows.filter(function(r){ return !hasChildren(r.id); }).forEach(function(row,i){
    var label=row.label;
    if(row.parentId){ var p=_qaRows.find(function(x){return x.id===row.parentId;}); if(p) label=p.label+' › '+row.label; }
    var chip=document.createElement('button');
    chip.type='button'; chip.className='qa-chip'+(i===0?' selected':'');
    chip.textContent=label; chip.dataset.rowId=row.id;
    chip.addEventListener('click',function(){
      chips.querySelectorAll('.qa-chip').forEach(function(c){c.classList.remove('selected');});
      chip.classList.add('selected');
    });
    chips.appendChild(chip);
  });
  document.getElementById('qa-amount').value='';
  _qaSetSign('add'); // always reopen in Add mode - Subtract never carries over between uses
  backdrop.classList.add('open'); sheet.classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(function(){ var a=document.getElementById('qa-amount'); if(a) a.focus(); },50);
}
function closeQuickAdd(){
  var sheet=document.getElementById('qa-sheet');
  var backdrop=document.getElementById('qa-backdrop');
  if(sheet) sheet.classList.remove('open');
  if(backdrop) backdrop.classList.remove('open');
  document.body.style.overflow='';
}
// The quick-add FAB's only mode used to be "add to this cell" - there was no
// mobile-friendly way to record a correction without opening the row and doing the
// subtraction by hand. This toggle picks the sign; the amount you type is always
// entered as a positive magnitude.
function _qaSetSign(sign){
  var addBtn=document.getElementById('qa-sign-add'), subBtn=document.getElementById('qa-sign-sub');
  if(!addBtn||!subBtn) return;
  addBtn.classList.toggle('selected',sign==='add');
  subBtn.classList.toggle('selected',sign==='sub');
}
function _qaSign(){
  var subBtn=document.getElementById('qa-sign-sub');
  return (subBtn&&subBtn.classList.contains('selected'))?'sub':'add';
}
function saveQuickAdd(){
  var amt=parseFloat(document.getElementById('qa-amount').value);
  if(!amt||amt<=0) return;
  var chip=document.querySelector('.qa-chip.selected');
  if(!chip) return;
  var col=getCols()[0];
  if(!col) return;
  if(_isClosedMonth(currentMK())){ showToast('🔒 Month is locked.'); closeQuickAdd(); return; }
  snapshot();
  var key=ck(chip.dataset.rowId,col.id);
  var existing=parseFloat(state.cells[key])||0;
  var next=_qaSign()==='sub'?Math.max(0,existing-amt):existing+amt;
  if(next===0) delete state.cells[key]; else state.cells[key]=next.toFixed(2);
  save(); render();
  closeQuickAdd();
}
(function(){
  var openBtn=document.getElementById('qa-open-btn');
  if(openBtn) openBtn.addEventListener('click',function(){
    if(window.innerWidth<640){ openQuickAdd(); return; }
    // Desktop already shows the whole spreadsheet - every cell is already one click
    // away, so there's nothing to "jump to". The genuinely new action here is a new
    // income source row (same as the overflow menu's "Add row").
    addRow();
    var wrap=document.getElementById('inc-sheet-wrap');
    if(wrap) wrap.scrollIntoView({behavior:'smooth',block:'end'});
    var rows=getRows().filter(function(r){return !r.parentId;});
    var newRow=rows[rows.length-1];
    if(newRow){
      setTimeout(function(){
        var tr=document.querySelector('[data-tr-row-id="'+newRow.id+'"]');
        var label=tr&&tr.querySelector('.row-label');
        if(label){ label.focus(); if(label.select) label.select(); }
      },350);
    }
  });
  var fab=document.getElementById('add-fab');
  if(fab) fab.addEventListener('click',openQuickAdd);
  var cancelBtn=document.getElementById('qa-cancel-btn');
  if(cancelBtn) cancelBtn.addEventListener('click',closeQuickAdd);
  var saveBtn=document.getElementById('qa-save-btn');
  if(saveBtn) saveBtn.addEventListener('click',saveQuickAdd);
  var backdrop=document.getElementById('qa-backdrop');
  if(backdrop) backdrop.addEventListener('click',closeQuickAdd);
  var signAddBtn=document.getElementById('qa-sign-add'), signSubBtn=document.getElementById('qa-sign-sub');
  if(signAddBtn) signAddBtn.addEventListener('click',function(){ _qaSetSign('add'); });
  if(signSubBtn) signSubBtn.addEventListener('click',function(){ _qaSetSign('sub'); });
})();

(function(){var b=document.getElementById('close-modal-cancel');if(b)b.addEventListener('click',cancelClose);})();
(function(){var b=document.getElementById('close-modal-confirm');if(b)b.addEventListener('click',confirmClose);})();
// Static toolbar event wiring (replaces onclick= attributes)
document.getElementById('help-open-btn').addEventListener('click',openHelp);
document.getElementById('guide-btn').addEventListener('click',function(){wtStartEnhanced('income');});
document.getElementById('month-jump').addEventListener('change',function(){jumpToMonth(this.value);});
document.getElementById('curr-sel').addEventListener('change',onCurrencyChange);
document.getElementById('prev-btn').addEventListener('click',function(){shiftMonth(-1);});
document.getElementById('next-btn').addEventListener('click',function(){shiftMonth(1);});
document.getElementById('copy-prev-btn').addEventListener('click',function(){copyStructureFromPrevMonth();closeDropdown('dd-more');});
document.getElementById('copy-month-btn').addEventListener('click',function(){showMonthCopyPicker();closeDropdown('dd-more');});
document.getElementById('copy-to-toggle').addEventListener('click',function(e){openCopyToDropdown(e);});
document.getElementById('forecast-copy-last-btn').addEventListener('click',copyLastMonth);
document.getElementById('forecast-avg-btn').addEventListener('click',useAverages);
document.getElementById('curr-other-btn').addEventListener('click',applyOtherCurrency);
document.getElementById('undo-btn').addEventListener('click',undo);
document.getElementById('redo-btn').addEventListener('click',redo);
document.getElementById('more-menu-toggle').addEventListener('click',function(e){toggleDropdown('dd-more',e);});
document.getElementById('add-row-btn').addEventListener('click',function(){addRow();closeDropdown('dd-more');});
document.getElementById('add-col-btn').addEventListener('click',function(){addCol();closeDropdown('dd-more');});
document.getElementById('share-btn').addEventListener('click',function(){shareSheet();closeDropdown('dd-more');});
(function(){
  var exportBtn=document.getElementById('export-btn');
  exportBtn.addEventListener('mouseenter',function(e){ _cancelExportClose(); showExportMenu(e); });
  exportBtn.addEventListener('mouseleave',_scheduleExportClose);
  // Touch/keyboard fallback: hover events don't fire on tap, so a plain click still
  // opens the submenu (parent overflow menu is left open so the format list is
  // reachable - selecting a format closes both, see the click handler in showExportMenu).
  exportBtn.addEventListener('click',function(e){ if(!_openExportMenu) showExportMenu(e); });
})();
document.getElementById('paste-btn').addEventListener('click',function(){openPasteModal();closeDropdown('dd-more');});
document.getElementById('expand-btn').addEventListener('click',expandAll);
document.getElementById('collapse-btn').addEventListener('click',collapseAll);
document.getElementById('reset-btn').addEventListener('click',resetAll);
document.getElementById('chart-mode-m').addEventListener('click',function(){setChartMode('monthly');});
document.getElementById('chart-mode-y').addEventListener('click',function(){setChartMode('yearly');});
document.getElementById('chart-type-bar').addEventListener('click',function(){setChartType('bar');});
document.getElementById('chart-type-doughnut').addEventListener('click',function(){setChartType('doughnut');});
document.getElementById('help-modal').addEventListener('click',function(e){if(e.target===this)closeHelp();});
document.getElementById('help-close-btn').addEventListener('click',closeHelp);

// ── Voice Input Bridge ──────────────────────────────────────────────────
window._incVoiceBridge = {
  getRows, getCols, currentMK, snapshot, setCell, updateAll, render,
  addRow, forkCurrentMonth, deleteRow,
  addSubRow: function(parentRowId, subLabel) {
    var parentRow = getRows().find(function(r){ return r.id === parentRowId; });
    if (parentRow) addSubRow(parentRow, subLabel);
  },
  getCell: function(rId, cId) { return state.cells[currentMK()+'|'+rId+'|'+cId]; },
  setRowCurrency: function(rowId, cur) { setRowCurrency(currentMK(), rowId, cur); },
  rowCurrency:    function(rowId)      { return rowCurrency(currentMK(), rowId); },
  isLockedMonth:   function() { return _isClosedMonth(currentMK()); },
  isForecastMonth: function() { return isForecastMonth(); },
};


        if(/^[A-Z]{2,5}$/.test(k)&&typeof rates[k]==='number') ratesCache[k]=rates[k];
      });
      ratesReady=true;
      _ratesStaleDate=obj.stale?obj.fetched_at:null;
    }
  }catch(e){ console.warn('FiApp: rate fetch failed -',e.message); }
}
async function ensureRate(currency){
  if(!currency||currency==='USD'||ratesCache[currency]) return;
  await fetchAndCacheUSDRates();
}
function rowCurrency(monthKey, rowId){ return (state.monthRowCurrencies||{})[monthKey+'|'+rowId]||'USD'; }
function setRowCurrency(monthKey, rowId, cur){
  if(!state.monthRowCurrencies) state.monthRowCurrencies={};
  state.monthRowCurrencies[monthKey+'|'+rowId]=cur; save();
}
function amountToUSD(rawAmt, monthKey, rowId){
  if(!rawAmt) return 0;
  const cur=rowCurrency(monthKey, rowId);
  if(cur==='USD') return rawAmt;
  const rate=ratesCache[cur];
  return rate?rawAmt/rate:rawAmt;
}
function getAllUsedCurrencies(){
  const set=new Set(CELL_CURRENCIES);
  Object.values(state.monthRowCurrencies||{}).forEach(c=>{ if(c) set.add(c); });
  return [...set];
}

function showConvFields(cur,rate){
  currentRate=rate;
  document.getElementById('conv-lbl').textContent='Total ('+cur+')';
  document.getElementById('conv-wrap').style.display='';
  updateSummaryBar();
}
function hideConvFields(){
  currentRate=1;
  document.getElementById('conv-wrap').style.display='none';
  document.getElementById('curr-note').textContent='';
  updateSummaryBar();
}
function onCurrencyChange(){
  const sel=document.getElementById('curr-sel');
  const cur=sel.value;
  const otherInp=document.getElementById('curr-other-inp');
  const otherBtn=document.getElementById('curr-other-btn');
  if(cur==='__other__'){
    otherInp.style.display='inline-block'; otherBtn.style.display='inline-block';
    document.getElementById('curr-note').textContent='Enter a currency code then click OK.';
    return;
  }
  otherInp.style.display='none'; otherBtn.style.display='none';
  state.displayCurrency=cur; save();
  if(cur==='USD'){ hideConvFields(); return; }
  document.getElementById('curr-note').textContent='Fetching…';
  if(ratesCache[cur]){
    document.getElementById('curr-note').textContent='1 USD = '+ratesCache[cur].toFixed(4)+' '+cur+_staleNote();
    showConvFields(cur,ratesCache[cur]); return;
  }
  fiappGetRates('USD').then(obj=>{
      const rates=obj.rates;
      if(rates&&typeof rates==='object'&&!Array.isArray(rates)){
        Object.keys(rates).forEach(k=>{if(/^[A-Z]{2,5}$/.test(k)&&typeof rates[k]==='number') ratesCache[k]=rates[k];});
        ratesReady=true;
        _ratesStaleDate=obj.stale?obj.fetched_at:null;
      }
      const rate=ratesCache[cur];
      if(!rate){document.getElementById('curr-note').textContent='Unknown currency: '+cur;return;}
      document.getElementById('curr-note').textContent='1 USD = '+rate.toFixed(4)+' '+cur+_staleNote();
      showConvFields(cur,rate);
    }).catch(()=>{document.getElementById('curr-note').textContent='Network error';});
}
function applyOtherCurrency(){
  const raw=(document.getElementById('curr-other-inp').value||'').trim().toUpperCase();
  if(!raw||!/^[A-Z]{2,5}$/.test(raw)){document.getElementById('curr-note').textContent='Invalid code (2–5 letters).';return;}
  if(raw==='USD'){state.displayCurrency='USD';save();hideConvFields();document.getElementById('curr-sel').value='USD';return;}
  document.getElementById('curr-note').textContent='Fetching…';
  fiappGetRates('USD').then(obj=>{
      const rates=obj.rates;
      if(rates&&typeof rates==='object'){
        Object.keys(rates).forEach(k=>{if(/^[A-Z]{2,5}$/.test(k)&&typeof rates[k]==='number') ratesCache[k]=rates[k];});
        ratesReady=true;
        _ratesStaleDate=obj.stale?obj.fetched_at:null;
      }
      const rate=ratesCache[raw];
      if(!rate){document.getElementById('curr-note').textContent='Unknown currency: '+raw;return;}
      
      const sel=document.getElementById('curr-sel');
      if(![...sel.options].find(o=>o.value===raw)){
        const opt=document.createElement('option'); opt.value=raw; opt.textContent=raw; opt.dataset.custom='1';
        sel.insertBefore(opt, sel.querySelector('option[value="__other__"]'));
      }
      sel.value=raw;
      document.getElementById('curr-other-inp').style.display='none';
      document.getElementById('curr-other-btn').style.display='none';
      state.displayCurrency=raw; save();
      document.getElementById('curr-note').textContent='1 USD = '+rate.toFixed(4)+' '+raw+_staleNote();
      showConvFields(raw,rate);
    }).catch(()=>{document.getElementById('curr-note').textContent='Network error';});
}
function showCellCurrencyOther(wrap, sel, row){
  sel.style.display='none';
  const form=document.createElement('span'); form.className='curr-other-cell';
  const inp=document.createElement('input'); inp.type='text'; inp.maxLength=5; inp.placeholder='VND';
  const ok=document.createElement('button'); ok.textContent='✓'; ok.title='Apply'; ok.setAttribute('aria-label','Apply');
  const cancel=document.createElement('button'); cancel.textContent='✕'; cancel.title='Cancel'; cancel.className='x'; cancel.setAttribute('aria-label','Cancel');
  form.appendChild(inp); form.appendChild(ok); form.appendChild(cancel);
  wrap.appendChild(form);
  setTimeout(()=>inp.focus(),20);
  function showErr(msg){ const old=document.querySelector('.curr-other-err'); if(old) old.remove(); const e=document.createElement('span'); e.className='curr-other-err'; e.textContent=msg; const r=inp.getBoundingClientRect(); e.style.top=(r.bottom+4)+'px'; e.style.left=r.left+'px'; document.body.appendChild(e); }
  function close(){ form.remove(); const old=document.querySelector('.curr-other-err'); if(old) old.remove(); sel.style.display=''; sel.value=rowCurrency(currentMK(), row.id); }
  async function apply(){
    const code=inp.value.trim().toUpperCase();
    if(!code){showErr('Enter a code.');return;}
    if(!/^[A-Z]{2,5}$/.test(code)){showErr('2–5 letters only.');return;}
    if(code==='USD'){setRowCurrency(currentMK(), row.id, code);close();render();renderChart();return;}
    ok.disabled=true; ok.textContent='…';
    await ensureRate(code);
    if(!ratesCache[code]){showErr('Unknown: '+code);ok.disabled=false;ok.textContent='✓';return;}
    setRowCurrency(currentMK(), row.id, code); close(); render(); renderChart();
  }
  ok.addEventListener('click',e=>{e.stopPropagation();apply();});
  cancel.addEventListener('click',e=>{e.stopPropagation();close();});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}if(e.key==='Escape'){close();}});
}

const CATEGORIES = {
  'Salary':       ['Base Pay','Overtime','Bonus','Commission','Tips'],
  'Freelance':    ['Client Work','Consulting','Side Projects','Gigs'],
  'Investments':  ['Dividends','Capital Gains','Rental Income','Interest Income'],
  'Other Income': ['Gifts','Tax Refund','Reimbursements','Miscellaneous'],
};
const CAT_KEYS = Object.keys(CATEGORIES);
const CAT_COLORS = {
  'Salary':'#bbf7d0','Freelance':'#bfdbfe','Investments':'#fed7aa','Other Income':'#e9d5ff',
};
function uid(){ return '_'+Math.random().toString(36).slice(2,9); }


function freshState(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();
  return {
    rows:[
      {id:uid(),label:'Salary',      color:'#bbf7d0',textColor:'#1f2937',height:36,parentId:null},
      {id:uid(),label:'Freelance',   color:'#bfdbfe',textColor:'#1f2937',height:36,parentId:null},
      {id:uid(),label:'Investments', color:'#fed7aa',textColor:'#1f2937',height:36,parentId:null},
      {id:uid(),label:'Other Income',color:'#e9d5ff',textColor:'#1f2937',height:36,parentId:null},
    ],
    cols:[
      {id:uid(),label:'Amount',width:160},
    ],
    headerColWidth:235, totalColWidth:110,
    cells:{}, cellTimes:{}, collapsed:{}, monthRowCurrencies:{},
    displayCurrency:'USD',
    currentYear:y, currentMonth:m,
    rowsByMonth:{}, colsByMonth:{},
    recurringRules:[],
  };
}
function loadState(){
  try{
    if(isWalkthroughActive()){
      // If the user already saved income this walkthrough session, show it so that
      // navigating Back doesn't wipe their entry. Session flag set by save(), cleared by _restore().
      if(localStorage.getItem('fiapp_income_wt_session')==='1'){
        const r=localStorage.getItem(STORAGE_KEY);
        if(r){try{
          const s=JSON.parse(r);
          if(s&&Array.isArray(s.rows)){
            // Same defensive backfill as the normal path below - a walkthrough
            // sandbox blob missing a field (e.g. state.collapsed) would otherwise
            // crash render() instead of falling back to a default.
            if(!s.cells) s.cells={};
            if(!s.cellTimes) s.cellTimes={};
            if(!s.collapsed) s.collapsed={};
            if(!s.monthRowCurrencies) s.monthRowCurrencies={};
            if(!s.rowsByMonth) s.rowsByMonth={};
            if(!s.colsByMonth) s.colsByMonth={};
            if(!Array.isArray(s.recurringRules)) s.recurringRules=[];
            return s;
          }
        }catch(_){}}
      }
      return freshState();
    }
  }catch(_){}
  try{
    const r=localStorage.getItem(STORAGE_KEY);
    if(r){
      const s=JSON.parse(r);
      if(!s.cells)          s.cells={};
      if(!s.cellTimes)      s.cellTimes={};
      if(!s.collapsed)      s.collapsed={};
      if(!s.monthRowCurrencies)  s.monthRowCurrencies={};
      if(!s.displayCurrency) s.displayCurrency='USD';
      if(!Array.isArray(s.rows)) s.rows=freshState().rows;
      if(!Array.isArray(s.cols)) s.cols=freshState().cols;
      if(!s.rowsByMonth)    s.rowsByMonth={};
      if(!s.colsByMonth)    s.colsByMonth={};
      if(!Array.isArray(s.recurringRules)) s.recurringRules=[];
      // The old default Source-column width (185) truncates the default category names;
      // widen columns that were never manually resized so e.g. 'Other Income' shows in full.
      if(s.headerColWidth===185) s.headerColWidth=235;
      // The last-viewed month is per-device view state and persists across visits
      // (matching the Expense tracker), so we keep s.currentYear/currentMonth as saved.
      return s;
    }
  }catch(e){ console.warn('FiApp: loadState failed, using fresh state -',e.message); }
  return freshState();
}
let state=loadState();
// B (Playful first-entry): months that already had data when this session started, so a
// later edit to an already-populated month is never mistaken for "first entry of a new
// month". Populated from the server-synced state once startup finishes (see below).
let _monthsWithDataAtLoad=null;

const MAX_ROWS=20;
const MAX_COLS=12;
function getRows(mk2){ return effectiveRowsForMonth(state, mk2||currentMK()); }
function getCols(mk2){ return effectiveColsForMonth(state, mk2||currentMK()); }
function forkCurrentMonth(){
  const mk2=currentMK();
  const _wasNew=!(state.rowsByMonth&&state.rowsByMonth[mk2]);
  if(!state.rowsByMonth) state.rowsByMonth={};
  if(!state.colsByMonth) state.colsByMonth={};
  if(_wasNew) _recFillNewMonth(mk2);
  if(!state.rowsByMonth[mk2]) state.rowsByMonth[mk2]=(state.rows||[]).map(r=>({...r}));
  if(!state.colsByMonth[mk2]) state.colsByMonth[mk2]=(state.cols||[]).map(c=>({...c}));
}
// ── Recurring rules: state accessors + writers (pure logic lives in recurring-core.js) ──
function _recRules(){ if(!Array.isArray(state.recurringRules)) state.recurringRules=[]; return state.recurringRules; }
function _recRuleFor(rowId){ return _recRules().find(r=>r.rowId===rowId)||null; }
function _monthTotalForRow(rowId, mk2){
  const cols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
  return cols.reduce((s,c)=> s+(parseFloat((state.cells||{})[mk2+'|'+rowId+'|'+c.id]||0)||0), 0);
}
function _existingMonths(){
  const set={};
  Object.keys(state.cells||{}).forEach(k=>{ set[k.split('|')[0]]=1; });
  Object.keys(state.rowsByMonth||{}).forEach(mk2=>{ set[mk2]=1; });
  Object.keys(state.colsByMonth||{}).forEach(mk2=>{ set[mk2]=1; });
  set[currentMK()]=1;
  return Object.keys(set);
}
// A top-level row lives in state.rows and so "exists" in every month via
// effectiveRowsForMonth's fallback, even ones never forked yet. A sub-source row only
// exists in the specific months whose fork explicitly includes it (addSubRow writes into
// state.rowsByMonth, never state.rows) - so this check is a no-op restriction for ordinary
// rows and a real one for sub-sources, without needing to special-case child rows.
function _rowExistsInMonth(rowId, mk2){ return getRows(mk2).some(r=>r.id===rowId); }
function _recOptsFor(rowId){
  return { existingMonths:_existingMonths().filter(mk2=>_rowExistsInMonth(rowId, mk2)), isLocked:_isClosedMonth,
           getMonthTotal:function(mk2){ return _monthTotalForRow(rowId, mk2); } };
}
function _ensureMonthForked(mk2){
  if(!state.rowsByMonth) state.rowsByMonth={};
  if(!state.colsByMonth) state.colsByMonth={};
  if(!state.rowsByMonth[mk2]) state.rowsByMonth[mk2]=(state.rows||[]).map(r=>({...r}));
  if(!state.colsByMonth[mk2]) state.colsByMonth[mk2]=(state.cols||[]).map(c=>({...c}));
}
function _recWriteMonth(rule, mk2){
  _ensureMonthForked(mk2);
  const cols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
  if(!state.cells) state.cells={};
  const val=FiRecurring.ruleValueForMonth(rule, mk2);
  cols.forEach((c,i)=>{
    const key=mk2+'|'+rule.rowId+'|'+c.id;
    if(rule.mode==='monthly'){ state.cells[key]=(i===0?String(val):'0'); }
    else { const w=(rule.weekly&&rule.weekly[i]!=null)?rule.weekly[i]:(i===0?val:0); state.cells[key]=String(w); }
    if(state.cellTimes) state.cellTimes[key]=Date.now();
  });
  // Apply the rule's chosen currency to the month it just wrote (inlined rather than
  // calling setRowCurrency, which saves immediately - the caller saves once, in bulk).
  if(rule.currency){
    if(!state.monthRowCurrencies) state.monthRowCurrencies={};
    state.monthRowCurrencies[mk2+'|'+rule.rowId]=rule.currency;
  }
}
function _recFillNewMonth(mk2){
  if(_isClosedMonth(mk2)) return false;
  let wrote=false;
  _recRules().forEach(rule=>{
    if(rule.draft) return;
    if(!FiRecurring.monthInScope(rule, mk2)) return;
    // A sub-source only exists in months whose fork explicitly added it - a brand-new
    // month forks from the top-level state.rows, which never contains sub-sources, so
    // silently skip rather than write an orphaned cell for a row that won't render here.
    if(!_rowExistsInMonth(rule.rowId, mk2)) return;
    if(_monthTotalForRow(rule.rowId, mk2)!==0) return;
    _recWriteMonth(rule, mk2); wrote=true;
  });
  return wrote;
}
function markRowRecurring(rowId, on){
  [state.rows].concat(Object.values(state.rowsByMonth||{})).forEach(arr=>{
    const r=(arr||[]).find(x=>x.id===rowId); if(r) r.recurring=!!on;
  });
}
function _recEligible(row, isChild){
  return !!row && !row.linked && !row.snapshotLinkedRow && !hasChildren(row.id);
}
function _recMkLabel(mk2){
  const p=String(mk2||'').split('-'); if(p.length<2) return mk2||'';
  const d=new Date(Number(p[0]), Number(p[1])-1, 1);
  return d.toLocaleDateString(undefined,{month:'short',year:'numeric'});
}
function _recUnlockMonth(mk2){ if(state.closedMonths) delete state.closedMonths[mk2]; }

function _recModal(){
  const overlay=document.createElement('div');
  overlay.className='rec-modal-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:var(--overlay,rgba(0,0,0,.5));z-index:20000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  const panel=document.createElement('div');
  panel.className='rec-modal';
  panel.style.cssText='background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:14px;max-width:420px;width:100%;max-height:90vh;overflow:auto;padding:1.1rem 1.2rem;box-shadow:var(--elev-3,0 12px 32px rgba(0,0,0,.4));';
  overlay.appendChild(panel);
  function close(){ overlay.remove(); document.removeEventListener('keydown',esc); }
  function esc(e){ if(e.key==='Escape') close(); }
  overlay.addEventListener('pointerdown',e=>{ if(e.target===overlay) close(); });
  document.addEventListener('keydown',esc);
  document.body.appendChild(overlay);
  return {overlay:overlay, panel:panel, close:close};
}

// Inline "type a custom code" affordance for the recurring modal's currency select,
// mirroring showCellCurrencyOther's validate-via-ensureRate pattern but reverting to an
// explicit caller-supplied value (the modal has no single row/month to read back from).
function _recCurrencyOther(wrap, sel, revertVal){
  sel.style.display='none';
  const form=document.createElement('span'); form.className='curr-other-cell';
  const inp=document.createElement('input'); inp.type='text'; inp.maxLength=5; inp.placeholder='VND';
  inp.style.cssText='font-size:16px;width:80px;';
  const ok=document.createElement('button'); ok.type='button'; ok.textContent='✓'; ok.title='Apply'; ok.setAttribute('aria-label','Apply');
  const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='✕'; cancel.title='Cancel'; cancel.className='x'; cancel.setAttribute('aria-label','Cancel');
  form.appendChild(inp); form.appendChild(ok); form.appendChild(cancel);
  wrap.appendChild(form);
  setTimeout(()=>inp.focus(),20);
  function showErr(msg){
    const old=document.querySelector('.curr-other-err'); if(old) old.remove();
    const e=document.createElement('span'); e.className='curr-other-err'; e.textContent=msg;
    const r=inp.getBoundingClientRect(); e.style.top=(r.bottom+4)+'px'; e.style.left=r.left+'px';
    document.body.appendChild(e);
  }
  function close(){ form.remove(); const old=document.querySelector('.curr-other-err'); if(old) old.remove(); sel.style.display=''; }
  function commit(code){
    if(!Array.prototype.some.call(sel.options, o=>o.value===code)){
      const opt=document.createElement('option'); opt.value=code; opt.textContent=code;
      sel.insertBefore(opt, sel.querySelector('option[value="__other__"]'));
    }
    sel.value=code; close();
  }
  async function apply(){
    const code=inp.value.trim().toUpperCase();
    if(!code){ showErr('Enter a code.'); return; }
    if(!/^[A-Z]{2,5}$/.test(code)){ showErr('2-5 letters only.'); return; }
    if(code==='USD'){ commit(code); return; }
    ok.disabled=true; ok.textContent='…';
    await ensureRate(code);
    if(!ratesCache[code]){ showErr('Unknown: '+code); ok.disabled=false; ok.textContent='✓'; return; }
    commit(code);
  }
  ok.addEventListener('click',e=>{e.stopPropagation();apply();});
  cancel.addEventListener('click',e=>{e.stopPropagation();sel.value=revertVal;close();});
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}if(e.key==='Escape'){sel.value=revertVal;close();}});
}

function openRecurringConfig(rowId){
  const row=getRows().find(r=>r.id===rowId)||(state.rows||[]).find(r=>r.id===rowId);
  if(!row) return;
  const existing=_recRuleFor(rowId);
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : {
    rowId:rowId, amount:_monthTotalForRow(rowId,currentMK())||0, mode:'monthly', weekly:null,
    scope:{type:'future', anchor:currentMK(), start:null, end:null}, overrides:{}, exceptions:[], draft:false };
  if(!draft.scope) draft.scope={type:'future', anchor:currentMK(), start:null, end:null};
  if(!draft.scope.anchor) draft.scope.anchor=currentMK();

  const m=_recModal();
  const h=document.createElement('h3'); h.style.cssText='margin:0 0 .9rem;font-size:1.02rem;color:var(--fg);';
  h.textContent='Recurring: '+(row.label||'Source'); m.panel.appendChild(h);

  const amtLbl=document.createElement('label'); amtLbl.style.cssText='display:block;font-size:.8rem;color:var(--muted);margin-bottom:1rem;';
  amtLbl.appendChild(document.createTextNode('Amount per month'));
  const amt=document.createElement('input'); amt.type='number'; amt.step='0.01'; amt.min='0'; amt.value=draft.amount||0;
  amt.style.cssText='display:block;width:100%;margin-top:.35rem;padding:.55rem;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg,var(--panel-bg));color:var(--fg);font-size:16px;box-sizing:border-box;';
  amtLbl.appendChild(amt); m.panel.appendChild(amtLbl);

  // Per-month overrides pin specific months to a custom amount that otherwise shadows the
  // base amount above with no on-screen sign (this is the desync bug). Surface any pins here
  // with a one-click reset so a rule can never silently apply a value the modal isn't showing.
  if(existing && existing.overrides){
    const _pins=Object.keys(existing.overrides).filter(mk2=>Math.abs((existing.overrides[mk2]||0)-(existing.amount||0))>1e-9).sort();
    if(_pins.length){
      const ov=document.createElement('div'); ov.style.cssText='font-size:.78rem;color:var(--fg);background:var(--hover-bg,rgba(0,0,0,.05));border:1px solid var(--input-border);border-radius:8px;padding:.55rem .6rem;margin-bottom:1rem;line-height:1.5;';
      const t=document.createElement('div');
      t.textContent=_pins.length+(_pins.length>1?' months are':' month is')+' pinned to a custom amount ('+_pins.map(mk2=>_recMkLabel(mk2)+': '+fmt(existing.overrides[mk2])).join(', ')+'), so the amount above does not apply there.';
      ov.appendChild(t);
      const rb=document.createElement('button'); rb.type='button'; rb.textContent='Reset those months to the amount above';
      rb.style.cssText='margin-top:.5rem;padding:.4rem .7rem;border-radius:999px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-size:.78rem;';
      rb.addEventListener('click',()=>{
        const a=parseFloat(amt.value); const live=_recRuleFor(rowId);
        if(live && !isNaN(a) && a>=0) live.amount=a;
        m.close(); _recResetOverrides(rowId);
      });
      ov.appendChild(rb); m.panel.appendChild(ov);
    }
  }

  const curLbl=document.createElement('label'); curLbl.style.cssText='display:block;font-size:.8rem;color:var(--muted);margin-bottom:1rem;';
  curLbl.appendChild(document.createTextNode('Currency'));
  const curWrap=document.createElement('div'); curWrap.style.cssText='margin-top:.35rem;';
  const curSel=document.createElement('select');
  // .cell-curr-sel is the class glass-picker.js already intercepts on desktop (turns the
  // native popup into the app's glass scroll-wheel) - reuse it instead of a bespoke select,
  // exactly like the per-row currency pickers elsewhere in this tracker. The inline width
  // below overrides that class's narrower max-width rule (inline specificity always wins).
  curSel.className='cell-curr-sel';
  curSel.style.cssText='display:block;width:100%;max-width:none;padding:.55rem;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg,var(--panel-bg));color:var(--fg);font-size:16px;box-sizing:border-box;';
  const _recCurCodes=getAllUsedCurrencies();
  const _recCurVal=draft.currency||rowCurrency(currentMK(), rowId);
  if(!_recCurCodes.includes(_recCurVal)) _recCurCodes.push(_recCurVal);
  _recCurCodes.sort().forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; if(c===_recCurVal) o.selected=true; curSel.appendChild(o); });
  const curOtherOpt=document.createElement('option'); curOtherOpt.value='__other__'; curOtherOpt.textContent='Other…'; curSel.appendChild(curOtherOpt);
  curWrap.appendChild(curSel);
  curSel.addEventListener('change',()=>{
    if(curSel.value==='__other__') _recCurrencyOther(curWrap, curSel, _recCurVal);
  });
  curLbl.appendChild(curWrap); m.panel.appendChild(curLbl);

  const scLbl=document.createElement('div'); scLbl.style.cssText='font-size:.8rem;color:var(--muted);margin-bottom:.35rem;'; scLbl.textContent='Applies to'; m.panel.appendChild(scLbl);
  if(row.parentId){
    const scNote=document.createElement('div'); scNote.style.cssText='font-size:.76rem;color:var(--muted);margin-bottom:.5rem;line-height:1.4;';
    scNote.textContent='Only applies to months that already have this sub-source - it won\'t create it elsewhere.';
    m.panel.appendChild(scNote);
  }
  const scWrap=document.createElement('div'); scWrap.style.cssText='display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.6rem;';
  const rangeWrap=document.createElement('div'); rangeWrap.style.cssText='display:none;gap:.4rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap;';
  const rStart=document.createElement('input'); rStart.type='month'; rStart.value=draft.scope.start||currentMK();
  const rEnd=document.createElement('input'); rEnd.type='month'; rEnd.value=draft.scope.end||currentMK();
  // Bound the range picker to the same +-1 year window the app already enforces for
  // month navigation (minY/minM..maxY/maxM, see isAtMin/isAtMax above) - not an invented
  // horizon.
  const _recRangeMin=mk(minY,minM), _recRangeMax=mk(maxY,maxM);
  [rStart,rEnd].forEach(x=>{ x.min=_recRangeMin; x.max=_recRangeMax; x.style.cssText='padding:.4rem;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg,var(--panel-bg));color:var(--fg);font-size:16px;'; });
  const rArrow=document.createElement('span'); rArrow.textContent='to'; rArrow.style.cssText='color:var(--muted);font-size:.85rem;';
  rangeWrap.appendChild(rStart); rangeWrap.appendChild(rArrow); rangeWrap.appendChild(rEnd);
  function renderScopeBtns(){
    scWrap.innerHTML='';
    const opts=[['future','All future months'],['past','All past months'],['all','All months'],['range','Custom range']];
    opts.forEach(o=>{
      const active=draft.scope.type===o[0];
      const b=document.createElement('button'); b.type='button'; b.textContent=o[1];
      b.style.cssText='padding:.4rem .7rem;border-radius:999px;border:1px solid var(--input-border);cursor:pointer;font-size:.8rem;background:'+(active?'var(--accent)':'transparent')+';color:'+(active?'#fff':'var(--fg)')+';';
      b.addEventListener('click',()=>{
        draft.scope.type=o[0];
        if(o[0]==='future'||o[0]==='past'){ draft.scope.anchor=currentMK(); draft.scope.start=null; draft.scope.end=null; }
        else if(o[0]==='all'){ draft.scope.start=null; draft.scope.end=null; }
        rangeWrap.style.display=o[0]==='range'?'flex':'none';
        renderScopeBtns();
      });
      scWrap.appendChild(b);
    });
  }
  renderScopeBtns(); m.panel.appendChild(scWrap);
  rangeWrap.style.display=draft.scope.type==='range'?'flex':'none';
  m.panel.appendChild(rangeWrap);

  const fb=document.createElement('div'); fb.style.cssText='font-size:.8rem;color:var(--sem-bad,#b91c1c);min-height:1em;margin-bottom:.6rem;'; m.panel.appendChild(fb);

  const actions=document.createElement('div'); actions.style.cssText='display:flex;gap:.5rem;';
  const saveBtn=document.createElement('button'); saveBtn.type='button'; saveBtn.className='btn'; saveBtn.textContent=existing?'Update recurring':'Make recurring';
  saveBtn.style.cssText='flex:2;padding:.6rem;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:.9rem;';
  const cancelBtn=document.createElement('button'); cancelBtn.type='button'; cancelBtn.textContent='Cancel';
  cancelBtn.style.cssText='flex:1;padding:.6rem;border-radius:8px;border:1px solid var(--input-border);background:transparent;color:var(--fg);cursor:pointer;font-size:.9rem;';
  cancelBtn.addEventListener('click',m.close);
  saveBtn.addEventListener('click',()=>{
    const a=parseFloat(amt.value); if(isNaN(a)||a<0){ fb.textContent='Enter a valid amount.'; return; }
    if(curSel.value==='__other__'){ fb.textContent='Finish entering the custom currency code first.'; return; }
    draft.amount=a; draft.mode='monthly'; draft.weekly=null; draft.currency=curSel.value;
    if(draft.scope.type==='range'){
      draft.scope.start=rStart.value||null; draft.scope.end=rEnd.value||null;
      if(draft.scope.start&&draft.scope.end&&draft.scope.start>draft.scope.end){ fb.textContent='Range start is after end.'; return; }
      if((draft.scope.start&&(draft.scope.start<_recRangeMin||draft.scope.start>_recRangeMax))||
         (draft.scope.end&&(draft.scope.end<_recRangeMin||draft.scope.end>_recRangeMax))){
        fb.textContent='Pick a range within '+_recRangeMin.slice(0,4)+'-'+_recRangeMax.slice(0,4)+'.'; return;
      }
    }
    m.close();
    commitRecurring(draft);
  });
  actions.appendChild(saveBtn); actions.appendChild(cancelBtn); m.panel.appendChild(actions);

  // Delink/Remove live here (not just the mobile gear menu) so they're reachable regardless
  // of viewport - the gear button is mobile-only (styles.css .row-gear-btn), but this modal
  // opens from both the mobile gear and the desktop 🔁 button.
  if(existing){
    const _isExcepted=(existing.exceptions||[]).indexOf(currentMK())>=0;
    const sec=document.createElement('div'); sec.style.cssText='display:flex;gap:.9rem;justify-content:center;margin-top:.9rem;padding-top:.8rem;border-top:1px solid var(--input-border);';
    const linkBtn=document.createElement('button'); linkBtn.type='button';
    linkBtn.textContent=_isExcepted?'🔗 Relink this month':'⛓ Delink this month';
    linkBtn.style.cssText='background:none;border:none;color:var(--muted);cursor:pointer;font-size:.78rem;padding:.2rem;';
    linkBtn.addEventListener('click',()=>{ m.close(); _isExcepted?relinkMonth(rowId, currentMK()):delinkMonth(rowId, currentMK()); });
    const removeBtn=document.createElement('button'); removeBtn.type='button'; removeBtn.textContent='✖ Remove recurring';
    removeBtn.style.cssText='background:none;border:none;color:var(--sem-bad,#b91c1c);cursor:pointer;font-size:.78rem;padding:.2rem;';
    removeBtn.addEventListener('click',()=>{ m.close(); removeRecurring(rowId); });
    sec.appendChild(linkBtn); sec.appendChild(removeBtn); m.panel.appendChild(sec);
  }
  amt.focus();
}

// Apply a rule to all its fillable months, mark the row, and commit. If clashes exist the
// rule is stored as a draft and the draft banner drives resolution. Writes can span every
// month in scope (e.g. "All future months"), so this snapshots the rule + every cell it's
// about to touch first and hands a single Undo back through the toast - one click reverts
// the whole multi-month write, instead of fixing each month by hand.
function commitRecurring(draft){
  const opts=_recOptsFor(draft.rowId);
  const clashes=FiRecurring.detectClashes(draft, opts);
  const rules=_recRules();
  const idx=rules.findIndex(r=>r.rowId===draft.rowId);
  const prevRule=idx>=0?JSON.parse(JSON.stringify(rules[idx])):null;
  function undoCommit(){
    const rr=_recRules(); const i2=rr.findIndex(r=>r.rowId===draft.rowId);
    if(prevRule){ if(i2>=0) rr[i2]=prevRule; else rr.push(prevRule); }
    else if(i2>=0){ rr.splice(i2,1); }
    markRowRecurring(draft.rowId, !!prevRule);
  }
  if(clashes.length){
    draft.draft=true;
    if(idx>=0) rules[idx]=draft; else rules.push(draft);
    markRowRecurring(draft.rowId, true);
    save(); render(); _recDraftBannerRefresh();
    showToast('🔁 Recurring needs review', false, 5000, ()=>{ undoCommit(); save(); render(); _recDraftBannerRefresh(); });
    return;
  }
  const fillMonths=FiRecurring.fillableMonths(draft, opts);
  const prevCellsByMonth={};
  fillMonths.forEach(mk2=>{
    const cols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
    const snap={};
    cols.forEach(c=>{ const key=mk2+'|'+draft.rowId+'|'+c.id; snap[key]=Object.prototype.hasOwnProperty.call(state.cells||{},key)?state.cells[key]:undefined; });
    prevCellsByMonth[mk2]=snap;
  });
  draft.draft=false;
  fillMonths.forEach(mk2=>_recWriteMonth(draft, mk2));
  if(idx>=0) rules[idx]=draft; else rules.push(draft);
  markRowRecurring(draft.rowId, true);
  save(); render(); _recDraftBannerRefresh();
  showToast('🔁 Recurring saved - '+fillMonths.length+' month'+(fillMonths.length===1?'':'s')+' updated', false, 5000, ()=>{
    undoCommit();
    Object.keys(prevCellsByMonth).forEach(mk2=>{
      const snap=prevCellsByMonth[mk2];
      if(!state.cells) state.cells={};
      Object.keys(snap).forEach(key=>{ if(snap[key]===undefined) delete state.cells[key]; else state.cells[key]=snap[key]; });
    });
    save(); render(); _recDraftBannerRefresh();
    showToast('↩ Recurring change undone.', false, 1800);
  });
}

function _writeMonthlyValue(rowId, mk2, val){
  _ensureMonthForked(mk2);
  const cols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
  if(!state.cells) state.cells={};
  cols.forEach((c,i)=>{
    const key=mk2+'|'+rowId+'|'+c.id;
    state.cells[key]=(i===0?String(val):'0');
    if(state.cellTimes) state.cellTimes[key]=Date.now();
  });
}

function _onRecurringCellEdit(rowId, mk2, newTotal){
  const rule=_recRuleFor(rowId);
  if(!rule){ _writeMonthlyValue(rowId, mk2, newTotal); save(); render(); return; }
  const curVal=FiRecurring.ruleValueForMonth(rule, mk2);
  if(Math.abs(curVal-newTotal)<1e-9){ _writeMonthlyValue(rowId, mk2, newTotal); save(); render(); return; }

  const m=_recModal();
  const h=document.createElement('h3'); h.style.cssText='margin:0 0 .5rem;font-size:1rem;color:var(--fg);';
  h.textContent='Apply this change to:'; m.panel.appendChild(h);
  const sub=document.createElement('p'); sub.style.cssText='margin:0 0 1rem;font-size:.82rem;color:var(--muted);';
  sub.textContent='This is a recurring source. Choose which months take the new amount.';
  m.panel.appendChild(sub);
  function opt(label, fn){
    const b=document.createElement('button'); b.type='button'; b.textContent=label;
    b.style.cssText='display:block;width:100%;margin-bottom:.5rem;padding:.6rem;border-radius:8px;border:1px solid var(--input-border);background:transparent;color:var(--fg);cursor:pointer;font-size:.9rem;text-align:left;';
    b.addEventListener('click',fn); m.panel.appendChild(b); return b;
  }
  opt('All months', ()=>{ m.close(); rule.amount=newTotal; rule.mode='monthly'; rule.weekly=null; rule.overrides={}; commitRecurring(rule); });
  opt('Specific months...', ()=>{ m.close(); _pickSpecificMonths(rule, newTotal); });
  opt('This month only', ()=>{ m.close(); if(!rule.overrides) rule.overrides={}; rule.overrides[mk2]=newTotal; _writeMonthlyValue(rowId, mk2, newTotal); save(); render(); _recDraftBannerRefresh(); });
  const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel';
  cancel.style.cssText='display:block;width:100%;margin-top:.3rem;padding:.55rem;border-radius:8px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:.85rem;';
  cancel.addEventListener('click',()=>{ m.close(); render(); });
  m.panel.appendChild(cancel);
}

function _pickSpecificMonths(rule, newTotal){
  const months=_existingMonths().filter(mk2=>FiRecurring.monthInScope(rule, mk2) && _rowExistsInMonth(rule.rowId, mk2)).sort();
  const m=_recModal();
  const h=document.createElement('h3'); h.style.cssText='margin:0 0 .8rem;font-size:1rem;color:var(--fg);'; h.textContent='Which months?'; m.panel.appendChild(h);
  const boxes={};
  months.forEach(mk2=>{
    const lbl=document.createElement('label'); lbl.style.cssText='display:flex;align-items:center;gap:.5rem;padding:.35rem 0;font-size:.9rem;color:var(--fg);';
    const cb=document.createElement('input'); cb.type='checkbox'; if(_isClosedMonth(mk2)){ cb.disabled=true; }
    boxes[mk2]=cb; lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(_recMkLabel(mk2)+(_isClosedMonth(mk2)?' (locked)':'')));
    m.panel.appendChild(lbl);
  });
  const actions=document.createElement('div'); actions.style.cssText='display:flex;gap:.5rem;margin-top:1rem;';
  const ok=document.createElement('button'); ok.type='button'; ok.textContent='Apply'; ok.style.cssText='flex:2;padding:.6rem;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;';
  const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel'; cancel.style.cssText='flex:1;padding:.6rem;border-radius:8px;border:1px solid var(--input-border);background:transparent;color:var(--fg);cursor:pointer;';
  cancel.addEventListener('click',()=>{ m.close(); render(); });
  ok.addEventListener('click',()=>{
    if(!rule.overrides) rule.overrides={};
    months.forEach(mk2=>{ if(boxes[mk2]&&boxes[mk2].checked){ rule.overrides[mk2]=newTotal; _writeMonthlyValue(rule.rowId, mk2, newTotal); } });
    m.close(); save(); render(); _recDraftBannerRefresh();
  });
  actions.appendChild(ok); actions.appendChild(cancel); m.panel.appendChild(actions);
}

function delinkMonth(rowId, mk2){
  const rule=_recRuleFor(rowId); if(!rule) return;
  if(!rule.exceptions) rule.exceptions=[];
  if(rule.exceptions.indexOf(mk2)<0) rule.exceptions.push(mk2);
  if(rule.overrides) delete rule.overrides[mk2];
  save(); render(); _recDraftBannerRefresh();
  showToast('Delinked '+_recMkLabel(mk2)+' from recurring', false, 5000, ()=>relinkMonth(rowId, mk2, true));
}

// Undo a delink, or manually re-include a month a rule's range/anchor still covers but that
// was previously excepted out. Re-applies the rule's value the same way commitRecurring does
// (skip if locked/mismatched -> draft for review, exactly like any other clash).
function relinkMonth(rowId, mk2, silent){
  const rule=_recRuleFor(rowId); if(!rule) return;
  if(rule.exceptions){ const i=rule.exceptions.indexOf(mk2); if(i>=0) rule.exceptions.splice(i,1); }
  if(!FiRecurring.monthInScope(rule, mk2)){
    save(); render(); _recDraftBannerRefresh();
    if(!silent) showToast(_recMkLabel(mk2)+' is outside this rule\'s scope, so relinking it alone had no effect.');
    return;
  }
  const opts=_recOptsFor(rowId);
  const clash=FiRecurring.detectClashes(rule, {existingMonths:[mk2], getMonthTotal:opts.getMonthTotal, isLocked:opts.isLocked});
  if(clash.length){
    rule.draft=true; markRowRecurring(rowId, true);
    save(); render(); _recDraftBannerRefresh();
    if(!silent) showToast('Relinked '+_recMkLabel(mk2)+' - needs review before it applies.');
    return;
  }
  _recWriteMonth(rule, mk2);
  save(); render(); _recDraftBannerRefresh();
  if(!silent) showToast('Relinked '+_recMkLabel(mk2)+' to recurring');
}

function removeRecurring(rowId){
  const rules=_recRules(); const idx=rules.findIndex(r=>r.rowId===rowId);
  if(idx>=0) rules.splice(idx,1);
  markRowRecurring(rowId, false);
  save(); render(); _recDraftBannerRefresh();
}

function _resolveClash(rowId, mk2, choice){
  const rule=_recRuleFor(rowId); if(!rule) return;
  if(choice==='apply'){
    if(_isClosedMonth(mk2)) _recUnlockMonth(mk2);
    _recWriteMonth(rule, mk2);
  } else {
    if(!rule.exceptions) rule.exceptions=[];
    if(rule.exceptions.indexOf(mk2)<0) rule.exceptions.push(mk2);
  }
  const opts=_recOptsFor(rowId);
  const remaining=FiRecurring.detectClashes(rule, opts);
  if(!remaining.length){
    rule.draft=false;
    FiRecurring.fillableMonths(rule, opts).forEach(m2=>_recWriteMonth(rule, m2));
  }
  save(); render(); _recDraftBannerRefresh();
}

// Clear every per-month override and rewrite the rule's in-scope, unlocked months from the
// base amount, so the amount shown in the config modal governs all of them again. Backs the
// modal's "reset those months" control.
function _recResetOverrides(rowId){
  const rule=_recRuleFor(rowId); if(!rule) return;
  rule.overrides={}; rule.draft=false;
  _existingMonths().filter(mk2=>FiRecurring.monthInScope(rule,mk2)&&_rowExistsInMonth(rowId,mk2)&&!_isClosedMonth(mk2))
    .forEach(mk2=>_recWriteMonth(rule,mk2));
  save(); render(); _recDraftBannerRefresh();
  showToast('Reset to '+fmt(rule.amount)+'/mo');
}

let _recDraftBannerEl=null;
function _recDraftBannerRefresh(){
  const drafts=_recRules().filter(r=>r.draft);
  let items=[];
  drafts.forEach(rule=>{
    const row=(state.rows||[]).find(r=>r.id===rule.rowId)||{};
    FiRecurring.detectClashes(rule, _recOptsFor(rule.rowId)).forEach(c=>{
      items.push({rowId:rule.rowId, label:row.label||'Source', mk:c.mk, reason:c.reason, want:c.want, have:c.have});
    });
  });
  if(_recDraftBannerEl){ _recDraftBannerEl.remove(); _recDraftBannerEl=null; }
  if(!items.length) return;
  const b=document.createElement('div'); b.className='rec-draft-banner';
  const head=document.createElement('div'); head.className='rec-draft-head';
  head.textContent='Recurring needs review - '+items.length+' month'+(items.length>1?'s':'')+' conflict before it can be applied.';
  b.appendChild(head);
  items.forEach(it=>{
    const row=document.createElement('div'); row.className='rec-draft-item';
    const txt=document.createElement('button'); txt.type='button'; txt.className='rec-draft-jump';
    txt.textContent=it.label+' - '+_recMkLabel(it.mk)+' ('+(it.reason==='locked'?'locked':'different value')+')';
    txt.addEventListener('click',()=>{ jumpToMonth(it.mk); });
    const ap=document.createElement('button'); ap.type='button'; ap.className='rec-draft-apply'; ap.textContent='Apply here';
    ap.addEventListener('click',()=>_confirmApplyClash(it));
    const sk=document.createElement('button'); sk.type='button'; sk.className='rec-draft-skip'; sk.textContent='Skip';
    sk.addEventListener('click',()=>_resolveClash(it.rowId, it.mk, 'skip'));
    row.appendChild(txt); row.appendChild(ap); row.appendChild(sk); b.appendChild(row);
  });
  document.body.appendChild(b); _recDraftBannerEl=b;
}
// Preview exactly what "Apply here" will overwrite before it does, so applying a conflict is
// never blind - the value written is the rule's, which may be a per-month override, not the
// base amount shown in the config modal.
function _confirmApplyClash(it){
  const m=_recModal();
  const h=document.createElement('h3'); h.style.cssText='margin:0 0 .6rem;font-size:1rem;color:var(--fg);';
  h.textContent='Apply recurring to '+_recMkLabel(it.mk)+'?'; m.panel.appendChild(h);
  const p=document.createElement('p'); p.style.cssText='margin:0 0 1rem;font-size:.85rem;color:var(--muted);line-height:1.5;';
  p.textContent = it.reason==='locked'
    ? it.label+' in '+_recMkLabel(it.mk)+' is a locked month. Applying unlocks it and sets it to '+fmt(it.want)+'.'
    : it.label+' in '+_recMkLabel(it.mk)+' currently holds '+fmt(it.have)+'. Applying replaces it with '+fmt(it.want)+'.';
  m.panel.appendChild(p);
  const actions=document.createElement('div'); actions.style.cssText='display:flex;gap:.5rem;';
  const ok=document.createElement('button'); ok.type='button'; ok.textContent='Replace with '+fmt(it.want);
  ok.style.cssText='flex:2;padding:.6rem;border-radius:8px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:.9rem;';
  ok.addEventListener('click',()=>{ m.close(); _resolveClash(it.rowId, it.mk, 'apply'); });
  const cancel=document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel';
  cancel.style.cssText='flex:1;padding:.6rem;border-radius:8px;border:1px solid var(--input-border);background:transparent;color:var(--fg);cursor:pointer;font-size:.9rem;';
  cancel.addEventListener('click',m.close);
  actions.appendChild(ok); actions.appendChild(cancel); m.panel.appendChild(actions);
}
function copyStructureFromPrevMonth(){
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  const mk2=currentMK();
  const [y,mo]=mk2.split('-').map(Number);
  const prev=new Date(y,mo-2);
  const prevMk=prev.getFullYear()+'-'+String(prev.getMonth()+1).padStart(2,'0');
  const prevRows=getRows(prevMk), prevCols=getCols(prevMk);
  if(!prevRows.length){showToast('No rows in previous month.');return;}
  const alreadyForked=state.rowsByMonth&&state.rowsByMonth[mk2];
  if(alreadyForked&&!confirm('This month already has its own structure. Overwrite with previous month\'s rows/columns?')) return;
  if(!state.rowsByMonth) state.rowsByMonth={};
  if(!state.colsByMonth) state.colsByMonth={};
  state.rowsByMonth[mk2]=prevRows.map(r=>({...r}));
  state.colsByMonth[mk2]=prevCols.map(c=>({...c}));
  save(); render();
  showToast('Copied structure from previous month');
}
function copyStructureFromMonth(sourceMk){
  const mk2=currentMK();
  if(_isClosedMonth(mk2)){showToast('🔒 Month is locked.');return;}
  if(sourceMk===mk2){showToast('Already on that month.');return;}
  const srcRows=getRows(sourceMk),srcCols=getCols(sourceMk);
  if(!srcRows.length){showToast('No rows in that month.');return;}
  const alreadyForked=state.rowsByMonth&&state.rowsByMonth[mk2];
  if(alreadyForked&&!confirm('This month already has its own structure. Overwrite with '+sourceMk+'\'s rows/columns?')) return;
  if(!state.rowsByMonth) state.rowsByMonth={};
  if(!state.colsByMonth) state.colsByMonth={};
  state.rowsByMonth[mk2]=srcRows.map(r=>({...r}));
  state.colsByMonth[mk2]=srcCols.map(c=>({...c}));
  save(); render();
  showToast('Copied structure from '+sourceMk);
}
function copyMonthToTargets(sourceMk, targetMks, overwrite){
  snapshot();
  const srcRows=getRows(sourceMk);
  const srcCols=getCols(sourceMk);
  targetMks.forEach(tMk=>{
    if(!state.rowsByMonth) state.rowsByMonth={};
    if(!state.colsByMonth) state.colsByMonth={};
    state.rowsByMonth[tMk]=srcRows.map(r=>({...r}));
    state.colsByMonth[tMk]=srcCols.map(c=>({...c}));
    Object.keys(state.cells).forEach(k=>{
      if(!k.startsWith(sourceMk+'|')) return;
      const newKey=tMk+k.slice(sourceMk.length);
      if(overwrite||!state.cells[newKey]) state.cells[newKey]=state.cells[k];
    });
    if(state.monthRowCurrencies){
      Object.keys(state.monthRowCurrencies).forEach(k=>{
        if(!k.startsWith(sourceMk+'|')) return;
        const newKey=tMk+k.slice(sourceMk.length);
        if(overwrite||!state.monthRowCurrencies[newKey])
          state.monthRowCurrencies[newKey]=state.monthRowCurrencies[k];
      });
    }
  });
  save(); render();
  showToast('Copied to '+targetMks.length+' month'+(targetMks.length>1?'s':'')+'.');
}

function openCopyToDropdown(e){
  const sourceMk=currentMK();
  const months=new Set();

  // Valid range: intersection of (source ±12) and (today ±12)
  // i.e. only months that are both near the source AND accessible via normal navigation
  const [_sy,_sm]=sourceMk.split('-');
  const srcDate=new Date(+_sy,+_sm-1,1);
  const today=new Date(); const todayDate=new Date(today.getFullYear(),today.getMonth(),1);
  const startDate=new Date(Math.max(
    new Date(srcDate).setMonth(srcDate.getMonth()-12),
    new Date(todayDate).setMonth(todayDate.getMonth()-12)
  ));
  const endDate=new Date(Math.min(
    new Date(srcDate).setMonth(srcDate.getMonth()+12),
    new Date(todayDate).setMonth(todayDate.getMonth()+12)
  ));
  const sweep=new Date(startDate);
  while(sweep<=endDate){
    const m=sweep.getFullYear()+'-'+String(sweep.getMonth()+1).padStart(2,'0');
    if(m!==sourceMk) months.add(m);
    sweep.setMonth(sweep.getMonth()+1);
  }

  const opts=[...months].sort();
  const menu=document.getElementById('dd-copy-to-menu');
  menu.innerHTML='';
  if(!opts.length){
    const em=document.createElement('div');em.style.cssText='padding:.5rem .75rem;font-size:.83rem;color:var(--muted);white-space:nowrap;';
    em.textContent='No other months available.';menu.appendChild(em);
    toggleDropdown('dd-copy-to',e);return;
  }
  const [sy,sm]=sourceMk.split('-');
  const hd=document.createElement('div');hd.className='copy-to-hd';
  hd.textContent='Copy '+new Date(+sy,+sm-1,1).toLocaleString('default',{month:'long',year:'numeric'})+' to:';
  menu.appendChild(hd);
  const pillsDiv=document.createElement('div');pillsDiv.className='copy-to-pills';
  opts.forEach(m=>{
    const [y,mo]=m.split('-');
    const pill=document.createElement('span');
    pill.className='copy-to-pill';
    pill.dataset.mk=m;
    pill.textContent=new Date(+y,+mo-1,1).toLocaleString('default',{month:'short',year:'numeric'});
    pill.addEventListener('click',ev=>{ev.stopPropagation();pill.classList.toggle('selected');});
    pillsDiv.appendChild(pill);
  });
  menu.appendChild(pillsDiv);
  const hr=document.createElement('hr');hr.className='copy-to-divider';menu.appendChild(hr);
  const copyBtn=document.createElement('button');copyBtn.className='copy-to-copy-btn';copyBtn.textContent='Copy';
  copyBtn.addEventListener('click',ev=>{
    ev.stopPropagation();
    const selected=[...menu.querySelectorAll('.copy-to-pill.selected')].map(p=>p.dataset.mk);
    if(!selected.length){showToast('Select at least one month.');return;}
    menu.classList.remove('open');
    copyMonthToTargets(sourceMk,selected,true);
  });
  menu.appendChild(copyBtn);
  toggleDropdown('dd-copy-to',e);
}

function showMonthCopyPicker(){
  const months=new Set();
  Object.keys(state.rowsByMonth||{}).forEach(m=>months.add(m));
  Object.keys(state.cells||{}).forEach(k=>{const m=k.split('|')[0];if(m&&m.match(/^\d{4}-\d{2}$/))months.add(m);});
  const cur=currentMK();
  const opts=[...months].filter(m=>m!==cur).sort();
  if(!opts.length){showToast('No other months with data found.');return;}
  const overlay=document.createElement('div');overlay.className='share-overlay';
  const modal=document.createElement('div');modal.className='share-modal';modal.style.maxWidth='340px';
  const h=document.createElement('h3');h.textContent='Copy structure from month';
  const sel=document.createElement('select');sel.style.cssText='width:100%;padding:.5rem;border:1px solid var(--input-border);border-radius:6px;background:var(--input-bg);color:var(--fg);font-size:.9rem;margin:.5rem 0;';
  opts.forEach(m=>{const o=document.createElement('option');o.value=m;const [y,mo]=m.split('-');o.textContent=new Date(+y,+mo-1,1).toLocaleString('default',{month:'long',year:'numeric'});sel.appendChild(o);});
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem;';
  const confirmBtn=document.createElement('button');confirmBtn.className='btn btn-sm';confirmBtn.textContent='Copy';
  confirmBtn.addEventListener('click',()=>{copyStructureFromMonth(sel.value);overlay.remove();});
  const cancelBtn=document.createElement('button');cancelBtn.className='btn btn-sm btn-ghost';cancelBtn.textContent='Cancel';
  cancelBtn.addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  actions.appendChild(cancelBtn);actions.appendChild(confirmBtn);
  modal.appendChild(h);modal.appendChild(sel);modal.appendChild(actions);
  overlay.appendChild(modal);document.body.appendChild(overlay);
}


var _sync=createSyncManager(STORAGE_KEY,'/api/save/income','/api/load/income',{
  getState:function(){return state;},
  onReload:function(){state=loadState();render();},
  onMerge:showToast,
  showQuotaWarning:showSaveQuotaWarning
});
var syncToServer=_sync.syncToServer;
var loadFromServer=_sync.loadFromServer;
var setSyncStatus=_sync.setSyncStatus;
var saveLocal=_sync.saveLocal;
// Stamps state.cellTimes[key]=now for any cell whose value changed since the last
// save, by diffing against the snapshot still sitting in localStorage (saveLocal()
// is about to overwrite it). One diff on every save() uniformly catches every way
// `cells` can change — typing, paste, bulk delete, import, undo/redo — without
// scattering Date.now() stamps across mutation sites. A key that just vanished
// (delete) gets stamped too: that's what marks it as a tombstone for the merge.
function _stampCellTimes(){
  if(!state.cellTimes) state.cellTimes={};
  let prevCells={};
  try{
    const prev=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(prev&&prev.cells) prevCells=prev.cells;
  }catch(_){}
  const now=Date.now();
  const keys=new Set([...Object.keys(prevCells),...Object.keys(state.cells)]);
  keys.forEach(k=>{ if(prevCells[k]!==state.cells[k]) state.cellTimes[k]=now; });
}
function save(){
  _stampCellTimes();
  saveLocal();
  // Mark that income was saved this walkthrough session so loadState() can restore it on Back.
  if(isWalkthroughActive())localStorage.setItem('fiapp_income_wt_session','1');
  try{ localStorage.setItem(PUSH_KEY, JSON.stringify({mk:currentMK(),total:grandTotal(),ts:Date.now()})); }catch{}
  syncToServer();
  document.dispatchEvent(new CustomEvent('fiapp-income-saved'));
  try{ _maybeCelebrateFirstEntry(currentMK()); }catch(_){}
}
function showSaveQuotaWarning(){
  if(document.getElementById('quota-warn')) return;
  const el=document.createElement('div'); el.id='quota-warn'; el.className='error';
  el.setAttribute('aria-live','polite');
  el.setAttribute('aria-atomic','true');
  el.style.cssText='position:fixed;bottom:calc(1rem + env(safe-area-inset-bottom, 0px));left:50%;transform:translateX(-50%);z-index:99999;max-width:420px;text-align:center;padding:.6rem 1rem;';
  el.textContent='⚠ Storage full - latest changes could not be saved. Export your data and clear some rows.';
  document.body.appendChild(el); setTimeout(()=>el.remove(),8000);
}
function showToast(msg, isError=false, duration=4000, undoCb=null){
  const el=document.createElement('div');
  el.setAttribute('data-wt-toast','1');
  el.setAttribute('aria-live','polite');
  el.setAttribute('aria-atomic','true');
  el.className=isError?'error':'success';
  el.style.cssText='position:fixed;bottom:calc(1rem + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);z-index:99999;max-width:480px;padding:.6rem 1rem;display:flex;align-items:center;gap:.75rem;white-space:pre-wrap;';
  const txt=document.createElement('span'); txt.textContent=msg; el.appendChild(txt);
  if(undoCb){
    const btn=document.createElement('button');
    btn.textContent='Undo';
    btn.style.cssText='background:none;border:1px solid currentColor;border-radius:4px;padding:.15rem .5rem;cursor:pointer;font-size:.85rem;color:inherit;white-space:nowrap;';
    btn.addEventListener('click',()=>{ undoCb(); el.remove(); });
    el.appendChild(btn);
  }
  document.body.appendChild(el); setTimeout(()=>el.remove(),duration);
}


let undoByMonth={}, redoByMonth={};
function loadHistory(){
  try{
    const u=sessionStorage.getItem(UNDO_KEY); if(u){const p=JSON.parse(u); if(p&&!Array.isArray(p)) undoByMonth=p;}
    const r=sessionStorage.getItem(REDO_KEY); if(r){const p=JSON.parse(r); if(p&&!Array.isArray(p)) redoByMonth=p;}
  }catch{}
}
function saveHistory(){
  try{
    sessionStorage.setItem(UNDO_KEY,JSON.stringify(undoByMonth));
    sessionStorage.setItem(REDO_KEY,JSON.stringify(redoByMonth));
  }catch{}
}
function _captureSlice(mk2){
  const mkPrefix=mk2+'|';
  const cellsSlice={};
  Object.keys(state.cells||{}).forEach(k=>{if(k.startsWith(mkPrefix)) cellsSlice[k]=state.cells[k];});
  return {
    cells:cellsSlice,
    rows:state.rowsByMonth?.[mk2]?JSON.parse(JSON.stringify(state.rowsByMonth[mk2])):null,
    cols:state.colsByMonth?.[mk2]?JSON.parse(JSON.stringify(state.colsByMonth[mk2])):null
  };
}
function _applySlice(mk2,entry){
  const mkPrefix=mk2+'|';
  if(!state.cells) state.cells={};
  Object.keys(state.cells).forEach(k=>{if(k.startsWith(mkPrefix)) delete state.cells[k];});
  Object.assign(state.cells,entry.cells);
  if(entry.rows!==null){if(!state.rowsByMonth) state.rowsByMonth={}; state.rowsByMonth[mk2]=entry.rows;}
  else if(state.rowsByMonth) delete state.rowsByMonth[mk2];
  if(entry.cols!==null){if(!state.colsByMonth) state.colsByMonth={}; state.colsByMonth[mk2]=entry.cols;}
  else if(state.colsByMonth) delete state.colsByMonth[mk2];
}
function _flashChangedRows(beforeCells,afterCells){
  const changed=new Set();
  const allKeys=new Set([...Object.keys(beforeCells||{}),...Object.keys(afterCells||{})]);
  allKeys.forEach(k=>{if((beforeCells||{})[k]!==(afterCells||{})[k]){const parts=k.split('|');if(parts.length>=3) changed.add(parts[1]);}});
  if(!changed.size) return;
  changed.forEach(rowId=>{
    const el=document.querySelector('tr[data-row-id="'+rowId+'"],div.mc-card[data-row-id="'+rowId+'"]');
    if(!el) return;
    el.style.transition='background-color 0s';
    el.style.backgroundColor='rgba(99,102,241,0.2)';
    requestAnimationFrame(()=>{el.style.transition='background-color 1.2s ease-out';el.style.backgroundColor='';});
  });
}
function snapshot(){
  const mk2=currentMK();
  if(!undoByMonth[mk2]) undoByMonth[mk2]=[];
  undoByMonth[mk2].push(_captureSlice(mk2));
  if(undoByMonth[mk2].length>60) undoByMonth[mk2].shift();
  if(!redoByMonth[mk2]) redoByMonth[mk2]=[];
  redoByMonth[mk2]=[];
  saveHistory(); updateHistBtns();
}
function undo(){
  const mk2=currentMK();
  if(_isClosedMonth(mk2)){showToast('🔒 Month is locked.');return;}
  const stack=undoByMonth[mk2];
  if(!stack||!stack.length) return;
  const beforeCells=Object.assign({},state.cells);
  if(!redoByMonth[mk2]) redoByMonth[mk2]=[];
  redoByMonth[mk2].push(_captureSlice(mk2));
  _applySlice(mk2,stack.pop());
  save(); saveHistory(); render(); updateHistBtns();
  _flashChangedRows(beforeCells,state.cells);
  showToast('↩ Undone.', false, 1800);
}
function redo(){
  const mk2=currentMK();
  if(_isClosedMonth(mk2)){showToast('🔒 Month is locked.');return;}
  const stack=redoByMonth[mk2];
  if(!stack||!stack.length) return;
  const beforeCells=Object.assign({},state.cells);
  if(!undoByMonth[mk2]) undoByMonth[mk2]=[];
  undoByMonth[mk2].push(_captureSlice(mk2));
  _applySlice(mk2,stack.pop());
  save(); saveHistory(); render(); updateHistBtns();
  _flashChangedRows(beforeCells,state.cells);
  showToast('↪ Redone.', false, 1800);
}
function updateHistBtns(){ const mk2=currentMK(); const u=document.getElementById('undo-btn'),r=document.getElementById('redo-btn'); if(u)u.disabled=!(undoByMonth[mk2]&&undoByMonth[mk2].length); if(r)r.disabled=!(redoByMonth[mk2]&&redoByMonth[mk2].length); }
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key==='z'){e.preventDefault();undo();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='z'))){e.preventDefault();redo();}
});


const today=new Date();
function mk(y,m){ return String(y)+'-'+String(m+1).padStart(2,'0'); }
function currentMK(){ return mk(state.currentYear,state.currentMonth); }
const minY=today.getFullYear()-1, minM=today.getMonth();
const maxY=today.getFullYear()+1, maxM=today.getMonth();
function isAtMin(){ return state.currentYear<minY||(state.currentYear===minY&&state.currentMonth<=minM); }
function isAtMax(){ return state.currentYear>maxY||(state.currentYear===maxY&&state.currentMonth>=maxM); }
function shiftMonth(d){
  let y=state.currentYear, m=state.currentMonth+d;
  if(m<0){y--;m=11;} if(m>11){y++;m=0;}
  state.currentYear=y; state.currentMonth=m;
  saveLocal(); updateMonthNav(); render(); updateHistBtns();
}
function populateMonthJump(){
  const sel=document.getElementById('month-jump'); if(!sel) return;
  const curMk=mk(state.currentYear,state.currentMonth);
  sel.innerHTML='';
  for(let y=minY;y<=maxY;y++){
    for(let m2=0;m2<12;m2++){
      if(y===minY&&m2<minM) continue;
      if(y===maxY&&m2>maxM) continue;
      const opt=document.createElement('option');
      const isClosed=_isClosedMonth(mk(y,m2));
      opt.value=mk(y,m2); opt.textContent=(isClosed?'🔒 ':'')+MONTHS_FULL[m2]+' '+y;
      if(mk(y,m2)===curMk) opt.selected=true;
      sel.appendChild(opt);
    }
  }
}
function jumpToMonth(mkStr){
  const parts=mkStr.split('-');
  state.currentYear=parseInt(parts[0],10);
  state.currentMonth=parseInt(parts[1],10)-1;
  const _mk=currentMK();
  if(!(state.rowsByMonth&&state.rowsByMonth[_mk]) && _recRules().some(r=>!r.draft&&FiRecurring.monthInScope(r,_mk))){
    if(_recFillNewMonth(_mk)) save();
  }
  saveLocal(); updateMonthNav(); render(); updateHistBtns();
}
function updateMonthNav(){
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  const sm=document.getElementById('summary-month');
  if(sm){
    sm.textContent=label;
    sm.querySelectorAll('.forecast-badge').forEach(b=>b.remove());
    if(isForecastMonth()){const b=document.createElement('span');b.className='forecast-badge';b.textContent='📋 Forecast';sm.appendChild(b);}
  }
  document.getElementById('prev-btn').disabled=isAtMin();
  document.getElementById('next-btn').disabled=isAtMax();
  populateMonthJump();
  updateForecastUI();
  updateCloseBar();
  updateMonthContextNote();
}
// W2: explain the per-month "fork" inline — rows, columns, and per-row
// currencies are each month's own copy (see forkCurrentMonth()), which
// surprises people editing a past/future month expecting it to affect "now".
// Plain orientation text, kept deliberately distinct from the close-bar's
// "closed/locked" vocabulary (that's about edit permission, not data scoping).
function updateMonthContextNote(){
  const note=document.getElementById('month-context-note');
  if(!note) return;
  const now=new Date();
  if(currentMK()===mk(now.getFullYear(),now.getMonth())){ note.style.display='none'; return; }
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  note.textContent='📅 Viewing '+label+' - sources, columns, and currencies here belong to '+label+' only; other months keep their own.';
  note.style.display='block';
}

// ── Monthly Close Flow ────────────────────────────────────────────────────
function _hasDataForMonth(mk2){
  return Object.keys(state.cells||{}).some(k=>k.startsWith(mk2+'|')&&parseFloat(state.cells[k])>0);
}
// B (Playful): first time a fresh month gains income data this session, fire a one-off
// celebration. Personality-gated (near-instant no-op for Default/Quiet) and idempotent per
// month/session via sessionStorage. Caller wraps in try/catch so it can never break save().
function _maybeCelebrateFirstEntry(mk2){
  if(!window.fiappCelebrate || (window.fiappPersonality&&fiappPersonality()!=='playful')) return;
  if(_monthsWithDataAtLoad&&_monthsWithDataAtLoad.has(mk2)) return; // already had data before this session
  var key='fiapp_firstentry_inc_'+mk2;
  try{ if(sessionStorage.getItem(key)) return; }catch(_){ return; }
  if(!_hasDataForMonth(mk2)) return;
  try{ sessionStorage.setItem(key,'1'); }catch(_){}
  fiappCelebrate({confetti:true, mascot:'First income logged. Nice.'});
}
function _isPastMonth(){
  const now=new Date();
  const nowMk=mk(now.getFullYear(),now.getMonth());
  return currentMK()<nowMk;
}
function _isClosedMonth(mk2){
  return !!(state.closedMonths&&state.closedMonths[mk2]);
}
function reopenMonth(){
  const mk2=currentMK();
  if(state.closedMonths) delete state.closedMonths[mk2];
  saveLocal(); save();
  updateCloseBar(); populateMonthJump(); render();
}
function _incomeTotalForMonth(mk2){
  let total=0;
  const rows=getRows(mk2);
  rows.filter(r=>!r.parentId).forEach(row=>{
    const kids=rows.filter(c=>c.parentId===row.id);
    if(kids.length){ kids.forEach(child=>{ (state.cols||[]).forEach(col=>{ total+=parseFloat((state.cells||{})[mk2+'|'+child.id+'|'+col.id]||0)||0; }); }); }
    else { (state.cols||[]).forEach(col=>{ total+=parseFloat((state.cells||{})[mk2+'|'+row.id+'|'+col.id]||0)||0; }); }
  });
  return total;
}
function updateCloseBar(){
  const bar=document.getElementById('close-bar');
  if(!bar) return;
  const mk2=currentMK();
  const btn=bar.querySelector('button');
  if(_isClosedMonth(mk2)){
    document.getElementById('close-bar-text').innerHTML='🔒 <strong>Closed</strong> - this month is locked.';
    if(btn){ btn.textContent='Reopen ↩'; btn.onclick=reopenMonth; }
    bar.style.display='flex'; return;
  }
  if(!_isPastMonth()||!_hasDataForMonth(mk2)){
    bar.style.display='none'; return;
  }
  if(btn){ btn.textContent='Review & close ✓'; btn.onclick=openCloseModal; }
  const total=_incomeTotalForMonth(mk2);
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  document.getElementById('close-bar-text').textContent='📋 Close '+label+'? - $'+total.toFixed(2)+' income logged';
  bar.style.display='flex';
}
function openCloseModal(){
  const mk2=currentMK();
  const total=_incomeTotalForMonth(mk2);
  let py=state.currentYear, pm=state.currentMonth-1;
  if(pm<0){py--;pm=11;}
  const pmk2=mk(py,pm);
  const prevTotal=_incomeTotalForMonth(pmk2);
  const delta=prevTotal>0?total-prevTotal:null;
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  let details='<strong>'+escapeHtml(label)+'</strong><br>Income logged: $'+total.toFixed(2);
  if(delta!==null){ details+='<br><span style="color:var(--muted);font-size:.85rem">'+(delta>=0?'↑ $'+delta.toFixed(2)+' vs prev month':'↓ $'+Math.abs(delta).toFixed(2)+' vs prev month')+'</span>'; }
  let topRow='', topVal=0;
  const rows=getRows(mk2);
  rows.filter(r=>!r.parentId).forEach(row=>{
    const kids=rows.filter(c=>c.parentId===row.id);
    let rowTotal=0;
    if(kids.length){ kids.forEach(child=>{ (state.cols||[]).forEach(col=>{ rowTotal+=parseFloat((state.cells||{})[mk2+'|'+child.id+'|'+col.id]||0)||0; }); }); }
    else { (state.cols||[]).forEach(col=>{ rowTotal+=parseFloat((state.cells||{})[mk2+'|'+row.id+'|'+col.id]||0)||0; }); }
    if(rowTotal>topVal){ topVal=rowTotal; topRow=row.label; }
  });
  if(topRow) details+='<br><span style="color:var(--muted);font-size:.85rem">Top source: '+escapeHtml(topRow)+' ($'+topVal.toFixed(2)+')</span>';
  document.getElementById('close-modal-body').innerHTML=details;
  const overlay=document.getElementById('close-modal-overlay');
  if(!overlay) return;
  overlay.style.display='flex';
  _trapModalFocus(overlay);
}
function confirmClose(){
  const mk2=currentMK();
  if(!state.closedMonths) state.closedMonths={};
  state.closedMonths[mk2]=Date.now();
  saveLocal(); save();
  _closeModalOverlay();
  updateCloseBar();
  populateMonthJump();
  // Re-render so the month's read-only state applies immediately, not only after nav.
  render();
  if(window.fiappCelebrate){
    const total=_incomeTotalForMonth(mk2);
    let py=state.currentYear, pm=state.currentMonth-1;
    if(pm<0){py--;pm=11;}
    const prevTotal=_incomeTotalForMonth(mk(py,pm));
    const _up=prevTotal>0&&total>prevTotal;
    fiappCelebrate({confetti:true, big:_up, mascot:_up?'Month closed - income is up. Nice.':'Month closed.'});
  }
}
function cancelClose(){
  _closeModalOverlay();
}
// W8c: focus trap + Esc-close + focus restore for the close-month dialog —
// extends the pattern the small popups already use (Esc removes, focus the
// first control) to a full dialog with multiple controls and a real backdrop.
let _closeModalOpener=null;
function _modalFocusables(overlay){
  return Array.from(overlay.querySelectorAll('button:not([disabled]),[tabindex]:not([tabindex="-1"])'));
}
function _modalKeydown(e){
  const overlay=document.getElementById('close-modal-overlay');
  if(!overlay||overlay.style.display==='none') return;
  if(e.key==='Escape'){ e.preventDefault(); cancelClose(); return; }
  if(e.key==='Tab'){
    const f=_modalFocusables(overlay);
    if(!f.length) return;
    const first=f[0], last=f[f.length-1];
    if(e.shiftKey){ if(document.activeElement===first){ e.preventDefault(); last.focus(); } }
    else { if(document.activeElement===last){ e.preventDefault(); first.focus(); } }
  }
}
function _trapModalFocus(overlay){
  _closeModalOpener=document.activeElement;
  document.addEventListener('keydown',_modalKeydown);
  const f=_modalFocusables(overlay);
  if(f.length) f[0].focus();
}
function _closeModalOverlay(){
  const overlay=document.getElementById('close-modal-overlay');
  if(overlay) overlay.style.display='none';
  document.removeEventListener('keydown',_modalKeydown);
  if(_closeModalOpener&&typeof _closeModalOpener.focus==='function') _closeModalOpener.focus();
  _closeModalOpener=null;
}

function isForecastMonth(){
  const now=new Date();
  return state.currentYear>now.getFullYear()||(state.currentYear===now.getFullYear()&&state.currentMonth>now.getMonth());
}
function updateForecastUI(){
  const fc=isForecastMonth();
  const bar=document.getElementById('forecast-bar');
  if(bar) bar.style.display=fc?'flex':'none';
  const sb=document.getElementById('summary-bar');
  if(sb) sb.classList.toggle('forecast-panel',fc);
}
function copyLastMonth(){
  if(!isForecastMonth()) return;
  snapshot();
  let py=state.currentYear, pm=state.currentMonth-1;
  if(pm<0){py--;pm=11;}
  const prevMk=mk(py,pm), curMk=currentMK();
  let copied=0;
  Object.keys(state.cells).forEach(k=>{
    if(!k.startsWith(prevMk+'|')) return;
    const newKey=curMk+k.slice(prevMk.length);
    if(!state.cells[newKey]){state.cells[newKey]=state.cells[k];copied++;}
  });
  save(); render();
  showForecastToast(copied?`Copied ${copied} values from ${MONTHS_SHORT[pm]} ${py}.`:'All cells already have values - nothing to copy.');
}
function useAverages(){
  if(!isForecastMonth()) return;
  snapshot();
  const curMk=currentMK();
  const srcMonths=[];
  for(let i=1;i<=3;i++){
    let pm=state.currentMonth-i, py=state.currentYear;
    if(pm<0){py--;pm+=12;}
    srcMonths.push(mk(py,pm));
  }
  let filled=0, hasHistory=false;
  getRows().forEach(r=>{
    getCols().forEach(col=>{

      const usdVals=srcMonths.map(m=>{
        const raw=safeNum(state.cells[m+'|'+r.id+'|'+col.id]);
        return raw>0 ? amountToUSD(raw,m,r.id) : 0;
      }).filter(v=>v>0);
      if(!usdVals.length) return;
      hasHistory=true;
      const avg=(usdVals.reduce((a,b)=>a+b,0)/usdVals.length).toFixed(2);
      state.cells[curMk+'|'+r.id+'|'+col.id]=avg;
      filled++;
    });
  });
  save(); render();
  showForecastToast(hasHistory?`Updated ${filled} cells using up to 3-month averages.`:'No historical data found in the 3 months before this forecast period.');
}
function showForecastToast(msg){
  let t=document.getElementById('forecast-toast');
  if(!t){t=document.createElement('div');t.id='forecast-toast';t.className='forecast-toast';t.setAttribute('aria-live','polite');t.setAttribute('aria-atomic','true');document.body.appendChild(t);}
  t.textContent=msg; t.classList.add('show');
  clearTimeout(window._fcToastT);
  window._fcToastT=setTimeout(()=>t.classList.remove('show'),3500);
}


function ck(rId,cId){ return currentMK()+'|'+rId+'|'+cId; }
function getRawCell(rId,cId){ return state.cells[ck(rId,cId)]||''; }
function getCell(rId,cId){ return safeNum(state.cells[ck(rId,cId)]); }
function setCell(rId,cId,v){ state.cells[ck(rId,cId)]=v; save(); }


function children(rId, mk2){ return getRows(mk2).filter(r=>r.parentId===rId); }
function hasChildren(rId, mk2){ return getRows(mk2).some(r=>r.parentId===rId); }
function isCollapsed(rId){ return state.collapsed[rId]===true; }


function rowTotalUSD(rId){

  const kids=children(rId);
  if(kids.length) return kids.reduce((s,c)=>s+rowTotalUSD(c.id),0);
  return getCols().reduce((s,col)=>s+amountToUSD(getCell(rId,col.id), currentMK(), rId),0);
}
function rowTotal(rId){
  
  const usd=rowTotalUSD(rId);
  return usd*currentRate;
}
function grandTotal(){
  const usd=getRows().filter(r=>!r.parentId).reduce((s,r)=>s+rowTotalUSD(r.id),0);
  return usd;
}
function salaryTotal(){

  return getRows()
    .filter(r=>!r.parentId && r.label.trim().toLowerCase()==='salary')
    .reduce((s,r)=>s+rowTotalUSD(r.id),0);
}
function grandTotalDisplay(){
  return grandTotal()*currentRate;
}
function colTotal(cId){
  return getRows().filter(r=>!r.parentId).reduce((s,r)=>{
    if(hasChildren(r.id)) return s+children(r.id).reduce((cs,c)=>cs+amountToUSD(getCell(c.id,cId), currentMK(), c.id),0);
    return s+amountToUSD(getCell(r.id,cId), currentMK(), r.id);
  },0);
}
function fmt(n){ return '$'+Math.max(0,n).toFixed(2); }

function updateRowTotal(rId){
  const el=document.getElementById('rt-'+rId); if(el) el.textContent=fmt(rowTotal(rId));
  const row=getRows().find(r=>r.id===rId);
  if(row&&row.parentId){ updateRowTotal(row.parentId); updateParentSumCells(row.parentId); }
}
function updateParentSumCells(pId){
  getCols().forEach(col=>{
    const el=document.getElementById('ps-'+pId+'-'+col.id);
    if(el){
      const s=children(pId).reduce((t,c)=>t+getCell(c.id,col.id),0);
      el.textContent=s>0?fmt(s):'';
    }
  });
}
function updateColFooter(cId){
  const el=document.getElementById('ct-'+cId); if(el) el.textContent=fmt(colTotal(cId));
}
function updateGrandTotal(){
  const el=document.getElementById('gt'); if(el) el.textContent=fmt(grandTotal());
  getCols().forEach(col=>updateColFooter(col.id));
  updateSummaryBar();
}
function updateAll(rId){ updateRowTotal(rId); updateGrandTotal(); if(chartVisible) renderChart(); }


// W2: empty-state teaching for the per-row currency selector — explains it
// the first time there's a row to show it on. Hidden permanently once
// dismissed, or once the user has actually used it (set a non-default currency).
function updateCurrencyHint(){
  const el=document.getElementById('currency-hint');
  if(!el) return;
  if(localStorage.getItem('fiapp_currency_hint_dismissed')==='1' || getRows().filter(r=>!r.parentId).length===0 || Object.keys(state.monthRowCurrencies||{}).length>0){
    el.style.display='none';
    return;
  }
  el.style.display='flex';
  const dismissBtn=document.getElementById('currency-hint-dismiss');
  if(dismissBtn) dismissBtn.onclick=function(){
    localStorage.setItem('fiapp_currency_hint_dismissed','1');
    el.style.display='none';
  };
}
// Batch D Wave 4: stat-strip delta vs last month, alongside the pre-existing totals.
function _prevMK(mk2){
  var parts=mk2.split('-'); var py=parseInt(parts[0],10), pm=parseInt(parts[1],10)-1;
  pm--; if(pm<0){py--;pm=11;}
  return mk(py,pm);
}
function _prevMonthTotalUSD(mk2){
  return getRows(mk2).filter(function(r){return !r.parentId;}).reduce(function(s,r){return s+rowTotalForMonthKey(r.id,mk2);},0);
}
function updateSummaryBar(){
  const totalUSD=grandTotal();
  const el=document.getElementById('disp-total');
  const annualEl=document.getElementById('disp-annual');
  const convEl=document.getElementById('disp-conv');
  if(el) el.textContent=totalUSD>0?'$'+totalUSD.toFixed(2):'$0.00';
  const deltaEl=document.getElementById('stat-total-delta');
  if(deltaEl){
    const prevUSD=_prevMonthTotalUSD(_prevMK(currentMK()));
    if(prevUSD>0){
      const pct=Math.round((totalUSD-prevUSD)/prevUSD*100);
      deltaEl.className='stat-delta '+(pct>0?'good':pct<0?'bad':'neutral');
      deltaEl.innerHTML='<svg class="fi-ico" aria-hidden="true"><use href="/static/icons/ui-sprite.svg?v='+(window.ASSET_V||'')+'#'+(pct>=0?'fi-arrow-up-right':'fi-arrow-down-right')+'"/></svg>'+
        (pct>=0?'+':'')+pct+'% vs last month';
    } else {
      deltaEl.className='stat-delta neutral';
      deltaEl.textContent='';
    }
  }
  if(annualEl) annualEl.textContent=totalUSD>0?'$'+(totalUSD*12).toFixed(2):'-';
  if(convEl&&currentRate!==1){
    const cur=state.displayCurrency||'USD';
    convEl.textContent=totalUSD>0?cur+' '+(totalUSD*currentRate).toFixed(2):'-';
    const annualConvEl=document.getElementById('conv-annual');
    if(annualConvEl) annualConvEl.textContent=totalUSD>0?cur+' '+(totalUSD*12*currentRate).toFixed(2):'-';
  }
  
  const salaryUSD=salaryTotal();
  const taxLink=document.getElementById('tax-calc-link');
  if(taxLink&&salaryUSD>0){
    taxLink.href='/tax?annual='+Math.round(salaryUSD*12);
    taxLink.style.display='';
  } else if(taxLink){
    taxLink.style.display='none';
  }
}


function toggleCollapse(rowId){ snapshot(); state.collapsed[rowId]=!isCollapsed(rowId); save(); render(); }
function expandAll(){ snapshot(); getRows().filter(r=>!r.parentId&&hasChildren(r.id)).forEach(r=>state.collapsed[r.id]=false); save(); render(); }
function collapseAll(){ snapshot(); getRows().filter(r=>!r.parentId&&hasChildren(r.id)).forEach(r=>state.collapsed[r.id]=true); save(); render(); }


let openMenu=null;
function closeMenu(){ if(openMenu){openMenu.remove();openMenu=null;} }
document.addEventListener('click',e=>{ if(!e.target.closest('.sub-dropdown')&&!e.target.closest('.sub-menu')) closeMenu(); });

let _gearMenuEl=null;
function _closeGearMenu(){ if(_gearMenuEl){_gearMenuEl.remove();_gearMenuEl=null;} }
document.addEventListener('pointerdown',e=>{ if(!e.target.closest('.row-gear-menu')&&!e.target.closest('.row-gear-btn')) _closeGearMenu(); });

function _openGearMenu(btn, row, rhTd, swatch, textSwatch, isChild){
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  _closeGearMenu();
  document.querySelectorAll('input[data-gear-clr]').forEach(el=>el.remove());

  const menu=document.createElement('div'); menu.className='row-gear-menu';

  function mBtn(label,fn){
    const b=document.createElement('button');b.textContent=label;
    b.addEventListener('click',e=>{e.stopPropagation();_closeGearMenu();fn();});
    menu.appendChild(b);
  }

  function mColorItem(labelText, initVal, onInput){
    const id='_gc_'+Math.random().toString(36).slice(2,8);
    const inp=document.createElement('input');
    inp.type='color';inp.id=id;inp.value=initVal;
    inp.setAttribute('data-gear-clr','1');
    inp.style.cssText='position:fixed;opacity:0;top:50%;left:50%;pointer-events:none;';
    inp.addEventListener('input',()=>onInput(inp.value));
    inp.addEventListener('change',()=>{ _closeGearMenu();save();inp.remove(); });
    document.body.appendChild(inp);
    const lbl=document.createElement('label');lbl.htmlFor=id;lbl.textContent=labelText;
    lbl.addEventListener('click',e=>e.stopPropagation());
    menu.appendChild(lbl);
  }

  mColorItem('🎨 Background colour', row.color||'#ffffff',
    v=>{ row.color=v;rhTd.style.backgroundColor=v;if(swatch)swatch.style.backgroundColor=v;if(textSwatch)textSwatch.style.backgroundColor=v; }
  );
  mColorItem('🔤 Text colour', row.textColor||'#1f2937',
    v=>{ row.textColor=v;const lbl=rhTd.querySelector('.row-label');if(lbl)lbl.style.color=v;if(textSwatch)textSwatch.style.color=v; }
  );

  if(!isChild){
    mBtn('＋ Add sub-source',()=>{ showSubMenu(btn,row); });
  }
  if(_recEligible(row, isChild)){
    const _rule=_recRuleFor(row.id);
    mBtn(_rule?'🔁 Edit recurring':'🔁 Mark recurring',()=>{ openRecurringConfig(row.id); });
    if(_rule){
      const _isExcepted=(_rule.exceptions||[]).indexOf(currentMK())>=0;
      mBtn(_isExcepted?'🔗 Relink this month':'⛓ Delink this month',()=>{ _isExcepted?relinkMonth(row.id, currentMK()):delinkMonth(row.id, currentMK()); });
      mBtn('✖ Remove recurring',()=>{ removeRecurring(row.id); });
    }
  }
  mBtn('🗑 Delete row',()=>{ deleteRow(row.id); });

  const r=btn.getBoundingClientRect();
  const left=Math.max(4,Math.min(r.left,window.innerWidth-180));
  menu.style.cssText=`position:fixed;top:${r.bottom+4}px;left:${left}px;z-index:9999;`;
  document.body.appendChild(menu);
  _gearMenuEl=menu;
  // Flip upward if menu clips the bottom of the viewport
  const mh=menu.getBoundingClientRect().height;
  if(r.bottom+4+mh>window.innerHeight-8){
    menu.style.top=Math.max(8,r.top-4-mh)+'px';
  }
}

function renderOtherForm(menu, row){
  menu.innerHTML='';
  const f=document.createElement('div'); f.className='sub-other-form';
  const inp=document.createElement('input'); inp.type='text'; inp.placeholder='Custom sub-source'; inp.maxLength=40;
  const err=document.createElement('span'); err.className='sub-other-err';
  const btnRow=document.createElement('div'); btnRow.className='row';
  const ok=document.createElement('button'); ok.className='ok'; ok.textContent='Add';
  const cancel=document.createElement('button'); cancel.className='cancel'; cancel.textContent='Cancel';
  btnRow.appendChild(ok); btnRow.appendChild(cancel);
  f.appendChild(inp); f.appendChild(err); f.appendChild(btnRow);
  menu.appendChild(f);
  setTimeout(()=>inp.focus(),20);

  function tryAdd(){
    const name=inp.value.trim(); err.textContent='';
    if(!name){ err.textContent='Enter a name.'; return; }
    const lower=name.toLowerCase();
    const existing=children(row.id).map(c=>c.label.toLowerCase());
    const mainCat=CAT_KEYS.find(k=>k===row.label)||CAT_KEYS.find(k=>CATEGORIES[k].includes(row.label));
    const builtins = mainCat ? CATEGORIES[mainCat].map(s=>s.toLowerCase()) : [];
    if(existing.includes(lower)||builtins.includes(lower)){
      err.textContent='"'+name+'" already exists in this category.'; return;
    }
    addSubRow(row,name); closeMenu();
  }
  ok.addEventListener('click',e=>{e.stopPropagation();tryAdd();});
  cancel.addEventListener('click',e=>{e.stopPropagation();closeMenu();});
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();tryAdd();} if(e.key==='Escape'){closeMenu();} });
}

function showSubMenu(btn, row){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  closeMenu();
  let subs=[];
  const mainCat=CAT_KEYS.find(k=>k===row.label)||CAT_KEYS.find(k=>CATEGORIES[k].includes(row.label));
  if(mainCat) subs=CATEGORIES[mainCat].filter(s=>!children(row.id).some(c=>c.label===s));

  const menu=document.createElement('div'); menu.className='sub-menu';

  if(mainCat&&subs.length){
    subs.forEach(s=>{
      const item=document.createElement('button'); item.className='sub-menu-item'; item.textContent=s;
      item.addEventListener('click',e=>{e.stopPropagation();addSubRow(row,s);closeMenu();});
      menu.appendChild(item);
    });
  } else if(!mainCat) {
    CAT_KEYS.forEach(cat=>{
      const g=document.createElement('div'); g.className='sub-menu-group'; g.textContent=cat; menu.appendChild(g);
      CATEGORIES[cat].forEach(s=>{
        const item=document.createElement('button'); item.className='sub-menu-item'; item.textContent=s;
        item.addEventListener('click',e=>{e.stopPropagation();addSubRow(row,s);closeMenu();});
        menu.appendChild(item);
      });
    });
  }

  const other=document.createElement('button'); other.className='sub-menu-item sub-other'; other.textContent='+ Other (custom)…';
  other.addEventListener('click',e=>{e.stopPropagation();renderOtherForm(menu,row);});
  menu.appendChild(other);

  const rect=btn.getBoundingClientRect();
  menu.style.top=(rect.bottom+4)+'px';
  menu.style.left=rect.left+'px';
  document.body.appendChild(menu);
  openMenu=menu;
  const mRect=menu.getBoundingClientRect();
  if(mRect.bottom > window.innerHeight - 8){
    menu.style.top=(rect.top - menu.offsetHeight - 4)+'px';
  }
  if(mRect.right > window.innerWidth - 8){
    menu.style.left=Math.max(4, window.innerWidth - mRect.width - 8)+'px';
  }
}


function addRow(){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  forkCurrentMonth();
  const mk2=currentMK();
  if(getRows(mk2).filter(r=>!r.parentId).length>=MAX_ROWS){showToast('Maximum '+MAX_ROWS+' rows per month.');return;}
  snapshot();
  const usedLabels=getRows(mk2).filter(r=>!r.parentId).map(r=>r.label);
  const nextCat=CAT_KEYS.find(k=>!usedLabels.includes(k))||'Salary';
  state.rowsByMonth[mk2].push({id:uid(),label:nextCat,color:CAT_COLORS[nextCat]||'#e5e7eb',textColor:'#1f2937',height:36,parentId:null});
  save(); render();
}
function addSubRow(parentRow, subLabel){
  forkCurrentMonth();
  const mk2=currentMK();
  if(getRows(mk2).length>=MAX_ROWS){showToast('Maximum '+MAX_ROWS+' rows per month.');return;}
  snapshot();
  const rows=state.rowsByMonth[mk2];
  const parentIdx=rows.findIndex(r=>r.id===parentRow.id);
  const kids=rows.reduce((acc,r,i)=>r.parentId===parentRow.id?[...acc,i]:acc,[]);
  const insertIdx=kids.length?Math.max(...kids)+1:parentIdx+1;
  rows.splice(insertIdx,0,{id:uid(),label:subLabel,color:parentRow.color,textColor:parentRow.textColor||'#1f2937',height:32,parentId:parentRow.id});
  state.collapsed[parentRow.id]=false;
  save(); render();
}
function addCol(){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  forkCurrentMonth();
  const mk2=currentMK();
  if(getCols(mk2).length>=MAX_COLS){showToast('Maximum '+MAX_COLS+' columns per month.');return;}
  snapshot();
  state.colsByMonth[mk2].push({id:uid(),label:'New Column',width:120});
  save(); render();
}
function deleteRow(id){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  forkCurrentMonth();
  snapshot();
  const mk2=currentMK();
  const rowToDelete=getRows(mk2).find(r=>r.id===id);
  const parentId=rowToDelete?rowToDelete.parentId:null;
  const kids=getRows(mk2).filter(r=>r.parentId===id).map(r=>r.id);
  const toDelete=[id,...kids];
  state.rowsByMonth[mk2]=getRows(mk2).filter(r=>!toDelete.includes(r.id));
  Object.keys(state.cells).forEach(k=>{ if(toDelete.some(d=>k.includes('|'+d+'|'))) delete state.cells[k]; });
  const lastChildGone=parentId&&!getRows(mk2).some(r=>r.parentId===parentId);
  if(lastChildGone){
    Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|'+parentId+'|')) delete state.cells[k]; });
  }
  save();
  if(lastChildGone){
    render();
  } else {
    (function(){var tbody=document.querySelector('#sheet tbody');if(!tbody){render();return;}toDelete.forEach(function(rId){var tr=tbody.querySelector('[data-tr-row-id="'+rId+'"]');if(tr)tr.remove();});updateGrandTotal();})();
  }
  showToast('Row deleted.', false, 5000, undo);
}
function deleteCol(id){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  forkCurrentMonth();
  snapshot();
  const mk2=currentMK();
  state.colsByMonth[mk2]=getCols(mk2).filter(c=>c.id!==id);
  Object.keys(state.cells).filter(k=>k.endsWith('|'+id)).forEach(k=>delete state.cells[k]);
  save(); render();
  showToast('Column deleted.', false, 5000, undo);
}

function moveParentRow(fromId, toId, before){
  if(fromId===toId) return;
  forkCurrentMonth();
  snapshot();
  const mk2=currentMK();
  const rows=state.rowsByMonth[mk2];
  const fromGroup=[fromId,...rows.filter(r=>r.parentId===fromId).map(r=>r.id)];
  const fromRows=fromGroup.map(id=>rows.find(r=>r.id===id)).filter(Boolean);
  state.rowsByMonth[mk2]=rows.filter(r=>!fromGroup.includes(r.id));
  const arr=state.rowsByMonth[mk2];
  const toParentIdx=arr.findIndex(r=>r.id===toId);
  if(toParentIdx===-1){arr.push(...fromRows);save();render();return;}
  if(before){
    arr.splice(toParentIdx,0,...fromRows);
  } else {
    const toKids=arr.reduce((acc,r,i)=>r.parentId===toId?[...acc,i]:acc,[]);
    const insertAfter=toKids.length?Math.max(...toKids):toParentIdx;
    arr.splice(insertAfter+1,0,...fromRows);
  }
  save(); render();
}
let _dragRowId=null;
let _activeDropEl=null;
let _dragColId=null;


function escapeHtml(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function safeNum(v,max=1e12){
  const n=parseFloat(v);
  return (isFinite(n)&&n>=-max&&n<=max)?n:0;
}


let chartInstance=null, chartVisible=false, chartMode='monthly', chartType='bar';
function toggleChart(){
  chartVisible=!chartVisible;
  document.getElementById('chart-section').style.display=chartVisible?'block':'none';
  document.getElementById('chart-btn').textContent=chartVisible?'📊 Hide Chart':'📊 Chart';
  if(chartVisible) renderChart();
}
function setChartMode(mode){
  chartMode=mode;
  document.getElementById('chart-mode-m').classList.toggle('active',mode==='monthly');
  document.getElementById('chart-mode-y').classList.toggle('active',mode==='yearly');
  renderChart();
}
function setChartType(type){
  chartType=type;
  document.getElementById('chart-type-bar').classList.toggle('active',type==='bar');
  document.getElementById('chart-type-doughnut').classList.toggle('active',type==='doughnut');
  renderChart();
}
function rowTotalForMonthKey(rId, monthKey){
  const kids=getRows(monthKey).filter(r=>r.parentId===rId);
  if(kids.length) return kids.reduce((s,c)=>s+rowTotalForMonthKey(c.id,monthKey),0);
  return getCols(monthKey).reduce((s,col)=>{
    const k=monthKey+'|'+rId+'|'+col.id;
    return s+amountToUSD(parseFloat(state.cells[k])||0, monthKey, rId);
  },0);
}
function rowTotalForYear(rId,year){
  let t=0; for(let m=0;m<12;m++) t+=rowTotalForMonthKey(rId,mk(year,m)); return t;
}
function renderChart(){
  if(!chartVisible) return;
  const topRows=getRows().filter(r=>!r.parentId);
  let data, topLabel;
  if(chartMode==='yearly'){
    data=topRows.map(r=>({label:r.label,value:rowTotalForYear(r.id,state.currentYear),color:r.color})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
    topLabel='Top Income - '+state.currentYear;
  } else {
    data=topRows.map(r=>({label:r.label,value:rowTotal(r.id),color:r.color})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
    topLabel='Top Income - '+MONTHS_SHORT[state.currentMonth]+' '+state.currentYear;
  }
  const _chartCanvas=document.getElementById('inc-chart');
  if(_chartCanvas){
    _chartCanvas.setAttribute('role','img');
    _chartCanvas.setAttribute('aria-label', data.length
      ? topLabel+'. Top: '+data.slice(0,3).map(d=>d.label+' $'+parseFloat(d.value.toFixed(2))).join(', ')+(data.length>3?', and '+(data.length-3)+' more':'')+'.'
      : topLabel+'. No data to display.');
  }
  if(!data.length){
    if(chartInstance){chartInstance.destroy();chartInstance=null;}
    renderTop3([],topLabel);return;
  }
  const colors=data.map(d=>d.color||'#bbf7d0');
  const vals=data.map(d=>parseFloat(d.value.toFixed(2)));
  const labels=data.map(d=>d.label);
  const isDark=document.documentElement.classList.contains('dark');
  const fgColor=isDark?'#e2e8f0':'#1f2937';
  const gridColor=isDark?'rgba(255,255,255,.1)':'rgba(0,0,0,.08)';
  // Update in place when the chart type hasn't changed — a theme change or a data edit
  // then just recolors/reflows the existing chart instead of replaying the entrance
  // animation that a destroy+recreate would trigger.
  if(chartInstance && chartInstance.config.type===chartType){
    chartInstance.data.labels=labels;
    const ds=chartInstance.data.datasets[0];
    ds.data=vals; ds.backgroundColor=colors;
    if(chartType==='doughnut'){
      ds.borderColor=isDark?'#1e293b':'#fff';
      chartInstance.options.plugins.legend.labels.color=fgColor;
    } else {
      chartInstance.options.scales.x.ticks.color=fgColor;
      chartInstance.options.scales.x.grid.color=gridColor;
      chartInstance.options.scales.x.border.color=gridColor;
      chartInstance.options.scales.y.ticks.color=fgColor;
      chartInstance.options.scales.y.grid.color=gridColor;
      chartInstance.options.scales.y.border.color=gridColor;
    }
    chartInstance.update();
    renderTop3(data,topLabel);
    return;
  }
  if(chartInstance){chartInstance.destroy();chartInstance=null;}
  if(chartType==='doughnut'){
    chartInstance=new Chart(document.getElementById('inc-chart'),{
      type:'doughnut',
      data:{labels,datasets:[{data:vals,backgroundColor:colors,borderWidth:2,borderColor:isDark?'#1e293b':'#fff',hoverOffset:8}]},
      options:{
        responsive:true,maintainAspectRatio:true,
        plugins:{
          legend:{display:true,position:'right',labels:{color:fgColor,boxWidth:14,padding:10,font:{size:12}}},
          tooltip:{callbacks:{label:ctx=>' '+ctx.label+': $'+ctx.parsed.toFixed(2)+' ('+(ctx.parsed/ctx.dataset.data.reduce((a,b)=>a+b,0)*100).toFixed(1)+'%)'}}
        }
      }
    });
  } else {
    chartInstance=new Chart(document.getElementById('inc-chart'),{
      type:'bar',
      data:{labels,datasets:[{label:'$ Amount',data:vals,backgroundColor:colors,borderRadius:4}]},
      options:{
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' $'+ctx.parsed.y.toFixed(2)}}},
        scales:{
          x:{ticks:{color:fgColor},grid:{color:gridColor},border:{color:gridColor}},
          y:{beginAtZero:true,ticks:{color:fgColor,callback:v=>'$'+v},grid:{color:gridColor},border:{color:gridColor}}
        },
        responsive:true,maintainAspectRatio:true
      }
    });
  }
  renderTop3(data,topLabel);
}
function renderTop3(data,label){
  const top=(data||[]).slice(0,3);
  const el=document.getElementById('top3');
  if(!top.length){el.innerHTML='';return;}
  el.innerHTML='<h4>'+escapeHtml(label||'Top 3')+'</h4><ol>'+top.map(t=>`<li><strong>${escapeHtml(t.label)}</strong> - $${parseFloat(t.value.toFixed(2))}</li>`).join('')+'</ol>';
}


let resetTimer=null;
function resetAll(e){
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  const btn=document.getElementById('reset-btn');
  if(btn.dataset.arm){
    clearTimeout(resetTimer); delete btn.dataset.arm; btn.textContent='⚠ Reset'; btn.classList.remove('armed');
    snapshot();
    const mk=currentMK();
    Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk+'|')) delete state.cells[k]; });
    if(state.rowsByMonth) delete state.rowsByMonth[mk];
    if(state.colsByMonth) delete state.colsByMonth[mk];
    if(state.monthRowCurrencies) Object.keys(state.monthRowCurrencies).forEach(k=>{ if(k.startsWith(mk+'|')) delete state.monthRowCurrencies[k]; });
    save(); render();
  } else {
    if(e) e.stopPropagation();
    btn.dataset.arm='1'; btn.textContent='⚠ Sure?'; btn.classList.add('armed');
    resetTimer=setTimeout(()=>{delete btn.dataset.arm;btn.textContent='⚠ Reset';btn.classList.remove('armed');},2500);
  }
}


function attachColResize(handle,col){
  handle.addEventListener('mousedown',e=>{
    if(_isClosedMonth(currentMK()))return;
    e.preventDefault();handle.classList.add('dragging');
    const sx=e.clientX,sw=col.width,cEl=document.getElementById('cg-'+col.id);
    const mv=e=>{col.width=Math.max(55,sw+e.clientX-sx);if(cEl)cEl.style.width=col.width+'px';};
    const up=()=>{handle.classList.remove('dragging');save();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}
function attachHdrResize(handle){
  handle.addEventListener('mousedown',e=>{
    e.preventDefault();handle.classList.add('dragging');
    const sx=e.clientX,sw=state.headerColWidth,cEl=document.getElementById('cg-hdr');
    const mv=e=>{state.headerColWidth=Math.max(100,sw+e.clientX-sx);if(cEl)cEl.style.width=state.headerColWidth+'px';};
    const up=()=>{handle.classList.remove('dragging');save();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}
function attachRowResize(handle,row,tr){
  handle.addEventListener('mousedown',e=>{
    if(_isClosedMonth(currentMK()))return;
    e.preventDefault();handle.classList.add('dragging');
    const sy=e.clientY,sh=row.height||36;
    const mv=e=>{row.height=Math.max(26,sh+e.clientY-sy);tr.style.height=row.height+'px';};
    const up=()=>{handle.classList.remove('dragging');save();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}


function renderTableHeader(table){
  const cg=document.createElement('colgroup');
  const _mob=window.innerWidth<640;
  const _vw=window.innerWidth;
  // Mobile: label ~43% vw, data cols 115px. Table scrolls ~30px to show Total — better than cramping.
  const _hdrW=_mob?Math.max(150,Math.round(_vw*0.43)):state.headerColWidth||235;
  const _dataW=_mob?115:null;
  const hc=document.createElement('col');hc.id='cg-hdr';hc.style.width=_hdrW+'px';cg.appendChild(hc);
  getCols().forEach(col=>{const c=document.createElement('col');c.id='cg-'+col.id;c.style.width=(_mob?_dataW:col.width||120)+'px';cg.appendChild(c);});
  const tc=document.createElement('col');tc.style.width=(state.totalColWidth||110)+'px';cg.appendChild(tc);
  const dc=document.createElement('col');dc.style.width='32px';cg.appendChild(dc);
  table.appendChild(cg);
  const thead=document.createElement('thead'),htr=document.createElement('tr');
  const corner=document.createElement('th');
  const ci=document.createElement('div');ci.className='th-inner';
  const cl=document.createElement('span');cl.style.cssText='font-weight:600;color:var(--muted);font-size:.83rem;';cl.textContent='Source';ci.appendChild(cl);
  corner.appendChild(ci);
  const chr=document.createElement('div');chr.className='col-resize';attachHdrResize(chr);corner.appendChild(chr);
  htr.appendChild(corner);
  getCols().forEach(col=>{
    const th=document.createElement('th');
    th.dataset.colId=col.id;
    const inner=document.createElement('div');inner.className='th-inner';
    const cdh=document.createElement('span');cdh.className='col-drag-handle';cdh.textContent='⠿';cdh.title='Drag to reorder column';cdh.setAttribute('aria-label','Drag to reorder column');cdh.setAttribute('role','img');
    cdh.addEventListener('pointerdown',e=>{
      if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
      e.preventDefault();cdh.setPointerCapture(e.pointerId);_dragColId=col.id;
      const onMove=e=>{
        document.querySelectorAll('.th-drop-before,.th-drop-after').forEach(el=>el.classList.remove('th-drop-before','th-drop-after'));
        const over=document.elementFromPoint(e.clientX,e.clientY);
        const tTh=over&&over.closest('th[data-col-id]');
        if(tTh&&tTh.dataset.colId!==_dragColId){const r=tTh.getBoundingClientRect();tTh.classList.add(e.clientX<r.left+r.width/2?'th-drop-before':'th-drop-after');}
      };
      const onUp=e=>{
        cdh.removeEventListener('pointermove',onMove);cdh.removeEventListener('pointerup',onUp);
        document.querySelectorAll('.th-drop-before,.th-drop-after').forEach(el=>el.classList.remove('th-drop-before','th-drop-after'));
        const over=document.elementFromPoint(e.clientX,e.clientY);
        const tTh=over&&over.closest('th[data-col-id]');
        if(tTh&&tTh.dataset.colId!==_dragColId){
          forkCurrentMonth();const mk2=currentMK();const cols=state.colsByMonth[mk2];
          const fromIdx=cols.findIndex(c=>c.id===_dragColId);
          if(fromIdx!==-1){const r=tTh.getBoundingClientRect();const before=e.clientX<r.left+r.width/2;snapshot();
            const [moved]=cols.splice(fromIdx,1);const insertAt=cols.findIndex(c=>c.id===tTh.dataset.colId);
            cols.splice(insertAt!==-1?(before?insertAt:insertAt+1):cols.length,0,moved);save();render();}
        }
        _dragColId=null;
      };
      cdh.addEventListener('pointermove',onMove);cdh.addEventListener('pointerup',onUp);
    });
    inner.appendChild(cdh);
    const lbl=document.createElement('input');lbl.type='text';lbl.className='th-label';lbl.size=1;lbl.value=col.label;lbl.setAttribute('aria-label','Column name');
    if(_isClosedMonth(currentMK())) lbl.disabled=true;
    lbl.addEventListener('blur',()=>{col.label=lbl.value.trim()||col.label;save();});
    lbl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lbl.blur();}});
    inner.appendChild(lbl);
    const del=document.createElement('button');del.className='col-del';del.title='Delete column';del.textContent='×';del.setAttribute('aria-label','Delete column');del.addEventListener('click',()=>deleteCol(col.id));inner.appendChild(del);
    th.appendChild(inner);
    const cr=document.createElement('div');cr.className='col-resize';attachColResize(cr,col);th.appendChild(cr);
    htr.appendChild(th);
  });
  const tth=document.createElement('th');tth.className='th-total';
  const thi=document.createElement('div');thi.className='th-inner';
  const thl=document.createElement('span');thl.style.cssText='font-weight:700;color:var(--total-fg);font-size:.85rem;';
  thl.textContent='Total';thi.appendChild(thl);tth.appendChild(thi);htr.appendChild(tth);
  const act=document.createElement('th');act.style.cssText='background:#f9fafb;border:1px dashed #d1d5db;';
  const acb=document.createElement('button');acb.className='btn-add-col';acb.textContent='+';acb.title='Add column';acb.addEventListener('click',addCol);act.appendChild(acb);htr.appendChild(act);
  thead.appendChild(htr);table.appendChild(thead);
}

function renderTableBody(table){
  const tbody=document.createElement('tbody');
  function renderRow(row){
    const isChild=!!row.parentId, hasKids=hasChildren(row.id), collapsed=isCollapsed(row.id);
    const tr=document.createElement('tr');tr.style.height=(row.height||36)+'px';tr.dataset.trRowId=row.id;
    if(isChild) tr.classList.add('child-row');
    const rhTd=document.createElement('td');rhTd.className='rh-cell';rhTd.style.backgroundColor=row.color;
    const rhIn=document.createElement('div');rhIn.className='rh-inner';
    if(!isChild){
      const dh=document.createElement('span');dh.className='drag-handle';dh.textContent='⠿';dh.title='Drag to reorder';dh.setAttribute('aria-label','Drag to reorder');dh.setAttribute('role','img');
      dh.addEventListener('pointerdown',e=>{
        if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
        e.preventDefault();dh.setPointerCapture(e.pointerId);
        _dragRowId=row.id;tr.classList.add('tr-dragging');
        const onMove=e=>{
          if(_activeDropEl){_activeDropEl.classList.remove('tr-drop-before','tr-drop-after');_activeDropEl=null;}
          const el=document.elementFromPoint(e.clientX,e.clientY);
          const tTr=el&&el.closest('tr[data-row-id]');
          if(tTr&&tTr.dataset.rowId!==_dragRowId){
            const r=tTr.getBoundingClientRect();
            tTr.classList.add(e.clientY<r.top+r.height/2?'tr-drop-before':'tr-drop-after');
            _activeDropEl=tTr;
          }
        };
        const onUp=()=>{
          dh.removeEventListener('pointermove',onMove);dh.removeEventListener('pointerup',onUp);
          tr.classList.remove('tr-dragging');
          const targetEl=_activeDropEl;
          const isBefore=targetEl&&targetEl.classList.contains('tr-drop-before');
          if(_activeDropEl){_activeDropEl.classList.remove('tr-drop-before','tr-drop-after');_activeDropEl=null;}
          if(targetEl){const targetId=targetEl.dataset.rowId;if(targetId&&targetId!==_dragRowId)moveParentRow(_dragRowId,targetId,isBefore);}
          _dragRowId=null;
        };
        dh.addEventListener('pointermove',onMove);dh.addEventListener('pointerup',onUp);
      });
      rhIn.appendChild(dh);
      tr.dataset.rowId=row.id;
    }
    if(hasKids){
      const cb=document.createElement('button');cb.className='collapse-btn';cb.title=collapsed?'Expand':'Collapse';cb.textContent=collapsed?'▸':'▾';
      cb.addEventListener('click',()=>toggleCollapse(row.id));rhIn.appendChild(cb);
    }
    const colorWrap=document.createElement('div');colorWrap.className='color-swatch-wrap tip-host';colorWrap.dataset.tip='Row background colour';
    const swatch=document.createElement('div');swatch.className='color-swatch';swatch.style.backgroundColor=row.color;
    const cInp=document.createElement('input');cInp.type='color';cInp.className='color-inp-overlay';cInp.value=row.color;cInp.setAttribute('aria-label','Row background colour');
    if(_isClosedMonth(currentMK())) cInp.disabled=true;
    cInp.addEventListener('input',()=>{row.color=cInp.value;rhTd.style.backgroundColor=cInp.value;swatch.style.backgroundColor=cInp.value;textSwatch.style.backgroundColor=cInp.value;});
    cInp.addEventListener('change',save);
    colorWrap.appendChild(swatch);colorWrap.appendChild(cInp);
    const tcWrap=document.createElement('div');tcWrap.className='color-swatch-wrap tip-host';tcWrap.dataset.tip='Row text colour';
    const textSwatch=document.createElement('div');textSwatch.className='text-color-swatch';textSwatch.textContent='A';textSwatch.style.color=row.textColor||'#1f2937';textSwatch.style.backgroundColor=row.color||'#ffffff';
    const tcInp=document.createElement('input');tcInp.type='color';tcInp.className='color-inp-overlay';tcInp.value=row.textColor||'#1f2937';tcInp.setAttribute('aria-label','Row text colour');
    if(_isClosedMonth(currentMK())) tcInp.disabled=true;
    tcInp.addEventListener('input',()=>{row.textColor=tcInp.value;rowLabel.style.color=tcInp.value;textSwatch.style.color=tcInp.value;});
    tcInp.addEventListener('change',save);
    tcWrap.appendChild(textSwatch);tcWrap.appendChild(tcInp);
    const rowLabel=document.createElement('input');rowLabel.type='text';rowLabel.className='row-label';rowLabel.size=1;rowLabel.value=row.label;rowLabel.setAttribute('aria-label','Source name');
    rowLabel.style.color=row.textColor||'#1f2937';
    if(_isClosedMonth(currentMK())) rowLabel.disabled=true;
    rowLabel.addEventListener('blur',()=>{row.label=rowLabel.value.trim()||row.label;save();});
    rowLabel.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();rowLabel.blur();}});
    rhIn.appendChild(colorWrap);rhIn.appendChild(tcWrap);rhIn.appendChild(rowLabel);
    // row.recurring is a row-wide flag (true if ANY month is governed by a rule), so it stays
    // true after delinking just the viewed month - check monthInScope too, or a delinked month
    // still shows the badge and reads as "still part of the chain" when it isn't anymore.
    {
      const _badgeRule=row.recurring?_recRuleFor(row.id):null;
      if(_badgeRule && FiRecurring.monthInScope(_badgeRule, currentMK())){const rb=document.createElement('span');rb.className='row-recur-badge';rb.textContent='🔁';rb.title='Recurring';rb.setAttribute('aria-label','Recurring');rb.style.cssText='font-size:.75em;opacity:.6;margin-left:.25rem;pointer-events:none;flex-shrink:0;';rhIn.appendChild(rb);}
    }
    if(!isChild){
      const dd=document.createElement('div');dd.className='sub-dropdown';
      const addBtn=document.createElement('button');addBtn.className='sub-add-btn';addBtn.textContent='+Sub';addBtn.title='Add sub-source';
      addBtn.addEventListener('click',e=>{e.stopPropagation();showSubMenu(addBtn,row);});
      dd.appendChild(addBtn);
      rhIn.appendChild(dd);
    }
    // Desktop recurring entry - available on sub-source rows too (mobile uses the gear menu).
    if(_recEligible(row, isChild)){
      const _rule=_recRuleFor(row.id);
      const recBtn=document.createElement('button');recBtn.className='sub-add-btn recur-mark-btn';
      recBtn.textContent='🔁';recBtn.title=_rule?'Edit recurring':'Mark recurring';recBtn.setAttribute('aria-label',_rule?'Edit recurring':'Mark recurring');
      if(_rule) recBtn.classList.add('active');
      recBtn.addEventListener('click',e=>{e.stopPropagation();openRecurringConfig(row.id);});
      rhIn.appendChild(recBtn);
    }
    {
      // Row options gear: was desktop-parent-only, but _openGearMenu already branches
      // correctly on isChild for every item it offers (colours, recurring, delete), so
      // sub-source rows get the same menu (minus +Sub, which stays parent-only above).
      const gearBtn=document.createElement('button');
      gearBtn.className='row-gear-btn';gearBtn.textContent='⚙';gearBtn.title='Row options';gearBtn.setAttribute('aria-label','Row options');
      gearBtn.addEventListener('click',e=>{ e.stopPropagation();_openGearMenu(gearBtn,row,rhTd,swatch,textSwatch,isChild); });
      rhIn.appendChild(gearBtn);
    }
    rhTd.appendChild(rhIn);
    const rr=document.createElement('div');rr.className='row-resize';attachRowResize(rr,row,tr);rhTd.appendChild(rr);
    tr.appendChild(rhTd);
    getCols().forEach(col=>{
      const td=document.createElement('td');
      if(hasKids){
        const span=document.createElement('span');span.className='parent-sum';span.id='ps-'+row.id+'-'+col.id;
        const s=children(row.id).reduce((t,c)=>t+getCell(c.id,col.id),0);
        span.title='Sum of sub-sources';
        span.textContent=s>0?fmt(s):'';td.appendChild(span);
      } else {
        const wrap=document.createElement('div'); wrap.className='cost-wrap';
        const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='0.01';inp.inputMode='decimal';inp.className='num-input c-num';
        inp.setAttribute('aria-label',((row.label||'Source')+' '+(col.label||'')).trim()+' amount');
        if(_isClosedMonth(currentMK())) inp.disabled=true;
        const stored=getRawCell(row.id,col.id);inp.value=stored!==''?stored:'';
        inp.addEventListener('input',()=>{ inp.value=inp.value.replace(/[^0-9.]/g,''); });
        inp.addEventListener('focus',()=>snapshot());
        inp.addEventListener('change',()=>{
          if(inp.value!==''&&isNaN(parseFloat(inp.value))) return;
          if(parseFloat(inp.value)<0) inp.value='0';
          // Recurring source: route the change through the propagation dialog (month total).
          if(_recRuleFor(row.id)){
            const _cols=(state.colsByMonth&&state.colsByMonth[currentMK()])||state.cols||[];
            let _tot=0; _cols.forEach(cc=>{ _tot += (cc.id===col.id ? (parseFloat(inp.value)||0) : (parseFloat((state.cells||{})[currentMK()+'|'+row.id+'|'+cc.id]||0)||0)); });
            _onRecurringCellEdit(row.id, currentMK(), _tot);
            return;
          }
          if(inp.value===''){
            delete state.cells[ck(row.id,col.id)]; save(); updateAll(row.id); return;
          }
          setCell(row.id,col.id,inp.value);
          ensureRate(rowCurrency(currentMK(), row.id)).then(()=>updateAll(row.id));
        });
        wrap.appendChild(inp);
        const cur=rowCurrency(currentMK(), row.id);
        const sel=document.createElement('select'); sel.className='cell-curr-sel'; sel.title='Currency for this row';
        // Actually disabling (not just guarding mousedown) is what stops the native
        // option list from opening - a preventDefault-on-mousedown guard doesn't
        // reliably block it, so the walkthrough overlay was clickable underneath.
        if(_isClosedMonth(currentMK())||isWalkthroughActive()) sel.disabled=true;
        const codes=getAllUsedCurrencies();
        if(!codes.includes(cur)) codes.push(cur);
        codes.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; if(c===cur) o.selected=true; sel.appendChild(o); });
        const otherOpt=document.createElement('option'); otherOpt.value='__other__'; otherOpt.textContent='Other…'; sel.appendChild(otherOpt);
        sel.addEventListener('mousedown',e=>{
          if(isWalkthroughActive()){e.preventDefault();sel.blur();showToast('🧭 Finish or skip the walkthrough to use this.');}
        });
        sel.addEventListener('change',()=>{
          if(sel.value==='__other__'){ showCellCurrencyOther(wrap,sel,row); return; }
          setRowCurrency(currentMK(), row.id, sel.value);
          ensureRate(sel.value).then(()=>{ updateAll(row.id); renderChart(); });
        });
        wrap.appendChild(sel);
        td.appendChild(wrap);
      }
      tr.appendChild(td);
    });
    const totTd=document.createElement('td');totTd.className='th-total';
    const totInner=document.createElement('div');totInner.style.cssText='display:flex;align-items:center;justify-content:flex-end;';
    const totSpan=document.createElement('span');totSpan.className='total-val';totSpan.id='rt-'+row.id;
    totSpan.textContent=fmt(rowTotal(row.id));totInner.appendChild(totSpan);totTd.appendChild(totInner);tr.appendChild(totTd);
    const delTd=document.createElement('td');delTd.className='del-td';
    const delBtn=document.createElement('button');delBtn.className='row-del';delBtn.title='Delete row';delBtn.setAttribute('aria-label','Delete row');delBtn.textContent='🗑';
    delBtn.addEventListener('click',()=>deleteRow(row.id));delTd.appendChild(delBtn);tr.appendChild(delTd);
    tbody.appendChild(tr);
    if(!isChild&&!collapsed){ children(row.id).forEach(renderRow); }
  }
  getRows().filter(r=>!r.parentId).forEach(renderRow);
  if(getRows().length===0){
    const etr=document.createElement('tr');const etd=document.createElement('td');etd.colSpan=getCols().length+3;
    etd.style.cssText='text-align:center;padding:1.1rem .75rem;color:var(--muted);font-size:.88rem;border:none;';
    etd.textContent='Add your first row to start tracking.';etr.appendChild(etd);tbody.appendChild(etr);
  }
  const atr=document.createElement('tr');const atd=document.createElement('td');atd.colSpan=getCols().length+3;atd.style.cssText='border:none;padding:3px 0;';
  const arb=document.createElement('button');arb.className='btn-add-row';arb.textContent='+ Add Row';arb.addEventListener('click',addRow);
  atd.appendChild(arb);atr.appendChild(atd);tbody.appendChild(atr);
  table.appendChild(tbody);
}

function renderFooter(table){
  const tfoot=document.createElement('tfoot'),ftr=document.createElement('tr');
  const fl=document.createElement('td');fl.style.cssText='font-weight:700;padding:4px 8px;font-size:.85rem;';fl.textContent='TOTAL';ftr.appendChild(fl);
  getCols().forEach(col=>{
    const ftd=document.createElement('td'); ftd.className='week-total-cell';
    const fs=document.createElement('span');fs.className='gtotal-val';fs.id='ct-'+col.id;
    fs.textContent=fmt(colTotal(col.id));
    ftd.appendChild(fs); ftr.appendChild(ftd);
  });
  const gtd=document.createElement('td');gtd.className='gtotal-cell'+(isForecastMonth()?' forecast-total':'');
  const gs=document.createElement('span');gs.className='gtotal-val';gs.id='gt';gs.textContent=fmt(grandTotal());gtd.appendChild(gs);ftr.appendChild(gtd);
  ftr.appendChild(document.createElement('td'));
  tfoot.appendChild(ftr);table.appendChild(tfoot);
}

let _expandedCardId=null;

// ── Mobile carousel layout ────────────────────────────────────────────────
const _MC_LAYOUT_KEY='fiapp_mc_layout_v1';
let _mcPanel=0; // carousel mode: 0=summary, 1=cards
window._mcSetPanel=function(i){_mcPanel=i;}; // called by walkthrough in base.html
// Ensure mobile cards are visible for walkthrough steps that need them
window._wtShowCards=function(){
  if(window.innerWidth>=640) return;
  if(getRows().length===0){
    forkCurrentMonth();
    var mk2=currentMK();
    if(!state.rowsByMonth[mk2]) state.rowsByMonth[mk2]=[];
    ['Salary','Freelance','Investments','Other Income'].forEach(function(l){
      if(state.rowsByMonth[mk2].length>=MAX_ROWS) return;
      state.rowsByMonth[mk2].push({id:uid(),label:l,color:'#d1fae5',textColor:'#1f2937',height:36,parentId:null});
    });
  }
  _setMCLayout('carousel'); _mcPanel=1; render();
};
function _getMCLayout(){try{return localStorage.getItem(_MC_LAYOUT_KEY)||'default';}catch(e){return 'default';}}
function _setMCLayout(v){try{localStorage.setItem(_MC_LAYOUT_KEY,v);}catch(e){}}
function _applyMobileLayout(){
  if(window.innerWidth>=640) return;
  const oldCtrl=document.getElementById('mc-layout-controls'); if(oldCtrl) oldCtrl.remove();
  window._mcShowForTarget=null;
  const summaryEl=document.getElementById('summary-bar');
  const cardsEl=document.getElementById('inc-mobile-cards');
  if(!summaryEl||!cardsEl) return;
  summaryEl.classList.remove('mc-panel-hidden'); cardsEl.classList.remove('mc-panel-hidden');
  const isCarousel=_getMCLayout()==='carousel';
  const ctrl=document.createElement('div'); ctrl.id='mc-layout-controls';
  const toggleBtn=document.createElement('button'); toggleBtn.className='mc-layout-btn';
  toggleBtn.textContent=isCarousel?'⊞ Scroll view':'⊟ Carousel view';
  toggleBtn.addEventListener('click',()=>{_setMCLayout(isCarousel?'default':'carousel');if(!isCarousel) _mcPanel=0;render();});
  ctrl.appendChild(toggleBtn);
  if(isCarousel){
    const panels=[summaryEl,cardsEl]; const labels=['Summary','Cards'];
    panels.forEach((p,i)=>p.setAttribute('data-mc-panel',String(i)));
    const nav=document.createElement('div'); nav.className='mc-panel-nav';
    function showPanel(i){
      _mcPanel=i; panels.forEach((p,j)=>p.classList.toggle('mc-panel-hidden',j!==i));
      nav.querySelectorAll('.mc-panel-dot').forEach((d,j)=>d.classList.toggle('active',j===i));
      const lbl=nav.querySelector('.mc-panel-label'); if(lbl) lbl.textContent=labels[i];
    }
    window._mcShowForTarget=function(el){
      const idx=panels.findIndex(function(p){return p===el||p.contains(el);});
      if(idx>=0) showPanel(idx);
    };
    const prevBtn=document.createElement('button'); prevBtn.className='mc-panel-arrow mc-panel-prev'; prevBtn.textContent='◀';
    prevBtn.addEventListener('click',()=>showPanel((_mcPanel-1+panels.length)%panels.length));
    const dotsWrap=document.createElement('div'); dotsWrap.className='mc-panel-dots';
    labels.forEach((_,i)=>{const dot=document.createElement('span');dot.className='mc-panel-dot';dot.addEventListener('click',()=>showPanel(i));dotsWrap.appendChild(dot);});
    const labelEl=document.createElement('span'); labelEl.className='mc-panel-label';
    const nextBtn=document.createElement('button'); nextBtn.className='mc-panel-arrow mc-panel-next'; nextBtn.textContent='▶';
    nextBtn.addEventListener('click',()=>showPanel((_mcPanel+1)%panels.length));
    nav.appendChild(prevBtn); nav.appendChild(dotsWrap); nav.appendChild(labelEl); nav.appendChild(nextBtn);
    ctrl.appendChild(nav); showPanel(_mcPanel);
  }
  summaryEl.parentNode.insertBefore(ctrl,summaryEl);
}

function render(){
  const _sy=window.scrollY;
  const MOBILE=window.innerWidth<640;
  const sheetWrap=document.getElementById('inc-sheet-wrap');
  const cardsDiv=document.getElementById('inc-mobile-cards');
  const table=document.getElementById('sheet'); table.innerHTML='';
  if(MOBILE){
    if(sheetWrap) sheetWrap.style.display='none';
    if(cardsDiv) cardsDiv.style.display='';
    renderMobileCards();
    _applyMobileLayout();
  } else {
    if(sheetWrap) sheetWrap.style.display='';
    if(cardsDiv) cardsDiv.style.display='none';
    const _oldNav=document.getElementById('mc-layout-controls'); if(_oldNav) _oldNav.remove();
    window._mcShowForTarget=null;
    const _sumEl=document.getElementById('summary-bar'); if(_sumEl) _sumEl.classList.remove('mc-panel-hidden');
    renderTableHeader(table);
    renderTableBody(table);
    renderFooter(table);
  }
  updateSummaryBar();
  updateCurrencyHint();
  if(chartVisible) renderChart();
  adjustBodyWidth();
  updateForecastUI();
  try{ _recDraftBannerRefresh(); }catch(_){}
  const tbl=document.getElementById('sheet');
  if(tbl) tbl.classList.toggle('forecast',isForecastMonth());
  const hasSubcats=getRows().some(r=>r.parentId);
  const eb=document.getElementById('expand-btn'), cb2=document.getElementById('collapse-btn');
  if(eb) eb.style.display=hasSubcats?'':'none';
  if(cb2) cb2.style.display=hasSubcats?'':'none';
  (function(){
    const el=document.getElementById('del-col-items'); if(!el) return;
    el.innerHTML='';
    const cols=getCols(); if(cols.length<=1) return;
    const sep=document.createElement('hr'); sep.style.cssText='margin:.3rem 0;border:none;border-top:1px solid var(--panel-border);';
    el.appendChild(sep);
    cols.forEach(function(col){
      const btn=document.createElement('button');
      btn.textContent='× '+col.label;
      btn.addEventListener('click',function(){ deleteCol(col.id); });
      el.appendChild(btn);
    });
  })();
  requestAnimationFrame(function(){window.scrollTo(0,_sy);});
}

function renderMobileCards(){
  const container=document.getElementById('inc-mobile-cards');
  if(!container) return;
  container.innerHTML='';
  const cols=getCols();

  function buildCard(row){
    const isChild=!!row.parentId;
    const hasKids=hasChildren(row.id);
    const canEdit=!hasKids;
    const isExpanded=_expandedCardId===row.id;
    const cur=rowCurrency(currentMK(),row.id);

    const card=document.createElement('div');
    card.className='mc-card'+(isChild?' mc-child':'')+(isExpanded?' mc-active':'');
    card.dataset.rowId=row.id;
    if(row.color) card.style.backgroundColor=row.color;
    if(row.textColor) card.style.setProperty('--row-text',row.textColor);

    const top=document.createElement('div');
    top.className='mc-top'+(isExpanded?'':' mc-top-only');

    const drag=document.createElement('span');drag.className='mc-drag';drag.textContent='⠿';drag.setAttribute('aria-label','Drag to reorder');
    top.appendChild(drag);

    const main=document.createElement('div');main.className='mc-main';
    const hdr=document.createElement('div');hdr.className='mc-hdr';

    const nameEl=document.createElement('span');nameEl.className='mc-name';nameEl.textContent=row.label;
    if(row.textColor) nameEl.style.color=row.textColor;
    hdr.appendChild(nameEl);

    const totalEl=document.createElement('span');totalEl.className='mc-total';totalEl.textContent=fmt(rowTotal(row.id));hdr.appendChild(totalEl);

    const gear=document.createElement('button');gear.className='mc-gear';gear.textContent='⚙';gear.setAttribute('aria-label','Row options');
    gear.addEventListener('click',e=>{e.stopPropagation();_openGearMenu(gear,row,card,null,null,isChild);});
    hdr.appendChild(gear);
    main.appendChild(hdr);

    const weeksEl=document.createElement('div');weeksEl.className='mc-weeks';
    cols.forEach(col=>{
      const wk=document.createElement('div');wk.className='mc-wk';
      const lbl=document.createElement('div');lbl.className='mc-wl';lbl.textContent=col.label;
      const v=hasKids?children(row.id).reduce((s,c)=>s+getCell(c.id,col.id),0):getCell(row.id,col.id);
      const val=document.createElement('div');val.className='mc-wv'+(v===0?' mc-wv-empty':'');
      val.textContent=v>0?fmt(v):'-';
      wk.appendChild(lbl);wk.appendChild(val);
      if(v>0&&!hasKids){const cc=document.createElement('div');cc.className='mc-wc';cc.textContent=cur;wk.appendChild(cc);}
      weeksEl.appendChild(wk);
    });
    main.appendChild(weeksEl);

    const hint=document.createElement('div');
    if(!canEdit){
      hint.className='mc-hint-subs';hint.textContent='edit via subcategories below';
    } else {
      hint.className='mc-hint-edit';hint.textContent='tap to edit ✏️';
      card.style.cursor='pointer';
      card.addEventListener('click',e=>{
        if(e.target.closest('.mc-gear')) return;
        if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
        _expandedCardId=isExpanded?null:row.id;
        renderMobileCards();
      });
    }
    main.appendChild(hint);
    top.appendChild(main);
    card.appendChild(top);

    if(isExpanded){
      const form=document.createElement('div');form.className='mc-form';
      form.addEventListener('click',e=>e.stopPropagation());
      const grid=document.createElement('div');grid.className='mc-form-grid';
      const inputs=[];
      const codes=getAllUsedCurrencies();
      if(!codes.includes(cur)) codes.push(cur);
      cols.forEach(col=>{
        const ef=document.createElement('div');ef.className='mc-ef';
        const lbl=document.createElement('div');lbl.className='mc-el';lbl.textContent=col.label;
        const er=document.createElement('div');er.className='mc-er';
        const inp=document.createElement('input');inp.type='number';inp.inputMode='decimal';inp.className='mc-ei';
        inp.value=getRawCell(row.id,col.id)||'';
        const sel=document.createElement('select');sel.className='mc-ec';
        codes.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;if(c===cur)o.selected=true;sel.appendChild(o);});
        er.appendChild(inp);er.appendChild(sel);
        inputs.push({inp,sel,col});
        ef.appendChild(lbl);ef.appendChild(er);grid.appendChild(ef);
      });
      form.appendChild(grid);
      const btns=document.createElement('div');btns.className='mc-ebtns';
      const cancelBtn=document.createElement('button');cancelBtn.className='mc-ecancel';cancelBtn.textContent='Cancel';
      cancelBtn.addEventListener('click',e=>{e.stopPropagation();_expandedCardId=null;renderMobileCards();});
      const saveBtn=document.createElement('button');saveBtn.className='mc-esave';saveBtn.textContent='Save';
      saveBtn.addEventListener('click',e=>{
        e.stopPropagation();
        snapshot();
        const newCur=inputs[0].sel.value;
        setRowCurrency(currentMK(),row.id,newCur);
        inputs.forEach(({inp,col})=>{
          const v=inp.value.trim();
          if(v===''||isNaN(parseFloat(v))) delete state.cells[ck(row.id,col.id)];
          else state.cells[ck(row.id,col.id)]=v;
        });
        _expandedCardId=null;
        save();
        ensureRate(newCur).then(()=>render());
      });
      btns.appendChild(cancelBtn);btns.appendChild(saveBtn);form.appendChild(btns);
      card.appendChild(form);
      setTimeout(()=>{ const first=form.querySelector('.mc-ei'); if(first) first.focus(); },50);
    }

    container.appendChild(card);
  }

  getRows().filter(r=>!r.parentId).forEach(row=>{
    buildCard(row);
    if(!isCollapsed(row.id)) children(row.id).forEach(buildCard);
  });

  if(_expandedCardId){
    container.querySelectorAll('.mc-card').forEach(c=>{
      if(c.dataset.rowId!==_expandedCardId) c.classList.add('mc-dim');
    });
  }
}


function adjustBodyWidth(){
  // Centring is handled in CSS: the wider .app-canvas.canvas-wide column is centred in the
  // viewport (margin:0 auto) and the table is centred inside it (margin-inline:auto), and the
  // .sheet-wrap scrolls horizontally when the table is genuinely wider than that column.
  // We no longer shrink-wrap the <body> to the table — because the body sits to the right of
  // the fixed sidebar (margin:0), sizing it to the table jammed the whole block to the left
  // with dead space on the right, and capped tables couldn't scroll. Clear any stale inline cap.
  document.body.style.maxWidth='';
}
window.addEventListener('resize',adjustBodyWidth);
let _resizeRenderTimer=null;
let _lastRenderW=window.innerWidth;
window.addEventListener('resize',()=>{
  // Only re-render when WIDTH changes (keyboard open/close only changes height — re-rendering
  // on height-only resize destroys the focused input and closes the keyboard immediately).
  const w=window.innerWidth;
  if(w===_lastRenderW) return;
  _lastRenderW=w;
  clearTimeout(_resizeRenderTimer);
  _resizeRenderTimer=setTimeout(()=>render(),300);
});


function expPad(s,n){ s=String(s); return s.length>=n?s:s+' '.repeat(n-s.length); }
function expCsvEsc(v){
  let s=String(v==null?'':v);
  // Formula-injection guard: a leading quote neutralizes spreadsheet formula triggers
  // (=,+,-,@, tab, CR) in free-text cells. Skipped when the cell is a genuine number
  // (e.g. "-50.00") so legitimate negative amounts aren't corrupted.
  if(/^[=+\-@\t\r]/.test(s)&&isNaN(Number(s))) s="'"+s;
  return /[,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}

function buildRowsArray(){
  const colLabels=getCols().map(c=>c.label);
  const header=['Source','Sub-source',...colLabels,'Total'];
  const out=[header];
  getRows().filter(r=>!r.parentId).forEach(parent=>{
    const kids=children(parent.id);
    if(kids.length){
      const vals=getCols().map(col=>{
        const s=kids.reduce((t,c)=>t+getCell(c.id,col.id),0);
        return s?s.toFixed(2):'';
      });
      out.push([parent.label,'',...vals,rowTotal(parent.id).toFixed(2)]);
      kids.forEach(kid=>{
        const kVals=getCols().map(col=>{ const v=getCell(kid.id,col.id); return v?v.toFixed(2):''; });
        out.push(['',kid.label,...kVals,rowTotal(kid.id).toFixed(2)]);
      });
    } else {
      const vals=getCols().map(col=>{ const v=getCell(parent.id,col.id); return v?v.toFixed(2):''; });
      out.push([parent.label,'',...vals,rowTotal(parent.id).toFixed(2)]);
    }
  });
  const totals=getCols().map(col=>colTotal(col.id).toFixed(2));
  out.push(['TOTAL','',...totals,grandTotal().toFixed(2)]);
  return out;
}

function buildCsv(){
  return buildRowsArray().map(r=>r.map(expCsvEsc).join(',')).join('\r\n');
}
function buildJson(){
  const mk2=currentMK();
  const topRows=getRows().filter(r=>!r.parentId);
  const rowsOut=topRows.map(parent=>{
    const kids=children(parent.id);
    const colVals={};
    getCols().forEach(col=>{ colVals[col.label]=getCell(parent.id,col.id)||undefined; });
    return {
      label:parent.label,color:parent.color,textColor:parent.textColor,
      total:rowTotal(parent.id),amounts:colVals,
      subsources:kids.map(kid=>{
        const kv={};
        getCols().forEach(col=>{ kv[col.label]=getCell(kid.id,col.id)||undefined; });
        return {label:kid.label,total:rowTotal(kid.id),amounts:kv};
      })
    };
  });
  return JSON.stringify({
    month:mk2,
    monthName:MONTHS_FULL[state.currentMonth]+' '+state.currentYear,
    columns:getCols().map(c=>c.label),
    rows:rowsOut,
    totals:{grand:grandTotal(),perColumn:Object.fromEntries(getCols().map(col=>[col.label,colTotal(col.id)]))}
  },null,2);
}
function buildTxt(){
  const rows=buildRowsArray();
  const widths=rows[0].map((_,ci)=>Math.max(...rows.map(r=>String(r[ci]||'').length)));
  const sep=widths.map(w=>'-'.repeat(w+2)).join('+');
  return rows.map((r,ri)=>{
    const line='|'+r.map((v,ci)=>' '+expPad(v,widths[ci])+' ').join('|')+'|';
    return ri===0||ri===rows.length-1?sep+'\n'+line+'\n'+sep:line;
  }).join('\n');
}
function buildTsv(){
  return buildRowsArray()
    .map(r=>r.map(v=>String(v==null?'':v).replace(/[\t\r\n]/g,' ')).join('\t'))
    .join('\r\n');
}

function gmailHref(subject, body){
  return 'https://mail.google.com/mail/?view=cm&fs=1&tf=1'
       + '&su='+encodeURIComponent(subject)
       + '&body='+encodeURIComponent(body);
}

function clipboardWrite(text){
  if(navigator.clipboard){
    return navigator.clipboard.writeText(text).then(()=>true).catch(()=>fallback());
  }
  return Promise.resolve(fallback());
  function fallback(){
    const tmp=document.createElement('textarea');
    tmp.value=text;tmp.style.position='fixed';tmp.style.opacity='0';
    document.body.appendChild(tmp);tmp.select();
    let ok=false;try{ok=document.execCommand('copy');}catch{}
    tmp.remove();return ok;
  }
}

function showExportFlash(msg){
  const f=document.getElementById('export-flash');if(!f) return;
  f.textContent=msg;f.classList.add('show');
  clearTimeout(window._exportFlashT);
  window._exportFlashT=setTimeout(()=>f.classList.remove('show'),2500);
}



function encodeBlob(obj){
  return 'FIAPP-'+obj.kind+'-V1:'+btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function decodeBlob(str){
  const m=String(str).trim().match(/^FIAPP-([A-Z\-]+)-V1:([A-Za-z0-9+/=]+)\s*$/);
  if(!m) throw new Error('Not a FiApp paste-blob.');
  let obj;
  try{ obj=JSON.parse(decodeURIComponent(escape(atob(m[2])))); }
  catch(e){ throw new Error('Blob is corrupted or incomplete - could not decode.'); }
  if(typeof obj!=='object'||obj===null) throw new Error('Invalid blob: unexpected format.');
  if(obj.kind!==m[1]) throw new Error('Blob kind mismatch.');
  if(!Array.isArray(obj.rows)) throw new Error('Invalid blob: missing rows array.');
  if(!Array.isArray(obj.cols)) throw new Error('Invalid blob: missing cols array.');
  if(obj.kind==='INC-MONTH'){
    if(typeof obj.cells!=='object'||Array.isArray(obj.cells)) throw new Error('Invalid blob: bad cells object.');
    if(typeof obj.monthKey!=='string') throw new Error('Invalid blob: missing monthKey.');
  }
  if(obj.kind==='INC-FULL'){
    if(typeof obj.cellsByMonth!=='object'||Array.isArray(obj.cellsByMonth)) throw new Error('Invalid blob: bad cellsByMonth.');
  }
  if(obj.rows.length>500)  throw new Error('Blob rejected: too many rows (max 500).');
  if(obj.cols.length>52)   throw new Error('Blob rejected: too many columns (max 52).');
  if(obj.kind==='INC-FULL'){
    let totalCells=0;
    Object.values(obj.cellsByMonth).forEach(mc=>{ if(mc&&typeof mc==='object') totalCells+=Object.keys(mc).length; });
    if(totalCells>50000) throw new Error('Blob rejected: too many cells (max 50,000).');
    if(Object.keys(obj.cellsByMonth).length>120) throw new Error('Blob rejected: too many months (max 120).');
  } else if(obj.cells){
    if(Object.keys(obj.cells).length>50000) throw new Error('Blob rejected: too many cells (max 50,000).');
  }
  return obj;
}

function buildIncMonthBlob(){
  const mk2=currentMK();
  const cells={};
  Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|')) cells[k]=state.cells[k]; });
  const rowCurrencies={};
  Object.keys(state.monthRowCurrencies||{}).forEach(k=>{ if(k.startsWith(mk2+'|')) rowCurrencies[k]=state.monthRowCurrencies[k]; });
  const rowsByMonth={}; if(state.rowsByMonth&&state.rowsByMonth[mk2]) rowsByMonth[mk2]=JSON.parse(JSON.stringify(state.rowsByMonth[mk2]));
  const colsByMonth={}; if(state.colsByMonth&&state.colsByMonth[mk2]) colsByMonth[mk2]=JSON.parse(JSON.stringify(state.colsByMonth[mk2]));
  return {
    kind:'INC-MONTH', v:1, monthKey:mk2,
    rows:JSON.parse(JSON.stringify(getRows())),
    cols:JSON.parse(JSON.stringify(getCols())),
    rowsByMonth, colsByMonth,
    cells,
    rowCurrencies,
    headerColWidth:state.headerColWidth, totalColWidth:state.totalColWidth,
  };
}
function buildIncFullBlob(){
  const cellsByMonth={};
  Object.keys(state.cells).forEach(k=>{
    const mk2=k.split('|')[0];
    (cellsByMonth[mk2]=cellsByMonth[mk2]||{})[k]=state.cells[k];
  });
  return {
    kind:'INC-FULL', v:1,
    rows:JSON.parse(JSON.stringify(state.rows)),
    cols:JSON.parse(JSON.stringify(state.cols)),
    rowsByMonth:JSON.parse(JSON.stringify(state.rowsByMonth||{})),
    colsByMonth:JSON.parse(JSON.stringify(state.colsByMonth||{})),
    cellsByMonth,
    collapsed:JSON.parse(JSON.stringify(state.collapsed||{})),
    rowCurrencies:JSON.parse(JSON.stringify(state.monthRowCurrencies||{})),
    displayCurrency:state.displayCurrency||'USD',
    headerColWidth:state.headerColWidth, totalColWidth:state.totalColWidth,
    currentYear:state.currentYear, currentMonth:state.currentMonth,
  };
}

function _mergeRowsCols(blobRows, blobCols){
  const labelToId={};
  state.rows.forEach(r=>{ if(!r.parentId) labelToId[r.label]=r.id; });
  const childKeyToId={};
  state.rows.forEach(r=>{
    if(r.parentId){
      const parent=state.rows.find(x=>x.id===r.parentId);
      if(parent) childKeyToId[parent.label+'|'+r.label]=r.id;
    }
  });
  const blobRowIdMap={};
  blobRows.filter(r=>!r.parentId).forEach(br=>{
    if(labelToId[br.label]){
      blobRowIdMap[br.id]=labelToId[br.label];
    } else {
      const newId=uid();
      const nr=Object.assign({},br,{id:newId});
      state.rows.push(nr);
      blobRowIdMap[br.id]=newId;
      labelToId[br.label]=newId;
    }
  });
  blobRows.filter(r=>r.parentId).forEach(br=>{
    const blobParent=blobRows.find(p=>p.id===br.parentId);
    const parentLabel=blobParent?blobParent.label:'';
    const localParentId=blobRowIdMap[br.parentId];
    const key=parentLabel+'|'+br.label;
    if(childKeyToId[key]){
      blobRowIdMap[br.id]=childKeyToId[key];
    } else {
      const newId=uid();
      const nr=Object.assign({},br,{id:newId,parentId:localParentId});
      const parentIdx=state.rows.findIndex(r=>r.id===localParentId);
      const lastKidIdx=state.rows.reduce((acc,r,i)=>r.parentId===localParentId?i:acc, parentIdx);
      state.rows.splice(lastKidIdx+1,0,nr);
      blobRowIdMap[br.id]=newId;
      childKeyToId[key]=newId;
    }
  });
  const colLblToId={};
  state.cols.forEach(c=>colLblToId[c.label]=c.id);
  const blobColIdMap={};
  blobCols.forEach(bc=>{
    if(colLblToId[bc.label]) blobColIdMap[bc.id]=colLblToId[bc.label];
    else {
      const newId=uid();
      const nc=Object.assign({},bc,{id:newId});
      state.cols.push(nc);
      blobColIdMap[bc.id]=newId;
      colLblToId[bc.label]=newId;
    }
  });
  return {blobRowIdMap, blobColIdMap};
}

function importIncMonth(blob){
  const mk2=currentMK();
  if(_isClosedMonth(mk2)){showToast('🔒 Month is locked.');return;}
  Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|')) delete state.cells[k]; });
  const {blobRowIdMap, blobColIdMap}=_mergeRowsCols(blob.rows||[], blob.cols||[]);
  Object.entries(blob.cells||{}).forEach(([k,v])=>{
    const parts=k.split('|');
    const rId=blobRowIdMap[parts[1]], cId=blobColIdMap[parts[2]];
    if(rId&&cId) state.cells[mk2+'|'+rId+'|'+cId]=v;
  });
  if(blob.rowsByMonth&&blob.rowsByMonth[blob.monthKey]){
    if(!state.rowsByMonth) state.rowsByMonth={};
    state.rowsByMonth[mk2]=JSON.parse(JSON.stringify(blob.rowsByMonth[blob.monthKey]));
  }
  if(blob.colsByMonth&&blob.colsByMonth[blob.monthKey]){
    if(!state.colsByMonth) state.colsByMonth={};
    state.colsByMonth[mk2]=JSON.parse(JSON.stringify(blob.colsByMonth[blob.monthKey]));
  }
}

function importIncFull(blob, selectedMonths){
  const {blobRowIdMap, blobColIdMap}=_mergeRowsCols(blob.rows||[], blob.cols||[]);
  if(blob.rowsByMonth){ if(!state.rowsByMonth) state.rowsByMonth={}; Object.assign(state.rowsByMonth, JSON.parse(JSON.stringify(blob.rowsByMonth))); }
  if(blob.colsByMonth){ if(!state.colsByMonth) state.colsByMonth={}; Object.assign(state.colsByMonth, JSON.parse(JSON.stringify(blob.colsByMonth))); }
  selectedMonths.forEach(mk2=>{
    Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|')) delete state.cells[k]; });
    const blobMonthCells=(blob.cellsByMonth||{})[mk2]||{};
    Object.entries(blobMonthCells).forEach(([k,v])=>{
      const parts=k.split('|');
      const rId=blobRowIdMap[parts[1]], cId=blobColIdMap[parts[2]];
      if(rId&&cId) state.cells[mk2+'|'+rId+'|'+cId]=v;
    });
  });
}


function openPasteModal(){
  const overlay=document.createElement('div');overlay.className='share-overlay';
  const modal=document.createElement('div');modal.className='share-modal';
  const h=document.createElement('h3');h.textContent='Paste FiApp income data';
  const desc=document.createElement('span');desc.className='share-hint';desc.textContent='Paste a FIAPP-INC-… block copied from another Income Tracker. Pastes are undoable with Ctrl+Z.';
  const ta=document.createElement('textarea');ta.placeholder='Paste FIAPP-INC-… block here';
  const status=document.createElement('div');status.className='paste-status';status.textContent='Waiting for input…';
  const actions=document.createElement('div');actions.className='share-actions';
  const applyBtn=document.createElement('button');applyBtn.className='btn btn-sm';applyBtn.textContent='Apply';applyBtn.disabled=true;
  const cancelBtn=document.createElement('button');cancelBtn.className='btn btn-sm btn-ghost';cancelBtn.textContent='Cancel';
  let parsed=null;
  function refresh(){
    const v=ta.value.trim();
    if(!v){ status.textContent='Waiting for input…'; status.className='paste-status'; applyBtn.disabled=true; parsed=null; return; }
    try{
      const obj=decodeBlob(v);
      parsed=obj;
      let label='';
      if(obj.kind==='INC-MONTH'){
        const [yy,mm]=obj.monthKey.split('-');
        label='This month - '+MONTHS_FULL[parseInt(mm,10)-1]+' '+yy;
      } else if(obj.kind==='INC-FULL'){
        const months=Object.keys(obj.cellsByMonth||{}).filter(k=>Object.keys(obj.cellsByMonth[k]).length).length;
        if(months===0){
          status.textContent='⚠ This blob has no month data - the income tracker was empty when it was copied.';
          status.className='paste-status bad';
          applyBtn.disabled=true;
          parsed=null;
          return;
        }
        label='Full data - '+months+' month'+(months===1?'':'s');
      } else {
        throw new Error('This blob is from a different tracker ('+obj.kind+'). Open the matching tracker page to paste it.');
      }
      status.textContent='Detected: '+label;status.className='paste-status ok';applyBtn.disabled=false;
    }catch(err){
      status.textContent='⚠ '+err.message+' Make sure you copied the entire FIAPP-… line.';
      status.className='paste-status bad';applyBtn.disabled=true;parsed=null;
    }
  }
  ta.addEventListener('input',refresh);
  ta.addEventListener('paste',()=>setTimeout(refresh,30));
  applyBtn.addEventListener('click',()=>{
    if(!parsed) return;
    if(parsed.kind==='INC-MONTH'){
      snapshot();importIncMonth(parsed);save();render();
      overlay.remove();showExportFlash('✓ Pasted (this month)');
    } else if(parsed.kind==='INC-FULL'){
      overlay.remove();showMonthPicker(parsed);
    }
  });
  cancelBtn.addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  actions.appendChild(applyBtn);actions.appendChild(cancelBtn);
  modal.appendChild(h);modal.appendChild(desc);modal.appendChild(ta);modal.appendChild(status);modal.appendChild(actions);
  overlay.appendChild(modal);document.body.appendChild(overlay);
  setTimeout(()=>ta.focus(),20);
}

function showMonthPicker(blob){
  const overlay=document.createElement('div');overlay.className='share-overlay';
  const modal=document.createElement('div');modal.className='share-modal';
  const h=document.createElement('h3');h.textContent='Choose months to overwrite';
  const desc=document.createElement('span');desc.className='share-hint';desc.textContent='Pick which months from the pasted blob to apply. Months you don\'t pick stay untouched.';
  const months=Object.keys(blob.cellsByMonth||{}).filter(k=>Object.keys(blob.cellsByMonth[k]).length).sort();
  const tools=document.createElement('div');tools.className='picker-tools';
  const allBtn=document.createElement('button');allBtn.textContent='All';
  const noneBtn=document.createElement('button');noneBtn.textContent='None';
  tools.appendChild(allBtn);tools.appendChild(noneBtn);
  const list=document.createElement('div');list.className='month-picker';
  const checks=[];
  months.forEach(mk2=>{
    const lbl=document.createElement('label');
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;cb.value=mk2;
    const [yy,mm]=mk2.split('-');
    const cellCount=Object.keys(blob.cellsByMonth[mk2]).length;
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' '+MONTHS_FULL[parseInt(mm,10)-1]+' '+yy+'   ('+cellCount+' values)'));
    list.appendChild(lbl);checks.push(cb);
  });
  allBtn.addEventListener('click',()=>checks.forEach(c=>c.checked=true));
  noneBtn.addEventListener('click',()=>checks.forEach(c=>c.checked=false));
  const actions=document.createElement('div');actions.className='share-actions';
  const applyBtn=document.createElement('button');applyBtn.className='btn btn-sm';applyBtn.textContent='Apply selected';
  const cancelBtn=document.createElement('button');cancelBtn.className='btn btn-sm btn-ghost';cancelBtn.textContent='Cancel';
  applyBtn.addEventListener('click',()=>{
    const sel=checks.filter(c=>c.checked).map(c=>c.value);
    if(!sel.length){ showToast('Pick at least one month, or click Cancel.'); return; }
    snapshot();importIncFull(blob,sel);save();render();
    overlay.remove();showExportFlash('✓ Pasted '+sel.length+' month'+(sel.length===1?'':'s'));
  });
  cancelBtn.addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  actions.appendChild(applyBtn);actions.appendChild(cancelBtn);
  modal.appendChild(h);modal.appendChild(desc);modal.appendChild(tools);modal.appendChild(list);modal.appendChild(actions);
  overlay.appendChild(modal);document.body.appendChild(overlay);
}

function downloadBlob(filename, blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function downloadText(filename, text, mime){
  downloadBlob(filename,new Blob([text],{type:mime||'text/plain;charset=utf-8'}));
}

let _xlsxLoaded=false,_xlsxLoading=null;
function lazyLoadXlsx(){
  if(_xlsxLoaded) return Promise.resolve();
  if(_xlsxLoading) return _xlsxLoading;
  _xlsxLoading=new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='/static/js/vendor/xlsx.full.min.js';
    s.onload=()=>{_xlsxLoaded=true;res();};
    s.onerror=()=>rej(new Error('Failed to load XLSX library'));
    document.head.appendChild(s);
  });
  return _xlsxLoading;
}
function exportXlsx(filename){
  lazyLoadXlsx().then(()=>{
    const ws=XLSX.utils.aoa_to_sheet(buildRowsArray());
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Income');
    XLSX.writeFile(wb,filename);
  }).catch(err=>showToast('Could not load XLSX library: '+err.message));
}

let _openExportMenu=null;
// Hover-to-open, click-to-select: the submenu opens on mouseenter and stays open while
// the pointer is over either the Export button or the submenu itself, closing shortly
// after the pointer leaves both - like a native nested menu, instead of requiring a
// click just to see the options.
let _exportCloseTimer=null;
function _cancelExportClose(){ if(_exportCloseTimer){clearTimeout(_exportCloseTimer);_exportCloseTimer=null;} }
function _scheduleExportClose(){ _exportCloseTimer=setTimeout(closeExportMenu,200); }
function closeExportMenu(){
  if(_openExportMenu){_openExportMenu.remove();_openExportMenu=null;}
  document.removeEventListener('click',closeExportMenu,true);
}
function showExportMenu(ev){
  ev.stopPropagation();
  if(_openExportMenu) return;
  const ym=String(state.currentYear)+'-'+String(state.currentMonth+1).padStart(2,'0');
  const base='income-'+ym;
  const menu=document.createElement('div');menu.className='export-menu';
  const formats=[
    {label:'📄 CSV',  fn:()=>downloadText(base+'.csv',buildCsv(),'text/csv;charset=utf-8')},
    {label:'{ } JSON',fn:()=>downloadText(base+'.json',buildJson(),'application/json')},
    {label:'📃 TXT',  fn:()=>downloadText(base+'.txt',buildTxt(),'text/plain;charset=utf-8')},
    {label:'📊 XLSX', fn:()=>exportXlsx(base+'.xlsx')},
    {label:'📋 Copy table - This month', fn:()=>clipboardWrite(encodeBlob(buildIncMonthBlob())).then(ok=>showExportFlash(ok?'✓ Copied (this month)':'Copy failed'))},
    {label:'📋 Copy table - Full data',  fn:()=>clipboardWrite(encodeBlob(buildIncFullBlob())).then(ok=>showExportFlash(ok?'✓ Copied (full)':'Copy failed'))},
  ];
  formats.forEach(f=>{
    const btn=document.createElement('button');btn.textContent=f.label;
    btn.addEventListener('click',e=>{e.stopPropagation();closeExportMenu();closeDropdown('dd-more');f.fn();});
    menu.appendChild(btn);
  });
  // Flyout beside the Export row itself, not up near the "..." toggle: the parent overflow
  // menu now stays open while this submenu is shown (hover-driven), so there's no reason
  // to anchor near the toggle anymore - that only made sense when opening Export used to
  // close the parent list out from under it. Anchor to the right edge of the parent menu,
  // vertically aligned with the Export row, like a native nested menu.
  const exportRect=document.getElementById('export-btn').getBoundingClientRect();
  const parentRect=document.getElementById('dd-more-menu').getBoundingClientRect();
  menu.style.top=exportRect.top+'px';
  menu.style.left=(parentRect.right+4)+'px';
  menu.addEventListener('mouseenter',_cancelExportClose);
  menu.addEventListener('mouseleave',_scheduleExportClose);
  document.body.appendChild(menu);
  _openExportMenu=menu;
  if(menu.getBoundingClientRect().right > window.innerWidth - 8){
    menu.style.left=Math.max(4, parentRect.left - menu.offsetWidth - 4)+'px';
  }
  if(menu.getBoundingClientRect().bottom > window.innerHeight - 8){
    menu.style.top=Math.max(4, window.innerHeight - menu.offsetHeight - 8)+'px';
  }
  setTimeout(()=>document.addEventListener('click',closeExportMenu,true),50);
}

async function shareSheet(){
  const text=buildTxt();
  const title='FiApp Income - '+MONTHS_SHORT[state.currentMonth]+' '+state.currentYear;
  const isMobile=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if(isMobile&&navigator.share){
    try{await navigator.share({title,text});return;}catch(e){if(e.name==='AbortError')return;}
  }
  showShareModal(title,text);
}
function showShareModal(title,text){
  const overlay=document.createElement('div');overlay.className='share-overlay';
  const modal=document.createElement('div');modal.className='share-modal';
  const h=document.createElement('h3');h.textContent='Share - '+title;
  const ta=document.createElement('textarea');ta.readOnly=true;ta.value=text;
  const hint=document.createElement('span');hint.className='share-hint';
  hint.textContent='Copy puts a tab-separated version on your clipboard - pastes cleanly into Word, Docs, Excel and Sheets.';

  const tsv=buildTsv();
  const MAX_BODY=1500;
  const bodyText=text.length>MAX_BODY?text.slice(0,MAX_BODY)+'\n…(truncated - use Export for full data)':text;

  const actions=document.createElement('div');actions.className='share-actions';
  const flash=document.createElement('span');flash.className='share-flash';

  const copyBtn=document.createElement('button');copyBtn.className='btn btn-sm';copyBtn.textContent='📋 Copy';
  copyBtn.addEventListener('click',()=>{
    clipboardWrite(tsv).then(ok=>{
      flash.textContent=ok?'Copied (TSV)!':'Copy failed';
      setTimeout(()=>flash.textContent='',1800);
    });
  });

  const emailTextBtn=document.createElement('a');emailTextBtn.className='btn btn-sm';emailTextBtn.textContent='📧 Email as Text';
  emailTextBtn.href=gmailHref(title,bodyText);emailTextBtn.target='_blank';emailTextBtn.rel='noopener noreferrer';

  const ym=String(state.currentYear)+'-'+String(state.currentMonth+1).padStart(2,'0');
  const xlsxBody='I\'m sharing my FiApp income spreadsheet. Open FiApp at https://fiapp.onrender.com/income to view your own data.\n\nAttached XLSX file (saved to your Downloads folder): income-'+ym+'.xlsx';
  const emailXlsxBtn=document.createElement('a');emailXlsxBtn.className='btn btn-sm';emailXlsxBtn.textContent='📧 Email as XLSX';
  emailXlsxBtn.href=gmailHref(title,xlsxBody);emailXlsxBtn.target='_blank';emailXlsxBtn.rel='noopener noreferrer';
  emailXlsxBtn.addEventListener('click',()=>{
    exportXlsx('income-'+ym+'.xlsx');
    flash.textContent='XLSX downloading - drag it into Gmail to attach.';
    setTimeout(()=>flash.textContent='',5000);
  });

  const blobStr=encodeBlob(buildIncMonthBlob());
  const blobBody='Here is my income data for '+MONTHS_SHORT[state.currentMonth]+' '+state.currentYear+'.\n\nPaste this block into the FiApp Income Tracker at https://fiapp.onrender.com/income using the 📋 Paste button to load the data:\n\n'+blobStr;
  const emailBlobBtn=document.createElement('a');emailBlobBtn.className='btn btn-sm';emailBlobBtn.textContent='📧 Email as FiApp Paste-link';
  emailBlobBtn.href=gmailHref(title,blobBody.slice(0,2000));emailBlobBtn.target='_blank';emailBlobBtn.rel='noopener noreferrer';

  const closeBtn=document.createElement('button');closeBtn.className='btn btn-sm btn-ghost';closeBtn.textContent='Close';
  closeBtn.addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});

  actions.appendChild(flash);actions.appendChild(copyBtn);actions.appendChild(emailTextBtn);actions.appendChild(emailXlsxBtn);actions.appendChild(emailBlobBtn);
  actions.appendChild(closeBtn);
  modal.appendChild(h);modal.appendChild(ta);modal.appendChild(hint);modal.appendChild(actions);
  overlay.appendChild(modal);document.body.appendChild(overlay);
}


(()=>{
  const tip=document.createElement('div');tip.id='swatch-tip';document.body.appendChild(tip);
  document.addEventListener('mouseover',e=>{
    const host=e.target.closest('.tip-host[data-tip]');
    if(!host||!host.closest('.rh-inner')){tip.classList.remove('show');return;}
    tip.textContent=host.dataset.tip;
    const r=host.getBoundingClientRect();
    tip.style.left=(r.left+r.width/2)+'px';
    tip.style.top=(r.top-8)+'px';
    tip.style.transform='translate(-50%,-100%)';
    tip.classList.add('show');
  });
  document.addEventListener('mouseout',e=>{
    const host=e.target.closest('.tip-host[data-tip]');
    if(host&&host.closest('.rh-inner')) tip.classList.remove('show');
  });
  document.addEventListener('touchstart',e=>{
    const host=e.target.closest('.tip-host[data-tip]');
    if(!host||!host.closest('.rh-inner')){tip.classList.remove('show');return;}
    tip.textContent=host.dataset.tip;
    const r=host.getBoundingClientRect();
    tip.style.left=(r.left+r.width/2)+'px';
    tip.style.top=(r.top-8)+'px';
    tip.style.transform='translate(-50%,-100%)';
    tip.classList.add('show');
  },{passive:true});
  document.addEventListener('touchend',e=>{
    setTimeout(()=>{ tip.classList.remove('show'); },600);
  },{passive:true});
})();

function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function _esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}

(async()=>{
  // Local-first: render whatever this device already has BEFORE any network I/O,
  // so a dead or stalled connection can never blank the tracker.
  try{ state=loadState(); }catch(e){ console.warn('FiApp: loadState failed',e); state=freshState(); }
  try{ _monthsWithDataAtLoad=new Set(Object.keys(state.cells||{}).filter(k=>parseFloat(state.cells[k])>0).map(k=>k.split('|')[0])); }catch(e){ _monthsWithDataAtLoad=new Set(); }
  try{ loadHistory(); }catch(e){}
  try{ updateHistBtns(); }catch(e){}
  try{ updateMonthNav(); }catch(e){ console.error('FiApp: updateMonthNav failed',e); }

  // Non-blocking on purpose: rate fetches must never delay first render (a
  // stalled network would otherwise blank the tracker for up to 15s). The
  // .then callbacks update the note / re-render when rates arrive.
  function _initCurrencyUI(){
    const dc=state.displayCurrency||'USD';
    const dcSel=document.getElementById('curr-sel');
    if(dc!=='USD'&&dcSel){
      if(![...dcSel.options].find(o=>o.value===dc)){
        const opt=document.createElement('option'); opt.value=dc; opt.textContent=dc; opt.dataset.custom='1';
        dcSel.insertBefore(opt, dcSel.querySelector('option[value="__other__"]'));
      }
      dcSel.value=dc;
      ensureRate(dc).then(()=>{
        if(ratesCache[dc]){
          const cn=document.getElementById('curr-note'); if(cn) cn.textContent='1 USD = '+ratesCache[dc].toFixed(4)+' '+dc+_staleNote();
          showConvFields(dc,ratesCache[dc]);
        }
      }).catch(()=>{});
    }
  }
  try{ _initCurrencyUI(); }catch(e){ console.warn('FiApp: currency init failed',e); }
  try{
    const usedCurs=[...new Set(Object.values(state.monthRowCurrencies||{}).filter(c=>c&&c!=='USD'))];
    // Re-render once rates land so non-USD rows show converted values.
    if(usedCurs.length) fetchAndCacheUSDRates().then(()=>{ try{ render(); }catch(_){} }).catch(()=>{});
  }catch(e){}
  try{ render(); }catch(e){ console.error('FiApp: render failed',e); }
  // D (Playful): one-off, dismissable orientation tip, once per session. No-op for
  // Default/Quiet (gated inside fiappMascotTip) and skipped while the walkthrough runs.
  try{ if(window.fiappMascotTip && !(typeof isWalkthroughActive==='function'&&isWalkthroughActive())) fiappMascotTip('Tip: income is tracked per month too. Use the month picker up top to switch.','inc-tip'); }catch(_){}

  // Background: establish auth (bounded), refresh from the server, re-render on change.
  try{
    const me=await window.fiappFetchTimeout('/auth/me',5000).then(r=>r.json());
    window.__currentUser=me.username||null;
    const badge=document.getElementById('auth-badge-container');
    if(badge){
      if(me.username){
        badge.innerHTML='<div class="acct-menu-wrap">'
          +'<button class="btn-ghost btn-sm" id="dyn-acct-menu-btn">👤 '+_esc(me.username)+'</button>'
          +'<div class="acct-dropdown">'
          +'<a href="/account" class="acct-item">⚙ Account settings</a>'
          +'<button class="acct-item acct-logout" id="dyn-logout-btn">⬅ Log out</button>'
          +'</div>'
          +'</div>';
        var _dynAcct=document.getElementById('dyn-acct-menu-btn');
        if(_dynAcct) _dynAcct.addEventListener('click',function(e){toggleAcctMenu(e.currentTarget);});
        var _dynLogout=document.getElementById('dyn-logout-btn');
        if(_dynLogout) _dynLogout.addEventListener('click',function(e){logOutStep(e.currentTarget);});
      } else {
        badge.innerHTML='<a class="btn-ghost btn-sm" href="/login">Log in</a>';
      }
    }
  }catch(e){ window.__currentUser=null; }
  if(!window.__currentUser) setSyncStatus('Offline','');

  const _preRaw=localStorage.getItem(STORAGE_KEY);
  try{ await loadFromServer(); }catch(e){ console.warn('FiApp: loadFromServer failed',e); }
  // JSONB round-trips reorder object keys, so raw strings can differ even when the
  // data is identical; compare semantically (_deepEqual is a tracker-sync.js global)
  // so a plain online load doesn't force a focus-destroying cosmetic re-render.
  const _blobChanged=(pre,key)=>{
    const post=localStorage.getItem(key);
    if(post===pre) return false;
    try{ return !_deepEqual(JSON.parse(pre||'null'),JSON.parse(post||'null')); }catch(_){ return true; }
  };
  if(_blobChanged(_preRaw,STORAGE_KEY)){
    try{ state=loadState(); }catch(e){}
    try{ _monthsWithDataAtLoad=new Set(Object.keys(state.cells||{}).filter(k=>parseFloat(state.cells[k])>0).map(k=>k.split('|')[0])); }catch(e){ _monthsWithDataAtLoad=new Set(); }
    try{ updateMonthNav(); }catch(e){}
    try{ _initCurrencyUI(); }catch(e){}
    try{
      const usedCurs=[...new Set(Object.values(state.monthRowCurrencies||{}).filter(c=>c&&c!=='USD'))];
      // Server sync can introduce new non-USD row currencies; fetch rates for them
      // (no-op when the full USD table is already cached this session).
      if(usedCurs.length) fetchAndCacheUSDRates().then(()=>{ try{ render(); }catch(_){} }).catch(()=>{});
    }catch(e){}
    try{ render(); }catch(e){ console.error('FiApp: render failed',e); }
  }
})();

function openHelp(){ document.getElementById('help-modal').style.display='flex'; }
function closeHelp(){ document.getElementById('help-modal').style.display='none'; }
function toggleDropdown(id, e){
  e && e.stopPropagation();
  const wrap = document.getElementById(id);
  const menu = document.getElementById(id+'-menu');
  const isOpen = menu.classList.contains('open');
  // "Copy to" (#dd-copy-to) nests inside the "..." overflow menu (#dd-more-menu) so it can
  // sit alongside the other copy actions. Its menu is position:absolute relative to its own
  // #dd-copy-to wrapper, so if the ancestor dd-more-menu were closed (display:none) here,
  // the nested menu would render invisible even with .open set. Skip closing any open menu
  // that is itself an ancestor of the dropdown being toggled.
  document.querySelectorAll('.dropdown-menu.open').forEach(m=>{ if(!wrap || !m.contains(wrap)) m.classList.remove('open'); });
  if(!isOpen) menu.classList.add('open');
}
function closeDropdown(id){ document.getElementById(id+'-menu').classList.remove('open'); }
document.addEventListener('click', ()=>{ document.querySelectorAll('.dropdown-menu.open').forEach(m=>m.classList.remove('open')); });
document.addEventListener('keydown',function(e){ if(e.key==='Escape') document.querySelectorAll('.dropdown-menu.open').forEach(function(m){m.classList.remove('open');}); });

// Batch D Wave 4: mobile quick-add sheet. Income's grid isn't a fixed weekly layout
// like expenses (columns vary per row set), so the target is simply that row's first
// column, written additively in the row's own currency (no cross-currency conversion -
// the amount typed is assumed to already be in that row's set currency).
function openQuickAdd(){
  var sheet=document.getElementById('qa-sheet');
  var backdrop=document.getElementById('qa-backdrop');
  if(!sheet||!backdrop) return;
  var chips=document.getElementById('qa-chips');
  chips.innerHTML='';
  // Offer every directly-editable (leaf) source: childless top-level rows AND subcategories.
  // A parent that has subcategories is excluded because its cell is a computed sum of its
  // children. Subcategories are labelled "Parent > Child" so they read distinctly.
  var _qaRows=getRows();
  _qaRows.filter(function(r){ return !hasChildren(r.id); }).forEach(function(row,i){
    var label=row.label;
    if(row.parentId){ var p=_qaRows.find(function(x){return x.id===row.parentId;}); if(p) label=p.label+' › '+row.label; }
    var chip=document.createElement('button');
    chip.type='button'; chip.className='qa-chip'+(i===0?' selected':'');
    chip.textContent=label; chip.dataset.rowId=row.id;
    chip.addEventListener('click',function(){
      chips.querySelectorAll('.qa-chip').forEach(function(c){c.classList.remove('selected');});
      chip.classList.add('selected');
    });
    chips.appendChild(chip);
  });
  document.getElementById('qa-amount').value='';
  _qaSetSign('add'); // always reopen in Add mode - Subtract never carries over between uses
  backdrop.classList.add('open'); sheet.classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(function(){ var a=document.getElementById('qa-amount'); if(a) a.focus(); },50);
}
function closeQuickAdd(){
  var sheet=document.getElementById('qa-sheet');
  var backdrop=document.getElementById('qa-backdrop');
  if(sheet) sheet.classList.remove('open');
  if(backdrop) backdrop.classList.remove('open');
  document.body.style.overflow='';
}
// The quick-add FAB's only mode used to be "add to this cell" - there was no
// mobile-friendly way to record a correction without opening the row and doing the
// subtraction by hand. This toggle picks the sign; the amount you type is always
// entered as a positive magnitude.
function _qaSetSign(sign){
  var addBtn=document.getElementById('qa-sign-add'), subBtn=document.getElementById('qa-sign-sub');
  if(!addBtn||!subBtn) return;
  addBtn.classList.toggle('selected',sign==='add');
  subBtn.classList.toggle('selected',sign==='sub');
}
function _qaSign(){
  var subBtn=document.getElementById('qa-sign-sub');
  return (subBtn&&subBtn.classList.contains('selected'))?'sub':'add';
}
function saveQuickAdd(){
  var amt=parseFloat(document.getElementById('qa-amount').value);
  if(!amt||amt<=0) return;
  var chip=document.querySelector('.qa-chip.selected');
  if(!chip) return;
  var col=getCols()[0];
  if(!col) return;
  if(_isClosedMonth(currentMK())){ showToast('🔒 Month is locked.'); closeQuickAdd(); return; }
  snapshot();
  var key=ck(chip.dataset.rowId,col.id);
  var existing=parseFloat(state.cells[key])||0;
  var next=_qaSign()==='sub'?Math.max(0,existing-amt):existing+amt;
  if(next===0) delete state.cells[key]; else state.cells[key]=next.toFixed(2);
  save(); render();
  closeQuickAdd();
}
(function(){
  var openBtn=document.getElementById('qa-open-btn');
  if(openBtn) openBtn.addEventListener('click',function(){
    if(window.innerWidth<640){ openQuickAdd(); return; }
    // Desktop already shows the whole spreadsheet - every cell is already one click
    // away, so there's nothing to "jump to". The genuinely new action here is a new
    // income source row (same as the overflow menu's "Add row").
    addRow();
    var wrap=document.getElementById('inc-sheet-wrap');
    if(wrap) wrap.scrollIntoView({behavior:'smooth',block:'end'});
    var rows=getRows().filter(function(r){return !r.parentId;});
    var newRow=rows[rows.length-1];
    if(newRow){
      setTimeout(function(){
        var tr=document.querySelector('[data-tr-row-id="'+newRow.id+'"]');
        var label=tr&&tr.querySelector('.row-label');
        if(label){ label.focus(); if(label.select) label.select(); }
      },350);
    }
  });
  var fab=document.getElementById('add-fab');
  if(fab) fab.addEventListener('click',openQuickAdd);
  var cancelBtn=document.getElementById('qa-cancel-btn');
  if(cancelBtn) cancelBtn.addEventListener('click',closeQuickAdd);
  var saveBtn=document.getElementById('qa-save-btn');
  if(saveBtn) saveBtn.addEventListener('click',saveQuickAdd);
  var backdrop=document.getElementById('qa-backdrop');
  if(backdrop) backdrop.addEventListener('click',closeQuickAdd);
  var signAddBtn=document.getElementById('qa-sign-add'), signSubBtn=document.getElementById('qa-sign-sub');
  if(signAddBtn) signAddBtn.addEventListener('click',function(){ _qaSetSign('add'); });
  if(signSubBtn) signSubBtn.addEventListener('click',function(){ _qaSetSign('sub'); });
})();

(function(){var b=document.getElementById('close-modal-cancel');if(b)b.addEventListener('click',cancelClose);})();
(function(){var b=document.getElementById('close-modal-confirm');if(b)b.addEventListener('click',confirmClose);})();
// Static toolbar event wiring (replaces onclick= attributes)
document.getElementById('help-open-btn').addEventListener('click',openHelp);
document.getElementById('guide-btn').addEventListener('click',function(){wtStartEnhanced('income');});
document.getElementById('month-jump').addEventListener('change',function(){jumpToMonth(this.value);});
document.getElementById('curr-sel').addEventListener('change',onCurrencyChange);
document.getElementById('prev-btn').addEventListener('click',function(){shiftMonth(-1);});
document.getElementById('next-btn').addEventListener('click',function(){shiftMonth(1);});
document.getElementById('copy-prev-btn').addEventListener('click',function(){copyStructureFromPrevMonth();closeDropdown('dd-more');});
document.getElementById('copy-month-btn').addEventListener('click',function(){showMonthCopyPicker();closeDropdown('dd-more');});
document.getElementById('copy-to-toggle').addEventListener('click',function(e){openCopyToDropdown(e);});
document.getElementById('forecast-copy-last-btn').addEventListener('click',copyLastMonth);
document.getElementById('forecast-avg-btn').addEventListener('click',useAverages);
document.getElementById('curr-other-btn').addEventListener('click',applyOtherCurrency);
document.getElementById('undo-btn').addEventListener('click',undo);
document.getElementById('redo-btn').addEventListener('click',redo);
document.getElementById('more-menu-toggle').addEventListener('click',function(e){toggleDropdown('dd-more',e);});
document.getElementById('add-row-btn').addEventListener('click',function(){addRow();closeDropdown('dd-more');});
document.getElementById('add-col-btn').addEventListener('click',function(){addCol();closeDropdown('dd-more');});
document.getElementById('share-btn').addEventListener('click',function(){shareSheet();closeDropdown('dd-more');});
(function(){
  var exportBtn=document.getElementById('export-btn');
  exportBtn.addEventListener('mouseenter',function(e){ _cancelExportClose(); showExportMenu(e); });
  exportBtn.addEventListener('mouseleave',_scheduleExportClose);
  // Touch/keyboard fallback: hover events don't fire on tap, so a plain click still
  // opens the submenu (parent overflow menu is left open so the format list is
  // reachable - selecting a format closes both, see the click handler in showExportMenu).
  exportBtn.addEventListener('click',function(e){ if(!_openExportMenu) showExportMenu(e); });
})();
document.getElementById('paste-btn').addEventListener('click',function(){openPasteModal();closeDropdown('dd-more');});
document.getElementById('expand-btn').addEventListener('click',expandAll);
document.getElementById('collapse-btn').addEventListener('click',collapseAll);
document.getElementById('reset-btn').addEventListener('click',resetAll);
document.getElementById('chart-mode-m').addEventListener('click',function(){setChartMode('monthly');});
document.getElementById('chart-mode-y').addEventListener('click',function(){setChartMode('yearly');});
document.getElementById('chart-type-bar').addEventListener('click',function(){setChartType('bar');});
document.getElementById('chart-type-doughnut').addEventListener('click',function(){setChartType('doughnut');});
document.getElementById('help-modal').addEventListener('click',function(e){if(e.target===this)closeHelp();});
document.getElementById('help-close-btn').addEventListener('click',closeHelp);

// ── Voice Input Bridge ──────────────────────────────────────────────────
window._incVoiceBridge = {
  getRows, getCols, currentMK, snapshot, setCell, updateAll, render,
  addRow, forkCurrentMonth, deleteRow,
  addSubRow: function(parentRowId, subLabel) {
    var parentRow = getRows().find(function(r){ return r.id === parentRowId; });
    if (parentRow) addSubRow(parentRow, subLabel);
  },
  getCell: function(rId, cId) { return state.cells[currentMK()+'|'+rId+'|'+cId]; },
  setRowCurrency: function(rowId, cur) { setRowCurrency(currentMK(), rowId, cur); },
  rowCurrency:    function(rowId)      { return rowCurrency(currentMK(), rowId); },
  isLockedMonth:   function() { return _isClosedMonth(currentMK()); },
  isForecastMonth: function() { return isForecastMonth(); },
};

