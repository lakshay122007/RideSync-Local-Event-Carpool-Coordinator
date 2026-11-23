-- =====================================================================
-- 04_queries.sql  |  RideSync (Local Event Carpool Coordinator)
-- Target: PostgreSQL 12+, schema in 03_schema.sql
--
-- Every SQL query the application runs, one statement per id.
--   R1..R20  = READ   (SELECT)
--   W1..W20  = WRITE  (INSERT / UPDATE / DELETE)
-- Placeholders $1, $2, ... are the parameters bound by node-postgres.
-- Statements that must run together in one transaction are marked TXN.
-- =====================================================================


-- =====================================================================
-- READ QUERIES
-- =====================================================================

-- R1 | READ | Login by email
-- Used by: POST /api/auth/login
-- Params: $1 email
SELECT id, name, email, password_hash
FROM users
WHERE email = $1;


-- R2 | READ | Current user by id
-- Used by: GET /api/auth/me
-- Params: $1 user id
SELECT id, name, email, avg_rating
FROM users
WHERE id = $1;


-- R3 | READ | List all pickup zones
-- Used by: GET /api/zones (zone dropdowns)
SELECT id, name
FROM zones
ORDER BY name;


-- R4 | READ | Zones adjacent to a zone
-- Used by: GET /api/zones/:id/nearby (tooltip "nearby areas")
-- Params: $1 zone id
SELECT z.id, z.name
FROM zone_adjacency za
JOIN zones z ON z.id = za.adjacent_zone_id
WHERE za.zone_id = $1
ORDER BY z.name;


-- R5 | READ | List events with open ride count and open seats, with filters
-- Used by: GET /api/events
-- Params: $1 category or NULL, $2 search text or NULL, $3 upcoming only (boolean)
SELECT e.id, e.name, e.event_date, e.location, e.category, e.is_recurring,
       COUNT(r.id)                       AS ride_count,
       COALESCE(SUM(r.seats_available), 0) AS open_seats
FROM events e
LEFT JOIN rides r ON r.event_id = e.id AND r.status IN ('open', 'full')
WHERE ($1::text IS NULL OR e.category = $1)
  AND ($2::text IS NULL OR e.name ILIKE '%' || $2 || '%')
  AND (NOT $3::boolean OR e.event_date >= NOW())
GROUP BY e.id
ORDER BY e.event_date;


-- R6 | READ | Event details with creator
-- Used by: GET /api/events/:id
-- Params: $1 event id
SELECT e.id, e.name, e.event_date, e.location, e.category, e.is_recurring,
       e.parent_event_id, e.created_by, u.name AS creator_name
FROM events e
JOIN users u ON u.id = e.created_by
WHERE e.id = $1;


-- R7 | READ | Seats filled vs available per ride (event page chart)
-- Used by: GET /api/events/:id/stats
-- Params: $1 event id
SELECT r.id AS ride_id, u.name AS driver_name, z.name AS zone_name,
       r.total_seats,
       r.total_seats - r.seats_available AS seats_filled,
       r.seats_available
FROM rides r
JOIN users u ON u.id = r.driver_id
JOIN zones z ON z.id = r.zone_id
WHERE r.event_id = $1
  AND r.status IN ('open', 'full', 'completed')
ORDER BY r.departure_time;


-- R8 | READ | Rides for an event, same zone first, then adjacent zones, then the rest
-- Used by: GET /api/events/:id/rides  (core zone-adjacency matching feature)
-- zone_rank: 0 = same zone, 1 = adjacent zone, 2 = other zone
-- cost_share = total_cost / (approved riders + the driver)
-- Params: $1 event id, $2 rider's zone id (NULL gives rank 2 for every ride)
SELECT r.id, r.departure_time, r.total_seats, r.seats_available, r.status,
       r.cost_split, r.total_cost,
       z.id AS zone_id, z.name AS zone_name,
       u.id AS driver_id, u.name AS driver_name, u.avg_rating,
       CASE
         WHEN r.zone_id = $2        THEN 0
         WHEN za.zone_id IS NOT NULL THEN 1
         ELSE 2
       END AS zone_rank,
       CASE WHEN r.cost_split
            THEN ROUND(r.total_cost / (COALESCE(a.approved_count, 0) + 1), 2)
       END AS cost_share
FROM rides r
JOIN zones z ON z.id = r.zone_id
JOIN users u ON u.id = r.driver_id
LEFT JOIN zone_adjacency za
       ON za.zone_id = $2 AND za.adjacent_zone_id = r.zone_id
LEFT JOIN (SELECT ride_id, COUNT(*) AS approved_count
           FROM ride_requests
           WHERE status = 'approved'
           GROUP BY ride_id) a ON a.ride_id = r.id
WHERE r.event_id = $1
  AND r.status IN ('open', 'full')
ORDER BY zone_rank, r.departure_time;


-- R9 | READ | Ride details with event, zone, driver and cost share
-- Used by: GET /api/rides/:id
-- Params: $1 ride id
SELECT r.id, r.event_id, r.driver_id, r.zone_id, r.departure_time,
       r.total_seats, r.seats_available, r.cost_split, r.total_cost, r.status,
       e.name AS event_name, e.event_date, e.location,
       z.name AS zone_name,
       d.name AS driver_name, d.avg_rating,
       COALESCE(a.approved_count, 0) AS approved_count,
       CASE WHEN r.cost_split
            THEN ROUND(r.total_cost / (COALESCE(a.approved_count, 0) + 1), 2)
       END AS cost_share
FROM rides r
JOIN events e ON e.id = r.event_id
JOIN zones  z ON z.id = r.zone_id
JOIN users  d ON d.id = r.driver_id
LEFT JOIN (SELECT ride_id, COUNT(*) AS approved_count
           FROM ride_requests
           WHERE status = 'approved'
           GROUP BY ride_id) a ON a.ride_id = r.id
WHERE r.id = $1;


-- R10 | READ | Approved riders of a ride
-- Used by: GET /api/rides/:id (riders list)
-- Params: $1 ride id
SELECT u.id, u.name, u.avg_rating
FROM ride_requests rq
JOIN users u ON u.id = rq.rider_id
WHERE rq.ride_id = $1
  AND rq.status = 'approved'
ORDER BY rq.created_at;


-- R11 | READ | All requests on a ride (driver review screen, pending first)
-- Used by: GET /api/rides/:id/requests
-- Params: $1 ride id, $2 driver id (only the driver may see the list)
SELECT rq.id, rq.status, rq.created_at,
       u.id AS rider_id, u.name AS rider_name, u.avg_rating
FROM ride_requests rq
JOIN rides r ON r.id = rq.ride_id
JOIN users u ON u.id = rq.rider_id
WHERE rq.ride_id = $1
  AND r.driver_id = $2
ORDER BY CASE rq.status WHEN 'pending' THEN 0 ELSE 1 END, rq.created_at;


-- R12 | READ | Rides I drive, with pending and approved counts
-- Used by: GET /api/rides/mine (My Rides tab)
-- Params: $1 driver id
SELECT r.id, r.departure_time, r.total_seats, r.seats_available, r.status,
       e.id AS event_id, e.name AS event_name, e.event_date,
       z.name AS zone_name,
       COUNT(rq.id) FILTER (WHERE rq.status = 'pending')  AS pending_requests,
       COUNT(rq.id) FILTER (WHERE rq.status = 'approved') AS approved_riders
FROM rides r
JOIN events e ON e.id = r.event_id
JOIN zones  z ON z.id = r.zone_id
LEFT JOIN ride_requests rq ON rq.ride_id = r.id
WHERE r.driver_id = $1
GROUP BY r.id, e.id, z.id
ORDER BY r.departure_time DESC;


-- R13 | READ | My seat requests with ride, event, driver and my cost share
-- Used by: GET /api/requests/mine (My Requests tab)
-- Params: $1 rider id, $2 request status filter or NULL
SELECT rq.id AS request_id, rq.status AS request_status, rq.created_at,
       r.id AS ride_id, r.departure_time, r.status AS ride_status, r.cost_split,
       e.id AS event_id, e.name AS event_name, e.event_date,
       z.name AS zone_name,
       d.id AS driver_id, d.name AS driver_name, d.avg_rating,
       CASE WHEN r.cost_split
            THEN ROUND(r.total_cost / (COALESCE(a.approved_count, 0) + 1), 2)
       END AS your_share
FROM ride_requests rq
JOIN rides  r ON r.id = rq.ride_id
JOIN events e ON e.id = r.event_id
JOIN zones  z ON z.id = r.zone_id
JOIN users  d ON d.id = r.driver_id
LEFT JOIN (SELECT ride_id, COUNT(*) AS approved_count
           FROM ride_requests
           WHERE status = 'approved'
           GROUP BY ride_id) a ON a.ride_id = r.id
WHERE rq.rider_id = $1
  AND ($2::text IS NULL OR rq.status = $2)
ORDER BY e.event_date;


-- R14 | READ | Pre-fill data to repeat a ride on the next occurrence of a recurring event
-- Used by: GET /api/rides/:id/repeat ("Repeat this ride" button)
-- next_event_id is NULL if the next occurrence has not been created yet
-- Params: $1 ride id, $2 driver id
SELECT r.zone_id, r.total_seats, r.cost_split, r.total_cost,
       r.departure_time + INTERVAL '7 days' AS next_departure_time,
       (SELECT n.id
        FROM events n
        WHERE n.parent_event_id = COALESCE(e.parent_event_id, e.id)
          AND n.event_date > e.event_date
        ORDER BY n.event_date
        LIMIT 1) AS next_event_id
FROM rides r
JOIN events e ON e.id = r.event_id
WHERE r.id = $1
  AND r.driver_id = $2;


-- R15 | READ | People I can still rate for a completed ride
-- Used by: GET /api/rides/:id/ratings/pending
-- A rider can rate the driver; the driver can rate each approved rider; once each.
-- Params: $1 ride id, $2 current user id
SELECT c.id, c.name
FROM (
  SELECT u.id, u.name
  FROM rides r
  JOIN ride_requests rq ON rq.ride_id = r.id
                       AND rq.rider_id = $2
                       AND rq.status = 'approved'
  JOIN users u ON u.id = r.driver_id
  WHERE r.id = $1 AND r.status = 'completed'
  UNION
  SELECT u.id, u.name
  FROM rides r
  JOIN ride_requests rq ON rq.ride_id = r.id AND rq.status = 'approved'
  JOIN users u ON u.id = rq.rider_id
  WHERE r.id = $1 AND r.status = 'completed' AND r.driver_id = $2
) c
WHERE NOT EXISTS (
  SELECT 1
  FROM ratings x
  WHERE x.ride_id = $1 AND x.rater_id = $2 AND x.rated_id = c.id
)
ORDER BY c.name;


-- R16 | READ | Public profile with rating and ride counts
-- Used by: GET /api/users/:id
-- Params: $1 user id
SELECT u.id, u.name, u.avg_rating,
       (SELECT COUNT(*) FROM ratings WHERE rated_id = u.id) AS rating_count,
       (SELECT COUNT(*) FROM rides
        WHERE driver_id = u.id AND status = 'completed') AS rides_driven,
       (SELECT COUNT(*)
        FROM ride_requests rq
        JOIN rides r ON r.id = rq.ride_id
        WHERE rq.rider_id = u.id AND rq.status = 'approved'
          AND r.status = 'completed') AS rides_taken
FROM users u
WHERE u.id = $1;


-- R17 | READ | Latest ratings received by a user
-- Used by: GET /api/users/:id (reviews list)
-- Params: $1 user id
SELECT rt.id, rt.stars, rt.comment,
       u.name AS rater_name, e.name AS event_name
FROM ratings rt
JOIN users  u ON u.id = rt.rater_id
JOIN rides  r ON r.id = rt.ride_id
JOIN events e ON e.id = r.event_id
WHERE rt.rated_id = $1
ORDER BY rt.id DESC
LIMIT 10;


-- R18 | READ | My latest notifications
-- Used by: GET /api/notifications
-- Params: $1 user id
SELECT id, message, is_read, created_at
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC, id DESC
LIMIT 20;


-- R19 | READ | Unread notification count (bell badge, polled)
-- Used by: GET /api/notifications/unread-count
-- Params: $1 user id
SELECT COUNT(*) AS unread
FROM notifications
WHERE user_id = $1
  AND is_read = FALSE;


-- R20 | READ | Dashboard summary counts for the logged-in user
-- Used by: GET /api/users/me/summary
-- Params: $1 user id
SELECT (SELECT COUNT(*) FROM rides WHERE driver_id = $1) AS rides_offered,
       (SELECT COUNT(*) FROM ride_requests WHERE rider_id = $1) AS requests_made,
       (SELECT COUNT(*)
        FROM ride_requests rq
        JOIN rides r ON r.id = rq.ride_id
        WHERE r.driver_id = $1
          AND rq.status = 'pending'
          AND r.status IN ('open', 'full')) AS pending_to_review,
       (SELECT COUNT(*) FROM notifications
        WHERE user_id = $1 AND is_read = FALSE) AS unread_notifications;


-- =====================================================================
-- WRITE QUERIES
-- =====================================================================

-- W1 | WRITE | Register a user
-- Used by: POST /api/auth/register
-- A duplicate email raises unique violation 23505, the app answers 409.
-- Params: $1 name, $2 email, $3 password hash
INSERT INTO users (name, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, name, email;


-- W2 | WRITE | Create an event
-- Used by: POST /api/events
-- Params: $1 name, $2 event date, $3 location, $4 category, $5 is_recurring, $6 creator id
INSERT INTO events (name, event_date, location, category, is_recurring, created_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id;


-- W3 | WRITE | Update an event (creator only)
-- Used by: PUT /api/events/:id
-- Params: $1 event id, $2 name, $3 event date, $4 location, $5 category,
--         $6 is_recurring, $7 current user id
UPDATE events
SET name = $2, event_date = $3, location = $4, category = $5, is_recurring = $6
WHERE id = $1
  AND created_by = $7
RETURNING id;


-- W4 | WRITE | Delete an event (creator only; its rides and requests cascade)
-- Used by: DELETE /api/events/:id
-- Params: $1 event id, $2 current user id
DELETE FROM events
WHERE id = $1
  AND created_by = $2
RETURNING id;


-- W5 | WRITE | Post a ride (departure must not be after the event starts)
-- Used by: POST /api/events/:id/rides
-- seats_available is set to total_seats by the rides_init_seats trigger.
-- No row is inserted if the event does not exist or the departure is too late.
-- Params: $1 event id, $2 driver id, $3 zone id, $4 departure time,
--         $5 total seats, $6 cost_split, $7 total cost or NULL
INSERT INTO rides (event_id, driver_id, zone_id, departure_time, total_seats, cost_split, total_cost)
SELECT e.id, $2, $3, $4, $5, $6, $7
FROM events e
WHERE e.id = $1
  AND $4::timestamp <= e.event_date
RETURNING id;


-- W6 | WRITE | Cancel a ride (driver only)   [TXN: W6 then W7]
-- Used by: PUT /api/rides/:id/cancel
-- Params: $1 ride id, $2 driver id
UPDATE rides
SET status = 'cancelled'
WHERE id = $1
  AND driver_id = $2
  AND status IN ('open', 'full')
RETURNING id;


-- W7 | WRITE | Notify every pending and approved rider of a cancelled ride   [TXN: after W6]
-- Used by: PUT /api/rides/:id/cancel
-- Params: $1 ride id, $2 message text
INSERT INTO notifications (user_id, message)
SELECT rq.rider_id, $2
FROM ride_requests rq
JOIN rides r ON r.id = rq.ride_id
WHERE rq.ride_id = $1
  AND r.status = 'cancelled'
  AND rq.status IN ('pending', 'approved');


-- W8 | WRITE | Mark a ride completed (driver only, only after departure)
-- Used by: PUT /api/rides/:id/complete
-- Params: $1 ride id, $2 driver id
UPDATE rides
SET status = 'completed'
WHERE id = $1
  AND driver_id = $2
  AND status IN ('open', 'full')
  AND departure_time <= NOW()
RETURNING id;


-- W9 | WRITE | Request a seat (ride must be open)
-- Used by: POST /api/rides/:id/requests
-- Own ride raises an exception from trigger requests_not_own_ride, a repeat
-- request raises unique violation 23505; the app answers 400 / 409.
-- Params: $1 ride id, $2 rider id
INSERT INTO ride_requests (ride_id, rider_id)
SELECT r.id, $2
FROM rides r
WHERE r.id = $1
  AND r.status = 'open'
RETURNING id;


-- W10 | WRITE | Reject a pending request (driver of that ride only)
-- Used by: PUT /api/requests/:id/reject
-- Params: $1 request id, $2 driver id
UPDATE ride_requests rq
SET status = 'rejected'
FROM rides r
WHERE rq.id = $1
  AND r.id = rq.ride_id
  AND r.driver_id = $2
  AND rq.status = 'pending'
RETURNING rq.ride_id, rq.rider_id;


-- W11 | WRITE | Approve a pending request (driver of that ride only)   [TXN: W11 then W12]
-- Used by: PUT /api/requests/:id/approve
-- If this returns no row, ROLLBACK. Otherwise run W12 with the returned ride_id.
-- Params: $1 request id, $2 driver id
UPDATE ride_requests rq
SET status = 'approved'
FROM rides r
WHERE rq.id = $1
  AND r.id = rq.ride_id
  AND r.driver_id = $2
  AND rq.status = 'pending'
RETURNING rq.ride_id, rq.rider_id;


-- W12 | WRITE | Take one seat and mark the ride full when none are left   [TXN: after W11]
-- Used by: PUT /api/requests/:id/approve
-- The UPDATE locks the ride row, so two approvals for the last seat cannot both
-- succeed. If this returns no row (no seat left), ROLLBACK the transaction.
-- Params: $1 ride id
UPDATE rides
SET seats_available = seats_available - 1,
    status = CASE WHEN seats_available = 1 THEN 'full' ELSE status END
WHERE id = $1
  AND status = 'open'
  AND seats_available > 0
RETURNING seats_available, status;


-- W13 | WRITE | Cancel my seat request   [TXN: W13 then W14 if the returned status was 'approved']
-- Used by: PUT /api/requests/:id/cancel
-- Params: $1 request id, $2 rider id
DELETE FROM ride_requests
WHERE id = $1
  AND rider_id = $2
  AND ride_id IN (SELECT id FROM rides WHERE status IN ('open', 'full'))
RETURNING ride_id, status;


-- W14 | WRITE | Give the seat back and reopen a full ride   [TXN: after W13]
-- Used by: PUT /api/requests/:id/cancel
-- Params: $1 ride id
UPDATE rides
SET seats_available = seats_available + 1,
    status = CASE WHEN status = 'full' THEN 'open' ELSE status END
WHERE id = $1
  AND seats_available < total_seats
RETURNING seats_available, status;


-- W15 | WRITE | Create one notification
-- Used by: request, approve, reject and cancel flows
-- Params: $1 user id, $2 message text
INSERT INTO notifications (user_id, message)
VALUES ($1, $2)
RETURNING id;


-- W16 | WRITE | Mark one notification as read
-- Used by: PUT /api/notifications/:id/read
-- Params: $1 notification id, $2 user id
UPDATE notifications
SET is_read = TRUE
WHERE id = $1
  AND user_id = $2
RETURNING id;


-- W17 | WRITE | Mark all my notifications as read
-- Used by: PUT /api/notifications/read-all
-- Params: $1 user id
UPDATE notifications
SET is_read = TRUE
WHERE user_id = $1
  AND is_read = FALSE;


-- W18 | WRITE | Rate a driver or rider after a completed ride
-- Used by: POST /api/rides/:id/ratings (run R15 first to confirm $3 is allowed)
-- Trigger ratings_refresh_avg updates users.avg_rating afterwards.
-- Params: $1 ride id, $2 rater id, $3 rated id, $4 stars (1-5), $5 comment or NULL
INSERT INTO ratings (ride_id, rater_id, rated_id, stars, comment)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;


-- W19 | WRITE | Departure reminders for rides leaving within the hour (cron, every 15 min)
-- Used by: jobs/cron.js
-- Marks each due ride as reminded and notifies its driver and approved riders in one statement.
WITH due AS (
  UPDATE rides
  SET reminder_sent = TRUE
  WHERE reminder_sent = FALSE
    AND status IN ('open', 'full')
    AND departure_time BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
  RETURNING id, driver_id
)
INSERT INTO notifications (user_id, message)
SELECT d.driver_id, 'Reminder: your ride leaves within the hour.'
FROM due d
UNION ALL
SELECT rq.rider_id, 'Reminder: your ride leaves within the hour.'
FROM due d
JOIN ride_requests rq ON rq.ride_id = d.id AND rq.status = 'approved';


-- W20 | WRITE | Create the next weekly occurrence of recurring events that have passed (cron, daily)
-- Used by: jobs/cron.js
-- parent_event_id points to the first event of the series, so a series is cloned once per week.
INSERT INTO events (name, event_date, location, category, is_recurring, parent_event_id, created_by)
SELECT e.name, e.event_date + INTERVAL '7 days', e.location, e.category, TRUE,
       COALESCE(e.parent_event_id, e.id), e.created_by
FROM events e
WHERE e.is_recurring = TRUE
  AND e.event_date < NOW()
  AND NOT EXISTS (
    SELECT 1
    FROM events n
    WHERE n.parent_event_id = COALESCE(e.parent_event_id, e.id)
      AND n.event_date > e.event_date
  );