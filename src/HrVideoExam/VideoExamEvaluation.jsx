import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  Table,
  Group,
  Badge,
  Loader,
  Alert,
  Select,
  NumberInput,
  Button,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export default function VideoExamEvaluation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sortBy, setSortBy] = useState('resume_score');
  const [topN, setTopN] = useState(10);

  // Helper to get field value (handles both naming conventions)
  const getField = (app, field) => {
    // Try camelCase first, then snake_case
    const camelCase = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    const snakeCase = field.replace(/([A-Z])/g, '_$1').toLowerCase();
    
    return app[field] ?? app[camelCase] ?? app[snakeCase] ?? null;
  };

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/jobs/${id}/applications`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];

        console.log('📋 Total applications from API:', list.length);
        
        // Debug: Log first application structure
        if (list.length > 0) {
          console.log('🔍 First application keys:', Object.keys(list[0]));
          console.log('🔍 First application:', list[0]);
        }

        // Filter VIDEO HR stage (handle both field names)
        const filtered = list.filter((app) => {
          const stage = (
            app.currentstage || 
            app.current_stage || 
            app.currentStage || 
            ''
          ).toLowerCase().trim();
          
          return stage === 'video hr';
        });

        console.log('🎥 VIDEO HR candidates:', filtered.length);
        setApplications(filtered);
      } else {
        setError('Failed to load applications');
      }
    } catch (e) {
      console.error('Network error:', e);
      setError('Network error while loading applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [id]);

  // Sorting logic
  const sorted = [...applications].sort((a, b) => {
    if (sortBy === 'resume_score') {
      const scoreA = a.resumescore ?? a.resume_score ?? 0;
      const scoreB = b.resumescore ?? b.resume_score ?? 0;
      return scoreB - scoreA;
    }
    if (sortBy === 'cat_theta') {
      const thetaA = a.cattheta ?? a.cat_theta ?? 0;
      const thetaB = b.cattheta ?? b.cat_theta ?? 0;
      return thetaB - thetaA;
    }
    if (sortBy === 'id') {
      return (a.id || 0) - (b.id || 0);
    }
    return 0;
  });

  const limited = topN && topN > 0 ? sorted.slice(0, topN) : sorted;

  // Get stage badge color
  const getStageColor = (stage) => {
    const s = (stage || '').toLowerCase();
    if (s.includes('video')) return 'blue';
    if (s.includes('final')) return 'green';
    if (s.includes('aptitude')) return 'orange';
    if (s.includes('applied')) return 'gray';
    return 'blue';
  };

  // Table rows with both field name conventions
  const rows = limited.map((app) => {
    // Get values handling both naming conventions
    const name = app.fullname || app.full_name || app.fullName || '-';
    const email = app.email || '-';
    const stage = app.currentstage || app.current_stage || app.currentStage || '-';
    const catTheta = app.cattheta ?? app.cat_theta ?? app.catTheta ?? '-';
    const videoScore = app.video_exam_score ?? app.videoexamscore ?? app.videoExamScore ?? '-';

    return (
      <Table.Tr key={app.id}>
        <Table.Td>{app.id}</Table.Td>
        <Table.Td>{name}</Table.Td>
        <Table.Td>{email}</Table.Td>
        <Table.Td>
          <Badge color={getStageColor(stage)} variant="light">
            {stage.toUpperCase()}
          </Badge>
        </Table.Td>
        <Table.Td>{catTheta}</Table.Td>
        <Table.Td>{videoScore}</Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Video Exam Evaluation</Title>
          <Text size="sm" c="dimmed">
            Job ID: {id} • Showing candidates in{' '}
            <Badge color="blue" variant="light">VIDEO HR</Badge> stage
          </Text>
        </div>

        <Group>
          <Select
            label="Sort By"
            size="xs"
            value={sortBy}
            onChange={setSortBy}
            data={[
              { value: 'resume_score', label: 'Resume Score' },
              { value: 'cat_theta', label: 'CAT θ' },
              { value: 'id', label: 'ID' },
            ]}
          />
          <NumberInput
            label="Top N"
            size="xs"
            min={0}
            value={topN}
            onChange={(value) => setTopN(Number(value) || 0)}
            style={{ width: 80 }}
          />
          <Button variant="default" onClick={fetchApplications}>
            Refresh
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
        </Group>
      </Group>

      {/* Summary */}
      <Text size="sm" c="dimmed" mb="xs">
        Total: {applications.length} | Showing: {limited.length}
      </Text>

      <Paper withBorder radius="md" p="md">
        {loading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : error ? (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
            {error}
          </Alert>
        ) : applications.length === 0 ? (
          <Alert color="yellow" title="No candidates in VIDEO HR stage">
            There are no applications currently in the Video HR stage for this job.
          </Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Stage</Table.Th>
                <Table.Th>CAT θ</Table.Th>
                <Table.Th>Video Exam Score</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>
    </Container>
  );
}
