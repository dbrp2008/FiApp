/**
 * analytics_core.js
 * Shared analytics utilities used by analytics.html, index.html (snapshot),
 * and voice.js. Loaded via <script src="/static/js/analytics_core.js"> before
 * any page script that needs these functions.
 *
 * Currency note: _ratesCache is populated lazily by fiappCoreLoadRates().
 * calcSubCostForMonth gracefully degrades to the raw cost if rates aren't loaded.
 */

// ---------------------------------------------------------------------------
// Currency helpers (shared rates cache)
// ---------------------------------------------------------------------------
var _coreRatesCache = {};
var _coreRatesReady = false;

function fiappCoreLoadRates() {
  if (_coreRatesReady) return Promise.resolve();
  return fiappGetRates('USD').then(function(obj) {
    var r = obj && obj.rates;
    if (r && typeof r === 'object') {
      Object.keys(r).forEach(function(k) {
        if (/^[A-Z]{2,5}$/.test(k) && typeof r[k] === 'number') _coreRatesCache[k] = r[k];
      });
      _coreRatesReady = true;
    }
  }).catch(function(e) { console.warn('analytics_core: rate fetch failed', e.message); });
}

function _coreToUSD(cost, currency) {
  if (!currency || currency === 'USD') return cost;
  var rate = _coreRatesCache[currency];
  return rate ? cost / rate : cost;
}
// Convert native-currency cost directly to home currency (USD-normalize then apply display rate).
function _coreToHome(cost, currency) { return _coreToUSD(cost, currency) * _anaRate(); }
function fiappCoreRatesLoaded() { return _coreRatesReady; }

// Analytics-wide display currency. All analytics/snapshot totals are USD-normalized
// internally (via _coreToUSD above); this only changes how fmtMoney* presents them.
var _anaCcy = (function() {
  try { return localStorage.getItem('fiapp_analytics_currency') || 'USD'; } catch (e) { return 'USD'; }
})();
function getAnalyticsCurrency() { return _anaCcy; }
function setAnalyticsCurrency(code) {
  _anaCcy = code;
  try { localStorage.setItem('fiapp_analytics_currency', code); } catch (e) {}
  // Persist to the account too, so the choice follows the user across devices
  // (base.html's _CSRF global is defined by the time a user can click this).
  try {
    if (typeof _CSRF !== 'undefined' && _CSRF) {
      fetch('/api/prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _CSRF },
        body: JSON.stringify({ analytics_currency: code })
      }).catch(function () {});
    }
  } catch (e) {}
}
function _anaRate() { return _anaCcy === 'USD' ? 1 : (_coreRatesCache[_anaCcy] || 1); }
function _anaPrefix() { return _anaCcy === 'USD' ? '$' : _anaCcy + ' '; }

// ---------------------------------------------------------------------------
// Constants & formatters
// ---------------------------------------------------------------------------
var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function mk(y, m) { return y + '-' + String(m + 1).padStart(2, '0'); }
// new Date('YYYY-MM-DD') parses as UTC midnight, which can land on the previous local
// calendar day west of UTC, drifting subscription charge dates across month boundaries.
// Parse the components explicitly so the result is local-midnight, matching monthStart/
// monthEnd below (also built with new Date(year, month, day)).
function _coreParseDate(s) {
  if (!s) return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function todayMK() { var n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); }
function prevMK(mkStr) {
  var parts = mkStr.split('-').map(Number);
  var y = parts[0], m = parts[1] - 1;
  if (m === 0) { m = 12; y--; }
  return y + '-' + String(m).padStart(2, '0');
}

function fmtMoney(v) { return _anaPrefix() + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fmtMoneyShort(v) { var n = Number(v); if (n >= 1000) return _anaPrefix() + (n / 1000).toFixed(1) + 'k'; return _anaPrefix() + n.toFixed(0); }
function fmtMoneyCard(v) { var n = Number(v); if (n >= 1e6) return _anaPrefix() + (n / 1e6).toFixed(1) + 'M'; if (n >= 10000) return _anaPrefix() + (n / 1000).toFixed(0) + 'K'; if (n >= 1000) return _anaPrefix() + (n / 1000).toFixed(1) + 'K'; return _anaPrefix() + n.toFixed(2); }
function fmtPct(v) { return Number(v).toFixed(1) + '%'; }
function mkLabel(mkStr) { var parts = mkStr.split('-'); return MONTHS_SHORT[parseInt(parts[1]) - 1] + " '" + parts[0].slice(2); }

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------
function expRows(exp, mk2) {
  var byMonth = exp && exp.rowsByMonth && exp.rowsByMonth[mk2];
  return (byMonth && byMonth.length > 0) ? byMonth : (exp && exp.rows) || [];
}
function incRows(inc, mk2) {
  return (inc && inc.rowsByMonth && inc.rowsByMonth[mk2]) ? inc.rowsByMonth[mk2] : (inc && inc.rows) || [];
}

// ---------------------------------------------------------------------------
// Month collection
// ---------------------------------------------------------------------------
function allSpendingMonths(exp, subs) {
  var mks = new Set();

  if (exp && exp.cells) {
    Object.keys(exp.cells).forEach(function(k) {
      var p = k.split('|'); if (p.length >= 3 && parseFloat(exp.cells[k]) > 0) mks.add(p[0]);
    });
  }

  if (subs && subs.rows && subs.cols) {
    var startCol = subs.cols.find(function(c) { return c.ctype === 'date'; });
    if (startCol) {
      var now = new Date();
      (subs.rows || []).forEach(function(r) {
        var dateStr = (subs.cells || {})[r.id + '|' + startCol.id] || '';
        if (!dateStr) return;
        var first = _coreParseDate(dateStr);
        if (!first) return;
        var y = first.getFullYear(), m = first.getMonth();
        while (y * 12 + m <= now.getFullYear() * 12 + now.getMonth()) {
          mks.add(mk(y, m)); m++; if (m === 12) { m = 0; y++; }
        }
      });
    }
  }

  return Array.from(mks).sort();
}

// ---------------------------------------------------------------------------
// Row → month spending index
// ---------------------------------------------------------------------------
function buildRowMonthIndex(exp) {
  var idx = {};
  if (!exp || !exp.cells) return idx;
  Object.entries(exp.cells).forEach(function(entry) {
    var key = entry[0], val = entry[1];
    var n = parseFloat(val) || 0; if (!n) return;
    var parts = key.split('|'); if (parts.length !== 3) return;
    var mk2 = parts[0], rowId = parts[1];
    if (!idx[rowId]) idx[rowId] = {};
    idx[rowId][mk2] = (idx[rowId][mk2] || 0) + n;
  });
  return idx;
}

// ---------------------------------------------------------------------------
// Subscription cost helpers
// ---------------------------------------------------------------------------
function calcSubCostForMonth(row, subs, year, month) {
  var cols = subs.cols || [];
  var get = function(id) { return (subs.cells || {})[row.id + '|' + id] || ''; };
  var startCol   = cols.find(function(c) { return c.ctype === 'date'; });
  var cancelCol  = cols.find(function(c) { return c.ctype === 'canceldate'; });
  var statusCol  = cols.find(function(c) { return c.ctype === 'status'; });
  var costCol    = cols.find(function(c) { return c.ctype === 'number'; });
  var billingCol = cols.find(function(c) { return c.ctype === 'billing'; });

  var status    = statusCol  ? get(statusCol.id)  || 'Active'  : 'Active';
  var startStr  = startCol   ? get(startCol.id)               : '';
  var cancelStr = cancelCol  ? get(cancelCol.id)              : '';
  var rawCost   = parseFloat(costCol ? get(costCol.id) : 0) || 0;
  var currency  = (subs.rowCurrencies || {})[row.id] || 'USD';
  var cost      = _coreToHome(rawCost, currency);
  var billing   = billingCol ? get(billingCol.id) || 'Monthly' : 'Monthly';

  var monthStart = new Date(year, month, 1);
  var monthEnd   = new Date(year, month + 1, 0);

  if (startStr) { var sd = _coreParseDate(startStr); if (sd && sd > monthEnd) return 0; }
  if (status === 'Cancelled' && cancelStr) { var cd = _coreParseDate(cancelStr); if (cd && cd < monthStart) return 0; }

  if (billing === 'Monthly')   return cost;
  if (billing === 'Yearly')    return cost / 12;
  if (billing === 'Quarterly') return cost / 3;

  if ((billing === 'Weekly' || billing === 'Bi-Weekly') && startStr) {
    var msDay = 86400000;
    var itvMs = (billing === 'Weekly' ? 7 : 14) * msDay;
    var start = _coreParseDate(startStr);
    if (!start) return cost;
    var ev = new Date(start.getTime());
    if (ev < monthStart) {
      var ahead = Math.ceil((monthStart - ev) / itvMs);
      ev = new Date(start.getTime() + ahead * itvMs);
    }
    var cancelDate = cancelStr ? _coreParseDate(cancelStr) : null;
    var count = 0;
    while (ev <= monthEnd) {
      if (!cancelDate || ev <= cancelDate) count++;
      ev = new Date(ev.getTime() + itvMs);
    }
    return cost * count;
  }
  return cost;
}

function subCostPerMonth(subs, months) {
  if (!subs || !subs.rows) return months.map(function() { return 0; });
  return months.map(function(mk2) {
    var parts = mk2.split('-').map(Number);
    var y = parts[0], m = parts[1];
    var total = (subs.rows || []).reduce(function(s, r) { return s + calcSubCostForMonth(r, subs, y, m - 1); }, 0);
    return parseFloat(total.toFixed(2));
  });
}

function subMonthlySnapshot(subs) {
  if (!subs || !subs.rows || !subs.cols) return [];
  var billingCol = subs.cols.find(function(c) { return c.ctype === 'billing'; });
  var costCol    = subs.cols.find(function(c) { return c.ctype === 'number'; });
  var statusCol  = subs.cols.find(function(c) { return c.ctype === 'status'; });
  var nameCol    = subs.cols.find(function(c) { return c.ctype === 'text'; });
  return (subs.rows || []).map(function(r) {
    var status = statusCol ? subs.cells[r.id + '|' + statusCol.id] || 'Active' : 'Active';
    if (status === 'Cancelled') return null;
    var name    = nameCol   ? subs.cells[r.id + '|' + nameCol.id]  || '-' : '-';
    var rawCost = parseFloat(costCol ? subs.cells[r.id + '|' + costCol.id] || 0 : 0) || 0;
    var currency = (subs.rowCurrencies || {})[r.id] || 'USD';
    var cost    = _coreToHome(rawCost, currency);
    var bill    = billingCol ? subs.cells[r.id + '|' + billingCol.id] || 'Monthly' : 'Monthly';
    var monthly = 0;
    if (bill === 'Monthly')        monthly = cost;
    else if (bill === 'Yearly')    monthly = cost / 12;
    else if (bill === 'Weekly')    monthly = cost * 4.33;
    else if (bill === 'Bi-Weekly') monthly = cost * 2.17;
    else if (bill === 'Quarterly') monthly = cost / 3;
    return monthly > 0 ? {name: name, monthly: monthly, annual: monthly * 12} : null;
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Combined totals
// ---------------------------------------------------------------------------
function combinedMonthTotals(exp, subs, allMonths) {
  var totals = {};
  var subCosts = subCostPerMonth(subs, allMonths);
  allMonths.forEach(function(mk2, idx) {
    var sum = subCosts[idx] || 0;
    if (exp && exp.cells) {
      var mCols = (exp.colsByMonth && exp.colsByMonth[mk2]) || exp.cols || [];
      expRows(exp, mk2).forEach(function(row) {
        mCols.forEach(function(col) {
          sum += parseFloat(exp.cells[mk2 + '|' + row.id + '|' + col.id] || 0) || 0;
        });
      });
    }
    if (sum > 0) totals[mk2] = parseFloat(sum.toFixed(2));
  });
  return totals;
}

// combinedCategoryTotals builds its own row index internally so it has no
// dependency on any page-level global state.
function combinedCategoryTotals(exp, subs, monthKeys) {
  var totals = {};
  var set = new Set(monthKeys);
  var rowIdx = buildRowMonthIndex(exp);

  if (exp) {
    var globalRows = exp.rows || [];
    var allExpRows = new Map();
    globalRows.forEach(function(r) { allExpRows.set(r.id, r); });
    if (exp.rowsByMonth) {
      Object.values(exp.rowsByMonth).forEach(function(arr) {
        arr.forEach(function(r) { if (!allExpRows.has(r.id)) allExpRows.set(r.id, r); });
      });
    }
    Array.from(allExpRows.values()).filter(function(r) { return !r.parentId && !r.linked; }).forEach(function(row) {
      var sum = 0;
      set.forEach(function(mk2) {
        var rows = expRows(exp, mk2);
        if (!rows.find(function(r) { return r.id === row.id; })) return;
        sum += (rowIdx[row.id] && rowIdx[row.id][mk2]) || 0;
        rows.filter(function(c) { return c.parentId === row.id; }).forEach(function(child) {
          sum += (rowIdx[child.id] && rowIdx[child.id][mk2]) || 0;
        });
      });
      if (sum > 0) totals[row.label] = {value: parseFloat(sum.toFixed(2)), color: row.color || '#93c5fd'};
    });
  }

  if (subs && subs.rows && subs.cols) {
    var subTotal = 0;
    set.forEach(function(mk2) {
      var parts = mk2.split('-').map(Number);
      subTotal += (subs.rows || []).reduce(function(s, r) { return s + calcSubCostForMonth(r, subs, parts[0], parts[1] - 1); }, 0);
    });
    if (subTotal > 0) {
      var existing = totals['Subscriptions'];
      totals['Subscriptions'] = {
        value: parseFloat(((existing ? existing.value : 0) + subTotal).toFixed(2)),
        color: (existing && existing.color) || '#0891b2'
      };
    }
  }

  return totals;
}

function combinedCategoryMonthlyData(exp, subs, months) {
  var map = new Map();
  var rowIdx = buildRowMonthIndex(exp);

  if (exp) {
    var globalRows = exp.rows || [];
    var allExpRows = new Map();
    globalRows.forEach(function(r) { allExpRows.set(r.id, r); });
    if (exp.rowsByMonth) {
      Object.values(exp.rowsByMonth).forEach(function(arr) {
        arr.forEach(function(r) { if (!allExpRows.has(r.id)) allExpRows.set(r.id, r); });
      });
    }
    Array.from(allExpRows.values()).filter(function(r) { return !r.parentId && !r.linked; }).forEach(function(row) {
      var vals = months.map(function(mk2) {
        var rows = expRows(exp, mk2);
        if (!rows.find(function(r) { return r.id === row.id; })) return 0;
        var sum = (rowIdx[row.id] && rowIdx[row.id][mk2]) || 0;
        rows.filter(function(c) { return c.parentId === row.id; }).forEach(function(child) {
          sum += (rowIdx[child.id] && rowIdx[child.id][mk2]) || 0;
        });
        return parseFloat(sum.toFixed(2));
      });
      if (vals.some(function(v) { return v > 0; })) map.set(row.label, {color: row.color || '#93c5fd', values: vals});
    });
  }

  if (subs && subs.rows && subs.cols) {
    var subVals = subCostPerMonth(subs, months);
    if (subVals.some(function(v) { return v > 0; })) {
      var existing = map.get('Subscriptions');
      if (existing) {
        map.set('Subscriptions', {
          color: existing.color || '#0891b2',
          values: existing.values.map(function(v, i) { return parseFloat((v + subVals[i]).toFixed(2)); })
        });
      } else {
        map.set('Subscriptions', {color: '#0891b2', values: subVals});
      }
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Month filtering
// ---------------------------------------------------------------------------
function filterMonths(allMonths, period) {
  if (period === 'all') return allMonths;
  var cap = todayMK();
  var actual = allMonths.filter(function(m) { return m <= cap; });
  return actual.slice(-parseInt(period));
}

// ---------------------------------------------------------------------------
// Income helpers
// ---------------------------------------------------------------------------
function incTrackerMonthTotals(inc) {
  var map = new Map();
  if (!inc || !inc.cells) return map;
  var allMks = new Set();
  Object.keys(inc.cells).forEach(function(k) { var mk2 = k.split('|')[0]; if (mk2) allMks.add(mk2); });
  allMks.forEach(function(mk2) {
    var total = 0;
    var rows = incRows(inc, mk2);
    // Months with an import.js-created "Imported" column only exist in colsByMonth (per-month
    // fork), not in the global inc.cols — mirrors the same fallback combinedMonthTotals uses for exp.cols.
    var mCols = (inc.colsByMonth && inc.colsByMonth[mk2]) || inc.cols || [];
    var getCurrency = function(rowId) { return (inc.monthRowCurrencies || {})[mk2 + '|' + rowId] || 'USD'; };
    rows.filter(function(r) { return !r.parentId; }).forEach(function(row) {
      var kids = rows.filter(function(c) { return c.parentId === row.id; });
      if (kids.length) {
        kids.forEach(function(child) {
          var cur = getCurrency(child.id);
          mCols.forEach(function(col) {
            var raw = parseFloat(inc.cells[mk2 + '|' + child.id + '|' + col.id] || 0) || 0;
            total += _coreToHome(raw, cur);
          });
        });
      } else {
        var cur = getCurrency(row.id);
        mCols.forEach(function(col) {
          var raw = parseFloat(inc.cells[mk2 + '|' + row.id + '|' + col.id] || 0) || 0;
          total += _coreToHome(raw, cur);
        });
      }
    });
    if (total > 0) map.set(mk2, parseFloat(total.toFixed(2)));
  });
  return map;
}

function mergedMonthIncomes(incMap) {
  // The Income Tracker is the sole source of income. The expenses panel's gross-income
  // field used to be a fallback here, but manual entry was removed (it desynced from this
  // total and stored raw USD without converting to the home currency), so there's nothing
  // left to fall back to.
  var out = {};
  incMap.forEach(function(val, mk2) { out[mk2] = val; });
  return out;
}

function expMonthIncomes(exp) {
  if (!exp || !exp.income) return {};
  var out = {};
  Object.entries(exp.income).forEach(function(entry) {
    var mk2 = entry[0], v = entry[1];
    var g = parseFloat(v.gross) || 0; if (g > 0) out[mk2] = g;
  });
  return out;
}
