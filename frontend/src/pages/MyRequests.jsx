import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Clock, MapPin, IndianRupee, X } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { ConfirmDialog, Empty, Loading, StatusTag } from '../components/ui.jsx';

export default function MyRequests() {
  const toast = useToast();
  const [requests, setRequests] = useState(null);
  const [status, setStatus] = useState('');
  const [toCancel, setToCancel] = useState(null);

  function load() {
    api.get(`/requests/mine?status=${status}`).then(setRequests).catch((err) => toast.error(err.message));
  }

  useEffect(load, [status]);

  async function cancel() {
    const id = toCancel;
    setToCancel(null);
    try {
      await api.put(`/requests/${id}/cancel`);
      toast.success('Request cancelled');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>My Requests</h2>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All requests</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {requests === null && <Loading text="Loading your requests" />}
      {requests && requests.length === 0 && (
        <Empty icon={Ticket} title="No requests found">Open an event and request a seat on a ride.</Empty>
      )}
      {requests && requests.map((r) => (
        <div key={r.request_id} className="card ride-row">
          <Link to={`/rides/${r.ride_id}`}>
            <strong>{r.event_name}</strong>
            <p className="meta"><MapPin /> {r.zone_name}</p>
            <p className="meta"><Clock /> {formatDate(r.departure_time)} · Driver {r.driver_name}</p>
          </Link>
          <div className="right">
            <StatusTag status={r.request_status} />
            {r.cost_split && <p className="meta" style={{ justifyContent: 'flex-end' }}><IndianRupee /> Your share ₹{r.your_share}</p>}
            {['open', 'full'].includes(r.ride_status) && (
              <button className="danger small" onClick={() => setToCancel(r.request_id)}><X /> Cancel</button>
            )}
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={toCancel !== null}
        title="Cancel this request?"
        text="The driver will be told, and your seat will be released."
        confirmLabel="Cancel request"
        onConfirm={cancel}
        onCancel={() => setToCancel(null)}
      />
    </>
  );
}
