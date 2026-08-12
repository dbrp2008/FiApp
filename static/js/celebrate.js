(function(){
  'use strict';

  var LEVEL = { quiet: 0, balanced: 1, playful: 2 };

  function fiappPersonality(){
    var c = document.documentElement.classList;
    if (c.contains('personality-quiet'))   return 'quiet';
    if (c.contains('personality-playful')) return 'playful';
    return 'balanced';
  }

  function _reducedMotion(){
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function _meets(minLevel){
    var need = LEVEL[minLevel != null ? minLevel : 'playful'];
    if (need == null) need = LEVEL.playful;
    return LEVEL[fiappPersonality()] >= need;
  }

  var _cvs = null;
  function _canvas(){
    if (_cvs) return _cvs;
    _cvs = document.createElement('canvas');
    _cvs.id = 'fi-celebrate-confetti';
    _cvs.setAttribute('aria-hidden', 'true');
    _cvs.style.cssText = 'display:none;position:fixed;inset:0;z-index:9600;pointer-events:none;width:100%;height:100%';
    (document.body || document.documentElement).appendChild(_cvs);
    return _cvs;
  }

  function _palette(){

    var cs = getComputedStyle(document.documentElement);
    var accent = (cs.getPropertyValue('--accent') || '').trim();
    var strong = (cs.getPropertyValue('--accent-strong') || '').trim();
    var base = ['#ffd93d', '#6bcb77', '#4d96ff', '#f59e0b', '#22d3ee'];
    if (strong) base.unshift(strong);
    if (accent) base.unshift(accent);
    return base;
  }

  function _fireConfetti(big){
    if (_reducedMotion()) return;
    var cvs = _canvas();
    cvs.style.display = 'block';
    cvs.width = window.innerWidth; cvs.height = window.innerHeight;
    var ctx = cvs.getContext('2d');
    var COLORS = _palette();
    var N = big ? 130 : 80, MAX = big ? 170 : 140;
    var pts = [], i;
    for (i = 0; i < N; i++) pts.push({ x: Math.random() * cvs.width, y: -10, r: 3 + Math.random() * 5, vx: (Math.random() - .5) * 4, vy: 1.5 + Math.random() * 4, rot: Math.random() * 360, rv: (Math.random() - .5) * 8, color: COLORS[i % COLORS.length], rect: Math.random() > .5 });
    var f = 0;
    function draw(){
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      pts.forEach(function(p){ ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180); ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - f / MAX); if (p.rect) { ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); } else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); p.x += p.vx; p.y += p.vy; p.rot += p.rv; p.vy += .08; });
      f++; if (f < MAX) requestAnimationFrame(draw); else cvs.style.display = 'none';
    }
    requestAnimationFrame(draw);
  }

  function _fireCoin(){
    if (_reducedMotion()) return;
    var wrap = document.createElement('div');
    wrap.className = 'fi-coin-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    var coin = document.createElement('div');
    coin.className = 'fi-coin';
    var front = document.createElement('div');
    front.className = 'fi-coin-face'; front.textContent = '¤';
    var back = document.createElement('div');
    back.className = 'fi-coin-face fi-coin-back'; back.textContent = '🧭';
    coin.appendChild(front); coin.appendChild(back);
    wrap.appendChild(coin);
    (document.body || document.documentElement).appendChild(wrap);
    var done = false;
    function cleanup(){ if (done) return; done = true; wrap.remove(); }
    coin.addEventListener('animationend', cleanup);
    setTimeout(cleanup, 2200);
  }

  var _bubble = null, _txt = null, _close = null, _timer = null;
  function _ensureBubble(){
    if (_bubble) return _bubble;
    var b = document.createElement('div');
    b.id = 'fi-celebrate-bubble';
    b.setAttribute('role', 'status');
    b.setAttribute('aria-live', 'polite');
    b.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(12px);z-index:9601;' +
      'display:none;align-items:center;gap:.55rem;max-width:min(92vw,420px);box-sizing:border-box;' +
      'padding:.7rem .95rem;border-radius:14px;background:var(--panel-bg,#fff);color:var(--fg,#111);' +
      'border:1px solid var(--panel-border,rgba(0,0,0,.1));box-shadow:0 10px 30px rgba(0,0,0,.18);' +
      'font-size:.92rem;line-height:1.4;opacity:0;transition:opacity .2s ease,transform .2s ease;';
    var ava = document.createElement('span');
    ava.textContent = '🧭'; ava.setAttribute('aria-hidden', 'true');
    ava.style.cssText = 'font-size:1.4rem;flex:0 0 auto;';
    _txt = document.createElement('span');
    _txt.style.cssText = 'flex:1 1 auto;';
    _close = document.createElement('button');
    _close.type = 'button'; _close.setAttribute('aria-label', 'Dismiss'); _close.textContent = '×';
    _close.style.cssText = 'flex:0 0 auto;background:none;border:none;color:var(--muted,#888);font-size:1.2rem;line-height:1;cursor:pointer;padding:0 .15rem;';
    _close.addEventListener('click', _hideBubble);
    b.appendChild(ava); b.appendChild(_txt); b.appendChild(_close);
    (document.body || document.documentElement).appendChild(b);
    _bubble = b;
    return b;
  }

  function _hideBubble(){
    if (!_bubble) return;
    _bubble.style.opacity = '0';
    _bubble.style.transform = 'translateX(-50%) translateY(12px)';
    if (_timer) { clearTimeout(_timer); _timer = null; }
    setTimeout(function(){ if (_bubble) _bubble.style.display = 'none'; }, 220);
  }

  function _showBubble(text, autoMs, showClose){
    _ensureBubble();
    _txt.textContent = text;
    _close.style.display = showClose ? '' : 'none';
    _bubble.style.display = 'flex';
    void _bubble.offsetWidth;
    _bubble.style.opacity = '1';
    _bubble.style.transform = 'translateX(-50%) translateY(0)';
    if (_timer) { clearTimeout(_timer); _timer = null; }
    if (autoMs) _timer = setTimeout(_hideBubble, autoMs);
  }

  function fiappCelebrate(opts){
    opts = opts || {};
    if (!_meets(opts.minLevel)) return;
    if (opts.confetti) _fireConfetti(!!opts.big);
    if (opts.confetti && opts.big) _fireCoin();
    if (opts.mascot)   _showBubble(opts.mascot, 4200, false);
  }

  function fiappMascotTip(text, sessionKey){
    if (!text || !_meets('playful')) return;
    if (sessionKey){
      var k = 'fiapp_tip_' + sessionKey;
      try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (_) {}
    }
    setTimeout(function(){ _showBubble(text, 9000, true); }, 900);
  }

  window.fiappPersonality = fiappPersonality;
  window.fiappCelebrate   = fiappCelebrate;
  window.fiappMascotTip   = fiappMascotTip;
})();
