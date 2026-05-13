import { useEffect, useState } from "react";
import { CommodityDetail } from "./CommodityDetail";
import { FundamentalDetail } from "./FundamentalDetail";
import { Landing } from "./Landing";
import { MacroDetail } from "./MacroDetail";
import { StockDashboard } from "./StockDashboard";
import { TechnicalDetail } from "./TechnicalDetail";
import type { DetailSection } from "./DetailShell";

function readPath(): string {
  return window.location.pathname || "/";
}

const DETAIL_SECTIONS: DetailSection[] = [
  "fundamental",
  "macro",
  "commodity",
  "technical",
];

interface DetailRoute {
  ticker: string;
  section: DetailSection;
}

// /dashboard/<TICKER>/<section> 패턴 파싱. 일치하지 않으면 null.
function parseDetailRoute(path: string): DetailRoute | null {
  const m = path.match(/^\/dashboard\/([^/]+)\/([^/]+)\/?$/);
  if (!m) return null;
  const section = m[2] as DetailSection;
  if (!DETAIL_SECTIONS.includes(section)) return null;
  return { ticker: decodeURIComponent(m[1]), section };
}

// /dashboard/<TICKER> (개요) 패턴 파싱.
function parseOverviewRoute(path: string): string | null {
  const m = path.match(/^\/(?:dashboard|stock)\/([^/]+)\/?$/);
  if (!m) return null;
  return decodeURIComponent(m[1]);
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
  const goSection = (t: string, s: DetailSection) =>
    navigate(`/dashboard/${encodeURIComponent(t)}/${s}`);

  // 1) detail 라우트 — /dashboard/<TICKER>/<section>
  const detailRoute = parseDetailRoute(path);
  if (detailRoute) {
    const { ticker, section } = detailRoute;
    const common = {
      ticker,
      onBackToHome: () => navigate("/"),
      onBackToOverview: () => goTicker(ticker),
      onNavigateSection: (s: DetailSection) => goSection(ticker, s),
      onSelectTicker: goTicker,
    };
    if (section === "commodity") return <CommodityDetail {...common} />;
    if (section === "fundamental") return <FundamentalDetail {...common} />;
    if (section === "macro") return <MacroDetail {...common} />;
    if (section === "technical") return <TechnicalDetail {...common} />;
    goTicker(ticker);
    return null;
  }

  // 2) overview 라우트 — /dashboard/<TICKER> 또는 /stock/<TICKER>
  const overviewTicker = parseOverviewRoute(path);
  if (overviewTicker) {
    return (
      <StockDashboard
        ticker={overviewTicker}
        onBack={() => navigate("/")}
        onSelectTicker={goTicker}
        onNavigateSection={(s) => goSection(overviewTicker, s)}
      />
    );
  }

  // 3) 진입 화면
  return <Landing onSelectTicker={goTicker} />;
}
