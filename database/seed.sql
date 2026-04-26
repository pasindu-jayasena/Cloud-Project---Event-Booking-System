-- =============================================
-- Booking Service Seed Data
-- Use this to insert sample data for testing
-- =============================================

-- Sample Booking 1: Confirmed booking
INSERT INTO bookings (user_id, total_amount, status, payment_id, created_at, updated_at)
VALUES (1, 6000.00, 'CONFIRMED', 'PAY-10001', NOW(), NOW());

INSERT INTO booking_items (booking_id, event_id, ticket_type_id, ticket_name, quantity, unit_price, subtotal)
VALUES (1, 1, 1, 'VIP Ticket - Music Festival', 2, 3000.00, 6000.00);

INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
VALUES
(1, NULL, 'PAYMENT_PENDING', 'Booking created'),
(1, 'PAYMENT_PENDING', 'CONFIRMED', 'Payment successful');

-- Sample Booking 2: Pending payment booking
INSERT INTO bookings (user_id, total_amount, status, created_at, updated_at)
VALUES (2, 4500.00, 'PAYMENT_PENDING', NOW(), NOW());

INSERT INTO booking_items (booking_id, event_id, ticket_type_id, ticket_name, quantity, unit_price, subtotal)
VALUES
(2, 2, 1, 'General Admission - Tech Conference', 1, 1500.00, 1500.00),
(2, 2, 2, 'Workshop Pass - Tech Conference', 1, 3000.00, 3000.00);

INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
VALUES (2, NULL, 'PAYMENT_PENDING', 'Booking created');

-- Sample Booking 3: Cancelled booking
INSERT INTO bookings (user_id, total_amount, status, created_at, updated_at)
VALUES (1, 2500.00, 'CANCELLED', NOW(), NOW());

INSERT INTO booking_items (booking_id, event_id, ticket_type_id, ticket_name, quantity, unit_price, subtotal)
VALUES (3, 3, 1, 'Standard Ticket - Art Exhibition', 5, 500.00, 2500.00);

INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
VALUES
(3, NULL, 'PAYMENT_PENDING', 'Booking created'),
(3, 'PAYMENT_PENDING', 'CANCELLED', 'Cancelled by user');

-- Sample Booking 4: Reserved booking (with expiry)
INSERT INTO bookings (user_id, total_amount, status, expires_at, created_at, updated_at)
VALUES (3, 8000.00, 'RESERVED', NOW() + INTERVAL '10 minutes', NOW(), NOW());

INSERT INTO booking_items (booking_id, event_id, ticket_type_id, ticket_name, quantity, unit_price, subtotal)
VALUES (4, 1, 2, 'VVIP Ticket - Music Festival', 2, 4000.00, 8000.00);

INSERT INTO booking_status_logs (booking_id, old_status, new_status, reason)
VALUES (4, NULL, 'RESERVED', 'Reservation created');

-- =============================================
-- Verify seed data
-- =============================================
SELECT 'Bookings:' AS info, COUNT(*) AS count FROM bookings
UNION ALL
SELECT 'Booking Items:', COUNT(*) FROM booking_items
UNION ALL
SELECT 'Status Logs:', COUNT(*) FROM booking_status_logs;
