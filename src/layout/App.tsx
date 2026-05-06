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

  if (path.startsWith("/stock/")) {
    const ticker = decodeURIComponent(path.slice("/stock/".length));
    return <StockDashboard ticker={ticker} onBack={() => navigate("/")} />;
  }

  return <Landing onSelectTicker={(t) => navigate(`/stock/${encodeURIComponent(t)}`)} />;
}
