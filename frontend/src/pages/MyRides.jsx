import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Ticket, ClipboardList, Bell, Clock, MapPin, Users, Route } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { Empty, Loading, StatusTag } from '../components/ui.jsx';

export default function MyRides() {
  const toast = useToast();
  const [rides, setRides] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get('/rides/mine').then(setRides).catch((err) => toast.error(err.message));
    api.get('/users/me/summary').then(setSummary);
  }, []);

  const tiles = summary && [
    { icon: Car, value: summary.rides_offered, label: 'Rides offered' },
    { icon: Ticket, value: summary.requests_made, label: 'Requests made' },
    { icon: ClipboardList, value: summary.pending_to_review, label: 'Requests to review' },
    { icon: Bell, value: summary.unread_notifications, label: 'Unread notifications' },
  ];

  return (
    <>
      <div className="page-head"><h2>My Rides</h2></div>
      {tiles && (
        <div className="stats">
          {tiles.map((t) => (
            <div key={t.label} className="card stat">
              <span className="card-icon"><t.icon size={22} /></span>
              <div><strong>{t.value}</strong><span className="muted">{t.label}</span></div>
            </div>
          ))}
        </div>
      )}
      {rides === null && <Loading text="Loading your rides" />}
      {rides && rides.length === 0 && (
        <Empty icon={Route} title="No rides offered yet">Open an event and choose "Offer a ride".</Empty>
      )}
      {rides && rides.map((r) => (
        <Link key={r.id} to={`/rides/${r.id}`} className="card ride-row">
          <div>
            <strong>{r.event_name}</strong>
            <p className="meta"><MapPin /> {r.zone_name}</p>
            <p className="meta"><Clock /> {formatDate(r.departure_time)}</p>
          </div>
          <div className="right">
            <StatusTag status={r.status} />
            <p className="meta" style={{ justifyContent: 'flex-end' }}><Users /> {r.approved_riders} approved, {r.pending_requests} pending, {r.seats_available} seats left</p>
          </div>
        </Link>
      ))}
    </>
  );
}
