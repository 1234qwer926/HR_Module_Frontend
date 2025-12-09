
// VideoQuestionsManagement.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Table,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Textarea,
  Group,
  ActionIcon,
  Badge,
  Loader,
  Text,
  FileInput,
  Grid,
  Card,
  Stack,
  Pagination,
  Flex,
  Switch,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconUpload,
  IconSearch,
  IconCheck,
  IconX,
  IconFileSpreadsheet,
  IconVideo,
  IconClock,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_BASE_URL = 'https://promptly-skill-employer-precisely.trycloudflare.com';

const VideoQuestionsManagement = () => {
  // State Management
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [uploadModalOpened, setUploadModalOpened] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const itemsPerPage = 10;

  // Form for Add/Edit Question
  const form = useForm({
    initialValues: {
      question_text: '',
      duration_seconds: 120,
      created_by: 1, // Default HR/Admin user ID
      is_active: true,
    },
    validate: {
      question_text: (value) => (!value ? 'Question text is required' : null),
      duration_seconds: (value) =>
        !value || value < 30 || value > 600
          ? 'Duration must be between 30 and 600 seconds'
          : null,
    },
  });

  // Fetch all questions
  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/video-questions`, {
        params: { active_only: false }, // Get all questions (active and inactive)
      });
      setQuestions(response.data);
      notifications.show({
        title: 'Success',
        message: `Loaded ${response.data.length} video questions`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to fetch questions',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Create Question
  const handleCreateQuestion = async (values) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/video-questions`, values);
      setQuestions([...questions, response.data]);
      notifications.show({
        title: 'Success',
        message: 'Video question created successfully',
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
      setModalOpened(false);
      form.reset();
      fetchQuestions(); // Refresh list
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to create question',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Update Question
  const handleUpdateQuestion = async (values) => {
    setLoading(true);
    try {
      const response = await axios.put(
        `${API_BASE_URL}/video-questions/${selectedQuestion.id}`,
        values
      );
      setQuestions(
        questions.map((q) => (q.id === selectedQuestion.id ? response.data : q))
      );
      notifications.show({
        title: 'Success',
        message: 'Video question updated successfully',
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
      setModalOpened(false);
      setEditMode(false);
      form.reset();
      fetchQuestions(); // Refresh list
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to update question',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Soft Delete Question (Deactivate)
  const handleDeleteQuestion = async () => {
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/video-questions/${selectedQuestion.id}`);
      // Update local state to reflect soft delete
      setQuestions(
        questions.map((q) =>
          q.id === selectedQuestion.id ? { ...q, is_active: false } : q
        )
      );
      notifications.show({
        title: 'Success',
        message: 'Video question deactivated successfully',
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
      setDeleteModalOpened(false);
      setSelectedQuestion(null);
      fetchQuestions(); // Refresh list
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to deactivate question',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Bulk Upload via Excel
  const handleExcelUpload = async () => {
    if (!uploadFile) {
      notifications.show({
        title: 'Error',
        message: 'Please select an Excel file',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    setUploadLoading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await axios.post(
        `${API_BASE_URL}/video-questions/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          params: {
            created_by: 1, // Default HR/Admin user ID
          },
        }
      );

      notifications.show({
        title: 'Upload Complete',
        message: response.data.message || 'Questions uploaded successfully',
        color: 'teal',
        icon: <IconCheck size={16} />,
      });

      setUploadModalOpened(false);
      setUploadFile(null);
      fetchQuestions(); // Refresh list
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to process Excel file',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // Download Excel Template
  const downloadTemplate = () => {
    const template = [
      {
        question_text: 'Tell us about your experience with React and TypeScript?',
        duration_seconds: 120,
        is_active: true,
      },
      {
        question_text: 'Why do you want to work for our company?',
        duration_seconds: 90,
        is_active: true,
      },
      {
        question_text: 'Describe a challenging project you worked on.',
        duration_seconds: 180,
        is_active: true,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Video Questions');
    XLSX.writeFile(workbook, 'Video_Questions_Template.xlsx');

    notifications.show({
      title: 'Template Downloaded',
      message: 'Check your downloads folder',
      color: 'blue',
      icon: <IconFileSpreadsheet size={16} />,
    });
  };

  // Format duration for display
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Open Add Modal
  const openAddModal = () => {
    form.reset();
    setEditMode(false);
    setModalOpened(true);
  };

  // Open Edit Modal
  const openEditModal = (question) => {
    setSelectedQuestion(question);
    form.setValues({
      question_text: question.question_text,
      duration_seconds: question.duration_seconds,
      is_active: question.is_active,
      created_by: question.created_by,
    });
    setEditMode(true);
    setModalOpened(true);
  };

  // Open Delete Modal
  const openDeleteModal = (question) => {
    setSelectedQuestion(question);
    setDeleteModalOpened(true);
  };

  // Filter and Search
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.question_text
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && q.is_active) ||
      (filterActive === 'inactive' && !q.is_active);
    return matchesSearch && matchesFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate statistics
  const activeCount = questions.filter((q) => q.is_active).length;
  const inactiveCount = questions.filter((q) => !q.is_active).length;
  const avgDuration =
    questions.length > 0
      ? Math.round(
        questions.reduce((sum, q) => sum + q.duration_seconds, 0) /
        questions.length
      )
      : 0;
  const shortQuestions = questions.filter((q) => q.duration_seconds <= 90).length;
  const mediumQuestions = questions.filter(
    (q) => q.duration_seconds > 90 && q.duration_seconds <= 180
  ).length;
  const longQuestions = questions.filter((q) => q.duration_seconds > 180).length;

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>Video Interview Questions</Title>
          <Text size="sm" c="dimmed">
            Manage video interview questions for candidate assessments
          </Text>
        </div>
        <Group>
          <Button
            leftSection={<IconUpload size={16} />}
            variant="light"
            onClick={() => setUploadModalOpened(true)}
          >
            Bulk Upload
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openAddModal}>
            Add Question
          </Button>
        </Group>
      </Group>

      {/* Statistics Cards */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="apart" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Total Questions
              </Text>
              <IconVideo size={20} color="gray" />
            </Group>
            <Title order={2}>{questions.length}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="apart" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Active Questions
              </Text>
              <IconEye size={20} color="teal" />
            </Group>
            <Title order={2} c="teal">
              {activeCount}
            </Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="apart" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Inactive Questions
              </Text>
              <IconEyeOff size={20} color="red" />
            </Group>
            <Title order={2} c="red">
              {inactiveCount}
            </Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="apart" mb="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Avg Duration
              </Text>
              <IconClock size={20} color="blue" />
            </Group>
            <Title order={2}>{formatDuration(avgDuration)}</Title>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Duration Distribution Cards */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Paper shadow="sm" p="md" withBorder>
            <Text size="sm" c="dimmed" fw={500}>
              Short (≤ 1.5 min)
            </Text>
            <Title order={3} mt="xs">
              {shortQuestions}
            </Title>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Paper shadow="sm" p="md" withBorder>
            <Text size="sm" c="dimmed" fw={500}>
              Medium (1.5-3 min)
            </Text>
            <Title order={3} mt="xs">
              {mediumQuestions}
            </Title>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Paper shadow="sm" p="md" withBorder>
            <Text size="sm" c="dimmed" fw={500}>
              Long (&gt; 3 min)
            </Text>
            <Title order={3} mt="xs">
              {longQuestions}
            </Title>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Search and Filter */}
      <Paper shadow="sm" p="md" mb="md" withBorder>
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <TextInput
              placeholder="Search video questions..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <TextInput
              component="select"
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              styles={{
                input: {
                  cursor: 'pointer',
                },
              }}
            >
              <option value="all">All Questions</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </TextInput>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Questions Table */}
      <Paper shadow="sm" p="md" withBorder>
        {loading ? (
          <Flex justify="center" align="center" h={200}>
            <Loader size="lg" />
          </Flex>
        ) : paginatedQuestions.length === 0 ? (
          <Flex justify="center" align="center" h={200} direction="column">
            <IconVideo size={48} color="gray" style={{ marginBottom: '16px' }} />
            <Text size="lg" c="dimmed" mb="xs">
              No questions found
            </Text>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openAddModal}
              variant="light"
            >
              Add Your First Question
            </Button>
          </Flex>
        ) : (
          <>
            <Box style={{ overflowX: 'auto' }}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>ID</Table.Th>
                    <Table.Th>Question</Table.Th>
                    <Table.Th>Duration</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Created By</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedQuestions.map((question) => (
                    <Table.Tr key={question.id}>
                      <Table.Td>
                        <Badge variant="light">{question.id}</Badge>
                      </Table.Td>
                      <Table.Td style={{ maxWidth: '400px' }}>
                        <Text size="sm" lineClamp={2}>
                          {question.question_text}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <IconClock size={16} color="gray" />
                          <Text size="sm">
                            {formatDuration(question.duration_seconds)}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {question.is_active ? (
                          <Badge color="teal" leftSection={<IconEye size={12} />}>
                            Active
                          </Badge>
                        ) : (
                          <Badge color="red" leftSection={<IconEyeOff size={12} />}>
                            Inactive
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline">
                          User #{question.created_by}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            color="blue"
                            variant="light"
                            onClick={() => openEditModal(question)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            variant="light"
                            onClick={() => openDeleteModal(question)}
                            disabled={!question.is_active}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <Flex justify="center" mt="xl">
                <Pagination
                  total={totalPages}
                  value={currentPage}
                  onChange={setCurrentPage}
                />
              </Flex>
            )}
          </>
        )}
      </Paper>

      {/* Add/Edit Question Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setEditMode(false);
          form.reset();
        }}
        title={editMode ? 'Edit Video Question' : 'Add New Video Question'}
        size="lg"
      >
        <form
          onSubmit={form.onSubmit(
            editMode ? handleUpdateQuestion : handleCreateQuestion
          )}
        >
          <Stack>
            <Textarea
              label="Question Text"
              placeholder="Enter the interview question"
              description="This question will be shown to candidates during video interview"
              required
              minRows={4}
              {...form.getInputProps('question_text')}
            />

            <NumberInput
              label="Duration (seconds)"
              description="Time allowed for candidate to respond"
              placeholder="120"
              required
              min={30}
              max={600}
              step={30}
              leftSection={<IconClock size={16} />}
              {...form.getInputProps('duration_seconds')}
            />

            <Group grow>
              <Paper p="sm" withBorder bg="blue.0">
                <Text size="xs" fw={500}>
                  Duration Preview:
                </Text>
                <Text size="lg" fw={600} c="blue">
                  {formatDuration(form.values.duration_seconds || 120)}
                </Text>
              </Paper>
              <Paper p="sm" withBorder bg="gray.0">
                <Text size="xs" fw={500}>
                  Recommended:
                </Text>
                <Text size="sm">
                  30-90s: Quick responses
                  <br />
                  120-180s: Detailed answers
                  <br />
                  180-300s: In-depth topics
                </Text>
              </Paper>
            </Group>

            <Switch
              label="Active Question"
              description="Only active questions will be shown in interviews"
              {...form.getInputProps('is_active', { type: 'checkbox' })}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                onClick={() => {
                  setModalOpened(false);
                  setEditMode(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {editMode ? 'Update Question' : 'Create Question'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setSelectedQuestion(null);
        }}
        title="Deactivate Video Question"
        size="md"
      >
        <Stack>
          <Text>
            Are you sure you want to deactivate this video question? This will make
            it unavailable for future interviews, but it won't delete existing
            responses.
          </Text>
          {selectedQuestion && (
            <Paper p="md" withBorder bg="yellow.0">
              <Text size="sm" fw={500} mb="xs">
                Question:
              </Text>
              <Text size="sm">{selectedQuestion.question_text}</Text>
              <Text size="xs" c="dimmed" mt="xs">
                Duration: {formatDuration(selectedQuestion.duration_seconds)}
              </Text>
            </Paper>
          )}
          <Paper p="xs" withBorder bg="blue.0">
            <Text size="xs" c="dimmed">
              💡 Tip: You can reactivate this question later by editing it and
              toggling the "Active" switch.
            </Text>
          </Paper>
          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setDeleteModalOpened(false);
                setSelectedQuestion(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="orange"
              onClick={handleDeleteQuestion}
              loading={loading}
            >
              Deactivate Question
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        opened={uploadModalOpened}
        onClose={() => {
          setUploadModalOpened(false);
          setUploadFile(null);
        }}
        title="Bulk Upload Video Questions"
        size="lg"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Upload multiple video interview questions at once using an Excel file.
            Download the template to see the required format.
          </Text>

          <Button
            variant="light"
            leftSection={<IconFileSpreadsheet size={16} />}
            onClick={downloadTemplate}
            fullWidth
          >
            Download Excel Template
          </Button>

          <FileInput
            label="Select Excel File"
            placeholder="Choose .xlsx or .xls file"
            accept=".xlsx,.xls"
            value={uploadFile}
            onChange={setUploadFile}
            leftSection={<IconUpload size={16} />}
          />

          <Paper p="md" withBorder bg="blue.0">
            <Text size="sm" fw={500} mb="xs">
              Required Excel Columns:
            </Text>
            <Text size="xs" component="ul" style={{ paddingLeft: '20px' }}>
              <li>
                <strong>question_text</strong> - Interview question text (required)
              </li>
              <li>
                <strong>duration_seconds</strong> - Response duration in seconds
                (optional, default: 120)
              </li>
              <li>
                <strong>is_active</strong> - Active status: true or false
                (optional, default: true)
              </li>
            </Text>
          </Paper>

          <Paper p="md" withBorder bg="yellow.0">
            <Text size="sm" fw={500} mb="xs">
              📋 Tips:
            </Text>
            <Text size="xs" component="ul" style={{ paddingLeft: '20px' }}>
              <li>Duration must be between 30 and 600 seconds</li>
              <li>Questions with empty text will be skipped</li>
              <li>All uploaded questions will be assigned to User #1 (Admin)</li>
              <li>You can edit individual questions after upload</li>
            </Text>
          </Paper>

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setUploadModalOpened(false);
                setUploadFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleExcelUpload}
              loading={uploadLoading}
              disabled={!uploadFile}
            >
              Upload Questions
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default VideoQuestionsManagement;