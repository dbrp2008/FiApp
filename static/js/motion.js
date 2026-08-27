(function(){
  'use strict';

  var LEVEL = { quiet: 0, balanced: 1, playful: 2 };

  function fiappMotionLevel(){
    var el = (typeof document !== 'undefined') && document.documentElement;
    var c = el && el.classList;
    if (!c) return LEVEL.balanced;
    if (c.contains('personality-quiet'))   return LEVEL.quiet;
    if (c.contains('personality-playful')) return LEVEL.playful;
    return LEVEL.balanced;
  }

  function fiappMotionReduced(){
    return !!(typeof window !== 'undefined' && window.matchMedia &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  var COUNT_MS = [0, 500, 850];

  function _easeOutCubic(k){ return 1 - Math.pow(1 - k, 3); }

  function _easeOutBack(k){
    var p = k - 1;
    return 1 + 2.70158 * p * p * p + 1.70158 * p * p;
  }

  function fiappCountUp(el, target, opts){
    if (!el) return;
    var o = opts || {};
    var fmt = o.format || String;
    var lvl = fiappMotionLevel();
    var dur = o.duration != null ? o.duration : COUNT_MS[lvl];

    if (!dur || !target || fiappMotionReduced() ||
        typeof requestAnimationFrame !== 'function' ||
        typeof performance === 'undefined' || !performance.now){
      el.textContent = fmt(target);
      return;
    }

    var ease = lvl >= LEVEL.playful ? _easeOutBack : _easeOutCubic;
    var start = performance.now();
    (function tick(now){
      var k = Math.min(1, (now - start) / dur);
      if (k < 1){
        el.textContent = fmt(target * ease(k));
        requestAnimationFrame(tick);
      } else {
        el.textContent = fmt(target);
      }
    })(start);
  }

  function fiappChartAnim(){
    if (fiappMotionReduced()) return false;
    var lvl = fiappMotionLevel();
    if (lvl <= LEVEL.quiet) return false;
    if (lvl >= LEVEL.playful) return { duration: 1100, easing: 'easeOutBack' };
    return { duration: 400, easing: 'easeOutQuart' };
  }

  window.FIAPP_MOTION_LEVEL = LEVEL;
  window.fiappMotionLevel = fiappMotionLevel;
  window.fiappMotionReduced = fiappMotionReduced;
  window.fiappCountUp = fiappCountUp;
  window.fiappChartAnim = fiappChartAnim;
})();
