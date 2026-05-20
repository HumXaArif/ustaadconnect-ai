import React, { useState } from 'react';
import { Users, UserPlus, Star, ShieldAlert, Phone, MapPin, CheckCircle, RefreshCw } from 'lucide-react';

export default function WorkersManager({ backendUrl, workers, triggerRefresh }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [skill, setSkill] = useState('plumber');
  const [location, setLocation] = useState('Gulberg');
  const [rating, setRating] = useState(5.0);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleStatus = async (workerId, currentStatus) => {
    let nextStatus = 'available';
    if (currentStatus === 'available') nextStatus = 'offline';
    else if (currentStatus === 'offline') nextStatus = 'available';
    else return; // If busy with a booking, can't change manually

    try {
      const response = await fetch(`${backendUrl}/api/workers/${workerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (response.ok) {
        triggerRefresh();
      }
    } catch (err) {
      console.error('Failed to toggle worker status:', err);
    }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!name || !phone || !location) {
      setErrorMsg('Please fill out all fields.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, skill, location, rating: parseFloat(rating) })
      });
      
      const data = await response.json();
      if (response.ok) {
        // Reset form
        setName('');
        setPhone('');
        setSkill('plumber');
        setLocation('Gulberg');
        setRating(5.0);
        setShowAddForm(false);
        triggerRefresh();
      } else {
        setErrorMsg(data.error || 'Failed to add worker');
      }
    } catch (err) {
      setErrorMsg('Server connection failed.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const skillLabels = {
    plumber: '🚰 Plumber',
    electrician: '⚡ Electrician',
    ac_technician: '❄️ AC Technician',
    mechanic: '🔧 Mechanic',
    cleaner: '🧹 Cleaner'
  };

  return (
    <div className="workers-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Ustaad Directory</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Manage informal workers, monitor active availability, and edit status.
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <UserPlus size={18} />
          {showAddForm ? 'Close Form' : 'Register Ustaad'}
        </button>
      </div>

      {/* Add Worker Modal Panel */}
      {showAddForm && (
        <div className="glass-panel" style={{ padding: '1.50rem', borderRadius: '16px', animation: 'fadeIn 0.3s ease' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} color="var(--primary)" />
            Register New Informal Worker
          </h3>
          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {errorMsg}
            </div>
          )}
          <form onSubmit={handleAddWorker} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Full Name</label>
              <input 
                type="text" 
                placeholder="e.g. Mohammad Bilal" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.6rem 0.8rem', fontSize: '0.9rem' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>WhatsApp Number</label>
              <input 
                type="text" 
                placeholder="e.g. +923001234567" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.6rem 0.8rem', fontSize: '0.9rem' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trade / Skill</label>
              <select 
                value={skill} 
                onChange={(e) => setSkill(e.target.value)}
                style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.6rem 0.8rem', fontSize: '0.9rem', outline: 'none' }}
              >
                <option value="plumber">Plumber</option>
                <option value="electrician">Electrician</option>
                <option value="ac_technician">AC Technician</option>
                <option value="mechanic">Mechanic</option>
                <option value="cleaner">Cleaner</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Location (Ilaqa)</label>
              <input 
                type="text" 
                placeholder="e.g. DHA, Gulberg, Clifton" 
                value={location} 
                onChange={(e) => setLocation(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.6rem 0.8rem', fontSize: '0.9rem' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rating (1-5)</label>
              <input 
                type="number" 
                step="0.1" 
                min="1" 
                max="5"
                value={rating} 
                onChange={(e) => setRating(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.6rem 0.8rem', fontSize: '0.9rem' }}
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.7rem' }}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Register'}
            </button>
          </form>
        </div>
      )}

      {/* Grid of Workers */}
      <div className="workers-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.5rem' }}>
        {workers.map(w => (
          <div key={w.id} className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: w.status === 'busy' ? '3px solid var(--secondary)' : w.status === 'available' ? '3px solid var(--primary)' : '3px solid var(--text-muted)' }}>
            
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: '#fff' }}>{w.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {skillLabels[w.skill]}
                </span>
              </div>
              <span className={`badge badge-${w.status}`}>
                {w.status}
              </span>
            </div>

            {/* Middle row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Phone size={14} color="var(--text-muted)" />
                <span>{w.phone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={14} color="var(--text-muted)" />
                <span>{w.location}</span>
              </div>
            </div>

            {/* Footer row */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <Star size={14} fill="#fbbf24" color="#fbbf24" />
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'white' }}>{w.rating}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({w.completed_jobs} jobs)</span>
              </div>
              
              <button
                onClick={() => toggleStatus(w.id, w.status)}
                disabled={w.status === 'busy'}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px', cursor: w.status === 'busy' ? 'not-allowed' : 'pointer', background: w.status === 'busy' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', color: w.status === 'busy' ? 'var(--text-muted)' : 'var(--text-primary)' }}
              >
                {w.status === 'available' ? 'Go Offline' : w.status === 'offline' ? 'Go Online' : 'On Active Job'}
              </button>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
