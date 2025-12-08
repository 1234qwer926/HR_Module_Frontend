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
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds

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

  // NEW: Track if video is properly connected
  const videoConnectedRef = useRef(false);

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
    videoConnectedRef.current = false;
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
    debugLog('TIME_UP', '30 minutes elapsed. Auto-submitting exam.');
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

    // Restore saved time if available (for session recovery)
    if (session.time_left && session.time_left > 0) {
      setTimeLeft(session.time_left);
      console.log('[SESSION] Restored time from saved session:', session.time_left);
    }

    // Restore stats if available
    if (session.items_completed) {
      setStats({
        itemsCompleted: session.items_completed,
        currentTheta: session.current_theta || 0.0
      });
    }

    setLoading(false);
  }, [location.state, navigate]);

  // ============================================================
  // ATTACH STREAM TO VIDEO ELEMENT - FIXED VERSION
  // ============================================================
  useEffect(() => {
    if (!cameraStream || !videoRef.current) {
      console.log('[VIDEO] Cannot attach - missing:', {
        hasCameraStream: !!cameraStream,
        hasVideoRef: !!videoRef.current
      });
      return;
    }

    const attachStream = async () => {
      try {
        console.log('[VIDEO] Starting attachment process');
        console.log('[VIDEO] Current video state:', {
          readyState: videoRef.current?.readyState,
          paused: videoRef.current?.paused,
          srcObject: !!videoRef.current?.srcObject,
          videoConnected: videoConnectedRef.current
        });

        // Check stream health
        const videoTrack = cameraStream.getVideoTracks()[0];
        console.log('[VIDEO] Stream track status:', {
          enabled: videoTrack?.enabled,
          readyState: videoTrack?.readyState,
          muted: videoTrack?.muted
        });

        // Force fresh attachment
        if (videoRef.current.srcObject !== cameraStream) {
          console.log('[VIDEO] Attaching fresh stream');
          videoRef.current.srcObject = cameraStream;
        } else {
          console.log('[VIDEO] Stream already attached, re-validating');
        }

        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);

          if (videoRef.current.readyState >= 2) {
            clearTimeout(timeout);
            resolve();
          } else {
            videoRef.current.onloadedmetadata = () => {
              clearTimeout(timeout);
              resolve();
            };
          }
        });

        console.log('[VIDEO] Metadata loaded, attempting play');
        await videoRef.current.play();
        videoConnectedRef.current = true;

        console.log('[VIDEO] ✓ Stream attached and playing successfully', {
          videoWidth: videoRef.current.videoWidth,
          videoHeight: videoRef.current.videoHeight,
          readyState: videoRef.current.readyState
        });

        // Start face monitoring if all conditions are met and not already monitoring
        if (examStarted && modelsLoaded && tfBackendReadyRef.current && !isFaceMonitoring) {
          console.log('[VIDEO] Conditions met for face monitoring, starting in 2 seconds...');
          setTimeout(() => {
            if (!isFaceMonitoring) {
              console.log('[VIDEO] Triggering face monitoring start');
              startFaceMonitoring();
            }
          }, 2000);
        }
      } catch (err) {
        console.error('[VIDEO] ✗ Attachment failed:', err.message);
        videoConnectedRef.current = false;
      }
    };

    attachStream();
  }, [cameraStream]);

  // ============================================================
  // TRIGGER FACE MONITORING WHEN CONDITIONS ARE MET
  // ============================================================
  useEffect(() => {
    if (examStarted && modelsLoaded && tfBackendReadyRef.current && videoConnectedRef.current && !isFaceMonitoring) {
      console.log('[FACE-TRIGGER] All conditions met, starting face monitoring in 2 seconds...', {
        examStarted,
        modelsLoaded,
        tfReady: tfBackendReadyRef.current,
        videoConnected: videoConnectedRef.current,
        alreadyMonitoring: isFaceMonitoring
      });

      const timer = setTimeout(() => {
        if (!isFaceMonitoring) {
          console.log('[FACE-TRIGGER] Executing face monitoring start');
          startFaceMonitoring();
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [examStarted, modelsLoaded, videoConnectedRef.current, isFaceMonitoring]);

  useEffect(() => {
    if (!examStarted || !cameraStream || !videoRef.current) return;

    console.log('[VIDEO-MONITOR] Starting video health monitor');

    const checkVideoConnection = () => {
      if (!videoRef.current) return;

      const video = videoRef.current;
      const stream = video.srcObject;

      console.log('[VIDEO-MONITOR] Health check:', {
        paused: video.paused,
        readyState: video.readyState,
        hasStream: !!stream,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        currentTime: video.currentTime
      });

      // Check if video is paused
      if (video.paused) {
        console.warn('[VIDEO-MONITOR] Video paused, attempting resume');
        video.play().catch(err => {
          console.error('[VIDEO-MONITOR] Resume failed:', err.message);
        });
      }

      // Check if stream is detached
      if (!stream || stream !== cameraStream) {
        console.warn('[VIDEO-MONITOR] Stream detached, re-attaching');
        video.srcObject = cameraStream;
        video.play().catch(err => {
          console.error('[VIDEO-MONITOR] Re-attach play failed:', err.message);
        });
      }

      // Check if video dimensions are zero (black screen indicator)
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error('[VIDEO-MONITOR] Zero dimensions detected - video not rendering!');

        // Try to recover
        const track = cameraStream.getVideoTracks()[0];
        console.log('[VIDEO-MONITOR] Track status:', {
          enabled: track?.enabled,
          readyState: track?.readyState,
          muted: track?.muted
        });

        if (track && track.readyState === 'live') {
          console.log('[VIDEO-MONITOR] Track is live, forcing video refresh');
          video.load();
          video.srcObject = cameraStream;
          video.play().catch(err => {
            console.error('[VIDEO-MONITOR] Refresh play failed:', err.message);
          });
        }
      }
    };

    const intervalId = setInterval(checkVideoConnection, 2000);

    return () => {
      console.log('[VIDEO-MONITOR] Stopping video health monitor');
      clearInterval(intervalId);
    };
  }, [examStarted, cameraStream]);

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
  // FACE DETECTION CONFIGURATION - PRODUCTION GRADE
  // ============================================================
  const FACE_DETECTION_CONFIG = {
    // SNAPSHOT & DETECTION INTERVALS
    // Industry standard: 30s-120s for snapshots, 1-2s for continuous monitoring
    DETECTION_INTERVAL: 1000,     // 1 second = continuous real-time monitoring (recommended)
    SNAPSHOT_INTERVAL: 30000,     // 30 seconds = periodic snapshot capture (Testlify uses 120s)

    // WARNING THRESHOLDS
    WARNING_THRESHOLD: 30,        // 30 frames × 1s = 30 seconds without face (relaxed)
    MAX_WARNINGS_BEFORE_FLAG: 3,  // Flag exam after 3 warnings (industry standard)

    // FACE DETECTION SENSITIVITY
    DETECTION_THRESHOLD: 0.5,     // 0.5 = balanced (0.3 = more sensitive, 0.7 = less sensitive)

    // LIGHTING QUALITY THRESHOLDS
    MIN_BRIGHTNESS: 50,           // Below = too dark
    MAX_BRIGHTNESS: 220,          // Above = too bright/washed out

    // GAZE & HEAD POSE (Future enhancement)
    GAZE_WARNING_THRESHOLD: 10,   // Warn after 10 seconds looking away
    HEAD_TURN_ANGLE_MAX: 30,      // Max 30 degrees head turn before warning

    // LOGGING & REPORTING
    LOG_INTERVAL: 30,             // Log every 30 checks = 30 seconds
    ALERT_COOLDOWN: 10000,        // 10 seconds between duplicate alerts

    // MULTI-FACE DETECTION
    IMMEDIATE_MULTI_FACE_ALERT: true,  // Alert immediately on multiple faces

    // AUDIO MONITORING (if implemented)
    AUDIO_THRESHOLD_DB: -30,      // Detect unusual audio levels
    VOICE_DETECTION_INTERVAL: 5000 // Check for voice every 5 seconds
  };

  // ============================================================
  // PROCTORING SEVERITY LEVELS
  // ============================================================
  const VIOLATION_SEVERITY = {
    LOW: {
      name: 'Low Risk',
      color: 'yellow',
      actions: ['Log event', 'Continue monitoring']
    },
    MEDIUM: {
      name: 'Medium Risk',
      color: 'orange',
      actions: ['Show warning', 'Increment counter', 'Flag for review']
    },
    HIGH: {
      name: 'High Risk',
      color: 'red',
      actions: ['Immediate alert', 'Capture snapshot', 'Consider termination']
    },
    CRITICAL: {
      name: 'Critical Violation',
      color: 'dark-red',
      actions: ['Auto-terminate exam', 'Notify administrator', 'Save evidence']
    }
  };

  // ============================================================
  // VIOLATION TYPES & SEVERITY MAPPING
  // ============================================================
  const VIOLATION_TYPES = {
    NO_FACE: { severity: 'MEDIUM', description: 'Face not visible' },
    MULTIPLE_FACES: { severity: 'HIGH', description: 'Multiple people detected' },
    POOR_LIGHTING: { severity: 'LOW', description: 'Inadequate lighting' },
    TAB_SWITCH: { severity: 'HIGH', description: 'Tab/window switched' },
    FULLSCREEN_EXIT: { severity: 'HIGH', description: 'Exited fullscreen mode' },
    LOOKING_AWAY: { severity: 'MEDIUM', description: 'Extended gaze away from screen' },
    UNAUTHORIZED_DEVICE: { severity: 'CRITICAL', description: 'Phone/tablet detected' },
    AUDIO_DETECTED: { severity: 'MEDIUM', description: 'Unusual audio activity' },
    SCREEN_SHARING_STOPPED: { severity: 'CRITICAL', description: 'Screen sharing ended' }
  };

  // ============================================================
  // BRIGHTNESS CHECK (LIGHTING QUALITY)
  // ============================================================
  const checkBrightness = async (video) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let brightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }

      return brightness / (data.length / 4);
    } catch (err) {
      return 128; // Default middle brightness
    }
  };

  // ============================================================
  // FACE DETECTION MONITORING - ENHANCED VERSION
  // ============================================================
  const startFaceMonitoring = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded || !tfBackendReadyRef.current) {
      console.error('[FACE-MONITOR] Cannot start - missing requirements:', {
        hasVideo: !!videoRef.current,
        hasCanvas: !!canvasRef.current,
        modelsLoaded,
        tfReady: tfBackendReadyRef.current
      });
      return;
    }

    if (isFaceMonitoring) {
      console.log('[FACE-MONITOR] Already monitoring, skipping duplicate start');
      return;
    }

    console.log('[FACE-MONITOR] ✓ Starting face monitoring with enhanced detection');
    setIsFaceMonitoring(true);
    let consecutiveNoFaceFrames = 0;
    let detectionCount = 0;

    const detectFaces = async () => {
      try {
        if (!videoRef.current || videoRef.current.readyState !== 4) {
          return; // Video not ready
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;

        detectionCount++;

        // Detect faces
        const detections = await faceapi.detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: FACE_DETECTION_CONFIG.DETECTION_THRESHOLD
          })
        );

        // Check lighting quality
        const brightness = await checkBrightness(video);
        const lightingGood = brightness >= FACE_DETECTION_CONFIG.MIN_BRIGHTNESS &&
          brightness <= FACE_DETECTION_CONFIG.MAX_BRIGHTNESS;
        setLightingQuality(lightingGood ? 'good' : 'poor');

        if (canvas) {
          const ctx = canvas.getContext('2d');

          // Set canvas dimensions to match video
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Handle detection results
          if (detections.length === 0) {
            consecutiveNoFaceFrames++;
            setFaceDetected(false);
            setMultipleFaces(false);

            // Warn after threshold consecutive frames without face
            if (consecutiveNoFaceFrames === FACE_DETECTION_CONFIG.WARNING_THRESHOLD) {
              const warningTime = (FACE_DETECTION_CONFIG.WARNING_THRESHOLD * FACE_DETECTION_CONFIG.DETECTION_INTERVAL) / 1000;
              setFaceWarnings(prev => {
                const newWarnings = prev + 1;
                showWarning(`⚠️ Warning ${newWarnings}: Face not detected for ${warningTime} seconds. Please ensure your face is visible.`);
                return newWarnings;
              });
              consecutiveNoFaceFrames = 0;
            }
          } else if (detections.length > 1) {
            setFaceDetected(true);
            setMultipleFaces(true);
            consecutiveNoFaceFrames = 0;
            showWarning('⚠️ Multiple faces detected! Only the candidate should be visible.');
          } else {
            // Exactly 1 face detected - ideal state
            setFaceDetected(true);
            setMultipleFaces(false);
            consecutiveNoFaceFrames = 0;
          }

          // Draw detection boxes on canvas
          const resizedDetections = faceapi.resizeResults(detections, {
            width: video.videoWidth,
            height: video.videoHeight,
          });

          faceapi.draw.drawDetections(canvas, resizedDetections);

          // Log detection status at configured interval
          if (detectionCount % FACE_DETECTION_CONFIG.LOG_INTERVAL === 0) {
            console.log('[FACE-MONITOR] Detection status:', {
              detectionNumber: detectionCount,
              checkInterval: `${FACE_DETECTION_CONFIG.DETECTION_INTERVAL}ms`,
              facesDetected: detections.length,
              brightness: Math.round(brightness),
              consecutiveNoFace: consecutiveNoFaceFrames,
              totalWarnings: faceWarnings,
              warningThreshold: `${(FACE_DETECTION_CONFIG.WARNING_THRESHOLD * FACE_DETECTION_CONFIG.DETECTION_INTERVAL) / 1000}s`
            });
          }
        }
      } catch (err) {
        // Silent catch for frame skip or temporary detection failures
        if (detectionCount % 50 === 0) {
          console.warn('[FACE-MONITOR] Detection error:', err.message);
        }
      }
    };

    // Run detection at configured interval
    console.log(`[FACE-MONITOR] Setting up detection interval (${FACE_DETECTION_CONFIG.DETECTION_INTERVAL}ms = ${FACE_DETECTION_CONFIG.DETECTION_INTERVAL / 1000}s)`);
    console.log(`[FACE-MONITOR] Warning will trigger after ${(FACE_DETECTION_CONFIG.WARNING_THRESHOLD * FACE_DETECTION_CONFIG.DETECTION_INTERVAL) / 1000} seconds without face`);
    detectionIntervalRef.current = setInterval(() => detectFaces(), FACE_DETECTION_CONFIG.DETECTION_INTERVAL);
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
    console.log('[FETCH] Loading next question');
    console.log('[FETCH] Video state before fetch:', {
      paused: videoRef.current?.paused,
      readyState: videoRef.current?.readyState,
      hasStream: !!videoRef.current?.srcObject
    });

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/cat/next-item', { session_id: sessionId });
      setCurrentItem(response.data);
      setSelectedOption('');
      setItemStartTime(Date.now());

      console.log('[FETCH] Next question loaded');
      console.log('[FETCH] Video state after fetch:', {
        paused: videoRef.current?.paused,
        readyState: videoRef.current?.readyState,
        hasStream: !!videoRef.current?.srcObject
      });
    } catch (err) {
      console.error('[FETCH] Error loading question:', err);
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

    console.log('[SUBMIT] Answer submission started');
    console.log('[SUBMIT] Video state before submit:', {
      paused: videoRef.current?.paused,
      readyState: videoRef.current?.readyState,
      hasStream: !!videoRef.current?.srcObject
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

      console.log('[SUBMIT] Answer submitted successfully');

      const updatedStats = {
        itemsCompleted: response.data.items_completed,
        currentTheta: response.data.current_theta
      };
      setStats(updatedStats);

      // Update session data with latest theta and time left
      const updatedSessionData = {
        ...sessionData,
        current_theta: response.data.current_theta,
        time_left: timeLeft,
        items_completed: response.data.items_completed
      };
      setSessionData(updatedSessionData);
      localStorage.setItem('cat_session', JSON.stringify(updatedSessionData));

      showFeedback(response.data.is_correct);

      console.log('[SUBMIT] Video state after stats update:', {
        paused: videoRef.current?.paused,
        readyState: videoRef.current?.readyState,
        hasStream: !!videoRef.current?.srcObject
      });

      if (response.data.should_continue) {
        setTimeout(() => {
          console.log('[SUBMIT] Fetching next item');
          fetchNextItem(sessionData.session_id);
        }, 1500);
      } else {
        setTimeout(() => completeExam(sessionData.session_id), 1500);
      }
    } catch (err) {
      console.error('[SUBMIT] Error:', err);
      alert('Error submitting answer.');
    } finally {
      setSubmitting(false);
      console.log('[SUBMIT] Submission process complete');
    }
  };

  const showFeedback = (correct) => {
    const feedback = document.getElementById('answer-feedback');
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
                  <li><strong>Time Limit:</strong> The exam will auto-submit after 30 minutes.</li>
                  <li>Your entire screen will be recorded during the exam</li>
                  <li>You cannot go back to previous questions</li>
                </ul>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                <button className="start-exam-button" onClick={handleInstructionsConfirm}>
                  I Understand - Proceed to Setup
                </button>
              </div>
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
                <div className="camera-preview-container" style={{ maxHeight: '300px' }}>
                  <video ref={videoRef} autoPlay playsInline muted className="preview-video" style={{ maxHeight: '300px' }} />
                  <canvas ref={canvasRef} className="preview-canvas" style={{ maxHeight: '300px' }} />
                  <div className="preview-status">
                    {!cameraActive ? <span className="status-badge inactive">Not connected</span> :
                      <span className="status-badge active">Camera Active</span>}
                  </div>
                </div>
              </div>
              <div className="button-group">
                <button className="start-exam-button secondary" onClick={() => setSetupStage('instructions')}>← Back</button>
                <button className="start-exam-button" onClick={handleCameraSetup} disabled={!modelsLoaded}>
                  {!cameraActive ? 'Grant Camera Access' : 'Next Step'}
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
                <ol className="screen-instruction-list" style={{ textAlign: 'left', margin: '15px 0' }}>
                  <li>Click the "Grant Screen Access" button below.</li>
                  <li>A browser popup will appear. Select the tab labeled <strong>"Entire Screen"</strong> (or "Entire Monitor").</li>
                  <li>Click on the preview image of your screen to select it.</li>
                  <li>Click <strong>"Share"</strong> to confirm.</li>
                </ol>
                <p style={{ fontSize: '0.9em', color: '#666' }}>
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
                  <li>✅ Camera is active and monitoring.</li>
                  <li>✅ Screen sharing is active and monitoring.</li>
                  <li>✅ Fullscreen mode will activate automatically.</li>
                  <li>⏱️ <strong>Time Limit:</strong> You have 30 minutes to complete 30 questions.</li>
                  <li>⚠️ Do not refresh the page or close the browser.</li>
                </ul>
                <p style={{ marginTop: '15px', fontWeight: 'bold', color: '#d9534f' }}>
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

  // Don't unmount the entire component during loading - just show overlay
  const showLoadingOverlay = loading || !currentItem;

  const optionsArray = ['A', 'B', 'C', 'D'];
  const progressPercentage = (stats.itemsCompleted / 30) * 100;
  const timerColor = timeLeft < 300 ? '#ff4444' : '#2c3e50';

  return (
    <div className="cat-exam-container">
      <div id="answer-feedback" className="answer-feedback"></div>
      <div id="warning-notification" className="warning-notification"></div>

      {/* Loading overlay - doesn't unmount video */}
      {showLoadingOverlay && (
        <div className="loading-container" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(44, 62, 80, 0.95)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="spinner-large"></div>
          <p style={{ color: 'white', marginTop: '20px' }}>Loading next question...</p>
        </div>
      )}

      {cameraStream && (
        <div className="camera-monitoring" style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          width: '220px',
          height: '165px',
          zIndex: 1000,
          border: `3px solid ${faceDetected ? '#51cf66' : '#ff6b6b'}`,
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#000',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="monitoring-video"
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <canvas
            ref={canvasRef}
            className="monitoring-canvas"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          />
          {/* Live indicator */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: '#ff4757',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 'bold'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: 'white',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }}></div>
            LIVE
          </div>
        </div>
      )}

      {/* Add pulse animation for live indicator */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div className="monitoring-bar">
        <div className={`monitor-indicator ${faceDetected ? 'active' : 'warning'}`}>
          {faceDetected ? '✓ Face Detected' : '⚠ No Face'}
        </div>
        <div className={`monitor-indicator ${multipleFaces ? 'warning' : 'active'}`}>
          {multipleFaces ? '⚠ Multiple Faces' : '✓ Single Person'}
        </div>
        <div className={`monitor-indicator ${lightingQuality === 'good' ? 'active' : 'warning'}`}>
          {lightingQuality === 'good' ? '✓ Good Lighting' : '⚠ Poor Lighting'}
        </div>
        <div className="monitor-indicator timer" style={{ backgroundColor: timerColor, color: 'white', fontWeight: 'bold' }}>
          ⏱️ {formatTime(timeLeft)}
        </div>
      </div>

      <div className="exam-header">
        <div className="candidate-info">
          <h2 style={{ color: '#ffffffff' }}>{sessionData.candidate_name}</h2>
          <p style={{ color: '#ffffffff' }}>{sessionData.job_title}</p>
        </div>
        <div className="exam-stats">
          <div className="stat-item">
            <span className="stat-label" style={{ color: '#ffffffff' }}>Progress</span>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }}></div>
            </div>
            <span className="stat-value small" style={{ color: '#ffffffff' }}>{stats.itemsCompleted} / 30</span>
          </div>
        </div>
      </div>

      {currentItem && (
        <div className="exam-content">
          <div className="question-card">
            <div className="question-header-row">
              <div className="question-number" style={{ color: '#ffffffff' }}>Question {currentItem.item_number}</div>
              <div className="question-timer" style={{ color: '#ffffffff', fontWeight: 'bold' }}>Time Left: {formatTime(timeLeft)}</div>
            </div>

            <div className="question-text" style={{ color: '#ffffffff' }}>{currentItem.question}</div>

            <div className="options-container">
              {optionsArray.map((option) => (
                <div
                  key={option}
                  className={`option ${selectedOption === option ? 'selected' : ''} ${submitting ? 'disabled' : ''}`}
                  onClick={() => !submitting && handleOptionSelect(option)}
                >
                  <div className="option-letter" style={{ color: '#ffffff' }}>{option}</div>
                  <div className="option-text" style={{ color: '#ffffff' }}>{currentItem[`option_${option.toLowerCase()}`]}</div>
                  {selectedOption === option && <div className="option-checkmark">✓</div>}
                </div>
              ))}
            </div>

            <button className="submit-answer-button" onClick={submitAnswer} disabled={!selectedOption || submitting}>
              {submitting ? 'Submitting...' : 'Submit Answer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CATExam;