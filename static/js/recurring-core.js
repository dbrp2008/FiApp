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

  // One-line scope summary for the rules manager, so a rule is legible without
  // opening its config modal. Mirrors monthInScope's field names exactly.
  function describeScope(s){
    if(!s || !s.type) return '';
    if(s.type === 'all')    return 'All months';
    if(s.type === 'future') return 'From ' + (s.anchor || 'the start') + ' onward';
    if(s.type === 'past')   return 'Up to ' + (s.anchor || 'the end');
    if(s.type === 'range')  return (s.start || 'the start') + ' to ' + (s.end || 'the end');
    if(s.type === 'specific'){
      var n = Array.isArray(s.months) ? s.months.length : 0;
      return n + ' selected month' + (n === 1 ? '' : 's');
    }
    return '';
  }

  return { ruleValueForMonth:ruleValueForMonth, monthInScope:monthInScope,
           detectClashes:detectClashes, fillableMonths:fillableMonths,
           describeScope:describeScope };
})();
if(typeof window !== 'undefined') window.FiRecurring = FiRecurring;
