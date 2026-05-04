1. 주요 엔티티 스키마
- 펀더멘털 스코어: ticker, data_as_of, total_score, signal 및 세부 재무 지표
- 기술적 지표: ticker, price_date, rsi_14, macd, ma_20/50/200, vix, 수익률 등
- 거시 경제 국면: as_of_date, regime, confidence, 국면별 확률 값
- 원자재 시세: commodity_code, date, ohlcv 가격 데이터, 변동성 등급, 트렌드

2. 무결성 및 검증 규칙
- 결측치 처리: 계산 불가 지표는 NULL로 적재하여 표시에서 제외
- 점수 보정: 총점 등은 0 미만은 0으로, 최대값 초과 시 최대값으로 고정
- 확률 정합성: 거시 국면의 4가지 확률 합산은 오차 허용치 내에서 100이 되도록 정규화