import React, { useState } from 'react';
import { X, Key, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

function SettingsModal({ isOpen, onClose }) {
  const { apiKey, setApiKey } = useApp();
  const [inputKey, setInputKey] = useState(apiKey);

  if (!isOpen) return null;

  const handleSave = () => {
    setApiKey(inputKey.trim());
    onClose();
  };

  const handleClear = () => {
    setInputKey('');
    setApiKey('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={20} className="section-icon" />
            API Settings
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <p className="modal-desc">
          By default, this application uses a shared server API key. 
          If you want to avoid rate limits or use your own account, you can provide your own Groq API Key here.
        </p>

        <div className="form-group">
          <label className="form-label" htmlFor="api-key-input">Groq API Key</label>
          <input 
            id="api-key-input"
            type="password" 
            placeholder="gsk_..."
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            className="chat-input"
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          <AlertCircle size={14} />
          <span>Your key is stored securely in your browser's Local Storage.</span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-text" onClick={handleClear}>
            Clear Key
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
