import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function AuthenticationForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loginForm, setLoginForm] = useState({
    email: 'admin@pulsepharma.com',
    password: ''
  });

  const API_BASE = 'https://promptly-skill-employer-precisely.trycloudflare.com';

  /**
   * Handle Admin Login
   * Sends credentials as form data in POST body (NOT query params)
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Create form data (URLSearchParams)
      const formData = new URLSearchParams();
      formData.append('email', loginForm.email);
      formData.append('password', loginForm.password);

      console.log('📤 Sending login request...');
      console.log('   Email:', loginForm.email);
      console.log('   URL:', `${API_BASE}/auth/login`);

      // Call backend login endpoint
      const response = await fetch(
        `${API_BASE}/auth/login`,
        {
          method: 'POST',
          credentials: 'include', // ← Include cookies in request
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: formData.toString() // ← Send data in body, not query params
        }
      );

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Backend error:', errorData);
        throw new Error(errorData.detail || `Login failed: ${response.status}`);
      }

      const data = await response.json();

      console.log('✅ Login successful!');
      console.log('   Token:', data.access_token.substring(0, 20) + '...');
      console.log('   Role:', data.role);
      console.log('   Email:', data.email);
      console.log('   Expires in:', data.expires_in, 'seconds');

      // Store in localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('email', data.email);
      localStorage.setItem('userDetails', JSON.stringify({
        email: data.email,
        role: data.role,
        token: data.access_token,
        loggedInAt: new Date().toISOString(),
        expiresIn: data.expires_in
      }));

      // Update auth context
      login(data);

      // Show success message
      setSuccess('Login successful! Redirecting...');

      // Redirect after brief delay
      setTimeout(() => {
        navigate('/hr/dashboard');
      }, 500);

    } catch (err) {
      console.error('❌ Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Demo/Test Login
   */
  // const handleDemoLogin = () => {
    // const demoData = {
      // access_token: 'demo-jwt-token-for-testing',
      // token_type: 'bearer',
      // role: 'hr',
      // email: 'admin@pulsepharma.com',
      // expires_in: 604800
//     // };

    // localStorage.setItem('demo_mode', 'true');
    // login(demoData);
    // console.log('⚠️ Demo mode enabled - not using backend');
  //   // navigate('/hr/dashboard');
  // };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* HEADER */}
        <div style={styles.header}>
          <h1 style={styles.title}>Admin Login</h1>
          <p style={styles.subtitle}>HR & Recruitment Management System</p>
        </div>

        {/* ERROR ALERT */}
        {error && (
          <div style={styles.alertError}>
            <span style={{ marginRight: '8px', fontSize: '16px' }}>❌</span>
            <div style={{ flex: 1 }}>
              <strong>Error:</strong> {error}
            </div>
            <button
              style={styles.closeBtn}
              onClick={() => setError(null)}
              title="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* SUCCESS ALERT */}
        {success && (
          <div style={styles.alertSuccess}>
            <span style={{ marginRight: '8px', fontSize: '16px' }}>✅</span>
            <div style={{ flex: 1 }}>
              <strong>Success:</strong> {success}
            </div>
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin}>
          {/* Email Input */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <span>Email Address</span>
              <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <input
              type="email"
              style={styles.input}
              placeholder="admin@pulsepharma.com"
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm({ ...loginForm, email: e.target.value })
              }
              disabled
              title="Admin email is pre-configured from .env"
            />
            {/* <small style={{ color: '#7f8c8d', marginTop: '4px', display: 'block' }}>
              Pre-configured from .env (ADMIN_EMAIL)
            </small> */}
          </div>

          {/* Password Input */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <span>Password</span>
              <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            <input
              type="password"
              style={styles.input}
              placeholder="Enter your password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm({ ...loginForm, password: e.target.value })
              }
              autoFocus
              disabled={loading}
            />
            {/* <small style={{ color: '#7f8c8d', marginTop: '4px', display: 'block' }}>
              Password stored securely in .env (ADMIN_PASSWORD)
            </small> */}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            style={{
              ...styles.buttonPrimary,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', marginRight: '8px' }}>⏳</span>
                Logging in...
              </>
            ) : (
              <>
                <span style={{ display: 'inline-block', marginRight: '8px' }}>🔐</span>
                Login as Admin
              </>
            )}
          </button>
        </form>

        {/* DIVIDER */}
        <div style={styles.divider}>
          <span style={styles.dividerText}>OR</span>
        </div>

        {/* DEMO BUTTON */}
        {/* <button
          style={styles.buttonSecondary}
          onClick={handleDemoLogin}
          disabled={loading}
          title="For testing without backend"
        >
          <span style={{ display: 'inline-block', marginRight: '8px' }}>🎬</span>
          Demo Mode (Testing)
        </button> */}


      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        input:disabled {
          background: #f0f0f0;
          cursor: not-allowed;
          opacity: 0.7;
        }
        
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
        }
        
        button:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #ecf0f1 100%)'
  },

  card: {
    width: '100%',
    maxWidth: '450px',
    background: '#fffffe',
    border: '1px solid rgba(94, 82, 64, 0.15)',
    borderRadius: '12px',
    padding: '32px 24px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    animation: 'slideUp 0.3s ease-out'
  },

  header: {
    textAlign: 'center',
    marginBottom: '24px',
    borderBottom: '2px solid rgba(33, 128, 141, 0.1)',
    paddingBottom: '16px'
  },

  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#134252',
    margin: '0 0 4px 0'
  },

  subtitle: {
    fontSize: '13px',
    color: '#7f8c8d',
    margin: '0'
  },

  alertError: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    background: 'rgba(192, 21, 47, 0.08)',
    border: '1px solid rgba(192, 21, 47, 0.25)',
    color: '#c0152f'
  },

  alertSuccess: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    background: 'rgba(34, 197, 94, 0.08)',
    border: '1px solid rgba(34, 197, 94, 0.25)',
    color: '#15803d'
  },

  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 4px',
    marginLeft: 'auto',
    opacity: 0.7,
    transition: 'opacity 150ms'
  },

  formGroup: {
    marginBottom: '16px'
  },

  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#134252'
  },

  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid rgba(94, 82, 64, 0.2)',
    borderRadius: '8px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxSizing: 'border-box',
    transition: 'all 150ms ease',
    background: '#fafbfc'
  },

  buttonPrimary: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '8px',
    background: '#208091',
    color: '#fffffe',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    marginBottom: '12px',
    boxShadow: '0 2px 4px rgba(32, 128, 145, 0.2)'
  },

  buttonSecondary: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '500',
    border: '1px solid rgba(94, 82, 64, 0.2)',
    borderRadius: '8px',
    background: '#fafbfc',
    color: '#134252',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    marginBottom: '20px'
  },

  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '16px 0 20px 0'
  },

  dividerText: {
    flex: 1,
    height: '1px',
    background: 'rgba(94, 82, 64, 0.1)',
    position: 'relative',
    textAlign: 'center',
    fontSize: '12px',
    color: '#7f8c8d',
    fontWeight: '500'
  },

  footer: {
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(94, 82, 64, 0.1)',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px'
  },

  infoBox: {
    padding: '12px',
    background: 'rgba(33, 128, 141, 0.05)',
    borderRadius: '6px',
    border: '1px solid rgba(33, 128, 141, 0.1)'
  },

  securityNote: {
    marginTop: '16px',
    padding: '12px 16px',
    background: 'rgba(241, 196, 15, 0.08)',
    border: '1px solid rgba(241, 196, 15, 0.25)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#7f8c8d',
    lineHeight: '1.5'
  }
};

export default AuthenticationForm;
