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
      debugLog('CLEANUP_INTERVAL', 'Detection interval cleared');
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
      });
      setCameraStream(null);
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      screenStreamRef.current = null;
    }

    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.();
        debugLog('CLEANUP_FULLSCREEN', 'Exited fullscreen');
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
      debugLog('ROUTE_CHANGE', { pathname: location.pathname, action: 'cleanup' });
      cleanupAllResources();
    }
  }, [location.pathname, cameraStream]);

  useEffect(() => {
    return () => {
      debugLog('COMPONENT_UNMOUNT', 'Component unmounting, cleaning up');
      cleanupAllResources();
    };
  }, []);

  // ============================================================
  // LOAD FACE-API MODELS - LOCAL /models/ FOLDER
  // ============================================================
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoadingError(null);
        const MODEL_URL = '/models/';
        debugLog('MODEL_LOAD_START', { url: MODEL_URL });
        const startTime = Date.now();
        
        let attempts = 0;
        while (!tfBackendReadyRef.current && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!tfBackendReadyRef.current) {
          debugLog('MODEL_LOAD_WARNING', 'TF backend not ready, loading anyway');
        }
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        
        const loadTime = Date.now() - startTime;
        debugLog('MODEL_LOAD_SUCCESS', { loadTimeMs: loadTime, backendReady: tfBackendReadyRef.current });
        setModelsLoaded(true);
        modelRetryCountRef.current = 0;
      } catch (err) {
        debugLog('MODEL_LOAD_ERROR', { message: err.message, attempt: modelRetryCountRef.current });
        setModelLoadingError(`Model loading failed: ${err.message}`);
        
        if (modelRetryCountRef.current < 3) {
          modelRetryCountRef.current += 1;
          const delayMs = Math.pow(2, modelRetryCountRef.current) * 1000;
          debugLog('MODEL_LOAD_RETRY', { attempt: modelRetryCountRef.current, delayMs });
          setTimeout(loadModels, delayMs);
        } else {
          debugLog('MODEL_LOAD_MAX_RETRIES', 'Failed after 3 attempts');
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
    debugLog('SESSION_INIT', 'Initializing session');
    const session = location.state?.sessionData || JSON.parse(localStorage.getItem('cat_session') || 'null');

    if (!session) {
      debugLog('SESSION_NOT_FOUND', 'Redirecting to login');
      navigate('/exam/login');
      return;
    }

    debugLog('SESSION_LOADED', { candidateName: session.candidate_name, sessionId: session.session_id });
    setSessionData(session);
    setLoading(false);
  }, [location.state, navigate]);

  // ============================================================
  // ATTACH STREAM TO VIDEO ELEMENT
  // ============================================================
  useEffect(() => {
    if (!cameraStream) {
      debugLog('STREAM_CHECK', 'No camera stream available');
      return;
    }

    const attachStream = async () => {
      debugLog('STREAM_ATTACH_START', {
        streamId: cameraStream.id,
        streamActive: cameraStream.active,
        streamTracks: cameraStream.getTracks().length
      });

      let attempts = 0;
      const maxAttempts = examStarted ? 10 : 20;
      
      while (!videoRef.current && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 300));
        attempts++;
      }

      if (!videoRef.current) {
        debugLog('ERROR', 'Video element not found after waiting');
        setDetectionDebug('ERROR: Video element not found');
        return;
      }

      try {
        debugLog('SET_SRCOBJECT', { 
          videoRef: !!videoRef.current,
          streamTracks: cameraStream.getTracks().length
        });
        videoRef.current.srcObject = cameraStream;

        const metadataPromise = new Promise((resolve) => {
          const onLoadedMetadata = () => {
            debugLog('METADATA_LOADED', {
              videoWidth: videoRef.current?.videoWidth,
              videoHeight: videoRef.current?.videoHeight,
              readyState: videoRef.current?.readyState
            });
            videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve();
          };
          
          const timeout = setTimeout(() => {
            debugLog('METADATA_TIMEOUT', 'No metadata after 10s, proceeding anyway');
            videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve();
          }, 10000);

          videoRef.current?.addEventListener('loadedmetadata', onLoadedMetadata);
        });

        await metadataPromise;

        debugLog('PLAY_VIDEO', 'Attempting to play video');
        const playPromise = videoRef.current?.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              debugLog('VIDEO_PLAYING', {
                width: videoRef.current?.videoWidth,
                height: videoRef.current?.videoHeight,
                readyState: videoRef.current?.readyState
              });
            })
            .catch(err => {
              debugLog('PLAY_ERROR', { message: err.message, name: err.name });
            });
        }

        if (examStarted && modelsLoaded && tfBackendReadyRef.current && !isFaceMonitoring) {
          debugLog('SCHEDULE_MONITORING', { delayMs: 1500 });
          setTimeout(() => {
            debugLog('TRIGGER_MONITORING', 'Calling startFaceMonitoring');
            startFaceMonitoring();
          }, 1500);
        }

      } catch (err) {
        debugLog('ERROR_ATTACHING_STREAM', { message: err.message, name: err.name });
        setDetectionDebug(`Error: ${err.message}`);
      }
    };

    attachStream();

  }, [cameraStream, examStarted, modelsLoaded, isFaceMonitoring]);

  // ============================================================
  // REQUEST CAMERA & SCREEN
  // ============================================================
  const requestCameraPermission = async () => {
    try {
      debugLog('CAMERA_PERMISSION_REQUEST', 'Requesting camera access');
      setDetectionDebug('Requesting camera...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      });

      debugLog('CAMERA_STREAM_OBTAINED', { streamId: stream.id, videoTracks: stream.getVideoTracks().length });
      setDetectionDebug('Camera stream obtained');

      setCameraStream(stream);
      setCameraActive(true);

      return true;
    } catch (err) {
      debugLog('CAMERA_PERMISSION_DENIED', { message: err.message, name: err.name });
      setModelLoadingError('Camera access is required for exam proctoring.');
      setDetectionDebug('Camera error: ' + err.message);
      return false;
    }
  };

  const requestScreenPermission = async () => {
    try {
      debugLog('SCREEN_PERMISSION_REQUEST', 'Requesting screen sharing');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor' },
        audio: false
      });
      screenStreamRef.current = stream;
      
      debugLog('SCREEN_STREAM_OBTAINED', { streamId: stream.id });
      setScreenSharingActive(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          debugLog('SCREEN_SHARING_STOPPED', 'User stopped screen sharing');
          setScreenSharingActive(false);
          showWarning('Screen sharing was stopped. Exam session will be terminated.');
          setTimeout(() => {
            endExam();
          }, 1500);
        };
      }

      return true;
    } catch (err) {
      debugLog('SCREEN_PERMISSION_DENIED', { message: err.message, name: err.name });
      if (err.name !== 'NotAllowedError') {
        setModelLoadingError('Screen sharing is required for exam. Please try again.');
      }
      return false;
    }
  };

  // ============================================================
  // FACE DETECTION MONITORING - WORKING VERSION (PROVEN)
  // ============================================================
  const startFaceMonitoring = async () => {
    debugLog('START_MONITORING_CALLED', {
      hasVideoRef: !!videoRef.current,
      hasCanvasRef: !!canvasRef.current,
      modelsLoaded,
      isFaceMonitoring,
      tfBackendReady: tfBackendReadyRef.current
    });

    if (!videoRef.current || !canvasRef.current || !modelsLoaded || !tfBackendReadyRef.current || isFaceMonitoring) {
      debugLog('ERROR', 'Prerequisites not met for face monitoring');
      return;
    }

    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      debugLog('WARNING', 'Video not ready, retrying in 800ms');
      setTimeout(() => startFaceMonitoring(), 800);
      return;
    }

    debugLog('MONITORING_STARTED', 'Face detection loop initializing');
    setIsFaceMonitoring(true);

    let consecutiveNoFaceFrames = 0;
    let frameCount = 0;
    let lastLogTime = Date.now();

    // ✅ PROVEN WORKING FACE DETECTION LOOP
    const detectFaces = async () => {
      try {
        if (videoRef.current && videoRef.current.readyState === 4) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (canvas) {
            try {
              // ✅ SIMPLE DIRECT DETECTION - Works reliably
              const detections = await faceapi.detectAllFaces(
                video,
                new faceapi.TinyFaceDetectorOptions({
                  inputSize: 224,
                  scoreThreshold: 0.5,
                })
              );

              const ctx = canvas.getContext('2d');
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              if (detections.length === 0) {
                consecutiveNoFaceFrames++;
                setFaceDetected(false);
                setMultipleFaces(false);

                if (consecutiveNoFaceFrames === 10) {
                  debugLog('NO_FACE_WARNING', { frame: frameCount });
                  setFaceWarnings(prev => {
                    const newWarnings = prev + 1;
                    showWarning(`⚠️ Warning ${newWarnings}: Face not detected. Keep your face visible.`);
                    return newWarnings;
                  });
                  consecutiveNoFaceFrames = 0;
                }
              } else if (detections.length > 1) {
                setFaceDetected(true);
                setMultipleFaces(true);
                consecutiveNoFaceFrames = 0;
                debugLog('MULTIPLE_FACES', { count: detections.length });
                showWarning('⚠️ Multiple faces detected! Only one person should be visible.');
              } else {
                setFaceDetected(true);
                setMultipleFaces(false);
                consecutiveNoFaceFrames = 0;

                const score = detections[0].detection.score;
                if (score > 0.85) {
                  setLightingQuality('good');
                } else if (score < 0.6) {
                  setLightingQuality('poor');
                  if (frameCount % 30 === 0) {
                    debugLog('LIGHTING_POOR', { score: score.toFixed(3) });
                  }
                }
              }

              const resizedDetections = faceapi.resizeResults(detections, {
                width: video.videoWidth,
                height: video.videoHeight,
              });

              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              faceapi.draw.drawDetections(canvas, resizedDetections);
              
              if (frameCount % 10 === 0) {
                debugLog('FACE_DETECTION_SUCCESS', { facesDetected: detections.length });
              }
            } catch (detectionError) {
              debugLog('DETECTION_ERROR_CATCH', { message: detectionError.message });
              // Continue despite errors - don't crash
            }
          }
        }
      } catch (err) {
        debugLog('DETECTION_LOOP_ERROR', { message: err.message });
      }
    };

    frameCount = 0;
    debugLog('INTERVAL_CREATED', { intervalMs: 500 });
    detectionIntervalRef.current = setInterval(() => {
      frameCount++;
      detectFaces();
    }, 500);
  };

  // ============================================================
  // PAGE VISIBILITY & FULLSCREEN MONITORING
  // ============================================================
  useEffect(() => {
    if (!examStarted) return;

    debugLog('MONITORING_SETUP', 'Setting up page visibility and fullscreen monitoring');

    const handleVisibilityChange = () => {
      if (document.hidden) {
        debugLog('TAB_SWITCH_DETECTED', { hidden: true });
        setWindowWarnings(prev => {
          const newWarnings = prev + 1;
          showWarning(`⚠️ Warning ${newWarnings}: Tab switch detected. This activity is being recorded.`);
          return newWarnings;
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        debugLog('FULLSCREEN_EXITED', 'Fullscreen mode exited');
        setIsFullScreen(false);
        showWarning('⚠️ Fullscreen mode exited. Please return to fullscreen for better experience.');
      } else {
        debugLog('FULLSCREEN_ENTERED', 'Fullscreen mode entered');
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
    debugLog('SETUP_STAGE_CHANGE', { from: 'instructions', to: 'camera' });
    setSetupStage('camera');
  };

  const handleCameraSetup = async () => {
    debugLog('CAMERA_SETUP_START', 'User clicking camera setup');
    const success = await requestCameraPermission();
    if (success) {
      setTimeout(() => {
        debugLog('SETUP_STAGE_CHANGE', { from: 'camera', to: 'screen' });
        setSetupStage('screen');
      }, 2000);
    }
  };

  const handleScreenSetup = async () => {
    debugLog('SCREEN_SETUP_START', 'User clicking screen setup');
    const success = await requestScreenPermission();
    if (success) {
      debugLog('SETUP_STAGE_CHANGE', { from: 'screen', to: 'ready' });
      setSetupStage('ready');
    }
  };

  const handleStartExam = async () => {
    debugLog('EXAM_START_INITIATED', 'User clicking start exam');
    setLoading(true);
    try {
      debugLog('DIALOG_HIDE', 'Hiding permission dialog');
      setShowPermissionDialog(false);
      setExamStarted(true);

      await new Promise(resolve => setTimeout(resolve, 300));

      try {
        debugLog('FULLSCREEN_REQUEST', 'Requesting fullscreen');
        const docElem = document.documentElement;
        if (docElem.requestFullscreen) {
          await docElem.requestFullscreen();
        } else if (docElem.webkitRequestFullscreen) {
          await docElem.webkitRequestFullscreen();
        } else if (docElem.msRequestFullscreen) {
          await docElem.msRequestFullscreen();
        }
        setIsFullScreen(true);
        debugLog('FULLSCREEN_SUCCESS', 'Entered fullscreen mode');
      } catch (err) {
        debugLog('FULLSCREEN_FAILED', err.message);
      }

      setLoading(false);

      if (sessionData) {
        setTimeout(() => {
          debugLog('FETCH_FIRST_ITEM', { sessionId: sessionData.session_id });
          fetchNextItem(sessionData.session_id);
        }, 500);
      }
    } catch (err) {
      debugLog('EXAM_START_ERROR', err.message);
      setLoading(false);
    }
  };

  const handleExitSetup = () => {
    debugLog('USER_EXIT_SETUP', 'User clicked exit button');
    cleanupAllResources();
    navigate('/exam/login');
  };

  const showWarning = (message) => {
    debugLog('SHOW_WARNING', message);
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
    debugLog('FETCH_NEXT_ITEM', { sessionId });
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/cat/next-item', {
        session_id: sessionId
      });
      debugLog('ITEM_RECEIVED', { itemNumber: response.data.item_number, itemId: response.data.item_id });
      setCurrentItem(response.data);
      setSelectedOption('');
      setItemStartTime(Date.now());
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes('complete')) {
        debugLog('EXAM_COMPLETE_SIGNAL', 'Exam should be completed');
        completeExam(sessionId);
      } else {
        debugLog('FETCH_ITEM_ERROR', err.message);
        alert('Error loading question. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (option) => {
    debugLog('OPTION_SELECTED', { option });
    setSelectedOption(option);
  };

  const submitAnswer = async () => {
    if (!selectedOption) {
      alert('Please select an answer before submitting.');
      return;
    }

    debugLog('ANSWER_SUBMIT_START', {
      itemId: currentItem.item_id,
      selectedOption,
      timeSpentMs: Date.now() - itemStartTime
    });

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

      debugLog('ANSWER_SUBMITTED', {
        isCorrect: response.data.is_correct,
        itemsCompleted: response.data.items_completed,
        currentTheta: response.data.current_theta,
        shouldContinue: response.data.should_continue
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
      debugLog('ANSWER_SUBMIT_ERROR', err.message);
      alert('Error submitting answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const showFeedback = (correct) => {
    debugLog('SHOW_FEEDBACK', { correct });
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
    debugLog('EXAM_ENDED', 'Ending exam session');
    cleanupAllResources();
    localStorage.removeItem('cat_session');
    navigate('/exam/login');
  };

  const completeExam = async (sessionId) => {
    try {
      debugLog('EXAM_COMPLETION_START', { sessionId, violations: { face: faceWarnings, tab: windowWarnings } });
      
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }

      const response = await axios.post('http://localhost:8000/cat/complete', {
        session_id: sessionId,
        face_violations: faceWarnings,
        tab_violations: windowWarnings
      });

      debugLog('EXAM_COMPLETED', { score: response.data });
      cleanupAllResources();
      localStorage.removeItem('cat_session');
      navigate('/exam/complete', { state: { results: response.data } });
    } catch (err) {
      debugLog('EXAM_COMPLETION_ERROR', err.message);
      alert('Error completing exam. Please contact support.');
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
                  <li>Only one person should be visible on camera</li>
                  <li>Your entire screen will be recorded during the exam</li>
                  <li>You cannot go back to previous questions</li>
                  <li>Exam duration: 30 questions (adaptive difficulty)</li>
                  <li>Violations may result in exam disqualification</li>
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
                    {!cameraActive ? (
                      <span className="status-badge inactive">Camera not connected</span>
                    ) : !modelsLoaded ? (
                      <span className="status-badge loading">Loading face detection...</span>
                    ) : !faceDetected ? (
                      <span className="status-badge inactive">Waiting for face...</span>
                    ) : !multipleFaces ? (
                      <span className="status-badge active">Face Detected</span>
                    ) : (
                      <span className="status-badge warning">Multiple faces detected</span>
                    )}
                  </div>
                  <div className="debug-info">{detectionDebug}</div>
                </div>
              </div>
              <div className="button-group">
                <button className="start-exam-button secondary" onClick={() => setSetupStage('instructions')}>← Back</button>
                <button className="start-exam-button" onClick={handleCameraSetup} disabled={!modelsLoaded}>
                  {!cameraActive ? 'Grant Camera Access' : faceDetected ? 'Camera Ready - Next' : 'Loading...'}
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
                <p className="warning-text">When you click "Grant Screen Access", select "Entire Screen" or "Monitor" in the system dialog.</p>
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
                <p>All permissions granted and verified</p>
              </div>
              <div className="button-group">
                <button className="start-exam-button secondary" onClick={() => setSetupStage('screen')}>← Back</button>
                <button className="start-exam-button success" onClick={handleStartExam} disabled={loading}>
                  {loading ? <>Waiting.....</> : 'Start Exam Now'}
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
        <p>{!modelsLoaded ? 'Loading face detection models...' : 'Initializing exam...'}</p>
        {modelLoadingError && <p className="error-text">{modelLoadingError}</p>}
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

      {cameraStream && (
        <div className="camera-monitoring">
          <video ref={videoRef} autoPlay playsInline muted className="monitoring-video" />
          <canvas ref={canvasRef} className="monitoring-canvas" />
          {!faceDetected && <div className="video-overlay"><span>Waiting for face...</span></div>}
        </div>
      )}

      <div className="monitoring-bar">
        <div className={`monitor-indicator ${faceDetected ? 'active' : 'warning'}`}>
          {faceDetected ? '✓ Face Detected' : '⚠ Face NOT Detected'}
        </div>
        <div className={`monitor-indicator ${multipleFaces ? 'warning' : 'active'}`}>
          {multipleFaces ? '⚠ Multiple Faces!' : '✓ Single Person'}
        </div>
        <div className={`monitor-indicator ${faceWarnings > 0 ? 'warning' : 'active'}`}>
          Face Warnings: {faceWarnings}
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
          <div className="question-number">Question {currentItem.item_number}</div>
          <div className="question-text">{currentItem.question}</div>
          <div className="options-container">
            {options.map((option) => (
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