import React from 'react';

const sidebarLinks = [
  { label: 'Library', href: '/library' },
  { label: 'Search', href: '/search' },
  { label: 'Upload', href: '/upload' },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', height: '100vh', background: 'linear-gradient(to bottom, #181818, #282828 80%)' }}>
    <aside style={{
      width: 200,
      background: '#111',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      borderRight: '1px solid #222'
    }}>
      {sidebarLinks.map(link => (
        <a
          key={link.href}
          href={link.href}
          style={{
            padding: '12px 24px',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 500,
            marginBottom: 8,
            borderRadius: 4,
            transition: 'background 0.2s',
          }}
        >
          {link.label}
        </a>
      ))}
    </aside>
    <main style={{
      flex: 1,
      overflowY: 'auto',
      padding: '32px',
      position: 'relative',
      minHeight: 0,
    }}>
      {children}
    </main>
    <div style={{
      position: 'fixed',
      left: 200,
      right: 0,
      bottom: 0,
      height: 64,
      background: 'rgba(24,24,24,0.95)',
      borderTop: '1px solid #222',
      display: 'flex',
      alignItems: 'center',
      padding: '0 32px',
      zIndex: 10,
    }}>
      {/* AudioPlayer goes here */}
      <span style={{ color: '#aaa' }}>Player Bar Placeholder</span>
    </div>
  </div>
);

export default AppLayout;
