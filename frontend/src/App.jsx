import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Events from './pages/Events.jsx';
import NewEvent from './pages/NewEvent.jsx';
import EventDetail from './pages/EventDetail.jsx';
import RideDetail from './pages/RideDetail.jsx';
import MyRides from './pages/MyRides.jsx';
import MyRequests from './pages/MyRequests.jsx';
import Profile from './pages/Profile.jsx';
import Notifications from './pages/Notifications.jsx';

function Private({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Navbar />
      <main id="main" className="page">
        <Routes>
          <Route path="/" element={<Events />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/events/new" element={<Private><NewEvent /></Private>} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/rides/:id" element={<RideDetail />} />
          <Route path="/my-rides" element={<Private><MyRides /></Private>} />
          <Route path="/my-requests" element={<Private><MyRequests /></Private>} />
          <Route path="/notifications" element={<Private><Notifications /></Private>} />
          <Route path="/profile/:id" element={<Profile />} />
        </Routes>
      </main>
    </>
  );
}
