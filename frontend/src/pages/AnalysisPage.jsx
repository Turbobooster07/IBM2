import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText, Sparkles, HelpCircle, Send, RefreshCw,
  AlertCircle, ArrowLeft, Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import html2pdf from 'html2pdf.js';

function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { fileData, apiKey } = useApp();
  const apiUrl = import.meta.env.VITE_API_URL || '';

  // Data passed from UploadPage via navigate()
  const { fileId, analysis, filename, fileSize, mimeType } = location.state || {};

  // Normalize entities to always be an array of { key, value }
  const getNormalizedEntities = () => {
    if (!analysis?.entities) return [];
    if (Array.isArray(analysis.entities)) {
      return analysis.entities;
    }
    if (typeof analysis.entities === 'object') {
      return Object.entries(analysis.entities).map(([key, value]) => ({
        key: String(key),
        value: typeof value === 'object' ? JSON.stringify(value) : String(value)
      }));
    }
    return [];
  };
  const normalizedEntities = getNormalizedEntities();

  const [activeTab, setActiveTab] = useState('summary');
  const [messages, setMessages] = useState(() => [
    {
      sender: 'bot',
      text: `Hi! I've analyzed **${filename}**. It was classified as a **${analysis?.documentType}** with **${analysis?.confidence}%** confidence.\n\nFeel free to ask me anything about this document!`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  const chatEndRef = useRef(null);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Guard: if someone lands here directly with no data, show error screen
  if (!analysis) {
    return (
      <div className="app-container">
        <header className="header">
          <div className="logo-section">
            <FileText className="logo-icon" size={28} />
            <span className="logo-text">
              AeroScan
              <span className="logo-tag">AI Analyzer</span>
            </span>
          </div>
        </header>
        <main className="dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: 'var(--color-error)', marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>No Analysis Data Available</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px' }}>
            It seems the page was reloaded or you accessed the analysis page directly without uploading a PDF.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go to Upload Page
          </button>
        </main>
      </div>
    );
  }

  // ─── Markdown Renderer Helper ───────────────────────────────────────────────

  const formatMarkdown = (text) => {
    if (!text) return null;

    let textStr = Array.isArray(text)
      ? text.join('\n')
      : typeof text === 'object'
      ? JSON.stringify(text, null, 2)
      : String(text);

    // Normalize inline bullet lists like "* Item 1 * Item 2" or "* Heading: * Item" into separate new lines
    textStr = textStr.replace(/([:\w])\s+\*\s+/g, '$1\n- ');
    textStr = textStr.replace(/([:\w])\s+•\s+/g, '$1\n- ');
    textStr = textStr.replace(/([^\n])\s+[*•-]\s+([A-Z0-9_])/g, '$1\n- $2');

    const lines = textStr.split('\n');
    const elements = [];
    let currentList = [];
    let listType = null;

    const parseInline = (str) => {
      if (!str) return '';
      return str
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code class="md-code">$1</code>')
        .replace(/(^|[^\w*])\*([^*]+)\*([^\w*]|$)/g, '$1<em>$2</em>$3');
    };

    const flushList = () => {
      if (currentList.length > 0) {
        const ListTag = listType === 'ol' ? 'ol' : 'ul';
        const className = listType === 'ol' ? 'md-ol' : 'md-ul';
        elements.push(
          <ListTag key={`list-${elements.length}`} className={className}>
            {currentList.map((item, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
            ))}
          </ListTag>
        );
        currentList = [];
        listType = null;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList();
        return;
      }

      const isUnordered = /^[-*•]\s+/.test(trimmed);
      const isOrdered = /^\d+[\.\)]\s+/.test(trimmed);

      if (isUnordered || isOrdered) {
        const targetType = isOrdered ? 'ol' : 'ul';
        if (listType && listType !== targetType) {
          flushList();
        }
        listType = targetType;
        const content = trimmed.replace(/^([-*•]|\d+[\.\)])\s+/, '');
        currentList.push(content);
        return;
      }

      flushList();

      if (trimmed.startsWith('###')) {
        elements.push(
          <h4 key={`h4-${index}`} className="md-h4" dangerouslySetInnerHTML={{ __html: parseInline(trimmed.replace(/^###\s+/, '')) }} />
        );
      } else if (trimmed.startsWith('##')) {
        elements.push(
          <h3 key={`h3-${index}`} className="md-h3" dangerouslySetInnerHTML={{ __html: parseInline(trimmed.replace(/^##\s+/, '')) }} />
        );
      } else if (trimmed.startsWith('#')) {
        elements.push(
          <h2 key={`h2-${index}`} className="md-h2" dangerouslySetInnerHTML={{ __html: parseInline(trimmed.replace(/^#\s+/, '')) }} />
        );
      } else {
        elements.push(
          <p key={`p-${index}`} className="md-p" dangerouslySetInnerHTML={{ __html: parseInline(trimmed) }} />
        );
      }
    });

    flushList();

    return <div className="markdown-content">{elements}</div>;
  };

  // ─── Chat handler ────────────────────────────────────────────────────────────

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting || !fileId) return;

    const userMessage = chatInput.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setChatInput('');
    setIsChatting(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fileId, message: userMessage }),
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || 'Server returned an empty or invalid response');
      }

      if (!response.ok) throw new Error(data?.error || 'Failed to get chat response.');
      setMessages((prev) => [...prev, { sender: 'bot', text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `⚠️ **Error:** ${err.message || 'Failed to connect.'}` },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleDownloadPdf = () => {
    const element = document.getElementById('pdf-content');
    if (!element) return;
    
    const opt = {
      margin:       [10, 10, 10, 10], // top, left, bottom, right in mm
      filename:     `${filename ? filename.split('.')[0] : 'concept-note'}-analysis.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

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
        <div className="nav-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          {activeTab === 'summary' && (
            <button className="btn btn-primary" onClick={handleDownloadPdf}>
              <Download size={16} />
              Download PDF
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            <ArrowLeft size={16} />
            New Analysis
          </button>
        </div>
      </header>

      <main className="dashboard">
        <div className="workspace">

          {/* Left Pane: PDF Viewer */}
          <div className="viewer-pane">
            <div className="pane-header">
              <span className="pane-title">
                <FileText size={16} style={{ color: 'var(--color-accent)' }} />
                {filename}
              </span>
            </div>
            {(fileData?.fileUrl || fileId) ? (
              mimeType === 'application/pdf' ? (
                <iframe
                  src={fileData?.fileUrl ? `${fileData.fileUrl}#toolbar=1` : `${apiUrl}/api/file/${fileId}#toolbar=1`}
                  className="pdf-iframe"
                  title="PDF Viewer"
                />
              ) : mimeType?.startsWith('image/') ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f2937', padding: '1rem', overflow: 'hidden' }}>
                  <img src={fileData?.fileUrl || `${apiUrl}/api/file/${fileId}`} alt="Document Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px' }} />
                </div>
              ) : (
                <div className="pdf-fallback-container">
                  <FileText size={48} className="pdf-fallback-icon" />
                  <h3 style={{ marginBottom: '0.5rem' }}>Content Extracted</h3>
                  <p>Text has been successfully extracted from this file.</p>
                </div>
              )
            ) : (
              <div className="pdf-fallback-container">
                <AlertCircle size={40} className="pdf-fallback-icon" />
                <h3>No Preview Available</h3>
                <p>Re-open the file from your device to view it.</p>
              </div>
            )}
          </div>

          {/* Right Pane: AI Analysis */}
          <div className="analysis-pane">
            <div className="tabs-nav">
              <button
                className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                <Sparkles size={14} />
                Analysis
              </button>
              <button
                className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                <HelpCircle size={14} />
                Document Chat
              </button>
            </div>

            {/* ── Analysis Tab ── */}
            {activeTab === 'summary' && (
              <div className="tab-content" id="pdf-content">

                {/* Document header card */}
                <div className="doc-header-card">
                  <div className="doc-header-row">
                    <div className="doc-header-left">
                      <FileText size={20} className="doc-header-icon" />
                      <div>
                        <div className="doc-header-filename">{filename}</div>
                        <div className="doc-header-size">
                          {fileSize ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="doc-header-badges">
                      <span className="badge badge-info">{analysis.documentType}</span>
                      <span
                        className={`badge ${
                          analysis.confidence >= 75
                            ? 'badge-success'
                            : analysis.confidence >= 50
                            ? 'badge-warning'
                            : 'badge-error'
                        }`}
                      >
                        {analysis.confidence}% confidence
                      </span>
                    </div>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="analysis-section">
                  <div className="section-header">
                    <Sparkles size={15} className="section-icon" />
                    <span className="section-title">Executive Summary</span>
                  </div>
                  <div className="summary-markdown">{formatMarkdown(analysis.summary)}</div>
                </div>

                {/* Key Entities */}
                {normalizedEntities && normalizedEntities.length > 0 && (
                  <div className="analysis-section">
                    <div className="section-header">
                      <FileText size={15} className="section-icon" />
                      <span className="section-title">Key Information Extracted</span>
                      <span className="section-count">{normalizedEntities.length} fields</span>
                    </div>
                    <div className="entities-grid-2col">
                      {normalizedEntities.map((item, index) => (
                        <div className="entity-card" key={index}>
                          <span className="entity-key">{item.key}</span>
                          <span className="entity-val">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── Chat Tab ── */}
            {activeTab === 'chat' && (
              <div className="tab-content" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                <div className="chat-container">
                  <div className="chat-messages">
                    {messages.map((msg, index) => (
                      <div
                        className={`chat-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-bot'}`}
                        key={index}
                      >
                        {formatMarkdown(msg.text)}
                      </div>
                    ))}
                    {isChatting && (
                      <div className="chat-bubble bubble-bot" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <RefreshCw size={14} className="spinner" style={{ margin: 0, width: '14px', height: '14px' }} />
                        <span>Thinking...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form className="chat-input-form" onSubmit={handleSendMessage}>
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Ask a question about this document..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isChatting}
                    />
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={isChatting || !chatInput.trim()}
                    >
                      <Send size={15} />
                    </button>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

export default AnalysisPage;
