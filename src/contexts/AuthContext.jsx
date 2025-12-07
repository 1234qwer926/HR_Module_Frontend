import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialize state from localStorage
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('userDetails');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [isVerifying, setIsVerifying] = useState(true);
  const isLoggedIn = !!user;

  // Setup axios interceptors ONCE on mount (not in every request)
  useEffect(() => {
    console.log('🔧 Setting up Axios interceptors...');
    
    // Configure axios defaults
    axios.defaults.baseURL = 'http://localhost:8000';
    axios.defaults.withCredentials = true;

    // Add request interceptor to add Authorization header
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle 401 errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.warn('⚠️ Unauthorized - Token expired or invalid');
          logout();
        }
        return Promise.reject(error);
      }
    );

    // Cleanup: Remove interceptors on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!user) {
        setIsVerifying(false);
        return;
      }

      setIsVerifying(true);
      try {
        const response = await axios.get('/auth/verify', {
          withCredentials: true
        });

        if (response.data.valid) {
          console.log('✅ Token verified - user still logged in');
        }
      } catch (error) {
        console.log('❌ Token invalid or expired - logging out');
        logout();
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();

    // Verify token every 60 minutes
    const interval = setInterval(() => {
      if (user) {
        verifyToken();
      }
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  /**
   * Login function
   * Stores user data and sets Authorization header
   */
  const login = (userData) => {
    const userDetails = {
      email: userData.email,
      role: userData.role,
      token: userData.access_token,
      loggedInAt: new Date().toISOString(),
      expiresIn: userData.expires_in
    };

    // Store in localStorage
    localStorage.setItem('userDetails', JSON.stringify(userDetails));
    localStorage.setItem('role', userData.role);
    localStorage.setItem('email', userData.email);
    localStorage.setItem('access_token', userData.access_token);

    // Update axios default header
    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.access_token}`;

    console.log('✅ Login successful');
    console.log('   Email:', userData.email);
    console.log('   Role:', userData.role);
    console.log('   Cookies set by backend: access_token, user_role, user_email (7 days)');

    setUser(userDetails);
  };

  /**
   * Logout function
   * Clears user data and tokens
   */
  const logout = async () => {
    try {
      // Call backend logout endpoint
      await axios.post('/auth/logout', {}, {
        withCredentials: true
      });
      console.log('✅ Server logout successful - cookies cleared');
    } catch (error) {
      console.warn('⚠️ Server logout failed (proceeding with client logout):', error.message);
    } finally {
      // Clear client-side data
      localStorage.removeItem('userDetails');
      localStorage.removeItem('role');
      localStorage.removeItem('email');
      localStorage.removeItem('access_token');
      localStorage.removeItem('demo_mode');

      // Clear axios header
      delete axios.defaults.headers.common['Authorization'];

      console.log('✅ Client logout complete - user data cleared');
      setUser(null);
    }
  };

  /**
   * Get current user from backend
   */
  const getCurrentUser = async () => {
    try {
      const response = await axios.get('/auth/me', {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get current user:', error.message);
      return null;
    }
  };

  /**
   * Refresh token if needed
   */
  const refreshToken = async () => {
    try {
      const response = await axios.get('/auth/verify', {
        withCredentials: true
      });

      if (response.data.valid) {
        console.log('✅ Token still valid');
        return true;
      }
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      logout();
      return false;
    }
  };

  // Context value
  const value = {
    user,
    isLoggedIn,
    isVerifying,
    login,
    logout,
    getCurrentUser,
    refreshToken,
    // For debugging
    getStoredRole: () => localStorage.getItem('role'),
    getStoredEmail: () => localStorage.getItem('email'),
    getStoredToken: () => localStorage.getItem('access_token')
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;
