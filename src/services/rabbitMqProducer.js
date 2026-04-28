const amqp = require("amqplib");

const publishBookingCreated = async ({ bookingId, userId, items }) => {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();

  const queue = process.env.BOOKING_CREATED_QUEUE || "booking.created";

  await channel.assertQueue(queue, {
    durable: true,
  });

  const message = {
    bookingId,
    userId,
    items: items.map((item) => ({
      eventId: item.event_id,
      ticketTypeId: item.ticket_type_id,
      quantity: item.quantity,
    })),
  };

  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });

  console.log("[RabbitMQ] Published booking.created:", message);

  await channel.close();
  await connection.close();
};

module.exports = { publishBookingCreated };