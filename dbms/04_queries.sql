SELECT id, name, email, password_hash
FROM users
WHERE email = $1;

SELECT id, name, email, avg_rating
FROM users
WHERE id = $1;

SELECT id, name
FROM zones
ORDER BY name;

SELECT z.id, z.name
FROM zone_adjacency za
JOIN zones z ON z.id = za.adjacent_zone_id
WHERE za.zone_id = $1
ORDER BY z.name;

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

SELECT e.id, e.name, e.event_date, e.location, e.category, e.is_recurring,
       e.parent_event_id, e.created_by, u.name AS creator_name
FROM events e
JOIN users u ON u.id = e.created_by
WHERE e.id = $1;

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

SELECT u.id, u.name, u.avg_rating
FROM ride_requests rq
JOIN users u ON u.id = rq.rider_id
WHERE rq.ride_id = $1
  AND rq.status = 'approved'
ORDER BY rq.created_at;

SELECT rq.id, rq.status, rq.created_at,
       u.id AS rider_id, u.name AS rider_name, u.avg_rating
FROM ride_requests rq
JOIN rides r ON r.id = rq.ride_id
JOIN users u ON u.id = rq.rider_id
WHERE rq.ride_id = $1
  AND r.driver_id = $2
ORDER BY CASE rq.status WHEN 'pending' THEN 0 ELSE 1 END, rq.created_at;

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

SELECT rt.id, rt.stars, rt.comment,
       u.name AS rater_name, e.name AS event_name
FROM ratings rt
JOIN users  u ON u.id = rt.rater_id
JOIN rides  r ON r.id = rt.ride_id
JOIN events e ON e.id = r.event_id
WHERE rt.rated_id = $1
ORDER BY rt.id DESC
LIMIT 10;


SELECT id, message, is_read, created_at
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC, id DESC
LIMIT 20;


-- Unread notification count (bell badge, polled)

SELECT COUNT(*) AS unread
FROM notifications
WHERE user_id = $1
  AND is_read = FALSE;


-- Dashboard summary counts for the logged-in user

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


INSERT INTO users (name, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, name, email;


INSERT INTO events (name, event_date, location, category, is_recurring, created_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id;



UPDATE events
SET name = $2, event_date = $3, location = $4, category = $5, is_recurring = $6
WHERE id = $1
  AND created_by = $7
RETURNING id;

DELETE FROM events
WHERE id = $1
  AND created_by = $2
RETURNING id;


INSERT INTO rides (event_id, driver_id, zone_id, departure_time, total_seats, cost_split, total_cost)
SELECT e.id, $2, $3, $4, $5, $6, $7
FROM events e
WHERE e.id = $1
  AND $4::timestamp <= e.event_date
RETURNING id;

UPDATE rides
SET status = 'cancelled'
WHERE id = $1
  AND driver_id = $2
  AND status IN ('open', 'full')
RETURNING id;


INSERT INTO notifications (user_id, message)
SELECT rq.rider_id, $2
FROM ride_requests rq
JOIN rides r ON r.id = rq.ride_id
WHERE rq.ride_id = $1
  AND r.status = 'cancelled'
  AND rq.status IN ('pending', 'approved');


UPDATE rides
SET status = 'completed'
WHERE id = $1
  AND driver_id = $2
  AND status IN ('open', 'full')
  AND departure_time <= NOW()
RETURNING id;

INSERT INTO ride_requests (ride_id, rider_id)
SELECT r.id, $2
FROM rides r
WHERE r.id = $1
  AND r.status = 'open'
RETURNING id;


UPDATE ride_requests rq
SET status = 'rejected'
FROM rides r
WHERE rq.id = $1
  AND r.id = rq.ride_id
  AND r.driver_id = $2
  AND rq.status = 'pending'
RETURNING rq.ride_id, rq.rider_id;

UPDATE ride_requests rq
SET status = 'approved'
FROM rides r
WHERE rq.id = $1
  AND r.id = rq.ride_id
  AND r.driver_id = $2
  AND rq.status = 'pending'
RETURNING rq.ride_id, rq.rider_id;


UPDATE rides
SET seats_available = seats_available - 1,
    status = CASE WHEN seats_available = 1 THEN 'full' ELSE status END
WHERE id = $1
  AND status = 'open'
  AND seats_available > 0
RETURNING seats_available, status;


DELETE FROM ride_requests
WHERE id = $1
  AND rider_id = $2
  AND ride_id IN (SELECT id FROM rides WHERE status IN ('open', 'full'))
RETURNING ride_id, status;

UPDATE rides
SET seats_available = seats_available + 1,
    status = CASE WHEN status = 'full' THEN 'open' ELSE status END
WHERE id = $1
  AND seats_available < total_seats
RETURNING seats_available, status;


INSERT INTO notifications (user_id, message)
VALUES ($1, $2)
RETURNING id;

UPDATE notifications
SET is_read = TRUE
WHERE id = $1
  AND user_id = $2
RETURNING id;

UPDATE notifications
SET is_read = TRUE
WHERE user_id = $1
  AND is_read = FALSE;

INSERT INTO ratings (ride_id, rater_id, rated_id, stars, comment)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;


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