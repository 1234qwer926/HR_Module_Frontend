/**
 * Centralized API Client for HR Recruitment System
 * 
 * Features:
 * - Automatic JWT token injection
 * - Cookie-based authentication support
 * - Consistent error handling
 * - Auto-logout on 401 responses
 * - Request/response logging
 */

import axios from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://100.25.42.222:8000';

// Create axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // Include cookies in all requests
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor - Add Authorization header
apiClient.interceptors.request.use(
    (config) => {
        // Get token from localStorage
        const token = localStorage.getItem('access_token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Log request (only in development)
        if (import.meta.env.DEV) {
            console.log(`📤 ${config.method.toUpperCase()} ${config.url}`, {
                headers: config.headers,
                data: config.data,
            });
        }

        return config;
    },
    (error) => {
        console.error('❌ Request error:', error);
        return Promise.reject(error);
    }
);

// Response Interceptor - Handle errors
apiClient.interceptors.response.use(
    (response) => {
        // Log response (only in development)
        if (import.meta.env.DEV) {
            console.log(`📥 ${response.config.method.toUpperCase()} ${response.config.url}`, {
                status: response.status,
                data: response.data,
            });
        }

        return response;
    },
    (error) => {
        const { response, config } = error;

        // Log error
        console.error(`❌ ${config?.method?.toUpperCase()} ${config?.url}`, {
            status: response?.status,
            message: response?.data?.detail || error.message,
        });

        // Handle 401 Unauthorized - Auto logout
        if (response?.status === 401) {
            console.warn('⚠️ Unauthorized (401) - Token expired or invalid');

            // Clear auth data
            localStorage.removeItem('access_token');
            localStorage.removeItem('role');
            localStorage.removeItem('email');
            localStorage.removeItem('userDetails');

            // Redirect to login (only if not already on login page)
            if (!window.location.pathname.includes('/login')) {
                console.log('🔄 Redirecting to login...');
                window.location.href = '/login';
            }
        }

        // Handle 403 Forbidden
        if (response?.status === 403) {
            console.error('⛔ Forbidden (403) - Insufficient permissions');
        }

        // Handle 404 Not Found
        if (response?.status === 404) {
            console.error('🔍 Not Found (404) - Resource does not exist');
        }

        // Handle 500 Server Error
        if (response?.status === 500) {
            console.error('💥 Server Error (500) - Internal server error');
        }

        return Promise.reject(error);
    }
);

/**
 * API Helper Functions
 */

// GET request
export const get = async (url, config = {}) => {
    try {
        const response = await apiClient.get(url, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// POST request
export const post = async (url, data = {}, config = {}) => {
    try {
        const response = await apiClient.post(url, data, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// PUT request
export const put = async (url, data = {}, config = {}) => {
    try {
        const response = await apiClient.put(url, data, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// DELETE request
export const del = async (url, config = {}) => {
    try {
        const response = await apiClient.delete(url, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// PATCH request
export const patch = async (url, data = {}, config = {}) => {
    try {
        const response = await apiClient.patch(url, data, config);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * File Upload Helper
 */
export const uploadFile = async (url, file, onUploadProgress = null) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await apiClient.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress,
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Authentication Helpers
 */

// Check if user is authenticated
export const isAuthenticated = () => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('role');
    return !!(token && role);
};

// Get current user role
export const getUserRole = () => {
    return localStorage.getItem('role');
};

// Get current user email
export const getUserEmail = () => {
    return localStorage.getItem('email');
};

// Check if user is admin
export const isAdmin = () => {
    return getUserRole() === 'hr';
};

/**
 * Export default API client and helpers
 */
export default {
    client: apiClient,
    get,
    post,
    put,
    delete: del,
    patch,
    uploadFile,
    isAuthenticated,
    getUserRole,
    getUserEmail,
    isAdmin,
};
