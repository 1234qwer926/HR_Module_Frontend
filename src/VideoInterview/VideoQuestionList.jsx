import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Table, Badge, Button, Group,
  Modal, Textarea, NumberInput, Stack, ActionIcon, Alert, Loader, Text
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconVideo } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function VideoQuestionList() {
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  const [formData, setFormData] = useState({
    question_text: '',
    duration_seconds: 120,
    created_by: 1 // Default HR user ID
  });

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const token = localStorage.getItem('token');
      // ✅ FIXED: Correct endpoint without trailing slash
      const response = await fetch('http://localhost:8000/video-questions?active_only=false', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched video questions:', data);
        setQuestions(data);
      } else {
        console.error('Failed to fetch questions:', response.status);
        notifications.show({
          title: 'Error',
          message: 'Failed to load questions',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      notifications.show({
        title: 'Error',
        message: 'Network error while loading questions',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const url = editingQuestion 
        ? `http://localhost:8000/video-questions/${editingQuestion.id}`
        : 'http://localhost:8000/video-questions';
      
      const method = editingQuestion ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: editingQuestion ? 'Question updated!' : 'Question created!',
          color: 'green'
        });
        setModalOpened(false);
        setEditingQuestion(null);
        setFormData({ question_text: '', duration_seconds: 120, created_by: 1 });
        fetchQuestions();
      } else {
        const errorData = await response.json();
        notifications.show({
          title: 'Error',
          message: errorData.detail || 'Failed to save question',
          color: 'red'
        });
      }
    } catch (error) {
      console.error('Error:', error);
      notifications.show({
        title: 'Error',
        message: 'Network error',
        color: 'red'
      });
    }
  };

  const handleEdit = (question) => {
    setEditingQuestion(question);
    setFormData({
      question_text: question.question_text,
      duration_seconds: question.duration_seconds,
      created_by: question.created_by || 1
    });
    setModalOpened(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/video-questions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        notifications.show({
          title: 'Deleted',
          message: 'Question deleted successfully',
          color: 'green'
        });
        fetchQuestions();
      }
    } catch (error) {
      console.error('Error:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete question',
        color: 'red'
      });
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

  return (
    <Container size="xl" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack spacing="lg">
          <Group position="apart">
            <Title order={2}>Video Interview Questions</Title>
            <Button 
              leftIcon={<IconPlus size={16} />}
              onClick={() => {
                setEditingQuestion(null);
                setFormData({ question_text: '', duration_seconds: 120, created_by: 1 });
                setModalOpened(true);
              }}
            >
              Add Question
            </Button>
          </Group>

          {questions.length === 0 ? (
            <Alert icon={<IconVideo size={16} />} title="No questions yet" color="blue">
              Create your first video interview question to get started.
            </Alert>
          ) : (
            <Table highlightOnHover>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question) => (
                  <tr key={question.id}>
                    <td style={{ maxWidth: '500px' }}>{question.question_text}</td>
                    <td>
                      <Badge variant="light" color="blue">
                        {question.duration_seconds}s
                      </Badge>
                    </td>
                    <td>
                      <Badge color={question.is_active ? 'green' : 'gray'}>
                        {question.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <Text size="sm" color="dimmed">
                        {new Date(question.created_at).toLocaleDateString()}
                      </Text>
                    </td>
                    <td>
                      <Group spacing="xs">
                        <ActionIcon 
                          color="blue" 
                          onClick={() => handleEdit(question)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon 
                          color="red" 
                          onClick={() => handleDelete(question.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Stack>
      </Paper>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingQuestion ? 'Edit Question' : 'Add New Question'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <Stack spacing="md">
            <Textarea
              required
              label="Question Text"
              placeholder="Enter the interview question..."
              minRows={4}
              value={formData.question_text}
              onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
              description="Ask candidates about their experience, skills, or motivations"
            />

            <NumberInput
              required
              label="Duration (seconds)"
              description="Maximum time allowed for the video response"
              min={30}
              max={300}
              step={30}
              value={formData.duration_seconds}
              onChange={(value) => setFormData({ ...formData, duration_seconds: value })}
            />

            <Group position="right" mt="md">
              <Button variant="subtle" onClick={() => setModalOpened(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingQuestion ? 'Update Question' : 'Create Question'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
