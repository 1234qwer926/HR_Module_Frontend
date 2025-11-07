import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Badge, Button, Stack, Group,
  Divider, Select, Alert, Loader, Grid, Card, Progress, Accordion,
  Timeline, RingProgress, Center
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconUser,
  IconBriefcase,
  IconSchool,
  IconTrophy,
  IconFileText,
  IconClock,
  IconMail,
  IconPhone,
  IconBrandLinkedin,
  IconBrandGithub
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function ApplicationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const [newStage, setNewStage] = useState('');

  const userRole = localStorage.getItem('role');

  useEffect(() => {
    fetchApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchApplication = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/applications/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Application data:', data);
        setApplication(data);
        setNewStage(data.current_stage);

        if (data.job_id) {
          fetchJob(data.job_id);
        }
      } else {
        setError('Application not found');
      }
    } catch (err) {
      setError('Error loading application');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJob = async (jobId) => {
    try {
      const response = await fetch(`http://localhost:8000/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      }
    } catch (err) {
      console.error('Error fetching job:', err);
    }
  };

  const handleStageUpdate = async () => {
    setUpdating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/applications/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ current_stage: newStage })
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Application stage updated!',
          color: 'green',
          icon: <IconCheck size={16} />
        });
        fetchApplication();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to update stage');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/applications/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        notifications.show({
          title: 'Deleted',
          message: 'Application deleted successfully',
          color: 'red'
        });
        navigate(-1);
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to delete application');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error:', err);
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

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (error && !application) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
        <Button mt="md" onClick={() => navigate(-1)}>
          Back
        </Button>
      </Container>
    );
  }

  const overallScore = application.resume_score || 0;

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* HEADER CARD */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Group gap="sm" mb="xs">
                <IconUser size={24} />
                <Title order={2}>{application.full_name || `Candidate #${application.candidate_id}`}</Title>
              </Group>
              <Group gap="md" mt="sm">
                {application.email && (
                  <Group gap="xs">
                    <IconMail size={16} />
                    <Text size="sm" c="dimmed">
                      {application.email}
                    </Text>
                  </Group>
                )}
                {application.phone_number && (
                  <Group gap="xs">
                    <IconPhone size={16} />
                    <Text size="sm" c="dimmed">
                      {application.phone_number}
                    </Text>
                  </Group>
                )}
              </Group>
            </div>
            <Stack gap="xs" align="flex-end">
              <Badge size="xl" color={getStageColor(application.current_stage)} variant="filled">
                {formatStageLabel(application.current_stage)}
              </Badge>
              <Text size="xs" c="dimmed">
                Applied: {application.applied_at ? new Date(application.applied_at).toLocaleDateString() : '—'}
              </Text>
            </Stack>
          </Group>
        </Paper>

        <Grid>
          {/* LEFT COLUMN */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="lg">
              {/* OVERALL SCORE */}
              <Card shadow="sm" p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Title order={4}>Overall Match Score</Title>
                  <Badge size="lg" color={overallScore >= 70 ? 'green' : overallScore >= 50 ? 'yellow' : 'red'}>
                    {overallScore.toFixed(1)}%
                  </Badge>
                </Group>
                <Progress value={overallScore} size="xl" radius="xl" />

                <Grid mt="lg">
                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed" mb={4}>
                      Skills Match
                    </Text>
                    <Progress
                      value={application.skills_match_score || 0}
                      color="blue"
                      size="md"
                      label={`${(application.skills_match_score || 0).toFixed(0)}%`}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed" mb={4}>
                      Experience Match
                    </Text>
                    <Progress
                      value={application.experience_match_score || 0}
                      color="cyan"
                      size="md"
                      label={`${(application.experience_match_score || 0).toFixed(0)}%`}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed" mb={4}>
                      Education Match
                    </Text>
                    <Progress
                      value={application.education_match_score || 0}
                      color="grape"
                      size="md"
                      label={`${(application.education_match_score || 0).toFixed(0)}%`}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed" mb={4}>
                      Certification Match
                    </Text>
                    <Progress
                      value={application.certification_match_score || 0}
                      color="indigo"
                      size="md"
                      label={`${(application.certification_match_score || 0).toFixed(0)}%`}
                    />
                  </Grid.Col>
                </Grid>
              </Card>

              {/* JOB DETAILS */}
              {job && (
                <Card shadow="sm" p="lg" radius="md" withBorder>
                  <Group gap="xs" mb="sm">
                    <IconBriefcase size={20} />
                    <Title order={4}>Applied For</Title>
                  </Group>
                  <Stack gap="xs">
                    <Text fw={600} size="lg">
                      {job.title}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {job.department} • {job.location}
                    </Text>
                    <Group gap="xs">
                      <Badge variant="light">{job.type}</Badge>
                      {job.experience_level && <Badge variant="outline">{job.experience_level}</Badge>}
                    </Group>
                  </Stack>
                </Card>
              )}

              {/* CANDIDATE INFO ACCORDION */}
              <Card shadow="sm" p="lg" radius="md" withBorder>
                <Accordion variant="separated">
                  {/* EDUCATION */}
                  {application.highest_qualification && (
                    <Accordion.Item value="education">
                      <Accordion.Control icon={<IconSchool size={20} />}>
                        Education
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text size="sm" fw={500}>
                              Qualification:
                            </Text>
                            <Text size="sm">{application.highest_qualification}</Text>
                          </Group>
                          {application.specialization && (
                            <Group justify="space-between">
                              <Text size="sm" fw={500}>
                                Specialization:
                              </Text>
                              <Text size="sm">{application.specialization}</Text>
                            </Group>
                          )}
                          {application.university_college && (
                            <Group justify="space-between">
                              <Text size="sm" fw={500}>
                                University:
                              </Text>
                              <Text size="sm">{application.university_college}</Text>
                            </Group>
                          )}
                          {application.academic_score && (
                            <Group justify="space-between">
                              <Text size="sm" fw={500}>
                                Score:
                              </Text>
                              <Badge color="blue">{application.academic_score}</Badge>
                            </Group>
                          )}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )}

                  {/* EXPERIENCE */}
                  <Accordion.Item value="experience">
                    <Accordion.Control icon={<IconBriefcase size={20} />}>
                      Experience
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>
                            Total Experience:
                          </Text>
                          <Badge color="orange">{application.total_experience || 0} years</Badge>
                        </Group>
                        {application.current_company && (
                          <Group justify="space-between">
                            <Text size="sm" fw={500}>
                              Current Company:
                            </Text>
                            <Text size="sm">{application.current_company}</Text>
                          </Group>
                        )}
                        {application.current_role && (
                          <Group justify="space-between">
                            <Text size="sm" fw={500}>
                              Current Role:
                            </Text>
                            <Text size="sm">{application.current_role}</Text>
                          </Group>
                        )}
                        {application.key_responsibilities && (
                          <>
                            <Text size="sm" fw={500} mt="sm">
                              Key Responsibilities:
                            </Text>
                            <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                              {application.key_responsibilities}
                            </Text>
                          </>
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>

                  {/* SKILLS */}
                  {application.technical_skills && application.technical_skills.length > 0 && (
                    <Accordion.Item value="skills">
                      <Accordion.Control icon={<IconTrophy size={20} />}>
                        Skills ({application.technical_skills.length})
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Group gap="xs">
                          {application.technical_skills.map((skill, idx) => (
                            <Badge key={idx} variant="light" color="blue">
                              {skill}
                            </Badge>
                          ))}
                        </Group>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )}

                  {/* LINKS */}
                  {(application.linkedin_profile || application.portfolio_github) && (
                    <Accordion.Item value="links">
                      <Accordion.Control>Links</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          {application.linkedin_profile && (
                            <Button
                              variant="light"
                              leftSection={<IconBrandLinkedin size={18} />}
                              component="a"
                              href={application.linkedin_profile}
                              target="_blank"
                            >
                              LinkedIn Profile
                            </Button>
                          )}
                          {application.portfolio_github && (
                            <Button
                              variant="light"
                              leftSection={<IconBrandGithub size={18} />}
                              component="a"
                              href={application.portfolio_github}
                              target="_blank"
                            >
                              Portfolio / GitHub
                            </Button>
                          )}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )}
                </Accordion>
              </Card>
            </Stack>
          </Grid.Col>

          {/* RIGHT COLUMN - SIDEBAR */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="lg">
              {/* CAT SCORE */}
              <Card shadow="sm" p="lg" radius="md" withBorder>
                <Center>
                  <RingProgress
                    size={120}
                    thickness={12}
                    sections={[
                      {
                        value: application.cat_percentile || 0,
                        color: application.cat_completed ? 'green' : 'gray'
                      }
                    ]}
                    label={
                      <Center>
                        <Stack gap={0} align="center">
                          <Text size="xs" c="dimmed">
                            CAT
                          </Text>
                          {application.cat_completed ? (
                            <>
                              <Text fw={700} size="lg">
                                {application.cat_percentile?.toFixed(0)}%
                              </Text>
                              <Text size="xs" c="dimmed">
                                θ: {application.cat_theta?.toFixed(2)}
                              </Text>
                            </>
                          ) : (
                            <Text fw={500} size="sm" c="dimmed">
                              Pending
                            </Text>
                          )}
                        </Stack>
                      </Center>
                    }
                  />
                </Center>
              </Card>

              {/* RESUME */}
              {application.resume_path && (
                <Card shadow="sm" p="md" radius="md" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconFileText size={18} />
                    <Text fw={500} size="sm">
                      Resume
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {application.resume_path}
                  </Text>
                </Card>
              )}

              {/* APPLICATION TIMELINE */}
              <Card shadow="sm" p="md" radius="md" withBorder>
                <Group gap="xs" mb="md">
                  <IconClock size={18} />
                  <Text fw={500} size="sm">
                    Application Info
                  </Text>
                </Group>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Application ID:
                    </Text>
                    <Text size="xs" fw={500}>
                      #{application.id}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Candidate ID:
                    </Text>
                    <Text size="xs" fw={500}>
                      #{application.candidate_id}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Applied:
                    </Text>
                    <Text size="xs" fw={500}>
                      {application.applied_at ? new Date(application.applied_at).toLocaleString() : '—'}
                    </Text>
                  </Group>
                </Stack>
              </Card>

              {/* HR ACTIONS */}
              {userRole === 'hr' && (
                <Card shadow="sm" p="lg" radius="md" withBorder>
                  <Title order={5} mb="md">
                    HR Actions
                  </Title>
                  <Stack gap="md">
                    <Select
                      label="Update Stage"
                      value={newStage}
                      onChange={setNewStage}
                      data={[
                        { value: 'applied', label: 'Applied' },
                        { value: 'screening', label: 'Screening' },
                        { value: 'aptitude', label: 'Aptitude Test' },
                        { value: 'videohr', label: 'Video HR' },
                        { value: 'finalinterview', label: 'Final Interview' },
                        { value: 'offer', label: 'Offer' },
                        { value: 'hired', label: 'Hired' },
                        { value: 'rejected', label: 'Rejected' }
                      ]}
                    />

                    <Button
                      onClick={handleStageUpdate}
                      loading={updating}
                      disabled={newStage === application.current_stage}
                      fullWidth
                    >
                      Update Stage
                    </Button>

                    {application.cat_completed && (
                      <Button variant="light" onClick={() => navigate(`/cat/results/${id}`)} fullWidth>
                        View CAT Results
                      </Button>
                    )}

                    {application.video_hr_submitted && (
                      <Button
                        variant="light"
                        color="grape"
                        onClick={() => navigate(`/applications/${id}/video-responses`)}
                        fullWidth
                      >
                        Review Video Responses
                      </Button>
                    )}

                    <Button color="red" variant="outline" onClick={handleDelete} fullWidth>
                      Delete Application
                    </Button>
                  </Stack>
                </Card>
              )}
            </Stack>
          </Grid.Col>
        </Grid>

        {/* BACK BUTTON */}
        <Group justify="center">
          <Button variant="subtle" onClick={() => navigate(-1)}>
            Back to Applications
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
