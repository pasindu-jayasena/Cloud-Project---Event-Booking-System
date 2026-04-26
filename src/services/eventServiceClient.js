const axios = require('axios');

const EVENT_SERVICE_BASE_URL = process.env.EVENT_SERVICE_BASE_URL || 'http://localhost:5001';

// Create an axios instance for Event Service
const eventServiceApi = axios.create({
  baseURL: EVENT_SERVICE_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Check ticket availability from Event Service
const checkTicketAvailability = async (eventId, ticketTypeId, quantity) => {
  try {
    console.log(`[EventService] Checking availability — Event: ${eventId}, TicketType: ${ticketTypeId}, Qty: ${quantity}`);
    const response = await eventServiceApi.get(`/api/events/${eventId}/tickets/${ticketTypeId}`);

    if (response.data && response.data.availableQuantity !== undefined) {
      const available = response.data.availableQuantity >= quantity;
      console.log(`[EventService] Available: ${response.data.availableQuantity}, Requested: ${quantity}, Result: ${available ? 'OK' : 'INSUFFICIENT'}`);
      return {
        available,
        availableQuantity: response.data.availableQuantity
      };
    }

    // If the Event Service response format is different, assume available
    console.warn('[EventService] Unexpected response format, assuming available');
    return { available: true, availableQuantity: null };
  } catch (err) {
    // If Event Service is unreachable, log warning but allow booking to proceed
    // This ensures Booking Service works independently during development
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.warn(`[EventService] Service unreachable at ${EVENT_SERVICE_BASE_URL} — proceeding without availability check`);
      return { available: true, availableQuantity: null };
    }

    if (err.response && err.response.status === 404) {
      console.warn(`[EventService] Event ${eventId} or TicketType ${ticketTypeId} not found`);
      return { available: false, availableQuantity: 0 };
    }

    console.error('[EventService] Error checking availability:', err.message);
    // Allow booking to proceed even if Event Service has errors
    return { available: true, availableQuantity: null };
  }
};

module.exports = { checkTicketAvailability };
