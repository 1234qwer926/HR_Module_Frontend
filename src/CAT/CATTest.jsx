import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Radio, Button, Stack, Progress,
  Group, Alert, Loader
} from '@mantine/core';
import { IconCheck, IconAlertCircle, IconClock } from '@tabler/icons-react';

export default function CATTest() {
  const { applicationId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testStarted, setTestStarted] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions] = useState(15);
  const [currentTheta, setCurrentTheta] = useState(0.0);
  const [startTime, setStartTime] = useState(null);

  const [error, setError] = useState(null);

  useEffect(() => {
    if (testStarted) {
      setStartTime(Date.now());
    }
  }, [testStarted]);

  const startTest = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://ratio-infections-singer-auction.trycloudflare.com/cat/start/${applicationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentQuestion(data.first_question);
        setTestStarted(true);
        setQuestionNumber(1);
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to start test');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!selectedAnswer) {
      alert('Please select an answer');
      return;
    }

    setSubmitting(true);
    const responseTime = (Date.now() - startTime) / 1000;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://ratio-infections-singer-auction.trycloudflare.com/cat/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          application_id: parseInt(applicationId),
          item_id: currentQuestion.id,
          selected: selectedAnswer,
          response_time: responseTime
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentTheta(data.current_theta || currentTheta);

        if (data.next_question) {
          setCurrentQuestion(data.next_question);
          setQuestionNumber(questionNumber + 1);
          setSelectedAnswer(null);
          setStartTime(Date.now());
        } else {
          setTestCompleted(true);
        }
      } else {
        setError('Failed to submit answer');
      }
    } catch (error) {
      setError('Network error');
      console.error('Error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const finishTest = () => {
    navigate(`/applications/${applicationId}`);
  };

  if (!testStarted) {
    return (
      <Container size="md" py="xl">
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack spacing="lg">
            <Title order={2}>Computer Adaptive Test (CAT)</Title>

            <Alert icon={<IconAlertCircle size={16} />} title="Instructions" color="blue">
              <Stack spacing="xs">
                <Text size="sm">• This is an adaptive test - questions adjust to your ability level</Text>
                <Text size="sm">• You will answer up to {totalQuestions} questions</Text>
                <Text size="sm">• The test will end when your ability level is accurately measured</Text>
                <Text size="sm">• Take your time and answer carefully</Text>
                <Text size="sm">• You cannot go back to previous questions</Text>
              </Stack>
            </Alert>

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
                {error}
              </Alert>
            )}

            <Button
              size="lg"
              onClick={startTest}
              loading={loading}
              fullWidth
            >
              Start Test
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (testCompleted) {
    return (
      <Container size="md" py="xl">
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack spacing="lg" align="center">
            <IconCheck size={64} color="green" />
            <Title order={2}>Test Completed!</Title>

            <Alert icon={<IconCheck size={16} />} title="Success" color="green" style={{ width: '100%' }}>
              Your responses have been recorded. The HR team will review your results.
            </Alert>

            <Text align="center">
              Estimated Ability (θ): <strong>{currentTheta.toFixed(2)}</strong>
            </Text>

            <Button onClick={finishTest} size="lg">
              View Application Status
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack spacing="lg">
          <Group position="apart">
            <Title order={3}>Question {questionNumber} of {totalQuestions}</Title>
            <Group spacing="xs">
              <IconClock size={20} />
              <Text weight={500}>θ: {currentTheta.toFixed(2)}</Text>
            </Group>
          </Group>

          <Progress
            value={(questionNumber / totalQuestions) * 100}
            size="lg"
            radius="md"
          />

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {error}
            </Alert>
          )}

          <Paper p="lg" withBorder>
            <Text size="lg" weight={500} mb="xl">
              {currentQuestion?.question}
            </Text>

            <Radio.Group
              value={selectedAnswer}
              onChange={setSelectedAnswer}
            >
              <Stack spacing="md">
                <Radio value="A" label={currentQuestion?.option_a} />
                <Radio value="B" label={currentQuestion?.option_b} />
                <Radio value="C" label={currentQuestion?.option_c} />
                <Radio value="D" label={currentQuestion?.option_d} />
              </Stack>
            </Radio.Group>
          </Paper>

          <Button
            size="lg"
            onClick={submitAnswer}
            loading={submitting}
            disabled={!selectedAnswer}
            fullWidth
          >
            Submit Answer
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
