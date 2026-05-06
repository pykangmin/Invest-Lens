# Invest Lens — DACON 월간 해커톤 제출물

> 본 문서는 DACON "투자 데이터를 시각화하라" 월간 해커톤의 본 마감(2026-05-14) 제출물 구성과 평가 항목 매핑.

---

## 제출 산출물

| 항목 | 위치 | 비고 |
|---|---|---|
| 메인 대시보드 (web) | `https://investlens-dataker.vercel.app/dashboard/<TICKER>` (예정) | Vercel Production 자동 배포 |
| 진입 화면 | `https://investlens-dataker.vercel.app/` | 종목 검색 → 대시보드 라우팅 |
| GitHub 저장소 | `<재배치 예정>` | main 브랜치 = production 단일 진실 |
| Skills.md (8개) | `skills/00-assumptions.md` ~ `skills/21-frontend-aesthetics.md` | 5/7 마감 별도 제출 |
| Skills 설계 문서 | `AGENTS.md` + `docs/figma/dashboard-slots-v3.md` | 시안 → 슬롯 spec → 코드 흐름 |
| 검증 인프라 | `init.sh`, `verify-structure.sh`, `verify-skills.sh` | 매번 정합성 자동 검증 |

---

## 평가 항목 매핑

| 항목 | 배점 | 우리 답 |
|---|---|---|
| **범용성** | 25 | `skills/01-data-profile.md` 의 4 엔티티 추상화 + `11-ingest.md` 의 확장 규칙. 새 엔티티 추가 시 `01` / `11` 만 갱신하면 12/13 변경 0. asset_class enum 으로 분기 통일 |
| **Skills.md 설계** | 25 | 8개 파일 구조: 데이터(00~03) / 처리(11~13) / 렌더(21). 한 폴더, 번호 prefix 로 흐름 즉시 인지. dev 파일은 reference만, 도메인 정의 중복 0. `verify-skills.sh` 가 reference 무결성 자동 검증 |
| **대시보드 자동 생성** | 25 | `docs/figma/dashboard-slots-v3.md` 의 슬롯 spec 이 **Figma REST API 의 노드 트리 직접 추출** (PNG 추측 0). `scripts/figma-fetch.mjs` + `figma-extract-slots.mjs` 가 자동 추출 → 사람 매핑 1회 → 코드 자동 검증. 시안 변경 시 fetch 재실행만으로 갱신 |
| **바이브코딩 활용** | 15 | 규칙 → 분석 → 렌더 파이프라인이 코드에 살아있음:<br>- `skills/02-data-analysis.md` 의 계산식 → `src/analysis/{fundamental,technical,macro,commodityImpact}.ts`<br>- `skills/03-insight.md` severity 등급 → `severity.ts` + `severityColor.ts`<br>- `skills/13-render.md` 슬롯 매핑 → `src/visualization/*` 컴포넌트<br>- `skills/21-frontend-aesthetics.md` 의미 색 5색 → `src/shared/styles.css` CSS 변수 (Figma hex 직접 추출) |
| **실용성·창의성** | 10 | 매핑 자동화 + agent team 검수 주기적 진행 → 시안 변경에 실시간 대응. DB 의 6 테이블을 4 도메인 게이지로 종합한 시점 trio (오늘/이번 달/올해) — 단일 종목 페이지 안에서 시간 차원 분석 |

---

## 데이터 흐름 한 그림

```
Figma 시안                     ←─ 단일 진실의 원천 (디자이너)
  ↓ Figma REST API
docs/figma/figma-tree.json      ←─ 자동 fetch (scripts/figma-fetch.mjs)
  ↓ 슬롯 추출 (scripts/figma-extract-slots.mjs)
docs/figma/slots.generated.json (45 slots)
  ↓ 사람 매핑 1회
docs/figma/dashboard-slots-v3.md  ←─ 슬롯 spec 단일 진실 (코드가 이를 ref)

Supabase DB (6 tables, 503 종목)
  ↓ api/_lib/db.ts (pg pool)
api/{company,companies,commodities,global-environment,macro-regime,screen}.ts
  ↓ snake → camel mapping
src/data-loader/investmentData.ts
  ↓
src/analysis/* (12-analyze 처리 파이프라인)
  ↓ AnalysisResult { gauges, composite, events, insights }
src/visualization/* (13-render 차트 매핑)
  ↓
src/layout/StockDashboard.tsx (Figma slot 좌표 기반 grid)
  ↓
브라우저 (Vercel Production)
```

---

## 화면 구성 (개별 주식 대시보드)

6단 수직 stack:

1. **종목 헤더 + 시장 컨텍스트** — `Apple Inc / 102.36$ / +0.87%` + S&P 500 (예시)
2. **세부 지표 4종** — 기업 펀더멘털 (도넛) / 원자재 영향 (도넛) / 거시 경제 (regime + sparkline) / 기술적 지표 (progress)
3. **차트** — 180일 종가 추이
4. **주요 이벤트 + 환율** — RSI 임계 돌파·분기 보고일 (실데이터) / USD/KRW 4 카드 (예시)
5. **종합 점수** — 오늘 / 이번 달 / 올해 시점 trio (4 게이지 평균)
6. **주식 랭킹** — 어제 가장 많이 오른 / 거래된 / 떨어진 / 점수 좋았던 TOP 3 ×4

---

## 데이터 상태 — 엄밀 분류

| 슬롯 | 상태 | 출처 |
|---|---|---|
| 1단 종목·가격·변동 | REAL | stock_price_tech (latest non-null) |
| 1단 시장 컨텍스트 1슬롯 | EXAMPLE (예시 배지) | 시안 mock — DB 부재 |
| 2단 게이지 4종 | REAL | analysis 모듈 산출 (G2 sector 데이터 부족 시 예시) |
| 3단 차트 | REAL | stock_price_tech 180일 |
| 4단 주요 이벤트 | REAL | analysis/events.ts 합성 |
| 4단 환율 4 카드 | EXAMPLE (예시 배지) | 시안 mock — USD/KRW 시계열 DB 부재 |
| 5단 종합 점수 (값·추이·delta) | REAL | series.ts daily composite |
| 6단 TOP 3 ×4 | REAL | /api/screen 4 카테고리 |

---

## 환경 설정 (재현 가능성)

```bash
git clone <repo>
cd <repo>
npm ci
cp .env.example .env.local
# .env.local 의 DATABASE_URL 채우기
./init.sh                # 6단계 fail-fast 검증
npm run dev              # http://127.0.0.1:5173
```

Vercel 자동 배포:
- `main` push → Production (`https://investlens-dataker.vercel.app`)
- 다른 branch push → Preview URL

---

## 배포 URL (제출용)

| 환경 | URL |
|---|---|
| Production | `https://investlens-dataker.vercel.app` |
| 진입 화면 | `https://investlens-dataker.vercel.app/` |
| 예시 종목 (AAPL) | `https://investlens-dataker.vercel.app/dashboard/AAPL` |
| 예시 종목 (NVDA) | `https://investlens-dataker.vercel.app/dashboard/NVDA` |
| GitHub 저장소 | `<재배치 후 갱신>` |

---

## 미해결 항목 (본 마감 전 보강)

- DACON 제출 형식 재확인 (zip / PDF / 페이지 수)
- Skills.md 채점 단위 확인 (5 vs 8 파일)
- 시장 지수 4슬롯 — 외부 API 도입 여부 (S&P/Dow/Nasdaq 가격)
- Wanted Sans 폰트 1순위 적용 (현재 Pretendard)
- declarative SlotSpec 매핑 (`13-render` 본격 활용)
- 03-insight If-then 객체화 (`AnalysisResult.insights`)
