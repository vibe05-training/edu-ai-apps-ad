# 로컬 실행

Node.js 20.12 이상에서 `.env.local`에 서버용 `AI_ENDPOINT`, `AI_API_KEY`, `AI_DEPLOYMENT`를 설정하고 `npm start`를 실행한다. 기존 셸 환경변수는 `.env.local`보다 우선한다. 화면은 `http://127.0.0.1:3000`에서 열 수 있다.

`AI_ENDPOINT`는 Azure OpenAI v1 기본 URL을 사용한다. 키는 서버에만 보관하며 `.env.local`은 저장소에 추가하지 않는다.

유효한 채점 파일을 연 후 CSV를 내려받으면 필터와 관계없이 전체 테스트의 이름·획득 점수·배점·결과가 UTF-8 BOM 형식으로 저장된다.

`POST /api/generate`는 `{"assignment":"과제 조건","test":{"name":"테스트 이름","reason":"실패 사유"}}` 형식의 JSON만 받는다. 성공 시 `feedback`, `hint`, `activity` 문자열을 반환하며 오류 시 HTTP 오류 상태와 `error`를 반환한다. 실제 AI 호출 전에 과제 조건과 실패 항목에 학생 식별 정보나 코드가 포함되지 않았는지 확인한다.

서버는 `api/시스템 프롬프트.txt`를 시스템 지시로 읽고 과제 조건과 실패 항목은 별도의 사용자 메시지로 보낸다.

`npm test`는 실제 AI 대신 가상 응답으로 서버 흐름을 검증한다. 화면에서 실패 항목과 과제 조건을 선택해 추천을 요청하면 서버를 통해 AI를 호출한다.
