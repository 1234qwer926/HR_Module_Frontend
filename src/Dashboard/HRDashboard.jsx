import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Grid, Card, Text, Badge, Button, Stack,
  Group, RingProgress, Table, Loader, SimpleGrid
} from '@mantine/core';
import { IconBriefcase, IconUsers, IconChartBar, IconPlus } from '@tabler/icons-react';
import api from '../utils/api';

export default function HRDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/hr/dashboard');
      setDashboard(data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setError(error.response?.data?.detail || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group position="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Paper p="xl" withBorder style={{ borderColor: '#e74c3c' }}>
          <Stack align="center" spacing="md">
            <Text size="xl" weight={600} color="red">
              ⚠️ Error Loading Dashboard
            </Text>
            <Text size="sm" color="dimmed">
              {error}
            </Text>
            <Button onClick={fetchDashboard} variant="outline">
              Retry
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack spacing="xl">
        <Group position="apart">
          <Title order={2}>HR Dashboard</Title>
          <Button
            leftIcon={<IconPlus size={16} />}
            onClick={() => navigate('/jobs/create')}
          >
            Post New Job
          </Button>
        </Group>

        {/* Stats Cards */}
        <SimpleGrid cols={4} breakpoints={[{ maxWidth: 'sm', cols: 2 }]}>
          <Paper p="md" withBorder>
            <Group position="apart">
              <div>
                <Text size="xs" color="dimmed" transform="uppercase" weight={700}>
                  Total Jobs
                </Text>
                <Text size="xl" weight={700} mt="xs">
                  {dashboard?.total_jobs || 0}
                </Text>
              </div>
              <IconBriefcase size={32} color="#228be6" />
            </Group>
          </Paper>

          <Paper p="md" withBorder>
            <Group position="apart">
              <div>
                <Text size="xs" color="dimmed" transform="uppercase" weight={700}>
                  Open Positions
                </Text>
                <Text size="xl" weight={700} mt="xs">
                  {dashboard?.open_jobs || 0}
                </Text>
              </div>
              <Badge size="lg" color="green" variant="filled">
                {dashboard?.open_jobs || 0}
              </Badge>
            </Group>
          </Paper>

          <Paper p="md" withBorder>
            <Group position="apart">
              <div>
                <Text size="xs" color="dimmed" transform="uppercase" weight={700}>
                  Total Applications
                </Text>
                <Text size="xl" weight={700} mt="xs">
                  {dashboard?.total_applications || 0}
                </Text>
              </div>
              <IconUsers size={32} color="#ae3ec9" />
            </Group>
          </Paper>

          <Paper p="md" withBorder>
            <Group position="apart">
              <div>
                <Text size="xs" color="dimmed" transform="uppercase" weight={700}>
                  Applications Today
                </Text>
                <Text size="xl" weight={700} mt="xs">
                  {dashboard?.applications_today || 0}
                </Text>
              </div>
              <Badge size="lg" color="cyan" variant="filled">
                New
              </Badge>
            </Group>
          </Paper>
        </SimpleGrid>

        {/* Score Metrics */}
        <Grid>
          <Grid.Col span={6}>
            <Paper p="xl" withBorder>
              <Stack align="center" spacing="md">
                <Text weight={500} size="lg">Average Resume Score</Text>
                <RingProgress
                  size={180}
                  thickness={16}
                  sections={[
                    { value: dashboard?.avg_resume_score || 0, color: 'blue' }
                  ]}
                  label={
                    <Text size="xl" weight={700} align="center">
                      {dashboard?.avg_resume_score?.toFixed(1) || 0}%
                    </Text>
                  }
                />
                <Text size="sm" color="dimmed">
                  Based on {dashboard?.total_applications || 0} applications
                </Text>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={6}>
            <Paper p="xl" withBorder>
              <Stack align="center" spacing="md">
                <Text weight={500} size="lg">Average CAT Score (θ)</Text>
                <RingProgress
                  size={180}
                  thickness={16}
                  sections={[
                    {
                      value: Math.min(100, ((dashboard?.avg_cat_theta + 3) / 6) * 100),
                      color: 'green'
                    }
                  ]}
                  label={
                    <Text size="xl" weight={700} align="center">
                      {dashboard?.avg_cat_theta?.toFixed(2) || '0.00'}
                    </Text>
                  }
                />
                <Text size="sm" color="dimmed">
                  Theta scale: -3.0 to +3.0
                </Text>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* Applications by Stage */}
        <Paper p="xl" withBorder>
          <Title order={4} mb="md">Applications by Stage</Title>
          <Table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {dashboard?.stages && Object.entries(dashboard.stages).map(([stage, count]) => (
                <tr key={stage}>
                  <td>
                    <Badge style={{ textTransform: 'capitalize' }} variant="filled">
                      {stage.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td>
                    <Text weight={600}>{count}</Text>
                  </td>
                  <td>
                    <Text size="sm" color="dimmed">
                      {dashboard.total_applications > 0
                        ? ((count / dashboard.total_applications) * 100).toFixed(1)
                        : 0}%
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Paper>

        {/* Top Keywords */}
        {dashboard?.top_keywords && dashboard.top_keywords.length > 0 && (
          <Paper p="xl" withBorder>
            <Title order={4} mb="md">Top Keywords in Applications</Title>
            <Group spacing="xs">
              {dashboard.top_keywords.map((keyword, index) => (
                <Badge key={index} size="lg" variant="outline">
                  {keyword}
                </Badge>
              ))}
            </Group>
          </Paper>
        )}

        {/* Quick Actions */}
        <Paper p="xl" withBorder>
          <Title order={4} mb="md">Quick Actions</Title>
          <Group>
            <Button
              variant="light"
              onClick={() => navigate('/applications')}
            >
              View All Applications
            </Button>
            <Button
              variant="light"
              onClick={() => navigate('/hr-video-exam/questions-management')}
            >
              Manage Video Questions
            </Button>
            <Button
              variant="light"
              onClick={() => navigate('/jobs')}
            >
              View All Jobs
            </Button>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
}
