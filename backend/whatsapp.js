const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { parseBookingMessage } = require('./gemini');
const db = require('./database');

let client = null;
let qrCodeData = null; // Stores QR code as base64 data URI
let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'qr_ready', 'ready', 'error'
let webSocketBroadcaster = null; // Placeholder for WS or SSE callback

// Conversational State Machine for WhatsApp chats
// Key: phone number, Value: { state, bookingId, workerId, workerPhone, role: 'customer' | 'worker' }
const sessionStates = {};

// Event callback to notify server.js about changes
let onStatusChangeCallback = () => {};
let onNewMessageCallback = () => {};

function setBroadcasters(statusCb, msgCb) {
  onStatusChangeCallback = statusCb;
  onNewMessageCallback = msgCb;
}

/**
 * Initialize whatsapp-web.js client
 */
function initWhatsapp() {
  console.log('Initializing WhatsApp Client...');
  connectionStatus = 'connecting';
  onStatusChangeCallback({ status: connectionStatus });

  try {
    client = new Client({
      authStrategy: new LocalAuth({ clientId: "ustaad_session" }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    client.on('qr', async (qr) => {
      console.log('WhatsApp QR Code received. Generate QR Image...');
      connectionStatus = 'qr_ready';
      try {
        qrCodeData = await qrcode.toDataURL(qr);
        onStatusChangeCallback({ status: connectionStatus, qr: qrCodeData });
      } catch (err) {
        console.error('Error generating QR Code Image:', err);
      }
    });

    client.on('ready', () => {
      console.log('WhatsApp Client is Ready!');
      connectionStatus = 'ready';
      qrCodeData = null;
      onStatusChangeCallback({ status: connectionStatus });
    });

    client.on('authenticated', () => {
      console.log('WhatsApp Client Authenticated.');
    });

    client.on('auth_failure', (msg) => {
      console.error('WhatsApp Authentication Failure:', msg);
      connectionStatus = 'disconnected';
      onStatusChangeCallback({ status: connectionStatus, error: msg });
    });

    client.on('disconnected', (reason) => {
      console.log('WhatsApp Client Disconnected:', reason);
      connectionStatus = 'disconnected';
      onStatusChangeCallback({ status: connectionStatus });
    });

    client.on('message', async (msg) => {
      try {
        const fromPhone = msg.from.split('@')[0]; // Format: +923...
        const messageText = msg.body;
        console.log(`Received WhatsApp message from ${fromPhone}: ${messageText}`);
        
        await handleIncomingMessage(fromPhone, messageText, false);
      } catch (err) {
        console.error('Error processing incoming WhatsApp message:', err);
      }
    });

    // Start initialization without blocking server launch
    client.initialize().catch((err) => {
      console.warn('Puppeteer launch failed for whatsapp-web.js (likely missing chromium/dependencies). Running in Simulator Mode.', err);
      connectionStatus = 'disconnected';
      onStatusChangeCallback({ status: connectionStatus, error: 'puppeteer_failed' });
    });

  } catch (err) {
    console.error('Failed to instantiate whatsapp-web.js client:', err);
    connectionStatus = 'disconnected';
    onStatusChangeCallback({ status: connectionStatus, error: 'initialization_failed' });
  }
}

/**
 * Sends a message via whatsapp-web.js if ready, otherwise logs to console
 */
async function sendMessage(toPhone, messageContent, isSimulator = false) {
  // Save message to Database
  // We try to find the active booking for this phone to link the message
  let bookingId = null;
  const activeSession = sessionStates[toPhone];
  if (activeSession) {
    bookingId = activeSession.bookingId;
  }

  try {
    await db.run(
      'INSERT INTO messages (booking_id, sender, phone, content) VALUES (?, ?, ?, ?)',
      [bookingId, 'system', toPhone, messageContent]
    );
  } catch (err) {
    console.error('Failed to log outbound message in DB:', err);
  }

  // Notify UI
  onNewMessageCallback({
    booking_id: bookingId,
    sender: 'system',
    phone: toPhone,
    content: messageContent,
    timestamp: new Date().toISOString()
  });

  if (connectionStatus === 'ready' && client && !isSimulator) {
    try {
      const formattedPhone = toPhone.includes('@c.us') ? toPhone : `${toPhone}@c.us`;
      await client.sendMessage(formattedPhone, messageContent);
      console.log(`Sent actual WhatsApp to ${toPhone}: ${messageContent}`);
    } catch (err) {
      console.error(`Failed to send actual WhatsApp to ${toPhone}:`, err);
    }
  } else {
    console.log(`[SIMULATOR OUTBOUND] To ${toPhone}: ${messageContent}`);
  }
}

/**
 * Calculates estimated service pricing
 */
function calculatePrice(service_type, urgency) {
  const basePrices = {
    plumber: 1200,
    electrician: 1000,
    ac_technician: 1500,
    mechanic: 2000,
    cleaner: 800,
    unknown: 1000
  };

  const base = basePrices[service_type] || 1000;
  
  // Urgency multipliers
  let multiplier = 1.0;
  if (urgency === 'high') multiplier = 1.4; // 40% markup for emergency
  if (urgency === 'low') multiplier = 0.85; // 15% discount for scheduled jobs

  return Math.round(base * multiplier);
}

/**
 * Main Conversational logic handler.
 * Executed for both real WhatsApp and Simulator messages.
 */
async function handleIncomingMessage(fromPhone, messageText, isSimulator = false) {
  // Save incoming message in database
  let bookingId = null;
  const activeSession = sessionStates[fromPhone];
  if (activeSession) {
    bookingId = activeSession.bookingId;
  }

  try {
    await db.run(
      'INSERT INTO messages (booking_id, sender, phone, content) VALUES (?, ?, ?, ?)',
      [bookingId, 'customer', fromPhone, messageText]
    );
  } catch (err) {
    console.error('Failed to log inbound message in DB:', err);
  }

  // Notify UI
  onNewMessageCallback({
    booking_id: bookingId,
    sender: 'customer',
    phone: fromPhone,
    content: messageText,
    timestamp: new Date().toISOString()
  });

  // Check if phone number is a worker who is active
  if (activeSession && activeSession.role === 'worker') {
    await handleWorkerMessage(fromPhone, messageText, activeSession, isSimulator);
    return;
  }

  // Normal customer booking flow
  if (!activeSession) {
    // 1. Initial State: Analyze request using Gemini
    console.log(`Parsing new service request from ${fromPhone}...`);
    const analysis = await parseBookingMessage(messageText);
    console.log('Gemini Analysis Results:', analysis);

    if (analysis.service_type === 'unknown') {
      const reply = "Assalam-o-Alaikum! UstaadConnect AI me khushamdeed. 🌟\nHamari services me Plumber, Electrician, AC Technician, Mechanic, aur Cleaner shamil hain. Aapko kis kaam k liye ustaad chahye? Apni zaroorat Roman Urdu me likh kar batayen.";
      await sendMessage(fromPhone, reply, isSimulator);
      return;
    }

    // 2. Find best available worker matching trade and location
    // Try exact location first
    let worker = await db.get(
      'SELECT * FROM workers WHERE skill = ? AND location = ? AND status = ? ORDER BY rating DESC LIMIT 1',
      [analysis.service_type, analysis.location, 'available']
    );

    // Fallback to any location in the same trade if exact location not available
    let locationMatched = true;
    if (!worker) {
      locationMatched = false;
      worker = await db.get(
        'SELECT * FROM workers WHERE skill = ? AND status = ? ORDER BY rating DESC LIMIT 1',
        [analysis.service_type, 'available']
      );
    }

    if (!worker) {
      const reply = `Maazrat! Is waqt hamara koi ${analysis.service_type.replace('_', ' ')} available nahi hai. Baraye meharbani kuch dair baad dobara koshish karen.`;
      await sendMessage(fromPhone, reply, isSimulator);
      return;
    }

    // 3. Price Estimation
    const price = calculatePrice(analysis.service_type, analysis.urgency);

    // 4. Create pending booking record
    const result = await db.run(
      `INSERT INTO bookings 
      (customer_phone, customer_name, raw_message, service_type, location, urgency, estimated_price, worker_id, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fromPhone, 
        analysis.customer_name || 'Customer', 
        messageText, 
        analysis.service_type, 
        analysis.location, 
        analysis.urgency, 
        price, 
        worker.id, 
        'pending_confirmation'
      ]
    );

    const newBookingId = result.id;

    // Associate the initial message with the booking ID
    await db.run('UPDATE messages SET booking_id = ? WHERE phone = ? AND booking_id IS NULL', [newBookingId, fromPhone]);

    // Create session state
    sessionStates[fromPhone] = {
      state: 'pending_confirmation',
      bookingId: newBookingId,
      workerId: worker.id,
      workerPhone: worker.phone,
      role: 'customer'
    };

    // Format response
    const tradeLabels = {
      plumber: 'Plumber',
      electrician: 'Electrician',
      ac_technician: 'AC Technician',
      mechanic: 'Car/Bike Mechanic',
      cleaner: 'Ghar/Office Cleaner'
    };

    const urgencyLabels = {
      high: 'Emergency (High)',
      medium: 'Normal (Medium)',
      low: 'Scheduled (Low)'
    };

    const matchLocationMsg = locationMatched 
      ? `Aapke ilaqay ${analysis.location} me` 
      : `Hamaray paas (${worker.location}) se`;

    const confirmReply = `Assalam-o-Alaikum! UstaadConnect AI me khushamdeed. 🛠️\n\nHamain aapki request mil gayi hai:\n` +
      `- *Service Type*: ${tradeLabels[analysis.service_type]}\n` +
      `- *Ilaqa (Location)*: ${analysis.location}\n` +
      `- *Shiddat (Urgency)*: ${urgencyLabels[analysis.urgency]}\n\n` +
      `Hamne aap k liye best ustaad match kar lia hai:\n` +
      `- *Ustaad Name*: ${worker.name}\n` +
      `- *Rating*: ⭐ ${worker.rating} (${worker.completed_jobs} jobs done)\n` +
      `- *Estimated Price*: Rs. ${price}\n\n` +
      `${matchLocationMsg} Ustaad bhejne k liye, baraye meharbani *YES* likh kar reply karen. Cancel karne k liye *NO* likh kar reply karen.`;

    await sendMessage(fromPhone, confirmReply, isSimulator);

  } else if (activeSession.state === 'pending_confirmation') {
    // 5. Booking Confirmation Step
    const replyText = messageText.trim().toUpperCase();

    if (replyText === 'YES') {
      const bookingId = activeSession.bookingId;
      const workerId = activeSession.workerId;
      const workerPhone = activeSession.workerPhone;

      // Update booking and worker status
      await db.run("UPDATE bookings SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);
      await db.run("UPDATE workers SET status = 'busy' WHERE id = ?", [workerId]);

      // Get customer/booking info
      const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      const worker = await db.get('SELECT * FROM workers WHERE id = ?', [workerId]);

      // Reply to customer
      const customerReply = `Shukriya! Aapki booking confirm ho gayi hai. ✅\nUstaad ${worker.name} jald hi aap se is number par rabta karen ge. Shukriya!`;
      await sendMessage(fromPhone, customerReply, isSimulator);

      // Notify Worker
      const tradeLabels = {
        plumber: 'Plumbing',
        electrician: 'Electrical Repair',
        ac_technician: 'AC Repair/Gas Leak',
        mechanic: 'Vehicle Mechanic',
        cleaner: 'Cleaning Work'
      };

      const workerNotification = `Assalam-o-Alaikum Ustaad ${worker.name}! 🛠️\n\nAapko aik naya order mila hai:\n` +
        `- *Customer No*: ${fromPhone}\n` +
        `- *Location*: ${booking.location}\n` +
        `- *Kaam*: ${tradeLabels[booking.service_type]}\n` +
        `- *Estimated Price*: Rs. ${booking.estimated_price}\n\n` +
        `Kaam shuru karne k liye *START* likhen. Jab kaam mukammal ho jaye tou *COMPLETE* reply karen.`;

      // Set worker state
      sessionStates[workerPhone] = {
        state: 'worker_notified',
        bookingId: bookingId,
        customerPhone: fromPhone,
        role: 'worker'
      };

      // Set customer state to in progress
      sessionStates[fromPhone].state = 'confirmed';

      // Send to worker
      await sendMessage(workerPhone, workerNotification, isSimulator);

    } else if (replyText === 'NO') {
      const bookingId = activeSession.bookingId;
      await db.run("UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);

      const cancelReply = "Aapki booking cancel kar di gayi hai. Agla order lagane k liye apna kaam likh kar send karen. Shukriya!";
      await sendMessage(fromPhone, cancelReply, isSimulator);

      // Clean session
      delete sessionStates[fromPhone];
    } else {
      const retryReply = "Ghalt reply! Booking confirm karne k liye sirf *YES* likhen, ya cancel karne k liye *NO* likhen.";
      await sendMessage(fromPhone, retryReply, isSimulator);
    }
  } else if (activeSession.state === 'confirmed') {
    // Normal chat forwarding during active booking
    const reply = "Aapka order confirm ho chuka hai aur Ustaad jald rabta krega. Order ke mutaliq mazeed guftagu k liye is number pr wait kren.";
    await sendMessage(fromPhone, reply, isSimulator);
  }
}

/**
 * Handles incoming messages from workers
 */
async function handleWorkerMessage(workerPhone, messageText, session, isSimulator) {
  const replyText = messageText.trim().toUpperCase();
  const bookingId = session.bookingId;
  const customerPhone = session.customerPhone;

  if (session.state === 'worker_notified') {
    if (replyText === 'START') {
      // Update booking to in_progress
      await db.run("UPDATE bookings SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);
      
      sessionStates[workerPhone].state = 'worker_active';
      sessionStates[customerPhone].state = 'in_progress';

      await sendMessage(workerPhone, `Order shuru ho chuka hai. Kaam mukammal hone par *COMPLETE* reply karen. Shukriya!`, isSimulator);
      await sendMessage(customerPhone, `Ustaad ne kaam shuru kar dia he. Mukammal hone pr aapko receipt mil jaye gi.`, isSimulator);
    } else {
      await sendMessage(workerPhone, `Kaam shuru karne k liye *START* likh kar reply karen.`, isSimulator);
    }
  } else if (session.state === 'worker_active') {
    if (replyText === 'COMPLETE') {
      // Complete booking
      const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      const worker = await db.get('SELECT * FROM workers WHERE id = ?', [booking.worker_id]);

      await db.run("UPDATE bookings SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);
      await db.run("UPDATE workers SET status = 'available', completed_jobs = completed_jobs + 1 WHERE id = ?", [worker.id]);

      // Generate Receipt
      const receiptMsg = `--- 🧾 UstaadConnect AI Receipt ---\n\n` +
        `*Order ID*: UC-B00${bookingId}\n` +
        `*Date*: ${new Date().toLocaleDateString()}\n` +
        `*Ustaad*: ${worker.name} (${worker.skill.replace('_', ' ')})\n` +
        `*Service*: ${booking.service_type.toUpperCase()}\n` +
        `*Location*: ${booking.location}\n\n` +
        `-------------------------------\n` +
        `*Service Charge*: Rs. ${booking.estimated_price}\n` +
        `*GST (Informal Sector)*: Rs. 0\n` +
        `*Total Payable*: Rs. ${booking.estimated_price}\n` +
        `-------------------------------\n\n` +
        `Hamari service istemal karne ka shukriya! Ustaad ko feedback dene k liye is message ka jawab den. ⭐⭐⭐⭐⭐`;

      // Send confirmation to both
      await sendMessage(customerPhone, receiptMsg, isSimulator);
      await sendMessage(workerPhone, `Shukriya Ustaad! Job completed successfully. Aap ab doosri booking k liye available hain.`, isSimulator);

      // Clean states
      delete sessionStates[customerPhone];
      delete sessionStates[workerPhone];
    } else {
      await sendMessage(workerPhone, `Kaam mukammal hone par *COMPLETE* likh kar reply karen.`, isSimulator);
    }
  }
}

/**
 * Force simulation action directly from admin dashboard (e.g. manual status transition)
 */
async function forceCompleteJob(bookingId) {
  const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) return false;

  const worker = await db.get('SELECT * FROM workers WHERE id = ?', [booking.worker_id]);
  
  await db.run("UPDATE bookings SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);
  if (worker) {
    await db.run("UPDATE workers SET status = 'available', completed_jobs = completed_jobs + 1 WHERE id = ?", [worker.id]);
    delete sessionStates[worker.phone];
  }
  delete sessionStates[booking.customer_phone];

  // Send fake receipt
  const receiptMsg = `--- 🧾 UstaadConnect AI Receipt (Admin Completed) ---\n\n` +
    `*Order ID*: UC-B00${bookingId}\n` +
    `*Date*: ${new Date().toLocaleDateString()}\n` +
    `*Ustaad*: ${worker ? worker.name : 'Unknown'} (${booking.service_type.replace('_', ' ')})\n` +
    `*Service*: ${booking.service_type.toUpperCase()}\n` +
    `*Location*: ${booking.location}\n\n` +
    `-------------------------------\n` +
    `*Service Charge*: Rs. ${booking.estimated_price}\n` +
    `*GST (Informal Sector)*: Rs. 0\n` +
    `*Total Payable*: Rs. ${booking.estimated_price}\n` +
    `-------------------------------\n\n` +
    `Thank you for using UstaadConnect AI!`;

  await sendMessage(booking.customer_phone, receiptMsg, true);
  if (worker) {
    await sendMessage(worker.phone, `Job completed by Admin. You are now available for bookings.`, true);
  }
  return true;
}

module.exports = {
  initWhatsapp,
  sendMessage,
  handleIncomingMessage,
  setBroadcasters,
  sessionStates,
  forceCompleteJob,
  getConnectionStatus: () => connectionStatus,
  getQrCodeData: () => qrCodeData
};
