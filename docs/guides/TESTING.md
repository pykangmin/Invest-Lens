# TESTING.md

## 기본 검증

코드 변경 후 아래 명령을 실행한다.

```bash
npm run typecheck
npm run db:smoke
npm run build
```

## DB 데이터 로딩 검증

`npm run db:smoke`는 `.env.local`의 `DATABASE_URL`을 사용해 read-only DB role로 접속한다. 다음 항목이 확인되면 통과로 본다.

- `companyCount`가 S&P 500 기업 목록 규모와 일치한다.
- `AAPL`, `MSFT`, `NVDA` 샘플 기업이 조회된다.
- AAPL 최신 기술 지표와 최신 거시 국면이 반환된다.
- 출력에 DB 비밀번호나 전체 연결 문자열이 포함되지 않는다.
