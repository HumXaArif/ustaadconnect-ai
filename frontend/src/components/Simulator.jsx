import React, { useState, useEffect } from 'react';
import { Send, User, Hammer, Smartphone, MessageSquare } from 'lucide-react';

export default function Simulator({ backendUrl, messages, triggerRefresh }) {
  const [customerPhone, setCustomerPhone] = useState('923001234567');
  const [customerMsg, setCustomerMsg] = useState('');
  
  const [workerPhone, setWorkerPhone] = useState('923005556661');
  const [workerMsg, setWorkerMsg] = useState('');

  // Filter messages for current customer and worker
  const customerMessages = messages.filter(m => m.phone === customerPhone);
  const workerMessages = messages.filter(m => m.phone === workerPhone);

  const sendCustomerMessage = async (e) => {
    e.preventDefault();
    if (!customerMsg.trim()) return;

    try {
      await fetch(`${backendUrl}/api/simulator/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPhone: customerPhone,
          content: customerMsg
        })
      });
      setCustomerMsg('');
      // Trigger data reload in parent component after short delay to let DB update
      setTimeout(triggerRefresh, 500);
    } catch (err) {
      console.error('Failed to send simulated customer message:', err);
    }
  };

  const sendWorkerMessage = async (e) => {
    e.preventDefault();
    if (!workerMsg.trim()) return;

    try {
      await fetch(`${backendUrl}/api/simulator/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPhone: workerPhone,
          content: workerMsg
        })
      });
      setWorkerMsg('');
      setTimeout(triggerRefresh, 500);
    } catch (err) {
      console.error('Failed to send simulated worker message:', err);
    }
  };

  const handleQuickCustomer = (text) => {
    setCustomerMsg(text);
  };

  const handleQuickWorker = (text) => {
    setWorkerMsg(text);
  };

  return (
    <div className="simulator-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1>Service Simulator</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Simulate WhatsApp chats for testing the Gemini AI classifier, database matching, and order state machine.
        </p>
      </div>

      <div className="simulator-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem' }}>
        
        {/* 1. Customer Mock Phone */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', height: '620px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Smartphone size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1.1rem' }}>Customer Interface</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No:</span>
              <input 
                type="text" 
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.2rem 0.5rem', fontSize: '0.85rem', width: '120px' }}
              />
            </div>
          </div>

          {/* Quick templates for Roman Urdu */}
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Quick Templates:</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => handleQuickCustomer("Yaar kitchen ka sink leak kr raha ha pani bahar araha ha urgent Gulberg me")} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '15px', cursor: 'pointer' }}
              >
                🚰 Leakage (Gulberg)
              </button>
              <button 
                onClick={() => handleQuickCustomer("AC bilkul thandi hawa nahi de raha gas leak he shayad, dha phase 5 me. Urgent")} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '15px', cursor: 'pointer' }}
              >
                ❄️ AC Issue (DHA)
              </button>
              <button 
                onClick={() => handleQuickCustomer("Asalam o Alaikum, mujhe room ki deep cleaning karwani he kal subha, Clifton")} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '15px', cursor: 'pointer' }}
              >
                🧹 Cleaning (Clifton)
              </button>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.03)' }}>
            {customerMessages.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', gap: '0.5rem' }}>
                <MessageSquare size={32} />
                <span style={{ fontSize: '0.9rem' }}>No messages yet.<br />Send a message to start the booking flow!</span>
              </div>
            ) : (
              customerMessages.map((m, idx) => (
                <div 
                  key={idx} 
                  style={{
                    alignSelf: m.sender === 'customer' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: m.sender === 'customer' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.08)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    borderRadius: m.sender === 'customer' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                    fontSize: '0.9rem',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-line',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  {m.content}
                  <span style={{ display: 'block', fontSize: '0.65rem', color: m.sender === 'customer' ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', textAlign: 'right', marginTop: '0.3rem' }}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Form */}
          <form onSubmit={sendCustomerMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              placeholder="Type message in Roman Urdu..."
              value={customerMsg}
              onChange={(e) => setCustomerMsg(e.target.value)}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'white', padding: '0.75rem 1rem', fontSize: '0.95rem', outline: 'none' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', borderRadius: '10px' }}>
              <Send size={18} />
            </button>
          </form>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => handleQuickCustomer("YES")} style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.4rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>
              Send YES (Confirm)
            </button>
            <button type="button" onClick={() => handleQuickCustomer("NO")} style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.4rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>
              Send NO (Cancel)
            </button>
          </div>
        </div>

        {/* 2. Worker Mock Phone */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', height: '620px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hammer size={20} color="var(--secondary)" />
              <h3 style={{ fontSize: '1.1rem' }}>Worker Interface</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No:</span>
              <input 
                type="text" 
                value={workerPhone}
                onChange={(e) => setWorkerPhone(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.2rem 0.5rem', fontSize: '0.85rem', width: '120px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Simulated Actions:</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => handleQuickWorker("START")} 
                style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ▶️ Start Job
              </button>
              <button 
                onClick={() => handleQuickWorker("COMPLETE")} 
                style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                🏁 Complete & Send Receipt
              </button>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.03)' }}>
            {workerMessages.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', gap: '0.5rem' }}>
                <Hammer size={32} />
                <span style={{ fontSize: '0.9rem' }}>No messages yet.<br />Workers receive notifications once customer confirms!</span>
              </div>
            ) : (
              workerMessages.map((m, idx) => (
                <div 
                  key={idx} 
                  style={{
                    alignSelf: m.sender === 'customer' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: m.sender === 'customer' ? 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' : 'rgba(255, 255, 255, 0.08)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    borderRadius: m.sender === 'customer' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                    fontSize: '0.9rem',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-line',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  {m.content}
                  <span style={{ display: 'block', fontSize: '0.65rem', color: m.sender === 'customer' ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', textAlign: 'right', marginTop: '0.3rem' }}>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Form */}
          <form onSubmit={sendWorkerMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              placeholder="Type message as worker (START/COMPLETE)..."
              value={workerMsg}
              onChange={(e) => setWorkerMsg(e.target.value)}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'white', padding: '0.75rem 1rem', fontSize: '0.95rem', outline: 'none' }}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.75rem', borderRadius: '10px' }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
