import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './ExamComplete.css';

const ExamComplete = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);

  useEffect(() => {
    const examResults = location.state?.results;
    
    if (!examResults) {
      navigate('/exam/login');
      return;
    }

    setResults(examResults);
  }, [location.state, navigate]);

  if (!results) {
    return <div className="loading-container">Loading results...</div>;
  }

  const getAbilityColor = (level) => {
    const colors = {
      'Exceptional': '#27ae60',
      'Excellent': '#2ecc71',
      'Above Average': '#3498db',
      'Average': '#95a5a6',
      'Below Average': '#e67e22'
    };
    return colors[level] || '#95a5a6';
  };

  const getPercentileDescription = (percentile) => {
    if (percentile >= 90) return 'Top 10% of test-takers';
    if (percentile >= 75) return 'Top 25% of test-takers';
    if (percentile >= 50) return 'Above average performance';
    if (percentile >= 25) return 'Average performance';
    return 'Below average performance';
  };

  return (
    <div className="exam-complete-container">
      <div className="results-card">
        <div className="success-animation">
          <div className="checkmark-circle">
            <svg className="checkmark" viewBox="0 0 52 52">
              <circle className="checkmark-circle-path" cx="26" cy="26" r="25" fill="none"/>
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
        </div>

        <h1 className="completion-title">Exam Completed!</h1>
        <p className="completion-subtitle">
          Thank you for completing the aptitude test. Your results have been recorded.
        </p>

        <div className="results-summary">
          <div className="result-item primary">
            <div className="result-label">Ability Level</div>
            <div 
              className="result-value-large"
              style={{ color: getAbilityColor(results.ability_level) }}
            >
              {results.ability_level}
            </div>
          </div>

          <div className="results-grid">
            {/* <div className="result-item">
              <div className="result-icon">📊</div>
              <div className="result-label">Percentile</div>
              <div className="result-value">{results.percentile.toFixed(1)}%</div>
              <div className="result-description">
                {getPercentileDescription(results.percentile)}
              </div>
            </div> */}

            <div className="result-item">
              <div className="result-icon">🎯</div>
              <div className="result-label">Ability Score (θ)</div>
              <div className="result-value">{results.theta.toFixed(2)}</div>
              <div className="result-description">
                Standard Error: ±{results.se.toFixed(3)}
              </div>
            </div>

            <div className="result-item">
              <div className="result-icon">✓</div>
              <div className="result-label">Accuracy</div>
              <div className="result-value">{results.accuracy.toFixed(1)}%</div>
              <div className="result-description">
                {results.num_correct} / {results.num_items} correct
              </div>
            </div>

            <div className="result-item">
              <div className="result-icon">📝</div>
              <div className="result-label">Questions Answered</div>
              <div className="result-value">{results.num_items}</div>
              <div className="result-description">
                Adaptive test length
              </div>
            </div>
          </div>
        </div>

        <div className="theta-explanation">
          <h3>Understanding Your Score</h3>
          <div className="theta-scale">
            <div className="scale-bar">
              <div className="scale-marker" data-value="-2">-2</div>
              <div className="scale-marker" data-value="-1">-1</div>
              <div className="scale-marker" data-value="0">0</div>
              <div className="scale-marker" data-value="1">1</div>
              <div className="scale-marker" data-value="2">2</div>
              <div 
                className="scale-indicator"
                style={{ left: `${((results.theta + 3) / 6) * 100}%` }}
              >
                <span>{results.theta.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <p className="scale-description">
            The ability score (theta) typically ranges from -3 to +3, with 0 being average. 
            Your score of <strong>{results.theta.toFixed(2)}</strong> places you at the{' '}
            <strong>{results.percentile.toFixed(1)}th percentile</strong>.
          </p>
        </div>

        <div className="next-steps">
          <h3>What's Next?</h3>
          <ul>
            <li>Your results have been automatically saved to your application</li>
            <li>The HR team will review your performance</li>
            <li>You will be contacted within 5-7 business days</li>
            <li>Check your email for updates on the next steps</li>
          </ul>
        </div>

        <div className="action-buttons">
          <button 
            className="close-button"
            onClick={() => window.close()}
          >
            Close Window
          </button>
        </div>

        <div className="completion-footer">
          <p>Completed on {new Date(results.completed_at).toLocaleString()}</p>
          <p className="session-id">Session ID: {results.session_id}</p>
        </div>
      </div>
    </div>
  );
};

export default ExamComplete;
