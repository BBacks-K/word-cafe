// 실행: node test.js
const assert = require('assert');
const { parse, blankWord, buildQuiz, autoNext, timedOut, dayKey, recordAnswer, sanitizeLog, buckets, totals, trend, niceMax,
  sanitizeCfg, makeBackup, parseBackup, checkAnswer, hintPattern, isCorrectTyped } = require('./lib.js');

// ---- 주관식: 같은 뜻의 다른 단어도 정답으로 인정 ----
const syn2 = [{ w: 'big', ko: '큰' }, { w: 'large', ko: '큰' }, { w: 'small', ko: '작은' }];
assert.strictEqual(isCorrectTyped(syn2, 0, 'big'), true);
assert.strictEqual(isCorrectTyped(syn2, 0, 'LARGE'), true); // 같은 뜻
assert.strictEqual(isCorrectTyped(syn2, 0, 'small'), false); // 뜻이 다름
assert.strictEqual(isCorrectTyped(syn2, 2, 'big'), false);
assert.strictEqual(isCorrectTyped(syn2, 0, ''), false);

// ---- 백업 입력 방어 ----
let bw = parseBackup('{"app":"word-cafe","v":1,"words":"a, 가","wrong":["x","X","y"]}');
assert.deepStrictEqual(bw.data.wrong, ['x', 'y']); // 중복 제거
assert.strictEqual(parseBackup('{"app":"word-cafe","v":1,"words":"' + 'a'.repeat(2100000) + '"}').ok, false); // 너무 큰 입력은 파싱 전에 거부
bw = parseBackup('{"app":"word-cafe","v":1,"words":"a, 가","wrong":' + JSON.stringify(Array.from({ length: 9000 }, (_, i) => 'w' + i)) + '}');
assert.strictEqual(bw.data.wrong.length, 5000);

// ---- 설정 ----
assert.deepStrictEqual(sanitizeCfg(undefined), { count: 10, sec: 0, mode: 'choice', scope: 'all' });
assert.deepStrictEqual(sanitizeCfg({ count: 50, sec: 20, mode: 'type', scope: 'wrong' }), { count: 50, sec: 20, mode: 'type', scope: 'wrong' });
assert.deepStrictEqual(sanitizeCfg({ count: 7, sec: '5', mode: 'x', scope: 1 }), { count: 10, sec: 0, mode: 'choice', scope: 'all' });
assert.deepStrictEqual(sanitizeCfg('garbage'), { count: 10, sec: 0, mode: 'choice', scope: 'all' });

// ---- 주관식 채점 / 첫 글자 힌트 ----
assert.strictEqual(checkAnswer('Abandon', 'abandon'), true);
assert.strictEqual(checkAnswer('  abandon  ', 'abandon'), true);
assert.strictEqual(checkAnswer('look   up', 'look up'), true);
assert.strictEqual(checkAnswer('abandn', 'abandon'), false);
assert.strictEqual(checkAnswer('', 'abandon'), false);
assert.strictEqual(checkAnswer('   ', 'abandon'), false);
assert.strictEqual(checkAnswer('don’t', "don't"), true); // 휴대폰 키보드의 둥근 따옴표
assert.strictEqual(hintPattern('abandon'), 'a _ _ _ _ _ _');
assert.strictEqual(hintPattern('look up'), 'l _ _ _ / _ _');
assert.strictEqual(hintPattern("don't"), "d _ _ ' _");
assert.strictEqual(hintPattern(''), '');

// ---- 백업/복원 ----
const bk = { words: 'abandon, 버리다 | He left.\ndeny, 부인하다', wrong: ['deny'], log: { '2026-10-27': { n: 5, w: 2 } }, cfg: { count: 30, sec: 20, mode: 'type', scope: 'wrong' } };
const txt = makeBackup(bk, new Date(Date.UTC(2026, 9, 27)));
let pb = parseBackup(txt);
assert.strictEqual(pb.ok, true);
assert.deepStrictEqual(pb.data, bk); // 한 바퀴 돌아도 그대로
// 메신저가 앞뒤에 글을 붙여도 읽는다
assert.strictEqual(parseBackup('백업입니다 👇\n' + txt + '\n끝').ok, true);
assert.strictEqual(parseBackup('hello').ok, false);
assert.strictEqual(parseBackup('').ok, false);
assert.strictEqual(parseBackup('{"app":"other","v":1}').ok, false);
assert.strictEqual(parseBackup('{"app":"word-cafe","v":2,"words":"a"}').ok, false);
assert.strictEqual(parseBackup('{"app":"word-cafe","v":1,"words":123}').ok, false);
// 일부가 망가져도 나머지는 살리고 앱이 죽지 않는다
pb = parseBackup('{"app":"word-cafe","v":1,"words":"a, 가","wrong":[1,"Deny",null],"log":{"x":1},"cfg":{"count":99}}');
assert.strictEqual(pb.ok, true);
assert.deepStrictEqual(pb.data, { words: 'a, 가', wrong: ['deny'], log: {}, cfg: { count: 10, sec: 0, mode: 'choice', scope: 'all' } });

// ---- 틀린 단어만 풀기 ----
const ww = Array.from({ length: 20 }, (_, i) => ({ w: 'w' + i, ko: 'k' + i, ex: '' }));
let oq = buildQuiz(ww, ['w2', 'w5', 'w9', 'nope'], 10, Math.random, true);
assert.strictEqual(oq.length, 3); // 단어장에 있는 틀린 단어만
assert.ok(oq.every((x) => x.wasWrong));
oq.forEach((x) => { assert.strictEqual(x.opts.length, 4); assert.strictEqual(new Set(x.opts).size, 4); assert.strictEqual(x.opts[x.cpos], x.wi); });
assert.strictEqual(buildQuiz(ww, ['w2', 'w5', 'w9', 'w1', 'w3'], 3, Math.random, true).length, 3); // 문제 수 상한
assert.strictEqual(buildQuiz(ww, [], 10, Math.random, true).length, 0);

// ---- 학습 기록(오답률) ----
assert.strictEqual(dayKey(new Date(2026, 0, 5)), '2026-01-05');
let lg = {};
recordAnswer(lg, '2026-10-27', true);
recordAnswer(lg, '2026-10-27', false);
assert.deepStrictEqual(lg['2026-10-27'], { n: 2, w: 1 });
assert.deepStrictEqual(sanitizeLog({ '2026-10-27': { n: 5, w: 2 }, bad: { n: 1, w: 0 }, '2026-10-26': { n: 2, w: 3 }, '2026-10-25': { n: 'x', w: 1 } }), { '2026-10-27': { n: 5, w: 2 } });
assert.deepStrictEqual(sanitizeLog(null), {});
// 손상된 저장값: 문자열 숫자(사전순 비교 함정), 소수, null, 존재하지 않는 날짜
assert.deepStrictEqual(sanitizeLog({ '2026-10-27': { n: '2', w: '10' } }), {});
assert.deepStrictEqual(sanitizeLog({ '2026-10-27': { n: 2.5, w: 1 } }), {});
assert.deepStrictEqual(sanitizeLog({ '2026-10-27': { n: null, w: null }, '2026-10-26': { n: true, w: false } }), {});
assert.deepStrictEqual(sanitizeLog({ '2026-02-30': { n: 5, w: 1 }, '2026-99-99': { n: 5, w: 1 }, '2026-13-01': { n: 5, w: 1 } }), {});
assert.deepStrictEqual(sanitizeLog({ '2028-02-29': { n: 5, w: 1 } }), { '2028-02-29': { n: 5, w: 1 } }); // 윤년은 허용
assert.deepStrictEqual(sanitizeLog({ '2027-02-29': { n: 5, w: 1 } }), {}); // 평년은 거부
assert.deepStrictEqual(sanitizeLog([1, 2]), {});

// 경계: 윤년 2월, 연말·연초 주, 일요일/월요일
let bb = buckets({}, 'day', new Date(2028, 2, 1));
assert.strictEqual(bb[12].label, '2/29'); assert.strictEqual(bb[13].label, '3/1');
bb = buckets({ '2026-01-01': { n: 4, w: 2 }, '2025-12-29': { n: 6, w: 1 } }, 'week', new Date(2026, 0, 2)); // 금요일
assert.strictEqual(bb[7].label, '12/29'); assert.deepStrictEqual([bb[7].n, bb[7].w], [10, 3]);
assert.strictEqual(buckets({}, 'week', new Date(2026, 10, 1))[7].label, '10/26'); // 일요일 → 그 주 월요일
assert.strictEqual(buckets({}, 'week', new Date(2026, 9, 26))[7].label, '10/26'); // 월요일 → 오늘
assert.strictEqual(buckets({ '2026-10-26': { n: 5, w: 0 } }, 'day', new Date(2026, 9, 26))[13].rate, 0); // 전부 맞힘은 0%이지 기록 없음이 아니다
// 일광절약시간 전환 주변에서도 날짜가 하루씩 이어진다
bb = buckets({}, 'day', new Date(2026, 2, 10));
assert.strictEqual(new Set(bb.map((x) => x.label)).size, 14);
assert.strictEqual(bb[13].label, '3/10'); assert.strictEqual(bb[0].label, '2/25');

const NOW = new Date(2026, 9, 27); // 2026-10-27 화요일
const L = {
  '2026-10-27': { n: 10, w: 2 }, '2026-10-26': { n: 10, w: 5 },
  '2026-10-25': { n: 4, w: 1 }, '2026-10-02': { n: 6, w: 3 }, '2026-09-30': { n: 5, w: 5 }
};
let b = buckets(L, 'day', NOW);
assert.strictEqual(b.length, 14);
assert.strictEqual(b[13].label, '10/27'); assert.strictEqual(b[0].label, '10/14');
assert.strictEqual(b[13].rate, 20); assert.strictEqual(b[12].rate, 50);
assert.strictEqual(b[10].n, 0); assert.strictEqual(b[10].rate, null);

b = buckets(L, 'week', NOW);
assert.strictEqual(b.length, 8);
assert.strictEqual(b[7].label, '10/26');
assert.deepStrictEqual([b[7].n, b[7].w, b[7].rate], [20, 7, 35]); // 월·화만, 일요일(10/25)은 전 주
assert.deepStrictEqual([b[6].n, b[6].w], [4, 1]);

b = buckets(L, 'month', NOW);
assert.strictEqual(b.length, 6);
assert.strictEqual(b[5].label, '10월'); assert.strictEqual(b[0].label, '5월');
assert.deepStrictEqual([b[5].n, b[5].w], [30, 11]);
assert.deepStrictEqual([b[4].n, b[4].w], [5, 5]);
// 해가 바뀌는 달
b = buckets({ '2025-12-31': { n: 3, w: 1 } }, 'month', new Date(2026, 0, 15));
assert.strictEqual(b[5].label, '1월'); assert.strictEqual(b[4].long, '2025년 12월'); assert.strictEqual(b[4].n, 3);

b = buckets(L, 'day', NOW);
assert.strictEqual(totals(b).n, 24); assert.strictEqual(totals(b).w, 8);
assert.strictEqual(totals(buckets({}, 'day', NOW)).rate, null);
// 직전 기록 대비: 마지막 두 "기록 있는" 구간의 오답률 차이
const t = trend(b);
assert.strictEqual(Math.round(t.diff), -30); // 20% - 50%
assert.strictEqual(trend(buckets({ '2026-10-27': { n: 1, w: 0 } }, 'day', NOW)), null);
assert.strictEqual(niceMax([]), 20);
assert.strictEqual(niceMax([{ rate: 18 }, { rate: null }]), 20);
assert.strictEqual(niceMax([{ rate: 21 }]), 40);
assert.strictEqual(niceMax([{ rate: 100 }]), 100);

// 시간 초과: 마감이 지난 뒤 클릭은 정답이어도 초과 처리 (타이머 없음 = 0초는 해당 없음)
assert.strictEqual(timedOut(10, 1000, 999), false);
assert.strictEqual(timedOut(10, 1000, 1000), true);
assert.strictEqual(timedOut(10, 1000, 1500), true);
assert.strictEqual(timedOut(0, 0, 99999), false);

// 예문 가리기: 무관한 단어는 건드리지 않는다
assert.strictEqual(blankWord('The student likes to study.', 'study'), 'The student likes to _____.');
assert.strictEqual(blankWord('An apple a day.', 'a'), 'An apple _____ day.');
assert.strictEqual(blankWord('They hesitated, then hesitating stopped.', 'hesitate'), 'They _____, then _____ stopped.');
assert.strictEqual(blankWord('She denies it; he denied it.', 'deny'), 'She _____ it; he _____ it.');
assert.strictEqual(blankWord('Prices fluctuate.', 'fluctuate'), 'Prices _____.');

// 특이한 영어 단어도 단어장에서 빠지지 않는다
assert.deepStrictEqual(parse('constructor, 생성자\n__proto__, 프로토').map((x) => x.w), ['constructor', '__proto__']);

// 같은 뜻의 단어가 있어도 보기 문구가 겹치지 않는다
const syn = [
  { w: 'big', ko: '큰', ex: '' }, { w: 'large', ko: '큰', ex: '' },
  { w: 'small', ko: '작은', ex: '' }, { w: 'tiny', ko: '아주 작은', ex: '' },
  { w: 'fast', ko: '빠른', ex: '' }, { w: 'slow', ko: '느린', ex: '' }
];
for (let n = 0; n < 50; n++) {
  buildQuiz(syn, [], 6).forEach((x) => {
    const kos = x.opts.map((i) => syn[i].ko);
    assert.strictEqual(new Set(kos).size, 4, '뜻 중복 보기: ' + kos);
  });
}

// 자동 넘김: 정답일 때만. 오답·시간 초과(99)는 수동
assert.strictEqual(autoNext(2, 2), true);
assert.strictEqual(autoNext(1, 2), false);
assert.strictEqual(autoNext(99, 2), false);

// parse: 예문
let r = parse('abandon, 버리다, 포기하다 | He abandoned the plan.');
assert.deepStrictEqual(r, [{ w: 'abandon', ko: '버리다, 포기하다', ex: 'He abandoned the plan.' }]);
r = parse('deny\t부인하다\tHe denied it.');
assert.deepStrictEqual(r, [{ w: 'deny', ko: '부인하다', ex: 'He denied it.' }]);
r = parse('benefit - 이익');
assert.deepStrictEqual(r, [{ w: 'benefit', ko: '이익', ex: '' }]);
r = parse('a, 하나\nA, 중복\n\n빈줄, \nb=둘');
assert.deepStrictEqual(r.map((x) => x.w), ['a', 'b']);
assert.strictEqual(parse('abandon, 버리다 | ').length, 1);
assert.strictEqual(parse('abandon, 버리다 | ')[0].ex, '');

// blankWord
assert.strictEqual(blankWord('He abandoned the plan.', 'abandon'), 'He _____ the plan.');
assert.strictEqual(blankWord('He denied breaking it.', 'deny'), 'He _____ breaking it.');
assert.strictEqual(blankWord('Prices fluctuate every week.', 'fluctuate'), 'Prices _____ every week.');
assert.strictEqual(blankWord('No match here.', 'zebra'), 'No match here.');
assert.doesNotThrow(() => blankWord('Look up the word.', 'look (up)'));
assert.strictEqual(blankWord('', 'abandon'), '');

// buildQuiz
const words = Array.from({ length: 60 }, (_, i) => ({ w: 'w' + i, ko: 'k' + i, ex: '' }));
const wrong = ['w3', 'w7', 'w11'];
for (const total of [10, 30, 50, 80]) {
  const q = buildQuiz(words, wrong, total);
  assert.strictEqual(q.length, Math.min(total, 60));
  assert.strictEqual(new Set(q.map((x) => x.wi)).size, q.length, '문제 단어 중복');
  wrong.forEach((k) => assert.ok(q.some((x) => words[x.wi].w === k), k + ' 누락'));
  q.forEach((x) => {
    assert.strictEqual(x.opts.length, 4);
    assert.strictEqual(new Set(x.opts).size, 4);
    assert.strictEqual(x.opts[x.cpos], x.wi);
    assert.strictEqual(x.wasWrong, wrong.indexOf(words[x.wi].w) >= 0);
  });
}
// 틀린 단어가 문제 수보다 많아도 문제 수를 넘지 않는다
const many = words.slice(0, 20).map((x) => x.w);
assert.strictEqual(buildQuiz(words, many, 10).length, 10);
console.log('ALL OK');
