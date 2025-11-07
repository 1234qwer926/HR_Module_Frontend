import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CATExam.css';

const CATExam = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState(null);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [itemStartTime, setItemStartTime] = useState(null);
  const [stats, setStats] = useState({
    itemsCompleted: 0,
    currentTheta: 0.0
  });

  useEffect(() => {
    // Get session data from navigation state or localStorage
    const session = location.state?.sessionData || JSON.parse(localStorage.getItem('cat_session'));
    
    if (!session) {
      navigate('/exam/login');
      return;
    }

    setSessionData(session);
    fetchNextItem(session.session_id);
  }, []);

  const fetchNextItem = async (sessionId) => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/cat/next-item', {
        session_id: sessionId
      });

      setCurrentItem(response.data);
      setSelectedOption('');
      setItemStartTime(Date.now());
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes('complete')) {
        // Exam is complete
        completeExam(sessionId);
      } else {
        console.error('Error fetching item:', err);
        alert('Error loading question. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
  };

  const submitAnswer = async () => {
    if (!selectedOption) {
      alert('Please select an answer before submitting.');
      return;
    }

    setSubmitting(true);
    const responseTime = Math.floor((Date.now() - itemStartTime) / 1000);

    try {
      const response = await axios.post('http://localhost:8000/cat/submit-answer', {
        session_id: sessionData.session_id,
        item_id: currentItem.item_id,
        selected_option: selectedOption,
        response_time_seconds: responseTime
      });

      // Update stats
      setStats({
        itemsCompleted: response.data.items_completed,
        currentTheta: response.data.current_theta
      });

      // Show feedback briefly
      const correct = response.data.is_correct;
      showFeedback(correct);

      // Check if should continue
      if (response.data.should_continue) {
        setTimeout(() => {
          fetchNextItem(sessionData.session_id);
        }, 1500);
      } else {
        setTimeout(() => {
          completeExam(sessionData.session_id);
        }, 1500);
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      alert('Error submitting answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const showFeedback = (correct) => {
    const feedback = document.getElementById('answer-feedback');
    feedback.className = `answer-feedback ${correct ? 'correct' : 'incorrect'} show`;
    feedback.textContent = correct ? '✓ Correct!' : '✗ Incorrect';
    
    setTimeout(() => {
      feedback.classList.remove('show');
    }, 1500);
  };

  const completeExam = async (sessionId) => {
    try {
      const response = await axios.post('http://localhost:8000/cat/complete', {
        session_id: sessionId
      });

      // Clear session data
      localStorage.removeItem('cat_session');
      
      // Navigate to results
      navigate('/exam/complete', { state: { results: response.data } });
    } catch (err) {
      console.error('Error completing exam:', err);
      alert('Error completing exam. Please contact support.');
    }
  };

  if (!sessionData) {
    return <div className="loading-container">Loading session...</div>;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p>Loading next question...</p>
      </div>
    );
  }

  if (!currentItem) {
    return <div className="loading-container">Preparing exam...</div>;
  }

  const options = ['A', 'B', 'C', 'D'];

  return (
    <div className="cat-exam-container">
      <div id="answer-feedback" className="answer-feedback"></div>
      
      <div className="exam-header">
        <div className="candidate-info">
          <h2>{sessionData.candidate_name}</h2>
          <p>{sessionData.job_title}</p>
        </div>
        
        <div className="exam-stats">
          <div className="stat-item">
            <span className="stat-label">Question</span>
            <span className="stat-value">{currentItem.item_number}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{stats.itemsCompleted}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Ability</span>
            <span className="stat-value">{stats.currentTheta.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="exam-content">
        <div className="question-card">
          <div className="question-number">
            Question {currentItem.item_number}
          </div>
          
          <div className="question-text">
            {currentItem.question}
          </div>

          <div className="options-container">
            {options.map((option) => (
              <div
                key={option}
                className={`option ${selectedOption === option ? 'selected' : ''} ${submitting ? 'disabled' : ''}`}
                onClick={() => !submitting && handleOptionSelect(option)}
              >
                <div className="option-letter">{option}</div>
                <div className="option-text">
                  {currentItem[`option_${option.toLowerCase()}`]}
                </div>
                {selectedOption === option && (
                  <div className="option-checkmark">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            className="submit-answer-button"
            onClick={submitAnswer}
            disabled={!selectedOption || submitting}
          >
            {submitting ? (
              <>
                <span className="spinner"></span>
                Submitting...
              </>
            ) : (
              'Submit Answer'
            )}
          </button>
        </div>

        <div className="exam-sidebar">
          <div className="sidebar-card">
            <h3>Instructions</h3>
            <ul>
              <li>Read each question carefully</li>
              <li>Select one answer option</li>
              <li>Click "Submit Answer" to proceed</li>
              <li>You cannot go back to previous questions</li>
            </ul>
          </div>

          <div className="sidebar-card">
            <h3>Progress</h3>
            <div className="progress-info">
              <p>The test adapts to your ability level</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(stats.itemsCompleted / 30) * 100}%` }}
                ></div>
              </div>
              <p className="progress-text">
                {stats.itemsCompleted} / 30 questions
              </p>
            </div>
          </div>

          <div className="sidebar-card ability-card">
            <h3>Current Ability Estimate</h3>
            <div className="ability-meter">
              <div className="ability-value">{stats.currentTheta.toFixed(2)}</div>
              <div className="ability-scale">
                <span>-3</span>
                <span>0</span>
                <span>+3</span>
              </div>
              <div className="ability-bar">
                <div 
                  className="ability-indicator" 
                  style={{ left: `${((stats.currentTheta + 3) / 6) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CATExam;
