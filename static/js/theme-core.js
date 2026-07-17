/* theme-core.js - custom-theme engine, loaded SYNCHRONOUSLY in <head> before the theme
 * boot script of every page (base/login/404/500). Keep it dependency-free and fast: it
 * runs before first paint, so anything slow here delays rendering.
 *
 * Model: built-in themes are only 'light' and 'dark' (CSS :root / html.dark). Everything
 * else is a CUSTOM theme: a named, per-user token dictionary applied as inline CSS custom
 * properties on <html> on top of a base-mode class (.dark or none). The 7 pre-redesign
 * themes (ocean/forest/sunset/midnight/rose/purple/indigo) live on as PRESETS below -
 * exact token snapshots of their old CSS blocks, so a migrated user sees zero change.
 */
(function(){
  'use strict';

  // ---- Token allowlists ----------------------------------------------------
  // type: 'color' (hex or rgba), 'length' (Npx), 'shadow' (offset/blur/color layers).
  var LIGHT_TOKENS = {
    '--accent':'color','--accent-strong':'color','--link':'color','--link-text':'color',
    '--bg':'color','--panel-bg':'color','--panel-border':'color','--hover-bg':'color',
    '--input-focus':'color','--total-bg':'color','--total-fg':'color','--total-soft':'color',
    '--th-bg':'color','--th-fg':'color','--row-header-bg':'color','--row-header-fg':'color',
    '--secondary-bg':'color','--secondary-fg':'color','--secondary-hover':'color',
    '--result-bg':'color','--grad-from':'color','--grad-to':'color',
    '--glow-1':'color','--glow-2':'color','--glass-bg':'color','--glass-border':'color',
    '--glass-blur':'length','--shell-rail-bg':'color',
    '--elev-hero':'shadow','--elev-cta':'shadow'
  };
  var DARK_EXTRA_TOKENS = {
    '--fg':'color','--muted':'color','--input-bg':'color','--input-border':'color',
    '--overlay':'color','--shadow':'shadow','--shadow-soft':'shadow',
    '--tooltip-bg':'color','--tooltip-fg':'color',
    '--error-bg':'color','--error-fg':'color','--error-border':'color',
    '--success-bg':'color','--success-fg':'color','--success-border':'color',
    '--result-border':'color',
    '--elev-1':'shadow','--elev-2':'shadow','--elev-3':'shadow',
    '--tabbar-bg':'color','--track-bg':'color'
  };
  var ALL_TOKENS = {};
  var k;
  for (k in LIGHT_TOKENS) ALL_TOKENS[k] = LIGHT_TOKENS[k];
  for (k in DARK_EXTRA_TOKENS) ALL_TOKENS[k] = DARK_EXTRA_TOKENS[k];

  // ---- Presets ---------------------------------------------------------------
  // Exact snapshots of the retired html.theme-* CSS blocks (values verbatim), filled to
  // the full allowlist of their mode where the old block inherited a base value. seeds =
  // the simple-editor starting positions {accent, gradFrom, gradTo, tint}.
  var PRESETS = {
    ocean: { mode:'light', seeds:{accent:'#0891b2',gradFrom:'#0891b2',gradTo:'#22d3ee',tint:'#f0f9ff'}, tokens:{
      '--accent':'#0891b2','--accent-strong':'#0e7490','--link':'#0891b2','--link-text':'#0e7490',
      '--bg':'#f0f9ff','--panel-bg':'#e0f2fe','--panel-border':'#bae6fd','--hover-bg':'#bae6fd',
      '--input-focus':'#e0f2fe','--total-bg':'#cffafe','--total-fg':'#164e63','--total-soft':'#ecfeff',
      '--th-bg':'#e0f2fe','--th-fg':'#0c4a6e','--row-header-bg':'#e0f2fe','--row-header-fg':'#0c4a6e',
      '--secondary-bg':'#bae6fd','--secondary-fg':'#0c4a6e','--secondary-hover':'#7dd3fc',
      '--result-bg':'#e0f2fe','--grad-from':'#0891b2','--grad-to':'#22d3ee',
      '--glow-1':'rgba(8,145,178,.22)','--glow-2':'rgba(34,211,238,.18)',
      '--glass-bg':'rgba(255,255,255,.60)','--glass-border':'rgba(12,74,110,.10)','--glass-blur':'12px',
      '--shell-rail-bg':'rgba(224,242,254,.78)',
      '--elev-hero':'0 10px 28px rgba(8,145,178,.30)','--elev-cta':'0 6px 16px rgba(8,145,178,.28)'
    }},
    forest: { mode:'light', seeds:{accent:'#059669',gradFrom:'#059669',gradTo:'#34d399',tint:'#f0fdf4'}, tokens:{
      '--accent':'#059669','--accent-strong':'#047857','--link':'#059669','--link-text':'#047857',
      '--bg':'#f0fdf4','--panel-bg':'#dcfce7','--panel-border':'#bbf7d0','--hover-bg':'#bbf7d0',
      '--input-focus':'#dcfce7','--total-bg':'#bbf7d0','--total-fg':'#14532d','--total-soft':'#f0fdf4',
      '--th-bg':'#dcfce7','--th-fg':'#14532d','--row-header-bg':'#dcfce7','--row-header-fg':'#14532d',
      '--secondary-bg':'#bbf7d0','--secondary-fg':'#14532d','--secondary-hover':'#86efac',
      '--result-bg':'#dcfce7','--grad-from':'#059669','--grad-to':'#34d399',
      '--glow-1':'rgba(5,150,105,.22)','--glow-2':'rgba(52,211,153,.18)',
      '--glass-bg':'rgba(255,255,255,.60)','--glass-border':'rgba(20,83,45,.10)','--glass-blur':'12px',
      '--shell-rail-bg':'rgba(220,252,231,.78)',
      '--elev-hero':'0 10px 28px rgba(5,150,105,.30)','--elev-cta':'0 6px 16px rgba(5,150,105,.28)'
    }},
    sunset: { mode:'light', seeds:{accent:'#ea580c',gradFrom:'#ea580c',gradTo:'#f59e0b',tint:'#fff7ed'}, tokens:{
      '--accent':'#ea580c','--accent-strong':'#c2410c','--link':'#ea580c','--link-text':'#c2410c',
      '--bg':'#fff7ed','--panel-bg':'#ffedd5','--panel-border':'#fed7aa','--hover-bg':'#fed7aa',
      '--input-focus':'#ffedd5','--total-bg':'#fef3c7','--total-fg':'#78350f','--total-soft':'#fff7ed',
      '--th-bg':'#ffedd5','--th-fg':'#78350f','--row-header-bg':'#ffedd5','--row-header-fg':'#78350f',
      '--secondary-bg':'#fed7aa','--secondary-fg':'#78350f','--secondary-hover':'#fdba74',
      '--result-bg':'#ffedd5','--grad-from':'#ea580c','--grad-to':'#f59e0b',
      '--glow-1':'rgba(234,88,12,.22)','--glow-2':'rgba(245,158,11,.18)',
      '--glass-bg':'rgba(255,255,255,.58)','--glass-border':'rgba(120,53,15,.10)','--glass-blur':'12px',
      '--shell-rail-bg':'rgba(255,237,213,.80)',
      '--elev-hero':'0 10px 28px rgba(234,88,12,.30)','--elev-cta':'0 6px 16px rgba(234,88,12,.28)'
    }},
    midnight: { mode:'dark', seeds:{accent:'#3b82f6',gradFrom:'#3b82f6',gradTo:'#22d3ee',tint:'#000000'}, tokens:{
      '--bg':'#000000','--fg':'#e2e8f0','--muted':'#94a3b8',
      '--panel-bg':'#0f172a','--panel-border':'#1e293b','--input-bg':'#0f172a','--input-border':'#334155',
      '--input-focus':'#1e3a8a','--row-header-bg':'#0f172a','--row-header-fg':'#cbd5e1',
      '--total-bg':'#1e3a8a','--total-fg':'#93c5fd','--total-soft':'#0f172a',
      '--accent':'#3b82f6','--accent-strong':'#1d4ed8','--link':'#60a5fa','--link-text':'#60a5fa',
      '--hover-bg':'#1e293b','--th-bg':'#0f172a','--th-fg':'#cbd5e1',
      '--secondary-bg':'#1e293b','--secondary-fg':'#e2e8f0','--secondary-hover':'#334155',
      '--overlay':'rgba(0,0,0,.85)','--shadow':'0 4px 16px rgba(0,0,0,.7)','--shadow-soft':'0 2px 8px rgba(0,0,0,.3)',
      '--tooltip-bg':'#f1f5f9','--tooltip-fg':'#0f172a','--result-bg':'#0f172a','--result-border':'#334155',
      '--error-bg':'#450a0a','--error-fg':'#fca5a5','--error-border':'#7f1d1d',
      '--success-bg':'#052e16','--success-fg':'#86efac','--success-border':'#065f46',
      '--grad-from':'#3b82f6','--grad-to':'#22d3ee',
      '--glow-1':'rgba(59,130,246,.28)','--glow-2':'rgba(34,211,238,.20)',
      '--glass-bg':'rgba(255,255,255,.05)','--glass-border':'rgba(255,255,255,.10)','--glass-blur':'12px',
      '--shell-rail-bg':'rgba(15,23,42,.88)',
      '--elev-1':'0 2px 8px rgba(0,0,0,.5)','--elev-2':'0 8px 24px rgba(0,0,0,.6)','--elev-3':'0 12px 32px rgba(0,0,0,.7)',
      '--elev-hero':'0 10px 28px rgba(59,130,246,.35)','--elev-cta':'0 6px 16px rgba(59,130,246,.30)',
      '--tabbar-bg':'rgba(15,23,42,.94)','--track-bg':'rgba(255,255,255,.10)'
    }},
    rose: { mode:'light', seeds:{accent:'#e11d48',gradFrom:'#e11d48',gradTo:'#fb7185',tint:'#fff1f2'}, tokens:{
      '--accent':'#e11d48','--accent-strong':'#be123c','--link':'#e11d48','--link-text':'#be123c',
      '--bg':'#fff1f2','--panel-bg':'#ffe4e6','--panel-border':'#fecdd3','--hover-bg':'#fecdd3',
      '--input-focus':'#ffe4e6','--total-bg':'#fecdd3','--total-fg':'#881337','--total-soft':'#fff1f2',
      '--th-bg':'#ffe4e6','--th-fg':'#881337','--row-header-bg':'#ffe4e6','--row-header-fg':'#881337',
      '--secondary-bg':'#fecdd3','--secondary-fg':'#881337','--secondary-hover':'#fda4af',
      '--result-bg':'#ffe4e6','--grad-from':'#e11d48','--grad-to':'#fb7185',
      '--glow-1':'rgba(225,29,72,.20)','--glow-2':'rgba(251,113,133,.16)',
      '--glass-bg':'rgba(255,255,255,.60)','--glass-border':'rgba(136,19,55,.10)','--glass-blur':'12px',
      '--shell-rail-bg':'rgba(255,228,230,.80)',
      '--elev-hero':'0 10px 28px rgba(225,29,72,.30)','--elev-cta':'0 6px 16px rgba(225,29,72,.28)'
    }},
    purple: { mode:'light', seeds:{accent:'#9333ea',gradFrom:'#9333ea',gradTo:'#c084fc',tint:'#faf5ff'}, tokens:{
      '--accent':'#9333ea','--accent-strong':'#7e22ce','--link':'#9333ea','--link-text':'#7e22ce',
      '--bg':'#faf5ff','--panel-bg':'#f3e8ff','--panel-border':'#e9d5ff','--hover-bg':'#e9d5ff',
      '--input-focus':'#f3e8ff','--total-bg':'#e9d5ff','--total-fg':'#581c87','--total-soft':'#faf5ff',
      '--th-bg':'#f3e8ff','--th-fg':'#581c87','--row-header-bg':'#f3e8ff','--row-header-fg':'#581c87',
      '--secondary-bg':'#e9d5ff','--secondary-fg':'#581c87','--secondary-hover':'#d8b4fe',
      '--result-bg':'#f3e8ff','--grad-from':'#9333ea','--grad-to':'#c084fc',
      '--glow-1':'rgba(147,51,234,.22)','--glow-2':'rgba(192,132,252,.16)',
      '--glass-bg':'rgba(255,255,255,.60)','--glass-border':'rgba(88,28,135,.10)','--glass-blur':'12px',
      '--shell-rail-bg':'rgba(243,232,255,.80)',
      '--elev-hero':'0 10px 28px rgba(147,51,234,.30)','--elev-cta':'0 6px 16px rgba(147,51,234,.28)'
    }},
    indigo: { mode:'light', seeds:{accent:'#4f46e5',gradFrom:'#4f46e5',gradTo:'#818cf8',tint:'#eef2ff'}, tokens:{
      '--accent':'#4f46e5','--accent-strong':'#4338ca','--link':'#4f46e5','--link-text':'#4338ca',
      '--bg':'#eef2ff','--panel-bg':'#e0e7ff','--panel-border':'#c7d2fe','--hover-bg':'#c7d2fe',
      '--input-focus':'#e0e7ff','--total-bg':'#c7d2fe','--total-fg':'#312e81','--total-soft':'#eef2ff',
      '--th-bg':'#e0e7ff','--th-fg':'#312e81','--row-header-bg':'#e0e7ff','--row-header-fg':'#312e81',
      '--secondary-bg':'#c7d2fe','--secondary-fg':'#312e81','--secondary-hover':'#a5b4fc',
      '--result-bg':'#e0e7ff','--grad-from':'#4f46e5','--grad-to':'#818cf8',
      '--glow-1':'rgba(79,70,229,.22)','--glow-2':'rgba(129,140,248,.16)',
      '--glass-bg':'rgba(255,255,255,.60)','--glass-border':'rgba(49,46,129,.10)','--glass-blur':'12px',
      '--shell-rail-bg':'rgba(224,231,255,.80)',
      '--elev-hero':'0 10px 28px rgba(79,70,229,.30)','--elev-cta':'0 6px 16px rgba(79,70,229,.28)'
    }}
  };

  // ---- Value validation (client mirror of the server rules) -----------------
  var HEX_RE = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  var RGBA_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|1\.0|0?\.\d{1,4})\s*)?\)$/;
  var LEN_RE = /^\d{1,2}px$/;
  var COLOR_PART = '(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|rgba?\\(\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*(,\\s*(0|1|1\\.0|0?\\.\\d{1,4})\\s*)?\\))';
  var SHADOW_LAYER = '-?\\d{1,3}(px)?\\s+-?\\d{1,3}(px)?\\s+\\d{1,3}(px)?(\\s+-?\\d{1,3}(px)?)?\\s+' + COLOR_PART;
  var SHADOW_RE = new RegExp('^' + SHADOW_LAYER + '(\\s*,\\s*' + SHADOW_LAYER + '){0,2}$');
  // Defense in depth: no colon/slash/semicolon/quote/brace ever - structurally rules out
  // url(...), expression(...) payloads with URLs, and property breakout.
  var CHARSET_RE = /^[#0-9a-zA-Z().,%\s-]{1,120}$/;

  function fiappValidTokenValue(type, str){
    if (typeof str !== 'string' || !CHARSET_RE.test(str)) return false;
    if (type === 'color') return HEX_RE.test(str) || RGBA_RE.test(str);
    if (type === 'length') return LEN_RE.test(str);
    if (type === 'shadow') return SHADOW_RE.test(str);
    return false;
  }

  // ---- Themes cache (localStorage) -------------------------------------------
  var CACHE_KEY = 'fiapp_themes_custom';
  var fiappThemesCache = {
    read: function(){
      try {
        var o = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (o && o.v === 1 && Object.prototype.toString.call(o.themes) === '[object Array]') return o;
      } catch(_) {}
      return { v: 1, themes: [] };
    },
    write: function(envelope){
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(envelope)); } catch(_) {}
    },
    get: function(id){
      var t = fiappThemesCache.read().themes;
      for (var i = 0; i < t.length; i++) if (t[i] && t[i].id === id) return t[i];
      return null;
    }
  };

  // ---- Apply -----------------------------------------------------------------
  // Built-in --grad-from values, used to update <meta theme-color> without a
  // getComputedStyle() reflow (which is costly in the pre-paint boot path).
  var GRAD_LIGHT = '#7c3aed', GRAD_DARK = '#a855f7';
  function _setMetaColorTo(hex){
    try { var m = document.querySelector('meta[name="theme-color"]'); if (m && hex) m.setAttribute('content', hex); } catch(_) {}
  }

  // Accessibility repair: custom themes saved before the Studio enforced a link contrast
  // floor can carry a --link-text too close to --bg (fails WCAG AA - the nav "back" link).
  // Lift it toward the opposite luminance at apply time so links stay legible without the
  // user having to re-save the theme. Hex pairs only; only ever increases contrast.
  function _lin(c){ c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
  function _hx(h){ h=h.replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
  function _lum(rgb){ return 0.2126*_lin(rgb[0])+0.7152*_lin(rgb[1])+0.0722*_lin(rgb[2]); }
  function _ct(a,b){ var la=_lum(a), lb=_lum(b), hi=Math.max(la,lb), lo=Math.min(la,lb); return (hi+0.05)/(lo+0.05); }
  function _toHex(rgb){ return '#'+rgb.map(function(c){ var s=Math.max(0,Math.min(255,Math.round(c))).toString(16); return s.length<2?'0'+s:s; }).join(''); }
  var _HEXPAIR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  function _repairLinkText(tokens){
    var lt = tokens['--link-text'], bg = tokens['--bg'];
    if (!_HEXPAIR.test(lt||'') || !_HEXPAIR.test(bg||'')) return null;
    var bgRgb = _hx(bg);
    if (_ct(_hx(lt), bgRgb) >= 4.5) return null;          // already legible
    var target = _lum(bgRgb) < 0.5 ? 255 : 0;             // dark bg -> lighten, light bg -> darken
    var rgb = _hx(lt);
    for (var i=0; i<12 && _ct(rgb, bgRgb) < 4.5; i++){
      rgb = [rgb[0]+(target-rgb[0])*0.12, rgb[1]+(target-rgb[1])*0.12, rgb[2]+(target-rgb[2])*0.12];
    }
    return _toHex(rgb);
  }

  function fiappApplyTheme(value){
    var el = document.documentElement, ok = true, mode = 'light', css = '', meta = GRAD_LIGHT;
    if (value === 'dark') {
      mode = 'dark'; meta = GRAD_DARK;
      el.classList.add('dark');
    } else if (value && value.indexOf('custom:') === 0) {
      var theme = fiappThemesCache.get(value.slice(7));
      if (theme && theme.tokens) {
        mode = theme.mode === 'dark' ? 'dark' : 'light';
        el.classList.toggle('dark', mode === 'dark');
        // Build the whole inline custom-property block as one string; assigning it via
        // cssText below is a single style mutation (one recalc/paint) instead of dozens
        // of setProperty/removeProperty calls each churning style invalidation.
        var _fixLink = _repairLinkText(theme.tokens);
        for (var tk in theme.tokens) {
          if (ALL_TOKENS[tk] && fiappValidTokenValue(ALL_TOKENS[tk], theme.tokens[tk])) {
            css += tk + ':' + ((tk === '--link-text' && _fixLink) ? _fixLink : theme.tokens[tk]) + ';';
          }
        }
        if (theme.tokens['--grad-from']) meta = theme.tokens['--grad-from'];
      } else {
        // Cache miss (fresh device): keep the right base luminance so nothing flashes;
        // the prefs convergence fetch repairs the exact tokens shortly after.
        ok = false;
        var fallbackDark = false;
        try { fallbackDark = localStorage.getItem('fiapp_theme_mode') === 'dark'; } catch(_) {}
        if (!fallbackDark && window.__fiappSrvDark) fallbackDark = true;
        mode = fallbackDark ? 'dark' : 'light'; meta = fallbackDark ? GRAD_DARK : GRAD_LIGHT;
        el.classList.toggle('dark', fallbackDark);
      }
    } else {
      el.classList.remove('dark');
    }
    // One write: sets all custom properties for a custom theme, or clears them for a
    // built-in. The inline style attribute is theme-only, so replacing it wholesale is safe.
    el.style.cssText = css;
    try { localStorage.setItem('fiapp_theme_mode', mode); } catch(_) {}
    if (document.querySelector('meta[name="theme-color"]')) _setMetaColorTo(meta);
    else if (document.addEventListener) document.addEventListener('DOMContentLoaded', function(){ _setMetaColorTo(meta); }, { once: true });
    return { ok: ok, mode: mode };
  }

  // Animated wrapper for user-initiated theme switches. Live CSS colour transitions
  // force the browser to re-rasterize every backdrop-filter surface on every frame for
  // the whole fade (visibly janky at fullscreen); a View Transition paints the old and
  // new theme once each and cross-fades the two snapshots on the compositor at 60fps.
  // The 'theme-switching' class (styles.css) suppresses per-element colour transitions
  // so the "new" snapshot is captured fully switched. Falls back to an instant swap
  // when the API is missing or the user prefers reduced motion.
  // Software-rendered devices (no GPU compositing) cannot animate a fullscreen fade
  // smoothly no matter the technique, so the fade self-disables - but only after TWO
  // consecutive janky fades (a single transient hitch - DevTools open, a GC pause, a busy
  // tab - must not punish a capable machine), and only for a day before it re-probes. Any
  // smooth fade clears the strike count.
  var FADE_OFF_KEY = 'fiapp_theme_fade_off_until', FADE_STRIKE_KEY = 'fiapp_theme_fade_strikes', FADE_JANK_MS = 450;
  function _fadeDisabled(){
    try { return Date.now() < (+localStorage.getItem(FADE_OFF_KEY) || 0); } catch(_) { return false; }
  }
  function _noteFadeDuration(ms){
    // Hidden tabs skip the animation (~0ms) and can't false-trigger; only judge visible fades.
    if (document.visibilityState !== 'visible') return;
    try {
      if (ms <= FADE_JANK_MS){ localStorage.removeItem(FADE_STRIKE_KEY); return; }   // smooth fade: reset strikes
      var strikes = (+localStorage.getItem(FADE_STRIKE_KEY) || 0) + 1;
      if (strikes >= 2){ localStorage.setItem(FADE_OFF_KEY, String(Date.now() + 24 * 3600 * 1000)); localStorage.removeItem(FADE_STRIKE_KEY); }
      else { localStorage.setItem(FADE_STRIKE_KEY, String(strikes)); }
    } catch(_) {}
  }

  function fiappApplyThemeAnimated(value, afterApply){
    var el = document.documentElement, reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(_) {}
    if (!document.startViewTransition || reduce || _fadeDisabled()) {
      // Instant swap - suppress the .2s colour transitions too, so the change is one
      // clean repaint instead of 200ms of live-animating (and on weak devices janky) frames.
      el.classList.add('theme-switching');
      var r = fiappApplyTheme(value);
      if (afterApply) { try { afterApply(); } catch(_) {} }
      setTimeout(function(){ el.classList.remove('theme-switching'); }, 120);
      return r;
    }
    el.classList.add('theme-switching');
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var done = function(){
      el.classList.remove('theme-switching');
      if (t0) _noteFadeDuration(performance.now() - t0);
    };
    var vt = document.startViewTransition(function(){
      fiappApplyTheme(value);
      if (afterApply) { try { afterApply(); } catch(_) {} }
    });
    vt.finished.then(done, done);
  }

  // ---- Boot + legacy migration ------------------------------------------------
  var LEGACY = { ocean:1, forest:1, sunset:1, midnight:1, rose:1, purple:1, indigo:1 };
  var MAX_THEMES = 10;

  function _rand8(){
    var s = '', chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  }

  function fiappThemeBoot(raw){
    try {
      var value = raw || 'light';
      if (LEGACY[value]) {
        // One-time migration: the legacy built-in becomes a saved custom theme with the
        // preset's exact tokens - zero visual change. Idempotent via the preset flag.
        var cache = fiappThemesCache.read();
        var existing = null;
        for (var i = 0; i < cache.themes.length; i++) {
          if (cache.themes[i] && cache.themes[i].preset === value) { existing = cache.themes[i]; break; }
        }
        if (!existing && cache.themes.length < MAX_THEMES) {
          var p = PRESETS[value];
          existing = {
            id: 'ct_' + _rand8(),
            name: value.charAt(0).toUpperCase() + value.slice(1),
            mode: p.mode,
            preset: value,
            seeds: p.seeds,
            overrides: {},
            tokens: p.tokens
          };
          cache.themes.push(existing);
          fiappThemesCache.write(cache);
          try { localStorage.setItem('fiapp_themes_dirty', '1'); } catch(_) {}
        }
        if (existing) {
          value = 'custom:' + existing.id;
          try {
            localStorage.setItem('fiapp_theme', value);
            localStorage.setItem('fiapp_theme_mode', existing.mode);
          } catch(_) {}
        } else {
          // Cap reached and no twin: keep the base luminance, leave the legacy value
          // stored so a later boot (after the user frees a slot) can retry.
          value = PRESETS[raw].mode === 'dark' ? 'dark' : 'light';
        }
      }
      fiappApplyTheme(value);
      return value;
    } catch(_) {
      try { document.documentElement.classList.toggle('dark', raw === 'dark'); } catch(_) {}
      return raw || 'light';
    }
  }

  // ---- Labels -----------------------------------------------------------------
  function fiappThemeLabel(value){
    if (value === 'dark') return '🌙 Dark';
    if (value && value.indexOf('custom:') === 0) {
      var t = fiappThemesCache.get(value.slice(7));
      return t ? '🎨 ' + t.name : '🎨 Custom';
    }
    return '☀️ Light';
  }

  window.FIAPP_PRESETS = PRESETS;
  window.FIAPP_CUSTOM_TOKENS = ALL_TOKENS;
  window.FIAPP_LIGHT_TOKENS = LIGHT_TOKENS;
  window.FIAPP_MAX_THEMES = MAX_THEMES;
  window.fiappThemesCache = fiappThemesCache;
  window.fiappApplyTheme = fiappApplyTheme;
  window.fiappApplyThemeAnimated = fiappApplyThemeAnimated;
  window.fiappThemeBoot = fiappThemeBoot;
  window.fiappThemeLabel = fiappThemeLabel;
  window.fiappValidTokenValue = fiappValidTokenValue;
})();
