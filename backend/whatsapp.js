const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { parseBookingMessage } = require('./gemini');
const db = require('./database');

let client = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';

const sessionStates = {};
const originalMessages = {}; // Store original msg objects for direct reply

let onStatusChangeCallback = () => {};
let onNewMessageCallback = () => {};

function setBroadcasters(statusCb, msgCb) {
  onStatusChangeCallback = statusCb;
  onNewMessageCallback = msgCb;
}

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
        if (msg.from.includes('@g.us')) return;

        const rawFrom = msg.id.remote || msg.from;
        const fromPhone = rawFrom.replace('@c.us', '').replace('@lid', '');
        const messageText = msg.body;

        // Store original msg for direct reply (bypasses LID issue)
        originalMessages[fromPhone] = msg;

        console.log(`Received WhatsApp message from ${fromPhone}: ${messageText}`);
        await handleIncomingMessage(fromPhone, messageText, false);
      } catch (err) {
        console.error('Error processing incoming WhatsApp message:', err);
      }
    });

    client.initialize().catch((err) => {
      console.warn('Puppeteer launch failed. Running in Simulator Mode.', err);
      connectionStatus = 'disconnected';
      onStatusChangeCallback({ status: connectionStatus, error: 'puppeteer_failed' });
    });

  } catch (err) {
    console.error('Failed to instantiate whatsapp-web.js client:', err);
    connectionStatus = 'disconnected';
    onStatusChangeCallback({ status: connectionStatus, error: 'initialization_failed' });
  }
}

async function sendMessage(toPhone, messageContent, isSimulator = false) {
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

  onNewMessageCallback({
    booking_id: bookingId,
    sender: 'system',
    phone: toPhone,
    content: messageContent,
    timestamp: new Date().toISOString()
  });

  if (connectionStatus === 'ready' && client && !isSimulator) {
    try {
      // Use msg.reply() to bypass LID issue
      const originalMsg = originalMessages[toPhone];
      if (originalMsg) {
        await originalMsg.reply(messageContent);
        console.log(`Replied via msg.reply() to ${toPhone}`);
      } else {
        // Fallback for worker notifications
        let formattedPhone = toPhone.replace('@lid', '').replace('@c.us', '').replace(/[^0-9]/g, '');
        formattedPhone = `${formattedPhone}@c.us`;
        await client.sendMessage(formattedPhone, messageContent);
        console.log(`Sent WhatsApp to ${toPhone}`);
      }
    } catch (err) {
      console.error(`Failed to send WhatsApp to ${toPhone}:`, err);
    }
  } else {
    console.log(`[SIMULATOR OUTBOUND] To ${toPhone}: ${messageContent}`);
  }
}

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
  let multiplier = 1.0;
  if (urgency === 'high') multiplier = 1.4;
  if (urgency === 'low') multiplier = 0.85;

  return Math.round(base * multiplier);
}

async function handleIncomingMessage(fromPhone, messageText, isSimulator = false) {
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

  onNewMessageCallback({
    booking_id: bookingId,
    sender: 'customer',
    phone: fromPhone,
    content: messageText,
    timestamp: new Date().toISOString()
  });

  if (activeSession && activeSession.role === 'worker') {
    await handleWorkerMessage(fromPhone, messageText, activeSession, isSimulator);
    return;
  }

  if (!activeSession) {
    console.log(`Parsing new service request from ${fromPhone}...`);
    const analysis = await parseBookingMessage(messageText);
    console.log('Analysis Results:', analysis);

    if (analysis.service_type === 'unknown') {
      const reply = "Assalam-o-Alaikum! UstaadConnect AI me khushamdeed. 🌟\nHamari services me Plumber, Electrician, AC Technician, Mechanic, aur Cleaner shamil hain. Aapko kis kaam k liye ustaad chahye? Apni zaroorat Roman Urdu me likh kar batayen.";
      await sendMessage(fromPhone, reply, isSimulator);
      return;
    }

    let worker = await db.get(
      'SELECT * FROM workers WHERE skill = ? AND location = ? AND status = ? ORDER BY rating DESC LIMIT 1',
      [analysis.service_type, analysis.location, 'available']
    );

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

    const price = calculatePrice(analysis.service_type, analysis.urgency);

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
    await db.run('UPDATE messages SET booking_id = ? WHERE phone = ? AND booking_id IS NULL', [newBookingId, fromPhone]);

    sessionStates[fromPhone] = {
      state: 'pending_confirmation',
      bookingId: newBookingId,
      workerId: worker.id,
      workerPhone: worker.phone,
      role: 'customer'
    };

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
    const replyText = messageText.trim().toUpperCase();

    if (replyText === 'YES') {
      const bookingId = activeSession.bookingId;
      const workerId = activeSession.workerId;
      const workerPhone = activeSession.workerPhone;

      await db.run("UPDATE bookings SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);
      await db.run("UPDATE workers SET status = 'busy' WHERE id = ?", [workerId]);

      const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      const worker = await db.get('SELECT * FROM workers WHERE id = ?', [workerId]);

      const customerReply = `Shukriya! Aapki booking confirm ho gayi hai. ✅\nUstaad ${worker.name} jald hi aap se rabta karen ge. Shukriya!`;
      await sendMessage(fromPhone, customerReply, isSimulator);

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

      sessionStates[workerPhone] = {
        state: 'worker_notified',
        bookingId: bookingId,
        customerPhone: fromPhone,
        role: 'worker'
      };

      sessionStates[fromPhone].state = 'confirmed';
      await sendMessage(workerPhone, workerNotification, isSimulator);

    } else if (replyText === 'NO') {
      const bookingId = activeSession.bookingId;
      await db.run("UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);
      const cancelReply = "Aapki booking cancel kar di gayi hai. Agla order lagane k liye apna kaam likh kar send karen. Shukriya!";
      await sendMessage(fromPhone, cancelReply, isSimulator);
      delete sessionStates[fromPhone];

    } else {
      const retryReply = "Booking confirm karne k liye sirf *YES* likhen, ya cancel karne k liye *NO* likhen.";
      await sendMessage(fromPhone, retryReply, isSimulator);
    }

  } else if (activeSession.state === 'confirmed' || activeSession.state === 'in_progress') {
    const reply = "Aapka order confirm ho chuka hai aur Ustaad jald rabta krega. Shukriya!";
    await sendMessage(fromPhone, reply, isSimulator);
  }
}

async function handleWorkerMessage(workerPhone, messageText, session, isSimulator) {
  const replyText = messageText.trim().toUpperCase();
  const bookingId = session.bookingId;
  const customerPhone = session.customerPhone;

  if (session.state === 'worker_notified') {
    if (replyText === 'START') {
      await db.run("UPDATE bookings SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);
      sessionStates[workerPhone].state = 'worker_active';
      if (sessionStates[customerPhone]) sessionStates[customerPhone].state = 'in_progress';
      await sendMessage(workerPhone, `Order shuru ho chuka hai. Kaam mukammal hone par *COMPLETE* reply karen. Shukriya!`, isSimulator);
      await sendMessage(customerPhone, `Ustaad ne kaam shuru kar dia he. Mukammal hone pr aapko receipt mil jaye gi.`, isSimulator);
    } else {
      await sendMessage(workerPhone, `Kaam shuru karne k liye *START* likh kar reply karen.`, isSimulator);
    }
  } else if (session.state === 'worker_active') {
    if (replyText === 'COMPLETE') {
      const booking = await db.get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      const worker = await db.get('SELECT * FROM workers WHERE id = ?', [booking.worker_id]);

      await db.run("UPDATE bookings SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [bookingId]);
      await db.run("UPDATE workers SET status = 'available', completed_jobs = completed_jobs + 1 WHERE id = ?", [worker.id]);

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
        `Hamari service istemal karne ka shukriya! ⭐⭐⭐⭐⭐`;

      await sendMessage(customerPhone, receiptMsg, isSimulator);
      await sendMessage(workerPhone, `Shukriya Ustaad! Job completed. Aap ab doosri booking k liye available hain.`, isSimulator);

      delete sessionStates[customerPhone];
      delete sessionStates[workerPhone];
    } else {
      await sendMessage(workerPhone, `Kaam mukammal hone par *COMPLETE* likh kar reply karen.`, isSimulator);
    }
  }
}

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

  const receiptMsg = `--- 🧾 UstaadConnect AI Receipt ---\n\n` +
    `*Order ID*: UC-B00${bookingId}\n` +
    `*Date*: ${new Date().toLocaleDateString()}\n` +
    `*Ustaad*: ${worker ? worker.name : 'Unknown'} (${booking.service_type.replace('_', ' ')})\n` +
    `*Service*: ${booking.service_type.toUpperCase()}\n` +
    `*Location*: ${booking.location}\n\n` +
    `-------------------------------\n` +
    `*Service Charge*: Rs. ${booking.estimated_price}\n` +
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
