import React from 'react';
import { QrCode, ShieldCheck, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';

export default function WhatsappLogin({ whatsappStatus, qrCode }) {
  const statusLabels = {
    disconnected: {
      text: 'Disconnected',
      color: 'disconnected',
      desc: 'chatbot is offline. Real WhatsApp messages will not be received or sent.'
    },
    connecting: {
      text: 'Connecting...',
      color: 'qr-ready',
      desc: 'Launching backend Puppeteer and generating session keys...'
    },
    qr_ready: {
      text: 'QR Code Ready',
      color: 'qr-ready',
      desc: 'Scan the QR code below using your WhatsApp Linked Devices screen.'
    },
    ready: {
      text: 'Connected',
      color: 'connected',
      desc: 'Chatbot is online and listening for customer messages!'
    }
  };

  const current = statusLabels[whatsappStatus] || {
    text: whatsappStatus || 'Unknown',
    color: 'disconnected',
    desc: 'Session status is offline or pending.'
  };

  return (
    <div className="whatsapp-login animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
      <div>
        <h1>WhatsApp Console</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Monitor the backend whatsapp-web.js client and link your mobile device.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className={`pulse-dot ${current.color}`} />
            <div>
              <h3 style={{ fontSize: '1.2rem', color: 'white' }}>WhatsApp Status: {current.text}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{current.desc}</p>
            </div>
          </div>
          {whatsappStatus === 'connecting' && (
            <RefreshCw className="spinner" size={20} color="var(--primary)" style={{ animation: 'spin 2s linear infinite' }} />
          )}
        </div>

        {/* QR Code Scan Area */}
        {whatsappStatus === 'qr_ready' && qrCode ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '1.5rem 0' }}>
            <div style={{ background: 'white', padding: '1.25rem', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', display: 'inline-block' }}>
              <img src={qrCode} alt="WhatsApp QR Code" style={{ width: '250px', height: '250px', display: 'block' }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                <span style={{ background: 'rgba(255,255,255,0.05)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>1</span>
                <p>Open WhatsApp on your phone.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                <span style={{ background: 'rgba(255,255,255,0.05)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>2</span>
                <p>Tap **Menu** (Android) or **Settings** (iPhone) and select **Linked Devices**.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                <span style={{ background: 'rgba(255,255,255,0.05)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>3</span>
                <p>Tap **Link a Device** and point your phone camera at this computer screen to scan the QR code.</p>
              </div>
            </div>
          </div>
        ) : whatsappStatus === 'ready' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0', color: 'var(--primary)', textAlign: 'center' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '50%' }}>
              <ShieldCheck size={48} />
            </div>
            <h2 style={{ color: 'white', fontSize: '1.5rem' }}>Successfully Connected!</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', fontSize: '0.95rem' }}>
              Your server is securely authenticated with WhatsApp Web. Incoming messages are processed by Gemini AI in real-time.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '12px', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'start' }}>
              <Smartphone size={24} color="var(--secondary)" style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ color: 'white', fontSize: '1rem', marginBottom: '0.25rem' }}>Simulator Active</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  If you do not want to scan a QR code or do not have Chromium dependencies installed on this machine, you can run all tests and flows directly using the built-in **Service Simulator**. It runs the exact same parsing and SQLite allocation logic.
                </p>
              </div>
            </div>

            {whatsappStatus === 'disconnected' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'start' }}>
                <AlertCircle size={24} color="var(--danger)" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ color: 'white', fontSize: '1rem', marginBottom: '0.25rem' }}>Connection Notice</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    A browser environment is required to instantiate WhatsApp Web. If your environment lacks Chromium or encounters sandbox permission errors, you can bypass the connection and use the **Service Simulator** to run booking workflows.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
