import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, AlertCircle, Sparkles, Trash2, FileCheck, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import SettingsModal from '../components/SettingsModal';

function UploadPage() {
  const navigate = useNavigate();
  const { setFileData } = useApp();

  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [history, setHistory] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { apiKey } = useApp();
  const apiUrl = import.meta.env.VITE_API_URL || '';

  // Clean up blob URL on unmount
  useEffect(() => {
    fetch(`${apiUrl}/api/history`)
      .then(res => res.json())
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load history:', err));

    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const handleDeleteHistory = async (e, fileId) => {
    e.stopPropagation();
    try {
      await fetch(`${apiUrl}/api/history/${fileId}`, { method: 'DELETE' });
      setHistory(prev => prev.filter(h => h.fileId !== fileId));
    } catch (err) {
      console.error('Failed to delete history item', err);
    }
  };

  const handleHistoryClick = (item) => {
    navigate('/analysis', {
      state: {
        fileId: item.fileId,
        analysis: item.analysis,
        filename: item.filename,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
      },
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/plain'];
      if (validTypes.includes(dropped.type) || dropped.type.startsWith('image/')) {
        processFile(dropped);
      } else {
        setUploadError('Unsupported file type. Please upload a PDF, Word, Excel, Text, or Image file.');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const processFile = (selectedFile) => {
    setFile(selectedFile);
    setUploadError('');
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(selectedFile);
    setFileUrl(url);
  };

  const handleReset = () => {
    setFile(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl('');
    setUploadError('');
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const headers = {};
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(`${apiUrl}/api/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || 'Server returned an empty or invalid response');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze document');
      }

      // Save file in context so AnalysisPage can show the PDF preview
      setFileData({ file, fileUrl });

      // Navigate to the analysis page, passing results in router state
      navigate('/analysis', {
        state: {
          fileId: data.fileId,
          analysis: data.analysis,
          filename: file.name,
          fileSize: file.size,
          mimeType: data.mimeType,
        },
      });

    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Error processing document.');
      setIsUploading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-section">
          <FileText className="logo-icon" size={28} />
          <span className="logo-text">
            AeroScan
            <span className="logo-tag">AI Analyzer</span>
          </span>
        </div>
        <div className="nav-actions">
          <button className="btn btn-secondary" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={18} />
            Settings
          </button>
        </div>
      </header>

      <main className="dashboard">

        {/* Step 1: Drop zone */}
        {!file && !isUploading && (
          <div className="upload-container">
            <div
              className={`upload-card ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-picker').click()}
            >
              <input
                type="file"
                id="file-picker"
                className="file-input"
                accept="application/pdf, image/*, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/plain"
                onChange={handleFileChange}
              />
              <div className="upload-icon-wrapper">
                <Upload size={36} />
              </div>
              <h2 className="upload-title">Ingest Document or Image</h2>
              <p className="upload-subtitle">Drag &amp; drop your file here, or click to browse</p>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Supports PDFs, Word, Excel, Text, and Images up to 10MB
              </div>
            </div>
            {uploadError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-error)', marginTop: '1rem', fontSize: '0.9rem' }}>
                <AlertCircle size={16} />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: File staged — show name and Analyze button */}
        {file && !isUploading && (
          <div className="upload-container">
            <div className="upload-card" style={{ cursor: 'default', borderStyle: 'solid' }}>
              <div className="upload-icon-wrapper" style={{ backgroundColor: 'var(--color-primary-glow)' }}>
                <FileCheck size={36} />
              </div>
              <h2 className="upload-title" style={{ wordBreak: 'break-all' }}>{file.name}</h2>
              <p className="upload-subtitle">Size: {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={handleReset}>
                  <Trash2 size={16} />
                  Remove
                </button>
                <button className="btn btn-primary" onClick={handleAnalyze}>
                  <Sparkles size={16} />
                  Analyze Document
                </button>
              </div>
            </div>
            {uploadError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-error)', marginTop: '1rem', fontSize: '0.9rem' }}>
                <AlertCircle size={16} />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Processing loader */}
        {isUploading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <h3 className="loading-text">Analyzing Document</h3>
            <p className="loading-subtext">Extracting structure, summarizing contents, and mapping key entities using Groq AI...</p>
          </div>
        )}

        {/* Step 4: History list */}
        {!file && !isUploading && history.length > 0 && (
          <div className="history-container" style={{ marginTop: '3rem', width: '100%', maxWidth: '800px', alignSelf: 'center' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Recent Documents</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {history.map(item => (
                <div 
                  key={item.fileId} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => handleHistoryClick(item)}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: 'var(--color-primary-glow)', borderRadius: '6px' }}>
                      <FileText size={20} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{item.filename}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(item.timestamp).toLocaleString()} • {item.analysis?.documentType || 'Unknown'}
                      </div>
                    </div>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.5rem' }} 
                    onClick={(e) => handleDeleteHistory(e, item.fileId)}
                    title="Delete permanently"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}

export default UploadPage;
