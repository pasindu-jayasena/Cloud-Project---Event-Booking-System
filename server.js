const app = require('./src/app');
const { pool } = require('./src/config/db');
const { startConsumer } = require('./src/services/queueConsumer');

const PORT = process.env.PORT || 5001;

// Start the Express server
app.listen(PORT, async () => {
  console.log(`========================================`);
  console.log(`  Booking Service running on port ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`========================================`);

  // Test database connection on startup
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`[DB] PostgreSQL connected successfully at ${result.rows[0].now}`);
  } catch (err) {
    console.error('[DB] PostgreSQL connection failed:', err.message);
  }

  // Start the Azure Service Bus queue consumer
  try {
    if (process.env.SERVICE_BUS_CONNECTION_STRING) {
      await startConsumer();
      console.log('[Queue] Payment result queue consumer started');
    } else {
      console.warn('[Queue] SERVICE_BUS_CONNECTION_STRING not set — queue consumer not started');
    }
  } catch (err) {
    console.error('[Queue] Failed to start queue consumer:', err.message);
  }
});
