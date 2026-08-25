import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AssessmentWorkspace } from './pages/AssessmentWorkspace/AssessmentWorkspace';
import { RooftopPage } from './pages/RooftopPage/RooftopPage';
import { useTheme } from './hooks/useTheme';
import { createContext } from 'react';
import type { Theme } from './hooks/useTheme';

export const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({
  theme: 'night',
  toggleTheme: () => {},
});

function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/assessment" element={<AssessmentWorkspace />} />
          <Route path="/assessment/rooftop" element={<RooftopPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}

export default App;
