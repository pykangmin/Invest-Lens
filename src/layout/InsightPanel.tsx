type Props = {
  items: string[];
};

export function InsightPanel({ items }: Props) {
  return (
    <div className="insight-card">
      <div className="card-header">
        <span className="card-header-title">AI 인사이트</span>
      </div>
      <ul className="insight-list">
        {items.map((text, i) => (
          <li key={i} className="insight-row">
            <span className="insight-dot" aria-hidden="true" />
            <span className="insight-text">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
