/**
 * ProtectedRoute Component
 * 
 * Wrapper component for admin-only routes.
 * Redirects to /login if user is not authenticated.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Container, Loader, Center, Text, Stack } from '@mantine/core';

export default function ProtectedRoute({ children }) {
    const { user, isLoggedIn, isVerifying } = useAuth();

    // Show loading state while verifying token
    if (isVerifying) {
        return (
            <Container size="xl" py="xl">
                <Center style={{ minHeight: '60vh' }}>
                    <Stack align="center" spacing="md">
                        <Loader size="lg" />
                        <Text size="sm" color="dimmed">
                            Verifying authentication...
                        </Text>
                    </Stack>
                </Center>
            </Container>
        );
    }

    // Redirect to login if not authenticated
    if (!isLoggedIn || !user) {
        console.warn('⚠️ Protected route accessed without authentication - redirecting to /login');
        return <Navigate to="/login" replace />;
    }

    // Check if user has admin role
    if (user.role !== 'hr') {
        console.error('⛔ Access denied - Admin role required');
        return (
            <Container size="xl" py="xl">
                <Center style={{ minHeight: '60vh' }}>
                    <Stack align="center" spacing="md">
                        <Text size="xl" weight={600} color="red">
                            Access Denied
                        </Text>
                        <Text size="sm" color="dimmed">
                            You do not have permission to access this page.
                        </Text>
                        <Text size="sm" color="dimmed">
                            Admin role required.
                        </Text>
                    </Stack>
                </Center>
            </Container>
        );
    }

    // User is authenticated and has admin role - render children
    return <>{children}</>;
}
