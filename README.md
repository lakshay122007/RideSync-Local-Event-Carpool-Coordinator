# RideSync – Local Event Carpool Coordinator

RideSync connects people traveling to the same local event — college fests, gym sessions, weekly markets, exam centers — with others from the same or nearby pickup zones. Instead of relying on GPS or maps APIs (the hardest part of real ride-sharing apps), RideSync uses a simple, predefined **zone-based matching system** to solve the actual coordination problem: knowing who else from your area is headed to the same place.

## Problem Statement

People attending the same recurring or one-time event often travel from similar areas but have no simple way to find each other and share a ride. This leads to duplicate trips, higher costs, and missed convenience. Full ride-sharing apps solve this with real-time GPS matching — a complex, fragile problem to build from scratch. RideSync sidesteps that entirely and focuses on what actually matters for local, event-based carpooling: matching by event and rough pickup zone.

## Features

- **Event Management** — create one-time or recurring events (recurring events auto-refresh weekly via a cron job)
- **Ride Posting** — drivers post rides with event, pickup zone, departure time, and seat count
- **Seat Requests** — riders request a seat; drivers approve/reject; no overbooking (enforced at the database level)
- **Zone-Based Matching** — rides are sorted by same-zone first, then adjacent zones, using a lightweight pre-seeded adjacency table
- **Fuel Cost Splitting** — optional equal cost split among confirmed riders per ride
- **Ratings** — drivers and riders rate each other after a completed ride
- **Notifications** — new requests, approvals, and departure reminders (via `node-cron`)
- **Ride History** — past rides, plus a "repeat ride" shortcut for recurring events
- **Dashboards** — My Rides, My Requests, and per-event seat-fill overview

## Tech Stack

**Backend:** Node.js, Express.js, PostgreSQL, JWT authentication, node-cron
**Frontend:** React, Tailwind CSS, Recharts, React Router, Axios
**Other:** bcrypt (password hashing), Multer (if file uploads are added later)

## Database Overview

```
users            – account info, average rating
zones            – predefined pickup areas
zone_adjacency   – which zones are considered "nearby" each other
events           – one-time or recurring events
rides            – posted rides (event, zone, seats, cost, status)
ride_requests    – seat requests and their approval status
ratings          – post-ride ratings between driver and rider
notifications    – in-app alerts
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env   # add your DB credentials and JWT secret
npm run migrate        # run schema setup
npm start
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The backend runs on `http://localhost:5000` and the frontend on `http://localhost:5173` by default.

## Environment Variables

```
DATABASE_URL=postgresql://user:password@localhost:5432/ridesync
JWT_SECRET=your_secret_key
PORT=5000
```

## Project Status

Actively in development.

## Why RideSync

Most carpool apps chase real-time GPS precision, which adds significant complexity for little benefit in a local, event-based context. RideSync focuses instead on a simple, explainable matching system — solving the real coordination pain without the overhead.
