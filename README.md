# Word Cafe

영어 단어 시험 웹앱. 단어장과 틀린 단어 기록은 각자 브라우저(localStorage)에 저장됩니다.

## 단어장 형식

한 줄에 한 단어. 예문은 `|` 뒤에 적습니다(없어도 됩니다).

```
abandon, 버리다, 포기하다 | He had to abandon his plan.
deny, 부인하다
```

엑셀에서 단어·뜻·예문 세 칸을 복사해 붙여 넣어도 됩니다.

## 테스트

```
node test.js
```
