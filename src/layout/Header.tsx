export function Header() {
  return (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto flex items-center gap-6 px-8 py-4">
        <div className="flex items-center gap-2 shrink-0 w-[200px]">
          <span className="text-2xl text-blue-600">💎</span>
          <span className="text-xl font-bold italic text-slate-800 tracking-tight">
            Invest Lens
          </span>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="relative w-full max-w-3xl flex items-center">
            <input
              type="text"
              placeholder="오늘은 어떤 종목을 분석 해볼까요?"
              className="flex-1 rounded-l-md border border-gray-300 border-r-0 bg-gray-50 px-5 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
              readOnly
            />
            <button
              type="button"
              className="shrink-0 bg-slate-700 hover:bg-slate-800 rounded-r-md px-4 py-[10px] border border-slate-700 flex items-center justify-center"
              aria-label="검색"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-white"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        </div>
        <div className="shrink-0 w-[40px]" />
      </div>
    </header>
  );
}
