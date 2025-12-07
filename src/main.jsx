import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';

// Import Mantine styles
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MantineProvider
        withGlobalStyles
        withNormalizeCSS
        theme={{
          colorScheme: 'light',
          primaryColor: 'blue',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <ModalsProvider>
          <Notifications position="top-right" zIndex={2077} />
          <AuthProvider>
            <App />
          </AuthProvider>
        </ModalsProvider>
      </MantineProvider>
    </BrowserRouter>
  </React.StrictMode>
);
