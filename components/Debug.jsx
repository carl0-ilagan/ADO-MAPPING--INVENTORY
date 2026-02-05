'use client';

export function Debug() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ SET' : '❌ MISSING',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'MISSING',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✓ SET' : 'MISSING',
    seedEnabled: process.env.NEXT_PUBLIC_SEED_ADMIN,
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      background: '#1a1a1a',
      color: '#fff',
      padding: '10px',
      fontSize: '12px',
      fontFamily: 'monospace',
      borderRadius: '4px 0 0 0',
      maxWidth: '300px',
      maxHeight: '200px',
      overflow: 'auto',
      zIndex: 9999,
      border: '2px solid #F2C94C'
    }}>
      <div><strong>Firebase Config:</strong></div>
      <div>API Key: {config.apiKey}</div>
      <div>Auth Domain: {config.authDomain}</div>
      <div>Project ID: {config.projectId}</div>
      <div>App ID: {config.appId}</div>
      <div style={{ marginTop: '10px' }}>
        <strong>Seed:</strong> {config.seedEnabled === 'true' ? '✓ Enabled' : '❌ Disabled'}
      </div>
    </div>
  );
}
