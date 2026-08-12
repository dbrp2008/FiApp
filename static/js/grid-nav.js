'use strict';

(function () {
  function init() {
    var table = document.getElementById('sheet');
    if (!table) return;

    function grid() {
      var out = [];
      table.querySelectorAll('tr').forEach(function (tr) {
        var inputs = tr.querySelectorAll('input.num-input:not([disabled])');
        if (inputs.length) out.push([].slice.call(inputs));
      });
      return out;
    }

    function coords(inp) {
      var g = grid();
      for (var r = 0; r < g.length; r++) {
        var c = g[r].indexOf(inp);
        if (c >= 0) return { r: r, c: c };
      }
      return null;
    }

    function focusAt(r, c) {
      var g = grid();
      var row = g[r];
      if (!row) return;
      var target = row[Math.min(c, row.length - 1)];
      if (!target) return;
      target.focus();
      try { target.select(); } catch (_) {}
    }

    table.addEventListener('keydown', function (e) {
      var inp = e.target;
      if (!inp.classList || !inp.classList.contains('num-input')) return;
      if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var pos = coords(inp);
      if (!pos) return;
      e.preventDefault();
      if (e.key === 'ArrowUp') { focusAt(pos.r - 1, pos.c); return; }

      inp.blur();
      focusAt(pos.r + 1, pos.c);
    });

    table.addEventListener('focusin', function (e) {
      var t = e.target;
      if (t.classList && t.classList.contains('num-input')) {
        try { t.select(); } catch (_) {}
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
