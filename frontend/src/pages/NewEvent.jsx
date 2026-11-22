import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { ErrorText } from '../components/ui.jsx';

const categories = ['college_fest', 'gym', 'market', 'exam', 'concert', 'custom'];

export default function NewEvent() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', eventDate: '', location: '', category: 'gym', isRecurring: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const event = await api.post('/events', form);
      toast.success('Event created');
      navigate(`/events/${event.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="card form narrow" onSubmit={handleSubmit}>
      <div>
        <h2>New event</h2>
        <p className="muted">Riders will find your event and the rides going to it.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      <label>Name
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label>Date and time
        <input type="datetime-local" required value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
      </label>
      <label>Location
        <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      </label>
      <label>Category
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {categories.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </label>
      <label className="inline">
        <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} />
        Repeats every week
      </label>
      <button disabled={busy}><CalendarPlus /> {busy ? 'Creating...' : 'Create event'}</button>
    </form>
  );
}
