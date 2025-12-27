import React from 'react';

const ErrorPage = () => {
  return (
    <div style={styles.container}>
      <h1 style={styles.code}>404</h1>
      <h2 style={styles.message}>Page Not Found</h2>
      <p style={styles.text}>
        The page you are looking for doesn’t exist or has been moved.
      </p>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif',
  },
  code: {
    fontSize: '6rem',
    margin: 0,
  },
  message: {
    margin: 0,
  },
  text: {
    color: '#555',
  },
};

export default ErrorPage;
