import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorText } from '../components/ui.jsx';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.post('/auth/register', form);
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
          <h2>Create your account</h2>
          <p className="muted">Share rides, split fuel costs, reach events together.</p>
        </div>
        <ErrorText>{error}</ErrorText>
        <label>Name
          <input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>Email
          <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Password
          <input type="password" minLength={6} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <span className="hint muted">At least 6 characters</span>
        </label>
        <button disabled={busy}><UserPlus /> {busy ? 'Creating...' : 'Register'}</button>
        <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
