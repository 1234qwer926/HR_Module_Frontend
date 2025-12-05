import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';

export function AuthenticationForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentForm, setCurrentForm] = useState('login'); // 'login', 'forgot', 'reset'
  const [resetToken, setResetToken] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Check for reset token in URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setCurrentForm('reset');
      setResetToken(token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Login Form State
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });

  // Forgot Password Form State
  const [forgotForm, setForgotForm] = useState({
    email: ''
  });

  // Reset Password Form State
  const [resetForm, setResetForm] = useState({
    password: '',
    confirmPassword: ''
  });

  const API_BASE = 'http://localhost:8000';

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    if (!loginForm.username.trim()) {
      setError('Username is required');
      return;
    }
    if (loginForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
        body: new URLSearchParams({
          username: loginForm.username,
          password: loginForm.password
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Login failed');
      }

      const data = await response.json();
      login(data);
      localStorage.setItem('role', data.role);
      localStorage.setItem('user', data.username);
      localStorage.setItem('access_token', data.access_token);

      setSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        navigate('/lmsdashboard');
      }, 1000);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(null);

    if (!forgotForm.email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: forgotForm.email })
      });

      if (!response.ok) {
        throw new Error('Failed to send reset link');
      }

      setSuccess('If an account exists with this email, a password reset link has been sent. Please check your email.');
      setTimeout(() => {
        setCurrentForm('login');
        setForgotForm({ email: '' });
      }, 3000);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);

    if (resetForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (resetForm.password !== resetForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token: resetToken,
          new_password: resetForm.password
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to reset password');
      }

      setSuccess('Password reset successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle Demo Login
  const handleDemoLogin = (role) => {
    const demoUser = {
      username: `${role.toLowerCase()}_demo`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      demo: true
    };

    login(demoUser);
    localStorage.setItem('role', role);
    localStorage.setItem('user', demoUser.username);
    navigate('/lmsdashboard');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* LOGIN FORM */}
        {currentForm === 'login' && (
          <div>
            <h2 style={styles.title}>Welcome, login to continue</h2>

            {error && (
              <div style={styles.alertError}>
                <span style={{ marginRight: '8px' }}>!</span>
                <div>
                  <div>{error}</div>
                  <button
                    style={styles.closeBtn}
                    onClick={() => setError(null)}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {success && (
              <div style={styles.alertSuccess}>
                <span style={{ marginRight: '8px' }}>✓</span>
                <div>{success}</div>
              </div>
            )}

            {/* Demo Login Buttons */}
            <button
              style={styles.buttonPrimary}
              onClick={() => handleDemoLogin('ADMIN')}
              disabled={loading}
            >
              {loading ? '...' : 'Login as Admin (Demo)'}
            </button>

            <div style={styles.divider}>Or continue with</div>

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="Your username"
                  value={loginForm.username}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, username: e.target.value })
                  }
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  style={styles.input}
                  placeholder="Your password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                />
              </div>

              <button
                type="submit"
                style={{
                  ...styles.buttonPrimary,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div style={styles.footer}>
              <button
                style={styles.link}
                onClick={() => {
                  setCurrentForm('forgot');
                  setError(null);
                }}
              >
                Forgot Password?
              </button>
            </div>
          </div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {currentForm === 'forgot' && (
          <div>
            <button
              style={styles.backLink}
              onClick={() => {
                setCurrentForm('login');
                setForgotForm({ email: '' });
                setError(null);
              }}
            >
              ← Back to Login
            </button>

            <h2 style={styles.title}>Reset Password</h2>
            <p style={styles.description}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {error && (
              <div style={styles.alertError}>
                <span style={{ marginRight: '8px' }}>!</span>
                <div style={{ flex: 1 }}>{error}</div>
                <button
                  style={styles.closeBtn}
                  onClick={() => setError(null)}
                >
                  ×
                </button>
              </div>
            )}

            {success && (
              <div style={styles.alertSuccess}>
                <span style={{ marginRight: '8px' }}>✓</span>
                <div>{success}</div>
              </div>
            )}

            <form onSubmit={handleForgotPassword}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  style={styles.input}
                  placeholder="admin@example.com"
                  value={forgotForm.email}
                  onChange={(e) =>
                    setForgotForm({ ...forgotForm, email: e.target.value })
                  }
                />
              </div>

              <button
                type="submit"
                style={{
                  ...styles.buttonPrimary,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </div>
        )}

        {/* RESET PASSWORD FORM */}
        {currentForm === 'reset' && (
          <div>
            <h2 style={styles.title}>Create New Password</h2>
            <p style={styles.description}>
              Enter your new password below.
            </p>

            {error && (
              <div style={styles.alertError}>
                <span style={{ marginRight: '8px' }}>!</span>
                <div style={{ flex: 1 }}>{error}</div>
                <button
                  style={styles.closeBtn}
                  onClick={() => setError(null)}
                >
                  ×
                </button>
              </div>
            )}

            {success && (
              <div style={styles.alertSuccess}>
                <span style={{ marginRight: '8px' }}>✓</span>
                <div>{success}</div>
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div style={styles.formGroup}>
                <label style={styles.label}>New Password</label>
                <input
                  type="password"
                  style={styles.input}
                  placeholder="Enter new password"
                  value={resetForm.password}
                  onChange={(e) =>
                    setResetForm({ ...resetForm, password: e.target.value })
                  }
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  type="password"
                  style={styles.input}
                  placeholder="Confirm password"
                  value={resetForm.confirmPassword}
                  onChange={(e) =>
                    setResetForm({
                      ...resetForm,
                      confirmPassword: e.target.value
                    })
                  }
                />
              </div>

              <button
                type="submit"
                style={{
                  ...styles.buttonPrimary,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
                disabled={loading}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthenticationForm;

// Inline Styles
const styles = {
  container: {
    maxWidth: '400px',
    margin: '0 auto',
    paddingTop: '40px',
    padding: '20px'
  },
  card: {
    background: '#fffffe',
    border: '1px solid rgba(94, 82, 64, 0.2)',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
  },
  title: {
    fontSize: '18px',
    fontWeight: '500',
    margin: '0 0 20px 0',
    color: '#134252'
  },
  description: {
    fontSize: '14px',
    color: '#626c71',
    marginBottom: '16px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#134252'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid rgba(94, 82, 64, 0.2)',
    borderRadius: '8px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxSizing: 'border-box',
    transition: 'border-color 150ms, box-shadow 150ms'
  },
  alertError: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    background: 'rgba(192, 21, 47, 0.1)',
    border: '1px solid rgba(192, 21, 47, 0.3)',
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
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    color: '#15803d'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0',
    marginLeft: 'auto'
  },
  buttonPrimary: {
    width: '100%',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '8px',
    background: '#208091',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 150ms',
    marginBottom: '16px'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    margin: '20px 0',
    color: '#626c71',
    fontSize: '13px'
  },
  footer: {
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(94, 82, 64, 0.2)',
    textAlign: 'center'
  },
  link: {
    color: '#208091',
    cursor: 'pointer',
    textDecoration: 'none',
    fontWeight: '500',
    background: 'none',
    border: 'none',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px'
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#208091',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
};