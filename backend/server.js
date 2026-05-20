require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const whatsapp = require('./whatsapp');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// List of connected SSE clients
let clients = [];

// SSE Subscription endpoint for real-time dashboard events
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Establish stream

  clients.push(res);
  console.log(`SSE Client connected. Total: ${clients.length}`);

  // Send initial WhatsApp status immediately
  res.write(`event: status\ndata: ${JSON.stringify({ 
    status: whatsapp.getConnectionStatus(), 
    qr: whatsapp.getQrCodeData() 
  })}\n\n`);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
    console.log(`SSE Client disconnected. Total: ${clients.length}`);
  });
});

// Broadcast helper function
function broadcastEvent(type, data) {
  clients.forEach(c => {
    c.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

// Attach callbacks in WhatsApp manager to push SSE updates
whatsapp.setBroadcasters(
  (statusData) => broadcastEvent('status', statusData),
  (msgData) => broadcastEvent('message', msgData)
);

/**
 * ----------------------------------------------------
 * WORKERS API
 * ----------------------------------------------------
 */

// Get all workers
app.get('/api/workers', async (req, res) => {
  try {
    const workers = await db.all('SELECT * FROM workers ORDER BY rating DESC');
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new worker
app.post('/api/workers', async (req, res) => {
  const { name, phone, skill, location, rating } = req.body;
  if (!name || !phone || !skill || !location) {
    return res.status(400).json({ error: 'Missing required fields: name, phone, skill, location' });
  }

  try {
    const result = await db.run(
      'INSERT INTO workers (name, phone, skill, location, rating, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone, skill, location, rating || 5.0, 'available']
    );
    const newWorker = await db.get('SELECT * FROM workers WHERE id = ?', [result.id]);
    res.status(201).json(newWorker);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      res.status(400).json({ error: 'Worker with this phone number already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Update worker status or profile
app.put('/api/workers/:id', async (req, res) => {
  const { id } = req.params;
  const { status, rating, location, skill } = req.body;

  try {
    const worker = await db.get('SELECT * FROM workers WHERE id = ?', [id]);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const newStatus = status !== undefined ? status : worker.status;
    const newRating = rating !== undefined ? rating : worker.rating;
    const newLocation = location !== undefined ? location : worker.location;
    const newSkill = skill !== undefined ? skill : worker.skill;

    await db.run(
      'UPDATE workers SET status = ?, rating = ?, location = ?, skill = ? WHERE id = ?',
      [newStatus, newRating, newLocation, newSkill, id]
    );

    const updated = await db.get('SELECT * FROM workers WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ----------------------------------------------------
 * BOOKINGS API
 * ----------------------------------------------------
 */

// Get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await db.all(`
      SELECT b.*, w.name as worker_name, w.phone as worker_phone 
      FROM bookings b 
      LEFT JOIN workers w ON b.worker_id = w.id 
      ORDER BY b.created_at DESC
    `);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually complete a booking (admin override)
app.put('/api/bookings/:id/complete', async (req, res) => {
  const { id } = req.params;
  try {
    const success = await whatsapp.forceCompleteJob(id);
    if (!success) return res.status(404).json({ error: 'Booking not found' });

    const updatedBooking = await db.get('SELECT * FROM bookings WHERE id = ?', [id]);
    broadcastEvent('booking_updated', updatedBooking);
    res.json({ message: 'Job completed successfully', booking: updatedBooking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ----------------------------------------------------
 * CHAT MESSAGES API
 * ----------------------------------------------------
 */

// Get message logs (optionally filtered by booking)
app.get('/api/messages', async (req, res) => {
  const { bookingId } = req.query;
  try {
    let query = 'SELECT * FROM messages ORDER BY timestamp ASC';
    let params = [];
    
    if (bookingId) {
      query = 'SELECT * FROM messages WHERE booking_id = ? ORDER BY timestamp ASC';
      params = [bookingId];
    }

    const messages = await db.all(query, params);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ----------------------------------------------------
 * ANALYTICS API
 * ----------------------------------------------------
 */

app.get('/api/analytics', async (req, res) => {
  try {
    const revenueRow = await db.get("SELECT SUM(estimated_price) as total FROM bookings WHERE status = 'completed'");
    const activeRow = await db.get("SELECT COUNT(*) as count FROM bookings WHERE status IN ('pending_match', 'pending_confirmation', 'confirmed', 'in_progress')");
    const workersRow = await db.get("SELECT COUNT(*) as count FROM workers WHERE status = 'available'");
    const completedRow = await db.get("SELECT COUNT(*) as count FROM bookings WHERE status = 'completed'");

    const skillCounts = await db.all("SELECT service_type, COUNT(*) as count FROM bookings GROUP BY service_type");
    const urgencyCounts = await db.all("SELECT urgency, COUNT(*) as count FROM bookings GROUP BY urgency");

    res.json({
      revenue: revenueRow.total || 0,
      active_bookings: activeRow.count,
      available_workers: workersRow.count,
      completed_jobs: completedRow.count,
      bookings_by_skill: skillCounts,
      bookings_by_urgency: urgencyCounts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * ----------------------------------------------------
 * SIMULATOR ENDPOINT
 * ----------------------------------------------------
 * Simulates receiving a WhatsApp message from a phone number.
 */
app.post('/api/simulator/receive', async (req, res) => {
  const { fromPhone, content } = req.body;
  if (!fromPhone || !content) {
    return res.status(400).json({ error: 'Missing fromPhone or content' });
  }

  try {
    console.log(`[SIMULATOR INBOUND] Message from ${fromPhone}: ${content}`);
    // Handle message asynchronously so simulator UI doesn't hang
    whatsapp.handleIncomingMessage(fromPhone, content, true);
    res.json({ status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend in production (optional, if compiled frontend exists in frontend/dist)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'), (err) => {
    // If frontend hasn't been built yet, suppress error
    if (err) {
      res.status(404).send('UstaadConnect API backend is running. Build frontend to view interface.');
    }
  });
});

// Start Server
db.initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`UstaadConnect Server running on port ${PORT}`);
    // Start WhatsApp after server starts
    whatsapp.initWhatsapp();
  });
});
