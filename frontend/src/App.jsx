import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Users, Briefcase, MessageSquare, Smartphone, Zap, RefreshCw } from 'lucide-react';
import Dashboard from './components/Dashboard';
import WorkersManager from './components/WorkersManager';
import BookingsList from './components/BookingsList';
import Simulator from './components/Simulator';
import WhatsappLogin from './components/WhatsappLogin';

// Dynamic API URL depending on dev/prod environments
const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.origin.includes('5173') 
  ? 'http://localhost:5000' 
  : window.location.origin);


export default function App() {
  const [view, setView] = useState('dashboard');
  const [workers, setWorkers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch all database entities from Express backend
  const fetchData = useCallback(async () => {
    try {
      const [workersRes, bookingsRes, messagesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/workers`),
        fetch(`${BACKEND_URL}/api/bookings`),
        fetch(`${BACKEND_URL}/api/messages`)
      ]);

      if (workersRes.ok && bookingsRes.ok && messagesRes.ok) {
        const workersData = await workersRes.json();
        const bookingsData = await bookingsRes.json();
        const messagesData = await messagesRes.json();

        setWorkers(workersData);
        setBookings(bookingsData);
        setMessages(messagesData);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize SSE (Server-Sent Events) connection for real-time notifications
  useEffect(() => {
    fetchData();

    const eventSource = new EventSource(`${BACKEND_URL}/api/events`);

    // Listen for WhatsApp connection status changes
    eventSource.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);
        setWhatsappStatus(data.status || 'disconnected');
        setQrCode(data.qr || null);
      } catch (err) {
        console.error('Failed to parse status SSE event:', err);
      }
    });

    // Listen for new messages (incoming customer or outgoing system replies)
    eventSource.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        setMessages(prev => [...prev, data]);
        // Proactively refresh bookings/workers when messaging changes states
        fetchData();
      } catch (err) {
        console.error('Failed to parse message SSE event:', err);
      }
    });

    // Listen for booking updates
    eventSource.addEventListener('booking_updated', (e) => {
      fetchData();
    });

    return () => {
      eventSource.close();
    };
  }, [fetchData]);

  // Periodic polling fallback for non-message changes (worker status, manually completed jobs)
  useEffect(() => {
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', background: 'var(--bg-primary)' }}>
        <RefreshCw size={40} className="spinner" color="var(--primary)" style={{ animation: 'spin 2s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>Loading UstaadConnect Dashboard...</p>
      </div>
    );
  }

  const statusLightColor = {
    disconnected: 'disconnected',
    connecting: 'qr-ready',
    qr_ready: 'qr-ready',
    ready: 'connected'
  }[whatsappStatus] || 'disconnected';

  return (
    <div className="app-container">
      
      {/* 1. Sidebar Nav */}
      <aside className="sidebar">
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', padding: '0.6rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)' }}>
            <Zap size={22} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: '800', tracking: '-0.02em', background: 'linear-gradient(135deg, white 50%, var(--primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>UstaadConnect</h2>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 'bold' }}>AI Booking Console</span>
          </div>
        </div>

        {/* Menu Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            onClick={() => setView('dashboard')} 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: view === 'dashboard' ? 'rgba(255,255,255,0.06)' : 'transparent',
              borderLeft: view === 'dashboard' ? '3px solid var(--primary)' : '3px solid transparent',
              borderRadius: '0 8px 8px 0',
              paddingLeft: '0.8rem',
              color: view === 'dashboard' ? 'white' : 'var(--text-secondary)'
            }}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>
          
          <button 
            onClick={() => setView('bookings')} 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: view === 'bookings' ? 'rgba(255,255,255,0.06)' : 'transparent',
              borderLeft: view === 'bookings' ? '3px solid var(--primary)' : '3px solid transparent',
              borderRadius: '0 8px 8px 0',
              paddingLeft: '0.8rem',
              color: view === 'bookings' ? 'white' : 'var(--text-secondary)'
            }}
          >
            <Briefcase size={18} />
            Bookings
          </button>

          <button 
            onClick={() => setView('workers')} 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: view === 'workers' ? 'rgba(255,255,255,0.06)' : 'transparent',
              borderLeft: view === 'workers' ? '3px solid var(--primary)' : '3px solid transparent',
              borderRadius: '0 8px 8px 0',
              paddingLeft: '0.8rem',
              color: view === 'workers' ? 'white' : 'var(--text-secondary)'
            }}
          >
            <Users size={18} />
            Ustaad List
          </button>

          <button 
            onClick={() => setView('whatsapp')} 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: view === 'whatsapp' ? 'rgba(255,255,255,0.06)' : 'transparent',
              borderLeft: view === 'whatsapp' ? '3px solid var(--primary)' : '3px solid transparent',
              borderRadius: '0 8px 8px 0',
              paddingLeft: '0.8rem',
              color: view === 'whatsapp' ? 'white' : 'var(--text-secondary)'
            }}
          >
            <MessageSquare size={18} />
            WhatsApp Link
          </button>

          <button 
            onClick={() => setView('simulator')} 
            className="btn" 
            style={{ 
              justifyContent: 'flex-start',
              background: view === 'simulator' ? 'rgba(255,255,255,0.06)' : 'transparent',
              borderLeft: view === 'simulator' ? '3px solid var(--primary)' : '3px solid transparent',
              borderRadius: '0 8px 8px 0',
              paddingLeft: '0.8rem',
              color: view === 'simulator' ? 'white' : 'var(--text-secondary)'
            }}
          >
            <Smartphone size={18} />
            Chat Simulator
          </button>
        </nav>

        {/* Footer Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
          <span className={`pulse-dot ${statusLightColor}`} />
          <div>
            <span style={{ color: 'white', fontWeight: '500', display: 'block' }}>WhatsApp Client</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'capitalize' }}>{whatsappStatus.replace('_', ' ')}</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Frame */}
      <main className="main-content">
        {view === 'dashboard' && (
          <Dashboard 
            bookings={bookings} 
            workers={workers} 
            messages={messages} 
            setView={setView} 
          />
        )}
        {view === 'bookings' && (
          <BookingsList 
            backendUrl={BACKEND_URL}
            bookings={bookings} 
            messages={messages} 
            triggerRefresh={fetchData} 
          />
        )}
        {view === 'workers' && (
          <WorkersManager 
            backendUrl={BACKEND_URL}
            workers={workers} 
            triggerRefresh={fetchData} 
          />
        )}
        {view === 'whatsapp' && (
          <WhatsappLogin 
            whatsappStatus={whatsappStatus} 
            qrCode={qrCode} 
          />
        )}
        {view === 'simulator' && (
          <Simulator 
            backendUrl={BACKEND_URL}
            messages={messages} 
            triggerRefresh={fetchData} 
          />
        )}
      </main>

    </div>
  );
}
