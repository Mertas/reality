/** Корень приложения. */
import { AppProvider } from './state/app';
import { TopBar } from './components/layout/TopBar';
import { MNav } from './components/layout/MNav';
import { RailNav } from './components/layout/RailNav';
import { Footer } from './components/layout/Footer';
import { ChapterIntro } from './components/chapters/ChapterIntro';
import { ChapterLayers } from './components/chapters/ChapterLayers';
import { ChapterCandidates } from './components/chapters/ChapterCandidates';
import { ChapterRoutes } from './components/chapters/ChapterRoutes';
import { ChapterSkeptics } from './components/chapters/ChapterSkeptics';
import { ChapterPractice } from './components/chapters/ChapterPractice';
import { ChapterSources } from './components/chapters/ChapterSources';

export function App() {
  return (
    <AppProvider>
      <TopBar />
      <MNav />
      <div className="shell">
        <RailNav />
        <main>
          <ChapterIntro />
          <ChapterLayers />
          <ChapterCandidates />
          <ChapterRoutes />
          <ChapterSkeptics />
          <ChapterPractice />
          <ChapterSources />
        </main>
      </div>
      <Footer />
    </AppProvider>
  );
}
