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
  Collapse,
  Stack,
  Divider,
  Box,
  ActionIcon,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconChevronDown, IconChevronRight, IconPlayerPlay, IconVideo } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function VideoExamEvaluation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [videoResponses, setVideoResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [updatingScores, setUpdatingScores] = useState(false);
  const [loadingVideoUrl, setLoadingVideoUrl] = useState(null); // Track which video is loading

  // Store edited HR scores and feedback
  const [editedResponses, setEditedResponses] = useState({});

  const [sortBy, setSortBy] = useState('resume_score');
  const [topN, setTopN] = useState(10);

  const HR_REVIEWER_ID = 1;

  // --------------------------------------------------
  // Open video in new tab
  // --------------------------------------------------
  const handleOpenVideo = async (videoPath, responseId) => {
    if (!videoPath) {
      notifications.show({
        title: 'Error',
        message: 'No video path available',
        color: 'red',
      });
      return;
    }

    setLoadingVideoUrl(responseId);
    
    try {
      const res = await fetch(`http://localhost:8000/s3/get-url?key=${encodeURIComponent(videoPath)}`);
      
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          // Open in new tab
          window.open(data.url, '_blank');
        } else {
          notifications.show({
            title: 'Error',
            message: 'Could not get video URL',
            color: 'red',
          });
        }
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to get video URL',
          color: 'red',
        });
      }
    } catch (e) {
      console.error('Error getting video URL:', e);
      notifications.show({
        title: 'Error',
        message: 'Network error while getting video URL',
        color: 'red',
      });
    } finally {
      setLoadingVideoUrl(null);
    }
  };

  // --------------------------------------------------
  // Calculate average video exam score for an application
  // --------------------------------------------------
  const calculateVideoExamScore = (appId) => {
    const responses = videoResponses[appId] || [];
    if (responses.length === 0) return null;

    let totalScore = 0;
    let count = 0;

    responses.forEach((resp) => {
      const edited = editedResponses[resp.id];
      const hrScore = edited?.hr_score ?? resp.hr_score;
      const aiScore = resp.ai_score;

      if (hrScore !== null && hrScore !== undefined && hrScore !== '') {
        totalScore += parseFloat(hrScore);
        count++;
      } else if (aiScore !== null && aiScore !== undefined) {
        totalScore += parseFloat(aiScore);
        count++;
      }
    });

    if (count === 0) return null;
    return (totalScore / count).toFixed(2);
  };

  // --------------------------------------------------
  // Fetch video responses for a single application
  // --------------------------------------------------
  const fetchVideoResponses = async (applicationId) => {
    try {
      const res = await fetch(`http://localhost:8000/applications/${applicationId}/video-responses`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (e) {
      console.error(`Error fetching video responses for app ${applicationId}:`, e);
      return [];
    }
  };

  // --------------------------------------------------
  // Fetch applications and their video responses
  // --------------------------------------------------
  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    setEditedResponses({});
    try {
      const res = await fetch(`http://localhost:8000/jobs/${id}/applications`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];

        console.log('📋 Total applications from API:', list.length);

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

        const responsesMap = {};
        for (const app of filtered) {
          const responses = await fetchVideoResponses(app.id);
          responsesMap[app.id] = responses;
          console.log(`📹 App ${app.id} has ${responses.length} video responses`);
        }
        setVideoResponses(responsesMap);

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

  const toggleExpand = (appId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [appId]: !prev[appId],
    }));
  };

  const handleHrScoreChange = (responseId, value) => {
    let score = value;
    if (value !== '' && value !== null) {
      score = Math.max(0, Math.min(10, parseFloat(value) || 0));
    }
    
    setEditedResponses((prev) => ({
      ...prev,
      [responseId]: {
        ...prev[responseId],
        hr_score: score,
      },
    }));
  };

  const handleHrFeedbackChange = (responseId, value) => {
    setEditedResponses((prev) => ({
      ...prev,
      [responseId]: {
        ...prev[responseId],
        hr_feedback: value,
      },
    }));
  };

  const handleUpdateAllScores = async (appId) => {
    const responses = videoResponses[appId] || [];
    
    const updates = [];
    
    responses.forEach((resp) => {
      const edited = editedResponses[resp.id];
      
      if (edited && (edited.hr_score !== undefined && edited.hr_score !== '' && edited.hr_score !== null)) {
        updates.push({
          response_id: resp.id,
          hr_score: parseFloat(edited.hr_score),
          hr_feedback: edited.hr_feedback || resp.hr_feedback || '',
          hr_reviewed_by: HR_REVIEWER_ID,
        });
      }
    });

    if (updates.length === 0) {
      notifications.show({
        title: 'Warning',
        message: 'No HR scores to update. Please enter scores first.',
        color: 'yellow',
      });
      return;
    }

    console.log('📤 Sending bulk update:', updates);

    setUpdatingScores(true);
    try {
      const res = await fetch('http://localhost:8000/video-responses/bulk-update-scores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const result = await res.json();
        console.log('✅ Bulk update result:', result);

        notifications.show({
          title: 'Success',
          message: `Updated ${result.successfully_updated} video response(s)`,
          color: 'green',
        });

        const updatedResponses = await fetchVideoResponses(appId);
        setVideoResponses((prev) => ({
          ...prev,
          [appId]: updatedResponses,
        }));

        const responseIds = responses.map((r) => r.id);
        setEditedResponses((prev) => {
          const newState = { ...prev };
          responseIds.forEach((id) => delete newState[id]);
          return newState;
        });

      } else {
        const errData = await res.json().catch(() => ({}));
        notifications.show({
          title: 'Error',
          message: errData.detail || 'Failed to update scores',
          color: 'red',
        });
      }
    } catch (e) {
      console.error('Error updating scores:', e);
      notifications.show({
        title: 'Error',
        message: 'Network error while updating scores',
        color: 'red',
      });
    } finally {
      setUpdatingScores(false);
    }
  };

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
    if (sortBy === 'video_score') {
      const scoreA = calculateVideoExamScore(a.id) || 0;
      const scoreB = calculateVideoExamScore(b.id) || 0;
      return parseFloat(scoreB) - parseFloat(scoreA);
    }
    if (sortBy === 'id') {
      return (a.id || 0) - (b.id || 0);
    }
    return 0;
  });

  const limited = topN && topN > 0 ? sorted.slice(0, topN) : sorted;

  const getStageColor = (stage) => {
    const s = (stage || '').toLowerCase();
    if (s.includes('video')) return 'blue';
    if (s.includes('final')) return 'green';
    if (s.includes('aptitude')) return 'orange';
    if (s.includes('applied')) return 'gray';
    return 'blue';
  };

  const getScoreBadgeColor = (score) => {
    if (score === null || score === undefined || score === '') return 'gray';
    const numScore = parseFloat(score);
    if (numScore >= 7) return 'green';
    if (numScore >= 4) return 'yellow';
    return 'red';
  };

  // --------------------------------------------------
  // Render video responses table for expanded row
  // --------------------------------------------------
  const renderVideoResponsesTable = (appId) => {
    const responses = videoResponses[appId] || [];

    if (responses.length === 0) {
      return (
        <Alert color="gray" title="No Video Responses">
          No video responses found for this application.
        </Alert>
      );
    }

    return (
      <Stack gap="md">
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 50 }}>ID</Table.Th>
              <Table.Th style={{ width: 70 }}>Video</Table.Th>
              <Table.Th style={{ width: 160 }}>Question</Table.Th>
              <Table.Th style={{ width: 160 }}>User Answer</Table.Th>
              <Table.Th style={{ width: 60 }}>AI Score</Table.Th>
              <Table.Th style={{ width: 150 }}>AI Feedback</Table.Th>
              <Table.Th style={{ width: 90 }}>HR Score</Table.Th>
              <Table.Th style={{ width: 150 }}>HR Feedback</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {responses.map((resp) => {
              const edited = editedResponses[resp.id] || {};
              const currentHrScore = edited.hr_score !== undefined ? edited.hr_score : (resp.hr_score ?? '');
              const currentHrFeedback = edited.hr_feedback !== undefined ? edited.hr_feedback : (resp.hr_feedback || '');
              const isLoadingVideo = loadingVideoUrl === resp.id;

              return (
                <Table.Tr key={resp.id}>
                  <Table.Td>{resp.id}</Table.Td>
                  <Table.Td>
                    {resp.video_path ? (
                      <Tooltip label="Open video in new tab">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size="md"
                          loading={isLoadingVideo}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenVideo(resp.video_path, resp.id);
                          }}
                        >
                          <IconPlayerPlay size={18} />
                        </ActionIcon>
                      </Tooltip>
                    ) : (
                      <Tooltip label="No video available">
                        <ActionIcon variant="light" color="gray" size="md" disabled>
                          <IconVideo size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={3}>
                      {resp.question_text || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={3}>
                      {resp.user_answer_text || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge 
                      color={getScoreBadgeColor(resp.ai_score)}
                      variant="filled"
                    >
                      {resp.ai_score ?? '-'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" lineClamp={4}>
                      {resp.ai_feedback || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      min={0}
                      max={10}
                      step={0.5}
                      decimalScale={1}
                      placeholder="0-10"
                      value={currentHrScore}
                      onChange={(value) => handleHrScoreChange(resp.id, value)}
                      onClick={(e) => e.stopPropagation()}
                      styles={{
                        input: {
                          width: 70,
                          textAlign: 'center',
                        },
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      placeholder="Enter feedback..."
                      value={currentHrFeedback}
                      onChange={(e) => handleHrFeedbackChange(resp.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        <Group justify="flex-end">
          <Button 
            color="blue"
            loading={updatingScores}
            onClick={() => handleUpdateAllScores(appId)}
          >
            Update All Scores
          </Button>
        </Group>
      </Stack>
    );
  };

  const rows = limited.map((app) => {
    const name = app.fullname || app.full_name || app.fullName || '-';
    const email = app.email || '-';
    const stage = app.currentstage || app.current_stage || app.currentStage || '-';
    const catTheta = app.cattheta ?? app.cat_theta ?? app.catTheta ?? '-';
    const isExpanded = expandedRows[app.id] || false;
    const responseCount = (videoResponses[app.id] || []).length;
    const videoExamScore = calculateVideoExamScore(app.id);

    return (
      <React.Fragment key={app.id}>
        <Table.Tr 
          style={{ cursor: 'pointer' }}
          onClick={() => toggleExpand(app.id)}
        >
          <Table.Td>
            <ActionIcon variant="subtle" size="sm">
              {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </ActionIcon>
          </Table.Td>
          <Table.Td>{app.id}</Table.Td>
          <Table.Td>{name}</Table.Td>
          <Table.Td>{email}</Table.Td>
          <Table.Td>
            <Badge color={getStageColor(stage)} variant="light">
              {stage.toUpperCase()}
            </Badge>
          </Table.Td>
          <Table.Td>{catTheta}</Table.Td>
          <Table.Td>
            {videoExamScore !== null ? (
              <Badge color={getScoreBadgeColor(videoExamScore)} variant="filled" size="lg">
                {videoExamScore}
              </Badge>
            ) : (
              <Text size="sm" c="dimmed">-</Text>
            )}
          </Table.Td>
          <Table.Td>
            <Badge color="gray" variant="light">
              {responseCount} response(s)
            </Badge>
          </Table.Td>
        </Table.Tr>

        {isExpanded && (
          <Table.Tr>
            <Table.Td colSpan={8} style={{ backgroundColor: '#f8f9fa', padding: 0 }}>
              <Collapse in={isExpanded}>
                <Box p="md">
                  <Title order={5} mb="sm">
                    Video Responses for {name}
                  </Title>
                  <Divider mb="md" />
                  {renderVideoResponsesTable(app.id)}
                </Box>
              </Collapse>
            </Table.Td>
          </Table.Tr>
        )}
      </React.Fragment>
    );
  });

  return (
    <Container size="xl" py="xl">
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
              { value: 'video_score', label: 'Video Exam Score' },
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

      <Text size="sm" c="dimmed" mb="xs">
        Total: {applications.length} | Showing: {limited.length}
      </Text>

      <Paper withBorder radius="md" p="md">
        {loading ? (
          <Group justify="center" p="xl">
            <Loader />
            <Text size="sm" c="dimmed">Loading applications and video responses...</Text>
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
                <Table.Th style={{ width: 40 }}></Table.Th>
                <Table.Th>ID</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Stage</Table.Th>
                <Table.Th>CAT θ</Table.Th>
                <Table.Th>Video Exam Score</Table.Th>
                <Table.Th>Responses</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>
    </Container>
  );
}
