import { useState, useEffect, useCallback } from 'react';

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const EMPTY = { product_name: '', description: '', price: '', quantity: '' };

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'));
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [login, setLogin] = useState({ username: '', password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const logout = useCallback(async (silent) => {
    if (!silent && token) {
      try { await fetch(`${API}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch {}
    }
    localStorage.removeItem('access_token');
    setToken(null);
    setProducts([]);
  }, [token]);

  const call = useCallback(async (path, method = 'GET', body) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) { logout(true); throw new Error('Session expired. Log in again.'); }
    if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
    return data;
  }, [token, logout]);

  const load = useCallback(async () => {
    try {
      const d = await call('/products');
      setProducts(Array.isArray(d) ? d : d.data || d.products || []);
    } catch (e) { setMsg(e.message); }
  }, [call]);

  useEffect(() => { if (token) load(); }, [token, load]);

  async function doLogin(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(login),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.access_token) throw new Error(d.error || 'Wrong username or password.');
      localStorage.setItem('access_token', d.access_token);
      setToken(d.access_token);
      setLogin({ username: '', password: '' });
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }

  async function save(e) {
    e.preventDefault();
    setMsg('');
    const body = { ...form, price: Number(form.price), quantity: parseInt(form.quantity, 10) };
    try {
      await call(editId ? `/products/${editId}` : '/products', editId ? 'PUT' : 'POST', body);
      setMsg(editId ? 'Product updated.' : 'Product added.');
      setForm(EMPTY); setEditId(null);
      load();
    } catch (err) { setMsg(err.message); }
  }

  async function remove(p) {
    if (!window.confirm(`Delete "${p.product_name}"?`)) return;
    try { await call(`/products/${p.id}`, 'DELETE'); setMsg('Product deleted.'); load(); }
    catch (err) { setMsg(err.message); }
  }

  function edit(p) {
    setEditId(p.id);
    setForm({ product_name: p.product_name, description: p.description || '', price: p.price, quantity: p.quantity });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!token) {
    return (
      <main className="wrap narrow">
        <h1>Sign in</h1>
        <form onSubmit={doLogin} className="panel">
          <label>Username<input value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} required autoFocus /></label>
          <label>Password<input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required /></label>
          <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          {msg && <p className="msg err">{msg}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header className="bar">
        <h1>Products</h1>
        <button className="ghost" onClick={() => logout(false)}>Log out</button>
      </header>

      <form onSubmit={save} className="panel grid">
        <h2>{editId ? `Edit product #${editId}` : 'Add a product'}</h2>
        <label>Name<input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} required /></label>
        <label>Price<input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
        <label>Quantity<input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label>
        <label className="full">Description<textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <div className="full row">
          <button>{editId ? 'Save changes' : 'Add product'}</button>
          {editId && <button type="button" className="ghost" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</button>}
        </div>
      </form>

      {msg && <p className="msg">{msg}</p>}

      <div className="scroll">
        <table>
          <thead><tr><th>Name</th><th>Description</th><th className="num">Price</th><th className="num">Qty</th><th></th></tr></thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan="5" className="empty">No products yet. Add your first one above.</td></tr>}
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.product_name}</td>
                <td>{p.description}</td>
                <td className="num">{Number(p.price).toFixed(2)}</td>
                <td className="num">{p.quantity}</td>
                <td className="row">
                  <button className="ghost" onClick={() => edit(p)}>Edit</button>
                  <button className="danger" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
