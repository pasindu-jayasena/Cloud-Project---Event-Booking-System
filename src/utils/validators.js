// Validate the request body for creating a booking
const validateBookingRequest = (body) => {
  const errors = [];

  if (!body.userId || !Number.isInteger(body.userId) || body.userId <= 0) {
    errors.push('userId is required and must be a positive integer');
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('items is required and must be a non-empty array');
  } else {
    body.items.forEach((item, index) => {
      if (!item.eventId || !Number.isInteger(item.eventId) || item.eventId <= 0) {
        errors.push(`items[${index}].eventId is required and must be a positive integer`);
      }
      if (!item.ticketTypeId || !Number.isInteger(item.ticketTypeId) || item.ticketTypeId <= 0) {
        errors.push(`items[${index}].ticketTypeId is required and must be a positive integer`);
      }
      if (!item.ticketName || typeof item.ticketName !== 'string' || item.ticketName.trim() === '') {
        errors.push(`items[${index}].ticketName is required and must be a non-empty string`);
      }
      if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        errors.push(`items[${index}].quantity is required and must be a positive integer`);
      }
      if (item.unitPrice === undefined || item.unitPrice === null || typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
        errors.push(`items[${index}].unitPrice is required and must be a non-negative number`);
      }
    });
  }

  return errors;
};

// Validate the request body for reservation
const validateReservationRequest = (body) => {
  const errors = [];

  if (!body.userId || !Number.isInteger(body.userId) || body.userId <= 0) {
    errors.push('userId is required and must be a positive integer');
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('items is required and must be a non-empty array');
  } else {
    body.items.forEach((item, index) => {
      if (!item.eventId || !Number.isInteger(item.eventId) || item.eventId <= 0) {
        errors.push(`items[${index}].eventId is required and must be a positive integer`);
      }
      if (!item.ticketTypeId || !Number.isInteger(item.ticketTypeId) || item.ticketTypeId <= 0) {
        errors.push(`items[${index}].ticketTypeId is required and must be a positive integer`);
      }
      if (!item.ticketName || typeof item.ticketName !== 'string' || item.ticketName.trim() === '') {
        errors.push(`items[${index}].ticketName is required and must be a non-empty string`);
      }
      if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        errors.push(`items[${index}].quantity is required and must be a positive integer`);
      }
      if (item.unitPrice === undefined || item.unitPrice === null || typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
        errors.push(`items[${index}].unitPrice is required and must be a non-negative number`);
      }
    });
  }

  return errors;
};

// Validate status update request
const validateStatusUpdate = (body) => {
  const errors = [];
  const validStatuses = ['PENDING', 'RESERVED', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'PAYMENT_FAILED'];

  if (!body.status || !validStatuses.includes(body.status)) {
    errors.push(`status is required and must be one of: ${validStatuses.join(', ')}`);
  }

  return errors;
};

// Validate ID parameter
const validateId = (id) => {
  const parsed = parseInt(id, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

module.exports = {
  validateBookingRequest,
  validateReservationRequest,
  validateStatusUpdate,
  validateId
};
