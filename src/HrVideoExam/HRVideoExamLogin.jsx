import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  TextInput,
  Button,
  Container,
  Title,
  Card,
  Text,
  Loader,
  Group,
  Alert,
  Progress,
  Badge,
  Stack,
  Paper,
  Center,
  Modal,
  Box,
  Image,
  Divider,
} from "@mantine/core";
import {
  IconCheck,
  IconAlertCircle,
  IconVideo,
  IconPlayerPlay,
  IconPlayerStop,
  IconTrash,
  IconUpload,
  IconCircleCheck,
  IconMicrophone,
  IconArrowLeft,
  IconEye,
  IconClock,
  IconVolume2,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import * as faceapi from "face-api.js";
import Webcam from "react-webcam";

const API_BASE_URL = "https://ratio-infections-singer-auction.trycloudflare.com";

const HRVideoExamLogin = () => {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================

  const [stage, setStage] = useState("login");
  const [email, setEmail] = useState("");
  const [examKey, setExamKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Exam Data
  const [applicationId, setApplicationId] = useState(null);
  const [candidateName, setCandidateName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Timer States
  const [timeLeft, setTimeLeft] = useState(5 * 60);
  const [totalTimeLeft, setTotalTimeLeft] = useState(0);

  // Video Recording
  const mediaRecorderRef = useRef(null);
  const liveVideoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const webcamRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const totalTimerIntervalRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAnswers, setRecordedAnswers] = useState([]);
  const recordingIntervalRef = useRef(null);

  // ✅ NEW: Track auto-play state
  const [questionAutoPlayTriggered, setQuestionAutoPlayTriggered] = useState({});

  // Transcription & Speech
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();
  const transcriptRef = useRef("");

  // Proctoring & Face Detection
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [lightingIssue, setLightingIssue] = useState(false);
  const [showLiveVideo, setShowLiveVideo] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // Photo Capture
  const [photoTaken, setPhotoTaken] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [webcamReady, setWebcamReady] = useState(false);
  const [webcamError, setWebcamError] = useState(null);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Video Constraints
  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user",
  };

  const liveVideoConstraints = {
    width: 220,
    height: 165,
    facingMode: "user",
    frameRate: 30,
  };

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // ✅ NEW: Upload video to S3
  const uploadVideoToS3 = async (blob, filename) => {
    try {
      const formData = new FormData();
      formData.append("file", blob, filename);

      const response = await axios.post(
        `${API_BASE_URL}/upload-to-s3`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("S3 upload response:", response.data);
      return response.data.key; // Returns S3 key
    } catch (err) {
      console.error("S3 upload error:", err);
      throw err;
    }
  };

  // ============================================================
  // INITIALIZATION & FACE DETECTION MODELS
  // ============================================================

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    const loadFaceModels = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        console.log("Face recognition models loaded");
      } catch (error) {
        console.error("Error loading face models:", error);
      }
    };
    loadFaceModels();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      clearInterval(timerIntervalRef.current);
      clearInterval(totalTimerIntervalRef.current);
      clearInterval(recordingIntervalRef.current);
    };
  }, []);

  // ✅ NEW: Auto-play question after 2 seconds
  useEffect(() => {
    if (stage === "exam" && questions.length > 0) {
      const currentQuestionKey = `q${currentQuestionIndex}`;

      if (!questionAutoPlayTriggered[currentQuestionKey]) {
        const autoPlayTimer = setTimeout(() => {
          const currentQuestion = questions[currentQuestionIndex];
          if (currentQuestion) {
            speakQuestion(currentQuestion.question_text);
            setQuestionAutoPlayTriggered((prev) => ({
              ...prev,
              [currentQuestionKey]: true,
            }));
            console.log(`Auto-playing question ${currentQuestionIndex + 1}`);
          }
        }, 2000);

        return () => clearTimeout(autoPlayTimer);
      }
    }
  }, [stage, currentQuestionIndex, questions, questionAutoPlayTriggered]);

  // Face detection loop
  useEffect(() => {
    if (modelsLoaded && stage === "exam") {
      const detectFaces = async () => {
        if (
          liveVideoRef.current &&
          liveVideoRef.current.video &&
          liveVideoRef.current.video.readyState === 4
        ) {
          const video = liveVideoRef.current.video;
          const canvas = faceCanvasRef.current;
          if (canvas) {
            const detections = await faceapi.detectAllFaces(
              video,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 224,
                scoreThreshold: 0.5,
              })
            );

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const brightness = await checkBrightness(video);
            setLightingIssue(brightness < 50);

            if (detections.length === 0) {
              setFaceDetected(false);
              setMultipleFaces(false);
            } else if (detections.length > 1) {
              setFaceDetected(true);
              setMultipleFaces(true);
            } else {
              setFaceDetected(true);
              setMultipleFaces(false);
            }

            const resizedDetections = faceapi.resizeResults(detections, {
              width: video.videoWidth,
              height: video.videoHeight,
            });

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            faceapi.draw.drawDetections(canvas, resizedDetections);
          }
        }
      };

      const interval = setInterval(detectFaces, 2000);
      return () => clearInterval(interval);
    }
  }, [modelsLoaded, stage]);

  const checkBrightness = async (video) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
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
  };

  // ============================================================
  // WEBCAM HANDLERS
  // ============================================================

  const handleUserMedia = (stream) => {
    setWebcamReady(true);
    streamRef.current = stream;
    setWebcamError(null);
  };

  const handleUserMediaError = (error) => {
    setWebcamError(error.message);
    setWebcamReady(false);
  };

  const takePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedPhoto(imageSrc);
        setPhotoTaken(true);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setPhotoTaken(false);
  };

  // ============================================================
  // EXAM LOGIN HANDLER
  // ============================================================

  const handleStartExam = async () => {
    if (!email || !examKey) {
      setError("Please enter both email and exam key");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.put(
        `${API_BASE_URL}/start-exam/${encodeURIComponent(email)}/${examKey}`
      );

      console.log("Login response:", response.data);

      setApplicationId(response.data.application_id);
      setCandidateName(response.data.candidate_name);
      setJobTitle(response.data.job_title);
      setQuestions(response.data.video_questions || []);
      setCurrentQuestionIndex(0);
      setRecordedAnswers([]);
      setQuestionAutoPlayTriggered({});

      setStage("photo");
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err.response?.data?.detail ||
        "Invalid email or exam key. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // TEXT-TO-SPEECH HANDLER
  // ============================================================

  const speakQuestion = (text) => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      speechSynthesis.speak(utterance);
    }
  };

  // ============================================================
  // VIDEO RECORDING HANDLERS
  // ============================================================

  const startRecording = async () => {
    try {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true, language: "en-US" });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=vp9,opus",
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
      });
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        SpeechRecognition.stopListening();
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);

        const currentQuestion = questions[currentQuestionIndex];

        // ✅ UPDATED: Use transcript for both fields
        const questionData = {
          id: Date.now(),
          blob,
          url,
          pageNumber: currentQuestionIndex + 1,
          questionText: currentQuestion.question_text,
          transcript: transcriptRef.current, // Auto-generated speech-to-text
          user_answer_text: transcriptRef.current, // ✅ NEW: Same as transcript
          timestamp: new Date().toISOString(),
          job_video_question_id: currentQuestion.id,
          s3_key: null, // ✅ NEW: Will be filled after S3 upload
        };

        setRecordedAnswers((prev) => [...prev, questionData]);
        setIsRecording(false);

        notifications.show({
          title: "Recording Saved",
          message: `Answer for question ${currentQuestionIndex + 1} recorded.`,
          color: "green",
        });
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      streamRef.current = stream;
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      notifications.show({
        title: "Recording Started",
        message: "Speak your answer now...",
        color: "blue",
      });
    } catch (err) {
      setError("Unable to access camera/microphone. Please check permissions.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const deleteRecording = () => {
    const updatedAnswers = recordedAnswers.filter(
      (ans) => ans.pageNumber !== currentQuestionIndex + 1
    );
    setRecordedAnswers(updatedAnswers);
    setRecordingTime(0);
    resetTranscript();
  };

  // ============================================================
  // TIMER LOGIC
  // ============================================================

  useEffect(() => {
    if (stage === "exam" && questions.length > 0) {
      setTimeLeft(5 * 60);

      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timerIntervalRef.current);
    }
  }, [currentQuestionIndex, stage, questions.length]);

  useEffect(() => {
    if (stage === "exam" && totalTimeLeft > 0) {
      totalTimerIntervalRef.current = setInterval(() => {
        setTotalTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(totalTimerIntervalRef.current);
            handleTotalTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(totalTimerIntervalRef.current);
    }
  }, [stage, totalTimeLeft]);

  const handleTimeUp = () => {
    if (isRecording) {
      stopRecording();
    }

    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    if (isLastQuestion) {
      submitExam();
    } else {
      handleNextQuestion();
    }
  };

  const handleTotalTimeUp = () => {
    if (isRecording) stopRecording();
    submitExam();
  };

  // ============================================================
  // FULLSCREEN HANDLERS
  // ============================================================

  const enterFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
      document.addEventListener("fullscreenchange", handleFullscreenChange);
    }
  };

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      setFullscreen(false);
      notifications.show({
        title: "Warning: Fullscreen Exited",
        message: "Exiting fullscreen mode may be flagged.",
        color: "orange",
      });
    }
  };

  // ============================================================
  // NAVIGATION HANDLERS
  // ============================================================

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      if (isRecording) {
        stopRecording();
      }
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      resetTranscript();
    }
  };

  const toggleLiveVideo = () => setShowLiveVideo(!showLiveVideo);

  const goBack = () => {
    if (window.confirm("Exit exam? Progress will be lost.")) {
      setStage("login");
      setEmail("");
      setExamKey("");
      setError("");
      setRecordedAnswers([]);
      setCandidateName("");
      setJobTitle("");
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setQuestionAutoPlayTriggered({});
    }
  };

  // ============================================================
  // SUBMISSION HANDLER - UPDATED WITH S3 UPLOAD
  // ============================================================

  const submitExam = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // ✅ UPDATED: Upload videos to S3 first
      const batchDataWithS3Keys = await Promise.all(
        recordedAnswers.map(async (answer) => {
          let s3Key = answer.s3_key;

          // Upload to S3 if not already uploaded
          if (!s3Key && answer.blob) {
            try {
              const filename = `answer-video-q${answer.job_video_question_id}-${Date.now()}.webm`;
              s3Key = await uploadVideoToS3(answer.blob, filename);
              console.log(`Uploaded video for question ${answer.job_video_question_id}, S3 key: ${s3Key}`);
            } catch (uploadErr) {
              console.error(`Failed to upload video for question ${answer.job_video_question_id}:`, uploadErr);
              notifications.show({
                title: "Upload Error",
                message: `Failed to upload video for question ${answer.job_video_question_id}`,
                color: "red",
              });
              throw uploadErr;
            }
          }

          return {
            application_id: applicationId,
            job_video_question_id: answer.job_video_question_id,
            video_path: s3Key, // ✅ UPDATED: Use S3 key instead of local path
            duration_seconds: answer.recordingTime || recordingTime || 0,
            user_answer_text: answer.user_answer_text || answer.transcript, // ✅ UPDATED: Use speech-to-text
            transcript: answer.transcript, // ✅ UPDATED: Use speech-to-text
            recorded_at: answer.timestamp,
          };
        })
      );

      console.log("Submitting batch with S3 keys:", batchDataWithS3Keys);

      // Submit to backend
      const submitResponse = await axios.post(
        `${API_BASE_URL}/video-responses/batch`,
        batchDataWithS3Keys
      );

      console.log("Submission response:", submitResponse.data);

      setSuccessMessage("All responses submitted successfully!");
      setStage("completed");
      setRecordedAnswers([]);
      setCurrentQuestionIndex(0);
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        err.response?.data?.detail ||
        "Failed to submit responses. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // RENDER STAGES
  // ============================================================

  if (stage === "login") {
    return (
      <Container size="sm" py="xl">
        <Card shadow="sm" radius="md" withBorder>
          <Stack spacing="lg">
            <div>
              <Title order={2} ta="center" mb="xs">
                HR Video Interview
              </Title>
              <Text ta="center" color="dimmed" size="sm">
                Welcome to the interview portal
              </Text>
            </div>

            <TextInput
              label="Email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <TextInput
              label="Exam Key"
              placeholder="Enter your exam key"
              type="password"
              value={examKey}
              onChange={(e) => setExamKey(e.target.value)}
              required
            />

            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Error"
                color="red"
              >
                {error}
              </Alert>
            )}

            <Button
              onClick={handleStartExam}
              size="md"
              fullWidth
              disabled={loading || !email || !examKey}
              loading={loading}
            >
              {loading ? "Validating..." : "Start Exam"}
            </Button>

            <Paper p="md" radius="md" bg="blue.0">
              <Text size="sm" weight={500} mb="xs">
                📌 Important:
              </Text>
              <Stack spacing="xs" size="sm">
                <Text size="sm">✓ Ensure good lighting and quiet environment</Text>
                <Text size="sm">✓ Check camera and microphone permissions</Text>
                <Text size="sm">✓ Questions will be read aloud automatically</Text>
                <Text size="sm">✓ Speak your answers - transcribed automatically</Text>
                <Text size="sm">✓ Limited time for each question</Text>
              </Stack>
            </Paper>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (stage === "photo") {
    return (
      <Container size="md" py="xl">
        <Title order={2} ta="center" mb="xl">
          Identity Photo Capture
        </Title>
        <Card shadow="sm" padding="lg" radius="md" mb="xl">
          <Title order={4} mb="md">
            Take Your Photo
          </Title>
          <Center mb="lg">
            {!photoTaken ? (
              <Box ta="center">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  width={400}
                  height={300}
                  videoConstraints={videoConstraints}
                  onUserMedia={handleUserMedia}
                  onUserMediaError={handleUserMediaError}
                  style={{
                    borderRadius: 8,
                    marginBottom: 16,
                    backgroundColor: "#000",
                    border: webcamReady ? "2px solid #51cf66" : "2px solid #868e96",
                  }}
                />
                <Button
                  leftSection={<IconUpload size={16} />}
                  onClick={takePhoto}
                  size="lg"
                  disabled={!webcamReady}
                >
                  Take Photo
                </Button>
              </Box>
            ) : (
              <Box ta="center">
                <Image
                  src={capturedPhoto}
                  alt="Identity"
                  style={{
                    width: 400,
                    height: 300,
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                />
                <Group justify="center">
                  <Button variant="outline" onClick={retakePhoto}>
                    Retake
                  </Button>
                  <Button onClick={() => setStage("verification")} color="green">
                    Use Photo
                  </Button>
                </Group>
              </Box>
            )}
          </Center>
        </Card>
        <Group justify="space-between">
          <Button
            variant="outline"
            onClick={() => setStage("login")}
            leftSection={<IconArrowLeft size={16} />}
          >
            Back
          </Button>
        </Group>
      </Container>
    );
  }

  if (stage === "verification") {
    return (
      <Container size="md" py="xl">
        <Title order={2} ta="center" mb="xl">
          Identity Verification
        </Title>
        <Stack>
          <Card shadow="sm" padding="lg" radius="md">
            <Group justify="space-between" mb="md">
              <Group>
                <IconUpload size={20} />
                <Text>Identity Photo</Text>
                {photoTaken && <Badge color="green">Captured</Badge>}
              </Group>
              <Button size="sm" variant="outline" onClick={() => setStage("photo")}>
                Change
              </Button>
            </Group>
            {capturedPhoto && (
              <Center>
                <Image
                  src={capturedPhoto}
                  alt="Identity"
                  style={{
                    width: 200,
                    height: 150,
                    borderRadius: 8,
                  }}
                />
              </Center>
            )}
          </Card>

          {photoTaken && (
            <Card shadow="sm" padding="lg" radius="md">
              <Alert color="orange" mb="md">
                The exam will start in fullscreen with live monitoring. You cannot go back.
              </Alert>
              <Center>
                <Button
                  onClick={() => {
                    const totalExamTime = questions.length * 5 * 60;
                    setTotalTimeLeft(totalExamTime);
                    setStage("exam");
                    setTimeout(enterFullscreen, 1000);
                  }}
                  size="lg"
                  color="green"
                >
                  Start Exam
                </Button>
              </Center>
            </Card>
          )}
        </Stack>
        <Group justify="space-between" mt="md">
          <Button
            variant="outline"
            onClick={() => setStage("photo")}
            leftSection={<IconArrowLeft size={16} />}
          >
            Back
          </Button>
        </Group>
      </Container>
    );
  }

  if (stage === "exam") {
    if (!browserSupportsSpeechRecognition) {
      return (
        <Container size="md" py="xl">
          <Alert color="red">
            Speech recognition not supported. Please use Chrome or Edge browser.
          </Alert>
        </Container>
      );
    }

    if (!questions.length) {
      return (
        <Container size="md" py="xl">
          <Center>
            <Text>Loading questions...</Text>
          </Center>
        </Container>
      );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const progressPercentage = Math.round(
      ((currentQuestionIndex + 1) / questions.length) * 100
    );
    const isAnswered = recordedAnswers.some(
      (a) => a.pageNumber === currentQuestionIndex + 1
    );

    return (
      <Box>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>

        {/* Top Bar */}
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            background: "#1a1a1a",
            color: "white",
            padding: "8px 16px",
            zIndex: 1001,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Group>
            <Badge color="red" variant="dot">
              MONITORING
            </Badge>
            <Badge color={listening ? "orange" : "blue"} variant="dot">
              {listening ? "LISTENING" : "READY"}
            </Badge>
          </Group>
          <Group>
            <Badge color={faceDetected ? "green" : "red"}>
              {faceDetected ? "Face OK" : "No Face"}
            </Badge>
            <Button
              size="xs"
              variant="subtle"
              onClick={toggleLiveVideo}
              style={{ color: "white" }}
            >
              <IconEye size={14} /> {showLiveVideo ? "Hide" : "Show"}
            </Button>
            {!fullscreen && (
              <Button size="xs" onClick={enterFullscreen}>
                Go Fullscreen
              </Button>
            )}
          </Group>
        </Box>

        {/* Total Exam Timer */}
        <Box
          style={{
            position: "fixed",
            top: 60,
            right: 20,
            background: "#ff4757",
            color: "white",
            padding: "8px 16px",
            borderRadius: 8,
            zIndex: 1002,
            fontWeight: "bold",
            fontSize: "18px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <Group gap={8}>
            <IconClock size={20} />
            <Text>{formatTime(totalTimeLeft)}</Text>
          </Group>
        </Box>

        {/* Live Video Feed */}
        {showLiveVideo && modelsLoaded && (
          <Box
            style={{
              position: "fixed",
              top: 120,
              right: 20,
              width: 220,
              height: 165,
              zIndex: 1000,
              border: `3px solid ${faceDetected ? "#51cf66" : "#ff6b6b"}`,
              borderRadius: 12,
              overflow: "hidden",
              background: "#000",
            }}
          >
            <Webcam
              audio={false}
              ref={liveVideoRef}
              mirrored
              muted
              videoConstraints={liveVideoConstraints}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <canvas
              ref={faceCanvasRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            />
            <Box
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "#ff4757",
                color: "white",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: "white",
                  borderRadius: "50%",
                  animation: "pulse 2s infinite",
                }}
              ></div>
              LIVE
            </Box>
          </Box>
        )}

        {/* Hidden webcam for recording */}
        <Box style={{ position: "fixed", top: -1000, left: -1000 }}>
          <Webcam
            audio
            muted
            ref={webcamRef}
            onUserMedia={handleUserMedia}
            videoConstraints={videoConstraints}
          />
        </Box>

        <Container size="xl" py="md" pt={60} style={{ paddingRight: showLiveVideo ? 260 : 20 }}>
          <Title order={3} mb="md" ta="center">
            {jobTitle}
          </Title>

          {/* Question Timer */}
          <Card
            shadow="sm"
            p="xs"
            radius="md"
            mb="lg"
            style={{
              background: timeLeft <= 60 ? "#fff5f5" : "#f8f9fa",
            }}
          >
            <Group justify="center">
              <IconClock size={18} color={timeLeft <= 60 ? "red" : "blue"} />
              <Text
                size="lg"
                weight={700}
                color={timeLeft <= 60 ? "red" : "blue"}
              >
                Time Remaining: {formatTime(timeLeft)}
              </Text>
            </Group>
          </Card>

          {/* Progress */}
          <Card shadow="sm" p="sm" radius="md" mb="lg">
            <Group justify="space-between" mb="xs">
              <Text size="sm" weight={500}>
                Progress
              </Text>
              <Text size="sm" color="dimmed">
                {progressPercentage}%
              </Text>
            </Group>
            <Progress
              value={progressPercentage}
              color="blue"
              label={`${progressPercentage}%`}
            />
          </Card>

          {/* Question Card */}
          <Card shadow="lg" p="xl" radius="md" mb="lg">
            <Group justify="space-between" mb="md">
              <Title order={4}>Question {currentQuestionIndex + 1}</Title>
              <Badge color="blue" size="lg">
                {currentQuestionIndex + 1} of {questions.length}
              </Badge>
            </Group>

            <Text size="lg" mb="md" style={{ lineHeight: 1.8 }}>
              {currentQuestion.question_text}
            </Text>

            <Button
              variant="light"
              leftSection={<IconVolume2 size={16} />}
              onClick={() => speakQuestion(currentQuestion.question_text)}
              mb="lg"
            >
              🔊 Read Question Aloud (Auto-plays after 2 seconds)
            </Button>

            <Divider my="lg" />

            {/* Recording Section */}
            <Box p="xl" style={{
              border: "2px dashed #dee2e6",
              borderRadius: 12,
              textAlign: "center",
              background: "#f8f9fa",
            }}>
              <IconVideo size={56} color="#868e96" style={{ marginBottom: 16 }} />
              {isAnswered && (
                <Badge color="green" size="lg" mb="lg">
                  <IconCheck size={14} /> Answer Recorded
                </Badge>
              )}

              {listening && (
                <Box
                  mt="lg"
                  p="md"
                  style={{
                    border: "1px solid #ced4da",
                    borderRadius: 8,
                    background: "#f1f3f5",
                  }}
                >
                  <Group mb="xs">
                    <IconMicrophone size={16} />
                    <Text size="sm" weight={500}>
                      Live Transcript (Auto-converted from your speech)
                    </Text>
                  </Group>
                  <Text color="dimmed" size="sm" style={{ fontStyle: "italic" }}>
                    {transcript || "Start speaking... Your words will appear here"}
                  </Text>
                </Box>
              )}

              <Center mt="xl">
                {isRecording ? (
                  <Button
                    onClick={stopRecording}
                    color="green"
                    size="xl"
                    leftSection={<IconPlayerStop size={20} />}
                  >
                    Stop Recording ({formatTime(recordingTime)})
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={startRecording}
                      color="blue"
                      size="xl"
                      leftSection={<IconPlayerPlay size={20} />}
                      disabled={isAnswered}
                    >
                      {isAnswered ? "✓ Answer Recorded" : "🎤 Start Recording"}
                    </Button>
                    {isAnswered && (
                      <Button
                        onClick={deleteRecording}
                        color="red"
                        variant="light"
                        size="sm"
                        ml="md"
                        leftSection={<IconTrash size={16} />}
                      >
                        Re-record
                      </Button>
                    )}
                  </>
                )}
              </Center>
            </Box>
          </Card>

          {/* Navigation */}
          <Card shadow="sm" p="lg" radius="md" style={{ background: "#f8f9fa" }}>
            <Group justify="space-between">
              <Text size="sm" color="dimmed">
                Question {currentQuestionIndex + 1} of {questions.length}
              </Text>
              {!isLastQuestion ? (
                <Button onClick={handleNextQuestion} size="lg" color="blue">
                  Next Question →
                </Button>
              ) : (
                <Button
                  onClick={submitExam}
                  size="lg"
                  color="green"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  leftSection={<IconUpload size={16} />}
                >
                  {isSubmitting ? "Uploading to S3..." : "Submit Exam"}
                </Button>
              )}
            </Group>
          </Card>
        </Container>

        {/* Submitting Modal */}
        <Modal
          opened={isSubmitting}
          withCloseButton={false}
          centered
          size="sm"
          onClose={() => { }}
        >
          <Center py="xl">
            <Stack align="center">
              <Loader size="xl" />
              <Text size="lg" weight={600}>
                Submitting Exam...
              </Text>
              <Text size="sm" color="dimmed">
                Uploading videos to S3 and processing your responses.
              </Text>
            </Stack>
          </Center>
        </Modal>
      </Box>
    );
  }

  if (stage === "completed") {
    return (
      <Container size="md" py="xl">
        <Center>
          <Stack align="center">
            <IconCircleCheck size={64} color="green" />
            <Title order={2}>✓ Exam Completed Successfully!</Title>
            <Text color="dimmed">
              Your exam has been submitted with all videos uploaded to S3.
            </Text>
            <Text size="sm" color="dimmed">
              Thank you, {candidateName}! Your responses are being evaluated.
            </Text>
            <Button
              onClick={() => {
                setStage("login");
                setQuestionAutoPlayTriggered({});
              }}
              mt="lg"
              size="lg"
            >
              Return to Login
            </Button>
          </Stack>
        </Center>
      </Container>
    );
  }

  return null;
};

export default HRVideoExamLogin;