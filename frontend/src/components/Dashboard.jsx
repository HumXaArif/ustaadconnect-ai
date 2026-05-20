import React from 'react';
import { Briefcase, Users, DollarSign, CheckCircle, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

export default function Dashboard({ analytics, bookings, workers, messages, setView }) {
  // Compute basic quick stats
  const activeBookings = bookings.filter(b => ['pending_match', 'pending_confirmation', 'confirmed', 'in_progress'].includes(b.status)).length;
  const availableWorkers = workers.filter(w => w.status === 'available').length;
  const completedJobs = bookings.filter(b => b.status === 'completed').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (b.estimated_price || 0), 0);

  // Compute skill counts
  const skillCounts = bookings.reduce((acc, b) => {
    acc[b.service_type] = (acc[b.service_type] || 0) + 1;
    return acc;
  }, {});

  const tradeLabels = {
    plumber: 'Plumbers',
    electrician: 'Electricians',
    ac_technician: 'AC Technicians',
    mechanic: 'Mechanics',
    cleaner: 'Cleaners'
  };

  // Get recent 5 messages
  const recentMessages = [...messages].reverse().slice(0, 5);

  return (
    <div className="dashboard-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1>Dashboard Overview</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Real-time metrics, worker allocations, and AI booking activity.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        
        {/* Card 1 */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--secondary)', padding: '0.8rem', borderRadius: '12px' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', fontWeight: '500' }}>Active Bookings</span>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', display: 'block', marginTop: '0.2rem' }}>{activeBookings}</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--primary)', padding: '0.8rem', borderRadius: '12px' }}>
            <Users size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', fontWeight: '500' }}>Available Workers</span>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', display: 'block', marginTop: '0.2rem' }}>{availableWorkers} / {workers.length}</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent)', padding: '0.8rem', borderRadius: '12px' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', fontWeight: '500' }}>Total Revenue</span>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', display: 'block', marginTop: '0.2rem' }}>Rs. {totalRevenue.toLocaleString()}</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.8rem', borderRadius: '12px' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', fontWeight: '500' }}>Completed Jobs</span>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', display: 'block', marginTop: '0.2rem' }}>{completedJobs}</span>
          </div>
        </div>

      </div>

      {/* Graphical Breakdown + Activity Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Service Demands */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="var(--primary)" />
            Bookings by Trade
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {Object.keys(tradeLabels).map(trade => {
              const count = skillCounts[trade] || 0;
              const percent = bookings.length > 0 ? Math.round((count / bookings.length) * 100) : 0;
              
              return (
                <div key={trade} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: '500' }}>{tradeLabels[trade]}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{count} ({percent}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${percent}%`, 
                        background: 'linear-gradient(90deg, var(--secondary) 0%, var(--primary) 100%)',
                        borderRadius: '10px',
                        transition: 'width 1s ease-out'
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live System Messages */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', height: '360px' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={20} color="var(--secondary)" />
            Recent WhatsApp Logs
          </h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '0.5rem' }}>
            {recentMessages.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No active conversations yet.
              </div>
            ) : (
              recentMessages.map((m, idx) => (
                <div key={idx} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: 'bold', color: m.sender === 'customer' ? 'var(--primary)' : 'var(--secondary)' }}>
                      {m.sender.toUpperCase()} ({m.phone})
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {m.content}
                  </p>
                </div>
              ))
            )}
          </div>
          
          <button 
            className="btn btn-secondary" 
            onClick={() => setView('simulator')}
            style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', fontSize: '0.85rem' }}
          >
            Open Simulator Console
          </button>
        </div>

      </div>
    </div>
  );
}
