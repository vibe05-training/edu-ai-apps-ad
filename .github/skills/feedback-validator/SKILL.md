---
name: feedback-validator
description: 기존 검증 함수로 보충 학습 추천 응답을 검사하고 검사 결과를 보고한다.
---

# 보충 학습 추천 응답 검사

1. 작업 폴더의 `public/validation.js`에서 `validateRecommendation`을 사용한다.
2. 검사할 응답 파일이 있으면 UTF-8 JSON을 읽는다. 파일이 없으면 `tests/validate.test.js`의 가상 예시와 같은 `feedback`, `hint`, `activity` 응답을 사용한다. JSON 읽기 또는 파싱 실패는 대상과 오류를 보고한다.
3. 응답을 `validateRecommendation`에 전달한다. 검사 대상과 전체 통과 여부를 보고하고, 통과 시 피드백·힌트·재도전 활동의 검사 결과와 내용을 각각 보고한다. 검증 오류가 나면 오류와 실패 사유를 보고하며 유효하다고 표시하지 않는다.
4. 실제 AI를 호출하거나 검사 내용을 외부로 전송하지 않는다.
