async function request(method, path, body) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body || {}),
  put: (path, body) => request('PUT', path, body || {}),
  del: (path) => request('DELETE', path),
};

export function formatDate(value) {
  if (!value) return '';
  return new Date(value.replace(' ', 'T')).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function toInputValue(value) {
  return value ? value.replace(' ', 'T').slice(0, 16) : '';
}
