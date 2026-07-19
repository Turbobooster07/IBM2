import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Stores the selected File object and its blob URL so AnalysisPage can show the PDF preview
  const [fileData, setFileData] = useState(null); // { file, fileUrl }

  return (
    <AppContext.Provider value={{ fileData, setFileData }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
