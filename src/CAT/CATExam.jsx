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
  // REFS
  // ============================================================
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const screenStreamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const modelRetryCountRef = useRef(0);

  // ============================================================
  // CLEANUP ALL STREAMS & RESOURCES
  // ============================================================
  const cleanupAllResources = () => {
    console.log('Cleaning up all resources...');

    // Stop detection interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    // Stop camera stream
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped camera track:', track.kind);
      });
      videoRef.current.srcObject = null;
    }

    // Stop screen stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped screen track:', track.kind);
      });
      screenStreamRef.current = null;
    }

    // Exit fullscreen
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
  // MONITOR ROUTE CHANGES - Stop everything on navigation
  // ============================================================
  useEffect(() => {
    const handleNavigationStart = () => {
      console.log('Navigation detected, cleaning up...');
      cleanupAllResources();
    };

    // Add beforeunload listener for when user leaves the page
    window.addEventListener('beforeunload', handleNavigationStart);

    return () => {
      window.removeEventListener('beforeunload', handleNavigationStart);
    };
  }, []);

  // ============================================================
  // CHECK IF NAVIGATING AWAY FROM /EXAM ROUTE
  // ============================================================
  useEffect(() => {
    if (!location.pathname.includes('/exam')) {
      console.log('User navigated away from /exam route');
      cleanupAllResources();
    }
  }, [location.pathname]);

  // ============================================================
  // LOAD FACE-API MODELS - CORRECTED VERSION
  // ============================================================
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoadingError(null);

        // Try CDN first (recommended approach)
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';

        console.log('Loading face detection models from CDN:', MODEL_URL);

        const startTime = Date.now();

        // Load all required models - CORRECTED: Use correct model names
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

        // Retry loading models with exponential backoff (max 3 retries)
        if (modelRetryCountRef.current < 3) {
          modelRetryCountRef.current += 1;
          const delayMs = Math.pow(2, modelRetryCountRef.current) * 1000;
          console.log(`Retrying model load... Attempt ${modelRetryCountRef.current} after ${delayMs}ms`);

          setTimeout(() => {
            loadModels();
          }, delayMs);
        } else {
          setModelLoadingError('Failed to load face detection models after 3 attempts. Please refresh the page.');
        }
      }
    };

    if (!modelsLoaded && modelRetryCountRef.current === 0) {
      loadModels();
    }
  }, []);

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
  }, []);

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

      setDetectionDebug('Camera stream obtained');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be fully loaded and ready
        videoRef.current.onloadedmetadata = () => {
          setDetectionDebug('Metadata loaded, attempting to play...');
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
              setDetectionDebug('Error playing video: ' + err.message);
            });
          }
        };

        // Add event listener for when video data is loaded and playing
        videoRef.current.oncanplay = () => {
          setDetectionDebug('Video can play, checking dimensions...');
          if (videoRef.current) {
            console.log('Video dimensions:', {
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
              readyState: videoRef.current.readyState
            });
          }
        };

        // Start face monitoring when video is actually playing with data
        videoRef.current.onplaying = () => {
          setDetectionDebug('Video playing with data...');
          if (videoRef.current) {
            console.log('Video playing - dimensions:', {
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
              readyState: videoRef.current.readyState
            });

            // Start face monitoring after video is confirmed playing
            if (modelsLoaded && !isFaceMonitoring && videoRef.current.videoWidth > 0) {
              setTimeout(() => {
                startFaceMonitoring();
              }, 1000); // Give more time for video to stabilize
            }
          }
        };

        // Trigger initial play
        videoRef.current.play().catch(err => {
          console.error('Immediate play error (will retry on loadedmetadata):', err);
        });
      }

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

      // Monitor screen sharing status
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
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) {
      console.warn('Face monitoring prerequisites not met', {
        videoRef: !!videoRef.current,
        canvasRef: !!canvasRef.current,
        modelsLoaded
      });
      return;
    }

    setIsFaceMonitoring(true);
    let consecutiveNoFaceFrames = 0;
    let lightingFrames = [];
    let frameCount = 0;

    const detectFace = async () => {
      try {
        // Enhanced null safety checks
        if (!videoRef.current) {
          setDetectionDebug('Video ref is null');
          return;
        }

        // Check if video is fully ready (readyState 4 = HAVE_ENOUGH_DATA)
        if (videoRef.current.readyState !== 4) {
          setDetectionDebug(`Video not ready. ReadyState: ${videoRef.current.readyState}`);
          return;
        }

        // Check if video has valid dimensions
        if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
          setDetectionDebug(`Invalid video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
          return;
        }

        frameCount++;

        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.5
          }))
          .withFaceLandmarks();

        // Debug info every 10 frames
        if (frameCount % 10 === 0) {
          setDetectionDebug(`Frames: ${frameCount} | Detections: ${detections.length}`);
          console.log(`Detection check - Detections: ${detections.length}`, detections);
        }

        // Update face detected status
        setFaceDetected(detections.length === 1);

        // Check for multiple faces
        if (detections.length > 1) {
          setMultipleFaces(true);
          showWarning('Multiple faces detected! Only one person should be visible.');
        } else if (detections.length === 1) {
          setMultipleFaces(false);
          consecutiveNoFaceFrames = 0;

          // Assess lighting quality based on detection confidence
          if (detections[0].detection.score > 0.8) {
            setLightingQuality('good');
            lightingFrames = [];
          } else {
            lightingFrames.push(detections[0].detection.score);
            if (lightingFrames.length > 10) {
              setLightingQuality('poor');
              showWarning('Lighting appears poor. Ensure adequate lighting on your face.');
              lightingFrames = [];
            }
          }
        } else {
          consecutiveNoFaceFrames++;

          // Warn after 3 seconds without face (6 frames at 2Hz)
          if (consecutiveNoFaceFrames > 6) {
            setFaceWarnings(prev => {
              const newWarnings = prev + 1;
              if (newWarnings >= 3) {
                showWarning('Maximum face detection violations reached. Exam will be ended.');
                setTimeout(() => {
                  endExam();
                }, 1500);
              }
              return newWarnings;
            });

            showWarning(`Face not detected in frame. Keep your face visible.`);
            consecutiveNoFaceFrames = 0;
          }
        }

        // Double-check videoRef still exists before accessing dimensions
        if (!videoRef.current) {
          setDetectionDebug('Video ref became null during detection');
          return;
        }

        // Draw face detection visualization
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        };

        if (canvasRef.current && displaySize.width > 0 && displaySize.height > 0) {
          canvasRef.current.width = displaySize.width;
          canvasRef.current.height = displaySize.height;

          faceapi.draw.drawDetections(canvasRef.current,
            faceapi.resizeResults(detections, displaySize));

          if (detections.length > 0) {
            faceapi.draw.drawFaceLandmarks(canvasRef.current,
              faceapi.resizeResults(detections, displaySize));
          }
        }
      } catch (err) {
        console.error('Face detection error:', err);
        setDetectionDebug('Detection error: ' + err.message);
      }
    };

    // Run detection every 500ms (2 FPS)
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
          showWarning(`Tab switch detected (${newWarnings}/3). Returning may result in disqualification.`);

          if (newWarnings >= 3) {
            showWarning('Maximum tab switches reached. Exam will be ended.');
            setTimeout(() => {
              endExam();
            }, 1500);
          }
          return newWarnings;
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreen(false);
        showWarning('Fullscreen mode exited. Please return to fullscreen.');
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
      // Wait a moment for face detection to start
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
      // Note: Fullscreen is triggered by user click, so it should work
      // Enter fullscreen - this MUST be called directly from user interaction
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
        // Fullscreen might fail if not user-initiated or not supported
        console.warn('Fullscreen request failed:', err);
        // Don't block exam start if fullscreen fails
      }

      setShowPermissionDialog(false);
      setExamStarted(true);
      setLoading(false);

      // Fetch first question
      if (sessionData) {
        fetchNextItem(sessionData.session_id);
      }
    } catch (err) {
      console.error('Error starting exam:', err);
      setLoading(false);
    }
  };

  // ============================================================
  // HANDLE BACK/CLOSE BUTTON - Stop all streams
  // ============================================================
  const handleExitSetup = () => {
    console.log('User clicked exit/close button');
    cleanupAllResources();
    navigate('/exam/login');
  };

  // ============================================================
  // SHOW WARNING NOTIFICATION
  // ============================================================
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

  // ============================================================
  // FETCH NEXT EXAM QUESTION
  // ============================================================
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

  // ============================================================
  // HANDLE OPTION SELECTION
  // ============================================================
  const handleOptionSelect = (option) => {
    setSelectedOption(option);
  };

  // ============================================================
  // SUBMIT ANSWER
  // ============================================================
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

  // ============================================================
  // SHOW FEEDBACK
  // ============================================================
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

  // ============================================================
  // END EXAM
  // ============================================================
  const endExam = () => {
    console.log('Ending exam...');
    cleanupAllResources();
    localStorage.removeItem('cat_session');
    navigate('/exam/login');
  };

  // ============================================================
  // COMPLETE EXAM
  // ============================================================
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

      // Clean up streams
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
          {/* Close button to exit setup and cleanup resources */}
          <button
            className="dialog-close-button"
            onClick={handleExitSetup}
            title="Exit exam setup and close all streams"
          >
            X
          </button>

          {/* Stage: Instructions */}
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

          {/* Stage: Camera Setup */}
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
                  &lt;- Back
                </button>
                <button
                  className="start-exam-button"
                  onClick={handleCameraSetup}
                  disabled={!modelsLoaded}
                >
                  {!cameraActive ? 'Grant Camera Access' : (faceDetected ? 'Camera Ready - Next' : 'Loading...')}
                </button>
              </div>
            </>
          )}

          {/* Stage: Screen Sharing Setup */}
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
                  in the system dialog that appears. Do NOT select just the browser window.
                </p>
              </div>

              <div className="button-group">
                <button
                  className="start-exam-button secondary"
                  onClick={() => setSetupStage('camera')}
                >
                  &lt;- Back
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

          {/* Stage: Ready to Start */}
          {setupStage === 'ready' && (
            <>
              <div className="permission-header">
                <h1>Ready to Start</h1>
                <p>All permissions granted and verified</p>
              </div>

              <div className="setup-checklist">
                <div className="checklist-item checked">
                  <span className="check-icon">V</span>
                  <span>Camera Access - Enabled</span>
                </div>
                <div className="checklist-item checked">
                  <span className="check-icon">V</span>
                  <span>Screen Sharing - Enabled</span>
                </div>
                <div className="checklist-item checked">
                  <span className="check-icon">V</span>
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
                  &lt;- Back
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

  // ============================================================
  // RENDER: LOADING STATE
  // ============================================================
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

  // ============================================================
  // RENDER: MAIN EXAM VIEW
  // ============================================================
  const options = ['A', 'B', 'C', 'D'];

  return (
    <div className="cat-exam-container">
      <div id="answer-feedback" className="answer-feedback"></div>
      <div id="warning-notification" className="warning-notification"></div>

      {/* Monitoring Bar */}
      <div className="monitoring-bar">
        <div className={`monitor-indicator ${faceDetected ? 'active' : 'warning'}`}>
          {faceDetected ? 'Face Detected' : 'Face NOT Detected'}
        </div>
        <div className={`monitor-indicator ${multipleFaces ? 'warning' : 'active'}`}>
          {multipleFaces ? 'Multiple Faces!' : 'Single Person'}
        </div>
        <div className={`monitor-indicator ${lightingQuality === 'good' ? 'active' : lightingQuality === 'poor' ? 'warning' : 'normal'}`}>
          Lighting: {lightingQuality === 'good' ? 'Good' : lightingQuality === 'poor' ? 'Poor' : 'Analyzing'}
        </div>
        <div className="monitor-indicator">
          Face Warnings: {faceWarnings} / 3
        </div>
        <div className="monitor-indicator">
          Tab Switches: {windowWarnings} / 3
        </div>
      </div>

      {/* Camera Monitoring Feed */}
      <div className="camera-monetization">  {/* Changed from camera-monitoring */}
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
      </div>


      {/* Exam Header */}
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

      {/* Exam Content */}
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

        {/* Sidebar */}
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
              <p>Face Violations: <strong>{faceWarnings}/3</strong></p>
              <p>Tab Switches: <strong>{windowWarnings}/3</strong></p>
              <p>Lighting: <strong>{lightingQuality === 'good' ? 'Good' : lightingQuality === 'poor' ? 'Poor' : 'Analyzing'}</strong></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CATExam;