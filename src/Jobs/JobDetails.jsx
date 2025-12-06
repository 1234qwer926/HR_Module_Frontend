import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Badge, Button, Stack, Group,
  Divider, Loader, Alert, Grid, Accordion, Modal, MultiSelect,
  Table, ActionIcon, Tooltip, Dialog
} from '@mantine/core';
import {
  IconBriefcase, IconMapPin, IconClock, IconAlertCircle,
  IconCircleCheck, IconUsers, IconCurrencyDollar, IconTrash,
  IconPencil, IconListCheck, IconVideo, IconPlus, IconX, IconReload
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';


export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userRole = localStorage.getItem('role');

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

  // Remove confirmation dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removingMappingId, setRemovingMappingId] = useState(null);
  const [removingQuestion, setRemovingQuestion] = useState(false);


  useEffect(() => {
    fetchJobDetails();
    if (userRole === 'hr') {
      fetchAssignedVideoQuestions();
    }
  }, [id, userRole]);


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
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // FETCH ASSIGNED VIDEO QUESTIONS
  // ============================================================
  const fetchAssignedVideoQuestions = async () => {
    try {
      console.log('📥 Fetching assigned questions for job:', id);
      const response = await fetch(`http://localhost:8000/jobs/${id}/video-questions`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📦 Backend response:', data);
        
        const questions = Array.isArray(data) ? data : [];
        const sorted = questions.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        
        setAssignedVideoQuestions(sorted);
        console.log('✅ Loaded', sorted.length, 'assigned questions');
      } else {
        console.error('❌ Failed to load assigned questions');
      }
    } catch (err) {
      console.error('❌ Error fetching assigned video questions:', err);
    }
  };


  // ============================================================
  // FETCH ALL AVAILABLE VIDEO QUESTIONS (FILTERED)
  // ============================================================
  const fetchAllVideoQuestions = async () => {
    setLoadingVideoQuestions(true);
    try {
      console.log('📥 Fetching all available video questions...');
      const response = await fetch('http://localhost:8000/video-questions?active_only=true');
      
      if (response.ok) {
        const data = await response.json();
        const assignedVideoQuestionIds = assignedVideoQuestions.map(q => q.video_question_id);
        
        console.log('🔗 Already assigned video_question_ids:', assignedVideoQuestionIds);
        
        const availableQuestions = (data || []).filter(
          q => !assignedVideoQuestionIds.includes(q.id)
        );
        
        console.log('✅ Available (unassigned) questions:', availableQuestions.length);
        setAllVideoQuestions(availableQuestions);
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to load video questions library',
          color: 'red',
        });
      }
    } catch (err) {
      console.error('❌ Error fetching video questions:', err);
      notifications.show({
        title: 'Error',
        message: 'Network error while loading video questions',
        color: 'red',
      });
    } finally {
      setLoadingVideoQuestions(false);
    }
  };


  // ============================================================
  // OPEN VIDEO QUESTIONS MODAL
  // ============================================================
  const handleOpenVideoQuestionsModal = async () => {
    console.log('🔓 Opening video questions modal...');
    setVideoQuestionsModalOpen(true);
    await fetchAllVideoQuestions();
    setSelectedQuestionIds([]);
  };


  // ============================================================
  // ASSIGN VIDEO QUESTIONS TO JOB
  // ============================================================
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
      console.log('📝 Adding Questions:', selectedQuestionIds);
      
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < selectedQuestionIds.length; i++) {
        const questionId = parseInt(selectedQuestionIds[i], 10);
        const displayOrder = assignedVideoQuestions.length + i;
        
        console.log(`➕ Adding Question ID ${questionId} with order ${displayOrder}`);
        
        try {
          const resp = await fetch('http://localhost:8000/job-video-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              job_id: parseInt(id, 10),
              video_question_id: questionId,
              display_order: displayOrder,
            }),
          });

          if (resp.ok) {
            const result = await resp.json();
            console.log(`✅ Added successfully. Mapping ID: ${result.id}`);
            successCount += 1;
          } else {
            const errData = await resp.json().catch(() => ({}));
            console.error(`❌ Failed to add question ${questionId}:`, errData);
            errorCount += 1;
          }
        } catch (err) {
          console.error(`❌ Error adding question ${questionId}:`, err);
          errorCount += 1;
        }
      }

      if (successCount > 0) {
        notifications.show({
          title: 'Success',
          message: `Added ${successCount} question(s) successfully`,
          color: 'green',
        });
      }
      if (errorCount > 0) {
        notifications.show({
          title: 'Warning',
          message: `${errorCount} operation(s) failed`,
          color: 'yellow',
        });
      }

      await fetchAssignedVideoQuestions();
      setVideoQuestionsModalOpen(false);
      setSelectedQuestionIds([]);
    } catch (err) {
      console.error('❌ Error assigning questions:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to assign video questions',
        color: 'red',
      });
    } finally {
      setAssigningQuestions(false);
    }
  };


  // ============================================================
  // REMOVE SINGLE VIDEO QUESTION
  // ============================================================
  const handleRemoveVideoQuestion = (mappingId, questionText) => {
    console.log('🗑️ Requesting removal of mapping ID:', mappingId);
    setRemovingMappingId(mappingId);
    setRemoveDialogOpen(true);
  };


  const handleConfirmRemoveQuestion = async () => {
    if (!removingMappingId) {
      console.error('❌ No mapping ID set for removal');
      return;
    }

    setRemovingQuestion(true);

    try {
      console.log('🗑️ Deleting JobVideoQuestion mapping ID:', removingMappingId);
      
      const response = await fetch(
        `http://localhost:8000/job-video-questions/${removingMappingId}`,
        { 
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      console.log('📡 Delete Response Status:', response.status);

      if (response.ok) {
        console.log('✅ Successfully removed mapping');
        notifications.show({
          title: 'Removed',
          message: 'Video question removed from job successfully',
          color: 'green',
        });
        await fetchAssignedVideoQuestions();
      } else {
        const errorText = await response.text();
        console.error('❌ Delete failed:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText };
        }
        
        notifications.show({
          title: 'Error',
          message: errorData.detail || 'Failed to remove video question',
          color: 'red',
        });
      }
    } catch (err) {
      console.error('❌ Network error removing video question:', err);
      notifications.show({
        title: 'Error',
        message: 'Network error while removing video question',
        color: 'red',
      });
    } finally {
      setRemovingQuestion(false);
      setRemoveDialogOpen(false);
      setRemovingMappingId(null);
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
      {/* Delete Job Confirmation Modal */}
      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Confirm deletion"
        centered
      >
        <Stack gap="sm">
          <Text>
            This action will permanently delete the job "{job.title}". Are you sure?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button color="red" loading={deleting} onClick={handleConfirmDelete}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>


      {/* Remove Video Question Confirmation Dialog */}
      <Dialog
        opened={removeDialogOpen}
        withCloseButton
        onClose={() => {
          setRemoveDialogOpen(false);
          setRemovingMappingId(null);
        }}
        size="lg"
        radius="md"
      >
        <Stack gap="md">
          <Text size="lg" fw={500}>Confirm Removal</Text>
          <Text>
            Are you sure you want to remove this video question from this job? 
            This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button 
              variant="default" 
              onClick={() => {
                setRemoveDialogOpen(false);
                setRemovingMappingId(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              color="red" 
              loading={removingQuestion} 
              onClick={handleConfirmRemoveQuestion}
              leftSection={<IconX size={16} />}
            >
              Remove Question
            </Button>
          </Group>
        </Stack>
      </Dialog>


      {/* Video Questions Assignment Modal */}
      <Modal
        opened={videoQuestionsModalOpen}
        onClose={() => setVideoQuestionsModalOpen(false)}
        title="Add Video Interview Questions"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Alert color="blue" icon={<IconAlertCircle size={16} />}>
            Only showing questions that are <strong>not yet assigned</strong> to this job.
            Currently assigned: <strong>{assignedVideoQuestions.length}</strong> question(s)
          </Alert>

          {loadingVideoQuestions ? (
            <Group justify="center" p="xl">
              <Loader size="md" />
            </Group>
          ) : allVideoQuestions.length === 0 ? (
            <Alert color="yellow" title="No Available Questions">
              {assignedVideoQuestions.length > 0 
                ? 'All available questions are already assigned to this job.'
                : 'No video interview questions found. Please create some questions first.'
              }
            </Alert>
          ) : (
            <>
              <MultiSelect
                label="Select Questions to Add"
                placeholder="Choose questions from available library"
                data={allVideoQuestions.map((q) => ({
                  value: q.id?.toString(),
                  label: `${q.question_text} (${q.duration_seconds}s)`,
                }))}
                value={selectedQuestionIds}
                onChange={setSelectedQuestionIds}
                searchable
                clearable
                maxDropdownHeight={300}
              />
              
              <Text size="sm" c="dimmed">
                Selected: <strong>{selectedQuestionIds.length}</strong> question(s) to add
              </Text>
            </>
          )}

          <Group justify="flex-end" mt="md">
            <Button 
              variant="default" 
              onClick={() => {
                setVideoQuestionsModalOpen(false);
                setSelectedQuestionIds([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignVideoQuestions}
              loading={assigningQuestions}
              leftSection={<IconPlus size={16} />}
              disabled={selectedQuestionIds.length === 0}
            >
              Add Selected Questions
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
                    Department: {job.department}
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

          {/* KEY INFO GRID */}
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
            {job.experience_level && (
              <Grid.Col span={6}>
                <Group gap="xs">
                  <Text fw={500}>Experience Level:</Text>
                  <Badge color="orange">{job.experience_level}</Badge>
                </Group>
              </Grid.Col>
            )}
            {job.reporting_to && (
              <Grid.Col span={6}>
                <Group gap="xs">
                  <Text fw={500}>Reports To:</Text>
                  <Text>{job.reporting_to}</Text>
                </Group>
              </Grid.Col>
            )}
          </Grid>

          <Divider />

          {/* HR ONLY: VIDEO QUESTIONS SECTION */}
          {userRole === 'hr' && (
            <>
              <Paper p="md" withBorder radius="md" style={{ backgroundColor: '#f0f9ff' }}>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Group gap="xs">
                      <IconVideo size={20} color="#0066cc" />
                      <Text fw={600} size="lg">Video Interview Questions</Text>
                      <Badge size="sm" color="blue">
                        {assignedVideoQuestions.length} Assigned
                      </Badge>
                    </Group>
                    <Group>
                      <Tooltip label="Refresh questions">
                        <ActionIcon 
                          variant="light" 
                          onClick={fetchAssignedVideoQuestions}
                        >
                          <IconReload size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={handleOpenVideoQuestionsModal}
                        size="sm"
                      >
                        Add Questions
                      </Button>
                    </Group>
                  </Group>

                  {assignedVideoQuestions.length > 0 ? (
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 60 }}>Order</Table.Th>
                          <Table.Th>Question</Table.Th>
                          <Table.Th style={{ width: 100 }}>Duration</Table.Th>
                          <Table.Th style={{ width: 80 }}>Remove</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {assignedVideoQuestions.map((q, index) => (
                          <Table.Tr key={q.id}>
                            <Table.Td>
                              <Badge size="sm" variant="filled" color="gray">
                                {index + 1}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{q.question_text}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="light" color="cyan">
                                {q.duration_seconds}s
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label="Remove from job">
                                <ActionIcon
                                  color="red"
                                  variant="subtle"
                                  onClick={() => handleRemoveVideoQuestion(q.id, q.question_text)}
                                >
                                  <IconX size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Alert color="yellow" title="No Questions Assigned">
                      No video questions assigned yet. Click "Add Questions" to assign some.
                    </Alert>
                  )}
                </Stack>
              </Paper>
              <Divider />
            </>
          )}

          {/* MAIN CONTENT - LEFT SIDE */}
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

                  {job.required_certifications && job.required_certifications.length > 0 && (
                    <Accordion.Item value="certifications">
                      <Accordion.Control>
                        <Text fw={600}>Required Certifications ({job.required_certifications.length})</Text>
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

                  {job.tools_technologies && job.tools_technologies.length > 0 && (
                    <Accordion.Item value="tools">
                      <Accordion.Control>
                        <Text fw={600}>Tools & Technologies ({job.tools_technologies.length})</Text>
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

                  {job.keywords && job.keywords.length > 0 && (
                    <Accordion.Item value="keywords">
                      <Accordion.Control>
                        <Text fw={600}>Keywords ({job.keywords.length})</Text>
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
              </Stack>
            </Grid.Col>

            {/* SIDEBAR - RIGHT SIDE */}
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
                    <Text fw={600} size="lg">{job.job_code}</Text>
                  </Paper>
                )}

                {/* HIRING MANAGER */}
                {job.hiring_manager && (
                  <Paper p="md" radius="md" withBorder>
                    <Text c="dimmed" size="sm">Hiring Manager</Text>
                    <Text fw={600}>{job.hiring_manager}</Text>
                  </Paper>
                )}

                {/* JOB TYPE */}
                <Paper p="md" radius="md" withBorder>
                  <Text c="dimmed" size="sm">Job Type</Text>
                  <Badge size="lg" color="blue" style={{ marginTop: '8px' }}>
                    {job.type?.toUpperCase()}
                  </Badge>
                </Paper>

                {/* OPENINGS */}
                <Paper p="md" radius="md" withBorder>
                  <Text c="dimmed" size="sm">Number of Openings</Text>
                  <Text fw={600} size="lg">{job.num_openings || 1}</Text>
                </Paper>

                {/* APPLICATION DATES */}
                <Paper p="md" radius="md" withBorder>
                  <Stack gap="xs">
                    <Group gap="sm">
                      <Text c="dimmed" size="sm">Posted:</Text>
                      <Text size="sm">
                        {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : '-'}
                      </Text>
                    </Group>
                    {job.application_deadline && (
                      <Group gap="sm">
                        <Text c="dimmed" size="sm">Deadline:</Text>
                        <Text size="sm">
                          {new Date(job.application_deadline).toLocaleDateString()}
                        </Text>
                      </Group>
                    )}
                  </Stack>
                </Paper>

                {/* STATUS */}
                <Paper p="md" radius="md" withBorder>
                  <Text c="dimmed" size="sm">Status</Text>
                  <Badge 
                    size="lg" 
                    color={getStatusColor(job.status)}
                    style={{ marginTop: '8px' }}
                  >
                    {job.status?.toUpperCase()}
                  </Badge>
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

              {/* NEW: Video Exam Evaluation button */}
              <Button
                variant="light"
                color="teal"
                onClick={() => navigate(`/jobs/${job.id}/video-exam-evaluation`)}
              >
                Video Exam Evaluation
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

          {/* INFO MESSAGE */}
          <Alert color="blue" title="Public Application">
            This is an open position. You can apply without creating an account.
            Just fill in your details on the application form.
          </Alert>
        </Stack>
      </Paper>
    </Container>
  );
}
