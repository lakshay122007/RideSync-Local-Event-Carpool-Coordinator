-- =====================================================================
-- 03_schema.sql — Local Event Carpool Coordinator
-- Target: PostgreSQL 12+
-- Matches the normalized design in 01_normalization.md
-- Run with:  psql -d carpool -f 03_schema.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Clean slate (safe to re-run during development)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS notifications   CASCADE;
DROP TABLE IF EXISTS ratings         CASCADE;
DROP TABLE IF EXISTS ride_requests   CASCADE;
DROP TABLE IF EXISTS rides           CASCADE;
DROP TABLE IF EXISTS events          CASCADE;
DROP TABLE IF EXISTS zone_adjacency  CASCADE;
DROP TABLE IF EXISTS zones           CASCADE;
DROP TABLE IF EXISTS users           CASCADE;

-- ---------------------------------------------------------------------
-- users
-- avg_rating is a deliberate denormalization (see 01_normalization.md §5.1);
-- it is refreshed by the trigger at the bottom of this file.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avg_rating    NUMERIC(3,2)
    CHECK (avg_rating IS NULL OR avg_rating BETWEEN 1 AND 5)
);

-- ---------------------------------------------------------------------
-- zones + adjacency
-- Adjacency is symmetric: always insert BOTH (A,B) and (B,A).
-- ---------------------------------------------------------------------
CREATE TABLE zones (
  id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE zone_adjacency (
  zone_id          INT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  adjacent_zone_id INT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  PRIMARY KEY (zone_id, adjacent_zone_id),
  CHECK (zone_id <> adjacent_zone_id)
);

-- ---------------------------------------------------------------------
-- events
-- parent_event_id links a weekly clone back to the original recurring event
-- ---------------------------------------------------------------------
CREATE TABLE events (
  id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  event_date      TIMESTAMP    NOT NULL,
  location        VARCHAR(200) NOT NULL,
  category        VARCHAR(20)  NOT NULL
    CHECK (category IN ('college_fest','gym','market','exam','concert','custom')),
  is_recurring    BOOLEAN      NOT NULL DEFAULT FALSE,
  parent_event_id INT REFERENCES events(id) ON DELETE SET NULL,
  created_by      INT NOT NULL REFERENCES users(id)
);

-- ---------------------------------------------------------------------
-- rides
-- seats_available is a deliberate denormalization (see §5.2); it is
-- initialised to total_seats by trigger and decremented by the app inside
-- the approval transaction.
-- ---------------------------------------------------------------------
CREATE TABLE rides (
  id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id        INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  driver_id       INT NOT NULL REFERENCES users(id),
  zone_id         INT NOT NULL REFERENCES zones(id),
  departure_time  TIMESTAMP NOT NULL,
  total_seats     INT NOT NULL CHECK (total_seats > 0),
  seats_available INT NOT NULL,
  cost_split      BOOLEAN NOT NULL DEFAULT FALSE,
  total_cost      NUMERIC(8,2),
  status          VARCHAR(10) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','full','completed','cancelled')),
  reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (seats_available >= 0 AND seats_available <= total_seats),
  CHECK (
    (cost_split = FALSE AND total_cost IS NULL) OR
    (cost_split = TRUE  AND total_cost IS NOT NULL AND total_cost >= 0)
  )
);

-- ---------------------------------------------------------------------
-- ride_requests
-- ---------------------------------------------------------------------
CREATE TABLE ride_requests (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ride_id    INT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rider_id   INT NOT NULL REFERENCES users(id),
  status     VARCHAR(10) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ride_id, rider_id)
);

-- ---------------------------------------------------------------------
-- ratings
-- ---------------------------------------------------------------------
CREATE TABLE ratings (
  id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ride_id  INT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  rater_id INT NOT NULL REFERENCES users(id),
  rated_id INT NOT NULL REFERENCES users(id),
  stars    INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment  TEXT,
  UNIQUE (ride_id, rater_id, rated_id),
  CHECK (rater_id <> rated_id)
);

-- ---------------------------------------------------------------------
-- notifications (in-app only, fetched on page load)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    VARCHAR(300) NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Indexes for the main queries
-- ---------------------------------------------------------------------
CREATE INDEX idx_events_parent       ON events (parent_event_id);
CREATE INDEX idx_rides_event_zone    ON rides (event_id, zone_id, status);
CREATE INDEX idx_rides_driver        ON rides (driver_id);
CREATE INDEX idx_rides_departure     ON rides (departure_time) WHERE status = 'open';
CREATE INDEX idx_requests_rider      ON ride_requests (rider_id);
CREATE INDEX idx_ratings_rated       ON ratings (rated_id);
CREATE INDEX idx_notif_user_read     ON notifications (user_id, is_read);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- 1) New ride starts with every seat free.
CREATE OR REPLACE FUNCTION trg_rides_init_seats() RETURNS trigger AS $$
BEGIN
  NEW.seats_available := NEW.total_seats;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rides_init_seats
BEFORE INSERT ON rides
FOR EACH ROW EXECUTE FUNCTION trg_rides_init_seats();

-- 2) A driver cannot request a seat on their own ride.
CREATE OR REPLACE FUNCTION trg_requests_not_own_ride() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM rides WHERE id = NEW.ride_id AND driver_id = NEW.rider_id) THEN
    RAISE EXCEPTION 'A driver cannot request a seat on their own ride';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER requests_not_own_ride
BEFORE INSERT ON ride_requests
FOR EACH ROW EXECUTE FUNCTION trg_requests_not_own_ride();

-- 3) Keep users.avg_rating in sync with ratings (source of truth).
CREATE OR REPLACE FUNCTION trg_refresh_avg_rating() RETURNS trigger AS $$
DECLARE
  target INT := COALESCE(NEW.rated_id, OLD.rated_id);
BEGIN
  UPDATE users
     SET avg_rating = (SELECT ROUND(AVG(stars)::numeric, 2)
                       FROM ratings WHERE rated_id = target)
   WHERE id = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ratings_refresh_avg
AFTER INSERT OR UPDATE OR DELETE ON ratings
FOR EACH ROW EXECUTE FUNCTION trg_refresh_avg_rating();

-- ---------------------------------------------------------------------
-- Seed data: zones and adjacency (edit to match your campus / city)
-- ---------------------------------------------------------------------
INSERT INTO zones (name) VALUES
  ('North Campus'),
  ('South Campus'),
  ('Sector 14'),
  ('Sector 21'),
  ('Near Metro Station'),
  ('City Center');

-- Define each adjacent pair ONCE here; the INSERT below stores both directions.
WITH pairs(a, b) AS (
  VALUES
    ('North Campus',      'South Campus'),
    ('North Campus',      'Sector 14'),
    ('South Campus',      'Near Metro Station'),
    ('Sector 14',         'Sector 21'),
    ('Sector 14',         'Near Metro Station'),
    ('Near Metro Station','City Center'),
    ('Sector 21',         'City Center')
)
INSERT INTO zone_adjacency (zone_id, adjacent_zone_id)
SELECT za.id, zb.id FROM pairs p
  JOIN zones za ON za.name = p.a
  JOIN zones zb ON zb.name = p.b
UNION
SELECT zb.id, za.id FROM pairs p
  JOIN zones za ON za.name = p.a
  JOIN zones zb ON zb.name = p.b;

COMMIT;