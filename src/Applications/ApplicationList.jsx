import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container, Paper, Title, Table, Badge, Button, Group, TextInput,
  Select, Stack, Loader, Text, ActionIcon, ScrollArea, Alert, Card
} from '@mantine/core';
import { IconEye, IconSearch, IconAlertCircle, IconTrophy, IconUser } from '@tabler/icons-react';

export default function ApplicationList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('job_id');

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const userRole = localStorage.getItem('role');

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = 'http://localhost:8000/applications';

      if (jobId) {
        url = `http://localhost:8000/jobs/${jobId}/applications`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Applications:', data);
        setApplications(data);
      } else {
        setError('Failed to load applications');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage) => {
    const colors = {
      applied: 'blue',
      screening: 'cyan',
      aptitude: 'grape',
      videohr: 'indigo',
      finalinterview: 'yellow',
      offer: 'lime',
      hired: 'green',
      rejected: 'red'
    };
    return colors[stage] || 'gray';
  };

  const formatStageLabel = (stage) => {
    const labels = {
      applied: 'Applied',
      screening: 'Screening',
      aptitude: 'Aptitude',
      videohr: 'Video HR',
      finalinterview: 'Final Interview',
      offer: 'Offer',
      hired: 'Hired',
      rejected: 'Rejected'
    };
    return labels[stage] || stage;
  };

  const filteredApplications = applications.filter((app) => {
    const matchesStage = stageFilter === 'all' || app.current_stage === stageFilter;
    const matchesSearch =
      !searchTerm ||
      String(app.candidate_id || '').includes(searchTerm) ||
      String(app.id || '').includes(searchTerm) ||
      (app.full_name && app.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (app.email && app.email.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStage && matchesSearch;
  });

  // Sort by score descending
  const sortedApplications = [...filteredApplications].sort((a, b) => {
    const scoreA = a.resume_score || 0;
    const scoreB = b.resume_score || 0;
    return scoreB - scoreA;
  });

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack gap="lg">
          <Group justify="space-between">
            <div>
              <Title order={2}>Applications</Title>
              <Text size="sm" c="dimmed" mt="xs">
                {filteredApplications.length} applications found
              </Text>
            </div>
            {jobId && (
              <Button variant="subtle" onClick={() => navigate('/hr/dashboard')}>
                Back to Dashboard
              </Button>
            )}
          </Group>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
              {error}
            </Alert>
          )}

          <Group grow>
            <TextInput
              placeholder="Search by ID, Name, or Email..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Select
              placeholder="Filter by stage"
              value={stageFilter}
              onChange={setStageFilter}
              data={[
                { value: 'all', label: 'All Stages' },
                { value: 'applied', label: 'Applied' },
                { value: 'screening', label: 'Screening' },
                { value: 'aptitude', label: 'Aptitude Test' },
                { value: 'videohr', label: 'Video HR' },
                { value: 'finalinterview', label: 'Final Interview' },
                { value: 'offer', label: 'Offer' },
                { value: 'hired', label: 'Hired' },
                { value: 'rejected', label: 'Rejected' }
              ]}
              clearable
            />
          </Group>

          <ScrollArea>
            <Table highlightOnHover striped>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Candidate</th>
                  <th>Job ID</th>
                  <th>Resume Score</th>
                  <th>Skills</th>
                  <th>Experience</th>
                  <th>Stage</th>
                  <th>CAT</th>
                  <th>Applied</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedApplications.map((app, index) => (
                  <tr key={app.id}>
                    <td>
                      {index < 3 ? (
                        <Badge
                          size="lg"
                          color={index === 0 ? 'yellow' : index === 1 ? 'gray' : 'orange'}
                          variant="filled"
                          leftSection={<IconTrophy size={14} />}
                        >
                          #{index + 1}
                        </Badge>
                      ) : (
                        <Text size="sm" c="dimmed">
                          #{index + 1}
                        </Text>
                      )}
                    </td>
                    <td>
                      <Stack gap={4}>
                        <Group gap="xs">
                          <IconUser size={14} />
                          <Text fw={500} size="sm">
                            {app.full_name || `Candidate #${app.candidate_id}`}
                          </Text>
                        </Group>
                        {app.email && (
                          <Text size="xs" c="dimmed">
                            {app.email}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          ID: #{app.candidate_id}
                        </Text>
                      </Stack>
                    </td>
                    <td>
                      <Text size="sm">#{app.job_id}</Text>
                    </td>
                    <td>
                      <Badge
                        size="lg"
                        color={
                          app.resume_score >= 80
                            ? 'green'
                            : app.resume_score >= 60
                            ? 'blue'
                            : app.resume_score >= 40
                            ? 'yellow'
                            : 'red'
                        }
                        variant="light"
                      >
                        {app.resume_score ? `${app.resume_score.toFixed(1)}%` : 'N/A'}
                      </Badge>
                    </td>
                    <td>
                      <Badge size="sm" color="blue" variant="dot">
                        {app.skills_match_score ? `${app.skills_match_score.toFixed(0)}%` : 'N/A'}
                      </Badge>
                    </td>
                    <td>
                      <Text size="sm">
                        {app.total_experience ? `${app.total_experience} yrs` : 'N/A'}
                      </Text>
                    </td>
                    <td>
                      <Badge color={getStageColor(app.current_stage)} variant="light">
                        {formatStageLabel(app.current_stage)}
                      </Badge>
                    </td>
                    <td>
                      {app.cat_completed ? (
                        <Stack gap={2}>
                          <Badge color="green" variant="filled" size="sm">
                            ✓ Done
                          </Badge>
                          {app.cat_theta && (
                            <Text size="xs" c="dimmed">
                              θ: {app.cat_theta.toFixed(2)}
                            </Text>
                          )}
                        </Stack>
                      ) : (
                        <Badge color="gray" variant="outline" size="sm">
                          Pending
                        </Badge>
                      )}
                    </td>
                    <td>
                      <Text size="sm">
                        {app.applied_at
                          ? new Date(app.applied_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '—'}
                      </Text>
                    </td>
                    <td>
                      <ActionIcon
                        color="blue"
                        variant="light"
                        onClick={() => navigate(`/applications/${app.id}`)}
                        title="View details"
                      >
                        <IconEye size={18} />
                      </ActionIcon>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </ScrollArea>

          {filteredApplications.length === 0 && !error && (
            <Card p="xl" withBorder>
              <Stack align="center" gap="md">
                <IconAlertCircle size={48} color="gray" />
                <div style={{ textAlign: 'center' }}>
                  <Text fw={500} size="lg">
                    No applications found
                  </Text>
                  <Text size="sm" c="dimmed" mt="xs">
                    {searchTerm || stageFilter !== 'all'
                      ? 'Try adjusting your filters or search term'
                      : 'Applications will appear here once candidates apply'}
                  </Text>
                </div>
              </Stack>
            </Card>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
