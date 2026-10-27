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

  // 틀렸던 단어를 먼저 담고 나머지를 채운 뒤 섞는다. 방향(영→한, 한→영)은 문제마다 랜덤.
  function buildQuiz(words, wrongKeys, total, rnd) {
    rnd = rnd || Math.random;
    var wset = Object.create(null);
    wrongKeys.forEach(function (k) { wset[k] = 1; });
    var idx = words.map(function (_, i) { return i; });
    var isWrong = function (i) { return wset[words[i].w.toLowerCase()]; };
    var prior = shuffle(idx.filter(isWrong), rnd);
    var rest = shuffle(idx.filter(function (i) { return !isWrong(i); }), rnd);
    var pick = shuffle(prior.concat(rest).slice(0, Math.min(total, words.length)), rnd);
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
      return { wi: wi, opts: opts, cpos: cpos, dir: rnd() < 0.5 ? 'en2ko' : 'ko2en', wasWrong: !!isWrong(wi) };
    });
  }

  // 정답이면 자동으로 넘어가고, 오답과 시간 초과는 직접 넘긴다.
  function autoNext(picked, cpos) { return picked === cpos; }

  var api = { parse: parse, blankWord: blankWord, buildQuiz: buildQuiz, shuffle: shuffle, autoNext: autoNext, timedOut: timedOut };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WC = api;
})(typeof window !== 'undefined' ? window : globalThis);
