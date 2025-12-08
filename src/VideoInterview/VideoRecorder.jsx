import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Button, Stack, Group, Progress,
  Alert, Badge, Loader
} from '@mantine/core';
import { IconVideo, IconVideoOff, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function VideoRecorder() {
  const { applicationId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [allCompleted, setAllCompleted] = useState(false);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchQuestions();
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [applicationId]);

  const fetchQuestions = async () => {
    try {
      const token = localStorage.getItem('token');

      // Get application to find job_id
      const appResponse = await fetch(`http://100.25.42.222:8000/applications/${applicationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (appResponse.ok) {
        const appData = await appResponse.json();
        const jobId = appData.job_id;
        console.log('Job ID:', jobId);

        // Get video questions for this job
        const qResponse = await fetch(`http://100.25.42.222:8000/jobs/${jobId}/video-questions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (qResponse.ok) {
          const data = await qResponse.json();
          console.log('Video questions:', data);

          // Extract video_questions array from response
          const videoQuestions = data.video_questions || [];

          if (videoQuestions.length > 0) {
            setQuestions(videoQuestions);
            setTimeLeft(videoQuestions[0].duration_seconds);
          } else {
            setError('No video questions configured for this job');
          }
        } else {
          setError('Failed to load video questions');
        }
      } else {
        setError('Application not found');
      }
    } catch (error) {
      setError('Error loading questions');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      setError('Camera access denied. Please allow camera and microphone.');
      console.error('Error:', error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    await startCamera();

    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      uploadVideo();
    };

    mediaRecorder.start();
    setRecording(true);

    // Start countdown timer
    const duration = questions[currentQuestionIndex].duration_seconds;
    setTimeLeft(duration);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      stopCamera();
    }
  };

  const uploadVideo = async () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    const formData = new FormData();
    formData.append('application_id', applicationId);
    formData.append('video_question_id', questions[currentQuestionIndex].id);
    formData.append('video', blob, `video_${currentQuestionIndex}.webm`);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://100.25.42.222:8000/video-responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Video uploaded successfully!',
          color: 'green'
        });

        // Move to next question or complete
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
          setTimeLeft(questions[currentQuestionIndex + 1].duration_seconds);
        } else {
          setAllCompleted(true);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to upload video');
      }
    } catch (error) {
      setError('Upload error');
      console.error('Error:', error);
    }
  };

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Group position="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (allCompleted) {
    return (
      <Container size="md" py="xl">
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack spacing="lg" align="center">
            <IconCheck size={64} color="green" />
            <Title order={2}>All Videos Submitted!</Title>
            <Alert icon={<IconCheck size={16} />} title="Success" color="green" style={{ width: '100%' }}>
              Your video responses have been recorded. The HR team will review them shortly.
            </Alert>
            <Button onClick={() => navigate(`/applications/${applicationId}`)} size="lg">
              View Application Status
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (questions.length === 0) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="No Questions" color="yellow">
          {error || 'No video questions are configured for this job.'}
        </Alert>
        <Button mt="md" onClick={() => navigate(`/applications/${applicationId}`)}>
          Back to Application
        </Button>
      </Container>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <Container size="md" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack spacing="lg">
          <Group position="apart">
            <Title order={3}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </Title>
            <Badge size="lg" color={recording ? 'red' : 'blue'}>
              {recording ? `Recording: ${timeLeft}s` : 'Ready'}
            </Badge>
          </Group>

          <Progress
            value={((currentQuestionIndex + 1) / questions.length) * 100}
            size="lg"
          />

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
              {error}
            </Alert>
          )}

          <Paper p="lg" withBorder>
            <Text size="lg" weight={500}>
              {currentQuestion?.question_text}
            </Text>
            <Text size="sm" color="dimmed" mt="xs">
              Maximum duration: {currentQuestion?.duration_seconds} seconds
            </Text>
          </Paper>

          <Paper p="md" withBorder style={{ backgroundColor: '#000' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              style={{ width: '100%', borderRadius: 8, maxHeight: '400px' }}
            />
          </Paper>

          <Group position="center">
            {!recording ? (
              <Button
                size="lg"
                leftIcon={<IconVideo size={20} />}
                onClick={startRecording}
                color="red"
              >
                Start Recording
              </Button>
            ) : (
              <Button
                size="lg"
                leftIcon={<IconVideoOff size={20} />}
                onClick={stopRecording}
                color="gray"
              >
                Stop Recording
              </Button>
            )}
          </Group>

          <Alert color="blue">
            <Stack spacing="xs">
              <Text size="sm">• Position yourself in good lighting</Text>
              <Text size="sm">• Speak clearly and maintain eye contact with the camera</Text>
              <Text size="sm">• You can stop the recording early or it will auto-stop after the time limit</Text>
            </Stack>
          </Alert>
        </Stack>
      </Paper>
    </Container>
  );
}
