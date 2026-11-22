import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCheck, Check } from 'lucide-react';
import { api, formatDate } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { Empty, Loading } from '../components/ui.jsx';

export default function Notifications() {
  const toast = useToast();
  const [items, setItems] = useState(null);

  function load() {
    api.get('/notifications').then(setItems).catch((err) => toast.error(err.message));
  }

  useEffect(load, []);

  async function markRead(id) {
    await api.put(`/notifications/${id}/read`);
    load();
  }

  async function markAllRead() {
    await api.put('/notifications/read-all');
    toast.success('All notifications marked as read');
    load();
  }

  const hasUnread = items && items.some((n) => !n.is_read);

  return (
    <>
      <div className="page-head">
        <h2>Notifications</h2>
        <button className="secondary" onClick={markAllRead} disabled={!hasUnread}><CheckCheck /> Mark all as read</button>
      </div>
      {items === null && <Loading text="Loading notifications" />}
      {items && items.length === 0 && <Empty icon={BellOff} title="You are all caught up">New ride requests and updates show up here.</Empty>}
      {items && items.map((n) => (
        <div key={n.id} className={`card row between ${n.is_read ? 'read' : 'unread'}`}>
          <div className="row">
            <span className="card-icon" style={{ marginBottom: 0 }}><Bell size={20} /></span>
            <div>
              <p>{n.message}</p>
              <p className="muted">{formatDate(n.created_at)}</p>
            </div>
          </div>
          {!n.is_read && <button className="secondary small" onClick={() => markRead(n.id)}><Check /> Mark read</button>}
        </div>
      ))}
    </>
  );
}
