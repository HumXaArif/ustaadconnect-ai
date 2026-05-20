const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function fallbackParseMessage(message) {
  const msgLower = message.toLowerCase();
  
  let service_type = 'unknown';
  if (/\b(ac|air conditioner|split|compressor|thandi|cool|garm|gas)\b/.test(msgLower)) {
    service_type = 'ac_technician';
  } else if (/\b(pipe|leak|sink|pani|water|tap|nal|plumber|flush|drain)\b/.test(msgLower)) {
    service_type = 'plumber';
  } else if (/\b(bijli|light|fan|board|switch|wire|short|electrician|current)\b/.test(msgLower)) {
    service_type = 'electrician';
  } else if (/\b(clean|safai|dusting|carpet|room|ghar|dhona|mop)\b/.test(msgLower)) {
    service_type = 'cleaner';
  } else if (/\b(car|bike|motorcycle|gari|engine|break|mechanic|tyre)\b/.test(msgLower)) {
    service_type = 'mechanic';
  }

  let location = 'Gulberg';
  const locations = ['gulberg', 'dha', 'bahria town', 'clifton', 'saddar', 'johar town', 'cantt', 'model town'];
  for (const loc of locations) {
    if (msgLower.includes(loc)) {
      location = loc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  let urgency = 'medium';
  if (/\b(urgent|emergency|jaldi|fauri|abhi|fauran)\b/.test(msgLower)) urgency = 'high';
  else if (/\b(kal|parso|weekend|baad me|later|tomorrow)\b/.test(msgLower)) urgency = 'low';

  return { service_type, location, urgency, customer_name: null, is_fallback: true };
}

async function parseBookingMessage(message) {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are a booking parser for UstaadConnect AI in Pakistan. Analyze this Roman Urdu/English message and return ONLY a JSON object with these fields:
- service_type: "plumber" | "electrician" | "ac_technician" | "mechanic" | "cleaner" | "unknown"
- location: area name like "DHA", "Gulberg", "Bahria Town" etc (default "Gulberg")
- urgency: "high" | "medium" | "low"
- customer_name: name if mentioned or null

Message: "${message}"

Return ONLY raw JSON, no markdown.`
      }]
    });

    const text = response.content[0].text.trim();
    const clean = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const data = JSON.parse(clean);
    
    return {
      service_type: data.service_type || 'unknown',
      location: data.location || 'Gulberg',
      urgency: data.urgency || 'medium',
      customer_name: data.customer_name || null,
      is_fallback: false
    };
  } catch (error) {
    console.error('Haiku API error, using fallback:', error.message);
    return fallbackParseMessage(message);
  }
}

module.exports = { parseBookingMessage };