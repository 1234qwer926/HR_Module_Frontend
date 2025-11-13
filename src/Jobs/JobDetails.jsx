// src/pages/JobDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Badge, Button, Stack, Group,
  Divider, Loader, Alert, Grid, Accordion, Modal, MultiSelect,
  Table, ActionIcon
} from '@mantine/core';
import {
  IconBriefcase, IconMapPin, IconClock, IconAlertCircle,
  IconCircleCheck, IconUsers, IconCurrencyDollar, IconTrash,
  IconPencil, IconListCheck, IconVideo, IconPlus, IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

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

  // Video questions state
  const [videoQuestionsModalOpen, setVideoQuestionsModalOpen] = useState(false);
  const [allVideoQuestions, setAllVideoQuestions] = useState([]);
  const [assignedVideoQuestions, setAssignedVideoQuestions] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [loadingVideoQuestions, setLoadingVideoQuestions] = useState(false);
  const [assigningQuestions, setAssigningQuestions] = useState(false);

  useEffect(() => {
    fetchJobDetails();
    if (userRole === 'hr') {
      fetchAssignedVideoQuestions();
    }
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

  // Assigned questions for a job
  const fetchAssignedVideoQuestions = async () => {
    try {
      const response = await fetch(`http://localhost:8000/jobs/${id}/video-questions`);
      if (response.ok) {
        const data = await response.json();
        // Support both array and { video_questions: [] } shapes
        const list = Array.isArray(data) ? data : (data.video_questions || []);
        setAssignedVideoQuestions(list);
      } else {
        // Non-fatal: show notification
        notifications.show({
          title: 'Warning',
          message: 'Could not load assigned video questions',
          color: 'yellow',
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching assigned video questions:', err);
      notifications.show({
        title: 'Error',
        message: 'Network error while loading assigned video questions',
        color: 'red',
      });
    }
  };

  // All available questions
  const fetchAllVideoQuestions = async () => {
    setLoadingVideoQuestions(true);
    try {
      const response = await fetch('http://localhost:8000/video-questions?active_only=true');
      if (response.ok) {
        const data = await response.json();
        setAllVideoQuestions(data || []);
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to load video questions',
          color: 'red',
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching video questions:', err);
      notifications.show({
        title: 'Error',
        message: 'Network error while loading video questions',
        color: 'red',
      });
    } finally {
      setLoadingVideoQuestions(false);
    }
  };

  const handleOpenVideoQuestionsModal = async () => {
    setVideoQuestionsModalOpen(true);
    await fetchAllVideoQuestions();
    // Pre-select already assigned IDs
    const assignedIds = assignedVideoQuestions.map((q) => q.id?.toString());
    setSelectedQuestionIds(assignedIds.filter(Boolean));
  };

  const handleAssignVideoQuestions = async () => {
    if (selectedQuestionIds.length === 0) {
      notifications.show({
        title: 'Warning',
        message: 'Please select at least one video question',
        color: 'yellow',
      });
      return;
    }

    setAssigningQuestions(true);

    try {
      const currentlyAssignedIds = assignedVideoQuestions.map((q) => q.id);
      const toAdd = selectedQuestionIds
        .map((s) => parseInt(s, 10))
        .filter((qid) => !currentlyAssignedIds.includes(qid));

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < toAdd.length; i++) {
        const questionId = toAdd[i];
        try {
          const resp = await fetch('http://localhost:8000/job-video-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              job_id: parseInt(id, 10),
              video_question_id: questionId,
              display_order: (assignedVideoQuestions?.length || 0) + i,
            }),
          });

          if (resp.ok) {
            successCount += 1;
          } else {
            errorCount += 1;
          }
        } catch {
          errorCount += 1;
        }
      }

      if (successCount > 0) {
        notifications.show({
          title: 'Success',
          message: `Assigned ${successCount} video question(s)`,
          color: 'green',
        });
      }
      if (errorCount > 0) {
        notifications.show({
          title: 'Partial',
          message: `${errorCount} question(s) could not be assigned`,
          color: 'yellow',
        });
      }

      await fetchAssignedVideoQuestions();
      setVideoQuestionsModalOpen(false);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to assign video questions',
        color: 'red',
      });
    } finally {
      setAssigningQuestions(false);
    }
  };

  const handleRemoveVideoQuestion = async (questionId) => {
    if (!window.confirm('Remove this video question from this job?')) return;

    try {
      const response = await fetch(
        `http://localhost:8000/job-video-questions/${id}/${questionId}`,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }
      );

      if (response.ok) {
        notifications.show({
          title: 'Removed',
          message: 'Video question removed from job',
          color: 'green',
        });
        await fetchAssignedVideoQuestions();
      } else {
        const data = await response.json().catch(() => ({}));
        notifications.show({
          title: 'Error',
          message: data.detail || 'Failed to remove video question',
          color: 'red',
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error removing video question:', err);
      notifications.show({
        title: 'Error',
        message: 'Network error while removing video question',
        color: 'red',
      });
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

      {/* Video Questions Assignment Modal */}
      <Modal
        opened={videoQuestionsModalOpen}
        onClose={() => setVideoQuestionsModalOpen(false)}
        title="Assign Video Interview Questions"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Select the video questions that candidates should answer for this position.
          </Text>

          {loadingVideoQuestions ? (
            <Group justify="center" p="xl">
              <Loader size="md" />
            </Group>
          ) : (
            <MultiSelect
              label="Select Video Questions"
              placeholder="Choose questions from the library"
              data={(allVideoQuestions || []).map((q) => ({
                value: q.id?.toString(),
                label: `${q.question_text} (${q.duration_seconds}s)`,
              }))}
              value={selectedQuestionIds}
              onChange={setSelectedQuestionIds}
              searchable
              clearable
              maxDropdownHeight={300}
            />
          )}

          <Alert color="blue" title="Info">
            Currently assigned: {assignedVideoQuestions.length} question(s)
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setVideoQuestionsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignVideoQuestions}
              loading={assigningQuestions}
              leftSection={<IconPlus size={16} />}
            >
              Assign Selected Questions
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

          {/* HR ONLY: Assigned Video Questions Section */}
          {userRole === 'hr' && (
            <>
              <Paper p="md" withBorder radius="md">
                <Stack gap="md">
                  <Group justify="space-between">
                    <Group gap="xs">
                      <IconVideo size={20} />
                      <Text fw={600} size="lg">Video Interview Questions</Text>
                      <Badge size="sm" color="blue">
                        {assignedVideoQuestions.length} Assigned
                      </Badge>
                    </Group>
                    <Button
                      leftSection={<IconPlus size={16} />}
                      onClick={handleOpenVideoQuestionsModal}
                      size="sm"
                    >
                      Manage Questions
                    </Button>
                  </Group>

                  {assignedVideoQuestions.length > 0 ? (
                    <Table striped highlightOnHover withRowBorders={false}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 60 }}>#</Table.Th>
                          <Table.Th>Question</Table.Th>
                          <Table.Th style={{ width: 130 }}>Duration</Table.Th>
                          <Table.Th style={{ width: 90 }}>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {assignedVideoQuestions.map((q, index) => (
                          <Table.Tr key={q.id ?? `${q.video_question_id}-${index}`}>
                            <Table.Td>{index + 1}</Table.Td>
                            <Table.Td>{q.question_text}</Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="light">
                                {q.duration_seconds}s
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                onClick={() => handleRemoveVideoQuestion(q.id ?? q.video_question_id)}
                                aria-label="Remove question"
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Alert color="yellow" title="No Questions Assigned">
                      No video interview questions have been assigned to this job yet. Click “Manage Questions” to assign questions from the library.
                    </Alert>
                  )}
                </Stack>
              </Paper>
              <Divider />
            </>
          )}

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
