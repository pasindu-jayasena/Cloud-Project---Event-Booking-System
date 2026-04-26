const { ServiceBusClient } = require('@azure/service-bus');
const { getClient } = require('../config/db');
const { sendBookingConfirmed } = require('./queueProducer');

let receiver = null;

const processPaymentResult = async (messageBody) => {
  const { messageId, eventType, bookingId, paymentId, status, reason, amount } = messageBody;
  console.log(`[QueueConsumer] Processing ${eventType} for booking ${bookingId}`);

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Check for duplicate message
    const dupCheck = await client.query(
      'SELECT id FROM processed_messages WHERE message_id = $1',
      [messageId]
    );

    if (dupCheck.rows.length > 0) {
      console.warn(`[QueueConsumer] Duplicate message ${messageId} — skipping`);
      await client.query('COMMIT');
      return;
    }

    // Get current booking
    const bookingResult = await client.query(
      'SELECT id, status, user_id FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      console.error(`[QueueConsumer] Booking ${bookingId} not found`);
      await client.query('COMMIT');
      return;
    }

    const booking = bookingResult.rows[0];
    const oldStatus = booking.status;

    if (eventType === 'PAYMENT_SUCCESS') {
      // Update booking to CONFIRMED
      await client.query(
        `UPDATE bookings SET status = 'CONFIRMED', payment_id = $1, updated_at = NOW() WHERE id = $2`,
        [paymentId, bookingId]
      );

      // Log status change
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
         VALUES ($1, $2, 'CONFIRMED', 'Payment successful')`,
        [bookingId, oldStatus]
      );

      // Record processed message
      await client.query(
        `INSERT INTO processed_messages (message_id, event_type, booking_id) VALUES ($1, $2, $3)`,
        [messageId, eventType, bookingId]
      );

      await client.query('COMMIT');
      console.log(`[QueueConsumer] Booking ${bookingId} CONFIRMED`);

      // Publish BOOKING_CONFIRMED to booking-confirmed-queue
      try {
        const items = await require('../config/db').query(
          'SELECT * FROM booking_items WHERE booking_id = $1', [bookingId]
        );
        if (items.rows.length > 0) {
          const firstItem = items.rows[0];
          await sendBookingConfirmed({
            bookingId,
            userId: booking.user_id,
            eventId: firstItem.event_id,
            ticketTypeId: firstItem.ticket_type_id,
            quantity: firstItem.quantity
          });
        }
      } catch (pubErr) {
        console.error('[QueueConsumer] Failed to publish BOOKING_CONFIRMED:', pubErr.message);
      }

    } else if (eventType === 'PAYMENT_FAILED') {
      // Update booking to PAYMENT_FAILED
      await client.query(
        `UPDATE bookings SET status = 'PAYMENT_FAILED', payment_id = $1, updated_at = NOW() WHERE id = $2`,
        [paymentId, bookingId]
      );

      // Log status change
      await client.query(
        `INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
         VALUES ($1, $2, 'PAYMENT_FAILED', $3)`,
        [bookingId, oldStatus, reason || 'Payment failed']
      );

      // Record processed message
      await client.query(
        `INSERT INTO processed_messages (message_id, event_type, booking_id) VALUES ($1, $2, $3)`,
        [messageId, eventType, bookingId]
      );

      await client.query('COMMIT');
      console.log(`[QueueConsumer] Booking ${bookingId} PAYMENT_FAILED`);
    } else {
      console.warn(`[QueueConsumer] Unknown event type: ${eventType}`);
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[QueueConsumer] Error processing message:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

const startConsumer = async () => {
  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  const queueName = process.env.PAYMENT_RESULT_QUEUE_NAME || 'payment-result-queue';

  if (!connectionString) {
    console.warn('[QueueConsumer] SERVICE_BUS_CONNECTION_STRING not set — consumer not started');
    return;
  }

  const sbClient = new ServiceBusClient(connectionString);
  receiver = sbClient.createReceiver(queueName);

  const messageHandler = async (message) => {
    console.log(`[QueueConsumer] Received message from ${queueName}:`, JSON.stringify(message.body));
    try {
      await processPaymentResult(message.body);
    } catch (err) {
      console.error('[QueueConsumer] Failed to process message:', err.message);
    }
  };

  const errorHandler = async (error) => {
    console.error('[QueueConsumer] Error:', error.message);
  };

  receiver.subscribe({ processMessage: messageHandler, processError: errorHandler });
  console.log(`[QueueConsumer] Listening on queue: ${queueName}`);
};

const stopConsumer = async () => {
  if (receiver) {
    await receiver.close();
    console.log('[QueueConsumer] Consumer stopped');
  }
};

module.exports = { startConsumer, stopConsumer, processPaymentResult };
