const { ServiceBusClient } = require('@azure/service-bus');

let serviceBusClient = null;

const getServiceBusClient = () => {
  if (!serviceBusClient && process.env.SERVICE_BUS_CONNECTION_STRING) {
    serviceBusClient = new ServiceBusClient(process.env.SERVICE_BUS_CONNECTION_STRING);
    console.log('[QueueProducer] Service Bus client initialized');
  }
  return serviceBusClient;
};

const sendPaymentRequest = async (bookingData) => {
  const client = getServiceBusClient();
  if (!client) {
    console.warn('[QueueProducer] Service Bus not configured — skipping payment request');
    return null;
  }

  const queueName = process.env.PAYMENT_REQUEST_QUEUE_NAME || 'booking-payment-request-queue';
  const sender = client.createSender(queueName);

  try {
    const message = {
      body: {
        eventType: 'PAYMENT_REQUESTED',
        bookingId: bookingData.bookingId,
        userId: bookingData.userId,
        amount: bookingData.totalAmount,
        currency: 'LKR',
        items: bookingData.items.map(item => ({
          eventId: item.event_id || item.eventId,
          ticketTypeId: item.ticket_type_id || item.ticketTypeId,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price || item.unitPrice)
        }))
      },
      contentType: 'application/json',
      subject: 'PAYMENT_REQUESTED'
    };

    await sender.sendMessages(message);
    console.log(`[QueueProducer] PAYMENT_REQUESTED sent for booking ${bookingData.bookingId}`);
    return message.body;
  } catch (err) {
    console.error('[QueueProducer] Failed to send payment request:', err.message);
    throw err;
  } finally {
    await sender.close();
  }
};

const sendBookingConfirmed = async (bookingData) => {
  const client = getServiceBusClient();
  if (!client) {
    console.warn('[QueueProducer] Service Bus not configured — skipping booking confirmed');
    return null;
  }

  const queueName = process.env.BOOKING_CONFIRMED_QUEUE_NAME || 'booking-confirmed-queue';
  const sender = client.createSender(queueName);

  try {
    const message = {
      body: {
        eventType: 'BOOKING_CONFIRMED',
        bookingId: bookingData.bookingId,
        userId: bookingData.userId,
        eventId: bookingData.eventId,
        ticketTypeId: bookingData.ticketTypeId,
        quantity: bookingData.quantity,
        paymentStatus: 'SUCCESS'
      },
      contentType: 'application/json',
      subject: 'BOOKING_CONFIRMED'
    };

    await sender.sendMessages(message);
    console.log(`[QueueProducer] BOOKING_CONFIRMED sent for booking ${bookingData.bookingId}`);
    return message.body;
  } catch (err) {
    console.error('[QueueProducer] Failed to send booking confirmed:', err.message);
    throw err;
  } finally {
    await sender.close();
  }
};

module.exports = { sendPaymentRequest, sendBookingConfirmed };
