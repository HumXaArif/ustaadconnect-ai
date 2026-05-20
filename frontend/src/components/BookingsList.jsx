import React, { useState } from 'react';
import { Briefcase, AlertTriangle, CheckCircle, RefreshCw, MessageSquare, MapPin, DollarSign, Calendar, FileText } from 'lucide-react';

export default function BookingsList({ backendUrl, bookings, messages, triggerRefresh }) {
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const completeBooking = async (bookingId) => {
    try {
      const response = await fetch(`${backendUrl}/api/bookings/${bookingId}/complete`, {
        method: 'PUT'
      });
      if (response.ok) {
        triggerRefresh();
        if (selectedBooking && selectedBooking.id === bookingId) {
          // Refresh selection
          const updated = bookings.find(b => b.id === bookingId);
          setSelectedBooking({ ...selectedBooking, status: 'completed' });
        }
      }
    } catch (err) {
      console.error('Failed to complete booking:', err);
    }
  };

  const handleRowClick = (booking) => {
    setSelectedBooking(booking);
  };

  const filteredBookings = bookings.filter(b => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return ['pending_match', 'pending_confirmation', 'confirmed', 'in_progress'].includes(b.status);
    return b.status === filterStatus;
  });

  const skillIcons = {
    plumber: '🚰',
    electrician: '⚡',
    ac_technician: '❄️',
    mechanic: '🔧',
    cleaner: '🧹',
    unknown: '🛠️'
  };

  // Get messages for selected booking
  const selectedMessages = selectedBooking 
    ? messages.filter(m => m.booking_id === selectedBooking.id || (m.phone === selectedBooking.customer_phone && m.booking_id === null))
    : [];

  return (
    <div className="bookings-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1>Booking Log</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Monitor customer requests, check AI matching parameters, and manage active booking cycles.
        </p>
      </div>

      <div className="bookings-layout" style={{ display: 'grid', gridTemplateColumns: selectedBooking ? '1.1fr 0.9fr' : '1fr', gap: '2rem', transition: 'all 0.3s ease' }}>
        
        {/* Bookings Table List */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '400px' }}>
          
          {/* Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem' }}>All Requests</h3>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'active', 'completed', 'cancelled'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  style={{
                    background: filterStatus === status ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.02)',
                    color: filterStatus === status ? '#34d399' : 'var(--text-secondary)',
                    border: '1px solid ' + (filterStatus === status ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'),
                    padding: '0.35rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    fontWeight: '500'
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '1rem 0.5rem' }}>ID</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Customer</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Service</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Location</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Price</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Urgency</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No bookings found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map(b => (
                    <tr 
                      key={b.id} 
                      onClick={() => handleRowClick(b)}
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.03)', 
                        cursor: 'pointer',
                        background: selectedBooking && selectedBooking.id === b.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                      className="booking-row"
                    >
                      <td style={{ padding: '1rem 0.5rem', fontWeight: 'bold' }}>#{b.id}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: 'white', fontWeight: '500' }}>{b.customer_name || 'Customer'}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.customer_phone}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <span style={{ marginRight: '0.4rem' }}>{skillIcons[b.service_type]}</span>
                        <span style={{ textTransform: 'capitalize' }}>{b.service_type.replace('_', ' ')}</span>
                      </td>
                      <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>{b.location}</td>
                      <td style={{ padding: '1rem 0.5rem', fontWeight: '600' }}>Rs. {b.estimated_price}</td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <span className={`badge badge-${b.urgency}`}>
                          {b.urgency}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <span className={`badge badge-${b.status.includes('pending') ? 'pending' : b.status}`}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Selected Booking Inspector Panel */}
        {selectedBooking && (
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '620px', animation: 'fadeIn 0.3s ease' }}>
            
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', color: 'white' }}>Booking ID #{selectedBooking.id}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Placed on {new Date(selectedBooking.created_at).toLocaleString()}
                </span>
              </div>
              <button 
                onClick={() => setSelectedBooking(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Customer Phone</span>
                <span style={{ color: 'white', fontWeight: '500' }}>{selectedBooking.customer_phone}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Ustaad</span>
                <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{selectedBooking.worker_name || 'Not Matched'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Location / Area</span>
                <span style={{ color: 'white' }}><MapPin size={12} /> {selectedBooking.location}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Price Charge</span>
                <span style={{ color: 'white', fontWeight: '600' }}><DollarSign size={12} /> Rs. {selectedBooking.estimated_price}</span>
              </div>
            </div>

            {/* Initial Roman Urdu Request */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.85rem', fontSize: '0.85rem' }}>
              <span style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                Original Customer Request:
              </span>
              <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                "{selectedBooking.raw_message}"
              </p>
            </div>

            {/* Conversation Log inside Inspector */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Conversation History:
              </span>
              {selectedMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>
                  No messages linked to this booking yet.
                </div>
              ) : (
                selectedMessages.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px', borderLeft: '3px solid ' + (m.sender === 'customer' ? 'var(--primary)' : 'var(--secondary)') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: '600' }}>{m.sender.toUpperCase()}</span>
                      <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'white', whiteSpace: 'pre-line' }}>{m.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Complete Job Force button */}
            {['confirmed', 'in_progress'].includes(selectedBooking.status) && (
              <button
                className="btn btn-primary"
                onClick={() => completeBooking(selectedBooking.id)}
                style={{ width: '100%', gap: '0.5rem' }}
              >
                <CheckCircle size={16} />
                Admin Force Complete Job
              </button>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
