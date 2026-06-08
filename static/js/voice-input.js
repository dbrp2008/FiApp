window.VoiceInput = (function () {
  'use strict';

  var _tracker = 'expenses';

  // ── Synonym dictionary ─────────────────────────────────────────────────
  var SYNONYMS = {
    // Groceries
    'food':'Groceries','grocery':'Groceries','groceries':'Groceries',
    'supermarket':'Groceries','market':'Groceries',
    'bought groceries':'Groceries','grocery run':'Groceries',
    // Dining Out
    'restaurant':'Dining Out','dining':'Dining Out','cafe':'Dining Out',
    'coffee shop':'Dining Out','lunch':'Dining Out','dinner':'Dining Out',
    'takeout':'Dining Out','takeaway':'Dining Out','delivery':'Dining Out',
    'eat at':'Dining Out','ate at':'Dining Out','eating out':'Dining Out',
    'lunch at':'Dining Out','dinner at':'Dining Out','breakfast at':'Dining Out',
    'went to restaurant':'Dining Out',
    // Transport
    'transport':'Transport','uber':'Transport','taxi':'Transport',
    'bus':'Transport','train':'Transport','mrt':'Transport','subway':'Transport',
    'grab ride':'Transport','took bus':'Transport','took train':'Transport',
    'took uber':'Transport','took taxi':'Transport','took mrt':'Transport',
    // Travel
    'trip to':'Travel','flew to':'Travel','fly to':'Travel','flight to':'Travel',
    'go to':'Travel','going to':'Travel','travel to':'Travel','travelled to':'Travel',
    'drive to':'Travel','drove to':'Travel','road trip':'Travel',
    'hotel':'Travel','airbnb':'Travel','vacation':'Travel','holiday':'Travel',
    // Housing
    'rent':'Housing','mortgage':'Housing',
    // Utilities
    'electricity':'Utilities','internet':'Utilities','wifi':'Utilities',
    'phone bill':'Utilities','water bill':'Utilities',
    // Healthcare
    'doctor':'Healthcare','hospital':'Healthcare','pharmacy':'Healthcare',
    'gym':'Healthcare','medicine':'Healthcare',
    // Shopping
    'clothes':'Shopping','clothing':'Shopping','shopping':'Shopping',
    // Entertainment
    'movie':'Entertainment','netflix':'Entertainment','spotify':'Entertainment',
    'streaming':'Entertainment','games':'Entertainment',
    // Income — Salary
    'salary':'Salary','wage':'Salary','paycheck':'Salary','pay':'Salary',
    'earn':'Salary','earns':'Salary','earning':'Salary','earnings':'Salary',
    'bonus':'Salary','commission':'Salary','tips':'Salary','tip':'Salary',
    'got paid':'Salary','got my pay':'Salary','received salary':'Salary',
    // Income — Freelance
    'freelance':'Freelance','consulting':'Freelance','side hustle':'Freelance',
    'client payment':'Freelance','project payment':'Freelance','gig':'Freelance',
    'contract work':'Freelance','invoiced':'Freelance',
    // Income — Investments
    'dividend':'Investments','interest':'Investments','stocks':'Investments',
    'stock':'Investments','shares':'Investments','crypto':'Investments',
    'bitcoin':'Investments','trading':'Investments','capital gain':'Investments',
    'from stocks':'Investments','from shares':'Investments','from crypto':'Investments',
    'investment return':'Investments','portfolio':'Investments',
  };

  // ── Currency dictionary ────────────────────────────────────────────────
  var CURRENCIES = {
    'dollar':  { code: 'USD', candidates: ['USD','AUD','CAD','SGD','HKD','NZD','TWD','BND','FJD','TTD','BBD','XCD','BZD','JMD','NAD','SBD','GYD','BMD','KYD'] },
    'dollars': { code: 'USD', candidates: ['USD','AUD','CAD','SGD','HKD','NZD','TWD','BND','FJD','TTD','BBD','XCD','BZD','JMD','NAD','SBD','GYD','BMD','KYD'] },
    'usd':'USD',
    'euro':'EUR','euros':'EUR','eur':'EUR',
    'pound':'GBP','pounds':'GBP','sterling':'GBP','gbp':'GBP',
    'yen':'JPY','jpy':'JPY',
    'yuan':'CNY','rmb':'CNY','renminbi':'CNY','cny':'CNY',
    'ringgit':'MYR','myr':'MYR',
    'baht':'THB','thb':'THB',
    'won':'KRW','krw':'KRW',
    'ruble':'RUB','rouble':'RUB','rubles':'RUB','roubles':'RUB','rub':'RUB',
    'dirham':'AED','aed':'AED',
    'dong':'VND','vnd':'VND',
    'zloty':'PLN','pln':'PLN',
    // Ambiguous — value is array of candidates
    'rupee':['INR','PKR','NPR','LKR'],
    'rupees':['INR','PKR','NPR','LKR'],
    'rs':['INR','PKR','NPR','LKR'],
    'franc':['CHF','XOF','XAF'],
    'francs':['CHF','XOF','XAF'],
    'peso':['MXN','PHP','COP','ARS'],
    'pesos':['MXN','PHP','COP','ARS'],
    'riyal':['SAR','QAR'],
    'riyals':['SAR','QAR'],
    'lira':['TRY','LBP'],
    'krone':['DKK','NOK'],
    'kroner':['DKK','NOK'],
  };

  var CURRENCY_NAMES = {
    'USD':'US dollars','AUD':'Australian dollars','CAD':'Canadian dollars',
    'SGD':'Singapore dollars','HKD':'Hong Kong dollars','NZD':'New Zealand dollars',
    'TWD':'Taiwan dollars','BND':'Brunei dollars','FJD':'Fiji dollars',
    'TTD':'Trinidad dollars','BBD':'Barbados dollars','XCD':'East Caribbean dollars',
    'BZD':'Belize dollars','JMD':'Jamaican dollars','NAD':'Namibian dollars',
    'SBD':'Solomon Islands dollars','GYD':'Guyanese dollars',
    'BMD':'Bermuda dollars','KYD':'Cayman dollars',
    'EUR':'euros','GBP':'British pounds','JPY':'Japanese yen','CNY':'Chinese yuan','KRW':'South Korean won',
    'INR':'Indian rupees','PKR':'Pakistani rupees','NPR':'Nepali rupees','LKR':'Sri Lankan rupees',
    'MYR':'Malaysian ringgit','THB':'Thai baht','VND':'Vietnamese dong','RUB':'Russian rubles','AED':'UAE dirhams',
    'PLN':'Polish zloty','CHF':'Swiss francs','XOF':'West African francs','XAF':'Central African francs',
    'MXN':'Mexican pesos','PHP':'Philippine pesos','COP':'Colombian pesos','ARS':'Argentine pesos',
    'SAR':'Saudi riyals','QAR':'Qatari riyals','TRY':'Turkish lira','LBP':'Lebanese pounds',
    'DKK':'Danish krone','NOK':'Norwegian krone',
  };

  function _currencyLabel(p) {
    var code = p && p.currency && p.currency.code;
    if (code) return CURRENCY_NAMES[code] || code;
    var first = p && p.currency && p.currency.candidates && p.currency.candidates[0];
    return first ? (CURRENCY_NAMES[first] || first) : 'dollars';
  }

  var COMMON_CURRENCIES = ['USD','EUR','GBP','JPY','CNY','AUD','CAD','SGD',
    'INR','PKR','KRW','MYR','THB','HKD','NZD','AED','CHF'];

  function _extractCurrency(lower) {
    if (/\bswiss\s+francs?\b/.test(lower)) return { code: 'CHF', candidates: null };
    var keys = Object.keys(CURRENCIES);
    for (var i = 0; i < keys.length; i++) {
      if (new RegExp('\\b' + keys[i] + '\\b').test(lower)) {
        var val = CURRENCIES[keys[i]];
        if (Array.isArray(val))               return { code: null,     candidates: val };
        if (typeof val === 'object' && val.candidates) return { code: val.code, candidates: val.candidates };
        return { code: val, candidates: null };
      }
    }
    // $ sign without a currency word → recognizer converted "dollars" to "$"
    if (/\$/.test(lower)) return { code: 'USD', candidates: ['USD','AUD','CAD','SGD','HKD','NZD','TWD','BND','FJD','TTD','BBD','XCD','BZD','JMD','NAD','SBD','GYD','BMD','KYD'] };
    return null;
  }

  // ── Adaptive learning ──────────────────────────────────────────────────
  var LEARN_KEY = 'fiapp_voice_learned';
  var STOPWORDS = new Set(['i','on','to','a','the','and','at','for','some',
    'spent','paid','bought','earned','received','income','salary','expense',
    'cost','spend','purchase','made','got','my','in','of','from',
    // currency words — too generic to be useful category signals
    'dollar','dollars','cent','cents','euro','euros','pound','pounds',
    'yen','yuan','rupee','rupees','rs','franc','francs','peso','pesos',
    'won','baht','ringgit','ruble','rubles','dirham','lira']);

  function _loadLearned() {
    try { return JSON.parse(localStorage.getItem(LEARN_KEY) || '{}'); } catch(e) { return {}; }
  }

  function _saveLearned(keys, rowId, rowLabel) {
    var d = _loadLearned();
    keys.forEach(function(k) {
      if (k.length < 3) return;
      if (!d[k]) d[k] = { rowId: rowId, rowLabel: rowLabel, count: 0 };
      if (d[k].rowId === rowId) {
        d[k].count++;
      } else {
        d[k] = { rowId: rowId, rowLabel: rowLabel, count: 1 };
      }
    });
    try { localStorage.setItem(LEARN_KEY, JSON.stringify(d)); } catch(e) {}
  }

  function _learnedKeys(transcript) {
    var allWords = transcript.toLowerCase()
      .replace(/\$?\s*\d+(?:[.,]\d+)?/g, '')
      .split(/\s+/)
      .filter(function(w) { return w.length >= 2; });
    var unigrams = allWords.filter(function(w) { return w.length >= 3 && !STOPWORDS.has(w); });
    var bigrams = [];
    for (var i = 0; i < allWords.length - 1; i++) {
      bigrams.push(allWords[i] + ' ' + allWords[i + 1]);
    }
    return unigrams.concat(bigrams);
  }

  // ── NLU helpers ────────────────────────────────────────────────────────
  function _bridge() {
    return _tracker === 'income' ? window._incVoiceBridge : window._expVoiceBridge;
  }

  function _detectTracker(lower) {
    if (/\b(spent|paid|bought|expense|cost|spend|purchase)\b/.test(lower)) return 'expenses';
    if (/\b(earned|received|income|salary|wage|made|got paid)\b/.test(lower)) return 'income';
    return _tracker;
  }

  function _detectAction(lower) {
    var hasAmount = /\$?\s*\d/.test(lower);
    if (/\b(delete|remove)\b/.test(lower) && !hasAmount) {
      // "remove all money/values/entries" = clear cells, not delete the row itself
      if (/\ball\b/.test(lower)) return 'clear-row';
      return 'delete-row';
    }
    if (/\b(clear|zero\s+out|wipe|reset)\b/.test(lower) && !hasAmount) return 'clear-row';
    if (/\b(delete|remove|subtract|minus|take off|deduct|reduce|cancel)\b/.test(lower)) return 'remove';
    if (/\b(add|create|new)\s+sub(?:category)?\b/.test(lower)) return 'add-subcategory';
    return 'add';
  }

  function _extractSubLabel(lower, rows) {
    // 1. Most explicit: "called NAME" / "named NAME"
    var m = lower.match(/\b(?:called|named)\s+(.+?)(?:\s+(?:to|under|for|in)\b|$)/);
    if (m && m[1].trim().length >= 2) return _titleCase(m[1].trim());
    // 2. Positional: "sub[category] NAME to/under/for PARENT"
    m = lower.match(/\bsub(?:\s*category)?\s+(.+?)(?:\s+(?:to|under|for)\b)/);
    if (m) {
      var label = m[1].replace(/^category\s*/i, '').trim();
      // Strip any known category names from the extracted label
      if (rows) rows.forEach(function(r) {
        label = label.replace(new RegExp('\\b' + r.label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), '').trim();
      });
      label = label.replace(/\b(in|the|a|an|and|or)\b/gi, '').replace(/\s+/g, ' ').trim();
      if (label.length >= 2) return _titleCase(label);
    }
    return null;
  }

  function _titleCase(str) {
    return str.replace(/\b\w/g, function(c){ return c.toUpperCase(); });
  }

  function _extractRelative(lower) {
    if (/\b(all|everything|whole|entire)\b/.test(lower))                         return 'all';
    if (/\b(half|50\s*%|50\s*percent)\b/.test(lower))                           return 'half';
    // "a quarter of X" = relative; "paid a quarter" = coin ($0.25) — only treat as relative when "of" follows
    if (/\b(quarter|a\s+quarter)\s+of\b|\b25\s*%|25\s*percent\b/.test(lower))  return 'quarter';
    if (/\b(third|a\s+third|one\s+third|33\s*%)\b/.test(lower))                 return 'third';
    return null;
  }

  function _resolveRelative(rel, existing) {
    if (rel === 'all')     return existing;
    if (rel === 'half')    return existing / 2;
    if (rel === 'quarter') return existing / 4;
    if (rel === 'third')   return existing / 3;
    return null;
  }

  function _wordToNum(w) {
    var map = {'a':1,'an':1,'one':1,'two':2,'three':3,'four':4,'five':5,
               'six':6,'seven':7,'eight':8,'nine':9,'ten':10};
    return map[w.toLowerCase()] !== undefined ? map[w.toLowerCase()] : (parseInt(w) || 1);
  }

  function _extractAmount(lower) {
    // 1. Merge split decimals: "1.0 1" → "1.01" (speech recognition artefact)
    var s = lower.replace(/(\d+[.,]\d+)\s+(\d+)/g, function(_, a, b) { return a + b; });

    // 2. "$X and Y cents"  OR  "X dollars and Y cents"
    var dcM = s.match(/\$\s*(\d+(?:[.,]\d+)?)\s+(?:and\s+)?(\d+)\s+cents?\b/)
           || s.match(/(\d+(?:[.,]\d+)?)\s+dollars?\s+(?:and\s+)?(\d+)\s+cents?\b/);
    if (dcM) return parseFloat(dcM[1].replace(',', '.')) + parseInt(dcM[2]) / 100;

    // 3. "X cents" → 0.0X
    var cM = s.match(/(\d+(?:[.,]\d+)?)\s+cents?\b/);
    if (cM) return parseFloat(cM[1].replace(',', '.')) / 100;

    // 4. Coins: quarters ($0.25), dimes ($0.10), nickels ($0.05)
    var qM = s.match(/\b(\d+|a|an|one|two|three|four|five|six|seven|eight)\s+quarters?\b/);
    if (qM) return _wordToNum(qM[1]) * 0.25;

    var dM = s.match(/\b(\d+|a|an|one|two|three|four|five)\s+dimes?\b/);
    if (dM) return _wordToNum(dM[1]) * 0.10;

    var nM = s.match(/\b(\d+|a|an|one|two|three)\s+nickels?\b/);
    if (nM) return _wordToNum(nM[1]) * 0.05;

    // 5. Number with multiplier: "50 million", "5 thousand", "1.5 billion"
    var mulM = s.match(/\$?\s*(\d+(?:[.,]\d+)?)\s+(billion|million|thousand|hundred)\b/);
    if (mulM) {
      var multipliers = { billion: 1e9, million: 1e6, thousand: 1e3, hundred: 100 };
      return parseFloat(mulM[1].replace(',', '.')) * multipliers[mulM[2]];
    }

    // 6. Spelled-out number word ("one dirham", "two dollars", etc.)
    var wM = s.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    if (wM) return _wordToNum(wM[1]);

    // 7. Regular number (with pre-merged decimal)
    var m = s.match(/\$?\s*(\d+(?:[.,]\d+)?)/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }

  function _extractWeekIndex(lower) {
    if (/\bweek\s*(1|one|1st|first)\b|\b(first|1st)\s+week\b/.test(lower))    return { index: 0, explicit: true };
    if (/\bweek\s*(2|two|2nd|second)\b|\b(second|2nd)\s+week\b/.test(lower))  return { index: 1, explicit: true };
    if (/\bweek\s*(3|three|3rd|third)\b|\b(third|3rd)\s+week\b/.test(lower))  return { index: 2, explicit: true };
    if (/\bweek\s*(4|four|4th|fourth)\b|\b(fourth|4th)\s+week\b/.test(lower)) return { index: 3, explicit: true };
    if (/\blast\s+week\b/.test(lower)) {
      var li = Math.max(0, Math.min(3, Math.floor((new Date().getDate() - 1) / 7)) - 1);
      return { index: li, explicit: true };
    }
    return { index: Math.min(3, Math.floor((new Date().getDate() - 1) / 7)), explicit: false };
  }

  function _matchCategory(lower, rows) {
    var best = { rowId: null, rowLabel: null, confidence: 0 };

    // 1. Exact label match — always beats learned dict (prevents stale learning overriding real category names)
    rows.forEach(function(row) {
      var label = row.label.toLowerCase();
      if (lower.indexOf(label) !== -1) {
        if (1.0 > best.confidence) best = { rowId: row.id, rowLabel: row.label, confidence: 1.0 };
      }
    });
    if (best.confidence >= 1.0) return best;

    // 2. Adaptive learned dictionary
    var learned = _loadLearned();
    var learnedDirty = false;
    var words = lower.split(/\s+/);
    var candidates = words.slice();
    for (var _i = 0; _i < words.length - 1; _i++) candidates.push(words[_i] + ' ' + words[_i + 1]);
    candidates.forEach(function(w) {
      if (w.length < 3) return;
      if (STOPWORDS.has(w)) return;
      var entry = learned[w];
      if (!entry) return;
      // Stale guard: row no longer exists — purge and skip
      if (!rows.some(function(r) { return r.id === entry.rowId; })) {
        delete learned[w]; learnedDirty = true; return;
      }
      var conf = entry.count >= 2 ? 0.95 : 0.85;
      if (conf > best.confidence) {
        best = { rowId: entry.rowId, rowLabel: entry.rowLabel, confidence: conf };
      }
    });
    if (learnedDirty) try { localStorage.setItem(LEARN_KEY, JSON.stringify(learned)); } catch(e) {}
    if (best.confidence >= 0.95) return best;

    // 3. Partial: any label word (>2 chars) found in transcript
    rows.forEach(function(row) {
      var labelWords = row.label.toLowerCase().split(/\s+/);
      var hit = labelWords.some(function(lw) { return lw.length > 2 && lower.indexOf(lw) !== -1; });
      if (hit && best.confidence < 0.8) {
        best = { rowId: row.id, rowLabel: row.label, confidence: 0.8 };
      }
    });

    // 4. Synonym dictionary
    rows.forEach(function(row) {
      var label = row.label.toLowerCase();
      Object.keys(SYNONYMS).forEach(function(syn) {
        if (lower.indexOf(syn) !== -1 && SYNONYMS[syn].toLowerCase() === label) {
          if (best.confidence < 0.7) {
            best = { rowId: row.id, rowLabel: row.label, confidence: 0.7 };
          }
        }
      });
    });

    return best;
  }

  function _parseTranscript(transcript) {
    var lower   = transcript.toLowerCase();
    var br      = _bridge();
    var rows    = br.getRows();
    var cols    = br.getCols();
    var weekResult  = _extractWeekIndex(lower);
    var isForecast  = typeof br.isForecastMonth === 'function' ? br.isForecastMonth() : false;
    // On forecast months with no explicit week, default to week 1 (date-based default is meaningless)
    var weekIdx     = (!weekResult.explicit && isForecast) ? 0 : weekResult.index;
    var col         = cols[weekIdx] || cols[0] || {};
    var match       = _matchCategory(lower, rows);
    var isLastWeekInWeek1 = /\blast\s+week\b/.test(lower) && weekIdx === 0;
    var action = _detectAction(lower);
    return {
      transcript:      transcript,
      tracker:         _detectTracker(lower),
      action:          action,
      amount:          _extractAmount(lower),
      relAmount:       _extractRelative(lower),
      subLabel:        action === 'add-subcategory' ? _extractSubLabel(lower, rows) : null,
      currency:        _extractCurrency(lower),
      weekIndex:       weekIdx,
      weekExplicit:    weekResult.explicit,
      rowId:           match.rowId,
      rowLabel:        match.rowLabel,
      confidence:      match.confidence,
      colId:           col.id || null,
      colLabel:        col.label || ('Week ' + (weekIdx + 1)),
      lastWeekInWeek1: isLastWeekInWeek1,
      isForecast:      isForecast,
    };
  }

  // ── Speech state ───────────────────────────────────────────────────────
  var _recognition   = null;
  var _isListening   = false;
  var _pendingResult = null;
  var _hardTimeout   = null;

  function _getSpeechAPI() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function _buildRecognition() {
    var API = _getSpeechAPI(); if (!API) return null;
    var r = new API();
    r.continuous     = false;
    r.interimResults = true;
    r.lang           = 'en-US';
    r._final         = '';
    r.onstart  = function () { _isListening = true; _showListening(); };
    r.onresult = function (e) {
      var t = '';
      for (var i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      var el = document.getElementById('_vi-live'); if (el) el.textContent = t;
      if (e.results[e.results.length - 1].isFinal) r._final = t;
    };
    r.onend = function () {
      _isListening = false;
      if (_hardTimeout) { clearTimeout(_hardTimeout); _hardTimeout = null; }
      _hideListening();
      if (r._final && r._final.trim()) _decide(_parseTranscript(r._final.trim()));
    };
    r.onerror = function (e) {
      _isListening = false;
      if (_hardTimeout) { clearTimeout(_hardTimeout); _hardTimeout = null; }
      _hideListening();
      if (e.error !== 'aborted') _toast('Voice error: ' + e.error);
    };
    return r;
  }

  function start() {
    if (_isListening) { stop(); return; }
    try { var _wt=JSON.parse(localStorage.getItem('fiapp_walkthrough_v1')||'null'); if(_wt&&_wt.active){_toast('🧭 Voice input unavailable during the walkthrough.');return;} } catch(_) {}
    _recognition = _buildRecognition(); if (!_recognition) return;
    if (!sessionStorage.getItem('_vi_ringer_hint')) {
      sessionStorage.setItem('_vi_ringer_hint', '1');
      _toast('Tip: make sure your ringer is on for voice input');
    }
    try {
      _recognition.start();
      _hardTimeout = setTimeout(function () { stop(); }, 10000);
    } catch (e) { _toast('Could not start microphone.'); }
  }
  function stop() { if (_recognition) try { _recognition.stop(); } catch (e) {} }

  // ── Decision logic ─────────────────────────────────────────────────────
  function _alwaysConfirm() {
    return localStorage.getItem('fiapp_voice_always_confirm') === 'true';
  }

  function _hasSubcategories(rowId) {
    if (!rowId) return false;
    return _bridge().getRows().some(function (r) { return r.parentId === rowId; });
  }

  function _decide(p) {
    if (typeof _bridge().isLockedMonth === 'function' && _bridge().isLockedMonth()) {
      _toast('🔒 This month is locked — reopen it to make changes.');
      return;
    }
    if (p.action === 'delete-row' || p.action === 'add-subcategory') { _showConfirmSheet(p); return; }
    var autoLog = (
      p.confidence >= 0.95
      && !_hasSubcategories(p.rowId)
      && p.amount !== null
      && !p.relAmount              // relative amounts always confirm so user sees resolved value
      && !_alwaysConfirm()
      && !p.lastWeekInWeek1
      && !(p.isForecast && !p.weekExplicit)  // forecast month with no stated week: confirm so user can verify which week
    );
    if (autoLog) { _applyResult(p); } else { _showConfirmSheet(p); }
  }

  // ── Apply (commit) ─────────────────────────────────────────────────────
  function _applyResult(p) {
    if (!p || !p.rowId) return;
    if (p.action === 'clear-row') {
      var br = _bridge();
      br.snapshot();
      var cols = br.getCols();
      cols.forEach(function(col) { if (col.id) br.setCell(p.rowId, col.id, ''); });
      br.render();
      _hideConfirmSheet();
      _toast('Cleared all values from ' + (p.rowLabel || 'row') + '.');
      return;
    }
    if (p.action === 'delete-row') {
      var br = _bridge();
      br.snapshot();
      br.deleteRow(p.rowId);
      br.render();
      // Purge learned entries pointing to the now-deleted row
      var learned = _loadLearned();
      var dirty = false;
      Object.keys(learned).forEach(function(k) {
        if (learned[k].rowId === p.rowId) { delete learned[k]; dirty = true; }
      });
      if (dirty) try { localStorage.setItem(LEARN_KEY, JSON.stringify(learned)); } catch(e) {}
      _hideConfirmSheet();
      _speak('Deleted ' + p.rowLabel);
      _toast('🗑 Deleted ' + p.rowLabel);
      return;
    }
    if (p.action === 'add-subcategory') {
      if (!p.subLabel) { _toast('No subcategory name.'); return; }
      var br = _bridge();
      br.addSubRow(p.rowId, p.subLabel);
      _hideConfirmSheet();
      _speak('Added subcategory ' + p.subLabel + ' under ' + p.rowLabel);
      _toast('Added subcategory "' + p.subLabel + '" under ' + p.rowLabel);
      return;
    }
    if (p.amount === null) return;
    var br = _bridge();
    var cols = br.getCols();
    var effectiveRowId = (p._subRowId !== null && p._subRowId !== undefined) ? p._subRowId : p.rowId;
    var colId = p.colId || ((cols[p.weekIndex] || cols[0] || {}).id);
    if (!colId) { _toast('Could not determine column.'); return; }
    br.forkCurrentMonth();
    br.snapshot();
    var existing = parseFloat(br.getCell(effectiveRowId, colId) || '0') || 0;
    var isRemove = p.action === 'remove';
    var newCurrency = p.currency && p.currency.code;
    var existingCurrency = (newCurrency && typeof br.rowCurrency === 'function')
      ? br.rowCurrency(effectiveRowId) : null;
    var currencyChanging = newCurrency && existingCurrency && newCurrency !== existingCurrency;

    // Helper that finishes writing after we have the final amount
    function _commit(amountInRowCurrency, appliedCurrency, convertedNote) {
      var newVal = isRemove
        ? Math.max(0, existing - amountInRowCurrency)
        : existing + amountInRowCurrency;
      br.setCell(effectiveRowId, colId, newVal.toFixed(2));
      br.updateAll(effectiveRowId);
      br.render();
      _saveLearned(_learnedKeys(p.transcript), p.rowId, p.rowLabel);
      _hideConfirmSheet();
      var verb = isRemove ? 'Removed' : 'Added';
      var prep  = isRemove ? 'from'    : 'to';
      var weekPart = (br.getCols().length > 1 && p.colLabel) ? ', ' + p.colLabel : '';
      var spokenAmt = p.amount.toFixed(0) + ' ' + _currencyLabel(p);
      _speak(verb + ' ' + spokenAmt + ' ' + prep + ' ' + p.rowLabel + weekPart);
      var toastAmt = (newCurrency || '') + (newCurrency ? ' ' : '$') + p.amount.toFixed(2);
      _toast(verb + ' ' + toastAmt + (convertedNote ? ' ' + convertedNote : '') + ' ' + prep + ' ' + p.rowLabel + weekPart);
    }

    if (currencyChanging && typeof window.fiappConvert === 'function') {
      // Convert the spoken amount into the row's existing currency, then add
      _toast('Converting ' + newCurrency + ' → ' + existingCurrency + '…');
      window.fiappConvert(p.amount, newCurrency, existingCurrency).then(function(converted) {
        _commit(converted, null, '(≈ ' + existingCurrency + ' ' + converted.toFixed(2) + ')');
      }).catch(function() {
        _toast('Could not convert ' + newCurrency + ' → ' + existingCurrency + '. Check connection.');
      });
    } else {
      _commit(p.amount, newCurrency || null, null);
    }
  }

  // ── TTS ────────────────────────────────────────────────────────────────
  function _speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05; u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  function _toast(msg) {
    var el = document.createElement('div');
    el.className = 'voice-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }

  // ── UI state helpers ───────────────────────────────────────────────────
  function _showListening() {
    var fab = document.getElementById('_vi-fab');
    var ov  = document.getElementById('_vi-ov');
    if (fab) fab.classList.add('listening');
    if (ov)  ov.classList.add('active');
    var live = document.getElementById('_vi-live'); if (live) live.textContent = 'Listening…';
  }
  function _hideListening() {
    var fab = document.getElementById('_vi-fab'); if (fab) fab.classList.remove('listening');
    var ov  = document.getElementById('_vi-ov');  if (ov)  ov.classList.remove('active');
  }

  // ── Confirm sheet ──────────────────────────────────────────────────────
  function _showConfirmSheet(p) {
    _pendingResult = p;
    _refreshSheet();
    document.getElementById('_vi-sheet').classList.add('active');
    var msg;
    if (p.action === 'delete-row') {
      msg = 'Please confirm: delete category ' + (p.rowLabel || 'unknown');
    } else if (p.action === 'clear-row') {
      msg = 'Please confirm: clear all values from ' + (p.rowLabel || 'row');
    } else if (p.action === 'add-subcategory') {
      msg = 'Please confirm: add subcategory ' + (p.subLabel || 'unknown') + ' under ' + (p.rowLabel || 'unknown category');
    } else {
      var _verb = p.action === 'remove' ? 'remove' : 'add';
      var _prep = p.action === 'remove' ? 'from'   : 'to';
      msg = 'Please confirm: ' + _verb + ' ' +
        (p.amount !== null ? p.amount.toFixed(0) + ' ' + _currencyLabel(p) : 'unknown amount') +
        (p.rowLabel ? ' ' + _prep + ' ' + p.rowLabel : '') +
        (_bridge().getCols().length > 1 && p.colLabel ? ' ' + p.colLabel : '');
    }
    _speak(msg);
    var ttsEl = document.getElementById('_vi-tts-text');
    if (ttsEl) ttsEl.textContent = '"' + msg + '"';
  }

  function _refreshSheet() {
    var p = _pendingResult; if (!p) return;
    var br = _bridge();

    // Always reset the currency picker rows to hidden on each new command so stale
    // state from a previous command (e.g. SAR from "add 1 riyal to X") never bleeds
    // into the next command's sheet.
    document.getElementById('_vi-cur-row').style.display = 'none';
    document.getElementById('_vi-cur-other-row').style.display = 'none';
    document.querySelector('.voice-chips').style.display = 'flex';

    document.getElementById('_vi-heard').textContent = '"' + p.transcript + '"';
    document.getElementById('_vi-last-week-note').style.display = p.lastWeekInWeek1 ? '' : 'none';
    document.getElementById('_vi-forecast-note').style.display  = p.isForecast      ? '' : 'none';

    // Resolve relative amount (re-runs on every refresh so week-chip changes update it)
    if (p.relAmount && p.rowId && p.colId) {
      var _cur = parseFloat(br.getCell(p.rowId, p.colId) || '0') || 0;
      var _resolved = _resolveRelative(p.relAmount, _cur);
      if (_resolved !== null) p.amount = Math.max(0, _resolved);
    }

    var nocat = !p.rowId;
    document.getElementById('_vi-no-cat').style.display     = nocat ? '' : 'none';
    document.getElementById('_vi-create-cat').style.display = nocat ? '' : 'none';

    var subSection = document.getElementById('_vi-sub-section');
    var subChips   = document.getElementById('_vi-sub-chips');
    var subs = p.rowId ? br.getRows().filter(function(r) { return r.parentId === p.rowId; }) : [];
    if (subs.length > 0) {
      subChips.innerHTML = '';
      p._subRowId = null;
      subs.forEach(function (sub) {
        var btn = document.createElement('button');
        btn.className = 'voice-sub-chip'; btn.textContent = sub.label;
        btn.addEventListener('click', function () {
          p._subRowId = sub.id;
          subChips.querySelectorAll('.voice-sub-chip').forEach(function(b){ b.classList.remove('selected'); });
          btn.classList.add('selected');
          _updateConfirmBtn();
        });
        subChips.appendChild(btn);
      });
      subSection.style.display = '';
    } else {
      subSection.style.display = 'none';
      p._subRowId = undefined;
    }

    var isDeleteRow   = p.action === 'delete-row';
    var isClearRow    = p.action === 'clear-row';
    var isAddSub      = p.action === 'add-subcategory';
    var hideAmtWk     = isDeleteRow || isClearRow || isAddSub;

    var catChip = document.getElementById('_vi-c-cat');
    catChip.textContent = p.rowLabel || 'Category ?';
    catChip.classList.toggle('voice-chip-unset', !p.rowId);

    var subChip = document.getElementById('_vi-c-sub');
    subChip.style.display = isAddSub ? '' : 'none';
    if (isAddSub) {
      subChip.textContent = p.subLabel || 'Sub name ?';
      subChip.classList.toggle('voice-chip-unset', !p.subLabel);
    }

    var amtChip = document.getElementById('_vi-c-amt');
    var wkChip  = document.getElementById('_vi-c-wk');
    amtChip.style.display = hideAmtWk ? 'none' : '';
    wkChip.style.display  = hideAmtWk ? 'none' : '';
    if (!hideAmtWk) {
      if (p.amount !== null) {
        amtChip.textContent = p.relAmount
          ? p.relAmount + ' → $' + p.amount.toFixed(2)
          : '$' + p.amount.toFixed(2);
      } else {
        amtChip.textContent = 'Amount ?';
      }
      amtChip.classList.toggle('voice-chip-unset', p.amount === null);
      wkChip.textContent = p.colLabel || ('Week ' + (p.weekIndex + 1));
    }

    // Currency chip — always shown on income tracker
    var curChip = document.getElementById('_vi-c-cur');
    var showCur = _tracker === 'income' && !isDeleteRow && !isClearRow && !isAddSub;
    curChip.style.display = showCur ? '' : 'none';
    if (showCur) {
      // If no currency was detected at all, initialise from the row's existing currency
      if (!p.currency) {
        var existingCode = (p.rowId && typeof br.rowCurrency === 'function')
          ? br.rowCurrency(p.rowId) : 'USD';
        p.currency = { code: existingCode, candidates: COMMON_CURRENCIES };
      }
      // If ambiguous (e.g. "rupees" → candidates ['INR','PKR','NPR','LKR']) and the row's
      // own currency is in that candidate list, auto-resolve to it so confirm isn't blocked.
      // Crucially, keep candidates intact so the picker shows only the word-specific variants
      // (INR, PKR, NPR, LKR) rather than the full COMMON_CURRENCIES list.
      if (p.currency.candidates && !p.currency.code && p.rowId && typeof br.rowCurrency === 'function') {
        var rowCode = br.rowCurrency(p.rowId);
        if (rowCode && p.currency.candidates.indexOf(rowCode) !== -1) {
          p.currency.code = rowCode;
        }
      }
      var isAmbiguous = !!(p.currency.candidates && !p.currency.code);
      curChip.textContent = p.currency.code || (p.currency.candidates[0] + '?');
      curChip.classList.toggle('voice-chip-unset', isAmbiguous);
    }

    var confirmBtn = document.getElementById('_vi-confirm');
    if (isDeleteRow) {
      confirmBtn.textContent = '🗑 Delete';
      confirmBtn.style.background = '#dc2626';
    } else if (isAddSub) {
      confirmBtn.textContent = '+ Add Subcategory';
      confirmBtn.style.background = '';
    } else {
      confirmBtn.textContent = '✓ Confirm';
      confirmBtn.style.background = '';
    }

    _updateConfirmBtn();
  }

  function _updateConfirmBtn() {
    var p = _pendingResult;
    var ok;
    if (p && (p.action === 'delete-row' || p.action === 'clear-row')) {
      ok = !!p.rowId;
    } else if (p && p.action === 'add-subcategory') {
      ok = !!(p.rowId && p.subLabel);
    } else {
      var hasSubs = p && p.rowId
        ? _bridge().getRows().some(function(r){ return r.parentId === p.rowId; })
        : false;
      var subOk = !hasSubs || (p._subRowId !== null && p._subRowId !== undefined);
      var curOk = !(_tracker === 'income' && p.currency && p.currency.candidates && !p.currency.code);
      ok = !!(p && p.rowId && p.amount !== null && subOk && curOk);
    }
    document.getElementById('_vi-confirm').disabled = !ok;
  }

  function _hideConfirmSheet() {
    document.getElementById('_vi-sheet').classList.remove('active');
    document.getElementById('_vi-cur-row').style.display = 'none';
    document.getElementById('_vi-cur-other-row').style.display = 'none';
    document.querySelector('.voice-chips').style.display = 'flex';
    _pendingResult = null;
  }

  // ── Category picker ────────────────────────────────────────────────────
  function _showCatPicker(onSelect) {
    var rows = _bridge().getRows();
    var list = document.getElementById('_vi-cat-list');
    list.innerHTML = '';
    rows.forEach(function (row) {
      var li = document.createElement('li');
      li.className = 'voice-cat-item';
      li.dataset.label = row.label;
      li.textContent = (row.parentId ? '└ ' : '') + row.label;
      li.addEventListener('click', function () { _hideCatPicker(); onSelect(row); });
      list.appendChild(li);
    });
    document.getElementById('_vi-cat-search').value = '';
    document.getElementById('_vi-cat-picker').classList.add('active');
    setTimeout(function () { document.getElementById('_vi-cat-search').focus(); }, 80);
  }
  function _hideCatPicker() {
    document.getElementById('_vi-cat-picker').classList.remove('active');
  }

  // ── Wire event handlers ────────────────────────────────────────────────
  function _wireHandlers() {
    document.getElementById('_vi-c-cat').addEventListener('click', function () {
      _showCatPicker(function (row) {
        _pendingResult.rowId      = row.id;
        _pendingResult.rowLabel   = row.label;
        _pendingResult.confidence = 1.0;
        _refreshSheet();
      });
    });

    document.getElementById('_vi-c-amt').addEventListener('click', function () {
      var inp = document.getElementById('_vi-amt-input');
      inp.value = _pendingResult.amount !== null ? _pendingResult.amount : '';
      document.getElementById('_vi-amt-row').style.display = 'flex';
      document.querySelector('.voice-chips').style.display = 'none';
      setTimeout(function () { inp.focus(); }, 50);
    });

    function _commitAmt() {
      var inp = document.getElementById('_vi-amt-input');
      var n = parseFloat(inp.value);
      if (!isNaN(n) && n > 0) { _pendingResult.amount = n; }
      document.getElementById('_vi-amt-row').style.display = 'none';
      document.querySelector('.voice-chips').style.display = 'flex';
      _refreshSheet();
    }

    // Currency chip — opens dropdown select
    document.getElementById('_vi-c-cur').addEventListener('click', function () {
      var p = _pendingResult;
      if (!p || !p.currency) return;
      var list = p.currency.candidates || COMMON_CURRENCIES;
      // If using the full common list, surface the current code and USD at the top
      if (!p.currency.candidates) {
        var cur = p.currency.code || 'USD';
        var top = [cur];
        if (cur !== 'USD') top.push('USD');
        list = top.concat(COMMON_CURRENCIES.filter(function(c){ return top.indexOf(c) === -1; }));
      }
      var sel = document.getElementById('_vi-cur-select');
      sel.innerHTML = '';
      list.forEach(function(code) {
        var opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code + (CURRENCY_NAMES[code] ? '  —  ' + CURRENCY_NAMES[code] : '');
        if (code === p.currency.code) opt.selected = true;
        sel.appendChild(opt);
      });
      var otherOpt = document.createElement('option');
      otherOpt.value = '__other__';
      otherOpt.textContent = '— Other —';
      sel.appendChild(otherOpt);
      document.getElementById('_vi-cur-row').style.display = 'flex';
      document.querySelector('.voice-chips').style.display = 'none';
    });

    function _commitCurrency() {
      var sel = document.getElementById('_vi-cur-select');
      if (sel.value === '__other__') {
        document.getElementById('_vi-cur-row').style.display = 'none';
        document.getElementById('_vi-cur-other-row').style.display = 'flex';
        setTimeout(function(){ document.getElementById('_vi-cur-other-input').focus(); }, 50);
        return;
      }
      if (_pendingResult && sel.value) _pendingResult.currency.code = sel.value;
      document.getElementById('_vi-cur-row').style.display = 'none';
      document.querySelector('.voice-chips').style.display = 'flex';
      _refreshSheet();
    }

    document.getElementById('_vi-cur-ok').addEventListener('click', _commitCurrency);

    function _commitCurrencyOther() {
      var inp = document.getElementById('_vi-cur-other-input');
      var code = inp.value.trim().toUpperCase();
      if (code.length >= 2 && code.length <= 4 && _pendingResult) {
        _pendingResult.currency.code = code;
        if (!_pendingResult.currency.candidates) _pendingResult.currency.candidates = [code];
      }
      document.getElementById('_vi-cur-other-row').style.display = 'none';
      document.querySelector('.voice-chips').style.display = 'flex';
      _refreshSheet();
    }

    document.getElementById('_vi-cur-other-ok').addEventListener('click', _commitCurrencyOther);
    document.getElementById('_vi-cur-other-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); _commitCurrencyOther(); }
    });

    // Sub-name chip
    document.getElementById('_vi-c-sub').addEventListener('click', function () {
      var inp = document.getElementById('_vi-sub-name-input');
      inp.value = _pendingResult.subLabel || '';
      document.getElementById('_vi-sub-name-row').style.display = 'flex';
      document.querySelector('.voice-chips').style.display = 'none';
      setTimeout(function () { inp.focus(); }, 50);
    });

    function _commitSubName() {
      var inp = document.getElementById('_vi-sub-name-input');
      var v = inp.value.trim();
      if (v) _pendingResult.subLabel = v;
      document.getElementById('_vi-sub-name-row').style.display = 'none';
      document.querySelector('.voice-chips').style.display = 'flex';
      _refreshSheet();
    }

    document.getElementById('_vi-sub-name-ok').addEventListener('click', _commitSubName);
    document.getElementById('_vi-sub-name-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); _commitSubName(); }
    });

    document.getElementById('_vi-amt-ok').addEventListener('click', _commitAmt);
    document.getElementById('_vi-amt-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); _commitAmt(); }
    });

    document.getElementById('_vi-c-wk').addEventListener('click', function () {
      var cols = _bridge().getCols();
      var next = (_pendingResult.weekIndex + 1) % cols.length;
      _pendingResult.weekIndex = next;
      _pendingResult.colId     = cols[next].id;
      _pendingResult.colLabel  = cols[next].label;
      _refreshSheet();
    });

    document.getElementById('_vi-confirm').addEventListener('click', function () {
      if (_pendingResult) _applyResult(_pendingResult);
    });

    document.getElementById('_vi-cancel').addEventListener('click', _hideConfirmSheet);

    document.getElementById('_vi-create-btn').addEventListener('click', function () {
      var name = window.prompt('New category name:');
      if (!name || !name.trim()) return;
      var br = _bridge();
      var before = br.getRows().length;
      br.forkCurrentMonth();
      br.addRow();
      var rows = br.getRows();
      if (rows.length === before) { _toast('Maximum rows reached.'); return; }
      var newRow = rows[rows.length - 1];
      newRow.label = name.trim();
      br.render();
      _pendingResult.rowId      = newRow.id;
      _pendingResult.rowLabel   = newRow.label;
      _pendingResult.confidence = 1.0;
      _refreshSheet();
    });

    document.getElementById('_vi-cat-back').addEventListener('click', _hideCatPicker);

    document.getElementById('_vi-cat-search').addEventListener('input', function () {
      var q = this.value.toLowerCase();
      document.querySelectorAll('.voice-cat-item').forEach(function (li) {
        li.style.display = li.dataset.label.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
      });
    });
  }

  // ── Build all DOM elements (called once in init) ───────────────────────
  function _buildUI() {
    // FAB
    var fab = document.createElement('button');
    fab.id = '_vi-fab'; fab.className = 'voice-fab';
    fab.setAttribute('aria-label', 'Voice input');
    fab.innerHTML = '🎤';
    // ── Drag-to-reposition ────────────────────────────────────────
    var _fabHoldTimer = null, _fabDragActive = false, _fabDragReady = false;
    var _fabOffX = 0, _fabOffY = 0, _fabStartX = 0, _fabStartY = 0;
    var _fabDidDrag = false, _fabPtrId = null;
    var _FAB_HOLD_MS = 400, _FAB_CANCEL_PX = 8;

    function _fabSwitchAbs() {
      var r = fab.getBoundingClientRect();
      fab.style.top = r.top + 'px'; fab.style.left = r.left + 'px';
      fab.style.bottom = 'auto'; fab.style.right = 'auto';
    }
    function _fabSavePos() {
      try { localStorage.setItem('fiapp_mic_pos', JSON.stringify({top: parseInt(fab.style.top), left: parseInt(fab.style.left)})); } catch(e) {}
    }
    function _fabRestorePos() {
      try {
        var s = JSON.parse(localStorage.getItem('fiapp_mic_pos') || 'null');
        if (!s) return;
        var vw = window.innerWidth, vh = window.innerHeight, sz = 56;
        fab.style.top  = Math.max(8, Math.min(s.top,  vh - sz - 8)) + 'px';
        fab.style.left = Math.max(8, Math.min(s.left, vw - sz - 8)) + 'px';
        fab.style.bottom = 'auto'; fab.style.right = 'auto';
      } catch(e) {}
    }

    fab.addEventListener('pointerdown', function(e) {
      if (fab.classList.contains('listening')) return;
      try { var _wt=JSON.parse(localStorage.getItem('fiapp_walkthrough_v1')||'null'); if(_wt&&_wt.active) return; } catch(_) {}
      _fabDidDrag = false; _fabDragActive = false; _fabDragReady = false;
      _fabStartX = e.clientX; _fabStartY = e.clientY;
      _fabPtrId = e.pointerId;
      _fabHoldTimer = setTimeout(function() {
        _fabHoldTimer = null;
        _fabDragReady = true;
        fab.classList.add('drag-ready');
        _fabSwitchAbs();
        try { fab.setPointerCapture(_fabPtrId); } catch(err) {}
      }, _FAB_HOLD_MS);
    });

    fab.addEventListener('pointermove', function(e) {
      // Cancel hold detection if the user moves too far (they're scrolling past)
      if (_fabHoldTimer) {
        if (Math.abs(e.clientX - _fabStartX) > _FAB_CANCEL_PX || Math.abs(e.clientY - _fabStartY) > _FAB_CANCEL_PX) {
          clearTimeout(_fabHoldTimer); _fabHoldTimer = null;
        }
        return;
      }
      if (!_fabDragReady && !_fabDragActive) return;
      // First move after hold fires — lock in the drag offset and enter dragging state
      if (_fabDragReady) {
        var r = fab.getBoundingClientRect();
        _fabOffX = e.clientX - r.left; _fabOffY = e.clientY - r.top;
        _fabDragActive = true; _fabDragReady = false; _fabDidDrag = true;
        fab.classList.remove('drag-ready'); fab.classList.add('dragging');
      }
      if (_fabDragActive) {
        e.preventDefault();
        var vw = window.innerWidth, vh = window.innerHeight, sz = 56;
        fab.style.left = Math.max(8, Math.min(e.clientX - _fabOffX, vw - sz - 8)) + 'px';
        fab.style.top  = Math.max(8, Math.min(e.clientY - _fabOffY, vh - sz - 8)) + 'px';
      }
    });

    fab.addEventListener('pointerup', function(e) {
      if (_fabHoldTimer) { clearTimeout(_fabHoldTimer); _fabHoldTimer = null; }
      fab.classList.remove('drag-ready', 'dragging');
      try { fab.releasePointerCapture(e.pointerId); } catch(err) {}
      var wasDragging = _fabDragActive;
      _fabDragActive = false; _fabDragReady = false;
      if (wasDragging) { _fabSavePos(); return; } // dropped — save & don't open mic
      if (!_fabDidDrag) start();                   // normal tap — open mic
    });

    fab.addEventListener('pointercancel', function() {
      if (_fabHoldTimer) { clearTimeout(_fabHoldTimer); _fabHoldTimer = null; }
      fab.classList.remove('drag-ready', 'dragging');
      _fabDragActive = false; _fabDragReady = false;
    });
    // ── end drag ──────────────────────────────────────────────────

    document.body.appendChild(fab);
    _fabRestorePos();
    function _syncFabWt(){try{var wt=JSON.parse(localStorage.getItem('fiapp_walkthrough_v1')||'null');fab.classList.toggle('wt-disabled',!!(wt&&wt.active));}catch(_){}}
    _syncFabWt();
    window.addEventListener('storage',_syncFabWt);

    // Listening overlay
    var ov = document.createElement('div');
    ov.id = '_vi-ov'; ov.className = 'voice-listening-overlay';
    ov.innerHTML = '<div class="voice-pulse-ring"></div>' +
                   '<p id="_vi-live" class="voice-live-transcript">Listening…</p>';
    ov.addEventListener('click', stop);
    document.body.appendChild(ov);

    // Confirm sheet
    var sheet = document.createElement('div');
    sheet.id = '_vi-sheet'; sheet.className = 'voice-confirm-sheet';
    sheet.innerHTML =
      '<div id="_vi-tts-row" class="voice-tts-row"><span>&#x1F50A;</span><span id="_vi-tts-text"></span></div>' +
      '<div id="_vi-heard" class="voice-heard"></div>' +
      '<div id="_vi-last-week-note" class="voice-warning" style="display:none">' +
        'Did you mean last month\’s Week 4? If so, close and navigate to that month first.' +
      '</div>' +
      '<div id="_vi-forecast-note" class="voice-forecast-note" style="display:none">' +
        '📂 Forecast month — you\'re editing a future month.' +
      '</div>' +
      '<div id="_vi-no-cat" class="voice-warning" style="display:none">No category matched — tap Category to pick one.</div>' +
      '<div id="_vi-sub-section" style="display:none">' +
        '<div class="voice-sub-label">Which subcategory?</div>' +
        '<div id="_vi-sub-chips" class="voice-sub-chips"></div>' +
      '</div>' +
      '<div class="voice-chips">' +
        '<button id="_vi-c-cat" class="voice-chip">Category ?</button>' +
        '<button id="_vi-c-sub" class="voice-chip" style="display:none">Sub name ?</button>' +
        '<button id="_vi-c-amt" class="voice-chip">Amount ?</button>' +
        '<button id="_vi-c-wk"  class="voice-chip">Week ?</button>' +
        '<button id="_vi-c-cur" class="voice-chip" style="display:none">Currency</button>' +
      '</div>' +
      '<div id="_vi-cur-row" style="display:none;align-items:center;gap:.5rem;margin:.25rem 0 .6rem;">' +
        '<select id="_vi-cur-select" style="flex:1;padding:.55rem .75rem;border:2px solid var(--accent);border-radius:10px;font-size:1rem;background:var(--panel-bg);color:var(--fg);font-family:inherit;"></select>' +
        '<button id="_vi-cur-ok" class="voice-btn-confirm" style="flex:none;padding:.55rem .9rem;">OK</button>' +
      '</div>' +
      '<div id="_vi-cur-other-row" style="display:none;align-items:center;gap:.5rem;margin:.25rem 0 .6rem;">' +
        '<input id="_vi-cur-other-input" type="text" maxlength="4" placeholder="Currency code (e.g. BDT)" autocomplete="off" style="flex:1;padding:.55rem .75rem;border:2px solid var(--accent);border-radius:10px;font-size:1rem;background:var(--panel-bg);color:var(--fg);font-family:inherit;text-transform:uppercase;">' +
        '<button id="_vi-cur-other-ok" class="voice-btn-confirm" style="flex:none;padding:.55rem .9rem;">OK</button>' +
      '</div>' +
      '<div id="_vi-sub-name-row" style="display:none;align-items:center;gap:.5rem;margin:.25rem 0 .6rem;">' +
        '<input id="_vi-sub-name-input" type="text" placeholder="Subcategory name" autocomplete="off" style="flex:1;padding:.55rem .75rem;border:2px solid var(--accent);border-radius:10px;font-size:1rem;background:var(--panel-bg);color:var(--fg);font-family:inherit;">' +
        '<button id="_vi-sub-name-ok" class="voice-btn-confirm" style="flex:none;padding:.55rem .9rem;">OK</button>' +
      '</div>' +
      '<div id="_vi-amt-row" style="display:none;align-items:center;gap:.5rem;margin:.25rem 0 .6rem;">' +
        '<input id="_vi-amt-input" type="number" inputmode="decimal" min="0" step="any" placeholder="0.00" style="flex:1;padding:.55rem .75rem;border:2px solid var(--accent);border-radius:10px;font-size:1rem;background:var(--panel-bg);color:var(--fg);font-family:inherit;">' +
        '<button id="_vi-amt-ok" class="voice-btn-confirm" style="flex:none;padding:.55rem .9rem;">OK</button>' +
      '</div>' +
      '<div id="_vi-create-cat" style="display:none">' +
        '<button class="voice-create-cat" id="_vi-create-btn">+ Create new category</button>' +
      '</div>' +
      '<div class="voice-sheet-actions">' +
        '<button id="_vi-cancel" class="voice-btn-cancel">Cancel</button>' +
        '<button id="_vi-confirm" class="voice-btn-confirm" disabled>✓ Confirm</button>' +
      '</div>';
    document.body.appendChild(sheet);

    // Category picker
    var picker = document.createElement('div');
    picker.id = '_vi-cat-picker'; picker.className = 'voice-cat-picker';
    picker.innerHTML =
      '<div class="voice-cat-picker-header">' +
        '<button id="_vi-cat-back" class="voice-btn-cancel" style="flex:none;padding:.5rem .75rem;" aria-label="Back">←</button>' +
        '<input type="search" id="_vi-cat-search" placeholder="Search…" autocomplete="off">' +
      '</div>' +
      '<ul id="_vi-cat-list" class="voice-cat-list"></ul>';
    document.body.appendChild(picker);

    _wireHandlers();
  }

  // ── Public ─────────────────────────────────────────────────────────────
  function init(trackerType) {
    _tracker = trackerType || 'expenses';
    if (!_getSpeechAPI()) return;
    _buildUI();
  }

  return { init: init, start: start, stop: stop };
})();
