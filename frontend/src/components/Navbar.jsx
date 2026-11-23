import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Car, CalendarDays, Route, Ticket, Bell, UserRound, LogOut, LogIn, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

function Item({ to, icon: Icon, label, end, badge }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} aria-label={label}>
      <Icon size={20} />
      <span className="nav-label">{label}</span>
      {badge > 0 && <span className="badge">{badge}</span>}
    </NavLink>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = () => api.get('/notifications/unread-count').then((data) => setUnread(data.unread)).catch(() => {});
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [user]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar" aria-label="Main">
      <Link to="/" className="brand">
        <span className="brand-mark"><Car size={20} /></span>
        RideSync
      </Link>
      <div className="links">
        <Item to="/" end icon={CalendarDays} label="Events" />
        {user ? (
          <>
            <Item to="/my-rides" icon={Route} label="My Rides" />
            <Item to="/my-requests" icon={Ticket} label="My Requests" />
            <Item to="/notifications" icon={Bell} label="Notifications" badge={unread} />
            <Item to={`/profile/${user.id}`} icon={UserRound} label={user.name} />
            <button className="nav-link" onClick={handleLogout} aria-label="Log out">
              <LogOut size={20} />
              <span className="nav-label">Log out</span>
            </button>
          </>
        ) : (
          <>
            <Item to="/login" icon={LogIn} label="Log in" />
            <Item to="/register" icon={UserPlus} label="Register" />
          </>
        )}
      </div>
    </nav>
  );
}
