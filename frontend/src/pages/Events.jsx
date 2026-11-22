import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MapPin, CalendarDays, Car, Users, CalendarX } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { CategoryIcon, Empty, Loading } from '../components/ui.jsx';

const categories = ['college_fest', 'gym', 'market', 'exam', 'concert', 'custom'];

export default function Events() {
  const { user } = useAuth();
  const toast = useToast();
  const [events, setEvents] = useState(null);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [upcoming, setUpcoming] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ upcoming });
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    api.get(`/events?${params}`).then(setEvents).catch((err) => toast.error(err.message));
  }, [category, search, upcoming]);

  return (
    <>
      <div className="hero">
        <h2>Share the ride, not the traffic</h2>
        <p>Find a ride to a college fest, gym session, market or concert, or offer your empty seats.</p>
      </div>
      <div className="page-head">
        <h2>Events</h2>
        {user && <Link className="button" to="/events/new"><Plus /> New event</Link>}
      </div>
      <div className="card row filters">
        <div className="input-icon">
          <Search />
          <input aria-label="Search events" placeholder="Search by event name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
        <label className="inline">
          <input type="checkbox" checked={upcoming} onChange={(e) => setUpcoming(e.target.checked)} /> Upcoming only
        </label>
      </div>
      {events === null && <Loading text="Loading events" />}
      {events && events.length === 0 && (
        <Empty icon={CalendarX} title="No events found">Try another search or category{user ? ', or create the first event.' : '.'}</Empty>
      )}
      <div className="grid">
        {events && events.map((e) => (
          <Link key={e.id} to={`/events/${e.id}`} className="card">
            <span className="card-icon"><CategoryIcon category={e.category} /></span>
            <h3>{e.name}</h3>
            <p className="meta"><CalendarDays /> {formatDate(e.event_date)}</p>
            <p className="meta"><MapPin /> {e.location}</p>
            <p>
              <span className="tag">{e.category.replace('_', ' ')}</span>
              {e.is_recurring && <span className="tag warn">weekly</span>}
            </p>
            <p className="meta"><Car /> {e.ride_count} rides <Users /> {e.open_seats} open seats</p>
          </Link>
        ))}
      </div>
    </>
  );
}
