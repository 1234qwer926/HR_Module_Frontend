// src/pages/auth/AuthenticationForm.jsx
import { useState } from 'react';
import {
  Anchor, Button, Checkbox, Divider, Group, Paper, PasswordInput, Stack, Text, TextInput, Alert
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useToggle, upperFirst } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import axios from 'axios';
import { useAuth } from '../../AuthContext';

export function AuthenticationForm(props) {
  const [type, toggle] = useToggle(['login', 'register']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const form = useForm({
    initialValues: { username: '', email: '', password: '', terms: true },
    validate: {
      username: (val) => (val.length > 0 ? null : 'Username is required'),
      email: (val) =>
        type === 'register'
          ? /^\S+@\S+$/.test(val) ? null : 'Invalid email'
          : null,
      password: (val) => (val.length >= 6 ? null : 'Password must be at least 6 characters'),
    },
  });

  const navigateByRole = (role, userData) => {
    // Store a flat role for compatibility with other parts of the app
    if (role) localStorage.setItem('role', role);
    // Maintain your existing navigation logic
    if (role === 'ADMIN' || role === 'HR') {
      navigate('/lmsdashboard');
    } else if ((role === 'EMPLOYEE' || role === 'USER') && !userData?.dateOfJoining) {
      navigate('/update-profile');
    } else {
      navigate('/subject');
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const endpoint = `http://localhost:8081/api/auth/${type}`;
    const payload =
      type === 'register'
        ? { username: values.username, email: values.email, password: values.password }
        : { username: values.username, password: values.password };

    try {
      if (type === 'register') {
        // REGISTER
        await axios.post(endpoint, payload, { withCredentials: true });
        setSuccess('Registration successful! Please log in.');
        toggle();
        form.reset();
      } else {
        // LOGIN
        await axios.post(endpoint, payload, { withCredentials: true });
        const userDetailsEndpoint = `http://localhost:8081/api/auth/${values.username}`;
        const userDetailsResponse = await axios.get(userDetailsEndpoint, { withCredentials: true });

        const userData = userDetailsResponse.data;
        login(userData);
        if (userData?.role) localStorage.setItem('role', userData.role);
        navigateByRole(userData?.role, userData);
      }
    } catch (err) {
      console.error(`${type} failed:`, err);
      setError(err.response?.data?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Demo login (no backend): instantly logs in as a role with sample data
  const handleDemoLogin = (role) => {
    setError(null);
    setSuccess(null);

    const demoUser = {
      username: `${role.toLowerCase()}_demo`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      dateOfJoining: role === 'EMPLOYEE' ? null : '2024-01-01',
      demo: true,
      displayName: role === 'HR' ? 'HR Manager (Demo)' : role === 'ADMIN' ? 'Admin (Demo)' : 'Employee (Demo)',
    };

    login(demoUser);
    if (demoUser.role) localStorage.setItem('role', demoUser.role);
    navigateByRole(demoUser.role, demoUser);
  };

  return (
    <Paper radius="md" p="lg" withBorder {...props} style={{ maxWidth: '400px', margin: 'auto', marginTop: '50px' }}>
      <Text size="lg" fw={500}>
        Welcome, {type} to continue
      </Text>

      {/* Quick demo logins */}
      <Stack mt="md" mb="sm" gap="xs">
        <Text size="sm" c="dimmed">Quick demo login (no backend)</Text>
        <Group grow>
          <Button variant="light" onClick={() => handleDemoLogin('HR')} disabled={loading}>
            Login as HR (Demo)
          </Button>
        </Group>
        <Group grow>
          <Button variant="default" onClick={() => handleDemoLogin('ADMIN')} disabled={loading}>
            Admin (Demo)
          </Button>
          <Button variant="default" onClick={() => handleDemoLogin('EMPLOYEE')} disabled={loading}>
            Employee (Demo)
          </Button>
        </Group>
      </Stack>

      <Divider label="Or continue with" labelPosition="center" my="lg" />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          {success && (
            <Alert
              icon={<IconCheck size="1rem" />}
              title="Success"
              color="green"
              withCloseButton
              onClose={() => setSuccess(null)}
            >
              {success}
            </Alert>
          )}
          {error && (
            <Alert
              icon={<IconAlertCircle size="1rem" />}
              title="Error"
              color="red"
              withCloseButton
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <TextInput
            required
            label="Username"
            placeholder="Your username"
            {...form.getInputProps('username')}
            radius="md"
          />
          {type === 'register' && (
            <TextInput
              required
              label="Email"
              placeholder="hello@example.com"
              {...form.getInputProps('email')}
              radius="md"
            />
          )}
          <PasswordInput
            required
            label="Password"
            placeholder="Your password"
            {...form.getInputProps('password')}
            radius="md"
          />
          {type === 'register' && (
            <Checkbox
              required
              label="I accept the terms and conditions"
              {...form.getInputProps('terms', { type: 'checkbox' })}
            />
          )}
        </Stack>

        <Group justify="space-between" mt="xl">
          <Anchor
            component="button"
            type="button"
            c="dimmed"
            onClick={() => {
              toggle();
              setError(null);
              setSuccess(null);
            }}
            size="xs"
          >
            {type === 'register'
              ? 'Already have an account? Login'
              : "Don't have an account? Register"}
          </Anchor>
          <Button type="submit" radius="xl" loading={loading}>
            {upperFirst(type)}
          </Button>
        </Group>
      </form>
    </Paper>
  );
}

export default AuthenticationForm;
