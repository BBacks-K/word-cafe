// 실행: node test.js
const assert = require('assert');
const { parse, blankWord, buildQuiz, autoNext, timedOut, dayKey, recordAnswer, sanitizeLog, buckets, totals, trend, niceMax,
  sanitizeCfg, makeBackup, parseBackup, checkAnswer, hintPattern, isCorrectTyped,
  addDays, weekStart, srsNext, recordSrs, sanitizeSrs, dueCount, canBlank, recordWord, sanitizeWlog, pruneWlog,
  weekReport, firstWeek, reportCardWeek, reportText } = require('./lib.js');

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
assert.deepStrictEqual(pb.data, Object.assign({ srs: {}, wlog: {}, seenReport: '' }, bk)); // 한 바퀴 돌아도 그대로(새 항목은 빈 값)
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
assert.deepStrictEqual(pb.data, { words: 'a, 가', wrong: ['deny'], log: {}, cfg: { count: 10, sec: 0, mode: 'choice', scope: 'all' }, srs: {}, wlog: {}, seenReport: '' });

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

// ---- 날짜 더하기: 달력 기준 ----
assert.strictEqual(addDays('2026-01-31', 1), '2026-02-01');
assert.strictEqual(addDays('2026-12-31', 1), '2027-01-01');
assert.strictEqual(addDays('2028-02-28', 1), '2028-02-29'); // 윤년
assert.strictEqual(addDays('2027-02-28', 1), '2027-03-01');
assert.strictEqual(addDays('2026-03-01', -1), '2026-02-28');
assert.strictEqual(addDays('2026-10-29', 60), '2026-12-28');
assert.strictEqual(weekStart('2026-11-01'), '2026-10-26'); // 일요일 → 그 주 월요일
assert.strictEqual(weekStart('2026-11-02'), '2026-11-02'); // 월요일

// ---- 간격 반복 전이표 ----
const T0 = '2026-10-29';
assert.deepStrictEqual(srsNext(undefined, true, T0), { b: 1, due: '2026-10-30' }); // 처음 보는 단어 맞힘
assert.deepStrictEqual(srsNext(undefined, false, T0), { b: 0, due: '2026-10-30' });
assert.deepStrictEqual(srsNext({ b: 1, due: T0 }, true, T0), { b: 2, due: '2026-11-01' }); // 3일
assert.deepStrictEqual(srsNext({ b: 2, due: '2026-10-20' }, true, T0), { b: 3, due: '2026-11-05' }); // 밀린 복습도 1단계만
assert.deepStrictEqual(srsNext({ b: 3, due: T0 }, true, T0), { b: 4, due: '2026-11-12' });
assert.deepStrictEqual(srsNext({ b: 4, due: T0 }, true, T0), { b: 5, due: '2026-11-28' });
assert.deepStrictEqual(srsNext({ b: 5, due: T0 }, true, T0), { b: 6, due: '2026-12-28' });
assert.deepStrictEqual(srsNext({ b: 6, due: T0 }, true, T0), { b: 6, due: '2026-12-28' }); // 최대 6
assert.deepStrictEqual(srsNext({ b: 0, due: T0 }, true, T0), { b: 1, due: '2026-10-30' }); // 틀렸던 단어가 복습일에 맞힘
assert.deepStrictEqual(srsNext({ b: 3, due: '2026-11-05' }, true, T0), { b: 3, due: '2026-11-05' }); // 복습일 전 정답은 그대로
assert.deepStrictEqual(srsNext({ b: 3, due: '2026-11-05' }, false, T0), { b: 0, due: '2026-10-30' }); // 언제든 틀리면 처음부터
// 1 → 3 → 7일 흐름
let st = srsNext(undefined, true, '2026-10-29');
assert.strictEqual(st.due, '2026-10-30');
st = srsNext(st, true, st.due);
assert.strictEqual(st.due, '2026-11-02');
st = srsNext(st, true, st.due);
assert.strictEqual(st.due, '2026-11-09');

// 답 기록: 이상한 단어 이름이 객체 구조를 망가뜨리지 않는다
const rs = {};
recordSrs(rs, 'constructor', true, T0);
recordSrs(rs, '__proto__', true, T0);
assert.deepStrictEqual(rs, { constructor: { b: 1, due: '2026-10-30' } });
assert.strictEqual(Object.getPrototypeOf(rs), Object.prototype);
recordSrs(rs, 'constructor', false, T0);
assert.deepStrictEqual(rs.constructor, { b: 0, due: '2026-10-30' });

// 망가진 저장값 정리
assert.deepStrictEqual(sanitizeSrs({ a: { b: 2, due: '2026-10-30' }, b: { b: 9, due: '2026-10-30' }, c: { b: 1, due: '2026-02-30' }, d: null, e: { b: '1', due: '2026-10-30' } }), { a: { b: 2, due: '2026-10-30' } });
assert.deepStrictEqual(sanitizeSrs('x'), {});
assert.deepStrictEqual(sanitizeSrs([]), {});

// 복습할 단어 수: 지금 단어장에 있는 단어 중 due <= 오늘
const srs1 = { a: { b: 1, due: '2026-10-29' }, b: { b: 1, due: '2026-10-28' }, c: { b: 1, due: '2026-10-30' }, gone: { b: 1, due: '2026-10-01' } };
assert.strictEqual(dueCount(srs1, ['a', 'b', 'c', 'd'], '2026-10-29'), 2);
assert.strictEqual(dueCount(srs1, ['a', 'b', 'c', 'd'], '2026-10-29', 7), 3); // 앞으로 7일 안
assert.strictEqual(dueCount({}, ['a'], '2026-10-29'), 0);

// ---- 출제 우선순위: 틀림 → 복습일 됨(오래 밀린 순) → 처음 보는 단어 → 나머지 ----
const pw = Array.from({ length: 12 }, (_, i) => ({ w: 'p' + i, ko: 'k' + i, ex: '' }));
const psrs = {
  p0: { b: 0, due: '2026-10-30' },              // 틀린 단어 목록에 있음
  p1: { b: 2, due: '2026-10-20' },              // 오래 밀림
  p2: { b: 2, due: '2026-10-28' },              // 밀림
  p3: { b: 2, due: '2026-11-20' },              // 아직
  p4: { b: 2, due: '2026-11-20' }, p5: { b: 2, due: '2026-11-20' }, p6: { b: 2, due: '2026-11-20' },
  p7: { b: 2, due: '2026-11-20' }, p8: { b: 2, due: '2026-11-20' }
}; // p9 p10 p11 처음 보는 단어
const pq = buildQuiz(pw, ['p0'], 4, Math.random, { srs: psrs, today: T0 });
const pqNames = pq.map((x) => pw[x.wi].w);
['p0', 'p1', 'p2'].forEach((w) => assert.ok(pqNames.includes(w), w + ' 우선 출제 누락'));
assert.ok(['p9', 'p10', 'p11'].includes(pqNames.find((w) => !['p0', 'p1', 'p2'].includes(w))), '4번째는 처음 보는 단어');
// 밀린 복습이 문제 수보다 많으면 오래 밀린 것부터
const pq2 = buildQuiz(pw, [], 1, Math.random, { srs: psrs, today: T0 });
assert.strictEqual(pw[pq2[0].wi].w, 'p1');
// 범위 'due': 복습일이 된 단어만
const pq3 = buildQuiz(pw, ['p0'], 10, Math.random, { scope: 'due', srs: psrs, today: T0 });
assert.deepStrictEqual(pq3.map((x) => pw[x.wi].w).sort(), ['p1', 'p2']);
pq3.forEach((x) => assert.strictEqual(x.opts.length, 4)); // 보기는 전체 단어장에서
// 범위 'wrong'은 지금처럼
const pq4 = buildQuiz(pw, ['p0', 'p5'], 10, Math.random, { scope: 'wrong', srs: psrs, today: T0 });
assert.deepStrictEqual(pq4.map((x) => pw[x.wi].w).sort(), ['p0', 'p5']);
assert.strictEqual(sanitizeCfg({ scope: 'due' }).scope, 'due');

// ---- 예문 빈칸 문제 ----
assert.strictEqual(canBlank({ w: 'abandon', ex: 'He abandoned the plan.' }), true);
assert.strictEqual(canBlank({ w: 'abandon', ex: '' }), false);
assert.strictEqual(canBlank({ w: 'go', ex: 'He went home.' }), false); // 불규칙 변화형은 못 가린다
assert.strictEqual(canBlank({ w: 'zebra', ex: 'No match here.' }), false);
const bw2 = Array.from({ length: 30 }, (_, i) => ({ w: 'b' + i, ko: 'k' + i, ex: i < 15 ? 'I like b' + i + ' a lot.' : '' }));
let dirs = new Set();
for (let r = 0; r < 20; r++) {
  buildQuiz(bw2, [], 30).forEach((x) => {
    dirs.add(x.dir);
    if (x.dir === 'blank') assert.ok(bw2[x.wi].ex, '예문 없는 단어가 빈칸 문제로 나옴');
  });
}
assert.deepStrictEqual([...dirs].sort(), ['blank', 'en2ko', 'ko2en']);
// 직접 쓰기: 영→한은 나오지 않는다
dirs = new Set();
for (let r = 0; r < 20; r++) buildQuiz(bw2, [], 30, Math.random, { mode: 'type' }).forEach((x) => dirs.add(x.dir));
assert.deepStrictEqual([...dirs].sort(), ['blank', 'ko2en']);
// 빈칸 채점: 원형만 정답, 같은 뜻의 다른 단어는 오답
const syn3 = [{ w: 'big', ko: '큰', ex: 'It is a big house.' }, { w: 'large', ko: '큰', ex: '' }];
assert.strictEqual(isCorrectTyped(syn3, 0, 'large', 'blank'), false);
assert.strictEqual(isCorrectTyped(syn3, 0, 'BIG', 'blank'), true);
assert.strictEqual(isCorrectTyped(syn3, 0, 'large'), true); // 한→영은 지금처럼 동의어 인정

// ---- 단어별 기록 ----
const wl = {};
recordWord(wl, '2026-10-29', 'abandon', true);
recordWord(wl, '2026-10-29', 'abandon', false);
recordWord(wl, '2026-10-29', 'deny', false);
assert.deepStrictEqual(wl, { '2026-10-29': { abandon: [1, 1], deny: [0, 1] } });
assert.deepStrictEqual(sanitizeWlog({ '2026-10-29': { a: [1, 2], b: [1, -1], c: ['1', 0], d: [1] }, 'bad': { a: [1, 1] }, '2026-02-30': { a: [1, 1] } }), { '2026-10-29': { a: [1, 2] } });
assert.deepStrictEqual(sanitizeWlog(null), {});
// 26주보다 오래된 주는 통째로 지운다(주 경계에서 자른다)
const old = { '2026-05-03': { a: [1, 0] }, '2026-05-04': { a: [1, 0] }, '2026-10-29': { a: [1, 0] } };
assert.deepStrictEqual(Object.keys(pruneWlog(old, '2026-10-29')), ['2026-05-04', '2026-10-29']); // 이번 주 포함 26주 = 5/4 주부터

// ---- 주간 리포트 ----
const rlog = {
  '2026-10-12': { n: 10, w: 5 },                                  // 2주 전
  '2026-10-19': { n: 10, w: 4 }, '2026-10-21': { n: 10, w: 2 },   // 지난주: 20문제 6틀림 30%
  '2026-10-26': { n: 10, w: 1 }, '2026-10-27': { n: 10, w: 1 }, '2026-11-01': { n: 20, w: 2 } // 이번 주(일요일 포함)
};
let rp = weekReport(rlog, {}, '2026-10-19');
assert.strictEqual(rp.start, '2026-10-19');
assert.strictEqual(rp.end, '2026-10-25');
assert.strictEqual(rp.n, 20);
assert.strictEqual(rp.w, 6);
assert.strictEqual(rp.rate, 30);
assert.strictEqual(rp.days, 2);
assert.strictEqual(rp.diff, -20); // 전 주 50% → 30%
assert.strictEqual(rp.words, 'none'); // 단어별 기록 없음
assert.deepStrictEqual(rp.top, []);
rp = weekReport(rlog, {}, '2026-10-26');
assert.strictEqual(rp.n, 40);
assert.strictEqual(rp.days, 3); // 일요일 11/1 포함
assert.strictEqual(rp.rate, 10);
assert.strictEqual(rp.diff, -20);
rp = weekReport(rlog, {}, '2026-10-12');
assert.strictEqual(rp.diff, null); // 전 주에 푼 문제 없음
rp = weekReport({}, {}, '2026-10-12');
assert.strictEqual(rp.n, 0);
assert.strictEqual(rp.rate, null);
assert.strictEqual(rp.days, 0);
// 단어별 기록: 상위 5개, 틀린 수 많은 순 → 같으면 알파벳 순, 1번 이상 틀린 것만
const rw = {
  '2026-10-27': { zeta: [0, 2], alpha: [1, 2], beta: [3, 0], gamma: [0, 1], delta: [0, 1], eps: [0, 1], eta: [0, 1] },
  '2026-10-28': { zeta: [0, 1] }
};
rp = weekReport(rlog, rw, '2026-10-26');
assert.deepStrictEqual(rp.top.map((t) => t.w), ['zeta', 'alpha', 'delta', 'eps', 'eta']);
assert.deepStrictEqual(rp.top[0], { w: 'zeta', wrong: 3, right: 0 });
assert.strictEqual(rp.words, '2026-10-27'); // 주 중간(화요일)부터 기록됨
rp = weekReport(rlog, { '2026-10-26': { a: [0, 1] }, '2026-10-28': { b: [1, 0] } }, '2026-10-26');
assert.strictEqual(rp.words, 'full'); // 월요일부터 기록됨
rp = weekReport(rlog, { '2026-10-19': { a: [0, 1] }, '2026-10-28': { b: [1, 0] } }, '2026-10-26');
assert.strictEqual(rp.words, 'full'); // 지난주부터 기록이 있었으면 이번 주는 온전함
assert.deepStrictEqual(rp.top.map((t) => t.w), []); // 이번 주에 틀린 단어 없음
// 예전 주에만 단어별 기록이 있고 이 주엔 없으면(지워졌거나 저장 실패) "틀린 단어 없음"이 아니라 "기록 없음"
rp = weekReport(rlog, { '2026-10-12': { a: [0, 1] } }, '2026-10-26');
assert.strictEqual(rp.words, 'none');

// 리포트 볼 수 있는 가장 오래된 주
assert.strictEqual(firstWeek(rlog, {}), '2026-10-12');
assert.strictEqual(firstWeek({}, { '2026-10-07': { a: [1, 0] } }), '2026-10-05');
assert.strictEqual(firstWeek({}, {}), null);

// 새 주 알림 카드: 지난주에 푼 문제가 있고, 아직 안 본 경우에만 지난주 월요일을 돌려준다
assert.strictEqual(reportCardWeek(rlog, '', '2026-10-27'), '2026-10-19');
assert.strictEqual(reportCardWeek(rlog, '2026-10-19', '2026-10-27'), null); // 이미 봄
assert.strictEqual(reportCardWeek(rlog, '', '2026-11-03'), '2026-10-26');
assert.strictEqual(reportCardWeek(rlog, '', '2026-11-10'), null); // 지난주(11/2 주)에 안 풀었음
assert.strictEqual(reportCardWeek({}, '', '2026-10-27'), null);

// 복사용 글: 화면과 같은 집계
const rtxt = reportText({ start: '2026-10-26', end: '2026-11-01', n: 40, w: 4, rate: 10, days: 3, diff: -20, words: 'full', top: [{ w: 'zeta', ko: '제타', wrong: 3, right: 0 }] }, 5);
assert.ok(rtxt.includes('10/26 ~ 11/1'));
assert.ok(rtxt.includes('40문제'));
assert.ok(rtxt.includes('오답률 10%'));
assert.ok(rtxt.includes('20%p 줄었어요'));
assert.ok(rtxt.includes('7일 중 3일'));
assert.ok(rtxt.includes('zeta (제타) 3번'));
assert.ok(rtxt.includes('앞으로 7일 동안 복습할 단어 5개'));
const rtxt2 = reportText({ start: '2026-10-12', end: '2026-10-18', n: 10, w: 5, rate: 50, days: 1, diff: null, words: 'none', top: [] }, null);
assert.ok(rtxt2.includes('비교할 기록 없음'));
assert.ok(rtxt2.includes('단어별 기록이 없어요'));
assert.ok(!rtxt2.includes('복습할 단어'));
assert.ok(reportText({ start: '2026-10-26', end: '2026-11-01', n: 10, w: 1, rate: 10, days: 1, diff: 0, words: '2026-10-28', top: [] }, null).includes('10/28부터 기록된 내용'));

// ---- 백업: 새 데이터 왕복, 옛 백업은 새 데이터를 빈 값으로 ----
const full = { words: 'a, 가', wrong: ['a'], log: { '2026-10-29': { n: 1, w: 1 } }, cfg: sanitizeCfg({ scope: 'due' }), srs: { a: { b: 0, due: '2026-10-30' } }, wlog: { '2026-10-29': { a: [0, 1] } }, seenReport: '2026-10-19' };
const rt = parseBackup(makeBackup(full, new Date()));
assert.deepStrictEqual(rt.data, full);
assert.strictEqual(makeBackup(rt.data, new Date(0)), makeBackup(full, new Date(0)));
const oldBk = parseBackup('{"app":"word-cafe","v":1,"words":"a, 가","wrong":[],"log":{}}');
assert.deepStrictEqual(oldBk.data.srs, {});
assert.deepStrictEqual(oldBk.data.wlog, {});
assert.strictEqual(oldBk.data.seenReport, '');
assert.strictEqual(parseBackup('{"app":"word-cafe","v":1,"words":"a, 가","seenReport":"nope"}').data.seenReport, '');
console.log('ALL OK');
