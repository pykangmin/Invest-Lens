1. 심각도 분류 및 우선순위
# 1-1. 심각도 정의 및 우선순위
severity_levels = {
    "WARNING": "빨강 (즉각적인 주의 또는 리스크)",
    "CAUTION": "노랑/골드 (모니터링 필요, 추세 변화)",
    "INFO": "파랑/녹색 (긍정적 신호 또는 참고 사항)"
}
# 1-2. 우선순위: WARNING > CAUTION > INFO
if has_warning:
    display_badge("WARNING")
elif has_caution:
    display_badge("CAUTION")
else:
    display_badge("INFO")

2. 기업 펀더멘털 인사이트 로직
# 2-1. 총점 기반 인사이트
if total_score >= 80:
    return INFO, f"{ticker}는 전반적으로 우수한 재무 건전성을 보입니다 ({score}점)."
elif 65 <= total_score < 80:
    return INFO, f"{ticker}의 재무 건전성이 양호하며 취약 지표 보완 시 가치가 상승합니다."
elif 50 <= total_score < 65:
    return CAUTION, f"{ticker}의 재무 지표가 혼재되어 있어 취약 부문의 개선이 필요합니다."
else:
    return WARNING, f"{ticker}의 재무 건전성이 기준 미달입니다. 실질적 개선 여부를 검토하세요."
# 2-2. 세부 카테고리별 위험 상황
if cash_flow_score == 0:
    return WARNING, "FCF가 마이너스로 영업 활동에서 현금을 소모 중입니다."
if profitability_score <= 5:
    return WARNING, "매출총이익 마진 및 ROE 등 수익성 지표가 매우 저조합니다."
if ev_ebitda > 25:
    return CAUTION, f"EV/EBITDA {indicator_value}로 밸류에이션 조정 위험이 존재합니다."
if revenue_growth_yoy < -5:
    return WARNING, "매출이 5% 이상 감소하여 사업 모멘텀이 약화되었습니다."

3. 기술적 지표 인사이트 로직
# 3-1. RSI (상대강도지수)
if rsi > 80:
    return WARNING, "RSI가 80을 초과한 극도의 과매수 구간으로 강한 조정 가능성이 있습니다."
elif rsi > 70:
    return CAUTION, "RSI 70 초과 과매수 구간으로 단기 차익 실현에 유의하세요."
elif rsi < 20:
    return WARNING, "RSI 20 미만 극도의 과매도 구간으로 패닉셀 여부를 점검하세요."
elif rsi < 30:
    return CAUTION, "RSI 30 미만 과매도 구간으로 저가 매수 기회일 수 있으나 추세를 확인하세요."
# 3-2. MACD 및 이동평균선(MA)
if macd_golden_cross and histogram > 0:
    return INFO, "MACD가 시그널선을 상향 돌파하여 단기 모멘텀이 개선되었습니다."
if macd_dead_cross and histogram < 0:
    return CAUTION, "MACD가 시그널선을 하향 돌파하여 단기 모멘텀이 약화되었습니다."
if ma_50_cross_above_ma_200:
    return INFO, "50일선이 200일선을 돌파한 골든크로스로 중기 강세 신호입니다."
if ma_50_cross_below_ma_200:
    return WARNING, "50일선이 200일선을 하향 돌파한 데드크로스로 중기 약세 신호입니다."
if close_price < ma_200 and ma_50 < ma_200:
    return CAUTION, "주가와 50일선이 모두 200일선 아래인 장기 하락 추세 구간입니다."
if close_price > ma_20 > ma_50 > ma_200:
    return INFO, "이동평균선이 정배열 상태로 상승 추세가 견고합니다."
# 3-3. VIX (변동성 지수)
if vix > 30:
    return WARNING, "시장 공포가 극심한 역사적 위기 수준으로 리스크 관리가 필수적입니다."
elif 20 <= vix <= 30:
    return CAUTION, "시장 불확실성이 높아 변동성 확대에 대비해야 합니다."
elif vix < 12:
    return CAUTION, "변동성이 매우 낮아 과도한 낙관 심리를 경계해야 하는 안주 구간입니다."

4. 원자재 인사이트 및 섹터 매핑
# 원자재 변동성 및 트렌드
if volatility_grade == "VERY_HIGH":
    return WARNING, f"{ticker} 변동성이 극심하여 {sector} 섹터의 비용 압박이 예상됩니다."
if prev_volatility <= "MEDIUM" and current_volatility == "HIGH":
    return CAUTION, f"{ticker} 변동성이 급격히 상승하여 원가 리스크 모니터링이 필요합니다."
if trend == "SURGE":
    return WARNING, f"{ticker} 가격 급등으로 연관 기업의 마진 압박을 경고합니다."
if trend == "VOLATILE":
    return CAUTION, "시장 변동성 확대로 가격 방향성 불확실성이 높습니다."
if ticker == "GC=F" and trend == "SAFE_HAVEN":
    return CAUTION, "금 가격 상승으로 위험자산 회피 심리가 강화된 것으로 추정됩니다."
# 원자재-섹터 매핑 관계
mapping = {
    "WTI 원유": ["항공", "운송", "정유", "화학"],
    "구리": ["전기차", "건설", "산업재"],
    "리튬": ["전기차", "배터리"],
    "금": ["금융 (위험회피)"],
    "곡물(밀/대두)": ["식음료", "필수소비재"]
}

5. 거시 경제 (Macro) 인사이트 로직
# 5-1. 경제 국면 (Regime) 시나리오
if hard_landing_probability > 50:
    return WARNING, f"경착륙 확률이 {probability}로 방어적 포지션 검토가 필요합니다."
elif 30 <= hard_landing_probability <= 50:
    return CAUTION, f"경착륙 확률이 {probability}로 상승 중이니 지표를 면밀히 관찰하세요."
if soft_landing_probability > 50:
    return INFO, f"연착륙 확률이 {probability}로 성장주와 위험자산에 우호적입니다."
if recovery_probability > 40:
    return INFO, f"경기 회복 국면 확률이 {probability}로 경기민감주에 유리한 구간입니다."
if no_landing_probability > 50:
    return CAUTION, f"무착륙 확률이 {probability}로 인플레이션에 따른 추가 긴축에 유의하세요."
# 5-2. 주요 거시 지표 이벤트
if interest_rate_change >= 0.25:
    return CAUTION, "기준금리 인상으로 성장주 밸류에이션에 하방 압력이 예상됩니다."
if interest_rate_change <= -0.25:
    return INFO, "기준금리 인하로 유동성이 확대되어 위험자산 선호에 긍정적입니다."
if yield_curve_inverted: # 10Y < 2Y
    return WARNING, "장단기 금리 역전은 역사적인 경기 침체 선행 지표입니다."
if high_yield_spread_surge >= 1.0:
    return WARNING, "하이일드 스프레드 급등으로 신용 경색 위험이 감지됩니다."
if cpi_yoy >= 5.0:
    return WARNING, "CPI 5% 이상의 고인플레이션으로 긴축 기조 강화가 예상됩니다."
if unemployment_delta_monthly >= 0.5:
    return CAUTION, "실업률 급증으로 인한 노동시장 약화와 침체 진입 신호를 경계하세요."