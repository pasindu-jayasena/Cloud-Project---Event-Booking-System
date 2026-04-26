-- =============================================
-- Booking Service Database Schema
-- Database: booking_service_db
-- =============================================

-- Drop tables if they exist (for fresh setup)
DROP TABLE IF EXISTS processed_messages CASCADE;
DROP TABLE IF EXISTS booking_status_logs CASCADE;
DROP TABLE IF EXISTS booking_items CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;

-- =============================================
-- Table 1: bookings
-- Stores the main booking record
-- =============================================
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payment_id VARCHAR(100),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- Table 2: booking_items
-- Stores individual ticket items within a booking
-- =============================================
CREATE TABLE booking_items (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL,
    ticket_type_id INTEGER NOT NULL,
    ticket_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- Table 3: booking_status_logs
-- Tracks every status change for audit trail
-- =============================================
CREATE TABLE booking_status_logs (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- Table 4: processed_messages
-- Prevents duplicate message processing (idempotency)
-- =============================================
CREATE TABLE processed_messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    booking_id INTEGER NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_booking_items_booking_id ON booking_items(booking_id);
CREATE INDEX idx_booking_status_logs_booking_id ON booking_status_logs(booking_id);
CREATE INDEX idx_processed_messages_message_id ON processed_messages(message_id);
CREATE INDEX idx_processed_messages_booking_id ON processed_messages(booking_id);

-- =============================================
-- Verify tables created
-- =============================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
