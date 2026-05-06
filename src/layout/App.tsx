import { useEffect, useState } from "react";
import { Landing } from "./Landing";
import { StockDashboard } from "./StockDashboard";

function readPath(): string {
  return window.location.pathname || "/";
}

export function App() {
  const [path, setPath] = useState(readPath);

  useEffect(() => {
    const onPop = () => setPath(readPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (to: string) => {
    if (to !== path) {
      window.history.pushState({}, "", to);
      setPath(to);
    }
  };

  const goTicker = (t: string) => navigate(`/dashboard/${encodeURIComponent(t)}`);

  // /dashboard/<TICKER> 가 정식. /stock/<TICKER> 는 1회용 alias 로 유지 (이전 링크 깨짐 방지).
  if (path.startsWith("/dashboard/") || path.startsWith("/stock/")) {
    const prefix = path.startsWith("/dashboard/") ? "/dashboard/" : "/stock/";
    const ticker = decodeURIComponent(path.slice(prefix.length));
    return (
      <StockDashboard
        ticker={ticker}
        onBack={() => navigate("/")}
        onSelectTicker={goTicker}
      />
    );
  }

  return <Landing onSelectTicker={goTicker} />;
}
