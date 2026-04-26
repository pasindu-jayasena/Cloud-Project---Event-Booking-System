const express = require('express');
const router = express.Router();
const {
  createBooking,
  getAllBookings,
  getBookingById,
  getBookingsByUserId,
  cancelBooking,
  updateBookingStatus,
  createReservation,
  getBookingStatus,
  confirmReservation,
  expireBooking
} = require('../controllers/bookingController');

// Booking CRUD routes
router.post('/', createBooking);
router.get('/', getAllBookings);

// Reservation routes (must be before /:id routes to avoid conflict)
router.post('/reserve', createReservation);

// User bookings
router.get('/user/:userId', getBookingsByUserId);

// Single booking routes
router.get('/:id', getBookingById);
router.put('/:id/cancel', cancelBooking);
router.put('/:id/status', updateBookingStatus);

// Reservation action routes
router.get('/:id/status', getBookingStatus);
router.post('/:id/confirm', confirmReservation);
router.post('/:id/expire', expireBooking);

module.exports = router;
