const { query, getClient } = require('../config/db');
const { validateBookingRequest, validateReservationRequest, validateStatusUpdate, validateId } = require('../utils/validators');
const { checkTicketAvailability } = require('../services/eventServiceClient');
const { sendPaymentRequest } = require('../services/queueProducer');

// POST /api/bookings — Create a new booking
const createBooking = async (req, res, next) => {
  try {
    const errors = validateBookingRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const { userId, items } = req.body;

    // Optional: check availability with Event Service
    for (const item of items) {
      const availability = await checkTicketAvailability(item.eventId, item.ticketTypeId, item.quantity);
      if (!availability.available) {
        return res.status(409).json({
          success: false,
          message: `Insufficient tickets for event ${item.eventId}, ticket type ${item.ticketTypeId}. Available: ${availability.availableQuantity}`
        });
      }
    }

    // Calculate totals
    const processedItems = items.map(item => ({
      ...item,
      subtotal: item.quantity * item.unitPrice
    }));
    const totalAmount = processedItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Begin transaction
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Insert booking
      const bookingResult = await client.query(
        `INSERT INTO bookings (user_id, total_amount, status)
         VALUES ($1, $2, 'PAYMENT_PENDING')
         RETURNING *`,
        [userId, totalAmount]
      );
      const booking = bookingResult.rows[0];

      // Insert booking items
      const insertedItems = [];
      for (const item of processedItems) {
        const itemResult = await client.query(
          `INSERT INTO booking_items (booking_id, event_id, ticket_type_id, ticket_name, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [booking.id, item.eventId, item.ticketTypeId, item.ticketName, item.quantity, item.unitPrice, item.subtotal]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      // Log status change
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
         VALUES ($1, NULL, 'PAYMENT_PENDING', 'Booking created')`,
        [booking.id]
      );

      await client.query('COMMIT');
      console.log(`[Booking] Created booking ${booking.id} for user ${userId}, total: ${totalAmount}`);

      // Send payment request to queue
      try {
        await sendPaymentRequest({
          bookingId: booking.id,
          userId,
          totalAmount,
          items: insertedItems
        });
      } catch (queueErr) {
        console.error('[Booking] Failed to send payment request to queue:', queueErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: { ...booking, items: insertedItems }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings — Get all bookings
const getAllBookings = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, json_agg(
        json_build_object(
          'id', bi.id, 'event_id', bi.event_id, 'ticket_type_id', bi.ticket_type_id,
          'ticket_name', bi.ticket_name, 'quantity', bi.quantity,
          'unit_price', bi.unit_price, 'subtotal', bi.subtotal
        )
      ) AS items
      FROM bookings b
      LEFT JOIN booking_items bi ON b.id = bi.booking_id
      GROUP BY b.id
      ORDER BY b.created_at DESC`
    );
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/:id — Get a single booking
const getBookingById = async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid booking ID' });

    const bookingResult = await query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const itemsResult = await query('SELECT * FROM booking_items WHERE booking_id = $1', [id]);
    const logsResult = await query('SELECT * FROM booking_status_logs WHERE booking_id = $1 ORDER BY created_at ASC', [id]);

    res.status(200).json({
      success: true,
      data: { ...bookingResult.rows[0], items: itemsResult.rows, statusLogs: logsResult.rows }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/user/:userId — Get bookings by user
const getBookingsByUserId = async (req, res, next) => {
  try {
    const userId = validateId(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const result = await query(
      `SELECT b.*, json_agg(
        json_build_object(
          'id', bi.id, 'event_id', bi.event_id, 'ticket_type_id', bi.ticket_type_id,
          'ticket_name', bi.ticket_name, 'quantity', bi.quantity,
          'unit_price', bi.unit_price, 'subtotal', bi.subtotal
        )
      ) AS items
      FROM bookings b
      LEFT JOIN booking_items bi ON b.id = bi.booking_id
      WHERE b.user_id = $1
      GROUP BY b.id
      ORDER BY b.created_at DESC`,
      [userId]
    );
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// PUT /api/bookings/:id/cancel — Cancel a booking
const cancelBooking = async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid booking ID' });

    const bookingResult = await query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    const cancellableStatuses = ['PENDING', 'RESERVED', 'CONFIRMED'];
    if (!cancellableStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status ${booking.status}`
      });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bookings SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
         VALUES ($1, $2, 'CANCELLED', $3)`,
        [id, booking.status, req.body.reason || 'Cancelled by user']
      );
      await client.query('COMMIT');

      const updated = await query('SELECT * FROM bookings WHERE id = $1', [id]);
      console.log(`[Booking] Booking ${id} cancelled`);
      res.status(200).json({ success: true, message: 'Booking cancelled', data: updated.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// PUT /api/bookings/:id/status — Update booking status
const updateBookingStatus = async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid booking ID' });

    const errors = validateStatusUpdate(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const bookingResult = await query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const oldStatus = bookingResult.rows[0].status;
    const { status, reason } = req.body;

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id]
      );
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
         VALUES ($1, $2, $3, $4)`,
        [id, oldStatus, status, reason || 'Status updated manually']
      );
      await client.query('COMMIT');

      const updated = await query('SELECT * FROM bookings WHERE id = $1', [id]);
      console.log(`[Booking] Booking ${id} status: ${oldStatus} → ${status}`);
      res.status(200).json({ success: true, message: 'Status updated', data: updated.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// POST /api/bookings/reserve — Create a temporary reservation
const createReservation = async (req, res, next) => {
  try {
    const errors = validateReservationRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const { userId, items } = req.body;
    const expiryMinutes = parseInt(process.env.BOOKING_EXPIRY_MINUTES, 10) || 10;

    const processedItems = items.map(item => ({
      ...item,
      subtotal: item.quantity * item.unitPrice
    }));
    const totalAmount = processedItems.reduce((sum, item) => sum + item.subtotal, 0);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const bookingResult = await client.query(
        `INSERT INTO bookings (user_id, total_amount, status, expires_at)
         VALUES ($1, $2, 'RESERVED', NOW() + INTERVAL '${expiryMinutes} minutes')
         RETURNING *`,
        [userId, totalAmount]
      );
      const booking = bookingResult.rows[0];

      const insertedItems = [];
      for (const item of processedItems) {
        const itemResult = await client.query(
          `INSERT INTO booking_items (booking_id, event_id, ticket_type_id, ticket_name, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [booking.id, item.eventId, item.ticketTypeId, item.ticketName, item.quantity, item.unitPrice, item.subtotal]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      await client.query(
        `INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
         VALUES ($1, NULL, 'RESERVED', 'Reservation created')`,
        [booking.id]
      );

      await client.query('COMMIT');
      console.log(`[Booking] Reservation ${booking.id} created, expires in ${expiryMinutes} minutes`);

      res.status(201).json({
        success: true,
        message: 'Reservation created successfully',
        data: { ...booking, items: insertedItems }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/:id/status — Get booking status
const getBookingStatus = async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid booking ID' });

    const result = await query('SELECT id, status, expires_at, updated_at FROM bookings WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/bookings/:id/confirm — Confirm reservation and trigger payment
const confirmReservation = async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid booking ID' });

    const bookingResult = await query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    if (booking.status !== 'RESERVED') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm booking with status ${booking.status}. Must be RESERVED.`
      });
    }

    // Check if reservation has expired
    if (booking.expires_at && new Date(booking.expires_at) < new Date()) {
      await query(`UPDATE bookings SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`, [id]);
      return res.status(400).json({ success: false, message: 'Reservation has expired' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bookings SET status = 'PAYMENT_PENDING', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
         VALUES ($1, 'RESERVED', 'PAYMENT_PENDING', 'Reservation confirmed, payment initiated')`,
        [id]
      );
      await client.query('COMMIT');

      // Get items and send payment request
      const itemsResult = await query('SELECT * FROM booking_items WHERE booking_id = $1', [id]);
      try {
        await sendPaymentRequest({
          bookingId: booking.id,
          userId: booking.user_id,
          totalAmount: parseFloat(booking.total_amount),
          items: itemsResult.rows
        });
      } catch (queueErr) {
        console.error('[Booking] Failed to send payment request:', queueErr.message);
      }

      const updated = await query('SELECT * FROM bookings WHERE id = $1', [id]);
      console.log(`[Booking] Reservation ${id} confirmed, payment requested`);
      res.status(200).json({
        success: true,
        message: 'Reservation confirmed, payment initiated',
        data: { ...updated.rows[0], items: itemsResult.rows }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

// POST /api/bookings/:id/expire — Expire a reservation
const expireBooking = async (req, res, next) => {
  try {
    const id = validateId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid booking ID' });

    const bookingResult = await query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    if (booking.status !== 'RESERVED') {
      return res.status(400).json({
        success: false,
        message: `Cannot expire booking with status ${booking.status}. Must be RESERVED.`
      });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bookings SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
         VALUES ($1, 'RESERVED', 'EXPIRED', $2)`,
        [id, req.body.reason || 'Reservation expired']
      );
      await client.query('COMMIT');

      const updated = await query('SELECT * FROM bookings WHERE id = $1', [id]);
      console.log(`[Booking] Booking ${id} expired`);
      res.status(200).json({ success: true, message: 'Booking expired', data: updated.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
