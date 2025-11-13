import React, { useState, useRef } from "react";
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
  Tabs,
  List,
  ThemeIcon,
  SimpleGrid,
  Paper,
  Center,
  Checkbox,
  Modal,
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
} from "@tabler/icons-react";

const API_BASE_URL = "http://127.0.0.1:8000";

const HRVideoExamComponent = () => {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================

  const [stage, setStage] = useState("login"); // login, instructions, exam, submission, success
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

  // Video Recording
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingIntervalRef = useRef(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");

  // Transcription & Responses
  const [userAnswerText, setUserAnswerText] = useState("");
  const [responses, setResponses] = useState([]);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

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
      setResponses([]);
      setUserAnswerText("");
      setVideoBlob(null);
      setVideoPreviewUrl("");

      // Move to instructions stage
      setStage("instructions");
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        setVideoBlob(blob);
        setVideoPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      videoRef.current.srcObject = stream;
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Unable to access camera/microphone. Please check permissions.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const deleteRecording = () => {
    setVideoBlob(null);
    setVideoPreviewUrl("");
    setRecordingTime(0);
    setUserAnswerText("");
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getMaxDuration = () => {
    if (!questions[currentQuestionIndex]) return 120;
    return questions[currentQuestionIndex].duration_seconds || 120;
  };

  // ============================================================
  // RESPONSE HANDLERS
  // ============================================================

  const handleSaveResponse = () => {
    if (!videoBlob) {
      setError("Please record a video answer first");
      return;
    }

    if (!userAnswerText.trim()) {
      setError("Please add answer text/transcription");
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    const newResponse = {
      application_id: applicationId,
      job_video_question_id: currentQuestion.id,
      video_path: "pending_upload",
      duration_seconds: recordingTime,
      user_answer_text: userAnswerText,
      video_blob: videoBlob,
    };

    const updatedResponses = [...responses, newResponse];
    setResponses(updatedResponses);
    setSuccessMessage(`Question ${currentQuestionIndex + 1} saved successfully!`);

    // Move to next question or show submission
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setVideoBlob(null);
      setVideoPreviewUrl("");
      setUserAnswerText("");
      setRecordingTime(0);
    } else {
      // All questions answered - go to submission
      setStage("submission");
    }

    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleSkipQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setVideoBlob(null);
      setVideoPreviewUrl("");
      setUserAnswerText("");
      setRecordingTime(0);
    } else {
      setStage("submission");
    }
  };

  // ============================================================
  // BATCH SUBMISSION HANDLER
  // ============================================================

  const handleSubmitResponses = async () => {
    if (!agreeToTerms) {
      setError("Please agree to the terms before submitting");
      return;
    }

    if (responses.length === 0) {
      setError("No responses to submit");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Prepare batch request
      const batchData = responses.map((response) => ({
        application_id: response.application_id,
        job_video_question_id: response.job_video_question_id,
        video_path: `videos/${applicationId}/${Date.now()}_${Math.random()}.webm`,
        duration_seconds: response.duration_seconds,
        user_answer_text: response.user_answer_text,
      }));

      console.log("Submitting batch:", batchData);

      // Submit to backend
      const submitResponse = await axios.post(
        `${API_BASE_URL}/video-responses/batch`,
        batchData
      );

      console.log("Submission response:", submitResponse.data);

      setSuccessMessage("All responses submitted successfully!");
      setStage("success");
      setResponses([]);
      setCurrentQuestionIndex(0);
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        err.response?.data?.detail ||
          "Failed to submit responses. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReturnHome = () => {
    setStage("login");
    setEmail("");
    setExamKey("");
    setError("");
    setSuccessMessage("");
    setResponses([]);
    setCandidateName("");
    setJobTitle("");
    setQuestions([]);
    setCurrentQuestionIndex(0);
  };

  // ============================================================
  // RENDER: LOGIN STAGE
  // ============================================================

  const renderLogin = () => (
    <Container size="sm" py="xl">
      <Card shadow="sm" radius="md" withBorder>
        <Stack spacing="lg">
          <div>
            <Title order={2} align="center" mb="xs">
              HR Video Interview
            </Title>
            <Text align="center" color="dimmed" size="sm">
              Welcome to the interview portal
            </Text>
          </div>

          <TextInput
            label="Email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            icon={<IconVideo size={16} />}
          />

          <TextInput
            label="Exam Key"
            placeholder="Enter your exam key"
            type="password"
            value={examKey}
            onChange={(e) => setExamKey(e.target.value)}
            required
            icon={<IconAlertCircle size={16} />}
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
            <List size="sm" spacing="xs">
              <List.Item>Ensure good lighting and quiet environment</List.Item>
              <List.Item>Check camera and microphone permissions</List.Item>
              <List.Item>You will have limited time for each question</List.Item>
            </List>
          </Paper>
        </Stack>
      </Card>
    </Container>
  );

  // ============================================================
  // RENDER: INSTRUCTIONS MODAL
  // ============================================================

  const renderInstructions = () => (
    <Modal
      opened={stage === "instructions"}
      onClose={() => {}}
      title="Interview Instructions"
      size="md"
      centered
      closeButtonProps={{ hidden: true }}
    >
      <Stack spacing="md">
        <Text weight={500}>Welcome, {candidateName}!</Text>
        <Text color="dimmed">Position: {jobTitle}</Text>

        <div>
          <Text weight={500} size="sm" mb="xs">
            📋 Interview Guidelines:
          </Text>
          <List spacing="sm" size="sm">
            <List.Item icon={<IconCheck size={16} color="green" />}>
              Answer each question on camera
            </List.Item>
            <List.Item icon={<IconCheck size={16} color="green" />}>
              Each question has a time limit (shown below)
            </List.Item>
            <List.Item icon={<IconCheck size={16} color="green" />}>
              Provide text or transcription of your answer
            </List.Item>
            <List.Item icon={<IconCheck size={16} color="green" />}>
              Total {questions.length} questions to answer
            </List.Item>
            <List.Item icon={<IconCheck size={16} color="green" />}>
              Review before final submission
            </List.Item>
          </List>
        </div>

        <div>
          <Text weight={500} size="sm" mb="xs">
            ⏱️ Question Durations:
          </Text>
          {questions.map((q, idx) => (
            <Text key={idx} size="sm" color="dimmed">
              Q{idx + 1}: {q.duration_seconds || 120} seconds
            </Text>
          ))}
        </div>

        <Group justify="space-between">
          <Button
            variant="default"
            onClick={() => setStage("login")}
          >
            Back
          </Button>
          <Button
            onClick={() => setStage("exam")}
          >
            Start Interview
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  // ============================================================
  // RENDER: EXAM STAGE (RECORDING)
  // ============================================================

  const renderExam = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return null;

    const maxDuration = getMaxDuration();
    const timeExceeded = recordingTime > maxDuration;

    return (
      <Container size="md" py="xl">
        <Card shadow="sm" radius="md" withBorder>
          <Stack spacing="lg">
            {/* Header */}
            <div>
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={3}>{jobTitle}</Title>
                  <Text size="sm" color="dimmed">
                    {candidateName}
                  </Text>
                </div>
                <Badge variant="dot" size="lg">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </Badge>
              </Group>
              <Progress
                value={(currentQuestionIndex / questions.length) * 100}
                mb="md"
              />
            </div>

            {/* Question */}
            <Paper p="md" radius="md" bg="gray.0" withBorder>
              <Text weight={500} mb="xs">
                📌 Question:
              </Text>
              <Text size="md">{currentQuestion.question_text}</Text>
              <Badge mt="sm" color="blue">
                Time Limit: {maxDuration}s
              </Badge>
            </Paper>

            {/* Error/Success Messages */}
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Error"
                color="red"
                onClose={() => setError("")}
                closable
              >
                {error}
              </Alert>
            )}

            {successMessage && (
              <Alert
                icon={<IconCircleCheck size={16} />}
                title="Success"
                color="green"
                onClose={() => setSuccessMessage("")}
                closable
              >
                {successMessage}
              </Alert>
            )}

            {/* Video Recording Section */}
            <Card withBorder>
              <Stack spacing="md">
                <div>
                  <Text weight={500} mb="sm">
                    📹 Video Recording
                  </Text>

                  {!videoBlob ? (
                    <Center>
                      <div
                        style={{
                          width: "100%",
                          backgroundColor: "#000",
                          borderRadius: "8px",
                          overflow: "hidden",
                        }}
                      >
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          style={{
                            width: "100%",
                            height: "300px",
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    </Center>
                  ) : (
                    <Center>
                      <div
                        style={{
                          width: "100%",
                          backgroundColor: "#000",
                          borderRadius: "8px",
                          overflow: "hidden",
                        }}
                      >
                        <video
                          src={videoPreviewUrl}
                          controls
                          style={{
                            width: "100%",
                            height: "300px",
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    </Center>
                  )}
                </div>

                {/* Recording Timer */}
                <Group justify="center">
                  <div>
                    <Text
                      size="sm"
                      color={timeExceeded ? "red" : "blue"}
                      weight={500}
                    >
                      {formatTime(recordingTime)}
                    </Text>
                    {timeExceeded && (
                      <Text size="xs" color="red">
                        Time exceeded!
                      </Text>
                    )}
                  </div>
                </Group>

                {/* Recording Controls */}
                <Group justify="center" grow>
                  {!isRecording ? (
                    <>
                      <Button
                        onClick={startRecording}
                        color="red"
                        leftIcon={<IconPlayerPlay size={16} />}
                        fullWidth
                      >
                        Start Recording
                      </Button>
                      {videoBlob && (
                        <Button
                          onClick={deleteRecording}
                          color="orange"
                          variant="light"
                          leftIcon={<IconTrash size={16} />}
                          fullWidth
                        >
                          Delete
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      color="orange"
                      leftIcon={<IconPlayerStop size={16} />}
                      fullWidth
                    >
                      Stop Recording ({formatTime(recordingTime)})
                    </Button>
                  )}
                </Group>
              </Stack>
            </Card>

            {/* Transcription/Answer Text */}
            <Card withBorder>
              <Stack spacing="sm">
                <Text weight={500}>💬 Your Answer (Text/Transcription)</Text>
                <textarea
                  placeholder="Provide transcription or summary of your answer..."
                  value={userAnswerText}
                  onChange={(e) => setUserAnswerText(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "120px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #ced4da",
                    fontFamily: "monospace",
                    fontSize: "14px",
                  }}
                />
                <Text size="xs" color="dimmed">
                  {userAnswerText.length} characters
                </Text>
              </Stack>
            </Card>

            {/* Action Buttons */}
            <Group justify="flex-end" grow>
              <Button
                variant="default"
                onClick={handleSkipQuestion}
                fullWidth
              >
                Skip Question
              </Button>
              <Button
                onClick={handleSaveResponse}
                disabled={!videoBlob || !userAnswerText.trim()}
                fullWidth
              >
                {currentQuestionIndex === questions.length - 1
                  ? "Submit This Question"
                  : "Next Question"}
              </Button>
            </Group>

            {/* Answered Questions Summary */}
            {responses.length > 0 && (
              <Paper p="md" radius="md" bg="green.0" withBorder>
                <Text weight={500} size="sm" mb="xs">
                  ✓ Answered: {responses.length} question
                  {responses.length !== 1 ? "s" : ""}
                </Text>
                <Group spacing="xs">
                  {responses.map((_, idx) => (
                    <Badge key={idx} size="sm">
                      Q{idx + 1}
                    </Badge>
                  ))}
                </Group>
              </Paper>
            )}
          </Stack>
        </Card>
      </Container>
    );
  };

  // ============================================================
  // RENDER: SUBMISSION STAGE
  // ============================================================

  const renderSubmission = () => (
    <Container size="sm" py="xl">
      <Card shadow="sm" radius="md" withBorder>
        <Stack spacing="lg">
          <div>
            <Title order={3} align="center" mb="xs">
              Review & Submit
            </Title>
            <Text align="center" color="dimmed" size="sm">
              Please review your answers before submission
            </Text>
          </div>

          {/* Summary */}
          <Paper p="md" radius="md" bg="blue.0">
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="sm" weight={500}>
                  Candidate
                </Text>
                <Text size="sm">{candidateName}</Text>
              </div>
              <div>
                <Text size="sm" weight={500}>
                  Position
                </Text>
                <Text size="sm">{jobTitle}</Text>
              </div>
              <div>
                <Text size="sm" weight={500}>
                  Total Questions
                </Text>
                <Text size="sm">{questions.length}</Text>
              </div>
              <div>
                <Text size="sm" weight={500}>
                  Answered
                </Text>
                <Text size="sm" color="green">
                  {responses.length}
                </Text>
              </div>
            </SimpleGrid>
          </Paper>

          {/* Responses Review */}
          <div>
            <Text weight={500} mb="sm">
              Your Responses:
            </Text>
            <Stack spacing="sm">
              {responses.map((response, idx) => (
                <Paper key={idx} p="md" radius="md" withBorder bg="gray.0">
                  <Group justify="space-between" mb="xs">
                    <Text weight={500} size="sm">
                      Question {idx + 1}
                    </Text>
                    <Badge color="green">Answered</Badge>
                  </Group>
                  <Text size="sm" color="dimmed" mb="xs">
                    Duration: {response.duration_seconds}s | Answer length:{" "}
                    {response.user_answer_text.length} chars
                  </Text>
                  <Text size="sm" color="dimmed">
                    <strong>Answer:</strong> {response.user_answer_text}
                  </Text>
                </Paper>
              ))}
            </Stack>
          </div>

          {/* Terms Checkbox */}
          <Checkbox
            label="I confirm that all my answers are authentic and recorded by me"
            checked={agreeToTerms}
            onChange={(e) => setAgreeToTerms(e.currentTarget.checked)}
            color="blue"
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

          {/* Submit Button */}
          <Group justify="space-between">
            <Button
              variant="default"
              onClick={() => setStage("exam")}
              disabled={loading}
            >
              Back to Exam
            </Button>
            <Button
              onClick={handleSubmitResponses}
              disabled={!agreeToTerms || loading}
              loading={loading}
            >
              Submit All Responses
            </Button>
          </Group>
        </Stack>
      </Card>
    </Container>
  );

  // ============================================================
  // RENDER: SUCCESS STAGE
  // ============================================================

  const renderSuccess = () => (
    <Container size="sm" py="xl">
      <Card shadow="sm" radius="md" withBorder>
        <Stack spacing="lg" align="center">
          <ThemeIcon size={80} radius="xl" color="green" variant="light">
            <IconCircleCheck size={40} />
          </ThemeIcon>

          <div align="center">
            <Title order={2} mb="xs">
              Submission Successful!
            </Title>
            <Text color="dimmed">
              Thank you for completing the interview, {candidateName}!
            </Text>
          </div>

          <Paper p="md" radius="md" bg="green.0" fullWidth>
            <Text size="sm" weight={500} mb="xs">
              ✓ All {responses.length} video responses have been submitted
            </Text>
            <Text size="sm" color="dimmed">
              Your responses are being evaluated. You will receive feedback
              shortly.
            </Text>
          </Paper>

          <Stack spacing="sm" fullWidth>
            <Text size="sm" align="center" color="dimmed">
              What happens next?
            </Text>
            <List spacing="xs" size="sm">
              <List.Item icon={<IconCheck size={16} color="green" />}>
                AI will evaluate your video responses
              </List.Item>
              <List.Item icon={<IconCheck size={16} color="green" />}>
                HR team will review and provide feedback
              </List.Item>
              <List.Item icon={<IconCheck size={16} color="green" />}>
                You'll receive an email with results
              </List.Item>
            </List>
          </Stack>

          <Button onClick={handleReturnHome} fullWidth size="md">
            Return to Home
          </Button>
        </Stack>
      </Card>
    </Container>
  );

  // ============================================================
  // MAIN RENDER LOGIC
  // ============================================================

  return (
    <>
      {stage === "login" && renderLogin()}
      {stage === "instructions" && renderInstructions()}
      {stage === "exam" && renderExam()}
      {stage === "submission" && renderSubmission()}
      {stage === "success" && renderSuccess()}
    </>
  );
};

export default HRVideoExamComponent;
