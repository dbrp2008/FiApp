(function(){
  'use strict';

  if(!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches)) return;

  var SELECTOR = 'select.month-jump, select.cell-curr-sel, select#curr-sel, select#currency_i, select#currency_o, select#sub-sel, select#home-currency-sel, select.c-sel[data-ctype="billing"], select.c-sel[data-ctype="trial"], select.c-sel[data-ctype="status"]';
  var _reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var open = null;

  function close(returnFocus){
    if(!open) return;
    var o = open; open = null;
    document.removeEventListener('keydown', o.onKey, true);
    window.removeEventListener('resize', o.reposition);
    window.removeEventListener('scroll', o.reposition, true);
    if(o.raf) cancelAnimationFrame(o.raf);
    if(o.snapT) clearTimeout(o.snapT);
    o.overlay.remove();
    if(returnFocus && o.select) o.select.focus();
  }

  function commit(select, value){
    if(select.value !== value){
      select.value = value;
      select.dispatchEvent(new Event('change', {bubbles:true}));
    }
  }

  function markActive(idx){
    if(!open) return;
    idx = Math.max(0, Math.min(open.items.length - 1, idx));
    open.idx = idx;
    for(var i = 0; i < open.items.length; i++){
      var a = i === idx;
      open.items[i].classList.toggle('gp-active', a);
      open.items[i].setAttribute('aria-selected', a ? 'true' : 'false');
    }
  }

  function goTo(idx){
    markActive(idx);
    var it = open.items[open.idx];
    if(!it) return;
    var top = it.offsetTop - (open.list.clientHeight / 2) + (it.offsetHeight / 2);
    open.list.scrollTo({top: top, behavior: _reduce ? 'auto' : 'smooth'});
  }

  function position(wheel, select){
    var r = select.getBoundingClientRect();
    var ww = wheel.offsetWidth, wh = wheel.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - ww - 8);
    var top = r.bottom + 6;
    if(top + wh > window.innerHeight - 8) top = Math.max(8, r.top - wh - 6);
    wheel.style.left = left + 'px';
    wheel.style.top = top + 'px';
  }

  function openFor(select){
    close(false);

    var overlay = document.createElement('div'); overlay.className = 'gp-overlay'; overlay._gpSelect = select;
    var wheel = document.createElement('div'); wheel.className = 'gp-wheel'; wheel.setAttribute('role', 'listbox');
    var band = document.createElement('div'); band.className = 'gp-band'; wheel.appendChild(band);
    var list = document.createElement('div'); list.className = 'gp-list';

    var items = [];
    var lastGroup = null;
    Array.prototype.forEach.call(select.options, function(opt){
      var group = (opt.parentElement && opt.parentElement.tagName === 'OPTGROUP') ? opt.parentElement.label : null;
      if(group !== lastGroup){
        lastGroup = group;
        if(group){
          var sep = document.createElement('div');
          sep.className = 'gp-sep'; sep.textContent = group; sep.setAttribute('role', 'presentation');
          list.appendChild(sep);
        }
      }
      var it = document.createElement('button');
      it.type = 'button'; it.className = 'gp-item'; it.textContent = opt.textContent;
      it.setAttribute('role', 'option'); it.dataset.value = opt.value;
      if(opt.disabled) it.disabled = true;

      if(opt.style.color) it.style.color = opt.style.color;
      it.addEventListener('click', function(){ commit(select, opt.value); close(true); });
      list.appendChild(it); items.push(it);
    });
    wheel.appendChild(list);
    overlay.appendChild(wheel);
    overlay.addEventListener('mousedown', function(e){ if(e.target === overlay) close(true); });
    document.body.appendChild(overlay);

    var selIdx = Math.max(0, select.selectedIndex);

    function reposition(){ position(wheel, select); }
    function onKey(e){
      if(!open) return;
      if(e.key === 'Escape'){ e.preventDefault(); close(true); }
      else if(e.key === 'ArrowDown'){ e.preventDefault(); goTo(open.idx + 1); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); goTo(open.idx - 1); }
      else if(e.key === 'Home'){ e.preventDefault(); goTo(0); }
      else if(e.key === 'End'){ e.preventDefault(); goTo(open.items.length - 1); }
      else if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); commit(select, open.items[open.idx].dataset.value); close(true); }
    }

    function nearestIdx(){
      var centre = list.scrollTop + list.clientHeight / 2, best = 0, bestD = Infinity;
      for(var i = 0; i < items.length; i++){
        var c = items[i].offsetTop + items[i].offsetHeight / 2, d = Math.abs(c - centre);
        if(d < bestD){ bestD = d; best = i; }
      }
      return best;
    }
    function centreNow(idx){ var it = items[idx]; if(it) list.scrollTop = it.offsetTop - (list.clientHeight / 2) + (it.offsetHeight / 2); }

    open = {select: select, overlay: overlay, wheel: wheel, list: list, items: items, idx: selIdx, onKey: onKey, reposition: reposition, raf: null, snapT: null};

    list.addEventListener('scroll', function(){
      if(!open || open.raf) return;
      open.raf = requestAnimationFrame(function(){
        open.raf = null;
        var best = nearestIdx();
        if(best !== open.idx) markActive(best);
      });
    });

    wheel.addEventListener('wheel', function(e){
      e.preventDefault();
      var unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? list.clientHeight : 1);
      list.scrollTop += e.deltaY * unit;
      if(!open) return;
      clearTimeout(open.snapT);
      open.snapT = setTimeout(function(){ if(!open) return; var b = nearestIdx(); markActive(b); centreNow(b); }, 120);
    }, {passive: false});

    reposition();
    markActive(selIdx);

    var cur = items[selIdx];
    if(cur) list.scrollTop = cur.offsetTop - (list.clientHeight / 2) + (cur.offsetHeight / 2);

    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
  }

  document.addEventListener('mousedown', function(e){
    var sel = e.target.closest && e.target.closest(SELECTOR);
    if(!sel || sel.disabled) return;
    if(window._wtSelAllowed && !window._wtSelAllowed(sel)) return;
    e.preventDefault();
    if(open && open.select === sel){ close(true); return; }
    sel.focus();
    openFor(sel);
  }, true);

  document.addEventListener('keydown', function(e){
    if(open) return;
    var sel = e.target.closest && e.target.closest(SELECTOR);
    if(!sel || sel.disabled) return;
    if(window._wtSelAllowed && !window._wtSelAllowed(sel)) return;
    if(e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openFor(sel); }
  }, true);
})();
