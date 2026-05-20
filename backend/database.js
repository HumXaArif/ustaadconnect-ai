const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper function to run SQL queries with Promises
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// Helper function to query multiple rows
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper function to query a single row
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Initialize database schema
async function initDatabase() {
  try {
    // 1. Create Workers Table
    await run(`
      CREATE TABLE IF NOT EXISTS workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        skill TEXT NOT NULL,
        location TEXT NOT NULL,
        rating REAL DEFAULT 5.0,
        status TEXT DEFAULT 'available',
        completed_jobs INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create Bookings Table
    await run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_phone TEXT NOT NULL,
        customer_name TEXT,
        raw_message TEXT NOT NULL,
        service_type TEXT,
        location TEXT,
        urgency TEXT DEFAULT 'medium',
        estimated_price INTEGER,
        worker_id INTEGER,
        status TEXT DEFAULT 'pending_match',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (worker_id) REFERENCES workers(id)
      )
    `);

    // 3. Create Messages Table for chat history
    await run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER,
        sender TEXT NOT NULL,
        phone TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id)
      )
    `);

    console.log('Database tables verified/created successfully.');

    // Seed Workers if none exist
    const workersCount = await get('SELECT COUNT(*) as count FROM workers');
    if (workersCount.count === 0) {
      console.log('Seeding workers table...');
      const seedWorkers = [
        // Plumbers
        { name: 'Tariq Mahmood', phone: '+923001234561', skill: 'plumber', location: 'Gulberg', rating: 4.8, status: 'available', completed_jobs: 14 },
        { name: 'Sajid Khan', phone: '+923129876541', skill: 'plumber', location: 'DHA', rating: 4.9, status: 'available', completed_jobs: 32 },
        { name: 'Muhammad Ali', phone: '+923214567891', skill: 'plumber', location: 'Bahria Town', rating: 4.6, status: 'available', completed_jobs: 8 },
        // Electricians
        { name: 'Kamran Butt', phone: '+923331112221', skill: 'electrician', location: 'Gulberg', rating: 4.7, status: 'available', completed_jobs: 21 },
        { name: 'Farhan Shah', phone: '+923005556661', skill: 'electrician', location: 'Clifton', rating: 4.9, status: 'available', completed_jobs: 45 },
        { name: 'Asif Raza', phone: '+923157778881', skill: 'electrician', location: 'Saddar', rating: 4.5, status: 'available', completed_jobs: 6 },
        // AC Technicians
        { name: 'Waseem Akram', phone: '+923004445551', skill: 'ac_technician', location: 'Gulberg', rating: 4.9, status: 'available', completed_jobs: 50 },
        { name: 'Nadeem Iqbal', phone: '+923223334441', skill: 'ac_technician', location: 'DHA', rating: 4.7, status: 'available', completed_jobs: 19 },
        { name: 'Zeeshan Ahmed', phone: '+923112223331', skill: 'ac_technician', location: 'Bahria Town', rating: 4.8, status: 'available', completed_jobs: 27 },
        // Mechanics
        { name: 'Khalid Malik', phone: '+923456789011', skill: 'mechanic', location: 'Saddar', rating: 4.6, status: 'available', completed_jobs: 11 },
        { name: 'Junaid Jamshed', phone: '+923012345671', skill: 'mechanic', location: 'Clifton', rating: 4.9, status: 'available', completed_jobs: 38 },
        // Cleaners
        { name: 'Bilal Hassan', phone: '+923008889991', skill: 'cleaner', location: 'DHA', rating: 4.7, status: 'available', completed_jobs: 23 },
        { name: 'Yasir Arafat', phone: '+923334445552', skill: 'cleaner', location: 'Gulberg', rating: 4.5, status: 'available', completed_jobs: 5 }
      ];

      for (const w of seedWorkers) {
        await run(
          'INSERT INTO workers (name, phone, skill, location, rating, status, completed_jobs) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [w.name, w.phone, w.skill, w.location, w.rating, w.status, w.completed_jobs]
        );
      }
      console.log('Successfully seeded workers table.');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

module.exports = {
  db,
  run,
  all,
  get,
  initDatabase
};
