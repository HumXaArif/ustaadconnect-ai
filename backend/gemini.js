const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API if key is available
const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn('GEMINI_API_KEY not found or default. Running Gemini in FALLBACK/SIMULATION mode.');
}

/**
 * Basic keyword matching fallback for Roman Urdu parsing.
 * Used if Gemini API key is missing or API call fails.
 */
function fallbackParseMessage(message) {
  const msgLower = message.toLowerCase();
  
  // 1. Detect service type
  let service_type = 'unknown';
  if (/\b(ac|air conditioner|split|compressor|thandi|cool|garm|gas)\b/.test(msgLower)) {
    service_type = 'ac_technician';
  } else if (/\b(pipe|leak|sink|pani|water|tap|nal|plumber|flush|drain|sewer)\b/.test(msgLower)) {
    service_type = 'plumber';
  } else if (/\b(bijli|light|fan|board|switch|wire|short|electrician|current|socket|bulb)\b/.test(msgLower)) {
    service_type = 'electrician';
  } else if (/\b(clean|safai|dusting|carpet|room|ghar|dhona|mop|sweeper)\b/.test(msgLower)) {
    service_type = 'cleaner';
  } else if (/\b(car|bike|motorcycle|gari|engine|break|tuning|mechanic|tyre|punct)\b/.test(msgLower)) {
    service_type = 'mechanic';
  }

  // 2. Detect location
  let location = null;
  const locations = ['gulberg', 'dha', 'bahria town', 'clifton', 'saddar', 'johar town', 'cantt', 'model town', 'karsaz', 'askari'];
  for (const loc of locations) {
    if (msgLower.includes(loc)) {
      // Capitalize location nicely
      location = loc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }
  // Default to Gulberg if no location matched
  if (!location) {
    location = 'Gulberg';
  }

  // 3. Detect urgency
  let urgency = 'medium';
  if (/\b(urgent|emergency|jaldi|fauri|abhi|fauran|jaldi se|quick|fast)\b/.test(msgLower)) {
    urgency = 'high';
  } else if (/\b(kal|parso|weekend|relax|baad me|later|tomorrow)\b/.test(msgLower)) {
    urgency = 'low';
  }

  // 4. Try to extract name
  let customer_name = null;
  const nameMatch = msgLower.match(/\b(?:naam|name)\s+(?:hai|is)?\s*([a-z]+)/);
  if (nameMatch && nameMatch[1]) {
    customer_name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
  }

  return {
    service_type,
    location,
    urgency,
    customer_name,
    is_fallback: true
  };
}

/**
 * Uses Gemini AI to parse a Roman Urdu booking message.
 * Extracts service_type, location, urgency, and optional customer_name.
 */
async function parseBookingMessage(message) {
  if (!genAI) {
    return fallbackParseMessage(message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const systemPrompt = `
      You are an advanced classification AI for UstaadConnect AI, a service booking platform in Pakistan.
      Analyze the incoming message (which is typically written in Roman Urdu, English, or standard Urdu) and extract booking details.
      
      Respond ONLY with a valid JSON object. Do not include markdown code block syntax (like \`\`\`json) in your final output, just raw JSON.
      
      The JSON object must contain exactly these keys:
      {
        "service_type": "plumber" | "electrician" | "ac_technician" | "mechanic" | "cleaner" | "unknown",
        "location": string (Extract the neighborhood/area like "DHA", "Gulberg", "Bahria Town", "Clifton", "Saddar", etc. If unknown, guess based on Pakistani contexts or return "Gulberg" as default),
        "urgency": "high" | "medium" | "low" (Classify based on words like 'jaldi', 'urgent', 'leakage', 'emergency', 'shik short' -> high. Scheduled for tomorrow, 'kal', 'parso' -> low. Regular requests -> medium),
        "customer_name": string or null (Extract name if they introduce themselves, e.g. "Mera naam Bilal hai" -> "Bilal", otherwise null)
      }

      Examples:
      1. "bhai ac ka masla ha garmi me thandi hawa ni de rha, gulberg me ho ap?"
         Response: {"service_type": "ac_technician", "location": "Gulberg", "urgency": "high", "customer_name": null}
      2. "Asalam o alaikum, pipe leak kr rha he washroom ka pani nikal rha. DHA phase 6 me plumber bhej skty hain? Mera naam Usman he."
         Response: {"service_type": "plumber", "location": "DHA", "urgency": "high", "customer_name": "Usman"}
      3. "ghar ki safai krwani he parso, time mile tou btaye ga"
         Response: {"service_type": "cleaner", "location": "Gulberg", "urgency": "low", "customer_name": null}
    `;

    const prompt = `
      System guidelines: ${systemPrompt}
      
      Analyze this user message: "${message}"
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Strip markdown formatting if Gemini included it
    let cleanText = responseText;
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/```$/, '');
    }
    
    const data = JSON.parse(cleanText.trim());
    return {
      service_type: data.service_type || 'unknown',
      location: data.location || 'Gulberg',
      urgency: data.urgency || 'medium',
      customer_name: data.customer_name || null,
      is_fallback: false
    };
  } catch (error) {
    console.error('Error with Gemini API, falling back to regex parser:', error);
    return fallbackParseMessage(message);
  }
}

module.exports = {
  parseBookingMessage
};
