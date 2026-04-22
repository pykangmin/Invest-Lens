export function Header() {
  return (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto flex items-center gap-6 px-6 py-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">💎</span>
          <span className="text-xl font-bold text-gray-900">Invest Lens</span>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-xl">
            <input
              type="text"
              placeholder="오늘은 어떤 종목을 분석 해볼까요?"
              className="w-full rounded-full border border-gray-300 bg-gray-50 px-5 py-2 pr-10 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
              readOnly
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
        <div className="w-[140px]" />
      </div>
    </header>
  );
}
