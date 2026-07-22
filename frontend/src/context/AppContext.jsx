import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Stores the selected File object and its blob URL so AnalysisPage can show the PDF preview
  const [fileData, setFileData] = useState(null); // { file, fileUrl }
  
  // User's custom Groq API Key
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('groq_api_key') || '');

  // Sync API Key to localStorage
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('groq_api_key', apiKey);
    } else {
      localStorage.removeItem('groq_api_key');
    }
  }, [apiKey]);

  return (
    <AppContext.Provider value={{ fileData, setFileData, apiKey, setApiKey }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
