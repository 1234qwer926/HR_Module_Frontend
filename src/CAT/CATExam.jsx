import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import './CATExam.css';

const CATExam = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // ============================================================
  // SESSION & EXAM STATE
  // ============================================================
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

  // ============================================================
  // PROCTORING & SETUP STATE
  // ============================================================
  const [showPermissionDialog, setShowPermissionDialog] = useState(true);
  const [setupStage, setSetupStage] = useState('instructions');
  const [cameraPermission, setCameraPermission] = useState(false);
  const [screenPermission, setScreenPermission] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [screenActive, setScreenActive] = useState(false);
  const [examStarted, setExamStarted] = useState(false);

  // ============================================================
  // FACE DETECTION STATE
  // ============================================================
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadingError, setModelLoadingError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [faceWarnings, setFaceWarnings] = useState(0);
  const [isFaceMonitoring, setIsFaceMonitoring] = useState(false);
  const [lightingQuality, setLightingQuality] = useState('unknown');
  const [detectionDebug, setDetectionDebug] = useState('');

  // ============================================================
  // MONITORING & VIOLATIONS STATE
  // ============================================================
  const [windowWarnings, setWindowWarnings] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [screenSharingActive, setScreenSharingActive] = useState(false);

  // ============================================================
  // REFS & STATE FOR MEDIA STREAM
  // ============================================================
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const screenStreamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const modelRetryCountRef = useRef(0);

  // ============================================================
  // CLEANUP ALL STREAMS & RESOURCES
  // ============================================================
  const cleanupAllResources = () => {
    console.log('Cleaning up all resources...');

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped camera track:', track.kind);
      });
      setCameraStream(null);
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped screen track:', track.kind);
      });
      screenStreamRef.current = null;
    }

    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.() ||
          document.webkitExitFullscreen?.() ||
          document.msExitFullscreen?.();
        console.log('Exited fullscreen');
      }
    } catch (err) {
      console.warn('Could not exit fullscreen:', err);
    }

    setIsFaceMonitoring(false);
    setCameraActive(false);
    setScreenSharingActive(false);

    console.log('All resources cleaned up');
  };

  // ============================================================
  // MONITOR ROUTE CHANGES
  // ============================================================
  useEffect(() => {
    const handleNavigationStart = () => {
      console.log('Navigation detected, cleaning up...');
      cleanupAllResources();
    };

    window.addEventListener('beforeunload', handleNavigationStart);

    return () => {
      window.removeEventListener('beforeunload', handleNavigationStart);
    };
  }, [cameraStream]);

  useEffect(() => {
    if (!location.pathname.includes('/exam')) {
      console.log('User navigated away from /exam route');
      cleanupAllResources();
    }
  }, [location.pathname, cameraStream]);

  // ============================================================
  // LOAD FACE-API MODELS
  // ============================================================
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoadingError(null);
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
        console.log('Loading face detection models from CDN:', MODEL_URL);
        const startTime = Date.now();
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        const loadTime = Date.now() - startTime;
        console.log(`Face detection models loaded successfully in ${loadTime}ms`);
        setModelsLoaded(true);
        modelRetryCountRef.current = 0;
      } catch (err) {
        console.error('Error loading face detection models:', err);
        setModelLoadingError(`Model loading failed: ${err.message}`);
        if (modelRetryCountRef.current < 3) {
          modelRetryCountRef.current += 1;
          const delayMs = Math.pow(2, modelRetryCountRef.current) * 1000;
          console.log(`Retrying model load... Attempt ${modelRetryCountRef.current} after ${delayMs}ms`);
          setTimeout(loadModels, delayMs);
        } else {
          setModelLoadingError('Failed to load face detection models after 3 attempts. Please refresh the page.');
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
  // CLEANUP ON COMPONENT UNMOUNT
  // ============================================================
  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up all resources');
      cleanupAllResources();
    };
  }, []);

  // ============================================================
  // CRITICAL FIX: ATTACH STREAM TO VIDEO ELEMENT
  // ============================================================
  useEffect(() => {
    if (!cameraStream) {
      console.log('Camera stream not available');
      return;
    }

    // Add a small delay to ensure the video element is mounted in the DOM
    const attachStream = async () => {
      // Wait for video element to be in DOM
      let attempts = 0;
      const maxAttempts = 10;

      while (!videoRef.current && attempts < maxAttempts) {
        console.log(`Waiting for video element... attempt ${attempts + 1}`);
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }

      if (!videoRef.current) {
        console.error('Video element not found after waiting');
        setDetectionDebug('Video element not found in DOM');
        return;
      }

      console.log('Attaching camera stream to video element', {
        streamId: cameraStream.id,
        examStarted,
        setupStage
      });

      // CRITICAL: Set srcObject directly
      videoRef.current.srcObject = cameraStream;

      // Force video to play
      try {
        await videoRef.current.play();
        console.log('Video playing successfully', {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });

        // Start face monitoring after video is playing in exam view
        if (examStarted && modelsLoaded && !isFaceMonitoring) {
          console.log('Starting face monitoring after 1.5 seconds...');
          setTimeout(() => {
            startFaceMonitoring();
          }, 1500);
        }
      } catch (err) {
        console.error('Error playing video:', err);
        setDetectionDebug('Error playing video: ' + err.message);
      }
    };

    attachStream();

  }, [cameraStream, examStarted, modelsLoaded, setupStage]);

  // ============================================================
  // REQUEST CAMERA PERMISSION & START STREAM
  // ============================================================
  const requestCameraPermission = async () => {
    try {
      setDetectionDebug('Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      console.log('Camera stream obtained:', stream.id);
      setDetectionDebug('Camera stream obtained');

      // Store stream in state
      setCameraStream(stream);

      setCameraPermission(true);
      setCameraActive(true);

      return true;
    } catch (err) {
      console.error('Camera permission denied:', err);
      setModelLoadingError('Camera access is required for exam proctoring.');
      setDetectionDebug('Camera error: ' + err.message);
      return false;
    }
  };

  // ============================================================
  // REQUEST SCREEN SHARING
  // ============================================================
  const requestScreenPermission = async () => {
    try {
      const displayMediaOptions = {
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      screenStreamRef.current = stream;
      setScreenPermission(true);
      setScreenSharingActive(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log('Screen sharing stopped');
          setScreenSharingActive(false);
          showWarning('Screen sharing was stopped. Exam session will be terminated.');
          setTimeout(() => {
            endExam();
          }, 1500);
        };
      }

      return true;
    } catch (err) {
      console.error('Screen sharing denied:', err);
      if (err.name !== 'NotAllowedError') {
        setModelLoadingError('Screen sharing is required for exam. Please try again.');
      }
      return false;
    }
  };

  // ============================================================
  // START FACE DETECTION MONITORING
  // ============================================================
  const startFaceMonitoring = async () => {
    // Double-check prerequisites
    if (!videoRef.current) {
      console.warn('Cannot start face monitoring: video ref not available');
      return;
    }

    if (!canvasRef.current) {
      console.warn('Cannot start face monitoring: canvas ref not available');
      return;
    }

    if (!modelsLoaded) {
      console.warn('Cannot start face monitoring: models not loaded');
      return;
    }

    // Check if video is ready
    if (videoRef.current.readyState < 2) {
      console.warn('Video not ready yet, waiting...');
      setTimeout(() => startFaceMonitoring(), 500);
      return;
    }

    // Check if already monitoring
    if (isFaceMonitoring) {
      console.log('Face monitoring already active');
      return;
    }

    console.log('Starting face monitoring...', {
      videoWidth: videoRef.current.videoWidth,
      videoHeight: videoRef.current.videoHeight,
      readyState: videoRef.current.readyState
    });

    setIsFaceMonitoring(true);
    let consecutiveNoFaceFrames = 0;
    let lightingFrames = [];
    let frameCount = 0;

    const detectFace = async () => {
      try {
        if (!videoRef.current) {
          setDetectionDebug('Video ref is null');
          return;
        }

        if (videoRef.current.readyState !== 4) {
          setDetectionDebug(`Video not ready. ReadyState: ${videoRef.current.readyState}`);
          return;
        }

        if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
          setDetectionDebug(`Invalid video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
          return;
        }

        frameCount++;

        // Run face detection with error handling
        let detections = [];
        try {
          detections = await faceapi
            .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.5
            }))
            .withFaceLandmarks();
        } catch (detectionError) {
          console.error('Face detection error:', detectionError);
          setDetectionDebug('Detection error: ' + detectionError.message);
          // Continue without crashing
          return;
        }

        if (frameCount % 10 === 0) {
          setDetectionDebug(`Frames: ${frameCount} | Detections: ${detections.length}`);
        }

        setFaceDetected(detections.length === 1);

        if (detections.length > 1) {
          setMultipleFaces(true);
          showWarning('⚠️ Multiple faces detected! Only one person should be visible.');
        } else if (detections.length === 1) {
          setMultipleFaces(false);
          consecutiveNoFaceFrames = 0;

          if (detections[0].detection.score > 0.8) {
            setLightingQuality('good');
            lightingFrames = [];
          } else {
            lightingFrames.push(detections[0].detection.score);
            if (lightingFrames.length > 10) {
              setLightingQuality('poor');
              showWarning('⚠️ Lighting appears poor. Please ensure adequate lighting on your face.');
              lightingFrames = [];
            }
          }
        } else {
          // No face detected
          consecutiveNoFaceFrames++;
          // Warn after 5 seconds without face (10 frames at 500ms interval)
          if (consecutiveNoFaceFrames > 10) {
            setFaceWarnings(prev => {
              const newWarnings = prev + 1;
              showWarning(`⚠️ Warning ${newWarnings}: Face not detected. Please keep your face visible in the camera.`);
              // Don't end exam, just warn
              return newWarnings;
            });
            consecutiveNoFaceFrames = 0; // Reset counter after warning
          }
        }

        if (!videoRef.current) {
          setDetectionDebug('Video ref became null during detection');
          return;
        }

        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        };

        if (canvasRef.current && displaySize.width > 0 && displaySize.height > 0) {
          // Clear previous drawings
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

          canvasRef.current.width = displaySize.width;
          canvasRef.current.height = displaySize.height;

          if (detections.length > 0) {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
          }
        }
      } catch (err) {
        console.error('Face detection error:', err);
        setDetectionDebug('Detection error: ' + err.message);
      }
    };

    // Run detection every 500ms (2 FPS) for better performance
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    detectionIntervalRef.current = setInterval(detectFace, 500);
  };

  // ============================================================
  // MONITOR PAGE VISIBILITY & FULLSCREEN
  // ============================================================
  useEffect(() => {
    if (!examStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWindowWarnings(prev => {
          const newWarnings = prev + 1;
          showWarning(`⚠️ Warning ${newWarnings}: Tab switch detected. This activity is being recorded.`);
          // Don't end exam, just warn and record
          return newWarnings;
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreen(false);
        showWarning('⚠️ Fullscreen mode exited. Please return to fullscreen for better experience.');
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
  // SETUP FLOW HANDLERS
  // ============================================================
  const handleInstructionsConfirm = () => {
    setSetupStage('camera');
  };

  const handleCameraSetup = async () => {
    const success = await requestCameraPermission();
    if (success) {
      setTimeout(() => {
        setSetupStage('screen');
      }, 2000);
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
      // First, hide the dialog and show exam UI
      setShowPermissionDialog(false);
      setExamStarted(true);

      // Wait a bit for the exam UI to mount
      await new Promise(resolve => setTimeout(resolve, 300));

      // Then enter fullscreen
      try {
        const docElem = document.documentElement;
        if (docElem.requestFullscreen) {
          await docElem.requestFullscreen();
        } else if (docElem.webkitRequestFullscreen) {
          await docElem.webkitRequestFullscreen();
        } else if (docElem.msRequestFullscreen) {
          await docElem.msRequestFullscreen();
        }
        setIsFullScreen(true);
        console.log('Entered fullscreen mode');
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
      }

      setLoading(false);

      // Fetch first question after a small delay
      if (sessionData) {
        setTimeout(() => {
          fetchNextItem(sessionData.session_id);
        }, 500);
      }
    } catch (err) {
      console.error('Error starting exam:', err);
      setLoading(false);
    }
  };

  const handleExitSetup = () => {
    console.log('User clicked exit/close button');
    cleanupAllResources();
    navigate('/exam/login');
  };

  const showWarning = (message) => {
    const warning = document.getElementById('warning-notification');
    if (warning) {
      warning.textContent = message;
      warning.classList.add('show');
      setTimeout(() => {
        warning.classList.remove('show');
      }, 3500);
    }
  };

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
        response_time_seconds: responseTime,
        face_warnings: faceWarnings,
        tab_switch_warnings: windowWarnings
      });
      setStats({
        itemsCompleted: response.data.items_completed,
        currentTheta: response.data.current_theta
      });
      const correct = response.data.is_correct;
      showFeedback(correct);

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
    if (feedback) {
      feedback.className = `answer-feedback ${correct ? 'correct' : 'incorrect'} show`;
      feedback.textContent = correct ? 'Correct!' : 'Incorrect';

      setTimeout(() => {
        feedback.classList.remove('show');
      }, 1500);
    }
  };

  const endExam = () => {
    console.log('Ending exam...');
    cleanupAllResources();
    localStorage.removeItem('cat_session');
    navigate('/exam/login');
  };

  const completeExam = async (sessionId) => {
    try {
      console.log('Completing exam...');
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }

      const response = await axios.post('http://localhost:8000/cat/complete', {
        session_id: sessionId,
        face_violations: faceWarnings,
        tab_violations: windowWarnings
      });

      cleanupAllResources();
      localStorage.removeItem('cat_session');
      navigate('/exam/complete', { state: { results: response.data } });
    } catch (err) {
      console.error('Error completing exam:', err);
      alert('Error completing exam. Please contact support.');
    }
  };

  // ============================================================
  // RENDER: PERMISSION DIALOG
  // ============================================================
  if (showPermissionDialog && sessionData) {
    return (
      <div className="permission-dialog-overlay">
        <div className="permission-dialog">
          <button
            className="dialog-close-button"
            onClick={handleExitSetup}
            title="Exit exam setup and close all streams"
          >
            ×
          </button>

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
                  <li>Only one person should be visible on camera</li>
                  <li>Your entire screen will be recorded during the exam</li>
                  <li>You cannot go back to previous questions</li>
                  <li>Exam duration: 30 questions (adaptive difficulty)</li>
                  <li>Violations may result in exam disqualification</li>
                </ul>
              </div>

              <div className="warning-section">
                <p className="warning-text">
                  By proceeding, you acknowledge that you understand the proctoring rules
                  and agree to comply with them throughout the exam.
                </p>
              </div>

              <button
                className="start-exam-button"
                onClick={handleInstructionsConfirm}
              >
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

              {modelLoadingError && (
                <div className="error-message">
                  <p>{modelLoadingError}</p>
                </div>
              )}

              <div className="setup-preview">
                <h2>Camera Preview</h2>
                <div className="camera-preview-container">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="preview-video"
                  />
                  <canvas
                    ref={canvasRef}
                    className="preview-canvas"
                  />
                  <div className="preview-status">
                    {!cameraActive && (
                      <span className="status-badge inactive">Camera not connected</span>
                    )}
                    {cameraActive && !modelsLoaded && (
                      <span className="status-badge loading">Loading face detection...</span>
                    )}
                    {cameraActive && modelsLoaded && !faceDetected && (
                      <span className="status-badge inactive">Waiting for face...</span>
                    )}
                    {cameraActive && modelsLoaded && faceDetected && !multipleFaces && (
                      <span className="status-badge active">Face Detected</span>
                    )}
                    {multipleFaces && (
                      <span className="status-badge warning">Multiple faces detected</span>
                    )}
                  </div>
                  <div className="debug-info">
                    {detectionDebug}
                  </div>
                </div>

                <div className="permission-item">
                  <div className="permission-details">
                    <h3>Requirements</h3>
                    <ul className="requirement-list">
                      <li>Clear lighting on your face</li>
                      <li>Face centered and visible</li>
                      <li>Only one person visible</li>
                      <li>Quiet environment</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="button-group">
                <button
                  className="start-exam-button secondary"
                  onClick={() => setSetupStage('instructions')}
                >
                  ← Back
                </button>
                <button
                  className="start-exam-button"
                  onClick={handleCameraSetup}
                  disabled={!modelsLoaded}
                >
                  {!cameraActive ?
                    'Grant Camera Access' : (faceDetected ? 'Camera Ready - Next' : 'Loading...')}
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

              <div className="permission-item">
                <div className="permission-details">
                  <h3>Why Screen Sharing?</h3>
                  <p>Your entire screen/monitor will be recorded to:</p>
                  <ul className="requirement-list">
                    <li>Ensure exam integrity</li>
                    <li>Prevent unauthorized resources</li>
                    <li>Record all activity during exam</li>
                    <li>Protect against malpractice</li>
                  </ul>
                </div>
              </div>

              <div className="warning-section">
                <p className="warning-text">
                  When you click "Grant Screen Access", select "Entire Screen" or "Monitor"
                  in the system dialog that appears.
                  Do NOT select just the browser window.
                </p>
              </div>

              <div className="button-group">
                <button
                  className="start-exam-button secondary"
                  onClick={() => setSetupStage('camera')}
                >
                  ← Back
                </button>
                <button
                  className="start-exam-button"
                  onClick={handleScreenSetup}
                >
                  Grant Screen Access
                </button>
              </div>
            </>
          )}

          {setupStage === 'ready' && (
            <>
              <div className="permission-header">
                <h1>Ready to Start</h1>
                <p>All permissions granted and verified</p>
              </div>

              <div className="setup-checklist">
                <div className="checklist-item checked">
                  <span className="check-icon">✓</span>
                  <span>Camera Access - Enabled</span>
                </div>
                <div className="checklist-item checked">
                  <span className="check-icon">✓</span>
                  <span>Screen Sharing - Enabled</span>
                </div>
                <div className="checklist-item checked">
                  <span className="check-icon">✓</span>
                  <span>Face Detection Models - Loaded</span>
                </div>
              </div>

              <div className="final-warning">
                <p>
                  The exam will now start in <strong>fullscreen mode</strong> with continuous monitoring.
                  You will have <strong>30 adaptive questions</strong> to answer.
                </p>
              </div>

              <div className="button-group">
                <button
                  className="start-exam-button secondary"
                  onClick={() => setSetupStage('screen')}
                >
                  ← Back
                </button>
                <button
                  className="start-exam-button success"
                  onClick={handleStartExam}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-small"></span>
                      Starting...
                    </>
                  ) : (
                    'Start Exam Now'
                  )}
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
        <p>
          {!modelsLoaded ? 'Loading face detection models...' : 'Initializing exam...'}
        </p>
        {modelLoadingError && (
          <p className="error-text">{modelLoadingError}</p>
        )}
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

  const options = ['A', 'B', 'C', 'D'];
  return (
    <div className="cat-exam-container">
      <div id="answer-feedback" className="answer-feedback"></div>
      <div id="warning-notification" className="warning-notification"></div>

      {/* Camera Monitoring Feed */}
      {cameraStream && (
        <div className="camera-monitoring">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="monitoring-video"
          />
          <canvas
            ref={canvasRef}
            className="monitoring-canvas"
          />
          {!faceDetected && (
            <div className="video-overlay">
              <span>Waiting for face...</span>
            </div>
          )}
        </div>
      )}

      <div className="monitoring-bar">
        <div className={`monitor-indicator ${faceDetected ? 'active' : 'warning'}`}>
          {faceDetected ? '✓ Face Detected' : '⚠ Face NOT Detected'}
        </div>
        <div className={`monitor-indicator ${multipleFaces ? 'warning' : 'active'}`}>
          {multipleFaces ? '⚠ Multiple Faces!' : '✓ Single Person'}
        </div>
        <div className={`monitor-indicator ${lightingQuality === 'good' ? 'active' : lightingQuality === 'poor' ? 'warning' : 'normal'}`}>
          Lighting: {lightingQuality === 'good' ? 'Good ✓' : lightingQuality === 'poor' ? 'Poor ⚠' : 'Analyzing...'}
        </div>
        <div className={`monitor-indicator ${faceWarnings > 0 ? 'warning' : 'active'}`}>
          Face Warnings: {faceWarnings}
        </div>
        <div className={`monitor-indicator ${windowWarnings > 0 ? 'warning' : 'active'}`}>
          Tab Switches: {windowWarnings}
        </div>
      </div>

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
                className={`option ${selectedOption === option ?
                  'selected' : ''} ${submitting ? 'disabled' : ''}`}
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
              <li>Select one answer</li>
              <li>Click submit to proceed</li>
              <li>No going back</li>
            </ul>
          </div>

          <div className="sidebar-card">
            <h3>Progress</h3>
            <div className="progress-info">
              <p>Adaptive test</p>
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
            <h3>Current Ability</h3>
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

          <div className="sidebar-card violations-card">
            <h3>Monitoring Status</h3>
            <div className="violations-list">
              <p>
                <span>Face Violations:</span>
                <strong className={faceWarnings > 0 ? 'warning-text' : ''}>{faceWarnings}</strong>
              </p>
              <p>
                <span>Tab Switches:</span>
                <strong className={windowWarnings > 0 ? 'warning-text' : ''}>{windowWarnings}</strong>
              </p>
              <p>
                <span>Lighting Quality:</span>
                <strong className={lightingQuality === 'poor' ? 'warning-text' : lightingQuality === 'good' ? 'success-text' : ''}>
                  {lightingQuality === 'good' ? 'Good ✓' : lightingQuality === 'poor' ? 'Poor ⚠' : 'Analyzing...'}
                </strong>
              </p>
              <p>
                <span>Camera Status:</span>
                <strong className={cameraStream ? 'success-text' : 'warning-text'}>
                  {cameraStream ? 'Active ✓' : 'Inactive ⚠'}
                </strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CATExam;