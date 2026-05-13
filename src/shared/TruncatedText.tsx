// TruncatedText — 텍스트가 실제 잘렸을 때(scrollWidth > clientWidth)만
// native `title` attribute 를 부여해 데스크탑 hover tooltip 으로 원문 표시.
// 잘리지 않은 경우엔 tooltip 안 뜸 — 불필요한 표시 회피.
//
// 모바일: title attribute 는 데스크탑 hover 전용. 일부 브라우저는 long-press 로 표시.
// 모바일 정식 지원이 필요해지면 커스텀 tooltip 으로 확장.

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export interface TruncatedTextProps {
  children: ReactNode;
  /** tooltip 으로 표시할 원문. 생략 시 children 이 string 이면 자동 사용. */
  text?: string;
  style?: CSSProperties;
  className?: string;
}

export function TruncatedText({ children, text, style, className }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tooltipText = text ?? (typeof children === "string" ? children : undefined);

  return (
    <span
      ref={ref}
      title={truncated && tooltipText ? tooltipText : undefined}
      style={style}
      className={className}
    >
      {children}
    </span>
  );
}
