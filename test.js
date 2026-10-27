// 실행: node test.js
const assert = require('assert');
const { parse, blankWord, buildQuiz, autoNext } = require('./lib.js');

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
