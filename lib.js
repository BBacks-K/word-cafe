// 단어장 읽기와 문제 만들기. 화면과 관계없는 순수 함수만 둔다.
(function (root) {
  var LINE = /^(.+?)\s*(?:\t|\s-\s|\s*[,:=]\s*)\s*(.+)$/;

  // "단어, 뜻 | 예문" 또는 엑셀의 "단어⇥뜻⇥예문"
  function parse(text) {
    var seen = Object.create(null), out = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      var w, ko, ex = '', m, parts;
      if (line.indexOf('\t') >= 0) {
        parts = line.split('\t');
        w = (parts[0] || '').trim();
        ko = (parts[1] || '').trim();
        ex = (parts[2] || '').trim();
      } else {
        var bar = line.indexOf('|');
        if (bar >= 0) { ex = line.slice(bar + 1).trim(); line = line.slice(0, bar).trim(); }
        m = LINE.exec(line);
        if (!m) return;
        w = m[1].trim();
        ko = m[2].trim();
      }
      var key = w.toLowerCase();
      if (!w || !ko || seen[key]) return;
      seen[key] = true;
      out.push({ w: w, ko: ko, ex: ex });
    });
    return out;
  }

  // 예문 속 정답 단어를 _____ 로 가린다. 어미가 바뀐 형태(denied, abandoned)도 가린다.
  // 단어 자체와 흔한 변화형(-s -es -ed -d -ing -ly -er, e 탈락, y→ied/ies)만 가린다.
  // ponytail: 불규칙 변화(go→went)와 자음 겹침(stop→stopped)은 못 가린다. 필요하면 단어장에서 예문을 바꾸면 된다.
  function blankWord(ex, word) {
    var w = word.trim().toLowerCase();
    if (!w) return ex;
    var forms = [w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', w + 'ly', w + 'er'];
    if (/e$/.test(w)) forms.push(w.slice(0, -1) + 'ing');
    if (/y$/.test(w)) forms.push(w.slice(0, -1) + 'ies', w.slice(0, -1) + 'ied', w.slice(0, -1) + 'ier');
    var alt = forms.map(function (f) { return f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'); }).join('|');
    return ex.replace(new RegExp('\\b(?:' + alt + ')\\b', 'gi'), '_____');
  }

  // 마감이 지난 뒤의 클릭은 정답이어도 시간 초과다. sec가 0이면 타이머를 쓰지 않는다.
  function timedOut(sec, deadline, now) { return sec > 0 && now >= deadline; }

  function shuffle(a, rnd) {
    var r = a.slice();
    for (var i = r.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  }

  // 예문에서 단어를 실제로 가릴 수 있을 때만 빈칸 문제를 낸다.
  function canBlank(w) { return !!w.ex && blankWord(w.ex, w.w) !== w.ex; }

  // 고르는 순서: 틀렸던 단어 → 복습일이 된 단어(오래 밀린 순) → 처음 보는 단어 → 나머지. 고른 뒤에는 섞는다.
  // 문제 유형은 문제마다 랜덤: 보기 고르기는 영→한·한→영·빈칸, 직접 쓰기는 한→영·빈칸(한글 뜻은 정답이 여러 개라 채점할 수 없다).
  // opt: { scope: 'all'|'wrong'|'due', srs, today, mode: 'choice'|'type' }. 예전처럼 true를 넘기면 틀린 단어만.
  function buildQuiz(words, wrongKeys, total, rnd, opt) {
    rnd = rnd || Math.random;
    opt = opt === true ? { scope: 'wrong' } : opt || {};
    var srs = opt.srs || {}, today = opt.today || '';
    var wset = Object.create(null);
    wrongKeys.forEach(function (k) { wset[k] = 1; });
    var idx = words.map(function (_, i) { return i; });
    var st = function (i) { return own(srs, words[i].w.toLowerCase()); };
    var isWrong = function (i) { return wset[words[i].w.toLowerCase()]; };
    var isDue = function (i) { var e = st(i); return !!e && today !== '' && e.due <= today; };
    // 같은 날짜끼리는 섞인 순서를 유지한다(sort는 안정 정렬)
    var byDue = function (a) { return shuffle(a, rnd).sort(function (x, y) { x = st(x).due; y = st(y).due; return x < y ? -1 : x > y ? 1 : 0; }); };
    var prior = shuffle(idx.filter(isWrong), rnd);
    var due = byDue(idx.filter(function (i) { return isDue(i) && !isWrong(i); }));
    var fresh = shuffle(idx.filter(function (i) { return !isWrong(i) && !st(i); }), rnd);
    var rest = shuffle(idx.filter(function (i) { return !isWrong(i) && st(i) && !isDue(i); }), rnd);
    // 범위를 좁혀도 보기에 쓰는 오답 단어는 전체 단어장에서 뽑는다
    var from = opt.scope === 'wrong' ? prior : opt.scope === 'due' ? byDue(idx.filter(isDue)) : prior.concat(due, fresh, rest);
    var pick = shuffle(from.slice(0, Math.min(total, words.length)), rnd);
    return pick.map(function (wi) {
      // 보기 문구가 겹치지 않게 뜻이 다른 단어로 채운다(동의어가 많아 모자라면 겹쳐도 채운다)
      var pool = shuffle(idx.filter(function (i) { return i !== wi; }), rnd);
      var usedKo = Object.create(null);
      usedKo[words[wi].ko] = 1;
      var others = pool.filter(function (i) {
        if (usedKo[words[i].ko]) return false;
        usedKo[words[i].ko] = 1;
        return true;
      }).slice(0, 3);
      pool.forEach(function (i) { if (others.length < 3 && others.indexOf(i) < 0) others.push(i); });
      var cpos = Math.floor(rnd() * 4);
      var opts = others.slice();
      opts.splice(cpos, 0, wi);
      var types = opt.mode === 'type' ? ['ko2en'] : ['en2ko', 'ko2en'];
      if (canBlank(words[wi])) types.push('blank');
      return { wi: wi, opts: opts, cpos: cpos, dir: types[Math.floor(rnd() * types.length)], wasWrong: !!isWrong(wi) };
    });
  }

  // ---- 간격 반복: 단어별 { b: 단계 0~6, due: 다음 복습일 } ----
  // 저장값은 JSON이라 "constructor" 같은 단어가 Object.prototype을 읽지 않게 자기 속성만 본다.
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }
  function okKey(k) { return typeof k === 'string' && k !== '' && k.length <= 200 && k !== '__proto__'; }
  function keyDate(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  // 밀리초가 아니라 달력으로 더한다(서머타임이 있는 지역에서도 날짜가 밀리지 않게)
  function addDays(key, n) { var d = keyDate(key); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); }
  function weekStart(key) { return addDays(key, -((keyDate(key).getDay() + 6) % 7)); }
  function isDay(k) { return typeof k === 'string' && DAY_RE.test(k) && realDate(k); }

  var GAPS = [1, 1, 3, 7, 14, 30, 60]; // 새 단계에 따른 다음 복습까지의 날 수
  // 복습일 전에 맞힌 건 단계를 올리지 않는다(하루에 몰아 풀어서 단계가 오르는 걸 막는다)
  function srsNext(e, ok, today) {
    if (!ok || !e) return { b: ok ? 1 : 0, due: addDays(today, 1) };
    if (e.due > today) return { b: e.b, due: e.due };
    var b = Math.min(6, e.b + 1);
    return { b: b, due: addDays(today, GAPS[b]) };
  }
  function recordSrs(srs, key, ok, today) {
    if (okKey(key)) srs[key] = srsNext(own(srs, key), ok, today);
    return srs;
  }

  function sanitizeSrs(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(function (k) {
      var e = raw[k];
      if (okKey(k) && e && Number.isInteger(e.b) && e.b >= 0 && e.b <= 6 && isDay(e.due)) out[k] = { b: e.b, due: e.due };
    });
    return out;
  }

  // keys(지금 단어장의 단어) 중 오늘(within이 있으면 그 날 수 뒤)까지 복습일이 된 단어 수
  function dueCount(srs, keys, today, within) {
    var limit = within ? addDays(today, within) : today;
    return keys.filter(function (k) { var e = own(srs, k); return e && e.due <= limit; }).length;
  }

  // ---- 단어별 기록: 날짜 → 단어 → [맞힌 수, 틀린 수] ----
  function recordWord(wlog, day, key, ok) {
    if (!okKey(key)) return wlog;
    var d = own(wlog, day) || (wlog[day] = {});
    var e = own(d, key) || (d[key] = [0, 0]);
    e[ok ? 0 : 1]++;
    return wlog;
  }

  function sanitizeWlog(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(function (day) {
      var d = raw[day], o = {}, n = 0;
      if (!isDay(day) || !d || typeof d !== 'object' || Array.isArray(d)) return;
      Object.keys(d).forEach(function (k) {
        var e = d[k];
        if (okKey(k) && Array.isArray(e) && e.length === 2 && Number.isSafeInteger(e[0]) && Number.isSafeInteger(e[1]) && e[0] >= 0 && e[1] >= 0) { o[k] = [e[0], e[1]]; n++; }
      });
      if (n) out[day] = o;
    });
    return out;
  }

  // 이번 주를 포함해 26주만 남긴다. 주 단위로 잘라서 리포트에 반쪽짜리 주가 생기지 않게 한다.
  function pruneWlog(wlog, today) {
    var cut = addDays(weekStart(today), -25 * 7);
    Object.keys(wlog).forEach(function (k) { if (k < cut) delete wlog[k]; });
    return wlog;
  }

  // ---- 주간 리포트(월요일 시작) ----
  function weekSum(log, start) {
    var n = 0, w = 0, days = 0;
    for (var i = 0; i < 7; i++) {
      var e = own(log, addDays(start, i));
      if (e && e.n) { n += e.n; w += e.w; days++; }
    }
    // w/n*100 은 0.3*100=30.000000000000004 처럼 어긋나서 곱셈을 먼저 한다
    return { n: n, w: w, days: days, rate: n ? w * 100 / n : null };
  }

  // words: 'none'(이 주엔 단어별 기록 없음) | 'full' | 'YYYY-MM-DD'(그 날부터 기록됨)
  function weekReport(log, wlog, start) {
    var end = addDays(start, 6), cur = weekSum(log, start), prev = weekSum(log, addDays(start, -7));
    var first = Object.keys(wlog).sort()[0];
    var agg = Object.create(null), has = false;
    for (var i = 0; i < 7; i++) {
      var d = own(wlog, addDays(start, i));
      if (d) has = true;
      if (d) Object.keys(d).forEach(function (k) {
        var a = agg[k] || (agg[k] = { w: k, wrong: 0, right: 0 });
        a.right += d[k][0]; a.wrong += d[k][1];
      });
    }
    var top = Object.keys(agg).map(function (k) { return agg[k]; })
      .filter(function (a) { return a.wrong > 0; })
      .sort(function (a, b) { return b.wrong - a.wrong || (a.w < b.w ? -1 : a.w > b.w ? 1 : 0); })
      .slice(0, 5);
    return {
      start: start, end: end, n: cur.n, w: cur.w, rate: cur.rate, days: cur.days,
      diff: cur.n && prev.n ? cur.rate - prev.rate : null,
      words: !has ? 'none' : first > start ? first : 'full',
      top: top
    };
  }

  function firstWeek(log, wlog) {
    var k = Object.keys(log).concat(Object.keys(wlog)).sort()[0];
    return k ? weekStart(k) : null;
  }

  // 새 주 첫 화면 카드: 지난주에 푼 문제가 있고 아직 안 봤으면 지난주 월요일, 아니면 null
  function reportCardWeek(log, seen, today) {
    var last = addDays(weekStart(today), -7);
    return seen !== last && weekSum(log, last).n > 0 ? last : null;
  }

  function md(key) { var p = key.split('-'); return +p[1] + '/' + +p[2]; }
  function diffText(diff) {
    var d = Math.round(diff);
    return d < 0 ? -d + '%p 줄었어요' : d > 0 ? d + '%p 늘었어요' : '그대로예요';
  }
  // upcoming: 앞으로 7일 동안 복습할 단어 수. 이번 주·지난주 리포트에만 넘긴다(null이면 안 씀).
  function reportText(r, upcoming) {
    var L = ['Word Cafe 주간 리포트 (' + md(r.start) + ' ~ ' + md(r.end) + ')'];
    if (!r.n) L.push('이 주에는 푼 문제가 없어요.');
    else {
      L.push('푼 문제: ' + r.n + '문제 · 오답률 ' + Math.round(r.rate) + '%');
      L.push('공부한 날: 7일 중 ' + r.days + '일');
      L.push('지난주 대비 오답률: ' + (r.diff == null ? '비교할 기록 없음' : diffText(r.diff)));
    }
    if (r.words === 'none') L.push('자주 틀린 단어: 이 주에는 단어별 기록이 없어요.');
    else {
      L.push('자주 틀린 단어: ' + (r.top.length ? r.top.map(function (t) { return t.w + (t.ko ? ' (' + t.ko + ')' : '') + ' ' + t.wrong + '번'; }).join(', ') : '없어요'));
      if (r.words !== 'full') L.push('(' + md(r.words) + '부터 기록된 내용이에요)');
    }
    if (upcoming != null) L.push('앞으로 7일 동안 복습할 단어 ' + upcoming + '개');
    return L.join('\n');
  }

  // 정답이면 자동으로 넘어가고, 오답과 시간 초과는 직접 넘긴다.
  function autoNext(picked, cpos) { return picked === cpos; }

  // ---- 학습 기록: 날짜별 {n: 푼 문제, w: 틀린 문제} ----
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function recordAnswer(log, key, isWrong) {
    var e = log[key] || (log[key] = { n: 0, w: 0 });
    e.n++;
    if (isWrong) e.w++;
    return log;
  }

  // 저장돼 있던 값이 망가져도 앱이 죽지 않게, 형식이 맞는 날짜만 남긴다.
  function sanitizeLog(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(function (k) {
      var e = raw[k];
      if (!DAY_RE.test(k) || !realDate(k) || !e) return;
      // 숫자 형식 그대로의 정수만 받는다. 문자열 "10" <= "2" 같은 사전순 비교로 100%를 넘기는 걸 막는다.
      if (Number.isSafeInteger(e.n) && Number.isSafeInteger(e.w) && e.w >= 0 && e.w <= e.n) out[k] = { n: e.n, w: e.w };
    });
    return out;
  }

  // 2026-02-30 처럼 달력에 없는 날짜를 거른다.
  function realDate(key) {
    var p = key.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.getFullYear() === +p[0] && d.getMonth() === +p[1] - 1 && d.getDate() === +p[2];
  }

  function sumDays(log, start, days) {
    var n = 0, w = 0;
    for (var i = 0; i < days; i++) {
      var e = log[dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))];
      if (e) { n += e.n; w += e.w; }
    }
    return { n: n, w: w, rate: n ? w / n * 100 : null };
  }

  // 일별 14일 / 주별 8주(월요일 시작) / 월별 6개월. 오래된 구간이 앞.
  function buckets(log, unit, now) {
    var y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), out = [], i;
    function md(dt) { return (dt.getMonth() + 1) + '/' + dt.getDate(); }
    if (unit === 'week') {
      var monday = d - ((now.getDay() + 6) % 7);
      for (i = 7; i >= 0; i--) {
        var s = new Date(y, m, monday - 7 * i), e = new Date(y, m, monday - 7 * i + 6), t = sumDays(log, s, 7);
        out.push({ label: md(s), long: md(s) + ' ~ ' + md(e), n: t.n, w: t.w, rate: t.rate });
      }
    } else if (unit === 'month') {
      for (i = 5; i >= 0; i--) {
        var f = new Date(y, m - i, 1), t2 = sumDays(log, f, new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate());
        out.push({ label: (f.getMonth() + 1) + '월', long: f.getFullYear() + '년 ' + (f.getMonth() + 1) + '월', n: t2.n, w: t2.w, rate: t2.rate });
      }
    } else {
      for (i = 13; i >= 0; i--) {
        var dt = new Date(y, m, d - i), t3 = sumDays(log, dt, 1);
        out.push({ label: md(dt), long: md(dt) + ' (' + DOW[dt.getDay()] + ')', n: t3.n, w: t3.w, rate: t3.rate });
      }
    }
    return out;
  }

  function totals(bs) {
    var n = 0, w = 0;
    bs.forEach(function (b) { n += b.n; w += b.w; });
    return { n: n, w: w, rate: n ? w / n * 100 : null };
  }

  // 기록이 있는 마지막 두 구간의 오답률 차이(음수면 좋아진 것)
  function trend(bs) {
    var has = bs.filter(function (b) { return b.n > 0; });
    if (has.length < 2) return null;
    var a = has[has.length - 2], b = has[has.length - 1];
    return { diff: b.rate - a.rate, from: a, to: b };
  }

  // 세로축 최댓값: 20% 단위로 올림(최소 20). 값이 작아도 선이 납작해지지 않게 한다.
  function niceMax(bs) {
    var mx = 0;
    bs.forEach(function (b) { if (b.rate != null && b.rate > mx) mx = b.rate; });
    return Math.min(100, Math.max(20, Math.ceil(mx / 20) * 20));
  }

  // ---- 설정 / 주관식 / 백업 ----
  function sanitizeCfg(c) {
    c = c && typeof c === 'object' ? c : {};
    return {
      count: [10, 30, 50].indexOf(c.count) >= 0 ? c.count : 10,
      sec: [0, 10, 20, 30, 60].indexOf(c.sec) >= 0 ? c.sec : 0,
      mode: c.mode === 'type' ? 'type' : 'choice',
      scope: c.scope === 'wrong' || c.scope === 'due' ? c.scope : 'all'
    };
  }

  function normAnswer(t) { return String(t).replace(/[‘’]/g, "'").trim().toLowerCase().replace(/\s+/g, ' '); }
  // 대소문자·앞뒤 공백·여러 칸 공백은 봐준다. 철자는 정확해야 한다.
  function checkAnswer(input, word) {
    var a = normAnswer(input);
    return a !== '' && a === normAnswer(word);
  }

  // 뜻이 같은 다른 단어(big/large)를 쓴 것도 정답으로 본다. 문제 단어 words[wi]와 한글 뜻이 같은 단어가 대상이다.
  // 빈칸 문제는 문장에 맞는 단어가 하나라서 단어장에 적힌 원형만 정답이다.
  function isCorrectTyped(words, wi, input, dir) {
    var target = words[wi];
    if (dir === 'blank') return checkAnswer(input, target.w);
    return words.some(function (w) { return w === target || w.ko === target.ko ? checkAnswer(input, w.w) : false; });
  }

  // 첫 글자만 보여 주는 힌트: abandon → a _ _ _ _ _ _
  function hintPattern(word) {
    return Array.from(String(word)).map(function (ch, i) {
      if (i === 0) return ch;
      if (/[\p{L}\p{N}]/u.test(ch)) return '_';
      return ch === ' ' ? '/' : ch;
    }).join(' ');
  }

  function makeBackup(d, now) {
    return JSON.stringify({ app: 'word-cafe', v: 1, savedAt: now.toISOString(), words: d.words, wrong: d.wrong, log: d.log, cfg: d.cfg,
      srs: d.srs || {}, wlog: d.wlog || {}, seenReport: d.seenReport || '' }, null, 1);
  }

  // 붙여 넣은 글에서 { ... } 부분만 읽는다. 앞뒤에 메신저 문구가 붙어도 된다.
  function parseBackup(text) {
    var t = String(text), a = t.indexOf('{'), b = t.lastIndexOf('}'), o;
    if (t.length > 2000000) return { ok: false, error: '내용이 너무 커요. Word Cafe 백업이 맞는지 확인해 주세요.' };
    if (a < 0 || b <= a) return { ok: false, error: '백업 내용이 아니에요. 복사한 글이 잘리지 않았는지 확인해 주세요.' };
    try { o = JSON.parse(t.slice(a, b + 1)); } catch (e) { return { ok: false, error: '백업 내용을 읽을 수 없어요. 복사한 글이 잘리지 않았는지 확인해 주세요.' }; }
    if (!o || o.app !== 'word-cafe') return { ok: false, error: 'Word Cafe에서 만든 백업이 아니에요.' };
    if (o.v !== 1) return { ok: false, error: '지원하지 않는 백업 버전이에요.' };
    if (typeof o.words !== 'string' || o.words.length > 500000) return { ok: false, error: '백업 안의 단어장을 읽을 수 없어요.' };
    var seen = Object.create(null), wrong = [];
    (Array.isArray(o.wrong) ? o.wrong : []).forEach(function (k) {
      if (typeof k !== 'string' || wrong.length >= 5000) return;
      k = k.toLowerCase();
      if (!k || k.length > 200 || seen[k]) return;
      seen[k] = 1; wrong.push(k);
    });
    // 새 항목이 없는 옛 백업이면 빈 값으로 둔다(지금 기기의 값을 섞지 않는다)
    return { ok: true, data: { words: o.words, wrong: wrong, log: sanitizeLog(o.log), cfg: sanitizeCfg(o.cfg),
      srs: sanitizeSrs(o.srs), wlog: sanitizeWlog(o.wlog), seenReport: isDay(o.seenReport) ? o.seenReport : '' } };
  }

  var api = { addDays: addDays, weekStart: weekStart, srsNext: srsNext, recordSrs: recordSrs, sanitizeSrs: sanitizeSrs, dueCount: dueCount, canBlank: canBlank,
    recordWord: recordWord, sanitizeWlog: sanitizeWlog, pruneWlog: pruneWlog, weekReport: weekReport, firstWeek: firstWeek,
    reportCardWeek: reportCardWeek, reportText: reportText, sanitizeCfg: sanitizeCfg, checkAnswer: checkAnswer, hintPattern: hintPattern, isCorrectTyped: isCorrectTyped, makeBackup: makeBackup, parseBackup: parseBackup, dayKey: dayKey, recordAnswer: recordAnswer, sanitizeLog: sanitizeLog, buckets: buckets, totals: totals, trend: trend, niceMax: niceMax, parse: parse, blankWord: blankWord, buildQuiz: buildQuiz, shuffle: shuffle, autoNext: autoNext, timedOut: timedOut };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WC = api;
})(typeof window !== 'undefined' ? window : globalThis);
