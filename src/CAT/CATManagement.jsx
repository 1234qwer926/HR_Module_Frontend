import React, { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Table,
  Button,
  Modal,
  TextInput,
  Select,
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
  rem,
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
} from '@tabler/icons-react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_BASE_URL = 'http://localhost:8000';

const CATManagement = () => {
  // State Management
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [uploadModalOpened, setUploadModalOpened] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCorrect, setFilterCorrect] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const itemsPerPage = 10;

  // Form for Add/Edit Question
  const form = useForm({
    initialValues: {
      question: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct: '',
      a: 1.0,
      b: 0.0,
      c: 0.25,
    },
    validate: {
      question: (value) => (!value ? 'Question is required' : null),
      option_a: (value) => (!value ? 'Option A is required' : null),
      option_b: (value) => (!value ? 'Option B is required' : null),
      option_c: (value) => (!value ? 'Option C is required' : null),
      option_d: (value) => (!value ? 'Option D is required' : null),
      correct: (value) => (!value ? 'Correct answer is required' : null),
      a: (value) => (value === null || value === undefined ? 'Parameter "a" is required' : null),
      b: (value) => (value === null || value === undefined ? 'Parameter "b" is required' : null),
      c: (value) => (value === null || value === undefined ? 'Parameter "c" is required' : null),
    },
  });

  // Fetch all questions
  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/cat-items`);
      setQuestions(response.data);
      notifications.show({
        title: 'Success',
        message: `Loaded ${response.data.length} questions`,
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
      const response = await axios.post(`${API_BASE_URL}/cat-items`, null, {
        params: values,
      });
      setQuestions([...questions, response.data]);
      notifications.show({
        title: 'Success',
        message: 'Question created successfully',
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
        `${API_BASE_URL}/cat-items/${selectedQuestion.id}`,
        null,
        { params: values }
      );
      setQuestions(
        questions.map((q) => (q.id === selectedQuestion.id ? response.data : q))
      );
      notifications.show({
        title: 'Success',
        message: 'Question updated successfully',
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

  // Delete Question
  const handleDeleteQuestion = async () => {
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/cat-items/${selectedQuestion.id}`);
      setQuestions(questions.filter((q) => q.id !== selectedQuestion.id));
      notifications.show({
        title: 'Success',
        message: 'Question deleted successfully',
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
      setDeleteModalOpened(false);
      setSelectedQuestion(null);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.detail || 'Failed to delete question',
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
      const data = await uploadFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Expected Excel columns: question, option_a, option_b, option_c, option_d, correct, a, b, c
      let successCount = 0;
      let failCount = 0;

      for (const row of jsonData) {
        try {
          await axios.post(`${API_BASE_URL}/cat-items`, null, {
            params: {
              question: row.question || row.Question,
              option_a: row.option_a || row.Option_A || row['Option A'],
              option_b: row.option_b || row.Option_B || row['Option B'],
              option_c: row.option_c || row.Option_C || row['Option C'],
              option_d: row.option_d || row.Option_D || row['Option D'],
              correct: (row.correct || row.Correct || row.Answer)?.toString().toUpperCase(),
              a: row.a || row.A || 1.0,
              b: row.b || row.B || 0.0,
              c: row.c || row.C || 0.25,
            },
          });
          successCount++;
        } catch (error) {
          console.error('Failed to upload row:', row, error);
          failCount++;
        }
      }

      notifications.show({
        title: 'Upload Complete',
        message: `Successfully uploaded ${successCount} questions. Failed: ${failCount}`,
        color: successCount > 0 ? 'teal' : 'orange',
        icon: <IconCheck size={16} />,
      });

      setUploadModalOpened(false);
      setUploadFile(null);
      fetchQuestions(); // Refresh list
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to process Excel file',
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
        question: 'Sample question text?',
        option_a: 'First option',
        option_b: 'Second option',
        option_c: 'Third option',
        option_d: 'Fourth option',
        correct: 'A',
        a: 1.0,
        b: 0.0,
        c: 0.25,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CAT Questions');
    XLSX.writeFile(workbook, 'CAT_Questions_Template.xlsx');

    notifications.show({
      title: 'Template Downloaded',
      message: 'Check your downloads folder',
      color: 'blue',
      icon: <IconFileSpreadsheet size={16} />,
    });
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
      question: question.question,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct: question.correct,
      a: question.a,
      b: question.b,
      c: question.c,
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
    const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCorrect === 'all' || q.correct === filterCorrect;
    return matchesSearch && matchesFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>CAT Question Bank</Title>
          <Text size="sm" c="dimmed">
            Manage adaptive test questions with IRT parameters
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
            <Text size="sm" c="dimmed" fw={500}>
              Total Questions
            </Text>
            <Title order={2} mt="xs">
              {questions.length}
            </Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="sm" c="dimmed" fw={500}>
              Option A Correct
            </Text>
            <Title order={2} mt="xs">
              {questions.filter((q) => q.correct === 'A').length}
            </Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="sm" c="dimmed" fw={500}>
              Option B Correct
            </Text>
            <Title order={2} mt="xs">
              {questions.filter((q) => q.correct === 'B').length}
            </Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text size="sm" c="dimmed" fw={500}>
              Avg Difficulty
            </Text>
            <Title order={2} mt="xs">
              {questions.length > 0
                ? (
                    questions.reduce((sum, q) => sum + q.b, 0) / questions.length
                  ).toFixed(2)
                : '0.00'}
            </Title>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Search and Filter */}
      <Paper shadow="sm" p="md" mb="md" withBorder>
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <TextInput
              placeholder="Search questions..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Select
              placeholder="Filter by correct answer"
              data={[
                { value: 'all', label: 'All Answers' },
                { value: 'A', label: 'Option A' },
                { value: 'B', label: 'Option B' },
                { value: 'C', label: 'Option C' },
                { value: 'D', label: 'Option D' },
              ]}
              value={filterCorrect}
              onChange={setFilterCorrect}
            />
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
                    <Table.Th>Options</Table.Th>
                    <Table.Th>Correct</Table.Th>
                    <Table.Th>IRT Parameters</Table.Th>
                    <Table.Th>Usage</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedQuestions.map((question) => (
                    <Table.Tr key={question.id}>
                      <Table.Td>
                        <Badge variant="light">{question.id}</Badge>
                      </Table.Td>
                      <Table.Td style={{ maxWidth: '300px' }}>
                        <Text size="sm" lineClamp={2}>
                          {question.question}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap="xs">
                          <Text size="xs">
                            <Badge size="xs" mr="xs" variant="outline">
                              A
                            </Badge>
                            {question.option_a?.substring(0, 20)}...
                          </Text>
                          <Text size="xs">
                            <Badge size="xs" mr="xs" variant="outline">
                              B
                            </Badge>
                            {question.option_b?.substring(0, 20)}...
                          </Text>
                          <Text size="xs">
                            <Badge size="xs" mr="xs" variant="outline">
                              C
                            </Badge>
                            {question.option_c?.substring(0, 20)}...
                          </Text>
                          <Text size="xs">
                            <Badge size="xs" mr="xs" variant="outline">
                              D
                            </Badge>
                            {question.option_d?.substring(0, 20)}...
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="teal" size="lg">
                          {question.correct}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap="xs">
                          <Text size="xs">
                            <strong>a:</strong> {question.a?.toFixed(2)}
                          </Text>
                          <Text size="xs">
                            <strong>b:</strong> {question.b?.toFixed(2)}
                          </Text>
                          <Text size="xs">
                            <strong>c:</strong> {question.c?.toFixed(2)}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap="xs">
                          <Text size="xs">Used: {question.used_count || 0}</Text>
                          <Text size="xs">
                            Correct: {question.correct_count || 0}
                          </Text>
                        </Stack>
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
        title={editMode ? 'Edit Question' : 'Add New Question'}
        size="xl"
      >
        <form
          onSubmit={form.onSubmit(
            editMode ? handleUpdateQuestion : handleCreateQuestion
          )}
        >
          <Stack>
            <Textarea
              label="Question"
              placeholder="Enter the question text"
              required
              minRows={3}
              {...form.getInputProps('question')}
            />

            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Option A"
                  placeholder="First option"
                  required
                  {...form.getInputProps('option_a')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Option B"
                  placeholder="Second option"
                  required
                  {...form.getInputProps('option_b')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Option C"
                  placeholder="Third option"
                  required
                  {...form.getInputProps('option_c')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Option D"
                  placeholder="Fourth option"
                  required
                  {...form.getInputProps('option_d')}
                />
              </Grid.Col>
            </Grid>

            <Select
              label="Correct Answer"
              placeholder="Select correct option"
              required
              data={[
                { value: 'A', label: 'Option A' },
                { value: 'B', label: 'Option B' },
                { value: 'C', label: 'Option C' },
                { value: 'D', label: 'Option D' },
              ]}
              {...form.getInputProps('correct')}
            />

            <Text size="sm" fw={500} mt="md">
              IRT Parameters
            </Text>
            <Text size="xs" c="dimmed" mt={-8}>
              Item Response Theory calibration values for adaptive testing
            </Text>

            <Grid>
              <Grid.Col span={4}>
                <NumberInput
                  label="Discrimination (a)"
                  description="Ability to discriminate"
                  placeholder="1.0"
                  step={0.1}
                  precision={2}
                  min={0}
                  max={3}
                  {...form.getInputProps('a')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <NumberInput
                  label="Difficulty (b)"
                  description="Item difficulty level"
                  placeholder="0.0"
                  step={0.1}
                  precision={2}
                  min={-3}
                  max={3}
                  {...form.getInputProps('b')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <NumberInput
                  label="Guessing (c)"
                  description="Probability of guessing"
                  placeholder="0.25"
                  step={0.05}
                  precision={2}
                  min={0}
                  max={1}
                  {...form.getInputProps('c')}
                />
              </Grid.Col>
            </Grid>

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
        title="Delete Question"
        size="md"
      >
        <Stack>
          <Text>
            Are you sure you want to delete this question? This action cannot be
            undone.
          </Text>
          {selectedQuestion && (
            <Paper p="md" withBorder bg="gray.0">
              <Text size="sm" fw={500} mb="xs">
                Question:
              </Text>
              <Text size="sm" c="dimmed">
                {selectedQuestion.question}
              </Text>
            </Paper>
          )}
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
            <Button color="red" onClick={handleDeleteQuestion} loading={loading}>
              Delete Question
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
        title="Bulk Upload Questions"
        size="lg"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Upload multiple questions at once using an Excel file. Download the
            template to see the required format.
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
              <li>question - Question text</li>
              <li>option_a - First option</li>
              <li>option_b - Second option</li>
              <li>option_c - Third option</li>
              <li>option_d - Fourth option</li>
              <li>correct - Correct answer (A, B, C, or D)</li>
              <li>a - Discrimination parameter (default: 1.0)</li>
              <li>b - Difficulty parameter (default: 0.0)</li>
              <li>c - Guessing parameter (default: 0.25)</li>
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

export default CATManagement;
