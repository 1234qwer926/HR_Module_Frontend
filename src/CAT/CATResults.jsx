import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Badge, Button, Stack, Group,
  Table, Alert, Loader, Grid, RingProgress
} from '@mantine/core';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

export default function CATResults() {
  const { applicationId } = useParams();
  const navigate = useNavigate();

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchResults();
  }, [applicationId]);

  const fetchResults = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://ratio-infections-singer-auction.trycloudflare.com/cat/results/${applicationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
      } else {
        setError('Results not found');
      }
    } catch (error) {
      setError('Error loading results');
      console.error('Error:', error);
    } finally {
      setLoading(false);
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

  if (error) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
        <Button mt="md" onClick={() => navigate(-1)}>Back</Button>
      </Container>
    );
  }

  const getThetaColor = (theta) => {
    if (theta >= 1.5) return 'green';
    if (theta >= 0.5) return 'blue';
    if (theta >= -0.5) return 'yellow';
    return 'red';
  };

  return (
    <Container size="lg" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack spacing="lg">
          <Group position="apart">
            <Title order={2}>CAT Test Results</Title>
            <Button variant="subtle" onClick={() => navigate(-1)}>
              Back
            </Button>
          </Group>

          <Grid>
            <Grid.Col span={4}>
              <Paper p="md" withBorder>
                <Stack align="center" spacing="xs">
                  <Text size="sm" color="dimmed">Ability (θ)</Text>
                  <RingProgress
                    size={120}
                    thickness={12}
                    sections={[
                      {
                        value: Math.min(100, ((results.theta + 3) / 6) * 100),
                        color: getThetaColor(results.theta)
                      }
                    ]}
                    label={
                      <Text size="xl" weight={700} align="center">
                        {results.theta.toFixed(2)}
                      </Text>
                    }
                  />
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={4}>
              <Paper p="md" withBorder>
                <Stack align="center" spacing="xs">
                  <Text size="sm" color="dimmed">Percentile</Text>
                  <RingProgress
                    size={120}
                    thickness={12}
                    sections={[
                      { value: results.percentile, color: 'blue' }
                    ]}
                    label={
                      <Text size="xl" weight={700} align="center">
                        {results.percentile.toFixed(1)}%
                      </Text>
                    }
                  />
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={4}>
              <Paper p="md" withBorder>
                <Stack align="center" spacing="xs">
                  <Text size="sm" color="dimmed">Accuracy</Text>
                  <RingProgress
                    size={120}
                    thickness={12}
                    sections={[
                      { value: results.accuracy, color: 'green' }
                    ]}
                    label={
                      <Text size="xl" weight={700} align="center">
                        {results.accuracy.toFixed(0)}%
                      </Text>
                    }
                  />
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>

          <Group grow>
            <Paper p="md" withBorder>
              <Text size="sm" color="dimmed">Total Questions</Text>
              <Text size="xl" weight={700}>{results.total_questions}</Text>
            </Paper>
            <Paper p="md" withBorder>
              <Text size="sm" color="dimmed">Correct Answers</Text>
              <Text size="xl" weight={700} color="green">{results.correct}</Text>
            </Paper>
            <Paper p="md" withBorder>
              <Text size="sm" color="dimmed">Incorrect Answers</Text>
              <Text size="xl" weight={700} color="red">
                {results.total_questions - results.correct}
              </Text>
            </Paper>
          </Group>

          <div>
            <Title order={4} mb="md">Response Details</Title>
            <Table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Selected</th>
                  <th>Correct</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {results.responses?.map((response, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{response.question}</td>
                    <td>
                      <Badge variant="outline">{response.selected}</Badge>
                    </td>
                    <td>
                      <Badge variant="outline">{response.correct}</Badge>
                    </td>
                    <td>
                      {response.is_correct ? (
                        <Badge color="green" leftSection={<IconCheck size={14} />}>
                          Correct
                        </Badge>
                      ) : (
                        <Badge color="red" leftSection={<IconX size={14} />}>
                          Incorrect
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <Alert icon={<IconAlertCircle size={16} />} title="Interpretation" color="blue">
            <Stack spacing="xs">
              <Text size="sm">
                <strong>Theta (θ):</strong> Ability estimate on a scale from -3 to +3.
                Higher values indicate greater ability.
              </Text>
              <Text size="sm">
                <strong>Percentile:</strong> Percentage of test-takers scoring below this candidate.
              </Text>
              <Text size="sm">
                <strong>Typical ranges:</strong> θ &gt; 1.0 (Strong), 0 to 1.0 (Average), &lt; 0 (Below Average)
              </Text>
            </Stack>
          </Alert>
        </Stack>
      </Paper>
    </Container>
  );
}
