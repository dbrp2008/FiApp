'use strict';
// FiApp recurring-rule pure logic. No DOM. Shared by expenses.js and income.js and
// unit-tested headless via tests/helpers/load-script. Month keys are 'YYYY-MM' strings
// that sort lexically, so mk comparisons are valid. All functions are side-effect free;
// callers inject accessors (getMonthTotal, isLocked) and apply the returned writes.

var FiRecurring = (function(){
  var EPS = 1e-9;

  function ruleValueForMonth(rule, mk){
    if(rule.overrides && Object.prototype.hasOwnProperty.call(rule.overrides, mk)) return rule.overrides[mk];
    return rule.amount;
  }

  function monthInScope(rule, mk){
    if(rule.exceptions && rule.exceptions.indexOf(mk) >= 0) return false;
    var s = rule.scope || {};
    if(s.type === 'all') return true;
    if(s.type === 'future') return s.anchor ? mk >= s.anchor : true;
    if(s.type === 'past')   return s.anchor ? mk <= s.anchor : true;
    if(s.type === 'range')  return (!s.start || mk >= s.start) && (!s.end || mk <= s.end);
    if(s.type === 'specific') return Array.isArray(s.months) && s.months.indexOf(mk) >= 0;
    return false;
  }

  // opts: { existingMonths:[mk], getMonthTotal:fn(mk)->number, isLocked:fn(mk)->bool }
  // Returns [{mk, reason:'locked'|'mismatch', want, have?}]
  function detectClashes(rule, opts){
    var out = [];
    (opts.existingMonths || []).forEach(function(mk){
      if(!monthInScope(rule, mk)) return;
      var want = ruleValueForMonth(rule, mk);
      if(opts.isLocked(mk)){ out.push({mk:mk, reason:'locked', want:want}); return; }
      var have = opts.getMonthTotal(mk);
      if(have !== 0 && Math.abs(have - want) > EPS) out.push({mk:mk, reason:'mismatch', have:have, want:want});
    });
    return out;
  }

  // Existing, in-scope, unlocked months that are empty or already match: safe to fill.
  function fillableMonths(rule, opts){
    return (opts.existingMonths || []).filter(function(mk){
      if(!monthInScope(rule, mk)) return false;
      if(opts.isLocked(mk)) return false;
      var have = opts.getMonthTotal(mk), want = ruleValueForMonth(rule, mk);
      return have === 0 || Math.abs(have - want) <= EPS;
    });
  }

  return { ruleValueForMonth:ruleValueForMonth, monthInScope:monthInScope,
           detectClashes:detectClashes, fillableMonths:fillableMonths };
})();
if(typeof window !== 'undefined') window.FiRecurring = FiRecurring;
