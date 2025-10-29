import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

// Create the context that components will consume
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // Initialize state by reading from localStorage.
    // This makes the user's session persist across page reloads.
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('userDetails');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    // A simple boolean derived from the user state for easy login checks
    const isLoggedIn = !!user;

    // This function is called by the login form after a successful API response.
    // It updates both localStorage and the in-memory state.
    const login = (userData) => {
        localStorage.setItem('userDetails', JSON.stringify(userData));
        setUser(userData);
    };

    // The logout function ensures a complete cleanup of the user's session on the client-side.
    const logout = async () => {
        try {
            // Call the backend to invalidate the server-side session/cookie.
            await axios.post('http://localhost:8081/api/auth/logout', {}, { withCredentials: true });
        } catch (error) {
            console.error("Logout API call failed, proceeding with client-side logout.", error);
        } finally {
            // CRITICAL: Clear all traces of the user from the browser.
            localStorage.removeItem('userDetails');
            Cookies.remove('isLoggedIn', { path: '/' });
            setUser(null); // Reset the context state to null.
        }
    };

    // The value provided to consuming components.
    const value = { user, isLoggedIn, login, logout };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to make it easier to use the auth context in other components.
export function useAuth() {
    return useContext(AuthContext);
}
