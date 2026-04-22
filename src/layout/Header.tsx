export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <svg
            className="logo-mark"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M4 10 L12 4 L20 10 L12 20 Z"
              fill="#1e3a8a"
              stroke="#1e3a8a"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path d="M12 4 L12 20" stroke="#ffffff" strokeWidth="1.2" />
            <path d="M4 10 L20 10" stroke="#ffffff" strokeWidth="1.2" />
          </svg>
          <span className="logo-text">Invest Lens</span>
        </div>
        <div className="search-wrapper">
          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="오늘은 어떤 종목을 분석 해볼까요?"
              readOnly
            />
            <button type="button" className="search-button" aria-label="검색">
              <svg
                className="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
