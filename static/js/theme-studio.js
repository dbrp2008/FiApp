/* theme-studio.js - the Theme Studio editor (account page only).
 * Depends on theme-core.js (FIAPP_PRESETS, fiappApplyTheme, fiappThemesCache, ...).
 * Colour math is pure sRGB linear mixing; no libraries.
 */
(function(){
  'use strict';
  if (!window.fiappThemesCache) return;            // theme-core.js not present
  var card = document.getElementById('theme-studio');
  if (!card) return;                               // not on the account page

  var TOK = window.FIAPP_CUSTOM_TOKENS || {};
  var LIGHT = window.FIAPP_LIGHT_TOKENS || {};
  var MAX = window.FIAPP_MAX_THEMES || 10;
  var PRESETS = window.FIAPP_PRESETS || {};
  var CSRF = window._CSRF || '';

  // ---- colour helpers --------------------------------------------------------
  function h2r(hex){
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
  }
  function r2h(rgb){
    return '#' + rgb.map(function(c){ var s = Math.max(0,Math.min(255,Math.round(c))).toString(16); return s.length<2?'0'+s:s; }).join('');
  }
  function mix(a, b, t){ var A=h2r(a), B=h2r(b); return r2h([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t]); }
  function shade(hex, t){ return mix(hex, '#000000', t); }
  function tint(hex, t){ return mix(hex, '#ffffff', t); }
  function rgba(hex, a){ var c=h2r(hex); return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')'; }

  // ---- derivation: 5 seeds -> full token map ---------------------------------
  function seedsToTokens(seeds, mode){
    var accent = seeds.accent, gradFrom = seeds.gradFrom, gradTo = seeds.gradTo, tintc = seeds.tint;
    var t = {};
    t['--accent'] = accent;
    t['--grad-from'] = gradFrom; t['--grad-to'] = gradTo;
    t['--glow-1'] = rgba(gradFrom, 0.22); t['--glow-2'] = rgba(gradTo, 0.18);
    t['--glass-blur'] = '12px';
    t['--elev-hero'] = '0 10px 28px ' + rgba(gradFrom, 0.30);
    t['--elev-cta'] = '0 6px 16px ' + rgba(gradFrom, 0.28);
    t['--bg'] = tintc;

    if (mode === 'dark') {
      t['--accent-strong'] = shade(accent, 0.20);
      t['--link'] = tint(accent, 0.25); t['--link-text'] = tint(accent, 0.25);
      t['--panel-bg'] = mix(tintc, '#ffffff', 0.06);
      t['--panel-border'] = mix(tintc, '#ffffff', 0.12);
      t['--hover-bg'] = mix(tintc, '#ffffff', 0.12);
      t['--input-bg'] = mix(tintc, '#ffffff', 0.06);
      t['--input-border'] = mix(tintc, '#ffffff', 0.20);
      t['--input-focus'] = mix(tintc, accent, 0.30);
      t['--fg'] = mix('#e2e8f0', accent, 0.06);
      t['--muted'] = mix('#94a3b8', accent, 0.06);
      t['--th-bg'] = t['--row-header-bg'] = t['--result-bg'] = mix(tintc, '#ffffff', 0.06);
      t['--th-fg'] = t['--row-header-fg'] = t['--secondary-fg'] = mix('#e2e8f0', accent, 0.06);
      t['--secondary-bg'] = mix(tintc, '#ffffff', 0.12);
      t['--secondary-hover'] = mix(tintc, '#ffffff', 0.20);
      t['--total-bg'] = mix(tintc, gradTo, 0.35);
      t['--total-fg'] = tint(gradTo, 0.55);
      t['--total-soft'] = mix(tintc, gradTo, 0.10);
      t['--overlay'] = 'rgba(0,0,0,.85)';
      t['--shadow'] = '0 4px 16px rgba(0,0,0,.7)';
      t['--shadow-soft'] = '0 2px 8px rgba(0,0,0,.3)';
      t['--tooltip-bg'] = '#f1f5f9'; t['--tooltip-fg'] = tintc;
      t['--result-border'] = mix(tintc, '#ffffff', 0.12);
      t['--error-bg'] = '#450a0a'; t['--error-fg'] = '#fca5a5'; t['--error-border'] = '#7f1d1d';
      t['--success-bg'] = '#052e16'; t['--success-fg'] = '#86efac'; t['--success-border'] = '#065f46';
      t['--elev-1'] = '0 2px 8px rgba(0,0,0,.5)';
      t['--elev-2'] = '0 8px 24px rgba(0,0,0,.6)';
      t['--elev-3'] = '0 12px 32px rgba(0,0,0,.7)';
      t['--tabbar-bg'] = rgba(shade(tintc, 0.10), 0.94);
      t['--track-bg'] = 'rgba(255,255,255,.10)';
      t['--glass-bg'] = 'rgba(255,255,255,.06)';
      t['--glass-border'] = 'rgba(255,255,255,.12)';
      t['--shell-rail-bg'] = rgba(tintc, 0.88);
    } else {
      var deep = shade(accent, 0.62);
      t['--accent-strong'] = shade(accent, 0.14);
      t['--link'] = accent; t['--link-text'] = shade(accent, 0.14);
      t['--panel-bg'] = mix(tintc, accent, 0.10);
      t['--panel-border'] = mix(tintc, accent, 0.24);
      t['--hover-bg'] = mix(tintc, accent, 0.24);
      t['--input-focus'] = mix(tintc, accent, 0.10);
      t['--th-bg'] = t['--row-header-bg'] = t['--result-bg'] = mix(tintc, accent, 0.10);
      t['--th-fg'] = t['--row-header-fg'] = t['--secondary-fg'] = deep;
      t['--secondary-bg'] = mix(tintc, accent, 0.24);
      t['--secondary-hover'] = mix(tintc, accent, 0.38);
      t['--total-bg'] = mix(tintc, gradTo, 0.30);
      t['--total-fg'] = shade(gradTo, 0.62);
      t['--total-soft'] = mix(tintc, gradTo, 0.08);
      t['--glass-bg'] = 'rgba(255,255,255,.60)';
      t['--glass-border'] = rgba(deep, 0.10);
      t['--shell-rail-bg'] = rgba(mix(tintc, accent, 0.10), 0.78);
    }
    return t;
  }

  function reverseSeeds(tokens){
    return { accent: tokens['--accent'] || '#7c3aed', gradFrom: tokens['--grad-from'] || '#7c3aed',
             gradTo: tokens['--grad-to'] || '#0891b2', tint: tokens['--bg'] || '#f1f2f8' };
  }

  // ---- WCAG contrast ---------------------------------------------------------
  function _lin(c){ c = c/255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
  function _lum(hex){ var c = h2r(hex); return 0.2126*_lin(c[0]) + 0.7152*_lin(c[1]) + 0.0722*_lin(c[2]); }
  function contrastRatio(a, b){
    if (!/^#/.test(a) || !/^#/.test(b)) return null;   // only hex pairs
    var la = _lum(a), lb = _lum(b), hi = Math.max(la,lb), lo = Math.min(la,lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  // ---- editor state ----------------------------------------------------------
  var listEl = card.querySelector('#ts-list');
  var editorEl = card.querySelector('#ts-editor');
  var nameInp = card.querySelector('#ts-name');
  var modeLight = card.querySelector('#ts-mode-light');
  var modeDark = card.querySelector('#ts-mode-dark');
  var seedWrap = card.querySelector('#ts-seeds');
  var advWrap = card.querySelector('#ts-advanced');
  var contrastEl = card.querySelector('#ts-contrast');
  var feedbackEl = card.querySelector('#ts-feedback');
  var countEl = card.querySelector('#ts-count');
  var newBtns = card.querySelector('#ts-new-buttons');

  var editing = null;           // the theme object being edited (draft)
  var prevActive = null;        // theme value active before opening the editor (for cancel)
  var SEED_LABELS = { accent:'Accent', gradFrom:'Gradient start', gradTo:'Gradient end', tint:'Background tint' };

  function rand8(){ var s='', c='abcdefghijklmnopqrstuvwxyz0123456789'; for (var i=0;i<8;i++) s+=c.charAt(Math.floor(Math.random()*c.length)); return s; }
  function envelope(){ return fiappThemesCache.read(); }
  function feedback(msg, kind){
    feedbackEl.textContent = msg || '';
    feedbackEl.style.color = kind === 'bad' ? 'var(--sem-bad)' : (kind === 'ok' ? 'var(--sem-ok)' : 'var(--muted)');
  }

  function renderList(){
    var themes = envelope().themes;
    countEl.textContent = themes.length + ' of ' + MAX;
    listEl.innerHTML = '';
    if (!themes.length){
      var p = document.createElement('p');
      p.className = 'ts-empty'; p.textContent = 'No custom themes yet. Start from a preset or a blank theme below.';
      listEl.appendChild(p);
    }
    var active = localStorage.getItem('fiapp_theme') || 'light';
    themes.forEach(function(t){
      var row = document.createElement('div'); row.className = 'ts-row';
      var sw = document.createElement('span'); sw.className = 'ts-swatches';
      [t.tokens['--accent'], t.tokens['--grad-to'], t.tokens['--bg']].forEach(function(c){
        var d = document.createElement('span'); d.className = 'ts-swatch'; d.style.background = c || '#ccc'; sw.appendChild(d);
      });
      var nm = document.createElement('span'); nm.className = 'ts-row-name';
      nm.textContent = t.name + (('custom:'+t.id) === active ? '  (active)' : '');
      var acts = document.createElement('span'); acts.className = 'ts-row-actions';
      acts.appendChild(btn('Apply', function(){ applyTheme('custom:'+t.id); }));
      acts.appendChild(btn('Edit', function(){ openEditor(t); }));
      acts.appendChild(btn('Duplicate', function(){ duplicate(t); }));
      acts.appendChild(btn('Delete', function(){ del(t); }, 'ts-danger'));
      row.appendChild(sw); row.appendChild(nm); row.appendChild(acts);
      listEl.appendChild(row);
    });
    newBtns.querySelectorAll('button, .ts-chip').forEach(function(b){
      b.disabled = themes.length >= MAX;
      b.style.opacity = themes.length >= MAX ? '.5' : '';
    });
  }

  function btn(label, fn, cls){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-ghost btn-sm' + (cls ? ' '+cls : '');
    b.textContent = label; b.addEventListener('click', fn); return b;
  }

  function applyTheme(value){
    if (window.fiappApplyThemeAnimated) fiappApplyThemeAnimated(value);
    else fiappApplyTheme(value);
    localStorage.setItem('fiapp_theme', value);
    persistActive(value);
    if (window.setTheme) { /* keep topbar in sync without re-persisting */ }
    var tb = document.getElementById('theme-btn');
    if (tb && window.fiappThemeLabel) tb.textContent = fiappThemeLabel(value);
    window.dispatchEvent(new CustomEvent('fiapp-themes-changed'));
    renderList();
  }

  function persistActive(value){
    if (!CSRF) return;
    fetch('/api/prefs', {method:'PATCH', headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},
      body: JSON.stringify({theme: value})}).catch(function(){});
  }

  // Save the full list to the server + cache; used after any create/edit/delete.
  function saveList(env, activeValue){
    fiappThemesCache.write(env);
    localStorage.setItem('fiapp_themes_dirty', '1');
    var body = {themes_custom: env};
    if (activeValue) body.theme = activeValue;
    if (!CSRF){ localStorage.removeItem('fiapp_themes_dirty'); window.dispatchEvent(new CustomEvent('fiapp-themes-changed')); renderList(); return; }
    fetch('/api/prefs', {method:'PATCH', headers:{'Content-Type':'application/json','X-CSRF-Token':CSRF},
      body: JSON.stringify(body)}).then(function(r){
        if (r.ok){ localStorage.removeItem('fiapp_themes_dirty'); feedback('Saved.', 'ok'); }
        else { r.json().then(function(d){ feedback((d && d.error) || 'Could not save.', 'bad'); }).catch(function(){ feedback('Could not save.', 'bad'); }); }
      }).catch(function(){ feedback('Saved on this device (will sync when online).', 'ok'); });
    window.dispatchEvent(new CustomEvent('fiapp-themes-changed'));
    renderList();
  }

  // ---- create / duplicate / delete -------------------------------------------
  function newFromPreset(name){
    var p = PRESETS[name]; if (!p) return;
    // Keep the preset flag so an untouched Midnight can lock its Light button (below).
    startEditor({ id:'ct_'+rand8(), name: name.charAt(0).toUpperCase()+name.slice(1), mode:p.mode,
      preset:name, seeds: Object.assign({}, p.seeds), overrides:{}, tokens: Object.assign({}, p.tokens) }, true);
  }
  function _isLightColor(hex){ try { return _lum(normHex(hex)) > 0.4; } catch(_) { return true; } }
  function newBlank(mode){
    var seeds = mode === 'dark' ? {accent:'#60a5fa',gradFrom:'#3b82f6',gradTo:'#22d3ee',tint:'#0f172a'}
                                : {accent:'#7c3aed',gradFrom:'#7c3aed',gradTo:'#0891b2',tint:'#f1f2f8'};
    startEditor({ id:'ct_'+rand8(), name:'My theme', mode:mode, preset:null, seeds:seeds, overrides:{},
      tokens: seedsToTokens(seeds, mode) }, true);
  }
  function duplicate(t){
    var env = envelope();
    if (env.themes.length >= MAX){ feedback('Theme limit reached (' + MAX + ').', 'bad'); return; }
    var copy = JSON.parse(JSON.stringify(t)); copy.id = 'ct_'+rand8(); copy.name = (t.name + ' copy').slice(0,24);
    env.themes.push(copy); saveList(env);
  }
  function del(t){
    var env = envelope();
    env.themes = env.themes.filter(function(x){ return x.id !== t.id; });
    var active = localStorage.getItem('fiapp_theme');
    var newActive = null;
    if (active === 'custom:'+t.id){ newActive = t.mode === 'dark' ? 'dark' : 'light'; localStorage.setItem('fiapp_theme', newActive); fiappApplyTheme(newActive); }
    saveList(env, newActive);
    if (editing && editing.id === t.id) closeEditor();
  }

  // ---- editor open/close -----------------------------------------------------
  function openEditor(t){ startEditor(JSON.parse(JSON.stringify(t)), false); }
  function startEditor(draft, isNew){
    editing = draft; editing._isNew = isNew;
    prevActive = localStorage.getItem('fiapp_theme') || 'light';
    nameInp.value = draft.name;
    modeLight.classList.toggle('active', draft.mode === 'light');
    modeDark.classList.toggle('active', draft.mode === 'dark');
    updateModeButtons();
    buildSeedInputs(); buildAdvanced(); liveApply();
    editorEl.style.display = 'block';
    feedback('');
    editorEl.scrollIntoView({block:'nearest'});
  }
  function closeEditor(){ editing = null; editorEl.style.display = 'none'; }

  // Midnight exists to be a night theme: while it is still the untouched preset, its Light
  // button is locked. Any edit clears the preset flag and unlocks it.
  function updateModeButtons(){
    var lock = !!(editing && editing.preset === 'midnight');
    modeLight.disabled = lock;
    modeLight.title = lock ? 'Midnight is a dark theme. Edit a colour to unlock a light variant.' : '';
    modeLight.style.opacity = lock ? '.45' : '';
    modeLight.style.cursor = lock ? 'not-allowed' : '';
  }

  function buildSeedInputs(){
    seedWrap.innerHTML = '';
    ['accent','gradFrom','gradTo','tint'].forEach(function(key){
      var wrap = document.createElement('label'); wrap.className = 'ts-seed';
      var inp = document.createElement('input'); inp.type = 'color'; inp.value = normHex(editing.seeds[key]);
      inp.setAttribute('aria-label', SEED_LABELS[key]);
      inp.addEventListener('input', function(){
        editing.seeds[key] = inp.value;
        editing.preset = null;
        editing.tokens = Object.assign(seedsToTokens(editing.seeds, editing.mode), editing.overrides);
        updateModeButtons(); buildAdvanced(); liveApply();
      });
      var span = document.createElement('span'); span.textContent = SEED_LABELS[key];
      wrap.appendChild(inp); wrap.appendChild(span);
      seedWrap.appendChild(wrap);
    });
  }

  // Advanced: every allowlisted token for the mode, as a colour input (colour tokens) or a
  // read-only chip (length/shadow tokens - not worth a bespoke editor). Editing a colour
  // pins it as an override and does NOT rederive the rest.
  function buildAdvanced(){
    advWrap.innerHTML = '';
    var keys = Object.keys(TOK).filter(function(k){
      return editing.mode === 'dark' ? true : (LIGHT[k] !== undefined);
    });
    keys.forEach(function(k){
      var type = TOK[k];
      var row = document.createElement('div'); row.className = 'ts-adv-row';
      var lab = document.createElement('span'); lab.className = 'ts-adv-label'; lab.textContent = k.replace(/^--/,'');
      row.appendChild(lab);
      if (type === 'color' && /^#/.test(editing.tokens[k] || '')){
        var inp = document.createElement('input'); inp.type = 'color'; inp.value = normHex(editing.tokens[k]);
        inp.setAttribute('aria-label', k);
        inp.addEventListener('input', function(){
          editing.tokens[k] = inp.value; editing.overrides[k] = inp.value; editing.preset = null; updateModeButtons(); liveApply();
        });
        row.appendChild(inp);
      } else {
        var chip = document.createElement('span'); chip.className = 'ts-adv-chip'; chip.textContent = editing.tokens[k] || '(inherited)';
        row.appendChild(chip);
      }
      advWrap.appendChild(row);
    });
  }

  function normHex(v){ return (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : (/^#[0-9a-fA-F]{3}$/.test(v) ? mix(v, v, 0) : '#000000'); }

  // Live preview: apply the draft's tokens to <html> without persisting. One cssText write
  // (not dozens of setProperty calls) keeps dragging a colour picker smooth.
  function liveApply(){
    var el = document.documentElement, css = '';
    el.classList.toggle('dark', editing.mode === 'dark');
    for (var k in editing.tokens){
      if (TOK[k] && window.fiappValidTokenValue(TOK[k], editing.tokens[k])) css += k + ':' + editing.tokens[k] + ';';
    }
    el.style.cssText = css;
    updateContrast();
  }

  function updateContrast(){
    var bg = editing.tokens['--bg'], fg = editing.mode === 'dark' ? editing.tokens['--fg'] : '#1f2937';
    var panel = editing.tokens['--panel-bg'];
    var c1 = contrastRatio(bg, fg), c2 = contrastRatio(panel, fg);
    var worst = Math.min(c1 || 99, c2 || 99);
    contrastEl.innerHTML = '';
    var badge = document.createElement('span');
    var label = worst >= 7 ? 'AAA' : worst >= 4.5 ? 'AA' : 'Low contrast';
    var kind = worst >= 4.5 ? 'ok' : 'bad';
    badge.className = 'ts-badge ts-badge-' + kind;
    badge.textContent = 'Text contrast ' + worst.toFixed(1) + ':1 - ' + label;
    contrastEl.appendChild(badge);
  }

  function commit(){
    var name = (nameInp.value || '').trim();
    if (!name){ feedback('Give your theme a name.', 'bad'); return; }
    if (name.length > 24) name = name.slice(0,24);
    editing.name = name;
    var env = envelope();
    var idx = -1;
    env.themes.forEach(function(t, i){ if (t.id === editing.id) idx = i; });
    var dupe = env.themes.some(function(t, i){ return i !== idx && t.name.toLowerCase() === name.toLowerCase(); });
    if (dupe){ feedback('You already have a theme named "' + name + '". Pick a different name.', 'bad'); return; }
    if (idx === -1 && env.themes.length >= MAX){ feedback('Theme limit reached (' + MAX + ').', 'bad'); return; }
    var clean = { id: editing.id, name: name, mode: editing.mode, preset: editing.preset,
      seeds: editing.seeds, overrides: editing.overrides, tokens: editing.tokens };
    if (idx === -1) env.themes.push(clean); else env.themes[idx] = clean;
    var value = 'custom:' + editing.id;
    localStorage.setItem('fiapp_theme', value);
    saveList(env, value);
    var tb = document.getElementById('theme-btn');
    if (tb && window.fiappThemeLabel) tb.textContent = fiappThemeLabel(value);
    closeEditor();
  }
  function cancel(){
    // restore whatever theme was active before editing
    fiappApplyTheme(prevActive || 'light');
    closeEditor();
  }

  // ---- wire static controls --------------------------------------------------
  card.querySelector('#ts-save').addEventListener('click', commit);
  card.querySelector('#ts-cancel').addEventListener('click', cancel);
  modeLight.addEventListener('click', function(){ if (!modeLight.disabled) setMode('light'); });
  modeDark.addEventListener('click', function(){ setMode('dark'); });
  function setMode(mode){
    if (!editing || editing.mode === mode) return;
    editing.mode = mode;
    // Re-base the background tint for the new mode: a light preset flipped to Dark gets a
    // real dark, accent-tinted background (and a dark theme flipped to Light gets a light
    // one) instead of an unreadable wrong-luminance background. Advanced overrides survive.
    var tintLight = _isLightColor(editing.seeds.tint);
    if (mode === 'dark' && tintLight) editing.seeds.tint = mix('#0f172a', editing.seeds.accent, 0.12);
    else if (mode === 'light' && !tintLight) editing.seeds.tint = mix('#ffffff', editing.seeds.accent, 0.05);
    editing.tokens = Object.assign(seedsToTokens(editing.seeds, mode), editing.overrides);
    editing.preset = null;
    modeLight.classList.toggle('active', mode === 'light');
    modeDark.classList.toggle('active', mode === 'dark');
    updateModeButtons(); buildSeedInputs(); buildAdvanced(); liveApply();
  }
  nameInp.addEventListener('input', function(){ if (editing) editing.name = nameInp.value; });

  Object.keys(PRESETS).forEach(function(name){
    var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'ts-chip';
    chip.textContent = name.charAt(0).toUpperCase()+name.slice(1);
    chip.addEventListener('click', function(){ newFromPreset(name); });
    newBtns.appendChild(chip);
  });
  var bl = document.createElement('button'); bl.type='button'; bl.className='ts-chip ts-chip-blank'; bl.textContent='Blank light';
  bl.addEventListener('click', function(){ newBlank('light'); }); newBtns.appendChild(bl);
  var bd = document.createElement('button'); bd.type='button'; bd.className='ts-chip ts-chip-blank'; bd.textContent='Blank dark';
  bd.addEventListener('click', function(){ newBlank('dark'); }); newBtns.appendChild(bd);

  window.addEventListener('fiapp-themes-changed', renderList);
  renderList();

  // Exposed for calibration/tests.
  window.fiappStudio = { seedsToTokens: seedsToTokens, reverseSeeds: reverseSeeds, contrastRatio: contrastRatio, mix: mix, shade: shade, tint: tint };
})();
