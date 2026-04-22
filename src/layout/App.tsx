import { useState } from 'react';
import { Header } from './Header';
import { MainView, type SubView } from './MainView';
import { FundamentalsView } from './FundamentalsView';
import { MacroView } from './MacroView';
import { TechnicalView } from './TechnicalView';

type View = 'main' | SubView;

export default function App() {
  const [view, setView] = useState<View>('main');

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      {view === 'main' && <MainView onNavigate={setView} />}
      {view === 'fundamentals' && (
        <FundamentalsView onBack={() => setView('main')} />
      )}
      {view === 'macro' && <MacroView onBack={() => setView('main')} />}
      {view === 'technical' && (
        <TechnicalView onBack={() => setView('main')} />
      )}
    </div>
  );
}
