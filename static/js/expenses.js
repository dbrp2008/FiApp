const STORAGE_KEY = 'fiapp_expenses_v4';
const UNDO_KEY    = 'fiapp_expenses_undo_v4';
const REDO_KEY    = 'fiapp_expenses_redo_v4';
const TAX_KEY     = 'fiapp_tax_result';
const PREFILL_KEY = 'fiapp_prefill_income';
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SUBS_KEY='fiapp_subs_v4';
const INCOME_KEY='fiapp_income_v1';
const INCOME_PUSH_KEY='fiapp_income_push_v1';
const expRatesCache={};
async function fetchExpRates(){
  if(Object.keys(expRatesCache).length) return;
  try{
    const obj=await fiappGetRates('USD');
    const rates=obj.rates;
    if(rates&&typeof rates==='object'&&!Array.isArray(rates)){
      Object.keys(rates).forEach(k=>{
        if(/^[A-Z]{2,5}$/.test(k)&&typeof rates[k]==='number') expRatesCache[k]=rates[k];
      });
    }
  }catch(e){ console.warn('FiApp: rate fetch failed -',e.message); }
}

const CATEGORIES = {
  'Groceries':    ['Fresh Produce','Dairy & Eggs','Meat & Seafood','Bakery','Frozen Foods','Snacks & Candy','Beverages','Household Supplies','Pet Supplies'],
  'Entertainment':['Streaming Services','Movies & Cinema','Concerts & Events','Sports Events','Video Games','Books & Magazines','Hobbies','Nightlife'],
  'Travel':       ['Flights','Hotels & Lodging','Car Rental','Public Transport','Fuel','Activities & Tours','Travel Insurance'],
  'Savings':      ['Emergency Fund','Retirement','Investments','Short-term Goals','Education Fund','Home Down Payment'],
  'Housing':      ['Rent / Mortgage','Property Tax','Home Insurance','Maintenance','HOA Fees','Furniture & Décor'],
  'Transport':    ['Car Payment','Car Insurance','Fuel','Parking','Public Transit','Ride-share'],
  'Healthcare':   ['Doctor Visits','Dental','Vision','Medication','Gym & Fitness','Mental Health','Health Insurance'],
  'Dining Out':   ['Restaurants','Fast Food','Coffee Shops','Food Delivery'],
  'Utilities':    ['Electricity','Water','Natural Gas','Internet','Phone','Cable TV'],
  'Shopping':     ['Clothing','Electronics','Home & Garden','Personal Care','Gifts'],
  'Education':    ['Tuition','Books & Supplies','Online Courses','Student Loans'],
  'Rent':         ['Monthly Rent','Security Deposit','Renters Insurance','Utilities Split'],
  'Food':         ['Groceries','Restaurants','Fast Food','Coffee Shops','Food Delivery','Snacks & Candy'],
  'Misc':         ['Personal Care','Gifts','Donations','Bank Fees','Laundry','Other'],
  'Equipment':    ['Computer & Laptop','Office Furniture','Tools & Machinery','Phone & Accessories','Repairs & Maintenance','Office Supplies'],
  'Software':     ['Design Tools','Productivity Apps','Cloud Storage','Accounting Software','Website & Hosting','Project Management'],
  'Marketing':    ['Social Media Ads','Website & SEO','Print Materials','Networking Events','Email Marketing','Branding & Design'],
  'Tax Set-Aside':['Federal Tax Reserve','State Tax Reserve','Self-Employment Tax','Quarterly Payments','Accountant Fees'],
  'Childcare':    ['Daycare','Babysitting','School Tuition','After-School Programs','Diapers & Supplies','Toys & Activities'],
  'Insurance':    ['Health Insurance','Life Insurance','Auto Insurance','Home Insurance','Disability Insurance','Umbrella Policy'],
};
const CAT_KEYS = Object.keys(CATEGORIES);
const CAT_COLORS = {
  'Groceries':'#bbf7d0','Entertainment':'#bfdbfe','Travel':'#fed7aa','Savings':'#e9d5ff',
  'Housing':'#fde68a','Transport':'#fecaca','Healthcare':'#d1fae5','Dining Out':'#fde8c8',
  'Utilities':'#d1fae5','Shopping':'#fce7f3','Education':'#ede9fe',
  'Rent':'#fde68a','Rent / Mortgage':'#fde68a',
  'Food':'#fde8c8','Subscriptions':'#a5f3fc','Misc':'#f1f5f9',
  'Equipment':'#dbeafe','Software':'#e0e7ff','Marketing':'#fbcfe8',
  'Tax Set-Aside':'#fee2e2','Childcare':'#fef9c3','Insurance':'#ccfbf1',
  'Books & Supplies':'#ddd6fe',
};
function uid(){ return '_'+Math.random().toString(36).slice(2,9); }


function freshState(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();
  return {
    rows:[],
    cols:[
      {id:uid(),label:'Week 1',width:120},
      {id:uid(),label:'Week 2',width:120},
      {id:uid(),label:'Week 3',width:120},
      {id:uid(),label:'Week 4',width:120},
    ],
    headerColWidth:185, totalColWidth:110,
    cells:{}, cellTimes:{}, income:{}, collapsed:{},
    currentYear:y, currentMonth:m,
    lastTaxTs:0,
    rowsByMonth:{}, colsByMonth:{},
    goals:{},
    recurringRules:[],
  };
}
function loadState(){
  try{
    if(isWalkthroughActive()){
      const fs=freshState();
      fs.rows=[
        {id:uid(),label:'Groceries',    color:'#bbf7d0',textColor:'#1f2937',height:36,parentId:null},
        {id:uid(),label:'Subscriptions',color:'#bfdbfe',textColor:'#1f2937',height:36,parentId:null,linked:'subscriptions'},
        {id:uid(),label:'Travel',       color:'#fed7aa',textColor:'#1f2937',height:36,parentId:null},
        {id:uid(),label:'Savings',      color:'#e9d5ff',textColor:'#1f2937',height:36,parentId:null},
      ];
      return fs;
    }
  }catch(_){}
  try{
    const r=localStorage.getItem(STORAGE_KEY);
    if(r){
      const s=JSON.parse(r);
      if(!s.cellTimes) s.cellTimes={};
      if(!s.income)    s.income={};
      if(!s.collapsed) s.collapsed={};
      if(!s.lastTaxTs) s.lastTaxTs=0;
      if(!Array.isArray(s.rows)) s.rows=freshState().rows;
      if(!Array.isArray(s.cols)) s.cols=freshState().cols;
      if(!s.rowsByMonth) s.rowsByMonth={};
      if(!s.colsByMonth) s.colsByMonth={};
      if(!s.goals) s.goals={};
      if(!Array.isArray(s.recurringRules)) s.recurringRules=[];
      delete s.cellCurrencies; delete s.displayCurrency;

      if(!s.rows.some(row=>row.linked==='subscriptions')){
        if(s.rows.length>0||localStorage.getItem('fiapp_template_dismissed')==='1'){
          s.rows.push({id:uid(),label:'Subscriptions',color:'#bfdbfe',textColor:'#1f2937',height:36,parentId:null,linked:'subscriptions'});
        }
      }
      // Older defaults (100/110) clip the "Week N" header; widen never-resized data columns.
      const _bumpCol=c=>{ if(c&&(c.width===100||c.width===110)) c.width=120; };
      (s.cols||[]).forEach(_bumpCol);
      Object.keys(s.colsByMonth||{}).forEach(mk2=>(s.colsByMonth[mk2]||[]).forEach(_bumpCol));
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
  set[currentMK()]=1;   // the viewed month always counts, even if still empty
  return Object.keys(set);
}
function _recOptsFor(rowId){
  return { existingMonths:_existingMonths(), isLocked:_isClosedMonth,
           getMonthTotal:function(mk2){ return _monthTotalForRow(rowId, mk2); } };
}
// Materialize an arbitrary month's rows/cols from the globals (forkCurrentMonth only does
// the current month). Idempotent.
function _ensureMonthForked(mk2){
  if(!state.rowsByMonth) state.rowsByMonth={};
  if(!state.colsByMonth) state.colsByMonth={};
  if(!state.rowsByMonth[mk2]) state.rowsByMonth[mk2]=(state.rows||[]).map(r=>({...r}));
  if(!state.colsByMonth[mk2]) state.colsByMonth[mk2]=(state.cols||[]).map(c=>({...c}));
}
// Write a rule's value into month mk2 for its row, honoring the rule's mode. Caller has
// already checked scope/lock/mismatch. Does not save().
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
}
// Fill a newly-materialized month with every non-draft rule in scope, but only where the
// row is still empty (never clobber existing data). This is what makes a later-created
// month inherit its recurring values automatically.
function _recFillNewMonth(mk2){
  if(_isClosedMonth(mk2)) return false;
  let wrote=false;
  _recRules().forEach(rule=>{
    if(rule.draft) return;
    if(!FiRecurring.monthInScope(rule, mk2)) return;
    if(_monthTotalForRow(rule.rowId, mk2)!==0) return;
    _recWriteMonth(rule, mk2); wrote=true;
  });
  return wrote;
}
// Set/clear row.recurring across the global rows and every month's copy (the badge follows
// the flag). Mirrors the old _showRecurringToast "Mark recurring" write.
function markRowRecurring(rowId, on){
  [state.rows].concat(Object.values(state.rowsByMonth||{})).forEach(arr=>{
    const r=(arr||[]).find(x=>x.id===rowId); if(r) r.recurring=!!on;
  });
}
function _recEligible(row, isChild){
  return !!row && !isChild && !row.linked && !row.snapshotLinkedRow && !hasChildren(row.id);
}
function _recMkLabel(mk2){
  const p=String(mk2||'').split('-'); if(p.length<2) return mk2||'';
  const d=new Date(Number(p[0]), Number(p[1])-1, 1);
  return d.toLocaleDateString(undefined,{month:'short',year:'numeric'});
}
// Unlock an arbitrary month (the existing reopenMonth() only reopens the current month).
function _recUnlockMonth(mk2){ if(state.closedMonths) delete state.closedMonths[mk2]; }

// ── Recurring config modal ──────────────────────────────────────────────────
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
  h.textContent='Recurring: '+(row.label||'Category'); m.panel.appendChild(h);

  // Amount
  const amtLbl=document.createElement('label'); amtLbl.style.cssText='display:block;font-size:.8rem;color:var(--muted);margin-bottom:1rem;';
  amtLbl.appendChild(document.createTextNode('Amount per month'));
  const amt=document.createElement('input'); amt.type='number'; amt.step='0.01'; amt.min='0'; amt.value=draft.amount||0;
  amt.style.cssText='display:block;width:100%;margin-top:.35rem;padding:.55rem;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg,var(--panel-bg));color:var(--fg);font-size:16px;box-sizing:border-box;';
  amtLbl.appendChild(amt); m.panel.appendChild(amtLbl);

  // Mode segmented toggle
  const modeLbl=document.createElement('div'); modeLbl.style.cssText='font-size:.8rem;color:var(--muted);margin-bottom:.35rem;'; modeLbl.textContent='Display'; m.panel.appendChild(modeLbl);
  const modeWrap=document.createElement('div'); modeWrap.style.cssText='display:flex;gap:.4rem;margin-bottom:1rem;';
  function segBtn(label,val,cur,onPick){
    const b=document.createElement('button'); b.type='button'; b.textContent=label;
    b.style.cssText='flex:1;padding:.5rem;border-radius:8px;border:1px solid var(--input-border);cursor:pointer;font-size:.85rem;background:'+(cur?'var(--accent)':'transparent')+';color:'+(cur?'#fff':'var(--fg)')+';';
    b.addEventListener('click',()=>onPick(val)); return b;
  }
  function renderModeBtns(){
    modeWrap.innerHTML='';
    modeWrap.appendChild(segBtn('Monthly (1 cell)','monthly',draft.mode==='monthly',pickMode));
    modeWrap.appendChild(segBtn('Weekly (4 cells)','weekly',draft.mode==='weekly',pickMode));
  }
  function pickMode(v){ draft.mode=v; renderModeBtns(); }
  renderModeBtns(); m.panel.appendChild(modeWrap);

  // Scope
  const scLbl=document.createElement('div'); scLbl.style.cssText='font-size:.8rem;color:var(--muted);margin-bottom:.35rem;'; scLbl.textContent='Applies to'; m.panel.appendChild(scLbl);
  const scWrap=document.createElement('div'); scWrap.style.cssText='display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.6rem;';
  const rangeWrap=document.createElement('div'); rangeWrap.style.cssText='display:none;gap:.4rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap;';
  const rStart=document.createElement('input'); rStart.type='month'; rStart.value=draft.scope.start||currentMK();
  const rEnd=document.createElement('input'); rEnd.type='month'; rEnd.value=draft.scope.end||currentMK();
  [rStart,rEnd].forEach(x=>{ x.style.cssText='padding:.4rem;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg,var(--panel-bg));color:var(--fg);font-size:16px;'; });
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
    draft.amount=a;
    if(draft.scope.type==='range'){
      draft.scope.start=rStart.value||null; draft.scope.end=rEnd.value||null;
      if(draft.scope.start&&draft.scope.end&&draft.scope.start>draft.scope.end){ fb.textContent='Range start is after end.'; return; }
    }
    // Monthly mode: amount is the single value. Weekly mode: distribute evenly unless a
    // per-week pattern already exists on the current month.
    if(draft.mode==='weekly'){
      const cols=(state.colsByMonth&&state.colsByMonth[currentMK()])||state.cols||[];
      const cur=cols.map(c=>parseFloat((state.cells||{})[currentMK()+'|'+rowId+'|'+c.id]||0)||0);
      const curSum=cur.reduce((s,v)=>s+v,0);
      draft.weekly = (curSum>0 && Math.abs(curSum-a)<1e-9) ? cur.slice(0,4) : [a,0,0,0];
    } else { draft.weekly=null; }
    m.close();
    commitRecurring(draft);
  });
  actions.appendChild(saveBtn); actions.appendChild(cancelBtn); m.panel.appendChild(actions);
  amt.focus();
}

// Apply a rule to all its fillable months, mark the row, and commit. If clashes exist the
// rule is stored as a draft and the draft banner drives resolution.
function commitRecurring(draft){
  const opts=_recOptsFor(draft.rowId);
  const clashes=FiRecurring.detectClashes(draft, opts);
  const rules=_recRules();
  const idx=rules.findIndex(r=>r.rowId===draft.rowId);
  if(clashes.length){
    draft.draft=true;
    if(idx>=0) rules[idx]=draft; else rules.push(draft);
    markRowRecurring(draft.rowId, true);
    save(); render(); _recDraftBannerRefresh();
    return;
  }
  draft.draft=false;
  FiRecurring.fillableMonths(draft, opts).forEach(mk2=>_recWriteMonth(draft, mk2));
  if(idx>=0) rules[idx]=draft; else rules.push(draft);
  markRowRecurring(draft.rowId, true);
  save(); render(); _recDraftBannerRefresh();
  showToast('🔁 Recurring saved');
}

// Write a single monthly value into mk2 (col0 holds it, other week cols cleared to 0).
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

// Manual edit of a monthly recurring row's single cell: ask how far the change reaches.
function _onRecurringCellEdit(rowId, mk2, newTotal){
  const rule=_recRuleFor(rowId);
  if(!rule){ _writeMonthlyValue(rowId, mk2, newTotal); save(); render(); return; }
  const curVal=FiRecurring.ruleValueForMonth(rule, mk2);
  if(Math.abs(curVal-newTotal)<1e-9){ _writeMonthlyValue(rowId, mk2, newTotal); save(); render(); return; }

  const m=_recModal();
  const h=document.createElement('h3'); h.style.cssText='margin:0 0 .5rem;font-size:1rem;color:var(--fg);';
  h.textContent='Apply this change to:'; m.panel.appendChild(h);
  const sub=document.createElement('p'); sub.style.cssText='margin:0 0 1rem;font-size:.82rem;color:var(--muted);';
  sub.textContent='This is a recurring category. Choose which months take the new amount.';
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

// Checkbox list of in-scope existing months; checked months take newTotal as an override.
function _pickSpecificMonths(rule, newTotal){
  const months=_existingMonths().filter(mk2=>FiRecurring.monthInScope(rule, mk2)).sort();
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
  showToast('Delinked '+_recMkLabel(mk2)+' from recurring');
}

function removeRecurring(rowId){
  const rules=_recRules(); const idx=rules.findIndex(r=>r.rowId===rowId);
  if(idx>=0) rules.splice(idx,1);
  markRowRecurring(rowId, false);
  save(); render(); _recDraftBannerRefresh();
}

// Resolve one clash: apply (unlock+write, or overwrite) or skip (add to exceptions). When a
// rule's clashes are all cleared it leaves draft state and fills its remaining months.
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

// A single persistent banner listing every unresolved clash across all draft rules, each
// with Apply / Skip and a jump-to-month link. Shown while any rule is a draft.
let _recDraftBannerEl=null;
function _recDraftBannerRefresh(){
  const drafts=_recRules().filter(r=>r.draft);
  let items=[];
  drafts.forEach(rule=>{
    const row=(state.rows||[]).find(r=>r.id===rule.rowId)||{};
    FiRecurring.detectClashes(rule, _recOptsFor(rule.rowId)).forEach(c=>{
      items.push({rowId:rule.rowId, label:row.label||'Category', mk:c.mk, reason:c.reason});
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
    ap.addEventListener('click',()=>_resolveClash(it.rowId, it.mk, 'apply'));
    const sk=document.createElement('button'); sk.type='button'; sk.className='rec-draft-skip'; sk.textContent='Skip';
    sk.addEventListener('click',()=>_resolveClash(it.rowId, it.mk, 'skip'));
    row.appendChild(txt); row.appendChild(ap); row.appendChild(sk); b.appendChild(row);
  });
  document.body.appendChild(b); _recDraftBannerEl=b;
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

var _sync=createSyncManager(STORAGE_KEY,'/api/save/expenses','/api/load/expenses',{
  getState:function(){return state;},
  onReload:function(){state=loadState();render();syncIncomeInputs();},
  onMerge:showToast,
  showQuotaWarning:showSaveQuotaWarning
});
var syncToServer=_sync.syncToServer;
var loadFromServer=_sync.loadFromServer;
var setSyncStatus=_sync.setSyncStatus;
var saveLocal=_sync.saveLocal;
async function loadSubsFromServer(){


  if(!window.__currentUser) return;
  if(isWalkthroughActive())return;
  if(localStorage.getItem(SUBS_KEY+'__dirty')) return; // unsynced offline subs edits: local wins until flushed
  try{
    const res=await fetch('/api/load/subs');
    if(!res.ok) return;
    const resp=await res.json();
    const data=resp&&resp.data;
    if(data&&typeof data==='object'&&(Array.isArray(data.rows)||Array.isArray(data.cols)||data.cells)){
      // Keep the Subscriptions tracker's own last-viewed month (per-device view state) so
      // visiting Expenses doesn't reset which month Subscriptions reopens on.
      try{const _ln=JSON.parse(localStorage.getItem(SUBS_KEY)||'null');if(_ln&&_ln.currentYear!=null){data.currentYear=_ln.currentYear;data.currentMonth=_ln.currentMonth;}}catch(_){}
      localStorage.setItem(SUBS_KEY,JSON.stringify(data));
    }
  }catch(e){}
}
// Stamps state.cellTimes[key]=now for any cell whose value changed since the last
// save, by diffing against the snapshot still sitting in localStorage (saveLocal()
// is about to overwrite it). One diff on every save() uniformly catches every way
// `cells` can change — typing, paste, bulk delete, import, undo/redo — without
// scattering Date.now() stamps across ~20 mutation sites. A key that just vanished
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
  syncToServer();
  checkSpendTrend();
  detectRecurring();
  try{ _maybeCelebrateFirstEntry(currentMK()); }catch(_){}
}

// ── Phase 4a: Spend Trend Message ────────────────────────────────────────
function _monthSpendTotal(mk2){
  var sum=0;
  var mCols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
  var rows=getRows(mk2);
  var hasKidsSet=new Set(rows.filter(function(r){return r.parentId;}).map(function(r){return r.parentId;}));
  rows.forEach(function(row){
    if(hasKidsSet.has(row.id)) return; // parent with children — children's cells are the real values
    mCols.forEach(function(col){ sum+=parseFloat((state.cells||{})[mk2+'|'+row.id+'|'+col.id]||0)||0; });
  });
  return parseFloat(sum.toFixed(2));
}
function checkSpendTrend(){
  var mk2=currentMK();
  var parts=mk2.split('-'); var py=parseInt(parts[0]), pm=parseInt(parts[1])-1;
  pm--; if(pm<0){py--;pm=11;}
  var prevMk2=mk(py,pm);
  var thisTotal=_monthSpendTotal(mk2);
  var prevTotal=_monthSpendTotal(prevMk2);
  // Hide strip and bail if conditions not met
  if(thisTotal<10||prevTotal<10){
    var old=document.getElementById('voice-strip'); if(old) old.style.display='none'; return;
  }
  var delta=thisTotal-prevTotal;
  var pct=Math.round(Math.abs(delta)/prevTotal*100);
  if(pct<10){
    var old=document.getElementById('voice-strip'); if(old) old.style.display='none'; return;
  }
  var dir=delta>0?'up':'down';
  // Find the category with the largest absolute change vs last month
  var rowTotalsThis={}, rowTotalsPrev={};
  Object.keys(state.cells||{}).forEach(function(k){
    var parts=k.split('|'); if(parts.length!==3) return;
    var n=parseFloat(state.cells[k])||0; if(!n) return;
    if(parts[0]===mk2){ rowTotalsThis[parts[1]]=(rowTotalsThis[parts[1]]||0)+n; }
    if(parts[0]===prevMk2){ rowTotalsPrev[parts[1]]=(rowTotalsPrev[parts[1]]||0)+n; }
  });
  var topCat='', topCatPct=0, topCatDir='up';
  getRows(mk2).forEach(function(row){
    if(row.parentId) return;
    if(row.linked==='subscriptions'||row.snapshotLinkedRow) return; // auto-filled rows, skip
    var kids=getRows(mk2).filter(function(r){return r.parentId===row.id;});
    var t=kids.length>0
      ? kids.reduce(function(s,c){return s+(rowTotalsThis[c.id]||0);},0)
      : (rowTotalsThis[row.id]||0);
    var prevRowsArr=(state.rowsByMonth&&state.rowsByMonth[prevMk2])||state.rows||[];
    var prevKids=prevRowsArr.filter(function(r){return r.parentId===row.id;});
    var p=prevKids.length>0
      ? prevKids.reduce(function(s,c){return s+(rowTotalsPrev[c.id]||0);},0)
      : (rowTotalsPrev[row.id]||0);
    if(p<1) return;
    var cp=Math.round(Math.abs(t-p)/p*100);
    if(cp>topCatPct){ topCatPct=cp; topCat=row.label; topCatDir=t>p?'up':'down'; }
  });
  var text=topCat && topCatPct>=10
    ? (topCat+' is '+topCatDir+' '+topCatPct+'% vs last month.')
    : ('Spending '+dir+' '+pct+'% vs last month.');
  showVoiceStrip(text);
}
function showVoiceStrip(text){
  var el=document.getElementById('voice-strip');
  var txt=document.getElementById('voice-strip-text');
  if(!el||!txt) return;
  txt.textContent=text;
  el.style.display='flex';
}
// ── Phase 5e: Recurring row detection (CV < 0.15, ≥3 months) ──
function detectRecurring(){
  // Build index: rowId → {label, amounts: [...nonzero monthly totals]}
  const rowAmounts={};
  const allMonths=Object.keys(state.cells||{}).map(k=>k.split('|')[0]).filter((v,i,a)=>v&&a.indexOf(v)===i);
  allMonths.forEach(mk2=>{
    const cols2=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
    // Merge base rows with month-specific rows so rows added after forking are included
    const monthRows=(state.rowsByMonth&&state.rowsByMonth[mk2])||[];
    const baseRows=state.rows||[];
    const seenIds=new Set(monthRows.map(r=>r.id));
    const rows2=[...monthRows,...baseRows.filter(r=>!seenIds.has(r.id))];
    rows2.filter(r=>!r.parentId&&!r.linked&&!r.recurring).forEach(row=>{
      let total=0;
      cols2.forEach(col=>{ total+=parseFloat((state.cells||{})[mk2+'|'+row.id+'|'+col.id]||0)||0; });
      if(total>0){
        if(!rowAmounts[row.id]) rowAmounts[row.id]={label:row.label,amounts:[]};
        rowAmounts[row.id].amounts.push(total);
      }
    });
  });
  Object.keys(rowAmounts).forEach(rowId=>{
    const entry=rowAmounts[rowId];
    if(entry.amounts.length<3) return;
    if(localStorage.getItem('fiapp_rec_dismissed_'+rowId)) return;
    // Check if already marked recurring
    const row=(state.rows||[]).find(r=>r.id===rowId)||
      Object.values(state.rowsByMonth||{}).reduce((f,arr)=>f||arr.find(r=>r.id===rowId),null);
    if(row&&row.recurring) return;
    // Compute CV
    const n=entry.amounts.length;
    const mean=entry.amounts.reduce((s,v)=>s+v,0)/n;
    if(mean<=0) return;
    const variance=entry.amounts.reduce((s,v)=>s+Math.pow(v-mean,2),0)/n;
    const cv=Math.sqrt(variance)/mean;
    if(cv>=0.15) return;
    _showRecurringToast(rowId,entry.label);
  });
}
function _showRecurringToast(rowId,label){
  if(document.getElementById('rec-toast-'+rowId)) return;
  const el=document.createElement('div');
  el.id='rec-toast-'+rowId;
  el.style.cssText='position:fixed;bottom:calc(4rem + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);z-index:99999;background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:8px;padding:.65rem 1rem;font-size:.85rem;color:var(--fg);box-shadow:0 4px 16px rgba(0,0,0,.15);display:flex;align-items:center;gap:.6rem;max-width:440px;';
  const txt=document.createElement('span');txt.textContent='💡 '+label+' recurs every month. Mark it?';
  const yes=document.createElement('button');yes.className='btn btn-sm';yes.style.fontSize='.8rem';yes.textContent='Mark recurring';
  yes.onclick=function(){
    el.remove();
    openRecurringConfig(rowId);   // let the user set amount/scope rather than a bare flag
  };
  const no=document.createElement('button');no.className='btn-ghost btn-sm';no.style.fontSize='.8rem';no.textContent='Skip';
  no.onclick=function(){ localStorage.setItem('fiapp_rec_dismissed_'+rowId,'1');el.remove(); };
  el.appendChild(txt);el.appendChild(yes);el.appendChild(no);
  document.body.appendChild(el);
  setTimeout(()=>{ if(document.body.contains(el)) el.remove(); },12000);
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
    const uid=window.__currentUser&&window.__currentUser.user_id;
    if(uid&&sessionStorage.getItem('fiapp_undo_uid')&&String(sessionStorage.getItem('fiapp_undo_uid'))!==String(uid)){
      sessionStorage.removeItem(UNDO_KEY); sessionStorage.removeItem(REDO_KEY); sessionStorage.removeItem('fiapp_undo_uid'); return;
    }
    const u=sessionStorage.getItem(UNDO_KEY); if(u){const p=JSON.parse(u); if(p&&!Array.isArray(p)) undoByMonth=p;}
    const r=sessionStorage.getItem(REDO_KEY); if(r){const p=JSON.parse(r); if(p&&!Array.isArray(p)) redoByMonth=p;}
  }catch{}
}
function saveHistory(){
  try{
    const uid=window.__currentUser&&window.__currentUser.user_id;
    if(uid) sessionStorage.setItem('fiapp_undo_uid',String(uid));
    sessionStorage.setItem(UNDO_KEY,JSON.stringify(undoByMonth));
    sessionStorage.setItem(REDO_KEY,JSON.stringify(redoByMonth));
  }catch{}
}
function _captureSlice(mk2){
  const mkPrefix=mk2+'|';
  const cellsSlice={};
  Object.keys(state.cells||{}).forEach(k=>{if(k.startsWith(mkPrefix)) cellsSlice[k]=state.cells[k];});
  const goalsSlice={};
  Object.entries(state.goals||{}).forEach(([k,v])=>{if(k.startsWith(mkPrefix)) goalsSlice[k]=v;});
  return {
    cells:cellsSlice,
    rows:state.rowsByMonth?.[mk2]?JSON.parse(JSON.stringify(state.rowsByMonth[mk2])):null,
    cols:state.colsByMonth?.[mk2]?JSON.parse(JSON.stringify(state.colsByMonth[mk2])):null,
    // Global (unforked) rows too: applyTemplate mutates these directly, and a
    // slice without them cannot return the user to the template menu on undo.
    globalRows:JSON.parse(JSON.stringify(state.rows||[])),
    goals:goalsSlice
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
  // Older persisted slices (sessionStorage) predate globalRows - leave rows alone then.
  if(entry.globalRows) state.rows=entry.globalRows;
  if(!state.goals) state.goals={};
  Object.keys(state.goals).forEach(k=>{if(k.startsWith(mkPrefix)) delete state.goals[k];});
  Object.assign(state.goals,entry.goals||{});
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
  save(); saveHistory(); render(); syncIncomeInputs(); updateHistBtns();
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
  save(); saveHistory(); render(); syncIncomeInputs(); updateHistBtns();
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
  _mobileColPair=null;
  saveLocal(); updateMonthNav(); render(); syncIncomeInputs(); checkSpendTrend(); updateHistBtns();
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
  _mobileColPair=null;
  // A never-touched month entering the window inherits any in-scope recurring values.
  const _mk=currentMK();
  if(!(state.rowsByMonth&&state.rowsByMonth[_mk]) && _recRules().some(r=>!r.draft&&FiRecurring.monthInScope(r,_mk))){
    if(_recFillNewMonth(_mk)) save();
  }
  saveLocal(); updateMonthNav(); render(); syncIncomeInputs(); checkSpendTrend(); updateHistBtns();
}
function updateMonthNav(){
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  document.getElementById('budget-month').textContent=label;
  document.getElementById('apply-year-lbl').textContent=state.currentYear;
  document.getElementById('prev-btn').disabled=isAtMin();
  document.getElementById('next-btn').disabled=isAtMax();
  populateMonthJump();
  updateForecastUI();
  updateCloseBar();
  updateMonthContextNote();
}
// W2: explain the per-month "fork" inline — rows, columns, and goals are each
// month's own copy (see forkCurrentMonth()), which surprises people editing a
// past/future month expecting it to affect "now". Plain orientation text, kept
// deliberately distinct from the close-bar's "closed/locked" vocabulary (that's
// about edit permission, not data scoping).
function updateMonthContextNote(){
  const note=document.getElementById('month-context-note');
  if(!note) return;
  const now=new Date();
  if(currentMK()===mk(now.getFullYear(),now.getMonth())){ note.style.display='none'; return; }
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  note.textContent='📅 Viewing '+label+' - categories, columns, and goals here belong to '+label+' only; other months keep their own.';
  note.style.display='block';
}

// ── Monthly Close Flow ────────────────────────────────────────────────────
function _hasDataForMonth(mk2){
  return Object.keys(state.cells||{}).some(k=>k.startsWith(mk2+'|')&&parseFloat(state.cells[k])>0);
}
// B (Playful): the first time a fresh month gains data in this browser session, fire a
// one-off celebration. The personality gate makes this a near-instant no-op for Default/
// Quiet (it never reaches the cell scan), and the sessionStorage flag makes it idempotent
// per month/session. Wrapped in try/catch by the caller so it can never break save().
function _maybeCelebrateFirstEntry(mk2){
  if(!window.fiappCelebrate || (window.fiappPersonality&&fiappPersonality()!=='playful')) return;
  if(_monthsWithDataAtLoad&&_monthsWithDataAtLoad.has(mk2)) return; // already had data before this session
  var key='fiapp_firstentry_exp_'+mk2;
  try{ if(sessionStorage.getItem(key)) return; }catch(_){ return; }
  if(!_hasDataForMonth(mk2)) return;
  try{ sessionStorage.setItem(key,'1'); }catch(_){}
  fiappCelebrate({confetti:true, mascot:'First entry logged. Off to a good start.'});
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
  // Compute total for the display
  let spent=0;
  const mCols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
  getRows(mk2).forEach(row=>{ mCols.forEach(col=>{ spent+=parseFloat((state.cells||{})[mk2+'|'+row.id+'|'+col.id]||0)||0; }); });
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  document.getElementById('close-bar-text').textContent='📋 Close '+label+'? - $'+spent.toFixed(2)+' tracked';
  bar.style.display='flex';
}
function openCloseModal(){
  const mk2=currentMK();
  let spent=0, prevSpent=0;
  const mCols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
  getRows(mk2).forEach(row=>{ mCols.forEach(col=>{ spent+=parseFloat((state.cells||{})[mk2+'|'+row.id+'|'+col.id]||0)||0; }); });
  // prev month
  let py=state.currentYear, pm=state.currentMonth-1;
  if(pm<0){py--;pm=11;}
  const pmk2=mk(py,pm);
  const pmCols=(state.colsByMonth&&state.colsByMonth[pmk2])||state.cols||[];
  getRows(pmk2).forEach(row=>{ pmCols.forEach(col=>{ prevSpent+=parseFloat((state.cells||{})[pmk2+'|'+row.id+'|'+col.id]||0)||0; }); });
  const gross=parseFloat((state.income&&state.income[mk2]&&state.income[mk2].gross)||0)||0;
  const delta=prevSpent>0?spent-prevSpent:null;
  const label=MONTHS_FULL[state.currentMonth]+' '+state.currentYear;
  // Build modal content
  let details='<strong>'+label+'</strong><br>Spent: $'+spent.toFixed(2);
  if(gross>0){ const leftover=gross-spent; details+=' &nbsp;·&nbsp; Income: $'+gross.toFixed(2)+(leftover>=0?' &nbsp;·&nbsp; Left over: $'+leftover.toFixed(2):''); }
  if(delta!==null){ details+='<br><span style="color:var(--muted);font-size:.85rem">'+(delta>=0?'↑ $'+delta.toFixed(2)+' vs prev month':'↓ $'+Math.abs(delta).toFixed(2)+' vs prev month')+'</span>'; }
  // Find top category
  let topCat='', topVal=0;
  const rowIdx={};
  Object.keys(state.cells||{}).forEach(k=>{ const parts=k.split('|'); if(parts.length===3&&parts[0]===mk2){const n=parseFloat(state.cells[k])||0;if(n>0){if(!rowIdx[parts[1]])rowIdx[parts[1]]=0;rowIdx[parts[1]]+=n;}}});
  getRows(mk2).forEach(row=>{ if(!row.parentId&&rowIdx[row.id]>topVal){topVal=rowIdx[row.id];topCat=row.label;}});
  if(topCat) details+='<br><span style="color:var(--muted);font-size:.85rem">Largest: '+escapeHtml(topCat)+' ($'+topVal.toFixed(2)+')</span>';
  // Show modal
  const overlay=document.getElementById('close-modal-overlay');
  if(!overlay) return;
  document.getElementById('close-modal-body').innerHTML=details;
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
  // Update month nav dropdown to show lock badge
  populateMonthJump();
  // Re-render so the month's read-only state (disabled inputs/labels, locked controls)
  // applies immediately, not only after the next navigation.
  render();
  // B (Playful): celebrate closing a month, with a bigger burst + warmer line if it
  // closed in surplus (income recorded and more than what was spent).
  if(window.fiappCelebrate){
    let _spent=0;
    const _cols=(state.colsByMonth&&state.colsByMonth[mk2])||state.cols||[];
    getRows(mk2).forEach(row=>{ _cols.forEach(col=>{ _spent+=parseFloat((state.cells||{})[mk2+'|'+row.id+'|'+col.id]||0)||0; }); });
    const _gross=parseFloat((state.income&&state.income[mk2]&&state.income[mk2].gross)||0)||0;
    const _surplus=_gross>0&&(_gross-_spent)>0;
    fiappCelebrate({confetti:true, big:_surplus, mascot:_surplus?'Month closed in the black. Nice.':'Month closed.'});
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
  
  const ip=document.querySelector('.income-panel');
  if(ip) ip.classList.toggle('forecast-panel',fc);
  
  const bm=document.getElementById('budget-month');
  if(bm){
    bm.querySelectorAll('.forecast-badge').forEach(b=>b.remove());
    if(fc){ const b=document.createElement('span');b.className='forecast-badge';b.textContent='📋 Forecast';bm.appendChild(b); }
  }
  
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
  if(!state.income[curMk]){
    const pi=state.income[prevMk];
    // Carry the taxCurrency stamp too - dropping it left the copied figure unconvertible
    // when the home currency later changed (relabeled without conversion).
    if(pi) state.income[curMk]={gross:pi.gross||'',tax:pi.tax||'',taxCurrency:pi.taxCurrency||''};
  }
  save(); render(); syncIncomeInputs();
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
      const vals=srcMonths.map(m=>safeNum(state.cells[m+'|'+r.id+'|'+col.id])).filter(v=>v>0);
      if(!vals.length) return;
      hasHistory=true;
      const avg=(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2);
      state.cells[curMk+'|'+r.id+'|'+col.id]=avg;
      filled++;
    });
  });
  save(); render(); syncIncomeInputs();
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


function rowTotal(rId){
  const row=getRows().find(r=>r.id===rId);
  if(row&&row.linked==='subscriptions') return virtualSubChildren().reduce((s,c)=>s+c.cost,0);
  if(row&&row.snapshotLinkedRow){
    const snap=(row.subsSnapshotByMonth||{})[currentMK()];
    if(snap!==undefined) return snap.reduce((s,c)=>s+c.cost,0);
    return virtualSubChildren().reduce((s,c)=>s+c.cost,0);
  }
  const kids=children(rId);
  if(kids.length) return kids.reduce((s,c)=>s+rowTotal(c.id),0);
  return getCols().reduce((s,col)=>s+getCell(rId,col.id),0);
}
function grandTotal(){ return getRows().filter(r=>!r.parentId).reduce((s,r)=>s+rowTotal(r.id),0); }
function colTotal(cId){
  const colIdx=getCols().findIndex(c=>c.id===cId);
  return getRows().filter(r=>!r.parentId).reduce((s,r)=>{
    if(r.linked==='subscriptions'||r.snapshotLinkedRow){
      const vcs=r.linked==='subscriptions'?virtualSubChildren():((r.subsSnapshotByMonth||{})[currentMK()]||virtualSubChildren());
      return s+vcs.reduce((t,vc)=>t+(vc.weekCosts?vc.weekCosts[colIdx]||0:(colIdx===0?vc.cost:0)),0);
    }
    if(hasChildren(r.id)) return s+children(r.id).reduce((cs,c)=>cs+getCell(c.id,cId),0);
    return s+getCell(r.id,cId);
  },0);
}
function _homeCur(){ try{ return localStorage.getItem('fiapp_analytics_currency')||'USD'; }catch(e){ return 'USD'; } }
function _homePfx(){ var c=_homeCur(); return c==='USD'?'$':c+' '; }
// USD -> home-currency multiplier (expRatesCache is a USD-based table). 1 when home is
// USD or rates haven't loaded yet.
function _homeRate(){ var c=_homeCur(); return c==='USD'?1:(expRatesCache[c]||1); }
// Converts a plain amount between two currencies via the USD-based expRatesCache table.
// A no-op (returns amount unchanged) until rates have loaded - callers that care should
// check Object.keys(expRatesCache).length first.
function _convBetween(amount,fromCur,toCur){
  if(!amount||fromCur===toCur) return amount;
  var usd=fromCur==='USD'?amount:(expRatesCache[fromCur]?amount/expRatesCache[fromCur]:amount);
  return toCur==='USD'?usd:usd*(expRatesCache[toCur]||1);
}
// Currency symbols (verified renderable against the app's 'Inter' font stack).
// JPY/CNY and the $-family currencies use their standard international disambiguation
// prefixes (JP¥/CN¥, US$/HK$/S$/C$/A$/Mex$) since a bare ¥ or $ would be ambiguous
// with each other. AED/CHF have no standardized single-glyph symbol, so they keep
// showing the ISO code. SAR does have one now (U+20C1 SAUDI RIYAL SIGN, Unicode 17.0,
// Sept 2025) but it's deliberately left out: Inter (this app's font) doesn't have the
// glyph yet (open issue: github.com/rsms/inter/issues/842) and the codepoint is too
// new for reliable cross-device font support. Revisit once that support lands.
const CUR_SYMBOLS={USD:'US$',EUR:'€',GBP:'£',JPY:'JP¥',CNY:'CN¥',INR:'₹',KRW:'₩',THB:'฿',HKD:'HK$',SGD:'S$',CAD:'C$',AUD:'A$',MXN:'Mex$',BRL:'R$',MYR:'RM'};
function _curSymbol(c){ return CUR_SYMBOLS[c]||c; }
function fmt(n){ return _homePfx()+Math.max(0,n).toFixed(2); }

function _goalKey(rId){ return currentMK()+'|'+rId; }
function _renderGoalBar(rId, totTd){
  const valSpan=totTd.querySelector('.total-val');
  const gBtn=totTd.querySelector('.goal-btn');
  let srSpan=totTd.querySelector('.goal-sr');
  const goal=state.goals?.[_goalKey(rId)];
  if(!goal||isNaN(goal)){
    if(valSpan) valSpan.style.color='';
    if(gBtn)    { gBtn.style.color=''; gBtn.textContent='🎯'; gBtn.style.transform=''; }
    if(srSpan)  srSpan.remove();
    return;
  }
  const spent=rowTotal(rId);
  const pct=Math.min(999,Math.round(spent/goal*100));
  const color=pct>=100?'#ef4444':pct>=75?'#f59e0b':'#22c55e';
  const icon=pct>=100?'🚨':pct>=75?'⚠️':'🎯';
  const label=pct>=100?'(over budget)':pct>=75?'(near limit)':'(under budget)';
  if(valSpan) valSpan.style.color=color;
  if(gBtn)    { gBtn.style.color=color; gBtn.textContent=icon; gBtn.style.transform=pct>=75&&pct<100?'translateY(-1px)':''; }
  if(!srSpan){srSpan=document.createElement('span');srSpan.className='sr-only goal-sr';totTd.appendChild(srSpan);}
  srSpan.textContent=label;
}
function _openGoalPopup(rId, gBtn){
  document.querySelectorAll('.goal-popover').forEach(el=>el.remove());
  const totTd=gBtn.closest('td');
  const goal=state.goals?.[_goalKey(rId)];
  const spent=rowTotal(rId);
  const pct=goal?Math.min(999,Math.round(spent/goal*100)):0;
  const color=pct>=100?'#ef4444':pct>=75?'#f59e0b':'#22c55e';

  const pop=document.createElement('div'); pop.className='goal-popover';
  const head=document.createElement('div');
  head.style.cssText='font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:.1rem;';
  head.textContent='Monthly Budget';
  const track=document.createElement('div'); track.className='goal-pop-bar-track';
  const fill=document.createElement('div');  fill.className='goal-pop-bar-fill';
  fill.style.width=(goal?Math.min(100,pct):0)+'%'; fill.style.background=color;
  track.appendChild(fill);
  const stat=document.createElement('div'); stat.className='goal-pop-stat';
  stat.style.color=goal?color:'var(--muted)';
  stat.textContent=goal?'Spent '+fmt(spent)+'  /  Goal '+fmt(goal)+'  ('+pct+'%)':'No goal set';
  const inp=document.createElement('input'); inp.className='goal-pop-inp';
  inp.type='number'; inp.min='0'; inp.step='any'; inp.placeholder='Enter monthly limit…'; inp.value=goal||'';
  const btns=document.createElement('div'); btns.className='goal-pop-btns';
  const saveBtn=document.createElement('button'); saveBtn.className='goal-pop-save'; saveBtn.textContent='Save';
  const clrBtn=document.createElement('button');  clrBtn.className='goal-pop-clear'; clrBtn.textContent='Clear';

  const applyGoal=()=>{
    if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
    const v=parseFloat(inp.value);
    if(!state.goals) state.goals={};
    if(!isNaN(v)&&v>0) state.goals[_goalKey(rId)]=v; else delete state.goals[_goalKey(rId)];
    save();
    if(totTd) _renderGoalBar(rId,totTd); else render();
    pop.remove(); removePL();
  };
  saveBtn.addEventListener('click',applyGoal);
  clrBtn.addEventListener('click',()=>{ inp.value=''; applyGoal(); });
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault(); applyGoal(); }
    else if(e.key==='Escape'){ pop.remove(); removePL(); }
  });
  btns.appendChild(saveBtn); btns.appendChild(clrBtn);
  pop.appendChild(head); pop.appendChild(track); pop.appendChild(stat);
  pop.appendChild(inp); pop.appendChild(btns);
  document.body.appendChild(pop);

  requestAnimationFrame(()=>{
    const rect=gBtn.getBoundingClientRect(),pw=pop.offsetWidth||220,ph=pop.offsetHeight||180,m=8;
    let top=rect.bottom+6;
    if(top+ph>window.innerHeight-m) top=rect.top-ph-6;
    top=Math.max(m,top);
    let left=rect.right-pw;
    left=Math.max(m,Math.min(left,window.innerWidth-pw-m));
    pop.style.top=top+'px'; pop.style.left=left+'px';
  });
  inp.focus(); inp.select();

  const onOut=e=>{ if(!pop.contains(e.target)&&e.target!==gBtn){ pop.remove(); removePL(); } };
  const onEsc=e=>{ if(e.key==='Escape'){ pop.remove(); removePL(); } };
  function removePL(){ document.removeEventListener('pointerdown',onOut); document.removeEventListener('keydown',onEsc); }
  setTimeout(()=>{ document.addEventListener('pointerdown',onOut); document.addEventListener('keydown',onEsc); },0);
}
function _rebuildTotTd(rId, totTd){
  totTd.innerHTML='';
  const inner=document.createElement('div'); inner.style.cssText='display:flex;align-items:center;justify-content:flex-end;gap:2px;';
  const span=document.createElement('span'); span.className='total-val'; span.id='rt-'+rId;
  span.textContent=fmt(rowTotal(rId)); inner.appendChild(span);
  const gBtn=document.createElement('button'); gBtn.className='goal-btn'; gBtn.title='Set or view monthly budget goal'; gBtn.setAttribute('aria-label','Set spending goal'); gBtn.textContent='🎯';
  gBtn.addEventListener('click',e=>{ e.stopPropagation(); _openGoalPopup(rId,gBtn); });
  inner.appendChild(gBtn); totTd.appendChild(inner);
  _renderGoalBar(rId,totTd);
}

function updateRowTotal(rId){
  const el=document.getElementById('rt-'+rId); if(el) el.textContent=fmt(rowTotal(rId));
  const totTd=el&&el.closest('td'); if(totTd) _renderGoalBar(rId,totTd);
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
  updateIncomeSummary();
  updateStatStrip();
}
function updateAll(rId){ updateRowTotal(rId); updateGrandTotal(); if(chartVisible) renderChart(); }


function monthIncomeObj(){
  const key=currentMK();
  if(!state.income[key]){
    for(let m=0;m<12;m++){
      const k=mk(state.currentYear,m);
      if(k!==key&&state.income[k]&&(state.income[k].gross||state.income[k].tax)){
        return state.income[key]={gross:state.income[k].gross||'',tax:state.income[k].tax||'',taxCurrency:state.income[k].taxCurrency||''};
      }
    }
    state.income[key]={gross:'',tax:''};
  }
  return state.income[key];
}
function onIncomeInput(){
  const taxEl=document.getElementById('inp-tax');
  if(parseFloat(taxEl.value)<0) taxEl.value='0';
  const grossNum=parseFloat(document.getElementById('inp-gross').value)||0;
  if(grossNum>0 && (parseFloat(taxEl.value)||0)>grossNum) taxEl.value=grossNum.toFixed(2);
  const tax=taxEl.value;
  const obj=monthIncomeObj(); obj.tax=tax; obj.taxCurrency=_homeCur();
  document.getElementById('apply-year-btn').style.display=tax?'inline-block':'none';
  save(); updateIncomeSummary(); updateStatStrip();
}
function syncIncomeInputs(){
  const obj=monthIncomeObj();
  // Tax is hand-entered (unlike gross, which always mirrors the Income Tracker live), so
  // it's stamped with the currency it was entered in. If the home/analytics currency has
  // since changed (e.g. on the account page), rebase the stored figure into the new
  // currency here instead of silently treating the old number as if it were already in
  // the new currency (that mismatch could make tax exceed income - see bug report).
  const homeCur=_homeCur();
  // Rebase EVERY month's stored tax into the new home currency, not just the month on
  // screen. Per-record `taxCurrency` stamps say what each figure is denominated in, but
  // stamps can be missing (tax saved before stamping existed, or copied forward by the
  // forecast tools), so the blob also carries `state.taxHomeCur` - the home currency its
  // tax figures were written in - which backfills any unstamped record. Without that
  // backfill an unstamped figure was silently relabeled to the new currency without ever
  // being converted (the "US$ 21783.28 -> RUB 21783.28" bug).
  {
    let changed=false;
    const recs=state.income||{};
    // One-time migration: infer the blob's denomination from any existing stamp (every
    // write path stamps with the then-current home currency, so any stamp is evidence);
    // otherwise assume the current home currency.
    if(!state.taxHomeCur){
      let inferred=null;
      Object.keys(recs).forEach(function(k){
        if(!inferred && recs[k] && recs[k].tax && recs[k].taxCurrency) inferred=recs[k].taxCurrency;
      });
      state.taxHomeCur=inferred||homeCur;
      changed=true;
    }
    // Backfill unstamped tax records with the blob denomination (no conversion here).
    Object.keys(recs).forEach(function(k){
      const rec=recs[k];
      if(rec && rec.tax && !rec.taxCurrency){ rec.taxCurrency=state.taxHomeCur; changed=true; }
    });
    // Convert stamped records that differ from the current home currency - but only when
    // BOTH codes are actually quoted in the rate table (or are USD, the table's base).
    // _convBetween falls back to a 1:1 rate for unknown codes, and restamping after a 1:1
    // "conversion" would permanently mislabel the figure, so never restamp without a real
    // conversion; a skipped record keeps its stamp and converts on a later pass.
    const canConv=function(c){ return c==='USD'||typeof expRatesCache[c]==='number'; };
    if(Object.keys(expRatesCache).length){
      Object.keys(recs).forEach(function(k){
        const rec=recs[k];
        if(rec && rec.tax && rec.taxCurrency && rec.taxCurrency!==homeCur
           && canConv(rec.taxCurrency) && canConv(homeCur)){
          rec.tax=_convBetween(parseFloat(rec.tax)||0,rec.taxCurrency,homeCur).toFixed(2);
          rec.taxCurrency=homeCur;
          changed=true;
        }
      });
      // The blob denomination follows the home currency once a rates-backed pass has run
      // (only if the new home is convertible - otherwise keep the truthful old value).
      if(state.taxHomeCur!==homeCur && canConv(homeCur)){ state.taxHomeCur=homeCur; changed=true; }
    }
    // A rebase/stamp is a real data change, not per-device view-state: it must reach the
    // server (syncToServer sets the dirty flag; saveLocal alone does not), or the next
    // loadFromServer overwrites it with the stale blob and the conversion is lost.
    if(changed){ saveLocal(); syncToServer(); }
  }
  document.getElementById('inp-gross').value=obj.gross||'';
  document.getElementById('inp-tax').value  =obj.tax  ||'';
  document.getElementById('apply-year-btn').style.display=obj.tax?'inline-block':'none';
  document.getElementById('apply-year-lbl').textContent=state.currentYear;
  updateIncomeSummary();
  updateStatStrip();
  syncFromIncomeTracker(currentMK());
}
function applyIncomeToYear(){
  // Gross is always synced live from the Income Tracker per month (never manual), so
  // only tax/deductions - the one field still entered by hand here - gets copied.
  snapshot();
  const obj=monthIncomeObj();
  for(let m=0;m<12;m++){
    const k=mk(state.currentYear,m);
    if(!state.income[k]) state.income[k]={gross:'',tax:''};
    state.income[k].tax=obj.tax;
    state.income[k].taxCurrency=obj.taxCurrency||_homeCur();
  }
  save();
  const f=document.getElementById('apply-flash');
  if(f){
    f.textContent='✓ Tax applied to all 12 months in '+state.currentYear+'.';
    f.classList.add('show');
    clearTimeout(window._applyFlashT);
    window._applyFlashT=setTimeout(()=>f.classList.remove('show'),3500);
  }
}
function updateIncomeSummary(){
  const curLabel=_curSymbol(_homeCur());
  const grossCurEl=document.getElementById('gross-cur-label'); if(grossCurEl) grossCurEl.textContent=curLabel;
  const taxCurEl=document.getElementById('tax-cur-label'); if(taxCurEl) taxCurEl.textContent=curLabel;
  const gross=parseFloat(document.getElementById('inp-gross').value)||0;
  const tax  =parseFloat(document.getElementById('inp-tax').value)  ||0;
  const annual=gross*12;
  const afterTax=Math.max(0,gross-tax);
  const exp=grandTotal();
  const rem=afterTax-exp;
  document.getElementById('disp-annual').textContent  =annual>0?_homePfx()+annual.toFixed(2):'-';
  document.getElementById('disp-aftertax').textContent=gross>0?fmt(afterTax):'-';
  document.getElementById('disp-expenses').textContent=fmt(exp);
  const remEl=document.getElementById('disp-remaining');
  remEl.textContent=gross>0?(_homePfx()+Math.abs(rem).toFixed(2)+(rem<0?' over budget':'')):'-';
  remEl.className='income-computed '+(rem<0?'neg':'pos');
  // Phase 4c — end-of-month projection
  const projEl=document.getElementById('eom-projection');
  if(projEl){
    const now2=new Date();
    const isCurrent=state.currentYear===now2.getFullYear()&&state.currentMonth===now2.getMonth();
    const daysPassed=now2.getDate();
    if(isCurrent&&daysPassed>=15&&gross>0&&exp>0){
      const daysInMonth=new Date(now2.getFullYear(),now2.getMonth()+1,0).getDate();
      const onPace=(exp/daysPassed)*daysInMonth;
      projEl.textContent='On pace for $'+onPace.toFixed(0)+' this month ('+daysPassed+' days in, $'+gross.toFixed(0)+' earned)';
      projEl.style.display='block';
    }else{
      projEl.style.display='none';
    }
  }
}

// ── Batch D Wave 4: header stat strip (spent+delta, budget-left+bar, daily pace) ──
function _prevMK(mk2){
  var parts=mk2.split('-'); var py=parseInt(parts[0],10), pm=parseInt(parts[1],10)-1;
  pm--; if(pm<0){py--;pm=11;}
  return mk(py,pm);
}
function updateStatStrip(){
  var spentEl=document.getElementById('stat-spent');
  if(!spentEl) return; // page has no stat strip (shouldn't happen on expenses, guards anyway)
  var mk2=currentMK();
  // grandTotal() (same figure the budget panel calls "Total Expenses This Month") is the
  // source of truth: unlike _monthSpendTotal()'s raw cell sum, it resolves linked
  // subscription rows via virtualSubChildren() instead of state.cells, which is empty
  // for those rows. _monthSpendTotal() is still fine for the *previous* month side of
  // the delta below - it's a directional comparison, not a headline figure, and computing
  // an exact prior-month subscription total would mean re-plumbing virtualSubChildren()
  // (used in 8 places, all implicitly bound to the current month) to accept a month
  // argument - the same simplification checkSpendTrend() already makes for its own trend text.
  var spent=grandTotal();
  var prevSpent=_monthSpendTotal(_prevMK(mk2));
  spentEl.textContent=fmt(spent);
  var deltaEl=document.getElementById('stat-spent-delta');
  if(prevSpent>0){
    var pct=Math.round((spent-prevSpent)/prevSpent*100);
    deltaEl.className='stat-delta '+(pct>0?'bad':pct<0?'good':'neutral');
    deltaEl.innerHTML='<svg class="fi-ico" aria-hidden="true"><use href="/static/icons/ui-sprite.svg?v='+(window.ASSET_V||'')+'#'+(pct>=0?'fi-arrow-up-right':'fi-arrow-down-right')+'"/></svg>'+
      (pct>=0?'+':'')+pct+'% vs last month';
  } else {
    deltaEl.className='stat-delta neutral';
    deltaEl.textContent='';
  }

  var gross=parseFloat(document.getElementById('inp-gross').value)||0;
  var tax=parseFloat(document.getElementById('inp-tax').value)||0;
  var afterTax=Math.max(0,gross-tax);
  var left=afterTax-spent;
  var leftEl=document.getElementById('stat-budget-left');
  var barWrap=document.getElementById('stat-budget-bar');
  if(afterTax>0){
    leftEl.textContent=fmt(Math.max(0,left));
    var pctUsed=Math.min(100,Math.round(spent/afterTax*100));
    barWrap.style.display='block';
    barWrap.querySelector('span').style.width=pctUsed+'%';
  } else {
    leftEl.textContent='-';
    barWrap.style.display='none';
  }

  var now=new Date();
  var isCurrent=state.currentYear===now.getFullYear()&&state.currentMonth===now.getMonth();
  var daysInMonth=new Date(state.currentYear,state.currentMonth+1,0).getDate();
  var daysElapsed=isCurrent?now.getDate():daysInMonth;
  var pace=spent/Math.max(1,daysElapsed);
  document.getElementById('stat-pace').textContent=fmt(pace)+'/day';
  var paceNote=document.getElementById('stat-pace-note');
  if(afterTax>0){
    var budgetPerDay=afterTax/daysInMonth;
    paceNote.textContent=pace<=budgetPerDay?'on track for budget':'above budget pace';
    paceNote.className='stat-delta '+(pace<=budgetPerDay?'good':'bad');
  } else {
    paceNote.textContent=isCurrent?daysElapsed+' of '+daysInMonth+' days':'';
    paceNote.className='stat-delta neutral';
  }
}

// Phase: overspend nudge — pace-vs-calendar projection for the live current
// month. Fires only when spend is *materially* ahead of the calendar (not
// just slightly), and the linear projection actually crosses the goal/income.
// Picks at most one nudge (worst category, else overall) — a single firm
// signal rather than a wall of pastel pills. Per-category/month dismissible.
function _nudgeDismissKey(scopeKey){ return 'fiapp_nudge_dismissed_'+currentMK()+'_'+scopeKey; }
function computeOverspendNudge(){
  const now=new Date();
  const isCurrent=state.currentYear===now.getFullYear()&&state.currentMonth===now.getMonth();
  if(!isCurrent) return null;
  const daysPassed=now.getDate();
  if(daysPassed<7) return null; // too early in the month for a pace signal to be meaningful
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const timeFraction=daysPassed/daysInMonth;
  const MATERIAL_GAP=0.15; // spend-fraction must be >15 percentage points ahead of calendar pace

  let worst=null;
  getRows().filter(r=>!r.parentId).forEach(row=>{
    const goal=state.goals?.[_goalKey(row.id)];
    if(!goal||isNaN(goal)||goal<=0) return;
    const spent=rowTotal(row.id);
    if(spent<=0) return;
    const projected=(spent/daysPassed)*daysInMonth;
    const overBy=projected-goal;
    if(overBy<=0) return;
    if((spent/goal)-timeFraction<=MATERIAL_GAP) return;
    if(!worst||overBy>worst.overBy) worst={scope:'cat',scopeKey:row.id,name:row.label,projected,overBy,limit:goal};
  });
  if(worst) return worst;

  const gross=parseFloat(document.getElementById('inp-gross')?.value)||0;
  if(gross>0){
    const spentTotal=grandTotal();
    if(spentTotal>0){
      const projected=(spentTotal/daysPassed)*daysInMonth;
      const overBy=projected-gross;
      if(overBy>0 && (spentTotal/gross)-timeFraction>MATERIAL_GAP){
        return {scope:'overall',scopeKey:'overall',name:null,projected,overBy,limit:gross};
      }
    }
  }
  return null;
}
function updateOverspendNudge(){
  const el=document.getElementById('overspend-nudge');
  if(!el) return;
  const n=computeOverspendNudge();
  if(!n || localStorage.getItem(_nudgeDismissKey(n.scopeKey))){
    el.style.display='none'; el.innerHTML='';
    return;
  }
  const msg = n.scope==='cat'
    ? 'At this pace you\'ll spend ~'+fmt(n.projected)+' on '+escapeHtml(n.name)+' by month-end - ~'+fmt(n.overBy)+' over your '+fmt(n.limit)+' goal.'
    : 'At this pace you\'ll spend ~'+fmt(n.projected)+' this month - ~'+fmt(n.overBy)+' more than your '+fmt(n.limit)+' income.';
  const dismissLabel = n.scope==='cat' ? ('Dismiss overspend nudge for '+n.name+' this month') : 'Dismiss overspend nudge for this month';
  el.innerHTML='<p>⚠ <strong>Heads up -</strong> '+msg+'</p>'
    +'<button class="btn btn-sm" id="nudge-review-btn" type="button">Review →</button>'
    +'<button class="btn-ghost btn-sm" id="nudge-dismiss-btn" type="button" aria-label="'+escapeHtml(dismissLabel)+'">Dismiss</button>';
  el.style.display='flex';
  document.getElementById('nudge-dismiss-btn').onclick=function(){
    localStorage.setItem(_nudgeDismissKey(n.scopeKey),'1');
    el.style.display='none'; el.innerHTML='';
  };
  document.getElementById('nudge-review-btn').onclick=function(){
    const target = n.scope==='cat' ? document.querySelector('tr[data-row-id="'+n.scopeKey+'"]') : document.querySelector('.income-panel');
    if(target) target.scrollIntoView({behavior:'smooth',block:'center'});
  };
}


function _fmtMkLabel(mk2){
  const [y,m]=mk2.split('-');
  return MONTHS_SHORT[parseInt(m)-1]+' '+y;
}
async function loadTaxCarryover(){
  try{
    if(isWalkthroughActive()) return;
    const t=JSON.parse(localStorage.getItem(TAX_KEY)); if(!t) return;
    const isFresh = t.consumed===false || (t.ts && t.ts>(state.lastTaxTs||0));
    if(!isFresh) return;

    // The tax result is in the calculator country's currency (US->USD, IN->INR, HK->HKD).
    // The budget card is in the home currency and gross is converted, so the tax must be
    // converted too - otherwise afterTax mixes currencies (e.g. an INR tax number treated
    // as HKD dwarfs the income and zeroes out after-tax). Rates load after boot, so await.
    await fetchExpRates();
    const srcCcy = t.country==='IN'?'INR':t.country==='HK'?'HKD':'USD';
    const home=_homeCur();
    const toHome=(srcVal)=>{
      const n=parseFloat(srcVal)||0;
      const usd=srcCcy==='USD'?n:(expRatesCache[srcCcy]?n/expRatesCache[srcCcy]:n);
      return home==='USD'?usd:usd*(expRatesCache[home]||1);
    };
    const annualTaxHome=toHome(t.tax);
    const annualIncomeHome=toHome(t.income);
    const monthlyTax=(annualTaxHome/12).toFixed(2);

    const targetMonths=t.months&&t.months.length ? t.months : [currentMK()];
    targetMonths.forEach(mk2=>{
      if(!state.income[mk2]) state.income[mk2]={};
      state.income[mk2].tax=monthlyTax;
      state.income[mk2].taxCurrency=home;
    });

    t.consumed=true;
    state.lastTaxTs = t.ts || Date.now();
    localStorage.setItem(TAX_KEY,JSON.stringify(t));
    save();
    // Boot's syncIncomeInputs()/updateIncomeSummary() ran before this async work finished,
    // so refresh the input + summary to show the freshly-applied tax.
    try{ syncIncomeInputs(); }catch(_){}
    try{ updateIncomeSummary(); }catch(_){}

    const pfx=_homePfx();
    const monthLabel=targetMonths.length===1
      ? _fmtMkLabel(targetMonths[0])
      : targetMonths.length+' months ('+targetMonths.map(_fmtMkLabel).join(', ')+')';
    const banner=document.createElement('div'); banner.className='tax-banner';
    banner.innerHTML=`✓ Monthly tax (${pfx}${Number(monthlyTax).toLocaleString()}) applied to ${monthLabel}. Annual: ${pfx}${Number(annualIncomeHome.toFixed(2)).toLocaleString()}, tax: ${pfx}${Number(annualTaxHome.toFixed(2)).toLocaleString()}. <a href="/tax">Recalculate →</a>`;
    document.getElementById('income-grid').prepend(banner);
    document.getElementById('tax-link').style.display='none';
  }catch(e){ console.warn('FiApp: loadTaxCarryover failed -',e.message); }
}


async function _incomeMonthTotalUSD(incomeState, mk2){
  await fetchExpRates();
  if(!incomeState) return 0;
  const rows=(incomeState.rowsByMonth&&incomeState.rowsByMonth[mk2])||incomeState.rows||[];
  const cols=(incomeState.colsByMonth&&incomeState.colsByMonth[mk2])||incomeState.cols||[];
  if(!rows.length||!cols.length) return 0;
  const mrCur=incomeState.monthRowCurrencies||{};
  let total=0;
  for(const r of rows.filter(r=>!r.parentId)){
    const kids=rows.filter(c=>c.parentId===r.id);
    const leaves=kids.length?kids:[r];
    for(const leaf of leaves){
      const cur=mrCur[mk2+'|'+leaf.id]||'USD';
      for(const col of cols){
        const v=parseFloat(incomeState.cells[mk2+'|'+leaf.id+'|'+col.id])||0;
        if(!v) continue;
        total+= cur==='USD' ? v : (expRatesCache[cur] ? v/expRatesCache[cur] : v);
      }
    }
  }
  return total;
}
// Gross income is never typed by hand here - it always mirrors the Income Tracker for
// the viewed month (converted to home currency), so the budget panel can't drift out of
// sync with home/analytics the way a manually-entered figure used to. When the Income
// Tracker has nothing for this month, the (i) badge points the user there instead of
// accepting a local override.
async function syncFromIncomeTracker(mk2){
  const icon=document.getElementById('income-sync-icon');
  const grossEl=document.getElementById('inp-gross');
  // During walkthrough, fiapp_income_v1 may still hold real pre-tour data (user hasn't
  // saved income yet this session). Skip auto-fill so budget stays clean.
  if(isWalkthroughActive()){ if(icon) icon.style.display='none'; return; }
  try{
    const incomeState=JSON.parse(localStorage.getItem(INCOME_KEY));
    const hasTracker=!!(incomeState&&incomeState.rows&&incomeState.rows.length);
    const totalUsd=hasTracker?await _incomeMonthTotalUSD(incomeState,mk2):0;
    const total=totalUsd*(expRatesCache[_homeCur()]||1);
    const obj=monthIncomeObj();
    if(total>0){
      obj.gross=total.toFixed(2);
      obj.fromIncome=true;
      if(grossEl) grossEl.value=obj.gross;
      if(icon){ icon.dataset.tip='Synced from Income Tracker'; icon.style.display=''; }
      try{ localStorage.setItem(PREFILL_KEY,(total*12).toFixed(0)); }catch(e){}
    } else {
      obj.gross='';
      obj.fromIncome=false;
      if(grossEl) grossEl.value='';
      if(icon){ icon.dataset.tip='No income set for this month - add it in the Income Tracker'; icon.style.display=''; }
    }
    saveLocal(); updateIncomeSummary(); updateStatStrip();
  }catch(e){}
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
  // Clean up any orphaned colour inputs from a previous cancelled picker
  document.querySelectorAll('input[data-gear-clr]').forEach(el=>el.remove());

  const menu=document.createElement('div'); menu.className='row-gear-menu';

  // Regular action button — stopPropagation prevents document click handler closing openMenu
  function mBtn(label,fn){
    const b=document.createElement('button');b.textContent=label;
    b.addEventListener('click',e=>{e.stopPropagation();_closeGearMenu();fn();});
    menu.appendChild(b);
  }

  // Colour item: label+input pattern — user's tap on the label is a trusted event,
  // so the native colour picker opens. No synthetic .click() needed.
  function mColorItem(labelText, initVal, onInput){
    const id='_gc_'+Math.random().toString(36).slice(2,8);
    const inp=document.createElement('input');
    inp.type='color';inp.id=id;inp.value=initVal;
    inp.setAttribute('data-gear-clr','1');
    // Off-screen but not display:none — keeps it accessible for label activation
    inp.style.cssText='position:fixed;opacity:0;top:50%;left:50%;pointer-events:none;';
    inp.addEventListener('input',()=>onInput(inp.value));
    inp.addEventListener('change',()=>{ _closeGearMenu();save();inp.remove(); });
    document.body.appendChild(inp); // outside menu so it survives menu removal

    const lbl=document.createElement('label');lbl.htmlFor=id;lbl.textContent=labelText;
    lbl.addEventListener('click',e=>e.stopPropagation()); // don't let click close openMenu
    menu.appendChild(lbl);
  }

  mColorItem('🎨 Background colour', row.color||'#ffffff',
    v=>{ row.color=v;rhTd.style.backgroundColor=v;if(swatch)swatch.style.backgroundColor=v;if(textSwatch)textSwatch.style.backgroundColor=v; }
  );
  mColorItem('🔤 Text colour', row.textColor||'#1f2937',
    v=>{ row.textColor=v;const lbl=rhTd.querySelector('.row-label');if(lbl)lbl.style.color=v;if(textSwatch)textSwatch.style.color=v; }
  );

  if(!isChild&&!row.linked&&!row.snapshotLinkedRow){
    mBtn('＋ Add subcategory',()=>{ showSubMenu(btn,row); });
  }
  if(_recEligible(row, isChild)){
    const _rule=_recRuleFor(row.id);
    mBtn(_rule?'🔁 Edit recurring':'🔁 Mark recurring',()=>{ openRecurringConfig(row.id); });
    if(_rule){
      mBtn('⛓ Delink this month',()=>{ delinkMonth(row.id, currentMK()); });
      mBtn('✖ Remove recurring',()=>{ removeRecurring(row.id); });
    }
  }
  if(row.linked==='subscriptions'){
    mBtn('→ Open Subscriptions',()=>{ window.location.href='/subscriptions'; });
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
  const inp=document.createElement('input'); inp.type='text'; inp.placeholder='Custom subcategory'; inp.maxLength=40;
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
  // position:fixed is set once from btn's rect above - if the page (or an inner
  // scroll container) scrolls afterward, the button moves but the menu doesn't,
  // so it visually detaches from its anchor. Close it instead of tracking it.
  document.addEventListener('scroll',closeMenu,{capture:true,once:true});
}


// ── Phase 4h: Row label suggestions ──
function _allHistoricalLabels(){
  const labels=new Set();
  (state.rows||[]).forEach(r=>{if(r.label) labels.add(r.label);});
  Object.values(state.rowsByMonth||{}).forEach(arr=>arr.forEach(r=>{if(r.label) labels.add(r.label);}));
  return [...labels];
}
function _showLabelSuggest(spanEl){
  const partial=(spanEl.textContent||'').trim().toLowerCase();
  const all=_allHistoricalLabels();
  const matches=partial.length<1?[]:all.filter(l=>l.toLowerCase().startsWith(partial)&&l.toLowerCase()!==partial);
  let dd=document.getElementById('_label-suggest-dd');
  if(!matches.length){if(dd) dd.style.display='none'; return;}
  if(!dd){
    dd=document.createElement('div');dd.id='_label-suggest-dd';
    dd.style.cssText='position:fixed;z-index:9999;background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.15);min-width:160px;max-height:180px;overflow-y:auto;';
    // Keep the contenteditable span focused until the click resolves.
    dd.addEventListener('mousedown',function(e){e.preventDefault();});
    dd.addEventListener('touchstart',function(e){e.preventDefault();},{passive:false});
    // Delegated click — reads the safely-stored label from data-lbl (no inline JS).
    dd.addEventListener('click',function(e){
      var item=e.target.closest('[data-lbl]');
      if(item) _pickLabel(item,item.dataset.lbl);
    });
    document.body.appendChild(dd);
  }
  dd.innerHTML=matches.slice(0,8).map(l=>'<div data-lbl="'+escapeHtml(l)+'" style="padding:6px 10px;cursor:pointer;font-size:.85rem;color:var(--fg);">'+escapeHtml(l)+'</div>').join('');
  const rect=spanEl.getBoundingClientRect();
  dd.style.left=rect.left+'px';dd.style.top=(rect.bottom+3)+'px';dd.style.display='block';
  dd._targetSpan=spanEl;
}
function _hideLabelSuggest(){
  const dd=document.getElementById('_label-suggest-dd');if(dd) dd.style.display='none';
}
function _pickLabel(itemEl, label){
  const dd=document.getElementById('_label-suggest-dd');
  const span=dd&&dd._targetSpan;
  if(span){span.textContent=label;span.dispatchEvent(new Event('blur'));}
  _hideLabelSuggest();
}

// ── Phase 4g: First-use row templates ──
var _TEMPLATES={
  Default:    ['Groceries','Subscriptions','Travel','Savings'],
  Student:    ['Rent','Food','Transport','Books & Supplies','Entertainment','Subscriptions','Misc'],
  Freelancer: ['Rent / Mortgage','Equipment','Software','Marketing','Food','Transport','Subscriptions','Tax Set-Aside'],
  Family:     ['Rent / Mortgage','Groceries','Childcare','Transport','Utilities','Insurance','Subscriptions','Entertainment'],
};
function renderTemplatePrompt(){
  const el=document.getElementById('template-prompt'); if(!el) return;
  if(window._wtActive){el.innerHTML='';return;}
  if(localStorage.getItem('fiapp_template_dismissed')==='1'){el.innerHTML='';return;}
  const hasAnyData=Object.keys(state.cells||{}).length>0;
  const hasRows=getRows().length>0;
  if(hasAnyData||hasRows){el.innerHTML='';return;}

  el.innerHTML='';
  const names=Object.keys(_TEMPLATES);
  let selectedName=names[0];

  const wrap=document.createElement('div');
  wrap.style.cssText='background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:8px;padding:.75rem 1rem;margin-bottom:.75rem;font-size:.85rem;color:var(--fg);';

  const title=document.createElement('strong');
  title.style.cssText='display:block;margin-bottom:.5rem;';
  title.textContent='Start with a template';
  wrap.appendChild(title);

  const btnRow=document.createElement('div');
  btnRow.style.cssText='display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;';

  const previewArea=document.createElement('div');
  previewArea.style.cssText='margin-top:.6rem;';
  previewArea.addEventListener('click',function(e){
    var ab=e.target.closest('._apply-tpl'); if(ab) applyTemplate(ab.dataset.tpl);
  });

  function _setSelected(name){
    selectedName=name;
    btnRow.querySelectorAll('._tpl-btn').forEach(b=>{
      b.style.outline=b.dataset.tpl===name?'2px solid var(--accent)':'';
    });
  }
  function _renderPreview(name){
    const labels=_TEMPLATES[name]||[];
    const cols=['Week 1','Week 2','Week 3','Week 4'];
    const colHeaders=cols.map(c=>'<th style="padding:.25rem .5rem;font-weight:600;font-size:.78rem;color:var(--muted);border-bottom:1px solid var(--panel-border);white-space:nowrap;">'+c+'</th>').join('');
    const rows=labels.map(l=>{
      const bg=CAT_COLORS[l]||'#e5e7eb';
      const cells=cols.map(()=>'<td style="padding:.25rem .5rem;border-bottom:1px solid var(--panel-border);font-size:.78rem;color:var(--muted);text-align:right;">-</td>').join('');
      return '<tr><td style="padding:.25rem .6rem;border-bottom:1px solid var(--panel-border);font-size:.82rem;font-weight:500;background:'+bg+';color:#1f2937;border-radius:3px 0 0 3px;white-space:nowrap;">'+escapeHtml(l)+'</td>'+cells+'</tr>';
    }).join('');
    previewArea.innerHTML='<div style="overflow-x:auto;margin-top:.65rem;border:1px solid var(--panel-border);border-radius:6px;">'
      +'<table style="border-collapse:collapse;width:100%;min-width:340px;">'
      +'<thead><tr><th style="padding:.25rem .6rem;font-weight:600;font-size:.78rem;color:var(--muted);border-bottom:1px solid var(--panel-border);text-align:left;">Category</th>'+colHeaders+'</tr></thead>'
      +'<tbody>'+rows+'</tbody>'
      +'</table></div>'
      +'<div style="margin-top:.6rem;">'
      +'<button class="btn btn-sm _apply-tpl" data-tpl="'+escapeHtml(name)+'" style="font-size:.82rem">Apply '+escapeHtml(name)+' →</button>'
      +'</div>';
  }

  names.forEach(name=>{
    const btn=document.createElement('button');
    btn.className='btn btn-sm _tpl-btn';
    btn.dataset.tpl=name;
    btn.style.cssText='font-size:.82rem;';
    btn.textContent=name;
    if(window.matchMedia('(pointer:fine)').matches){
      btn.addEventListener('mouseenter',()=>_renderPreview(name));
      btn.addEventListener('mouseleave',()=>_renderPreview(selectedName));
    }
    btn.addEventListener('click',()=>{ _setSelected(name); _renderPreview(name); });
    btnRow.appendChild(btn);
  });

  const blankBtn=document.createElement('button');
  blankBtn.className='btn-ghost btn-sm';
  blankBtn.style.cssText='font-size:.82rem;margin-left:.25rem;';
  blankBtn.textContent='Start blank';
  let _blankConfirming=false;
  blankBtn.addEventListener('click',function(){
    if(_blankConfirming) return;
    _blankConfirming=true;
    blankBtn.textContent='Start with no rows?';
    const yes=document.createElement('button');
    yes.className='btn btn-sm';
    yes.style.cssText='font-size:.82rem;margin-left:.35rem;';
    yes.textContent='Yes';
    yes.addEventListener('click',dismissTemplatePrompt);
    const no=document.createElement('button');
    no.className='btn-ghost btn-sm';
    no.style.cssText='font-size:.82rem;margin-left:.25rem;';
    no.textContent='Cancel';
    no.addEventListener('click',function(){
      _blankConfirming=false;
      blankBtn.textContent='Start blank';
      yes.remove(); no.remove();
    });
    blankBtn.after(yes); yes.after(no);
  });
  btnRow.appendChild(blankBtn);

  wrap.appendChild(btnRow);
  wrap.appendChild(previewArea);
  el.appendChild(wrap);

  _setSelected(selectedName);
  _renderPreview(selectedName);
}
// W2: empty-state teaching for the 🎯 goal feature — explains what it does
// before the user has ever used it. Shown only once there's something to set
// a goal on; hidden permanently once dismissed or once any goal exists.
function updateGoalHint(){
  const el=document.getElementById('goal-hint');
  if(!el) return;
  if(localStorage.getItem('fiapp_goal_hint_dismissed')==='1' || getRows().filter(r=>!r.parentId).length===0 || Object.keys(state.goals||{}).length>0){
    el.style.display='none';
    return;
  }
  el.style.display='flex';
  const dismissBtn=document.getElementById('goal-hint-dismiss');
  if(dismissBtn) dismissBtn.onclick=function(){
    localStorage.setItem('fiapp_goal_hint_dismissed','1');
    el.style.display='none';
  };
}
function applyTemplate(name){
  const labels=_TEMPLATES[name]; if(!labels) return;
  snapshot();
  const _mk=currentMK();
  if(state.rowsByMonth) delete state.rowsByMonth[_mk];
  state.rows=[];
  labels.forEach(label=>{
    if(state.rows.filter(r=>!r.parentId).length>=MAX_ROWS) return;
    const color=CAT_COLORS[label]||'#e5e7eb';
    const rowObj={id:uid(),label,color,textColor:'#1f2937',height:36,parentId:null};
    if(label==='Subscriptions') rowObj.linked='subscriptions';
    state.rows.push(rowObj);
  });
  save(); render();
}
function dismissTemplatePrompt(){
  localStorage.setItem('fiapp_template_dismissed','1');
  const el=document.getElementById('template-prompt'); if(el) el.innerHTML='';
}

function addRow(){
  if(isWalkthroughActive()){showToast('🧭 Finish or skip the walkthrough to use this.');return;}
  if(_isClosedMonth(currentMK())){showToast('🔒 Month is locked.');return;}
  forkCurrentMonth();
  const mk2=currentMK();
  if(getRows(mk2).filter(r=>!r.parentId).length>=MAX_ROWS){showToast('Maximum '+MAX_ROWS+' rows per month.');return;}
  snapshot();
  const usedLabels=getRows(mk2).filter(r=>!r.parentId).map(r=>r.label);
  const nextCat=CAT_KEYS.find(k=>!usedLabels.includes(k))||'Groceries';
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
  // If the last subcategory of a parent was just deleted, clear the parent's stale cells
  // for this month so the parent resets to blank rather than re-exposing pre-subcategory values
  const lastChildGone=parentId&&!getRows(mk2).some(r=>r.parentId===parentId);
  if(lastChildGone){
    Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|'+parentId+'|')) delete state.cells[k]; });
  }
  save();
  if(lastChildGone){
    // Full re-render needed: DOM surgery wouldn't update the parent row from italic aggregate to editable
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
  const row=getRows(monthKey).find(r=>r.id===rId);

  if(row&&(row.linked==='subscriptions'||row.snapshotLinkedRow)){
    const [ys,ms]=monthKey.split('-').map(Number);
    const mo=ms-1;
    if(row.snapshotLinkedRow){
      const snap=(row.subsSnapshotByMonth||{})[monthKey];
      if(snap!==undefined) return snap.reduce((s,c)=>s+c.cost,0);
    }
    const subs=loadSubsState(); if(!subs) return 0;
    return (subs.rows||[]).reduce((s,r)=>s+calcSubMonthCostInExp(r,subs,ys,mo),0);
  }
  const kids=getRows(monthKey).filter(r=>r.parentId===rId);
  if(kids.length) return kids.reduce((s,c)=>s+rowTotalForMonthKey(c.id,monthKey),0);
  return getCols(monthKey).reduce((s,col)=>{
    const k=monthKey+'|'+rId+'|'+col.id;
    return s+(parseFloat(state.cells[k])||0);
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
    topLabel='Top Expenses - '+state.currentYear;
  } else {
    data=topRows.map(r=>({label:r.label,value:rowTotal(r.id),color:r.color})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
    topLabel='Top Expenses - '+MONTHS_SHORT[state.currentMonth]+' '+state.currentYear;
  }
  const _chartCanvas=document.getElementById('exp-chart');
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
  const colors=data.map(d=>d.color||'#93c5fd');
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
    chartInstance=new Chart(document.getElementById('exp-chart'),{
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
    chartInstance=new Chart(document.getElementById('exp-chart'),{
      type:'bar',
      data:{labels,datasets:[{label:'$ Amount',data:vals,backgroundColor:colors,borderRadius:4}]},
      options:{
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+_homePfx()+ctx.parsed.y.toFixed(2)}}},
        scales:{
          x:{ticks:{color:fgColor},grid:{color:gridColor},border:{color:gridColor}},
          y:{beginAtZero:true,ticks:{color:fgColor,callback:v=>_homePfx()+v},grid:{color:gridColor},border:{color:gridColor}}
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
    if(state.goals) Object.keys(state.goals).forEach(k=>{ if(k.startsWith(mk+'|')) delete state.goals[k]; });
    save(); render(); syncIncomeInputs();
  } else {
    if(e) e.stopPropagation();
    btn.dataset.arm='1'; btn.textContent='⚠ Sure?'; btn.classList.add('armed');
    resetTimer=setTimeout(()=>{delete btn.dataset.arm;btn.textContent='⚠ Reset';btn.classList.remove('armed');},2500);
  }
}


function attachColResize(handle,col){
  function startResize(clientX){
    handle.classList.add('dragging');
    const sx=clientX,sw=col.width,cEl=document.getElementById('cg-'+col.id);
    const mv=e=>{col.width=Math.max(55,sw+e.clientX-sx);if(cEl)cEl.style.width=col.width+'px';};
    const up=()=>{handle.classList.remove('dragging');save();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  }
  handle.addEventListener('mousedown',e=>{if(_isClosedMonth(currentMK()))return;e.preventDefault();startResize(e.clientX);});
  handle.addEventListener('touchstart',e=>{if(_isClosedMonth(currentMK()))return;e.preventDefault();startResize(e.touches[0].clientX);
    const cEl=document.getElementById('cg-'+col.id),sw=col.width,sx=e.touches[0].clientX;
    const tm=e=>{col.width=Math.max(55,sw+e.touches[0].clientX-sx);if(cEl)cEl.style.width=col.width+'px';};
    const tu=()=>{handle.classList.remove('dragging');save();document.removeEventListener('touchmove',tm);document.removeEventListener('touchend',tu);};
    document.addEventListener('touchmove',tm,{passive:false});document.addEventListener('touchend',tu);
  },{passive:false});
}
function attachHdrResize(handle){
  function startResize(clientX){
    handle.classList.add('dragging');
    const sx=clientX,sw=state.headerColWidth,cEl=document.getElementById('cg-hdr');
    const mv=e=>{state.headerColWidth=Math.max(100,sw+e.clientX-sx);if(cEl)cEl.style.width=state.headerColWidth+'px';};
    const up=()=>{handle.classList.remove('dragging');save();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  }
  handle.addEventListener('mousedown',e=>{e.preventDefault();startResize(e.clientX);});
  handle.addEventListener('touchstart',e=>{e.preventDefault();
    const cEl=document.getElementById('cg-hdr'),sw=state.headerColWidth,sx=e.touches[0].clientX;
    handle.classList.add('dragging');
    const tm=e=>{state.headerColWidth=Math.max(100,sw+e.touches[0].clientX-sx);if(cEl)cEl.style.width=state.headerColWidth+'px';};
    const tu=()=>{handle.classList.remove('dragging');save();document.removeEventListener('touchmove',tm);document.removeEventListener('touchend',tu);};
    document.addEventListener('touchmove',tm,{passive:false});document.addEventListener('touchend',tu);
  },{passive:false});
}
function attachRowResize(handle,row,tr){
  function startResize(clientY){
    handle.classList.add('dragging');
    const sy=clientY,sh=row.height||36;
    const mv=e=>{row.height=Math.max(26,sh+e.clientY-sy);tr.style.height=row.height+'px';};
    const up=()=>{handle.classList.remove('dragging');save();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  }
  handle.addEventListener('mousedown',e=>{if(_isClosedMonth(currentMK()))return;e.preventDefault();startResize(e.clientY);});
  handle.addEventListener('touchstart',e=>{if(_isClosedMonth(currentMK()))return;e.preventDefault();
    const sy=e.touches[0].clientY,sh=row.height||36;
    handle.classList.add('dragging');
    const tm=e=>{row.height=Math.max(26,sh+e.touches[0].clientY-sy);tr.style.height=row.height+'px';};
    const tu=()=>{handle.classList.remove('dragging');save();document.removeEventListener('touchmove',tm);document.removeEventListener('touchend',tu);};
    document.addEventListener('touchmove',tm,{passive:false});document.addEventListener('touchend',tu);
  },{passive:false});
}


function loadSubsState(){ if(isWalkthroughActive()) return null; try{ return JSON.parse(localStorage.getItem(SUBS_KEY))||null; }catch{ return null; } }

function calcSubMonthCostInExp(r, subs, yr, mo){
  const costCol=subs.cols.find(c=>c.ctype==='number');
  const billCol=subs.cols.find(c=>c.ctype==='billing');
  const startCol=subs.cols.find(c=>c.ctype==='date');
  const cancelCol=subs.cols.find(c=>c.ctype==='canceldate');
  const trialCol=subs.cols.find(c=>c.ctype==='trial');
  const statusCol=subs.cols.find(c=>c.ctype==='status');
  if(!costCol||!startCol) return 0;
  function gsc(rId,cId){ return subs.cells[rId+'|'+cId]||''; }
  const rawCost=Math.max(0,parseFloat(gsc(r.id,costCol.id))||0);
  const billing=billCol?(gsc(r.id,billCol.id)||'Monthly'):'Monthly';
  const startStr=gsc(r.id,startCol.id);
  if(!startStr) return 0;
  const start=new Date(startStr+'T00:00:00');
  const cancelStr=cancelCol?gsc(r.id,cancelCol.id):'';
  const cancel=cancelStr?new Date(cancelStr+'T00:00:00'):null;
  const trialV=trialCol?(gsc(r.id,trialCol.id)||'none'):'none';
  const status=statusCol?(gsc(r.id,statusCol.id)||'Active'):'Active';
  if(status==='Paused') return 0;
  const mStart=new Date(yr,mo,1), mEnd=new Date(yr,mo+1,0,23,59,59);
  if(start>mEnd) return 0;
  if(cancel&&cancel<mStart) return 0;
  
  let trialEnd=null;
  if(trialV!=='none'){
    const td2=new Date(start);
    if(trialV==='week')     {td2.setDate(td2.getDate()+6);trialEnd=td2;}
    else if(trialV==='2weeks'){td2.setDate(td2.getDate()+13);trialEnd=td2;}
    else if(trialV==='month'){td2.setMonth(td2.getMonth()+1);td2.setDate(td2.getDate()-1);trialEnd=td2;}
    else if(trialV==='2months'){td2.setMonth(td2.getMonth()+2);td2.setDate(td2.getDate()-1);trialEnd=td2;}
    else if(trialV==='3months'){td2.setMonth(td2.getMonth()+3);td2.setDate(td2.getDate()-1);trialEnd=td2;}
  }
  
  let events=0;
  if(billing==='Monthly'){
    const chargeDay=start.getDate();
    const dIM=new Date(yr,mo+1,0).getDate();
    const actualDay=Math.min(chargeDay,dIM);
    const chargeDate=new Date(yr,mo,actualDay);
    if(chargeDate>=mStart&&chargeDate<=mEnd&&chargeDate>=start){
      if(!cancel||chargeDate<=cancel){
        if(!(trialEnd&&chargeDate<=trialEnd)) events=1;
      }
    }
  } else if(billing==='Weekly'||billing==='Bi-Weekly'){
    const interval=(billing==='Weekly'?7:14)*864e5;
    let d=new Date(start);
    while(d<=mEnd){
      if(d>=mStart&&(!cancel||d<=cancel)&&!(trialEnd&&d<=trialEnd)) events++;
      d=new Date(d.getTime()+interval);
    }
  } else {
    const months=billing==='Quarterly'?3:billing==='Semi-Annual'?6:12;
    let d=new Date(start);
    while(d<=mEnd){
      if(d>=mStart&&(!cancel||d<=cancel)&&!(trialEnd&&d<=trialEnd)) events++;
      const nm=d.getMonth()+months;
      d=new Date(d.getFullYear()+Math.floor(nm/12),nm%12,d.getDate());
    }
  }
  
  const cur=(subs.rowCurrencies||{})[r.id]||'USD';
  const usdCost=cur==='USD'?rawCost:(expRatesCache[cur]?rawCost/expRatesCache[cur]:rawCost);
  // Return in the home currency so the linked Subscriptions row matches the rest of
  // the tracker (whose cells are home-currency) and the home/analytics snapshot, which
  // both convert via the home rate. Falls back to 1 (USD-equivalent) until rates load;
  // fetchExpRates() re-renders once they do.
  return events*usdCost*_homeRate();
}



function getSubWeekCosts(r, subs, yr, mo){
  const cost=calcSubMonthCostInExp(r,subs,yr,mo);
  if(!cost) return [0,0,0,0];
  const billCol=subs.cols.find(c=>c.ctype==='billing');
  const startCol=subs.cols.find(c=>c.ctype==='date');
  const billing=billCol?(subs.cells[r.id+'|'+billCol.id]||'Monthly'):'Monthly';
  const startStr=startCol?(subs.cells[r.id+'|'+startCol.id]||''):'';
  function dayToW(d){ return d<=7?0:d<=14?1:d<=21?2:3; }
  const weeks=[0,0,0,0];
  if(billing==='Weekly'||billing==='Bi-Weekly'){
    const interval=(billing==='Weekly'?7:14)*864e5;
    const start=new Date(startStr+'T12:00:00');
    let d=new Date(start);
    while(d.getFullYear()<yr||(d.getFullYear()===yr&&d.getMonth()<mo)) d=new Date(d.getTime()+interval);
    const days=[];
    while(d.getFullYear()===yr&&d.getMonth()===mo){ days.push(d.getDate()); d=new Date(d.getTime()+interval); }
    if(!days.length){ weeks[0]=cost; return weeks; }
    const perEvent=cost/days.length;
    days.forEach(day=>{ weeks[dayToW(day)]+=perEvent; });
  } else {
    
    const day=startStr?new Date(startStr+'T12:00:00').getDate():1;
    weeks[dayToW(day)]=cost;
  }
  return weeks;
}

function virtualSubChildren(){
  const subs=loadSubsState(); if(!subs||!subs.rows||!subs.cols) return [];
  const svcCol=subs.cols.find(c=>c.ctype==='text');
  return subs.rows.map(r=>{
    const label=svcCol?subs.cells[r.id+'|'+svcCol.id]||'-':'-';
    const cost=calcSubMonthCostInExp(r,subs,state.currentYear,state.currentMonth);
    const weekCosts=getSubWeekCosts(r,subs,state.currentYear,state.currentMonth);
    return {id:r.id,label,cost,weekCosts};
  }).filter(c=>c.cost>0);
}


function renderTableHeader(table){
  const cg=document.createElement('colgroup');
  const _mob=window.innerWidth<640;
  const _vw=window.innerWidth;
  // Mobile: label ~30% vw, data cols 90px fixed. Table wider than viewport — horizontal scroll is fine.
  const _hdrW=_mob?Math.max(90,Math.round(_vw*0.30)):state.headerColWidth||185;
  const _dataW=_mob?90:null;
  const hc=document.createElement('col');hc.id='cg-hdr';hc.style.width=_hdrW+'px';cg.appendChild(hc);
  getCols().forEach(col=>{const c=document.createElement('col');c.id='cg-'+col.id;c.style.width=(_mob?_dataW:col.width||120)+'px';cg.appendChild(c);});
  const tc=document.createElement('col');tc.style.width=(state.totalColWidth||110)+'px';cg.appendChild(tc);
  const dc=document.createElement('col');dc.style.width='32px';cg.appendChild(dc);
  table.appendChild(cg);

  const thead=document.createElement('thead'),htr=document.createElement('tr');
  const corner=document.createElement('th');
  const ci=document.createElement('div');ci.className='th-inner';
  const cl=document.createElement('span');cl.style.cssText='font-weight:600;color:var(--muted);font-size:.83rem;';cl.textContent='Category';ci.appendChild(cl);
  corner.appendChild(ci);
  const chr=document.createElement('div');chr.className='col-resize';attachHdrResize(chr);corner.appendChild(chr);
  htr.appendChild(corner);
  getCols().forEach((col,colIdx)=>{
    const th=document.createElement('th');
    if(colIdx===0) th.setAttribute('data-wt','expense-month-col');
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
    const lbl=document.createElement('input');lbl.type='text';lbl.className='th-label';lbl.size=1;lbl.value=col.label;
    lbl.setAttribute('aria-label','Column name');
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
    const isReadOnlyLabel=row.linked==='subscriptions'||row.snapshotLinkedRow;
    const rowLabel=isReadOnlyLabel?document.createElement('span'):document.createElement('input');
    rowLabel.className='row-label';
    rowLabel.style.color=row.textColor||'#1f2937';
    if(isReadOnlyLabel){
      rowLabel.textContent=row.label;
      if(row.snapshotLinkedRow){
        rowLabel.style.textDecorationLine='underline';
        rowLabel.style.textDecorationStyle='dashed';
        rowLabel.style.cursor='pointer';
        rowLabel.classList.add('tip-host');
        rowLabel.dataset.tip='Pasted snapshot - click to restore live link to your Subscription Tracker';
        rowLabel.addEventListener('click',e=>{e.stopPropagation();restoreSubsLink(row.id);});
      }
    } else {
      rowLabel.type='text';rowLabel.size=1;rowLabel.value=row.label;
      rowLabel.setAttribute('aria-label','Category name');
      if(_isClosedMonth(currentMK())) rowLabel.disabled=true;
      rowLabel.addEventListener('blur',()=>{row.label=rowLabel.value.trim()||row.label;save();_hideLabelSuggest();});
      rowLabel.addEventListener('input',()=>_showLabelSuggest(rowLabel));
      rowLabel.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();rowLabel.blur();}if(e.key==='Escape')_hideLabelSuggest();});
    }
    rhIn.appendChild(colorWrap);rhIn.appendChild(tcWrap);rhIn.appendChild(rowLabel);
    if(row.recurring){const rb=document.createElement('span');rb.className='row-recur-badge';rb.textContent='🔁';rb.title='Recurring';rb.setAttribute('aria-label','Recurring');rb.style.cssText='font-size:.75em;opacity:.6;margin-left:.25rem;pointer-events:none;flex-shrink:0;';rhIn.appendChild(rb);}
    if(!isChild && !row.linked && !row.snapshotLinkedRow){
      const dd=document.createElement('div');dd.className='sub-dropdown';
      const addBtn=document.createElement('button');addBtn.className='sub-add-btn';addBtn.textContent='+Sub';addBtn.title='Add subcategory';
      addBtn.addEventListener('click',e=>{e.stopPropagation();showSubMenu(addBtn,row);});
      dd.appendChild(addBtn);
      // Desktop recurring entry (mobile uses the gear menu, which hides .sub-dropdown).
      if(_recEligible(row, isChild)){
        const _rule=_recRuleFor(row.id);
        const recBtn=document.createElement('button');recBtn.className='sub-add-btn recur-mark-btn';
        recBtn.textContent='🔁';recBtn.title=_rule?'Edit recurring':'Mark recurring';recBtn.setAttribute('aria-label',_rule?'Edit recurring':'Mark recurring');
        if(_rule) recBtn.classList.add('active');
        recBtn.addEventListener('click',e=>{e.stopPropagation();openRecurringConfig(row.id);});
        dd.appendChild(recBtn);
      }
      rhIn.appendChild(dd);
    }
    if(row.linked==='subscriptions'){
      const linkBtn=document.createElement('a');
      linkBtn.href='/subscriptions';
      linkBtn.className='subs-link-btn tip-host';
      linkBtn.dataset.tip='This category is linked to your Subscription Tracker - click to open it';
      linkBtn.title='This category is linked to your Subscription Tracker - click to open it';
      linkBtn.textContent='→ Subscriptions';
      linkBtn.setAttribute('data-wt','subs-link');
      rhIn.appendChild(linkBtn);
    }
    if(!isChild){
      const gearBtn=document.createElement('button');
      gearBtn.className='row-gear-btn';gearBtn.textContent='⚙';gearBtn.title='Row options';gearBtn.setAttribute('aria-label','Row options');
      gearBtn.addEventListener('click',e=>{ e.stopPropagation();_openGearMenu(gearBtn,row,rhTd,swatch,textSwatch,isChild); });
      rhIn.appendChild(gearBtn);
    }
    rhTd.appendChild(rhIn);
    const rr=document.createElement('div');rr.className='row-resize';attachRowResize(rr,row,tr);rhTd.appendChild(rr);
    tr.appendChild(rhTd);
    const isLinkedRow=row.linked==='subscriptions'||row.snapshotLinkedRow;
    const linkedVC=isLinkedRow?(row.linked==='subscriptions'?virtualSubChildren():((row.subsSnapshotByMonth||{})[currentMK()]||virtualSubChildren())):null;
    // Monthly recurring row: one wide cell spanning the week columns instead of N cells.
    const _recRuleRow=(!hasKids&&!isLinkedRow)?_recRuleFor(row.id):null;
    const _recMonthly=_recRuleRow && _recRuleRow.mode==='monthly' && FiRecurring.monthInScope(_recRuleRow, currentMK());
    if(_recMonthly){
      const _mcols=getCols();
      const td=document.createElement('td'); td.colSpan=_mcols.length||1; td.className='rec-monthly-cell';
      const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='0.01';inp.inputMode='decimal';inp.className='num-input';
      inp.setAttribute('aria-label',(row.label||'Category')+' monthly amount');
      if(_isClosedMonth(currentMK())) inp.disabled=true;
      const _curTot=_monthTotalForRow(row.id,currentMK());
      inp.value=_curTot?String(_curTot):'';
      inp.addEventListener('input',()=>{ inp.value=inp.value.replace(/[^0-9.]/g,''); });
      inp.addEventListener('focus',()=>snapshot());
      inp.addEventListener('change',()=>{
        let v=parseFloat(inp.value); if(inp.value==='') v=0;
        if(isNaN(v)) return; if(v<0){ v=0; inp.value='0'; }
        _onRecurringCellEdit(row.id, currentMK(), v);
      });
      td.appendChild(inp); tr.appendChild(td);
    } else {
    getCols().forEach((col,colIdx)=>{
      const td=document.createElement('td');
      if(hasKids||isLinkedRow){
        const span=document.createElement('span');span.className='parent-sum';span.id='ps-'+row.id+'-'+col.id;
        let s=0;
        if(isLinkedRow&&linkedVC){
          s=linkedVC.reduce((t,vc)=>t+(vc.weekCosts?vc.weekCosts[colIdx]||0:(colIdx===0?vc.cost:0)),0);
        } else {
          s=children(row.id).reduce((t,c)=>t+getCell(c.id,col.id),0);
          span.title='Sum of subcategories';
        }
        span.textContent=s>0?fmt(s):'';td.appendChild(span);
      } else {
        const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='0.01';inp.inputMode='decimal';inp.className='num-input';
        inp.setAttribute('aria-label',((row.label||'Category')+' '+(col.label||'')).trim()+' amount');
        if(_isClosedMonth(currentMK())) inp.disabled=true;
        const stored=getRawCell(row.id,col.id);inp.value=stored!==''?stored:'';
        inp.addEventListener('input',()=>{ inp.value=inp.value.replace(/[^0-9.]/g,''); });
        inp.addEventListener('focus',()=>snapshot());
        inp.addEventListener('change',()=>{
          if(inp.value===''){
            delete state.cells[ck(row.id,col.id)]; save(); updateAll(row.id); return;
          }
          if(isNaN(parseFloat(inp.value))) return;
          if(parseFloat(inp.value)<0) inp.value='0';
          setCell(row.id,col.id,inp.value);
          updateAll(row.id);
        });
        td.appendChild(inp);
      }
      tr.appendChild(td);
    });
    }
    const totTd=document.createElement('td');totTd.className='th-total';
    const totInner=document.createElement('div');totInner.style.cssText='display:flex;align-items:center;justify-content:flex-end;gap:2px;';
    const totSpan=document.createElement('span');totSpan.className='total-val';totSpan.id='rt-'+row.id;
    totSpan.textContent=fmt(rowTotal(row.id));totInner.appendChild(totSpan);
    if(!isChild){
      const gBtn=document.createElement('button');gBtn.className='goal-btn';gBtn.title='Set or view monthly budget goal';gBtn.setAttribute('aria-label','Set spending goal');gBtn.textContent='🎯';
      gBtn.addEventListener('click',e=>{e.stopPropagation();_openGoalPopup(row.id,gBtn);});
      totInner.appendChild(gBtn);
    }
    totTd.appendChild(totInner);
    if(!isChild) _renderGoalBar(row.id,totTd);
    tr.appendChild(totTd);
    const delTd=document.createElement('td');delTd.className='del-td';
    if(row.linked!=='subscriptions'){
      const delBtn=document.createElement('button');delBtn.className='row-del';delBtn.title='Delete row';delBtn.setAttribute('aria-label','Delete row');delBtn.textContent='🗑';
      delBtn.addEventListener('click',()=>deleteRow(row.id));delTd.appendChild(delBtn);
    }
    tr.appendChild(delTd);
    tbody.appendChild(tr);
    if(!isChild&&!collapsed){
      children(row.id).forEach(renderRow);
      const _vchildren = row.linked==='subscriptions' ? virtualSubChildren()
        : row.snapshotLinkedRow ? ((row.subsSnapshotByMonth||{})[currentMK()]||virtualSubChildren())
        : [];
      if(_vchildren.length){
        _vchildren.forEach(vc=>{
          const vtr=document.createElement('tr'); vtr.style.height='30px'; vtr.classList.add('child-row'); vtr.style.opacity='.88';
          const vrhTd=document.createElement('td'); vrhTd.className='rh-cell'; vrhTd.style.backgroundColor=row.color;
          const vrhIn=document.createElement('div'); vrhIn.className='rh-inner'; vrhIn.style.paddingLeft='22px';
          const vbadge=document.createElement('span'); vbadge.style.cssText='font-size:.7rem;margin-right:3px;'; vbadge.textContent='🔗'; vbadge.title='From Subscription Tracker'; vbadge.setAttribute('aria-label','From Subscription Tracker');
          const vlbl=document.createElement('span'); vlbl.className='row-label'; vlbl.style.cssText='font-weight:500;font-size:.83rem;color:'+(row.textColor||'#1f2937')+';cursor:default;pointer-events:none;'; vlbl.textContent=vc.label;
          vrhIn.appendChild(vbadge); vrhIn.appendChild(vlbl); vrhTd.appendChild(vrhIn); vtr.appendChild(vrhTd);
          getCols().forEach((col,idx)=>{
            const vtd=document.createElement('td');
            const wc=vc.weekCosts?vc.weekCosts[idx]||0:(idx===0?vc.cost:0);
            if(wc>0){
              const vs=document.createElement('span'); vs.className='parent-sum'; vs.style.cssText='display:block;padding:4px 7px;text-align:right;font-size:.83rem;min-height:30px;line-height:22px;';
              vs.textContent=fmt(wc); vtd.appendChild(vs);
            }
            vtr.appendChild(vtd);
          });
          const vtotTd=document.createElement('td'); vtotTd.className='th-total';
          const vtotInner=document.createElement('div'); vtotInner.style.cssText='display:flex;align-items:center;justify-content:flex-end;';
          const vtotSpan=document.createElement('span'); vtotSpan.className='total-val'; vtotSpan.textContent=fmt(vc.cost);
          vtotInner.appendChild(vtotSpan); vtotTd.appendChild(vtotInner); vtr.appendChild(vtotTd);
          vtr.appendChild(document.createElement('td'));
          tbody.appendChild(vtr);
        });
      }
    }
  }
  getRows().filter(r=>!r.parentId).forEach(renderRow);
  if(getRows().length===0){
    const etr=document.createElement('tr');const etd=document.createElement('td');etd.colSpan=getCols().length+3;
    etd.style.cssText='text-align:center;padding:1.1rem .75rem;color:var(--muted);font-size:.88rem;border:none;';
    etd.textContent='Add your first row to start tracking.';etr.appendChild(etd);tbody.appendChild(etr);
  }
  const atr=document.createElement('tr');const atd=document.createElement('td');atd.colSpan=getCols().length+3;atd.style.cssText='border:none;padding:6px 0 6px 8px;';
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
    ['Rent','Food','Transport','Entertainment','Subscriptions'].forEach(function(l){
      if(state.rowsByMonth[mk2].length>=MAX_ROWS) return;
      state.rowsByMonth[mk2].push({id:uid(),label:l,color:CAT_COLORS[l]||'#e5e7eb',textColor:'#1f2937',height:36,parentId:null});
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
  const summaryEl=document.querySelector('.income-panel');
  const cardsEl=document.getElementById('exp-mobile-cards');
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
  const sheetWrap=document.getElementById('exp-sheet-wrap');
  const cardsDiv=document.getElementById('exp-mobile-cards');
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
    const _sumEl=document.querySelector('.income-panel'); if(_sumEl) _sumEl.classList.remove('mc-panel-hidden');
    renderTableHeader(table);
    renderTableBody(table);
    renderFooter(table);
  }
  updateIncomeSummary();
  updateStatStrip();
  renderTemplatePrompt();
  updateGoalHint();
  if(chartVisible) renderChart();
  adjustBodyWidth();
  updateForecastUI();
  updateOverspendNudge();
  try{ _recDraftBannerRefresh(); }catch(_){}
  const tbl=document.getElementById('sheet');
  if(tbl) tbl.classList.toggle('forecast',isForecastMonth());
  const hasSubcats=getRows().some(r=>r.parentId);
  const eb=document.getElementById('expand-btn'), cb2=document.getElementById('collapse-btn');
  if(eb) eb.style.display=hasSubcats?'':'none';
  if(cb2) cb2.style.display=hasSubcats?'':'none';
  if(!MOBILE){ applyMobileColVisibility(currentMK()); }
  else { const ob=document.getElementById('mobile-col-toggle'); if(ob) ob.remove(); }
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
  const container=document.getElementById('exp-mobile-cards');
  if(!container) return;
  container.innerHTML='';
  const cols=getCols();

  function buildCard(row){
    const isChild=!!row.parentId;
    const hasKids=hasChildren(row.id);
    const isLinked=row.linked==='subscriptions'||row.snapshotLinkedRow;
    const canEdit=!hasKids&&!isLinked;
    const isExpanded=_expandedCardId===row.id;

    const card=document.createElement('div');
    card.className='mc-card'+(isChild?' mc-child':'')+(isExpanded?' mc-active':'');
    card.dataset.rowId=row.id;
    if(row.color) card.style.backgroundColor=row.color;
    if(row.textColor) card.style.setProperty('--row-text',row.textColor);

    const top=document.createElement('div');
    top.className='mc-top'+(isExpanded?'':' mc-top-only');

    const drag=document.createElement('span');
    drag.className='mc-drag';drag.textContent='⠿';drag.setAttribute('aria-label','Drag to reorder');
    top.appendChild(drag);

    const main=document.createElement('div');main.className='mc-main';

    const hdr=document.createElement('div');hdr.className='mc-hdr';

    const nameEl=document.createElement('span');nameEl.className='mc-name';
    nameEl.textContent=row.label;
    if(row.textColor) nameEl.style.color=row.textColor;
    hdr.appendChild(nameEl);

    if(row.linked==='subscriptions'){
      const badge=document.createElement('a');badge.href='/subscriptions';badge.className='mc-subs-badge';badge.textContent='→ Subs';
      badge.addEventListener('click',e=>e.stopPropagation());
      hdr.appendChild(badge);
    }

    const totalEl=document.createElement('span');totalEl.className='mc-total';
    const _spent=rowTotal(row.id);
    totalEl.textContent=fmt(_spent);
    const _goal=state.goals?.[_goalKey(row.id)];
    if(_goal&&!isNaN(_goal)&&_goal>0){
      const _pct=Math.round(_spent/_goal*100);
      totalEl.style.background=_pct>=100?'#ef4444':_pct>=75?'#f59e0b':'#22c55e';
      totalEl.style.color='#fff';
    }
    hdr.appendChild(totalEl);

    if(!isLinked){
      const _gi=(_goal&&!isNaN(_goal)&&_goal>0)?(Math.round(_spent/_goal*100)>=100?'🚨':Math.round(_spent/_goal*100)>=75?'⚠️':'🎯'):'🎯';
      const goalBtn=document.createElement('button');goalBtn.className='mc-goal-btn';goalBtn.textContent=_gi;goalBtn.setAttribute('aria-label','Set spending goal');
      goalBtn.addEventListener('click',e=>{e.stopPropagation();_openGoalPopup(row.id,goalBtn);});
      hdr.appendChild(goalBtn);
    }

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
      wk.appendChild(lbl);wk.appendChild(val);weeksEl.appendChild(wk);
    });
    main.appendChild(weeksEl);

    const hint=document.createElement('div');
    if(!canEdit){
      hint.className='mc-hint-subs';
      hint.textContent=isLinked?'auto-filled · tap → Subs for detail':'edit via subcategories below';
    } else {
      hint.className='mc-hint-edit';hint.textContent='tap to edit ✏️';
      card.style.cursor='pointer';
      card.addEventListener('click',e=>{
        if(e.target.closest('.mc-gear')||e.target.closest('.mc-subs-badge')) return;
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
      cols.forEach(col=>{
        const ef=document.createElement('div');ef.className='mc-ef';
        const lbl=document.createElement('div');lbl.className='mc-el';lbl.textContent=col.label;
        const inp=document.createElement('input');inp.type='number';inp.inputMode='decimal';inp.className='mc-ei';
        inp.value=state.cells[ck(row.id,col.id)]||'';
        inputs.push({inp,col});
        ef.appendChild(lbl);ef.appendChild(inp);grid.appendChild(ef);
      });
      form.appendChild(grid);
      const btns=document.createElement('div');btns.className='mc-ebtns';
      const cancelBtn=document.createElement('button');cancelBtn.className='mc-ecancel';cancelBtn.textContent='Cancel';
      cancelBtn.addEventListener('click',e=>{e.stopPropagation();_expandedCardId=null;renderMobileCards();});
      const saveBtn=document.createElement('button');saveBtn.className='mc-esave';saveBtn.textContent='Save';
      saveBtn.addEventListener('click',e=>{
        e.stopPropagation();
        snapshot();
        inputs.forEach(({inp,col})=>{
          const v=inp.value.trim();
          if(v===''||isNaN(parseFloat(v))) delete state.cells[ck(row.id,col.id)];
          else state.cells[ck(row.id,col.id)]=v;
        });
        _expandedCardId=null;
        save();
        render();
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

// ── Tier 3B: smart week-column visibility on narrow viewports ────────────────
let _mobileColPair=null; // null=auto, 0=first-half, 1=second-half

function applyMobileColVisibility(mk){
  const cols=getCols();
  const MOBILE=window.innerWidth<640;
  // Remove any existing toggle button
  const old=document.getElementById('mobile-col-toggle');if(old) old.remove();
  // On wide screens show everything and clear hidden state
  if(!MOBILE||cols.length<3){
    const tbl=document.getElementById('sheet');
    if(tbl) tbl.querySelectorAll('td,th').forEach(el=>el.style.display='');
    return;
  }
  // Determine which pair to show
  let pair=_mobileColPair;
  if(pair===null){
    const today=new Date();
    const thisYM=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
    if(mk===thisYM){
      pair=today.getDate()<=14?0:1;
    } else {
      pair=0;
    }
  }
  // Col indices for pair 0: indices 0,1; pair 1: indices 2,3 (or all remaining)
  const showSet=new Set();
  const midpoint=Math.floor(cols.length/2);
  const from=pair===0?0:midpoint;
  const to=pair===0?midpoint:cols.length;
  for(let i=from;i<to;i++) showSet.add(cols[i].id);
  // Apply visibility to every cell column
  const tbl=document.getElementById('sheet');
  if(!tbl) return;
  cols.forEach((col,idx)=>{
    const show=showSet.has(col.id);
    // Header th (has data-col-id), body td (has data-col-id), footer td (nth-child based)
    tbl.querySelectorAll('[data-col-id="'+col.id+'"]').forEach(el=>{ el.style.display=show?'':'none'; });
    // colgroup col elements
    const cg=document.getElementById('cg-'+col.id);if(cg) cg.style.display=show?'':'none';
    // body tds by column position (data cells don't have data-col-id)
    const colPos=idx+1; // 0=rh-cell/label, 1=first data col
    tbl.querySelectorAll('tbody tr, tfoot tr').forEach(tr=>{
      const td=tr.children[colPos];if(td) td.style.display=show?'':'none';
    });
  });
  // Render toggle button
  const sheetWrap=document.querySelector('.sheet-wrap')||document.getElementById('sheet').parentElement;
  const btn=document.createElement('button');
  btn.id='mobile-col-toggle';
  btn.style.cssText='display:block;margin:.35rem 0 .25rem auto;padding:.3rem .65rem;font-size:.8rem;border:1px solid var(--input-border);border-radius:5px;background:var(--panel-bg);color:var(--fg);cursor:pointer;';
  const otherPair=pair===0?1:0;
  const midLabel=Math.floor(cols.length/2);
  btn.textContent=pair===0?'Weeks '+(midLabel+1)+'–'+cols.length+' →':'← Weeks 1–'+midLabel;
  btn.addEventListener('click',()=>{ _mobileColPair=otherPair; applyMobileColVisibility(mk); });
  sheetWrap.parentElement.insertBefore(btn,sheetWrap);
}
let _resizeRenderTimer=null;
let _lastRenderW=window.innerWidth;
window.addEventListener('resize',()=>{
  if(window.innerWidth>=640){ _mobileColPair=null; applyMobileColVisibility(currentMK()); }
  else { const ob=document.getElementById('mobile-col-toggle'); if(ob) ob.remove(); }
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
  const header=['Category','Subcategory',...colLabels,'Total'];
  const out=[header];
  getRows().filter(r=>!r.parentId).forEach(parent=>{
    const kids=children(parent.id);
    const isLinked=parent.linked==='subscriptions'||parent.snapshotLinkedRow;
    if(isLinked){
      const vcs=parent.linked==='subscriptions'?virtualSubChildren():((parent.subsSnapshotByMonth||{})[currentMK()]||virtualSubChildren());
      const vals=getCols().map((col,ci)=>{
        const s=vcs.reduce((t,vc)=>t+(vc.weekCosts?vc.weekCosts[ci]||0:(ci===0?vc.cost:0)),0);
        return s?s.toFixed(2):'';
      });
      out.push([parent.label,'',...vals,rowTotal(parent.id).toFixed(2)]);
      vcs.forEach(vc=>{
        const kVals=getCols().map((col,ci)=>{
          const wc=vc.weekCosts?vc.weekCosts[ci]||0:(ci===0?vc.cost:0);
          return wc?wc.toFixed(2):'';
        });
        out.push(['',vc.label,...kVals,vc.cost.toFixed(2)]);
      });
    } else if(kids.length){
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
      label:parent.label,
      color:parent.color,
      textColor:parent.textColor,
      total:rowTotal(parent.id),
      weeks:colVals,
      subcategories:kids.map(kid=>{
        const kv={};
        getCols().forEach(col=>{ kv[col.label]=getCell(kid.id,col.id)||undefined; });
        return {label:kid.label,total:rowTotal(kid.id),weeks:kv};
      })
    };
  });
  const obj={
    month:mk2,
    monthName:MONTHS_FULL[state.currentMonth]+' '+state.currentYear,
    columns:getCols().map(c=>c.label),
    rows:rowsOut,
    totals:{
      grand:grandTotal(),
      perColumn:Object.fromEntries(getCols().map(col=>[col.label,colTotal(col.id)]))
    }
  };
  const obj2=state.income[mk2];
  if(obj2) obj.income={gross:obj2.gross,tax:obj2.tax};
  return JSON.stringify(obj,null,2);
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
  if(obj.kind==='EXP-MONTH'){
    if(typeof obj.cells!=='object'||Array.isArray(obj.cells)) throw new Error('Invalid blob: bad cells object.');
    if(typeof obj.monthKey!=='string') throw new Error('Invalid blob: missing monthKey.');
  }
  if(obj.kind==='EXP-FULL'){
    if(typeof obj.cellsByMonth!=='object'||Array.isArray(obj.cellsByMonth)) throw new Error('Invalid blob: bad cellsByMonth.');
  }
  if(obj.kind==='SUBS'){
    if(typeof obj.cells!=='object'||Array.isArray(obj.cells)) throw new Error('Invalid blob: bad cells object.');
  }
  
  if(obj.rows.length>500)  throw new Error('Blob rejected: too many rows (max 500).');
  if(obj.cols.length>52)   throw new Error('Blob rejected: too many columns (max 52).');
  if(obj.kind==='EXP-FULL'){
    let totalCells=0;
    Object.values(obj.cellsByMonth).forEach(mc=>{ if(mc&&typeof mc==='object') totalCells+=Object.keys(mc).length; });
    if(totalCells>50000) throw new Error('Blob rejected: too many cells (max 50,000).');
    if(Object.keys(obj.cellsByMonth).length>120) throw new Error('Blob rejected: too many months (max 120).');
  } else if(obj.cells){
    if(Object.keys(obj.cells).length>50000) throw new Error('Blob rejected: too many cells (max 50,000).');
  }
  return migrateBlob(obj);
}
function migrateBlob(obj){
  
  
  return obj;
}


function buildExpMonthBlob(){
  const mk2=currentMK();
  const cells={};
  Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|')) cells[k]=state.cells[k]; });
  const inc=state.income[mk2]||{gross:'',tax:''};
  const rowsByMonth={}; if(state.rowsByMonth&&state.rowsByMonth[mk2]) rowsByMonth[mk2]=JSON.parse(JSON.stringify(state.rowsByMonth[mk2]));
  const colsByMonth={}; if(state.colsByMonth&&state.colsByMonth[mk2]) colsByMonth[mk2]=JSON.parse(JSON.stringify(state.colsByMonth[mk2]));
  return {
    kind:'EXP-MONTH', v:1, monthKey:mk2,
    rows:JSON.parse(JSON.stringify(getRows())),
    cols:JSON.parse(JSON.stringify(getCols())),
    rowsByMonth, colsByMonth,
    cells, income:{gross:inc.gross||'',tax:inc.tax||''},
    headerColWidth:state.headerColWidth, totalColWidth:state.totalColWidth,
    subsSnapshot:virtualSubChildren().map(c=>({label:c.label,cost:c.cost,weekCosts:c.weekCosts})),
  };
}

function buildExpFullBlob(){
  
  const cellsByMonth={};
  Object.keys(state.cells).forEach(k=>{
    const mk2=k.split('|')[0];
    (cellsByMonth[mk2]=cellsByMonth[mk2]||{})[k]=state.cells[k];
  });
  const subsSnapshotByMonth={};
  const subsData=loadSubsState();
  if(subsData&&subsData.rows&&subsData.cols){
    const svcCol=subsData.cols.find(c=>c.ctype==='text');
    for(let y=minY;y<=maxY;y++){
      for(let m2=0;m2<12;m2++){
        if(y===minY&&m2<minM) continue;
        if(y===maxY&&m2>maxM) continue;
        const mk2=mk(y,m2);
        const snap=subsData.rows.map(r=>({
          label:svcCol?subsData.cells[r.id+'|'+svcCol.id]||'-':'-',
          cost:calcSubMonthCostInExp(r,subsData,y,m2),
          weekCosts:getSubWeekCosts(r,subsData,y,m2),
        })).filter(c=>c.cost>0);
        if(snap.length) subsSnapshotByMonth[mk2]=snap;
      }
    }
  }
  return {
    kind:'EXP-FULL', v:1,
    rows:JSON.parse(JSON.stringify(state.rows)),
    cols:JSON.parse(JSON.stringify(state.cols)),
    rowsByMonth:JSON.parse(JSON.stringify(state.rowsByMonth||{})),
    colsByMonth:JSON.parse(JSON.stringify(state.colsByMonth||{})),
    cellsByMonth,
    income:JSON.parse(JSON.stringify(state.income||{})),
    collapsed:JSON.parse(JSON.stringify(state.collapsed||{})),
    headerColWidth:state.headerColWidth, totalColWidth:state.totalColWidth,
    currentYear:state.currentYear, currentMonth:state.currentMonth,
    subsSnapshotByMonth,
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

function restoreSubsLink(rowId){
  if(!confirm('Restore live link to your Subscription Tracker?\nThe pasted snapshot will be replaced with your current subscriptions.')) return;
  snapshot();
  const row=state.rows.find(r=>r.id===rowId); if(!row) return;
  delete row.snapshotLinkedRow;
  delete row.subsSnapshotByMonth;
  row.linked='subscriptions';
  save(); render();
}
function applySubsSnapshot(linkedRow, snapshotByMonth){
  if(!linkedRow||!snapshotByMonth) return;
  if(!linkedRow.subsSnapshotByMonth) linkedRow.subsSnapshotByMonth={};
  Object.assign(linkedRow.subsSnapshotByMonth, snapshotByMonth);
  linkedRow.snapshotLinkedRow=true;
  delete linkedRow.linked;
}

function importExpMonth(blob){
  const mk2=currentMK();
  if(_isClosedMonth(mk2)){showToast('🔒 Month is locked.');return;}
  Object.keys(state.cells).forEach(k=>{ if(k.startsWith(mk2+'|')) delete state.cells[k]; });
  const {blobRowIdMap, blobColIdMap}=_mergeRowsCols(blob.rows||[], blob.cols||[]);
  Object.entries(blob.cells||{}).forEach(([k,v])=>{
    const parts=k.split('|'); 
    const rId=blobRowIdMap[parts[1]], cId=blobColIdMap[parts[2]];
    if(rId&&cId) state.cells[mk2+'|'+rId+'|'+cId]=v;
  });
  if(blob.income) state.income[mk2]={gross:blob.income.gross||'',tax:blob.income.tax||''};
  
  if(blob.rowsByMonth&&blob.rowsByMonth[blob.monthKey]){
    if(!state.rowsByMonth) state.rowsByMonth={};
    state.rowsByMonth[mk2]=JSON.parse(JSON.stringify(blob.rowsByMonth[blob.monthKey]));
  }
  if(blob.colsByMonth&&blob.colsByMonth[blob.monthKey]){
    if(!state.colsByMonth) state.colsByMonth={};
    state.colsByMonth[mk2]=JSON.parse(JSON.stringify(blob.colsByMonth[blob.monthKey]));
  }
  if(blob.subsSnapshot){
    const lr=state.rows.find(r=>r.linked==='subscriptions'||r.snapshotLinkedRow);
    applySubsSnapshot(lr,{[mk2]:blob.subsSnapshot});
  }
}

function importExpFull(blob, selectedMonths){
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
    
    if(blob.income && blob.income[mk2]) state.income[mk2]={gross:blob.income[mk2].gross||'',tax:blob.income[mk2].tax||''};
  });
  
  if(blob.subsSnapshotByMonth){
    const lr=state.rows.find(r=>r.linked==='subscriptions'||r.snapshotLinkedRow);
    const rel={};
    selectedMonths.forEach(mk2=>{if(blob.subsSnapshotByMonth[mk2]) rel[mk2]=blob.subsSnapshotByMonth[mk2];});
    if(Object.keys(rel).length) applySubsSnapshot(lr,rel);
  }
}


function openPasteModal(){
  const overlay=document.createElement('div');overlay.className='share-overlay';
  const modal=document.createElement('div');modal.className='share-modal';
  const h=document.createElement('h3');h.textContent='Paste FiApp data';
  const desc=document.createElement('span');desc.className='share-hint';desc.textContent='Paste a FIAPP-… block copied from another FiApp tracker. Pastes are undoable with Ctrl+Z.';
  const ta=document.createElement('textarea');ta.placeholder='Paste FIAPP-EXP-… or FIAPP-SUBS-… block here';
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
      if(obj.kind==='EXP-MONTH'){
        const [yy,mm]=obj.monthKey.split('-');
        label='This month - '+MONTHS_FULL[parseInt(mm,10)-1]+' '+yy;
      } else if(obj.kind==='EXP-FULL'){
        const months=Object.keys(obj.cellsByMonth||{}).filter(k=>Object.keys(obj.cellsByMonth[k]).length).length;
        if(months===0){
          status.textContent='⚠ This blob has no month data - the spreadsheet was empty when it was copied.';
          status.className='paste-status bad';
          applyBtn.disabled=true;
          parsed=null;
          return;
        }
        label='Full data - '+months+' month'+(months===1?'':'s');
      } else if(obj.kind==='SUBS'){
        label='Subscription tracker (open the Subscription Tracker page to paste)'; applyBtn.disabled=true; status.textContent='⚠ '+label; status.className='paste-status bad'; return;
      } else { throw new Error('Unsupported kind: '+obj.kind); }
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
    if(parsed.kind==='EXP-MONTH'){
      snapshot();importExpMonth(parsed);save();render();syncIncomeInputs();
      overlay.remove();showExportFlash('✓ Pasted (this month)');
    } else if(parsed.kind==='EXP-FULL'){
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
    snapshot();importExpFull(blob,sel);save();render();syncIncomeInputs();
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
    XLSX.utils.book_append_sheet(wb,ws,'Expenses');
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
  const base='expenses-'+ym;
  const menu=document.createElement('div');menu.className='export-menu';
  const formats=[
    {label:'📄 CSV',  fn:()=>downloadText(base+'.csv',buildCsv(),'text/csv;charset=utf-8')},
    {label:'{ } JSON',fn:()=>downloadText(base+'.json',buildJson(),'application/json')},
    {label:'📃 TXT',  fn:()=>downloadText(base+'.txt',buildTxt(),'text/plain;charset=utf-8')},
    {label:'📊 XLSX', fn:()=>exportXlsx(base+'.xlsx')},
    {label:'📋 Copy table - This month', fn:()=>clipboardWrite(encodeBlob(buildExpMonthBlob())).then(ok=>showExportFlash(ok?'✓ Copied (this month)':'Copy failed'))},
    {label:'📋 Copy table - Full data',  fn:()=>clipboardWrite(encodeBlob(buildExpFullBlob())).then(ok=>showExportFlash(ok?'✓ Copied (full)':'Copy failed'))},
  ];
  formats.forEach(f=>{
    const btn=document.createElement('button');btn.textContent=f.label;
    btn.addEventListener('click',e=>{e.stopPropagation();closeExportMenu();closeDropdown('dd-more');f.fn();});
    menu.appendChild(btn);
  });
  // Flyout beside the Export row itself, not up near the "⋯" toggle: the parent overflow
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
  const title='FiApp Expenses - '+MONTHS_SHORT[state.currentMonth]+' '+state.currentYear;
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

  
  const emailXlsxBtn=document.createElement('a');emailXlsxBtn.className='btn btn-sm';emailXlsxBtn.textContent='📧 Email as XLSX';
  const ym=String(state.currentYear)+'-'+String(state.currentMonth+1).padStart(2,'0');
  const xlsxBody='I\'m sharing my FiApp expenses spreadsheet. Open FiApp at https://fiapp.onrender.com/expenses to view your own data.\n\nAttached XLSX file (saved to your Downloads folder): expenses-'+ym+'.xlsx';
  emailXlsxBtn.href=gmailHref(title,xlsxBody);emailXlsxBtn.target='_blank';emailXlsxBtn.rel='noopener noreferrer';
  emailXlsxBtn.addEventListener('click',()=>{
    
    exportXlsx('expenses-'+ym+'.xlsx');
    flash.textContent='XLSX downloading - drag it into Gmail to attach.';
    setTimeout(()=>flash.textContent='',5000);
  });

  
  const emailPasteBtn=document.createElement('a');emailPasteBtn.className='btn btn-sm';emailPasteBtn.textContent='📧 Email as Paste-link';
  const blob=encodeBlob(buildExpMonthBlob());
  const pasteBody=('I\'m sharing my FiApp expense data for '+MONTHS_SHORT[state.currentMonth]+' '+state.currentYear+'.\n\nPaste this block into the FiApp Expense Tracker at https://fiapp.onrender.com/expenses using the 📋 Paste button to load the data:\n\n'+blob).slice(0,2000);
  emailPasteBtn.href=gmailHref(title,pasteBody);emailPasteBtn.target='_blank';emailPasteBtn.rel='noopener noreferrer';

  const closeBtn=document.createElement('button');closeBtn.className='btn btn-sm btn-ghost';closeBtn.textContent='Close';
  closeBtn.addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});

  actions.appendChild(flash);
  actions.appendChild(copyBtn);
  actions.appendChild(emailTextBtn);
  actions.appendChild(emailXlsxBtn);
  actions.appendChild(emailPasteBtn);
  actions.appendChild(closeBtn);

  modal.appendChild(h);modal.appendChild(ta);modal.appendChild(hint);modal.appendChild(actions);
  overlay.appendChild(modal);document.body.appendChild(overlay);
}


(function(){
  const tip=document.createElement('div');tip.id='swatch-tip';document.body.appendChild(tip);
  let hideT;
  function show(el){
    clearTimeout(hideT);
    const label=el.dataset.tip; if(!label) return;
    tip.textContent=label;
    tip.classList.add('show');
    
    const r=el.getBoundingClientRect();
    tip.style.left=(r.left+r.width/2-tip.offsetWidth/2)+'px';
    tip.style.top=(r.top-tip.offsetHeight-6)+'px';
    
    requestAnimationFrame(()=>{
      const r2=el.getBoundingClientRect();
      tip.style.left=Math.max(4,r2.left+r2.width/2-tip.offsetWidth/2)+'px';
      tip.style.top=(r2.top-tip.offsetHeight-6)+'px';
    });
  }
  function hide(){ hideT=setTimeout(()=>tip.classList.remove('show'),80); }
  
  document.addEventListener('mouseover',e=>{
    const h=e.target.closest('.tip-host[data-tip]');
    if(h) show(h); else hide();
  });
  document.addEventListener('mouseout',e=>{
    if(!e.target.closest('.tip-host[data-tip]')) hide();
  });
  
  document.addEventListener('touchstart',e=>{
    const h=e.target.closest('.tip-host[data-tip]');
    
    document.querySelectorAll('.tip-host.tip-visible').forEach(el=>{ if(el!==h) el.classList.remove('tip-visible'); });
    if(h){
      h.classList.add('tip-visible');
      show(h);
    } else {
      hide();
    }
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
  try{ loadTaxCarryover(); }catch(e){}
  try{ updateHistBtns(); }catch(e){}
  try{ updateMonthNav(); }catch(e){ console.error('FiApp: updateMonthNav failed',e); }
  try{ syncIncomeInputs(); }catch(e){}
  try{ render(); }catch(e){ console.error('FiApp: render failed',e); }

  // D (Playful): a one-off, dismissable orientation tip, once per session. No-op for
  // Default/Quiet (gated inside fiappMascotTip) and skipped while the walkthrough runs.
  try{ if(window.fiappMascotTip && !(typeof isWalkthroughActive==='function'&&isWalkthroughActive())) fiappMascotTip('Tip: each month keeps its own categories and columns. Use the month picker up top to switch.','exp-tip'); }catch(_){}

  // Background: establish auth (bounded - a stalled network must not hang the
  // page), refresh from the server, and re-render only if the data changed.
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
  const _preSubs=localStorage.getItem(SUBS_KEY);
  try{ await loadFromServer(); }catch(e){ console.warn('FiApp: loadFromServer failed',e); }
  try{ await loadSubsFromServer(); }catch(e){ console.warn('FiApp: loadSubsFromServer failed',e); }
  // JSONB round-trips reorder object keys, so raw strings can differ even when the
  // data is identical; compare semantically so a plain online load doesn't force a
  // focus-destroying cosmetic re-render.
  const _blobChanged=(pre,key)=>{
    const post=localStorage.getItem(key);
    if(post===pre) return false;
    try{ return !_deepEqual(JSON.parse(pre||'null'),JSON.parse(post||'null')); }catch(_){ return true; }
  };
  if(_blobChanged(_preRaw,STORAGE_KEY) || _blobChanged(_preSubs,SUBS_KEY)){
    try{ state=loadState(); }catch(e){}
    try{ _monthsWithDataAtLoad=new Set(Object.keys(state.cells||{}).filter(k=>parseFloat(state.cells[k])>0).map(k=>k.split('|')[0])); }catch(e){ _monthsWithDataAtLoad=new Set(); }
    try{ updateMonthNav(); }catch(e){}
    try{ syncIncomeInputs(); }catch(e){}
    try{ render(); }catch(e){ console.error('FiApp: render failed',e); }
  }

  fetchExpRates().then(()=>{ syncIncomeInputs(); if(getRows().some(r=>r.linked==='subscriptions')) render(); }).catch(()=>{});

  syncFromIncomeTracker(currentMK()).catch(()=>{});

  window.addEventListener('storage',e=>{
    if(e.key===SUBS_KEY) render();
    if(e.key===INCOME_KEY||e.key===INCOME_PUSH_KEY) syncFromIncomeTracker(currentMK()).catch(()=>{});
  });
})();

// Static toolbar event wiring (replaces onclick= attributes)
document.getElementById('help-open-btn').addEventListener('click',openHelp);
document.getElementById('guide-btn').addEventListener('click',function(){wtStartEnhanced('expenses');});
document.getElementById('prev-btn').addEventListener('click',function(){shiftMonth(-1);});
document.getElementById('next-btn').addEventListener('click',function(){shiftMonth(1);});
document.getElementById('copy-prev-btn').addEventListener('click',copyStructureFromPrevMonth);
document.getElementById('copy-month-btn').addEventListener('click',showMonthCopyPicker);
document.getElementById('forecast-copy-last-btn').addEventListener('click',copyLastMonth);
document.getElementById('forecast-avg-btn').addEventListener('click',useAverages);
document.getElementById('apply-year-btn').addEventListener('click',applyIncomeToYear);
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
document.getElementById('import-btn').addEventListener('click',function(){if(window.openImportWizard) openImportWizard();});
document.getElementById('expand-btn').addEventListener('click',expandAll);
document.getElementById('collapse-btn').addEventListener('click',collapseAll);
document.getElementById('reset-btn').addEventListener('click',resetAll);
document.getElementById('chart-mode-m').addEventListener('click',function(){setChartMode('monthly');});
document.getElementById('chart-mode-y').addEventListener('click',function(){setChartMode('yearly');});
document.getElementById('chart-type-bar').addEventListener('click',function(){setChartType('bar');});
document.getElementById('chart-type-doughnut').addEventListener('click',function(){setChartType('doughnut');});
// Help modal: close on overlay click or close button
document.getElementById('help-modal').addEventListener('click',function(e){if(e.target===this)closeHelp();});
document.getElementById('help-close-btn').addEventListener('click',closeHelp);
// CSP: bound here instead of inline attributes in expenses.html
document.getElementById('month-jump').addEventListener('change',function(){jumpToMonth(this.value);});
// close-bar button's click is wired dynamically in updateCloseBar() (reopenMonth when the
// month is locked, openCloseModal otherwise) — no static listener here, or clicking Reopen
// would also fire openCloseModal and pop the close dialog.
(function(){var b=document.getElementById('close-modal-cancel');if(b)b.addEventListener('click',cancelClose);})();
(function(){var b=document.getElementById('close-modal-confirm');if(b)b.addEventListener('click',confirmClose);})();
document.getElementById('inp-tax').addEventListener('input',onIncomeInput);
(function(){var b=document.getElementById('voice-strip-dismiss');if(b)b.addEventListener('click',function(){this.parentElement.style.display='none';});})();

function openHelp(){ document.getElementById('help-modal').style.display='flex'; }
function closeHelp(){ document.getElementById('help-modal').style.display='none'; }

function toggleDropdown(id, e){
  e && e.stopPropagation();
  const menu = document.getElementById(id+'-menu');
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.dropdown-menu.open').forEach(m=>m.classList.remove('open'));
  if(!isOpen) menu.classList.add('open');
}
function closeDropdown(id){ document.getElementById(id+'-menu').classList.remove('open'); }
document.addEventListener('click', ()=>{ document.querySelectorAll('.dropdown-menu.open').forEach(m=>m.classList.remove('open')); });
document.addEventListener('keydown',function(e){ if(e.key==='Escape') document.querySelectorAll('.dropdown-menu.open').forEach(function(m){m.classList.remove('open');}); });

// ── Batch D Wave 4: mobile quick-add sheet ──────────────────────────────
// Picks the week-column matching today's date (or Week 1 for a non-current
// month); Save is additive to whatever is already in that cell, per the
// "I just spent X" mental model rather than overwriting a week's running total.
function _qaCurrentWeekCol(){
  var cols=getCols();
  if(!cols.length) return null;
  var now=new Date();
  var isCurrent=state.currentYear===now.getFullYear()&&state.currentMonth===now.getMonth();
  var day=isCurrent?now.getDate():1;
  var idx=Math.min(cols.length-1,Math.floor((day-1)/7));
  return cols[idx];
}
function openQuickAdd(){
  var sheet=document.getElementById('qa-sheet');
  var backdrop=document.getElementById('qa-backdrop');
  if(!sheet||!backdrop) return;
  var chips=document.getElementById('qa-chips');
  chips.innerHTML='';
  // Offer every directly-editable (leaf) category: childless top-level rows AND
  // subcategories. A parent that has subcategories is excluded because its cell is a
  // computed sum of its children; a subscriptions-linked / auto-filled row is excluded too
  // (a write there is overwritten on the next render). Subcategories are labelled
  // "Parent > Child" so they read distinctly from top-level categories.
  var _qaRows=getRows();
  _qaRows.filter(function(r){
    return !hasChildren(r.id) && r.linked!=='subscriptions' && !r.snapshotLinkedRow;
  }).forEach(function(row,i){
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
// The quick-add FAB's only mode used to be "add to this week's total" - there was no
// mobile-friendly way to record a refund/correction without opening the row and doing
// the subtraction by hand. This toggle picks the sign; the amount you type is always
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
  // Belt-and-braces: never write to a subscriptions-linked (auto-filled) row, even if a
  // stale chip somehow points at one.
  var _qaRow=getRows().find(function(r){return r.id===chip.dataset.rowId;});
  if(_qaRow && (_qaRow.linked==='subscriptions'||_qaRow.snapshotLinkedRow)) return;
  var col=_qaCurrentWeekCol();
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
    // Desktop already shows the whole spreadsheet - every cell is already visible
    // and one click away, so there's nothing to "jump to". The one thing that's
    // genuinely new to add here is a new category row (same action as the
    // overflow menu's "Add row"), so that's what desktop Add does.
    addRow();
    var wrap=document.getElementById('exp-sheet-wrap');
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

// ── Voice Input Bridge ──────────────────────────────────────────────────
window._expVoiceBridge = {
  getRows, getCols, currentMK, snapshot, setCell, updateAll, render,
  addRow, forkCurrentMonth, deleteRow,
  addSubRow: function(parentRowId, subLabel) {
    var parentRow = getRows().find(function(r){ return r.id === parentRowId; });
    if (parentRow) addSubRow(parentRow, subLabel);
  },
  getCell: function(rId, cId) { return state.cells[currentMK()+'|'+rId+'|'+cId]; },
  isLockedMonth:   function() { return _isClosedMonth(currentMK()); },
  isForecastMonth: function() { return isForecastMonth(); },
  // Expenses has no per-row currency — every cell is always in the account's home
  // currency. voice-input.js uses this to convert a spoken amount before committing
  // it, instead of writing raw digits into a cell it thinks is already home-currency.
  homeCurrency: function() { return _homeCur(); },
};
