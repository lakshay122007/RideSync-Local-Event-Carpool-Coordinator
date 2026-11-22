import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car, LogIn } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorText } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.post('/auth/login', form);
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card form" onSubmit={handleSubmit}>
        <span className="brand-mark"><Car size={26} /></span>
        <div>
          <h2>Welcome back</h2>
          <p className="muted">Log in to find or offer a ride to your next event.</p>
        </div>
        <ErrorText>{error}</ErrorText>
        <label>Email
          <input type="email" required autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Password
          <input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button disabled={busy}><LogIn /> {busy ? 'Logging in...' : 'Log in'}</button>
        <p className="muted">New here? <Link to="/register">Create an account</Link></p>
        <p className="muted">Demo: aarav@demo.com / password123</p>
      </form>
    </div>
  );
}
