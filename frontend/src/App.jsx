import React, { Component, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import UploadPage from './pages/UploadPage';
import AnalysisPage from './pages/AnalysisPage';
import InteractiveBackground from './components/InteractiveBackground';
import PageLoader from './components/PageLoader';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', backgroundColor: '#0B0F19', color: '#F3F4F6', minHeight: '100vh', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Application Render Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', padding: '1rem', backgroundColor: '#111827', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '600px', width: '100%', fontSize: '0.85rem', color: '#9CA3AF' }}>
            {this.state.error && this.state.error.toString()}
            {"\n\n"}
            {this.state.error && this.state.error.stack}
          </pre>
          <button 
            onClick={() => window.location.href = '/'}
            style={{ marginTop: '1.5rem', padding: '0.6rem 1.25rem', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Return to Upload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isAppLoaded, setIsAppLoaded] = useState(false);

  return (
    <AppProvider>
      {!isAppLoaded && <PageLoader onComplete={() => setIsAppLoaded(true)} />}
      <InteractiveBackground />
      <ErrorBoundary>
        {isAppLoaded && (
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<UploadPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
            </Routes>
          </BrowserRouter>
        )}
      </ErrorBoundary>
    </AppProvider>
  );
}

export default App;
