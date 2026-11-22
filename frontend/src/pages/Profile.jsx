import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Car, Ticket, MessageSquare, Star } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { Avatar, Empty, Loading, Stars } from '../components/ui.jsx';

export default function Profile() {
  const { id } = useParams();
  const toast = useToast();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get(`/users/${id}`).then(setProfile).catch((err) => toast.error(err.message));
  }, [id]);

  if (!profile) return <Loading text="Loading profile" />;

  return (
    <>
      <div className="card row">
        <Avatar name={profile.name} big />
        <div>
          <h2>{profile.name}</h2>
          <p>
            <Stars value={profile.avg_rating} />
            {profile.avg_rating && <span className="muted"> from {profile.rating_count} ratings</span>}
          </p>
          <p className="meta"><Car /> {profile.rides_driven} rides driven <Ticket /> {profile.rides_taken} rides taken</p>
        </div>
      </div>
      <div className="page-head"><h3>Latest reviews</h3></div>
      {profile.reviews.length === 0 && <Empty icon={MessageSquare} title="No reviews yet">Reviews appear after a completed ride.</Empty>}
      {profile.reviews.map((r) => (
        <div key={r.id} className="card">
          <p className="row"><span className="stars"><Star /> {r.stars}</span> <span>from {r.rater_name}</span> <span className="muted">{r.event_name}</span></p>
          {r.comment && <p>{r.comment}</p>}
        </div>
      ))}
    </>
  );
}
