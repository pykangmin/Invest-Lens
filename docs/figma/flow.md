# flow.md — 대시보드 플로우 추출본

출처: `images/대시보드 플로우 참고용.png`

이 시안은 **분석 파이프라인의 작도** 다. 화면 레이아웃이 아니라 "DB 데이터가 어떤 분기를 거쳐 어떤 metric 으로 계산되는가" 의 시각적 enumeration. 해상도가 가장 낮아 판독률 제한적.

---

## 시안 성격 ✅

- 그리드(모눈종이) 배경의 작도 시안
- 표준 플로우차트 도형: **원** (시작/종료), **다이아몬드** (결정), **사각형** (처리)
- 위에서 아래로 흐름
- 우측 상단: 작은 범례 박스 (`Item 1`, `Item 2`)

---

## 대략적 흐름 ⚠️

해상도 한계로 정확한 라벨은 추론. 큰 구조만:

```
시작 (원)
  ↓
[입력 검증] (다이아)
  ↓
[asset_class 분기] (다이아 다중)
  ↓
┌──────────┬──────────┬──────────┬──────────┐
펀더멘탈    밸류/통화   기술적     거시·심리
  ↓          ↓          ↓          ↓
[지표 계산]  [지표 계산]  [지표 계산]  [지표 계산]
  ↓          ↓          ↓          ↓
   └─────────┴─ 종합 점수 ─┴─────────┘
                ↓
            [render spec]
                ↓
              종료 (원)
```

→ 이 흐름은 **이미 `12-analyze.md` 가 정의** 한 것의 시각화 버전. 즉 시안 그 자체가 새 정보를 추가하지 않고, 12-analyze 의 정합성을 검증하는 시각 reference.

---

## 카테고리별 항목 enumeration ⚠️

각 분기 아래에 사각형 박스로 enumerate 된 항목들. 시안에서 판독되는 라벨 (확신도 다양):

### 펀더멘탈 분기 (좌1)

✅ 비교적 명확:
- PCF Yield → ⚠️ DB 컬럼 `fcf_yield` 와의 동일 의미 추정 (Free Cash Flow Yield)
- PCF Margin → ⚠️ DB `fcf_margin` 추정
- OCF / OCC → ⚠️ Operating Cash Flow 추정
- Gross Margin → DB `gross_margin_yoy`
- ROE → DB `roe`
- EV/EBITDA → DB `ev_ebitda`
- PER → DB `per`
- Forward PER → DB `forward_per_z_score`
- Revenue Growth → DB `revenue_growth`

→ DB `stock_fundamentals` 의 9개 컬럼과 거의 1:1 매핑. **02-data-analysis 의 펀더멘탈 영역과 일치하는지 cross-check 필요**.

### 밸류 / 통화 분기 (좌2)

⚠️ 라벨 판독 어려움:
- Self-Loading
- Hard-Loading
- No-Loading
- Liquidity (유동성)

→ "Loading" 이 무엇을 의미하는지 ⚠️. 추측:
- (a) DCF 분석에서의 적재량 (Loaded value)
- (b) 통화 강도(Loading)
- (c) Factor loading (요인 분석의 가중치)

`macro_regime_scores` 의 4개 prob (`soft_landing`, `hard_landing`, `no_landing`, `recovery`) 와의 매핑 가능성 있음:
- Self-Loading ≈ Soft Landing?
- Hard-Loading ≈ Hard Landing?
- No-Loading ≈ No Landing?
- Liquidity → 별도 (FEDFUNDS, DGS10 등)

→ **추정**: 거시 국면 분류와 유동성. macro_regime + global_environment 카테고리 `유동성`/`금리` 매핑.

### 기술적 분기 (우1)

⚠️ 일부 라벨만 보임:
- 모멘텀 / 추세 / 변동성 카테고리 분류로 보임
- DB `stock_price_tech` 의 컬럼: rsi_14, macd, ma_50, ma_200, ma_20, macd_signal, supertrend_signal, supertrend_value, supertrend_days

→ 22-frontend-aesthetics 와 무관. 02-data-analysis 의 기술 영역과 매핑 확인.

### 거시·심리 분기 (우2)

⚠️ 부분 판독:
- MFI (24%) → Money Flow Index? 또는 시안 오타
- VIX (24%) → 변동성 지수
- 미국 ? → ⚠️ 미상
- RSI (10) → ⚠️ 14가 아닌 10? 또는 가중치(weight 10)?
- Fear & Greed → DB 의 ^VIX 기반 산출
- BUY (10) → ⚠️ "BUY" 가 metric 이름인지 신호인지 미상
- ROC → Rate of Change
- Super Trend → DB `supertrend_signal/value/days` 직접 매핑
- MACD → DB `macd`

→ "(24%)" 같은 % 표기는 가중치(weight) 추정. 즉 **종합 점수 산출 시 metric 별 weight**.

---

## 가중치 표기 ⚠️

여러 항목 옆에 `(24%)`, `(10)` 등 숫자가 있음. 추정:
- `(24%)` → composite_score 산출 시 metric 의 가중치
- `(10)` → 가중치 또는 lookback period

→ 이게 사실이면 **02-data-analysis** 가 metric 별 가중치를 정의해야 함. 현재 02-data-analysis 본문에 가중치가 명시되어 있는지 확인 필요. 없으면 추가 합의 사항.

---

## 13-render 와의 관계 ⚠️

플로우의 마지막 단계가 "render spec" 으로 추정. 즉:
- DB → ingest (11) → analyze (12, 위 분기 + 가중치) → 종합 점수 → render spec (13) → 슬롯 채움

플로우는 **12-analyze 의 내부 구조** 를 그린 것이고, 11/13 을 직접 그리지는 않음. 11/13 의 구현은 시안과 무관하게 Skills 본문 그대로 따른다.

---

## 코드 영향 ⚠️

플로우는 reference 자료로만 사용. 코드에는 직접 영향이 없음. 단:

1. **02-data-analysis 의 가중치 검증**: 시안의 `(%)` 가 실제로 가중치라면 02-data-analysis 본문에 가중치 표가 있어야 함. 없으면 기획팀과 합의 후 추가.
2. **Loading 4종 정체 확인**: macro_regime_scores 의 4 prob 와 매핑되는지 기획팀 확정 필요.
3. **각 카테고리 → 슬롯 매핑**: 펀더 → G1, 거시 → G2, 통화 → G3, 기술 → G4, 심리 → G5 의 매핑이 시안과 일치.

---

## 미해결 (디자이너 / 기획팀 확정)

| # | 항목 | 메모 |
|---|---|---|
| 1 | "Loading" 4종 정확한 정의 | macro_regime_scores 의 4 prob 와 일치하는지 |
| 2 | "(%)" 가중치 표기의 의미 확정 | composite_score weight 인지 |
| 3 | "RSI (10)" 의 10 의미 | weight vs lookback period |
| 4 | "BUY (10)" metric 정체 | 고해상도 시안 또는 디자이너 설명 필요 |
| 5 | 모멘텀/추세/변동성 카테고리 명시 여부 | 02-data-analysis 본문 확인 |
| 6 | 작도 시안 자체를 구현 산출물에 노출할지 | 기능 화면 X, 도큐멘트 자료 |
