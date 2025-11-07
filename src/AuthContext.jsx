// src/AuthContext.jsx
import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

// Create the context that components will consume
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialize state by reading from localStorage (persist across reloads)
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('userDetails');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // Simple boolean derived from the user state for easy login checks
  const isLoggedIn = !!user;

  // Called after a successful API response OR for demo login
  const login = (userData) => {
    localStorage.setItem('userDetails', JSON.stringify(userData));
    if (userData?.role) {
      localStorage.setItem('role', userData.role); // flat role for compatibility
    }
    Cookies.set('isLoggedIn', 'true', { path: '/' });
    setUser(userData);
  };

  // Logout clears both client and (attempts) server session
  const logout = async () => {
    try {
      // Invalidate server-side session/cookie (will be harmless in demo mode)
      await axios.post('http://localhost:8081/api/auth/logout', {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout API call failed, proceeding with client-side logout.', error);
    } finally {
      localStorage.removeItem('userDetails');
      localStorage.removeItem('role');
      Cookies.remove('isLoggedIn', { path: '/' });
      setUser(null);
    }
  };

  const value = { user, isLoggedIn, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook for convenience
export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
