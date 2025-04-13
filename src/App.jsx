import { useState } from 'react';
import './App.css';
import './index.css';
import { AnalyzingScreen } from './components/AnalyzingScreen';
import { Home } from './components/sections/Home';

function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = (score) => {
    setResult(score);
    setIsAnalyzing(true);
  };

  const handleAnalysisComplete = () => {
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 overflow-x-hidden">
      {isAnalyzing && <AnalyzingScreen onComplete={handleAnalysisComplete} />}

      <div className={`transition-opacity duration-700 ${isAnalyzing ? "opacity-0" : "opacity-100"}`}>
        <Home handleSubmit={handleSubmit} result={result} setResult={setResult} />
      </div>
    </div>
  );
}

export default App;