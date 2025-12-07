import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs';
import './CATExam.css';

const CATExam = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const debugLog = (stage, data) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [FACE-DETECT] ${stage}:`, data);
  };

  // STATE MANAGEMENT
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

  const [showPermissionDialog, setShowPermissionDialog] = useState(true);
  const [setupStage, setSetupStage] = useState('instructions');
  const [cameraActive, setCameraActive] = useState(false);
  const [screenActive, setScreenActive] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  
  // TIMER STATE
  const [timeLeft, setTimeLeft] = useState(40 * 60); // 40 minutes in seconds

  // FACE DETECTION STATE
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadingError, setModelLoadingError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [faceWarnings, setFaceWarnings] = useState(0);
  const [isFaceMonitoring, setIsFaceMonitoring] = useState(false);
  const [lightingQuality, setLightingQuality] = useState('unknown');
  const [detectionDebug, setDetectionDebug] = useState('');

  const [windowWarnings, setWindowWarnings] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [screenSharingActive, setScreenSharingActive] = useState(false);

  // REFS & STATE FOR MEDIA STREAM
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const screenStreamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const modelRetryCountRef = useRef(0);
  const tfBackendReadyRef = useRef(false);
  const timerIntervalRef = useRef(null);

  // ============================================================
  // INITIALIZE TENSORFLOW BACKEND
  // ============================================================
  useEffect(() => {
    const initTensorFlow = async () => {
      try {
        debugLog('TF_BACKEND_INIT', 'Initializing TensorFlow backend');
        try {
          await tf.setBackend('webgl');
          await tf.ready();
          tfBackendReadyRef.current = true;
          debugLog('TF_BACKEND_SUCCESS', 'WebGL backend initialized');
        } catch (webglErr) {
          debugLog('TF_BACKEND_WEBGL_FAIL', webglErr.message);
          await tf.setBackend('cpu');
          await tf.ready();
          tfBackendReadyRef.current = true;
          debugLog('TF_BACKEND_FALLBACK', 'CPU backend initialized');
        }
      } catch (err) {
        debugLog('TF_BACKEND_ERROR', err.message);
        setModelLoadingError('TensorFlow initialization failed');
      }
    };
    initTensorFlow();
  }, []);

  // ============================================================
  // CLEANUP ALL STREAMS & RESOURCES
  // ============================================================
  const cleanupAllResources = () => {
    debugLog('CLEANUP_START', 'Cleaning up all resources...');

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.();
      }
    } catch (err) {
      debugLog('CLEANUP_FULLSCREEN_ERROR', err.message);
    }

    setIsFaceMonitoring(false);
    setCameraActive(false);
    setScreenSharingActive(false);
    debugLog('CLEANUP_COMPLETE', 'All resources cleaned up successfully');
  };

  // ============================================================
  // ROUTE CHANGES
  // ============================================================
  useEffect(() => {
    if (!location.pathname.includes('/exam')) {
      cleanupAllResources();
    }
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      cleanupAllResources();
    };
  }, []);

  // ============================================================
  // TIMER LOGIC
  // ============================================================
  useEffect(() => {
    if (examStarted && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerIntervalRef.current);
            handleTimeUp();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [examStarted]);

  const handleTimeUp = () => {
    debugLog('TIME_UP', '40 minutes elapsed. Auto-submitting exam.');
    showWarning('Time is up! Submitting your exam...');
    if (sessionData) {
        completeExam(sessionData.session_id);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ============================================================
  // LOAD FACE-API MODELS
  // ============================================================
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoadingError(null);
        const MODEL_URL = '/models/';
        
        let attempts = 0;
        while (!tfBackendReadyRef.current && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        setModelsLoaded(true);
        modelRetryCountRef.current = 0;
      } catch (err) {
        setModelLoadingError(`Model loading failed: ${err.message}`);
        if (modelRetryCountRef.current < 3) {
          modelRetryCountRef.current += 1;
          setTimeout(loadModels, 2000);
        }
      }
    };

    if (!modelsLoaded && modelRetryCountRef.current === 0) {
      loadModels();
    }
  }, [modelsLoaded]);

  // ============================================================
  // INITIALIZE SESSION
  // ============================================================
  useEffect(() => {
    const session = location.state?.sessionData || JSON.parse(localStorage.getItem('cat_session') || 'null');
    if (!session) {
      navigate('/exam/login');
      return;
    }
    setSessionData(session);
    setLoading(false);
  }, [location.state, navigate]);

  // ============================================================
  // ATTACH STREAM TO VIDEO ELEMENT
  // ============================================================
  useEffect(() => {
    if (!cameraStream) return;

    const attachStream = async () => {
      let attempts = 0;
      while (!videoRef.current && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 300));
        attempts++;
      }

      if (!videoRef.current) return;

      try {
        videoRef.current.srcObject = cameraStream;
        await videoRef.current.play();

        if (examStarted && modelsLoaded && tfBackendReadyRef.current && !isFaceMonitoring) {
          setTimeout(() => startFaceMonitoring(), 1500);
        }
      } catch (err) {
        debugLog('ERROR_ATTACHING_STREAM', { message: err.message });
      }
    };

    attachStream();
  }, [cameraStream, examStarted, modelsLoaded, isFaceMonitoring]);

  // ============================================================
  // REQUEST CAMERA & SCREEN
  // ============================================================
  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      });
      setCameraStream(stream);
      setCameraActive(true);
      return true;
    } catch (err) {
      setModelLoadingError('Camera access is required for exam proctoring.');
      return false;
    }
  };

  const requestScreenPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor' },
        audio: false
      });
      screenStreamRef.current = stream;
      setScreenSharingActive(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setScreenSharingActive(false);
          showWarning('Screen sharing stopped. Exam will terminate.');
          setTimeout(() => endExam(), 1500);
        };
      }
      return true;
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setModelLoadingError('Screen sharing is required.');
      }
      return false;
    }
  };

  // ============================================================
  // FACE DETECTION MONITORING
  // ============================================================
  const startFaceMonitoring = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded || !tfBackendReadyRef.current || isFaceMonitoring) return;

    setIsFaceMonitoring(true);
    let consecutiveNoFaceFrames = 0;

    const detectFaces = async () => {
      try {
        if (videoRef.current && videoRef.current.readyState === 4) {
          const video = videoRef.current;
          const canvas = canvasRef.current;

          const detections = await faceapi.detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
          );

          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (detections.length === 0) {
              consecutiveNoFaceFrames++;
              setFaceDetected(false);
              if (consecutiveNoFaceFrames === 10) {
                setFaceWarnings(prev => {
                  const newWarnings = prev + 1;
                  showWarning(`⚠️ Warning ${newWarnings}: Face not detected.`);
                  return newWarnings;
                });
                consecutiveNoFaceFrames = 0;
              }
            } else if (detections.length > 1) {
              setFaceDetected(true);
              setMultipleFaces(true);
              showWarning('⚠️ Multiple faces detected!');
            } else {
              setFaceDetected(true);
              setMultipleFaces(false);
              consecutiveNoFaceFrames = 0;
            }

            const resizedDetections = faceapi.resizeResults(detections, {
              width: video.videoWidth,
              height: video.videoHeight,
            });
            faceapi.draw.drawDetections(canvas, resizedDetections);
          }
        }
      } catch (err) {
        // SIlent catch for frame skip
      }
    };

    detectionIntervalRef.current = setInterval(() => detectFaces(), 500);
  };

  // ============================================================
  // PAGE VISIBILITY & FULLSCREEN
  // ============================================================
  useEffect(() => {
    if (!examStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWindowWarnings(prev => {
          const newW = prev + 1;
          showWarning(`⚠️ Warning ${newW}: Tab switch detected!`);
          return newW;
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreen(false);
        showWarning('⚠️ Fullscreen mode exited. Please return.');
      } else {
        setIsFullScreen(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [examStarted]);

  // ============================================================
  // SETUP HANDLERS
  // ============================================================
  const handleInstructionsConfirm = () => setSetupStage('camera');

  const handleCameraSetup = async () => {
    const success = await requestCameraPermission();
    if (success) {
      setTimeout(() => setSetupStage('screen'), 1500);
    }
  };

  const handleScreenSetup = async () => {
    const success = await requestScreenPermission();
    if (success) {
      setSetupStage('ready');
    }
  };

  const handleStartExam = async () => {
    setLoading(true);
    try {
      setShowPermissionDialog(false);
      setExamStarted(true);
      
      await new Promise(resolve => setTimeout(resolve, 300));

      const docElem = document.documentElement;
      if (docElem.requestFullscreen) await docElem.requestFullscreen();
      setIsFullScreen(true);

      setLoading(false);
      if (sessionData) {
        setTimeout(() => fetchNextItem(sessionData.session_id), 500);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const handleExitSetup = () => {
    cleanupAllResources();
    navigate('/exam/login');
  };

  const showWarning = (message) => {
    const warning = document.getElementById('warning-notification');
    if (warning) {
      warning.textContent = message;
      warning.classList.add('show');
      setTimeout(() => warning.classList.remove('show'), 3500);
    }
  };

  // ============================================================
  // EXAM LOGIC
  // ============================================================
  const fetchNextItem = async (sessionId) => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/cat/next-item', { session_id: sessionId });
      setCurrentItem(response.data);
      setSelectedOption('');
      setItemStartTime(Date.now());
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes('complete')) {
        completeExam(sessionId);
      } else {
        alert('Error loading question.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (option) => setSelectedOption(option);

  const submitAnswer = async () => {
    if (!selectedOption) return;

    setSubmitting(true);
    const responseTime = Math.floor((Date.now() - itemStartTime) / 1000);
    
    try {
      const response = await axios.post('http://localhost:8000/cat/submit-answer', {
        session_id: sessionData.session_id,
        item_id: currentItem.item_id,
        selected_option: selectedOption,
        response_time_seconds: responseTime,
        face_warnings: faceWarnings,
        tab_switch_warnings: windowWarnings
      });

      setStats({
        itemsCompleted: response.data.items_completed,
        currentTheta: response.data.current_theta
      });

      showFeedback(response.data.is_correct);

      if (response.data.should_continue) {
        setTimeout(() => fetchNextItem(sessionData.session_id), 1500);
      } else {
        setTimeout(() => completeExam(sessionData.session_id), 1500);
      }
    } catch (err) {
      alert('Error submitting answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const showFeedback = (correct) => {
    const feedback = document.getElementById('answer-feedback');
    // if (feedback) {
    //   feedback.className = `answer-feedback ${correct ? 'correct' : 'incorrect'} show`;
    //   feedback.textContent = correct ? 'Correct!' : 'Incorrect';
    //   setTimeout(() => feedback.classList.remove('show'), 1500);
    // }
  };

  const endExam = () => {
    cleanupAllResources();
    localStorage.removeItem('cat_session');
    navigate('/exam/login');
  };

  const completeExam = async (sessionId) => {
    try {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      
      const response = await axios.post('http://localhost:8000/cat/complete', {
        session_id: sessionId,
        face_violations: faceWarnings,
        tab_violations: windowWarnings
      });

      cleanupAllResources();
      localStorage.removeItem('cat_session');
      navigate('/exam/complete', { state: { results: response.data } });
    } catch (err) {
      alert('Error completing exam.');
    }
  };

  // ============================================================
  // RENDER UI
  // ============================================================
  if (showPermissionDialog && sessionData) {
    return (
      <div className="permission-dialog-overlay">
        <div className="permission-dialog">
          <button className="dialog-close-button" onClick={handleExitSetup}>×</button>

          {setupStage === 'instructions' && (
            <>
              <div className="permission-header">
                <h1>Exam Proctoring Setup</h1>
                <p>Complete the following steps before starting your exam</p>
              </div>
              <div className="instructions-section">
                <h2>Exam Instructions</h2>
                <ul className="instructions-list">
                  <li>Ensure adequate lighting on your face</li>
                  <li>Use a quiet environment with minimal background noise</li>
                  <li>No switching between tabs or applications</li>
                  <li>Keep your entire face visible throughout the exam</li>
                  <li><strong>Time Limit:</strong> The exam will auto-submit after 40 minutes.</li>
                  <li>Your entire screen will be recorded during the exam</li>
                  <li>You cannot go back to previous questions</li>
                </ul>
              </div>
              <button className="start-exam-button" onClick={handleInstructionsConfirm}>
                I Understand - Proceed to Setup
              </button>
            </>
          )}

          {setupStage === 'camera' && (
            <>
              <div className="permission-header">
                <h1>Camera Setup</h1>
                <p>Grant camera access for face detection</p>
              </div>
              {modelLoadingError && <div className="error-message"><p>{modelLoadingError}</p></div>}
              <div className="setup-preview">
                <h2>Camera Preview</h2>
                <div className="camera-preview-container">
                  <video ref={videoRef} autoPlay playsInline muted className="preview-video" />
                  <canvas ref={canvasRef} className="preview-canvas" />
                  <div className="preview-status">
                    {!cameraActive ? <span className="status-badge inactive">Not connected</span> : 
                    //  !faceDetected ? <span className="status-badge inactive">Waiting for face...</span> : 
                     <span className="status-badge active">Face Detected</span>}
                  </div>
                </div>
              </div>
              <div className="button-group">
                <button className="start-exam-button secondary" onClick={() => setSetupStage('instructions')}>← Back</button>
                <button className="start-exam-button" onClick={handleCameraSetup} disabled={!modelsLoaded}>
                  {!cameraActive ? 'Grant Camera Access' : faceDetected ? 'Next Step' : 'Loading...'}
                </button>
              </div>
            </>
          )}

          {setupStage === 'screen' && (
            <>
              <div className="permission-header">
                <h1>Screen Sharing Setup</h1>
                <p>Grant screen sharing permission to record your exam</p>
              </div>
              <div className="warning-section">
                <h3>⚠️ Important Instructions</h3>
                <p className="warning-text">
                  To ensure academic integrity, you must share your <strong>entire screen</strong>.
                </p>
                <ol className="screen-instruction-list" style={{textAlign: 'left', margin: '15px 0'}}>
                  <li>Click the "Grant Screen Access" button below.</li>
                  <li>A browser popup will appear. Select the tab labeled <strong>"Entire Screen"</strong> (or "Entire Monitor").</li>
                  <li>Click on the preview image of your screen to select it.</li>
                  <li>Click <strong>"Share"</strong> to confirm.</li>
                </ol>
                <p style={{fontSize: '0.9em', color: '#666'}}>
                  <em>Note: Selecting "Window" or "Chrome Tab" is invalid and will not allow the exam to start.</em>
                </p>
              </div>
              <div className="button-group">
                <button className="start-exam-button secondary" onClick={() => setSetupStage('camera')}>← Back</button>
                <button className="start-exam-button" onClick={handleScreenSetup}>Grant Screen Access</button>
              </div>
            </>
          )}

          {setupStage === 'ready' && (
            <>
              <div className="permission-header">
                <h1>Ready to Start</h1>
                <p>All systems check complete</p>
              </div>
              <div className="instructions-section">
                <h2>Final Checklist</h2>
                <ul className="instructions-list">
                   <li>✅ Camera is active and face is detected.</li>
                   <li>✅ Screen sharing is active and monitoring.</li>
                   <li>✅ Fullscreen mode will activate automatically.</li>
                   <li>⏱️ <strong>Time Limit:</strong> You have 40 minutes to complete 30 questions.</li>
                   <li>⚠️ Do not refresh the page or close the browser.</li>
                </ul>
                <p style={{marginTop: '15px', fontWeight: 'bold', color: '#d9534f'}}>
                    Clicking "Start Exam Now" will begin the timer immediately.
                </p>
              </div>
              <div className="button-group">
                <button className="start-exam-button secondary" onClick={() => setSetupStage('screen')}>← Back</button>
                <button className="start-exam-button success" onClick={handleStartExam} disabled={loading}>
                  {loading ? 'Starting...' : 'Start Exam Now'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!sessionData || !examStarted || !modelsLoaded) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p>Initializing exam environment...</p>
      </div>
    );
  }

  if (loading || !currentItem) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p>Loading next question...</p>
      </div>
    );
  }

  const optionsArray = ['A', 'B', 'C', 'D'];
  const progressPercentage = (stats.itemsCompleted / 30) * 100; // Assuming 30 questions
  const timerColor = timeLeft < 300 ? '#ff4444' : '#2c3e50'; // Red if < 5 mins

  return (
    <div className="cat-exam-container">
      <div id="answer-feedback" className="answer-feedback"></div>
      <div id="warning-notification" className="warning-notification"></div>

      {cameraStream && (
        <div className="camera-monitoring">
          <video ref={videoRef} autoPlay playsInline muted className="monitoring-video" />
          <canvas ref={canvasRef} className="monitoring-canvas" />
          {/* {!faceDetected && <div className="video-overlay"><span>Waiting for face...</span></div>} */}
        </div>
      )}

      <div className="monitoring-bar">
        <div className={`monitor-indicator ${faceDetected ? 'active' : 'warning'}`}>
          {faceDetected ? '✓ Face' : '⚠ No Face'}
        </div>
        <div className={`monitor-indicator ${multipleFaces ? 'warning' : 'active'}`}>
          {multipleFaces ? '⚠ Multi-Face' : '✓ Single'}
        </div>
        <div className="monitor-indicator timer" style={{ backgroundColor: timerColor, color: 'white', fontWeight: 'bold' }}>
           ⏱️ {formatTime(timeLeft)}
        </div>
      </div>

      <div className="exam-header">
        <div className="candidate-info">
          <h2>{sessionData.candidate_name}</h2>
          <p>{sessionData.job_title}</p>
        </div>
        <div className="exam-stats">
          <div className="stat-item">
            <span className="stat-label">Progress</span>
            <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{width: `${progressPercentage}%`}}></div>
            </div>
            <span className="stat-value small">{stats.itemsCompleted} / 30</span>
          </div>
        </div>
      </div>

      <div className="exam-content">
        <div className="question-card">
          <div className="question-header-row">
              <div className="question-number">Question {currentItem.item_number}</div>
              <div className="question-timer">Time Left: {formatTime(timeLeft)}</div>
          </div>
          
          <div className="question-text">{currentItem.question}</div>
          
          <div className="options-container">
            {optionsArray.map((option) => (
              <div
                key={option}
                className={`option ${selectedOption === option ? 'selected' : ''} ${submitting ? 'disabled' : ''}`}
                onClick={() => !submitting && handleOptionSelect(option)}
              >
                <div className="option-letter">{option}</div>
                <div className="option-text">{currentItem[`option_${option.toLowerCase()}`]}</div>
                {selectedOption === option && <div className="option-checkmark">✓</div>}
              </div>
            ))}
          </div>
          
          <button className="submit-answer-button" onClick={submitAnswer} disabled={!selectedOption || submitting}>
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CATExam;
