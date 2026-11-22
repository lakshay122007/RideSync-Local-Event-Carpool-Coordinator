import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CalendarDays, MapPin, Plus, X, Trash2, Car, IndianRupee, Clock, Users, ChevronRight, Navigation } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { Avatar, CategoryIcon, ConfirmDialog, Empty, ErrorText, Loading, Stars } from '../components/ui.jsx';

const rankLabels = ['Same zone', 'Nearby zone', 'Other zone'];

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [rides, setRides] = useState(null);
  const [stats, setStats] = useState([]);
  const [zones, setZones] = useState([]);
  const [myZone, setMyZone] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ zoneId: '', departureTime: '', totalSeats: 3, costSplit: false, totalCost: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/events/${id}`).then(setEvent).catch((err) => toast.error(err.message));
    api.get('/zones').then(setZones);
    api.get(`/events/${id}/stats`).then(setStats);
  }, [id]);

  useEffect(() => {
    api.get(`/events/${id}/rides?zone=${myZone}`).then(setRides);
  }, [id, myZone]);

  async function postRide(e) {
    e.preventDefault();
    setError('');
    try {
      const ride = await api.post(`/events/${id}/rides`, form);
      toast.success('Ride posted');
      navigate(`/rides/${ride.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteEvent() {
    try {
      await api.del(`/events/${id}`);
      toast.success('Event deleted');
      navigate('/');
    } catch (err) {
      setConfirmDelete(false);
      toast.error(err.message);
    }
  }

  if (!event) return <Loading text="Loading event" />;

  const chartData = stats.map((s) => ({
    name: `${s.driver_name} (${s.zone_name})`,
    Filled: s.seats_filled,
    Available: s.seats_available,
  }));

  return (
    <>
      <div className="card">
        <div className="row between">
          <div className="row">
            <span className="card-icon" style={{ marginBottom: 0 }}><CategoryIcon category={event.category} /></span>
            <div>
              <h2>{event.name}</h2>
              <p className="meta"><CalendarDays /> {formatDate(event.event_date)}</p>
              <p className="meta"><MapPin /> {event.location}</p>
              <p>
                <span className="tag">{event.category.replace('_', ' ')}</span>
                {event.is_recurring && <span className="tag warn">weekly</span>}
                <span className="muted">Created by {event.creator_name}</span>
              </p>
            </div>
          </div>
          {user && user.id === event.created_by && (
            <button className="danger small" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete event</button>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="card">
          <h3>Seats filled and available</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Filled" stackId="a" fill="#4f46e5" radius={[0, 0, 4, 4]} />
              <Bar dataKey="Available" stackId="a" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="page-head">
        <h3>Rides to this event</h3>
        {user ? (
          <button onClick={() => setShowForm(!showForm)}>{showForm ? <><X /> Close</> : <><Plus /> Offer a ride</>}</button>
        ) : (
          <p className="muted"><Link to="/login">Log in</Link> to offer or request a ride.</p>
        )}
      </div>

      {showForm && (
        <form className="card form" onSubmit={postRide}>
          <h3>Offer a ride</h3>
          <ErrorText>{error}</ErrorText>
          <label>Pickup zone
            <select required value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })}>
              <option value="">Choose a zone</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </label>
          <label>Departure time
            <input type="datetime-local" required value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} />
          </label>
          <label>Seats available (1 to 8)
            <input type="number" min="1" max="8" required value={form.totalSeats} onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} />
          </label>
          <label className="inline">
            <input type="checkbox" checked={form.costSplit} onChange={(e) => setForm({ ...form, costSplit: e.target.checked })} />
            Split fuel cost between riders
          </label>
          {form.costSplit && (
            <label>Estimated total cost (₹)
              <input type="number" min="0" required value={form.totalCost} onChange={(e) => setForm({ ...form, totalCost: e.target.value })} />
              <span className="hint muted">Each rider's share is calculated from this and the seats filled.</span>
            </label>
          )}
          <button><Car /> Post ride</button>
        </form>
      )}

      <div className="card row filters">
        <label>My pickup zone
          <select value={myZone} onChange={(e) => setMyZone(e.target.value)}>
            <option value="">Not selected</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        <span className="muted"><Navigation size={14} /> Rides from your zone are shown first, then nearby zones.</span>
      </div>

      {rides === null && <Loading text="Loading rides" />}
      {rides && rides.length === 0 && <Empty icon={Car} title="No open rides yet">Be the first to offer a ride to this event.</Empty>}
      {rides && rides.map((r) => (
        <Link key={r.id} to={`/rides/${r.id}`} className="card ride-row">
          <div className="row">
            <Avatar name={r.driver_name} />
            <div>
              <strong>{r.zone_name}</strong>
              <p className="meta"><Clock /> {formatDate(r.departure_time)}</p>
              <p className="meta">Driver {r.driver_name} <Stars value={r.avg_rating} /></p>
            </div>
          </div>
          <div className="right">
            {myZone && <span className={`tag rank${r.zone_rank}`}>{rankLabels[r.zone_rank]}</span>}
            <p className="meta" style={{ justifyContent: 'flex-end' }}><Users /> {r.seats_available} of {r.total_seats} seats left</p>
            <p className="meta" style={{ justifyContent: 'flex-end' }}>
              <IndianRupee /> {r.cost_split ? `Your share ₹${r.cost_share}` : 'Free'} <ChevronRight />
            </p>
          </div>
        </Link>
      ))}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this event?"
        text="All rides, requests and notifications for this event will be removed. This cannot be undone."
        confirmLabel="Delete event"
        onConfirm={deleteEvent}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
