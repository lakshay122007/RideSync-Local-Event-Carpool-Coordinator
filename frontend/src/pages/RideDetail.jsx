import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, Clock, Users, IndianRupee, Hand, CheckCheck, Ban, Repeat, Check, X, Star, UserRound } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { Avatar, ConfirmDialog, Empty, Loading, StatusTag, Stars } from '../components/ui.jsx';

export default function RideDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [requests, setRequests] = useState([]);
  const [pending, setPending] = useState([]);
  const [stars, setStars] = useState({});
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isDriver = user && ride && user.id === ride.driver_id;

  async function load() {
    try {
      const data = await api.get(`/rides/${id}`);
      setRide(data);
      if (user) {
        api.get(`/rides/${id}/ratings/pending`).then(setPending);
        if (user.id === data.driver_id) api.get(`/rides/${id}/requests`).then(setRequests);
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function act(action, successText) {
    try {
      await action();
      toast.success(successText);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function cancelRide() {
    setConfirmCancel(false);
    await act(() => api.put(`/rides/${id}/cancel`), 'Ride cancelled');
  }

  async function repeatRide() {
    try {
      const prefill = await api.get(`/rides/${id}/repeat`);
      if (!prefill.next_event_id) {
        toast.error('The next occurrence of this event has not been created yet');
        return;
      }
      const created = await api.post(`/events/${prefill.next_event_id}/rides`, {
        zoneId: prefill.zone_id,
        departureTime: prefill.next_departure_time,
        totalSeats: prefill.total_seats,
        costSplit: prefill.cost_split,
        totalCost: prefill.total_cost,
      });
      toast.success('Ride repeated for the next event');
      navigate(`/rides/${created.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (!ride) return <Loading text="Loading ride" />;

  return (
    <>
      <div className="card">
        <div className="row between">
          <h2><Link to={`/events/${ride.event_id}`}>{ride.event_name}</Link></h2>
          <StatusTag status={ride.status} />
        </div>
        <p className="meta"><CalendarDays /> {formatDate(ride.event_date)}</p>
        <p className="meta"><MapPin /> {ride.location}</p>
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} />
        <p className="meta"><MapPin /> Pickup in <strong>{ride.zone_name}</strong></p>
        <p className="meta"><Clock /> Leaves {formatDate(ride.departure_time)}</p>
        <p className="meta"><Users /> {ride.seats_available} of {ride.total_seats} seats left</p>
        <p className="meta"><IndianRupee /> {ride.cost_split ? `Total ₹${ride.total_cost}, share ₹${ride.cost_share} each` : 'Free ride'}</p>
        <div className="row" style={{ margin: '12px 0' }}>
          <Avatar name={ride.driver_name} />
          <div>
            <Link to={`/profile/${ride.driver_id}`}>{ride.driver_name}</Link>
            <p className="muted">Driver <Stars value={ride.avg_rating} /></p>
          </div>
        </div>

        {user && !isDriver && ride.status === 'open' && (
          <button onClick={() => act(() => api.post(`/rides/${id}/requests`), 'Request sent to the driver')}><Hand /> Request a seat</button>
        )}
        {user && !isDriver && ride.status !== 'open' && <p className="muted">This ride is not accepting requests.</p>}
        {!user && <p className="muted"><Link to="/login">Log in</Link> to request a seat.</p>}
        {isDriver && (
          <div className="row">
            {['open', 'full'].includes(ride.status) && (
              <>
                <button onClick={() => act(() => api.put(`/rides/${id}/complete`), 'Ride marked completed')}><CheckCheck /> Mark completed</button>
                <button className="danger" onClick={() => setConfirmCancel(true)}><Ban /> Cancel ride</button>
              </>
            )}
            <button className="secondary" onClick={repeatRide}><Repeat /> Repeat this ride</button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Confirmed riders</h3>
        {ride.riders.length === 0 && <p className="muted">No confirmed riders yet.</p>}
        {ride.riders.map((r) => (
          <div key={r.id} className="row request-row">
            <Avatar name={r.name} />
            <Link to={`/profile/${r.id}`}>{r.name}</Link>
            <Stars value={r.avg_rating} />
          </div>
        ))}
      </div>

      {isDriver && (
        <div className="card">
          <h3>Seat requests</h3>
          {requests.length === 0 && <p className="muted">No requests yet.</p>}
          {requests.map((r) => (
            <div key={r.id} className="row between request-row">
              <span className="row">
                <Avatar name={r.rider_name} />
                <Link to={`/profile/${r.rider_id}`}>{r.rider_name}</Link>
                <StatusTag status={r.status} />
              </span>
              {r.status === 'pending' && (
                <span className="row">
                  <button className="small" onClick={() => act(() => api.put(`/requests/${r.id}/approve`), 'Request approved')}><Check /> Approve</button>
                  <button className="danger small" onClick={() => act(() => api.put(`/requests/${r.id}/reject`), 'Request rejected')}><X /> Reject</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="card">
          <h3>Rate your ride</h3>
          {pending.map((p) => (
            <div key={p.id} className="row between request-row">
              <span className="row"><Avatar name={p.name} />{p.name}</span>
              <span className="row">
                <select aria-label={`Stars for ${p.name}`} value={stars[p.id] || 5} onChange={(e) => setStars({ ...stars, [p.id]: e.target.value })}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
                </select>
                <button className="small" onClick={() => act(() => api.post(`/rides/${id}/ratings`, { ratedId: p.id, stars: stars[p.id] || 5 }), 'Rating saved')}><Star /> Rate</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this ride?"
        text="Every confirmed rider and pending request will be notified. This cannot be undone."
        confirmLabel="Cancel ride"
        onConfirm={cancelRide}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}
