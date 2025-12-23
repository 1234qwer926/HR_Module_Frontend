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
  Center,
  Modal,
  Box,
  Image,
  Divider,
  PasswordInput,
  SimpleGrid,
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
  IconMail,
  IconKey,
  IconShieldCheck,
  IconCamera,
  IconNetwork,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import * as faceapi from "face-api.js";
import Webcam from "react-webcam";

const API_BASE_URL = "https://mails-split-sec-units.trycloudflare.com";

const HRVideoExamLogin = () => {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================

  const [stage, setStage] = useState("login");
  const [email, setEmail] = useState("");
  const [examKey, setExamKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Exam Data
  const [applicationId, setApplicationId] = useState(null);
  const [candidateName, setCandidateName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Timer States
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTimeLeft, setTotalTimeLeft] = useState(0);
  const [totalExamTime, setTotalExamTime] = useState(0);

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
  const [showManualClose, setShowManualClose] = useState(false);

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

  const calculateTotalExamTime = (questionsArray) => {
    const totalSeconds = questionsArray.reduce(
      (sum, q) => sum + (q.duration_seconds || 0),
      0
    );
    const totalMinutes = Math.ceil(totalSeconds / 60);
    const roundedMinutes = Math.ceil(totalMinutes / 5) * 5;
    return roundedMinutes * 60;
  };

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
      return response.data.key;
    } catch (err) {
      console.error("S3 upload error:", err);
      throw err;
    }
  };

  // ============================================================
  // INITIALIZATION & FACE DETECTION MODELS
  // ============================================================

  useEffect(() => {
    const hasSpeechRecognition =
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window;

    console.log("🔍 Checking speech recognition support...");
    console.log(
      "  - browserSupportsSpeechRecognition:",
      browserSupportsSpeechRecognition
    );
    console.log(
      "  - webkitSpeechRecognition in window:",
      "webkitSpeechRecognition" in window
    );
    console.log("  - SpeechRecognition in window:", "SpeechRecognition" in window);
    console.log("  - User Agent:", navigator.userAgent);

    if (!browserSupportsSpeechRecognition || !hasSpeechRecognition) {
      console.error("❌ Speech recognition NOT supported in this browser");
      notifications.show({
        title: "Browser Not Supported",
        message:
          "Please use Chrome or Edge for speech recognition. Safari and Firefox are not supported.",
        color: "red",
        autoClose: false,
      });
    } else {
      console.log("✅ Speech recognition IS supported");
    }
  }, [browserSupportsSpeechRecognition]);

  useEffect(() => {
    transcriptRef.current = transcript;
    if (transcript && transcript.length > 0) {
      console.log("📝 Transcript updated:", transcript, "| listening:", listening);
    }
  }, [transcript, listening]);

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

      const questionsData = response.data.video_questions || [];
      const totalTime = calculateTotalExamTime(questionsData);

      setApplicationId(response.data.application_id);
      setCandidateName(response.data.candidate_name);
      setJobTitle(response.data.job_title);
      setQuestions(questionsData);
      setCurrentQuestionIndex(0);
      setRecordedAnswers([]);
      setTotalExamTime(totalTime);

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
  // VIDEO RECORDING HANDLERS
  // ============================================================

  const startRecording = async () => {
    try {
      console.log("🎬 Starting recording process...");
      console.log(
        "Browser supports speech recognition:",
        browserSupportsSpeechRecognition
      );

      if (!browserSupportsSpeechRecognition) {
        throw new Error(
          "Speech recognition not supported. Please use Chrome or Edge."
        );
      }

      resetTranscript();
      console.log("🔄 Transcript reset");

      console.log("🎤 Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log("✅ Microphone access granted");
      console.log("📊 Audio tracks:", stream.getAudioTracks().length);
      console.log(
        "📊 Audio track settings:",
        stream.getAudioTracks()[0]?.getSettings()
      );

      console.log("🎤 Starting speech recognition...");
      try {
        SpeechRecognition.startListening({
          continuous: true,
          language: "en-US",
        });
        console.log("✅ Speech recognition startListening called");
      } catch (speechErr) {
        console.error("❌ Error starting speech recognition:", speechErr);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("🎤 After 1s delay - listening state:", listening);
      console.log("🎤 Current transcript:", transcript);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=vp9,opus",
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
      });

      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
          console.log("📹 Video chunk recorded:", event.data.size, "bytes");
        }
      };

      mediaRecorder.onstop = () => {
        const finalTranscript = transcriptRef.current || "";
        console.log("🛑 Recording stopped");
        console.log("📝 Final transcript:", finalTranscript);
        console.log("📝 Transcript length:", finalTranscript.length);
        console.log("📝 Listening state at stop:", listening);

        SpeechRecognition.stopListening();

        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const currentQuestion = questions[currentQuestionIndex];

        const questionData = {
          id: Date.now(),
          blob,
          url,
          pageNumber: currentQuestionIndex + 1,
          questionText: currentQuestion.question_text,
          transcript: finalTranscript,
          user_answer_text: finalTranscript,
          timestamp: new Date().toISOString(),
          job_video_question_id: currentQuestion.id,
          s3_key: null,
          recordingTime: recordingTime,
        };

        setRecordedAnswers((prev) => [...prev, questionData]);
        setIsRecording(false);

        const wordCount = finalTranscript
          .split(" ")
          .filter((w) => w.length > 0).length;

        if (!finalTranscript || finalTranscript.length === 0) {
          notifications.show({
            title: "⚠️ No Transcript Captured",
            message:
              "Speech recognition may not be working. Check browser permissions and try Chrome/Edge.",
            color: "orange",
            autoClose: 8000,
          });
        } else {
          notifications.show({
            title: "✅ Recording Saved",
            message: `Answer recorded with ${wordCount} words`,
            color: "green",
          });
        }
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
        title: "🎬 Recording Started",
        message: "🎤 Speak now... Live transcription is active",
        color: "blue",
        autoClose: 3000,
      });

      console.log("✅ Recording setup complete");

      const debugInterval = setInterval(() => {
        console.log(
          "⏰ Periodic check - listening:",
          listening,
          "| transcript length:",
          transcript?.length || 0
        );
      }, 3000);

      const originalStop = mediaRecorder.onstop;
      mediaRecorder.onstop = () => {
        clearInterval(debugInterval);
        originalStop();
      };
    } catch (err) {
      console.error("❌ Recording error:", err);
      setError("Unable to access camera/microphone. Please check permissions.");
      notifications.show({
        title: "❌ Error",
        message: err.message || "Failed to start recording",
        color: "red",
      });
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
    if (
      stage === "exam" &&
      questions.length > 0 &&
      currentQuestionIndex < questions.length
    ) {
      const currentQuestion = questions[currentQuestionIndex];
      setTimeLeft(currentQuestion.duration_seconds || 0);

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
  }, [currentQuestionIndex, stage, questions]);

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
        title: "⚠️ Warning: Fullscreen Exited",
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
    }
  };

  // ============================================================
  // SUBMISSION HANDLER (UPDATED)
  // ============================================================

  const submitExam = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Show notification to user
      notifications.show({
        title: "📤 Submitting Your Responses",
        message: "Please wait while we process your answers...",
        color: "blue",
        autoClose: false,
        id: "submitting-exam",
      });

      // Add small delay to ensure UI updates before heavy processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      const batchDataWithS3Keys = await Promise.all(
        recordedAnswers.map(async (answer) => {
          let s3Key = answer.s3_key;

          if (!s3Key && answer.blob) {
            try {
              const filename = `answer-video-q${answer.job_video_question_id}-${Date.now()}.webm`;
              s3Key = await uploadVideoToS3(answer.blob, filename);
              console.log(
                `✅ Uploaded video for question ${answer.job_video_question_id}, S3 key: ${s3Key}`
              );
            } catch (uploadErr) {
              console.error(
                `❌ Failed to upload video for question ${answer.job_video_question_id}:`,
                uploadErr
              );
              notifications.hide("submitting-exam");
              notifications.show({
                title: "❌ Upload Error",
                message: `Failed to upload video for question ${answer.job_video_question_id}`,
                color: "red",
              });
              throw uploadErr;
            }
          }

          return {
            application_id: applicationId,
            job_video_question_id: answer.job_video_question_id,
            video_path: s3Key,
            duration_seconds: answer.recordingTime || recordingTime || 0,
            user_answer_text: answer.user_answer_text || answer.transcript || "",
            transcript: answer.transcript || "",
            recorded_at: answer.timestamp,
          };
        })
      );

      console.log("📤 Submitting batch with S3 keys:", batchDataWithS3Keys);

      const submitResponse = await axios.post(
        `${API_BASE_URL}/video-responses/batch`,
        batchDataWithS3Keys
      );

      console.log("✅ Submission response:", submitResponse.data);

      // Hide the submitting notification
      notifications.hide("submitting-exam");

      // Show success notification
      notifications.show({
        title: "✅ Submission Complete",
        message: "Your exam has been successfully submitted!",
        color: "green",
      });

      setStage("completed");
      setRecordedAnswers([]);
      setCurrentQuestionIndex(0);
    } catch (err) {
      console.error("❌ Submission error:", err);

      // Hide submitting notification
      notifications.hide("submitting-exam");

      setError(
        err.response?.data?.detail ||
          "Failed to submit responses. Please try again."
      );

      notifications.show({
        title: "❌ Submission Failed",
        message: "There was an error submitting your exam. Please try again.",
        color: "red",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // RENDER STAGES
  // ============================================================

  // LOGIN STAGE
  if (stage === "login") {
    return (
      <Box
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          overflow: "hidden",
        }}
      >
        <SimpleGrid
          cols={{ base: 1, md: 100 }}
          spacing={0}
          style={{
            width: "100%",
            height: "100vh",
            gridTemplateColumns: "40% 60%",
          }}
        >
          {/* LEFT SIDE - LOGIN FORM (40%) */}
          <Box
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "40px 30px",
              background: "#ffffff",
            }}
          >
            <Stack gap="lg" style={{ width: "100%", maxWidth: "380px" }}>
              {/* Header */}
              <Stack align="center" gap="md">
                <Box
                  style={{
                    width: 60,
                    height: 60,
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconShieldCheck size={32} stroke={2.5} color="white" />
                </Box>
                <div style={{ textAlign: "center" }}>
                  <Title order={2} size="h3" c="#333" mb="xs">
                    HR Interview
                  </Title>
                  <Text c="#666666" size="sm">
                    Assessment Platform
                  </Text>
                </div>
              </Stack>

              {/* Form Card */}
              <Card
                shadow="md"
                radius="lg"
                p="lg"
                withBorder
                style={{
                  background: "white",
                  border: "1px solid #e0e0e0",
                }}
              >
                <Stack gap="lg">
                  <div>
                    <Title order={4} size="h5" mb="6px" c="#333">
                      Welcome
                    </Title>
                    <Text color="dimmed" size="sm">
                      Enter credentials to continue
                    </Text>
                  </div>

                  {/* Email Input */}
                  <TextInput
                    label="Email Address"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    leftSection={<IconMail size={16} color="#667eea" />}
                    size="sm"
                    radius="md"
                    styles={{
                      input: {
                        borderColor: "#ddd",
                        "&:focus": {
                          borderColor: "#667eea",
                          boxShadow: "0 0 0 3px rgba(102, 126, 234, 0.1)",
                        },
                      },
                      label: {
                        fontWeight: 600,
                        marginBottom: "6px",
                        fontSize: "13px",
                        color: "#333",
                      },
                    }}
                  />

                  {/* Exam Key Input */}
                  <PasswordInput
                    label="Access Key"
                    placeholder="Enter exam key"
                    value={examKey}
                    onChange={(e) => {
                      setExamKey(e.target.value);
                      setError("");
                    }}
                    leftSection={<IconKey size={16} color="#667eea" />}
                    size="sm"
                    radius="md"
                    styles={{
                      input: {
                        borderColor: "#ddd",
                        "&:focus": {
                          borderColor: "#667eea",
                          boxShadow: "0 0 0 3px rgba(102, 126, 234, 0.1)",
                        },
                      },
                      label: {
                        fontWeight: 600,
                        marginBottom: "6px",
                        fontSize: "13px",
                        color: "#333",
                      },
                    }}
                  />

                  {/* Error Alert */}
                  {error && (
                    <Alert
                      icon={<IconAlertCircle size={14} />}
                      title="Error"
                      color="red"
                      variant="light"
                      radius="lg"
                      styles={{
                        message: { fontSize: "12px" },
                      }}
                    >
                      {error}
                    </Alert>
                  )}

                  {/* Submit Button */}
                  <Button
                    onClick={handleStartExam}
                    fullWidth
                    disabled={loading || !email || !examKey}
                    loading={loading}
                    radius="md"
                    style={{
                      height: "42px",
                      fontSize: "14px",
                      fontWeight: 600,
                      transition: "all 0.3s ease",
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                    }}
                    leftSection={
                      loading ? (
                        <Loader size={14} color="white" />
                      ) : (
                        <IconCheck size={16} />
                      )
                    }
                  >
                    {loading ? "Validating..." : "Start Interview"}
                  </Button>
                </Stack>
              </Card>

              {/* Footer */}
              <Text size="xs" c="#999999" ta="center">
                © 2025 PulsePharma. All rights reserved.
              </Text>
            </Stack>
          </Box>

          {/* RIGHT SIDE - INSTRUCTIONS (60%) */}
          <Box
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "50px 40px",
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Stack gap="lg">
              <div>
                <Title order={2} c="white" mb="xs" size="h3">
                  Important Guidelines
                </Title>
                <Text c="rgba(255, 255, 255, 0.9)" size="sm">
                  Please review before starting
                </Text>
              </div>

              {/* Requirements List */}
              <Stack gap="md">
                <RequirementItem
                  icon={<IconCamera size={20} color="white" stroke={2} />}
                  title="Webcam & Microphone"
                  description="Ensure good lighting and quiet environment"
                />
                <RequirementItem
                  icon={<IconNetwork size={20} color="white" stroke={2} />}
                  title="Stable Connection"
                  description="Use desktop/laptop with stable internet"
                />
                <RequirementItem
                  icon={<IconMicrophone size={20} color="white" stroke={2} />}
                  title="Speech Recognition"
                  description="Your answers are transcribed automatically"
                />
                <RequirementItem
                  icon={<IconCheck size={20} color="white" stroke={2} />}
                  title="Time Management"
                  description="Each question has its own time limit"
                />
                <RequirementItem
                  icon={<IconClock size={20} color="white" stroke={2} />}
                  title="Total Exam Time"
                  description="Manage your time across all questions"
                />
              </Stack>

              {/* Warning Alert */}
              <Alert
                color="yellow"
                variant="light"
                radius="lg"
                icon={<IconAlertCircle size={16} />}
                styles={{
                  message: { fontSize: "12px" },
                }}
              >
                <strong>Note:</strong> Exiting fullscreen or switching tabs may
                be flagged during the exam
              </Alert>
            </Stack>
          </Box>
        </SimpleGrid>
      </Box>
    );
  }

  // ============================================================
  // PHOTO STAGE
  // ============================================================

  if (stage === "photo") {
    return (
      <Container size="md" py="xl">
        <Title order={2} ta="center" mb="xl">
          📸 Identity Photo Capture
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
                    border: webcamReady
                      ? "2px solid #51cf66"
                      : "2px solid #868e96",
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

  // ============================================================
  // VERIFICATION STAGE
  // ============================================================

  if (stage === "verification") {
    return (
      <Container size="md" py="xl">
        <Title order={2} ta="center" mb="xl">
          ✓ Identity Verification
        </Title>
        <Stack>
          <Card shadow="sm" padding="lg" radius="md">
            <Group justify="space-between" mb="md">
              <Group>
                <IconUpload size={20} />
                <Text>Identity Photo</Text>
                {photoTaken && <Badge color="green">✓ Captured</Badge>}
              </Group>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStage("photo")}
              >
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
                🎬 The exam will start in fullscreen with live monitoring. You
                cannot go back.
              </Alert>
              <Center>
                <Button
                  onClick={() => {
                    setTotalTimeLeft(totalExamTime);
                    setStage("exam");
                    setTimeout(enterFullscreen, 1000);
                  }}
                  size="lg"
                  color="green"
                >
                  ▶️ Start Exam ({formatTime(totalExamTime)})
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

  // ============================================================
  // EXAM STAGE
  // ============================================================

  if (stage === "exam") {
    if (!browserSupportsSpeechRecognition) {
      return (
        <Container size="md" py="xl">
          <Alert color="red">
            ❌ Speech recognition not supported. Please use Chrome or Edge
            browser.
          </Alert>
        </Container>
      );
    }

    if (!questions.length) {
      return (
        <Container size="md" py="xl">
          <Center>
            <Text>⏳ Loading questions...</Text>
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
              🔴 MONITORING
            </Badge>
            <Badge color={isRecording ? "orange" : "blue"} variant="dot">
              {isRecording ? "🔴 RECORDING" : "🔵 READY"}
            </Badge>
          </Group>
          <Group>
            <Badge color={faceDetected ? "green" : "red"}>
              {faceDetected ? "✓ Face OK" : "✗ No Face"}
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
                ⛶ Go Fullscreen
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
            <Text>⏱️ {formatTime(totalTimeLeft)}</Text>
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
                fontSize: 11,
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
              />
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

        {/* Main Exam Content */}
        <Container
          size="xl"
          py="md"
          pt={60}
          style={{
            paddingRight: showLiveVideo ? 260 : 20,
          }}
        >
          {/* Question Title */}
          <Title order={3} mb="md" ta="center">
            {jobTitle}
          </Title>

          {/* Question Timer */}
          <Card shadow="sm" p="xs" radius="md" mb="lg">
            <Group justify="center">
              <IconClock
                size={18}
                color={timeLeft <= 30 ? "red" : "blue"}
              />
              <Text
                size="lg"
                weight={700}
                color={timeLeft <= 30 ? "red" : "blue"}
              >
                Question Timer: {formatTime(timeLeft)}
              </Text>
            </Group>
          </Card>

          {/* Progress Bar */}
          <Card shadow="sm" p="sm" radius="md" mb="lg">
            <Group justify="space-between" mb="xs">
              <Text size="sm" weight={500}>
                Progress
              </Text>
              <Text size="sm" color="dimmed">
                {progressPercentage}%
              </Text>
            </Group>
            <Progress value={progressPercentage} color="blue" label={progressPercentage} />
          </Card>

          {/* Question Card */}
          <Card shadow="lg" p="xl" radius="md" mb="lg">
            <Group justify="space-between" mb="md">
              <Title order={4}>
                Question {currentQuestionIndex + 1}
              </Title>
              <Badge color="blue" size="lg">
                {currentQuestionIndex + 1} of {questions.length}
              </Badge>
            </Group>
            <Text size="lg" mb="md" style={{ lineHeight: 1.8 }}>
              {currentQuestion.question_text}
            </Text>
            <Divider my="lg" />

            {/* Recording Section */}
            <Box p="xl" style={{
              border: "2px dashed #dee2e6",
              borderRadius: 12,
              textAlign: "center",
              background: "#f8f9fa",
            }}>
              <IconVideo
                size={56}
                color="#868e96"
                style={{ marginBottom: 16 }}
              />
              {isAnswered && (
                <Badge color="green" size="lg" mb="lg">
                  <IconCheck size={14} /> Answer Recorded
                </Badge>
              )}

              {/* Live Transcript */}
              {isRecording && (
                <Box mt="lg" p="md" style={{
                  border: "2px solid #667eea",
                  borderRadius: 8,
                  background: "#f0f4ff",
                  minHeight: 120,
                }}>
                  <Group mb="xs" justify="space-between">
                    <Group gap="xs">
                      <IconMicrophone size={18} color="#667eea" />
                      <Text size="sm" weight={600} c="#667eea">
                        LIVE TRANSCRIPTION
                      </Text>
                    </Group>
                    <Badge
                      color={listening ? "green" : "orange"}
                      variant="dot"
                      size="sm"
                    >
                      {listening ? "Listening" : "Initializing"}
                    </Badge>
                  </Group>
                  <Box style={{
                    minHeight: 80,
                    padding: 12,
                    background: "white",
                    borderRadius: 6,
                    border: "1px solid #e0e0e0",
                  }}>
                    {transcript && transcript.length > 0 ? (
                      <Text
                        c="#333"
                        size="md"
                        style={{
                          lineHeight: 1.6,
                          wordWrap: "break-word",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {transcript}
                      </Text>
                    ) : (
                      <Text
                        c="#999"
                        size="md"
                        style={{
                          fontStyle: "italic",
                          lineHeight: 1.6,
                        }}
                      >
                        {listening
                          ? "Listening... Start speaking into your microphone..."
                          : "Initializing microphone... Please speak after it turns green..."}
                      </Text>
                    )}
                  </Box>
                  {transcript && transcript.length > 0 && (
                    <Group justify="space-between" mt="xs">
                      <Text size="xs" c="dimmed">
                        {transcript.split(" ").filter((w) => w.length > 0).length} words
                      </Text>
                      <Text size="xs" c="green" weight={600}>
                        Capturing
                      </Text>
                    </Group>
                  )}
                </Box>
              )}

              {/* Recording Buttons */}
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
                  <Button
                    onClick={startRecording}
                    color="blue"
                    size="xl"
                    leftSection={<IconPlayerPlay size={20} />}
                    disabled={isAnswered}
                  >
                    {isAnswered ? "Answer Recorded" : "Start Recording"}
                  </Button>
                )}
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
                  Next Question
                </Button>
              ) : (
                <Button
                  onClick={submitExam}
                  size="lg"
                  color="green"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  leftSection={
                    !isSubmitting && <IconUpload size={16} />
                  }
                >
                  {isSubmitting ? "⏳ Submitting, please wait..." : "✓ Submit Exam"}
                </Button>
              )}
            </Group>
          </Card>
        </Container>

        {/* Submitting Modal (UPDATED) */}
        <Modal
          opened={isSubmitting}
          withCloseButton={false}
          centered
          size="sm"
          onClose={() => {}}
          closeOnClickOutside={false}
          closeOnEscape={false}
        >
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="xl" color="blue" />
              <Text size="lg" weight={600}>
                ⏳ Submitting Your Responses
              </Text>
              <Text
                size="sm"
                color="dimmed"
                ta="center"
              >
                Please wait while we process and upload your exam answers. This may
                take a few moments.
              </Text>
            </Stack>
          </Center>
        </Modal>
      </Box>
    );
  }

  // ============================================================
  // COMPLETED STAGE (UPDATED)
  // ============================================================

  if (stage === "completed") {
    // Try to close immediately on mount
    useEffect(() => {
      // Attempt to close the window
      window.close();

      // If window.close() fails (blocked by browser), show manual close button
      const fallbackTimer = setTimeout(() => {
        setShowManualClose(true);
      }, 2000);

      return () => clearTimeout(fallbackTimer);
    }, []);

    return (
      <Container size="md" py="xl">
        <Center style={{ minHeight: "60vh" }}>
          <Stack align="center" gap="xl">
            <IconCircleCheck size={80} color="#51cf66" />

            <Stack align="center" gap="sm">
              <Title order={2} c="green">
                ✅ Exam Submitted Successfully!
              </Title>
              <Text size="lg" color="dimmed" ta="center">
                Thank you, <strong>{candidateName}</strong>!
              </Text>
              <Text size="md" color="dimmed" ta="center">
                Your responses have been recorded and are being evaluated.
              </Text>
            </Stack>

            <Divider style={{ width: "100%" }} />

            {!showManualClose ? (
              <Group>
                <Loader size="sm" />
                <Text
                  size="sm"
                  color="dimmed"
                  style={{ fontStyle: "italic" }}
                >
                  Closing window automatically...
                </Text>
              </Group>
            ) : (
              <Alert
                color="blue"
                icon={<IconAlertCircle size={16} />}
                style={{ textAlign: "center", width: "100%" }}
              >
                <Text size="sm" mb="md">
                  You can now safely close this window
                </Text>
                <Button
                  onClick={() => window.close()}
                  size="lg"
                  fullWidth
                >
                  Close Window
                </Button>
              </Alert>
            )}
          </Stack>
        </Center>
      </Container>
    );
  }

  return null;
};

// ============================================================
// HELPER COMPONENT FOR REQUIREMENTS
// ============================================================

const RequirementItem = ({ icon, title, description }) => (
  <Group gap="md" align="flex-start">
    <Box
      style={{
        background: "rgba(255, 255, 255, 0.15)",
        borderRadius: 8,
        padding: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: 44,
        height: 44,
        border: "1px solid rgba(255, 255, 255, 0.3)",
      }}
    >
      {icon}
    </Box>
    <Stack gap="2px" style={{ flex: 1 }}>
      <Text fw={600} size="sm" c="white">
        {title}
      </Text>
      <Text size="xs" c="rgba(255, 255, 255, 0.75)">
        {description}
      </Text>
    </Stack>
  </Group>
);

export default HRVideoExamLogin;