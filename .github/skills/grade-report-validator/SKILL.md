---
name: grade-report-validator
description: 기존 검증 함수로 채점 결과 JSON을 검사하고 점수와 실패 항목을 보고한다.
---

# 채점 결과 검사

1. 작업 폴더의 `public/validation.js`에서 `parseGrade`, `summarizeGrade`, `getFailedTests`를 사용한다.
2. 검사할 JSON 파일을 UTF-8로 읽고 `parseGrade`에 원문을 전달한다. 읽기나 검증이 실패하면 대상과 오류를 보고하고 집계를 진행하지 않는다.
3. 유효한 결과를 `summarizeGrade`와 `getFailedTests`에 전달한다. 검사 대상, 통과 여부, 총점/배점, 통과/전체 테스트 수와 각 실패 항목의 이름·사유를 보고한다. 실패 테스트가 있다는 것과 JSON 검증 실패는 구분한다.
4. 채점 결과와 학생 정보를 외부로 전송하지 않는다.
