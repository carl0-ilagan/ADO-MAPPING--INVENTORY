'use client';
import { useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getApp() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}
function getDb() { return getFirestore(getApp()); }
function getAuthInstance() { return getAuth(getApp()); }

export default function CleanupPage() {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [counts, setCounts] = useState(null);
  const [user, setUser] = useState(undefined); // undefined = checking, null = not logged in
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const addLog = (msg) => setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);

  // Wait for existing auth session (persisted from main app)
  useEffect(() => {
    const auth = getAuthInstance();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      if (u) {
        addLog(`Signed in as: ${u.email}`);
        // fetch counts immediately once we have auth
        const db = getDb();
        getDocs(collection(db, 'cp_projects')).then((snap) => {
          const c = {};
          snap.forEach((d) => { const s = d.data().status || '(no status)'; c[s] = (c[s] || 0) + 1; });
          c._total = snap.size;
          setCounts(c);
          addLog(`Firestore has ${snap.size} total cp_projects records: ${JSON.stringify(c)}`);
        }).catch((e) => addLog(`ERROR fetching counts: ${e.message}`));
      }
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const auth = getAuthInstance();
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const fetchCounts = async () => {
    try {
      const db = getDb();
      const snap = await getDocs(collection(db, 'cp_projects'));
      const counts = {};
      snap.forEach((d) => {
        const s = d.data().status || '(no status)';
        counts[s] = (counts[s] || 0) + 1;
      });
      counts._total = snap.size;
      setCounts(counts);
      addLog(`Firestore has ${snap.size} total cp_projects records: ${JSON.stringify(counts)}`);
    } catch (e) {
      addLog(`ERROR fetching counts: ${e.message}`);
    }
  };

  const deleteByStatus = async (status) => {
    if (running) return;
    setRunning(true);
    try {
      const db = getDb();
      addLog(`Querying cp_projects where status == '${status}'...`);
      const snap = await getDocs(query(collection(db, 'cp_projects'), where('status', '==', status)));
      addLog(`Found ${snap.size} records with status='${status}'`);
      if (snap.size === 0) { addLog('Nothing to delete.'); setRunning(false); return; }

      const docs = snap.docs;
      let deleted = 0;
      const CHUNK = 450; // Firestore batch max is 500
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + CHUNK);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += chunk.length;
        addLog(`Deleted ${deleted}/${docs.length}...`);
      }
      addLog(`✅ Done — deleted ${deleted} '${status}' records.`);
      await fetchCounts();
    } catch (e) {
      addLog(`ERROR: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const deleteNoStatus = async () => {
    if (running) return;
    setRunning(true);
    try {
      const db = getDb();
      addLog(`Fetching ALL cp_projects to find records with no status...`);
      const snap = await getDocs(collection(db, 'cp_projects'));
      const noStatus = snap.docs.filter((d) => !d.data().status);
      addLog(`Found ${noStatus.length} records with no status field`);
      if (noStatus.length === 0) { addLog('Nothing to delete.'); setRunning(false); return; }

      let deleted = 0;
      const CHUNK = 450;
      for (let i = 0; i < noStatus.length; i += CHUNK) {
        const batch = writeBatch(db);
        const chunk = noStatus.slice(i, i + CHUNK);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += chunk.length;
        addLog(`Deleted ${deleted}/${noStatus.length}...`);
      }
      addLog(`✅ Done — deleted ${deleted} records with no status.`);
      await fetchCounts();
    } catch (e) {
      addLog(`ERROR: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const deleteAll = async () => {
    if (running) return;
    if (!window.confirm('DELETE ALL cp_projects records? This cannot be undone!')) return;
    setRunning(true);
    try {
      const db = getDb();
      addLog('Fetching ALL cp_projects...');
      const snap = await getDocs(collection(db, 'cp_projects'));
      addLog(`Found ${snap.size} total records`);
      if (snap.size === 0) { addLog('Nothing to delete.'); setRunning(false); return; }

      let deleted = 0;
      const CHUNK = 450;
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + CHUNK);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += chunk.length;
        addLog(`Deleted ${deleted}/${docs.length}...`);
      }
      addLog(`✅ Done — deleted all ${deleted} records.`);
      setCounts(null);
    } catch (e) {
      addLog(`ERROR: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  if (user === undefined) {
    return <div style={{ fontFamily: 'monospace', padding: 32 }}>⏳ Checking auth...</div>;
  }

  if (user === null) {
    return (
      <div style={{ fontFamily: 'monospace', padding: 32, maxWidth: 400, margin: '60px auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>🔐 Sign in to use Cleanup Tool</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14 }} />
          </div>
          {loginError && <p style={{ color: 'red', fontSize: 13, marginBottom: 12 }}>{loginError}</p>}
          <button type="submit" style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
            Sign In
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: '#888' }}>Use the same credentials as the main app.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>🗑️ cp_projects Cleanup Tool</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Use this page to delete records from Firestore before a clean re-import.
        You must be logged in to the app for Firebase auth to work.
      </p>

      {counts && (
        <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <strong>Current cp_projects counts:</strong>
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
            {Object.entries(counts).map(([k, v]) => (
              <li key={k}>{k}: <strong>{v}</strong></li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          disabled={running}
          onClick={() => deleteByStatus('Ongoing')}
          style={{ padding: '10px 20px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
        >
          Delete ALL Ongoing
        </button>
        <button
          disabled={running}
          onClick={() => deleteByStatus('Pending')}
          style={{ padding: '10px 20px', background: '#eab308', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
        >
          Delete ALL Pending
        </button>
        <button
          disabled={running}
          onClick={deleteNoStatus}
          style={{ padding: '10px 20px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
        >
          Delete records with no status
        </button>
        <button
          disabled={running}
          onClick={fetchCounts}
          style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
        >
          Refresh Counts
        </button>
        <button
          disabled={running}
          onClick={deleteAll}
          style={{ padding: '10px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
        >
          ⚠ Delete ALL (every record)
        </button>
      </div>

      <div style={{ background: '#111', color: '#4ade80', borderRadius: 8, padding: 16, minHeight: 200, maxHeight: 400, overflowY: 'auto', fontSize: 13 }}>
        {log.length === 0 && <span style={{ color: '#888' }}>Logs will appear here...</span>}
        {log.map((l, i) => <div key={i}>{l}</div>)}
        {running && <div style={{ color: '#facc15' }}>⏳ Running...</div>}
      </div>

      <p style={{ color: '#999', marginTop: 16, fontSize: 12 }}>
        After deleting, go back to <a href="/" style={{ color: '#6366f1' }}>the main app</a>, 
        then import your Excel file using &quot;⚠ Replace All Ongoing (Overwrite)&quot; or &quot;Add&quot;.
      </p>
    </div>
  );
}
