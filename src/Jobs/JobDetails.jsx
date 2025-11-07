// src/pages/JobDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Badge, Button, Stack, Group,
  Divider, Loader, Alert, Grid, Accordion, Modal
} from '@mantine/core';
import {
  IconBriefcase, IconMapPin, IconClock, IconAlertCircle,
  IconCircleCheck, IconUsers, IconCurrencyDollar, IconTrash, IconPencil, IconListCheck
} from '@tabler/icons-react';

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Public applications allowed (no role check for applying)
  const userRole = localStorage.getItem('role');
  const isLoggedIn = !!localStorage.getItem('token');

  // Delete modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchJobDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      const response = await fetch(`http://localhost:8000/jobs/${id}`);
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      } else {
        setError('Job not found');
      }
    } catch (err) {
      setError('Error loading job details');
      // eslint-disable-next-line no-console
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'green';
      case 'closed': return 'red';
      case 'draft': return 'gray';
      default: return 'blue';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'yellow';
      case 'low': return 'gray';
      default: return 'blue';
    }
  };

  const handleViewApplications = () => {
    if (!job) return;
    navigate(`/jobs/${job.id}/applications`);
  };

  const handleEditJob = () => {
    if (!job) return;
    navigate(`/jobs/edit/${job.id}`);
  };

  const handleRequestDelete = () => {
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!job) return;
    setDeleting(true);
    try {
      const res = await fetch(`http://localhost:8000/jobs/${job.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        // Navigate back to jobs with a flag so list page can show a toast/alert if desired
        navigate('/jobs', { state: { deleted: true, title: job.title } });
      } else {
        const text = await res.text();
        setError(text || 'Failed to delete job');
      }
    } catch (e) {
      setError('Network error while deleting job');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
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

  if (error || !job) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error || 'Job not found'}
        </Alert>
        <Button mt="md" onClick={() => navigate('/jobs')}>Back to Jobs</Button>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      {/* Delete confirmation modal */}
      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Confirm deletion"
        centered
      >
        <Stack gap="sm">
          <Text>
            This action will permanently delete the job “{job.title}”. Are you sure you want to continue?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button color="red" loading={deleting} onClick={handleConfirmDelete} leftSection={<IconTrash size={16} />}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack gap="lg">
          {/* HEADER */}
          <div>
            <Group justify="space-between" mb="md">
              <div style={{ flex: 1 }}>
                <Title order={2}>{job.title}</Title>
                {job.department && (
                  <Text size="lg" c="dimmed" fw={500} mt="xs">
                    {job.department}
                  </Text>
                )}
              </div>
              <Group gap="md">
                <Badge size="lg" color={getStatusColor(job.status)}>
                  {job.status?.toUpperCase()}
                </Badge>
                <Badge size="lg" color={getPriorityColor(job.priority)} variant="light">
                  {job.priority?.toUpperCase()} Priority
                </Badge>
              </Group>
            </Group>
          </div>

          {/* KEY INFO */}
          <Grid>
            <Grid.Col span={6}>
              <Group gap="xs">
                <IconMapPin size={20} />
                <Text>{job.location || 'Remote'}</Text>
              </Group>
            </Grid.Col>
            <Grid.Col span={6}>
              <Group gap="xs">
                <IconBriefcase size={20} />
                <Text style={{ textTransform: 'capitalize' }}>{job.type}</Text>
              </Group>
            </Grid.Col>
            <Grid.Col span={6}>
              <Group gap="xs">
                <IconClock size={20} />
                <Text>Posted: {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : '-'}</Text>
              </Group>
            </Grid.Col>
            <Grid.Col span={6}>
              <Group gap="xs">
                <IconUsers size={20} />
                <Text>{job.num_openings || 1} Opening(s)</Text>
              </Group>
            </Grid.Col>
          </Grid>

          <Divider />

          {/* MAIN CONTENT GRID */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="lg">
                {/* DESCRIPTION */}
                {job.description && (
                  <div>
                    <Title order={4} mb="sm">About the Role</Title>
                    <Text style={{ whiteSpace: 'pre-line' }}>{job.description}</Text>
                  </div>
                )}

                {/* RESPONSIBILITIES */}
                {job.responsibilities && (
                  <div>
                    <Title order={4} mb="sm">Key Responsibilities</Title>
                    <Text style={{ whiteSpace: 'pre-line' }}>{job.responsibilities}</Text>
                  </div>
                )}

                {/* KEY DELIVERABLES */}
                {job.key_deliverables && (
                  <div>
                    <Title order={4} mb="sm">Key Deliverables</Title>
                    <Text style={{ whiteSpace: 'pre-line' }}>{job.key_deliverables}</Text>
                  </div>
                )}

                {/* REQUIREMENTS ACCORDION */}
                <Accordion>
                  {/* REQUIRED SKILLS */}
                  {job.required_skills && job.required_skills.length > 0 && (
                    <Accordion.Item value="required_skills">
                      <Accordion.Control>
                        <Group gap="xs">
                          <IconCircleCheck size={16} color="green" />
                          <Text fw={600}>Required Skills ({job.required_skills.length})</Text>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Group gap="xs">
                          {job.required_skills.map((skill, idx) => (
                            <Badge key={idx} size="lg" variant="filled" color="blue">
                              {skill}
                            </Badge>
                          ))}
                        </Group>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )}

                  {/* PREFERRED SKILLS */}
                  {job.preferred_skills && job.preferred_skills.length > 0 && (
                    <Accordion.Item value="preferred_skills">
                      <Accordion.Control>
                        <Group gap="xs">
                          <IconCircleCheck size={16} color="cyan" />
                          <Text fw={600}>Preferred Skills ({job.preferred_skills.length})</Text>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Group gap="xs">
                          {job.preferred_skills.map((skill, idx) => (
                            <Badge key={idx} size="lg" variant="light" color="cyan">
                              {skill}
                            </Badge>
                          ))}
                        </Group>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )}

                  {/* EDUCATION REQUIREMENT */}
                  {job.education_requirement && (
                    <Accordion.Item value="education">
                      <Accordion.Control>
                        <Text fw={600}>Education Requirements</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          <Group gap="sm">
                            <Text fw={500}>Qualification:</Text>
                            <Text>{job.education_requirement}</Text>
                          </Group>
                          {job.minimum_academic_score && (
                            <Group gap="sm">
                              <Text fw={500}>Minimum Score:</Text>
                              <Text>{job.minimum_academic_score}</Text>
                            </Group>
                          )}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )}

                  {/* CERTIFICATIONS */}
                  {job.required_certifications && job.required_certifications.length > 0 && (
                    <Accordion.Item value="certifications">
                      <Accordion.Control>
                        <Text fw={600}>Certifications</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Group gap="xs">
                          {job.required_certifications.map((cert, idx) => (
                            <Badge key={idx} size="lg" variant="outline" color="grape">
                              {cert}
                            </Badge>
                          ))}
                        </Group>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )}

                  {/* TOOLS & TECHNOLOGIES */}
                  {job.tools_technologies && job.tools_technologies.length > 0 && (
                    <Accordion.Item value="tools">
                      <Accordion.Control>
                        <Text fw={600}>Tools & Technologies</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Group gap="xs">
                          {job.tools_technologies.map((tool, idx) => (
                            <Badge key={idx} size="md" variant="outline" color="indigo">
                              {tool}
                            </Badge>
                          ))}
                        </Group>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )}

                  {/* KEYWORDS */}
                  {job.keywords && job.keywords.length > 0 && (
                    <Accordion.Item value="keywords">
                      <Accordion.Control>
                        <Text fw={600}>Keywords</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Group gap="xs">
                          {job.keywords.map((keyword, idx) => (
                            <Badge key={idx} size="sm" variant="outline">
                              {keyword}
                            </Badge>
                          ))}
                        </Group>
                      </Accordion.Panel>
                    </Accordion.Item>
                  )}
                </Accordion>

                {/* EXPERIENCE LEVEL */}
                {job.experience_level && (
                  <div>
                    <Title order={4} mb="sm">Experience Level</Title>
                    <Badge size="lg" color="orange" variant="light">
                      {job.experience_level}
                    </Badge>
                  </div>
                )}

                {/* REPORTING TO */}
                {job.reporting_to && (
                  <Group gap="sm">
                    <Text fw={500}>Reporting To:</Text>
                    <Text>{job.reporting_to}</Text>
                  </Group>
                )}
              </Stack>
            </Grid.Col>

            {/* SIDEBAR */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="lg">
                {/* COMPENSATION */}
                {job.salary_range_text && (
                  <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb="sm">
                      <IconCurrencyDollar size={20} />
                      <Text fw={600}>Compensation</Text>
                    </Group>
                    <Text size="lg" fw={500}>{job.salary_range_text}</Text>
                  </Paper>
                )}

                {/* BENEFITS */}
                {job.benefits && (
                  <Paper p="md" radius="md" withBorder>
                    <Title order={4} mb="sm">Benefits</Title>
                    <Text style={{ whiteSpace: 'pre-line' }} size="sm">{job.benefits}</Text>
                  </Paper>
                )}

                {/* JOB CODE */}
                {job.job_code && (
                  <Paper p="md" radius="md" withBorder>
                    <Text c="dimmed" size="sm">Job Code</Text>
                    <Text fw={600}>{job.job_code}</Text>
                  </Paper>
                )}

                {/* HIRING MANAGER */}
                {job.hiring_manager && (
                  <Paper p="md" radius="md" withBorder>
                    <Text c="dimmed" size="sm">Hiring Manager</Text>
                    <Text fw={600}>{job.hiring_manager}</Text>
                  </Paper>
                )}

                {/* APPLICATION INFO */}
                <Paper p="md" radius="md" withBorder>
                  <Stack gap="xs">
                    <Group gap="sm">
                      <Text c="dimmed" size="sm">Posted:</Text>
                      <Text size="sm">{job.posted_at ? new Date(job.posted_at).toLocaleDateString() : '-'}</Text>
                    </Group>
                    {job.application_deadline && (
                      <Group gap="sm">
                        <Text c="dimmed" size="sm">Deadline:</Text>
                        <Text size="sm">{new Date(job.application_deadline).toLocaleDateString()}</Text>
                      </Group>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>

          <Divider />

          {/* ACTION BUTTONS */}
          <Group justify="space-between" wrap="wrap">
            <Button variant="subtle" onClick={() => navigate('/jobs')}>
              Back to Jobs
            </Button>

            {userRole === 'hr' && (
              <Group>
                <Button
                  variant="light"
                  onClick={handleEditJob}
                  leftSection={<IconPencil size={16} />}
                >
                  Edit Job
                </Button>

                <Button
                  variant="light"
                  onClick={handleViewApplications}
                  leftSection={<IconListCheck size={16} />}
                >
                  View Applications
                </Button>

                <Button
                  color="red"
                  variant="outline"
                  onClick={handleRequestDelete}
                  leftSection={<IconTrash size={16} />}
                >
                  Delete Job
                </Button>
              </Group>
            )}

            {/* Public applications - anyone can apply (no login required) */}
            {job.status === 'open' && (
              <Button
                size="lg"
                onClick={() => navigate(`/apply/${job.id}`)}
                color="green"
              >
                Apply Now
              </Button>
            )}

            {job.status === 'closed' && (
              <Button
                size="lg"
                disabled
                color="gray"
              >
                Applications Closed
              </Button>
            )}
          </Group>

          {/* INFO MESSAGE FOR PUBLIC APPLICATIONS */}
          <Alert color="blue" title="Public Application">
            This is an open position. You can apply without creating an account.
            Just fill in your details on the application form.
          </Alert>
        </Stack>
      </Paper>
    </Container>
  );
}
