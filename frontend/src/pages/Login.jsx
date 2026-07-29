import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGamificationStore } from '../store/gamificationStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const navigate = useNavigate();

  const isEmailInvalid = email.length > 0 && !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email.toLowerCase());

  const handleLogin = (e) => {
    e.preventDefault();
    
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      alert('ACCESS DENIED: Operator ID must be a @gmail.com address.');
      return;
    }
    if (!/^\d{8}$/.test(password)) {
      alert('ACCESS DENIED: Security Key must be exactly an 8-digit PIN.');
      return;
    }

    setIsAuthenticating(true);
    
    localStorage.setItem('chippulse_username', username);
    useGamificationStore.setState({ username });

    // Simulate network request
    setTimeout(() => {
      navigate('/workspace');
    }, 1200);
  };

  return (
    <div style={{ 
      background: '#20252b', 
      minHeight: '100vh', 
      width: '100vw', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: '"Orbitron", sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      
      {/* Background HUD lines */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.1 }}>
        <div style={{ position: 'absolute', top: '10%', left: 0, width: '100%', height: 1, background: '#c9c4a5' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: 0, width: '100%', height: 1, background: '#c9c4a5' }} />
        <div style={{ position: 'absolute', left: '10%', top: 0, width: 1, height: '100%', background: '#c9c4a5' }} />
        <div style={{ position: 'absolute', right: '10%', top: 0, width: 1, height: '100%', background: '#c9c4a5' }} />
      </div>

      {/* Decorative corners */}
      <div style={{ position: 'absolute', top: 40, left: 60, color: '#c9c4a5', fontSize: 12, letterSpacing: '0.2em' }}>SYS.AUTH.01</div>
      <div style={{ position: 'absolute', bottom: 40, right: 60, color: '#c9c4a5', fontSize: 12, letterSpacing: '0.2em' }}>SECURE CONNECTION</div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          width: 400,
          padding: 40,
          background: 'rgba(32, 37, 43, 0.85)',
          border: '1px solid rgba(201,196,165,0.3)',
          boxShadow: '0 0 40px rgba(0,0,0,0.5)',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Box corner accents */}
        <div style={{ position: 'absolute', top: -1, left: -1, width: 10, height: 10, borderTop: '2px solid #c9c4a5', borderLeft: '2px solid #c9c4a5' }} />
        <div style={{ position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderTop: '2px solid #c9c4a5', borderRight: '2px solid #c9c4a5' }} />
        <div style={{ position: 'absolute', bottom: -1, left: -1, width: 10, height: 10, borderBottom: '2px solid #c9c4a5', borderLeft: '2px solid #c9c4a5' }} />
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderBottom: '2px solid #c9c4a5', borderRight: '2px solid #c9c4a5' }} />

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 24, color: '#c9c4a5', letterSpacing: '0.15em', fontWeight: 500 }}>CHIPPULSE</div>
          <div style={{ fontSize: 10, color: '#b5b095', letterSpacing: '0.3em', marginTop: 8 }}>RESTRICTED ACCESS</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 10, color: '#b5b095', letterSpacing: '0.1em', textTransform: 'uppercase' }}>OPERATOR NAME / ALIAS</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              title="Must be at least 3 characters"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(201,196,165,0.2)',
                padding: '12px 16px',
                color: '#c9c4a5',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: 14,
                letterSpacing: '0.05em',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#c9c4a5'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(201,196,165,0.2)'}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 10, color: '#b5b095', letterSpacing: '0.1em', textTransform: 'uppercase' }}>OPERATOR ID / EMAIL</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              pattern="^[a-zA-Z0-9._%+-]+@gmail\.com$"
              title="Must be a valid @gmail.com address"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: `1px solid ${isEmailInvalid ? '#ef4444' : (isEmailFocused ? '#c9c4a5' : 'rgba(201,196,165,0.2)')}`,
                padding: '12px 16px',
                color: isEmailInvalid ? '#ef4444' : '#c9c4a5',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: 14,
                letterSpacing: '0.05em',
                transition: 'border-color 0.2s, color 0.2s',
                outline: 'none'
              }}
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 10, color: '#b5b095', letterSpacing: '0.1em', textTransform: 'uppercase' }}>SECURITY KEY</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              pattern="\d{8}"
              maxLength={8}
              title="Must be exactly an 8-digit PIN"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(201,196,165,0.2)',
                padding: '12px 16px',
                color: '#c9c4a5',
                fontFamily: '"Orbitron", sans-serif',
                fontSize: 14,
                letterSpacing: '0.2em',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#c9c4a5'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(201,196,165,0.2)'}
            />
          </div>

          <button 
            type="submit"
            disabled={isAuthenticating}
            style={{
              marginTop: 16,
              padding: '14px',
              background: isAuthenticating ? '#b5b095' : 'transparent',
              border: '1px solid #c9c4a5',
              color: isAuthenticating ? '#20252b' : '#c9c4a5',
              fontFamily: '"Orbitron", sans-serif',
              fontSize: 12,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: isAuthenticating ? 'default' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { if(!isAuthenticating) { e.currentTarget.style.background = '#c9c4a5'; e.currentTarget.style.color = '#20252b'; } }}
            onMouseOut={(e) => { if(!isAuthenticating) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9c4a5'; } }}
          >
            {isAuthenticating ? 'VERIFYING PROTOCOL...' : 'AUTHENTICATE'}
          </button>

        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link to="/" style={{ fontSize: 10, color: '#b5b095', letterSpacing: '0.1em', textDecoration: 'none', opacity: 0.7, transition: 'opacity 0.2s' }}
            onMouseOver={(e) => e.target.style.opacity = 1}
            onMouseOut={(e) => e.target.style.opacity = 0.7}
          >
            &lt; ABORT &amp; RETURN
          </Link>
        </div>

      </motion.div>
    </div>
  );
}
