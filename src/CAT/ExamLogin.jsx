import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ExamLogin.css';

const ExamLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    cat_exam_key: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:8000/cat/start', formData);
      
      // Store session info
      localStorage.setItem('cat_session', JSON.stringify(response.data));
      
      // Navigate to exam
      navigate('/exam', { state: { sessionData: response.data } });
    } catch (err) {
      if (err.response) {
        setError(err.response.data.detail || 'Invalid credentials');
      } else {
        setError('Unable to connect to server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="exam-login-container">
      <div className="exam-login-card">
        <div className="exam-header">
          <div className="header-icon">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#3498db">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1>Aptitude Test Login</h1>
          <p>Enter your credentials to begin the exam</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your.email@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cat_exam_key">Access Key</label>
            <input
              type="text"
              id="cat_exam_key"
              name="cat_exam_key"
              value={formData.cat_exam_key}
              onChange={handleChange}
              placeholder="Enter your 8-character access key"
              maxLength="8"
              required
              disabled={loading}
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          {error && (
            <div className="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                Verifying...
              </>
            ) : (
              <>
                Begin Exam
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="exam-info">
          <h3>Exam Information</h3>
          <ul>
            <li>📝 Adaptive test with 10-30 questions</li>
            <li>⏱️ No time limit per question</li>
            <li>🎯 Difficulty adjusts based on your performance</li>
            <li>⚠️ You cannot go back to previous questions</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExamLogin;
