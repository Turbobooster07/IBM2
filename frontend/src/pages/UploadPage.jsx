import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, AlertCircle, Sparkles, Trash2, FileCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

function UploadPage() {
  const navigate = useNavigate();
  const { setFileData } = useApp();

  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

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
      if (dropped.type === 'application/pdf') processFile(dropped);
      else setUploadError('Only PDF files are supported.');
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
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

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
                accept="application/pdf"
                onChange={handleFileChange}
              />
              <div className="upload-icon-wrapper">
                <Upload size={36} />
              </div>
              <h2 className="upload-title">Ingest PDF Document</h2>
              <p className="upload-subtitle">Drag &amp; drop your file here, or click to browse</p>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Supports digital or text-readable PDF documents up to 10MB
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

      </main>
    </div>
  );
}

export default UploadPage;
