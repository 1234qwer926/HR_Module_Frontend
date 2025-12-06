import React, { useEffect, useState, useMemo } from 'react';
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
  Checkbox,
  Modal,
  Textarea,
} from '@mantine/core';
import { 
  IconAlertCircle, 
  IconChevronDown, 
  IconChevronRight, 
  IconPlayerPlay, 
  IconVideo,
  IconMailForward,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

// Helper: Title case
const toTitleCase = (str) => {
  if (!str) return '-';
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

// Normalize UI → API
const normalizeStatusForAPI = (s) => {
  if (!s) return '';
  const map = {
    video_hr: 'video hr',
    videohr: 'video hr',
    final_interview: 'final interview',
  };
  return map[s] || s;
};

// Calculate percentile rank
const calculatePercentile = (score, allScores) => {
  if (score === null || score === undefined || allScores.length === 0) return null;
  const validScores = allScores.filter(s => s !== null && s !== undefined);
  if (validScores.length === 0) return null;
  
  const belowCount = validScores.filter(s => s < score).length;
  const percentile = (belowCount / validScores.length) * 100;
  return percentile.toFixed(1);
};

export default function VideoExamEvaluation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [videoResponses, setVideoResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [updatingScores, setUpdatingScores] = useState(false);
  const [loadingVideoUrl, setLoadingVideoUrl] = useState(null);

  // Store edited HR scores and feedback
  const [editedResponses, setEditedResponses] = useState({});

  // Filters
  const [stageFilter, setStageFilter] = useState('both'); // 'both', 'video hr', 'final interview'
  const [sortBy, setSortBy] = useState('final_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [topN, setTopN] = useState(10);

  // Bulk selection state
  const [selectedApps, setSelectedApps] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Modal state - Bulk Status Update
  const [modalOpened, setModalOpened] = useState(false);
  const [bulkStage, setBulkStage] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSendEmail, setBulkSendEmail] = useState(true);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const HR_REVIEWER_ID = 1;

  // Stage filter options
  const stageFilterOptions = [
    { value: 'both', label: 'Both (Video HR + Final Interview)' },
    { value: 'video hr', label: 'Video HR Only' },
    { value: 'final interview', label: 'Final Interview Only' },
  ];

  // Stage options for bulk update
  const stageOptions = [
    { value: 'applied', label: 'Applied' },
    { value: 'screening', label: 'Screening' },
    { value: 'aptitude', label: 'Aptitude' },
    { value: 'video hr', label: 'Video HR' },
    { value: 'final_interview', label: 'Final Interview' },
    { value: 'offer', label: 'Offer' },
    { value: 'hired', label: 'Hired' },
    { value: 'rejected', label: 'Rejected' },
  ];

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
  // Calculate Final Score (Average of CAT Score + Video Exam Score)
  // --------------------------------------------------
  const calculateFinalScore = (app, videoScore) => {
    const catTheta = app.cattheta ?? app.cat_theta ?? app.catTheta ?? null;
    const videoExamScore = videoScore !== null ? parseFloat(videoScore) : null;

    // Normalize CAT theta to 0-10 scale (typically theta ranges from -3 to +3)
    // Map -3 to 0, and +3 to 10
    let normalizedCatScore = null;
    if (catTheta !== null && catTheta !== undefined) {
      normalizedCatScore = ((parseFloat(catTheta) + 3) / 6) * 10;
      normalizedCatScore = Math.max(0, Math.min(10, normalizedCatScore));
    }

    if (normalizedCatScore !== null && videoExamScore !== null) {
      return ((normalizedCatScore + videoExamScore) / 2).toFixed(2);
    } else if (normalizedCatScore !== null) {
      return normalizedCatScore.toFixed(2);
    } else if (videoExamScore !== null) {
      return videoExamScore.toFixed(2);
    }
    return null;
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
    setSelectedApps([]);
    setSelectAll(false);
    
    try {
      const res = await fetch(`http://localhost:8000/jobs/${id}/applications`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];

        console.log('📋 Total applications from API:', list.length);

        // Filter to both VIDEO HR and FINAL INTERVIEW stages
        const filtered = list.filter((app) => {
          const stage = (
            app.currentstage || 
            app.current_stage || 
            app.currentStage || 
            ''
          ).toLowerCase().trim();
          return stage === 'video hr' || stage === 'final interview' || stage === 'final_interview';
        });

        console.log('🎥 VIDEO HR + FINAL INTERVIEW candidates:', filtered.length);
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

  // --------------------------------------------------
  // Processed applications with calculated scores and percentiles
  // --------------------------------------------------
  const processedApps = useMemo(() => {
    // Apply stage filter
    let filtered = [...applications];
    
    if (stageFilter !== 'both') {
      filtered = filtered.filter((app) => {
        const stage = (
          app.currentstage || 
          app.current_stage || 
          app.currentStage || 
          ''
        ).toLowerCase().trim();
        
        if (stageFilter === 'video hr') {
          return stage === 'video hr';
        } else if (stageFilter === 'final interview') {
          return stage === 'final interview' || stage === 'final_interview';
        }
        return true;
      });
    }

    // Calculate scores for each application
    const appsWithScores = filtered.map((app) => {
      const videoScore = calculateVideoExamScore(app.id);
      const finalScore = calculateFinalScore(app, videoScore);
      const catTheta = app.cattheta ?? app.cat_theta ?? app.catTheta ?? null;
      
      return {
        ...app,
        videoExamScore: videoScore,
        finalScore: finalScore,
        catTheta: catTheta,
      };
    });

    // Calculate CAT percentile for all users
    const allCatScores = appsWithScores
      .map(app => app.catTheta)
      .filter(score => score !== null && score !== undefined);

    const appsWithPercentiles = appsWithScores.map((app) => ({
      ...app,
      catPercentile: calculatePercentile(app.catTheta, allCatScores),
    }));

    // Sort
    appsWithPercentiles.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'final_score':
          aVal = parseFloat(a.finalScore) || 0;
          bVal = parseFloat(b.finalScore) || 0;
          break;
        case 'video_score':
          aVal = parseFloat(a.videoExamScore) || 0;
          bVal = parseFloat(b.videoExamScore) || 0;
          break;
        case 'cat_theta':
          aVal = parseFloat(a.catTheta) || 0;
          bVal = parseFloat(b.catTheta) || 0;
          break;
        case 'cat_percentile':
          aVal = parseFloat(a.catPercentile) || 0;
          bVal = parseFloat(b.catPercentile) || 0;
          break;
        case 'resume_score':
          aVal = a.resumescore ?? a.resume_score ?? 0;
          bVal = b.resumescore ?? b.resume_score ?? 0;
          break;
        case 'id':
          aVal = a.id || 0;
          bVal = b.id || 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Apply Top N
    return topN > 0 ? appsWithPercentiles.slice(0, topN) : appsWithPercentiles;
  }, [applications, videoResponses, editedResponses, stageFilter, sortBy, sortOrder, topN]);

  // --------------------------------------------------
  // Toggle sort on column click
  // --------------------------------------------------
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // --------------------------------------------------
  // Selection handlers
  // --------------------------------------------------
  const handleSelectChange = (appId, checked) => {
    setSelectedApps((prev) => {
      if (checked) {
        return [...prev, appId];
      } else {
        return prev.filter((id) => id !== appId);
      }
    });
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedApps(processedApps.map((a) => a.id));
    } else {
      setSelectedApps([]);
    }
  };

  // --------------------------------------------------
  // Bulk Status Update Handler
  // --------------------------------------------------
  const handleBulkStatusUpdate = async () => {
    if (selectedApps.length === 0 || !bulkStage) {
      notifications.show({
        title: 'Error',
        message: 'Please select candidates and a stage',
        color: 'red',
      });
      return;
    }

    setBulkUpdating(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('new_status', normalizeStatusForAPI(bulkStage));
      queryParams.append('send_email', bulkSendEmail);
      if (bulkMessage.trim()) {
        queryParams.append('custom_message', bulkMessage.trim());
      }

      const url = `http://localhost:8000/applications/bulk-status-simple?${queryParams.toString()}`;

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedApps),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Update failed');
      }

      notifications.show({
        title: 'Success!',
        message: `Updated ${selectedApps.length} candidate(s) → ${toTitleCase(bulkStage)}`,
        color: 'green',
      });

      setModalOpened(false);
      setBulkStage('');
      setBulkMessage('');
      setBulkSendEmail(true);
      setSelectedApps([]);
      setSelectAll(false);

      fetchApplications();
    } catch (e) {
      notifications.show({
        title: 'Update Failed',
        message: e.message,
        color: 'red',
      });
    } finally {
      setBulkUpdating(false);
    }
  };

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
  // Render sortable header
  // --------------------------------------------------
  const renderSortableHeader = (label, field) => (
    <Table.Th 
      onClick={() => toggleSort(field)} 
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <Group gap={4} wrap="nowrap">
        {label}
        {sortBy === field && (
          sortOrder === 'desc' 
            ? <IconSortDescending size={14} /> 
            : <IconSortAscending size={14} />
        )}
      </Group>
    </Table.Th>
  );

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

  // --------------------------------------------------
  // Table rows with checkbox and expandable feature
  // --------------------------------------------------
  const rows = processedApps.map((app) => {
    const name = app.fullname || app.full_name || app.fullName || '-';
    const email = app.email || '-';
    const stage = app.currentstage || app.current_stage || app.currentStage || '-';
    const isExpanded = expandedRows[app.id] || false;
    const responseCount = (videoResponses[app.id] || []).length;
    const isSelected = selectedApps.includes(app.id);

    return (
      <React.Fragment key={app.id}>
        <Table.Tr 
          style={{ cursor: 'pointer', backgroundColor: isSelected ? '#e7f5ff' : undefined }}
        >
          <Table.Td onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onChange={(e) => handleSelectChange(app.id, e.currentTarget.checked)}
            />
          </Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>
            <ActionIcon variant="subtle" size="sm">
              {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </ActionIcon>
          </Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>{app.id}</Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>{name}</Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>{email}</Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>
            <Badge color={getStageColor(stage)} variant="light">
              {toTitleCase(stage)}
            </Badge>
          </Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>
            {app.catTheta !== null ? (
              <Text fw={600}>{parseFloat(app.catTheta).toFixed(2)}</Text>
            ) : (
              <Text c="dimmed">-</Text>
            )}
          </Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>
            {app.catPercentile !== null ? (
              <Badge color="cyan" variant="light">
                {app.catPercentile}%
              </Badge>
            ) : (
              <Text c="dimmed">-</Text>
            )}
          </Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>
            {app.videoExamScore !== null ? (
              <Badge color={getScoreBadgeColor(app.videoExamScore)} variant="filled">
                {app.videoExamScore}
              </Badge>
            ) : (
              <Text c="dimmed">-</Text>
            )}
          </Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>
            {app.finalScore !== null ? (
              <Badge color={getScoreBadgeColor(app.finalScore)} variant="filled" size="lg">
                {app.finalScore}
              </Badge>
            ) : (
              <Text c="dimmed">-</Text>
            )}
          </Table.Td>
          <Table.Td onClick={() => toggleExpand(app.id)}>
            <Badge color="gray" variant="light">
              {responseCount}
            </Badge>
          </Table.Td>
        </Table.Tr>

        {isExpanded && (
          <Table.Tr>
            <Table.Td colSpan={11} style={{ backgroundColor: '#f8f9fa', padding: 0 }}>
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
      {/* Header */}
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>Video Exam Evaluation</Title>
          <Text size="sm" c="dimmed">
            Job ID: {id} • Showing candidates in{' '}
            <Badge color="blue" variant="light">VIDEO HR</Badge>{' '}
            &{' '}
            <Badge color="green" variant="light">FINAL INTERVIEW</Badge>{' '}
            stages
          </Text>
        </div>

        <Button variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
      </Group>

      {/* Filters Row */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group grow align="flex-end">
          <Select
            label="Filter by Stage"
            data={stageFilterOptions}
            value={stageFilter}
            onChange={setStageFilter}
          />
          <Select
            label="Sort By"
            data={[
              { value: 'final_score', label: 'Final Score' },
              { value: 'video_score', label: 'Video Exam Score' },
              { value: 'cat_theta', label: 'CAT θ' },
              { value: 'cat_percentile', label: 'CAT Percentile' },
              { value: 'resume_score', label: 'Resume Score' },
              { value: 'id', label: 'ID' },
            ]}
            value={sortBy}
            onChange={setSortBy}
          />
          <NumberInput
            label="Top N Candidates"
            min={0}
            value={topN}
            onChange={(value) => setTopN(Number(value) || 0)}
          />
          <Button variant="default" onClick={fetchApplications}>
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStageFilter('both');
              setSortBy('final_score');
              setSortOrder('desc');
              setTopN(10);
              setSelectedApps([]);
              setSelectAll(false);
            }}
          >
            Reset Filters
          </Button>
        </Group>
      </Paper>

      {/* Summary and Bulk Update Button */}
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed">
          Total: {applications.length} | Showing: {processedApps.length} | Selected: {selectedApps.length}
        </Text>
        <Button
          color="blue"
          leftSection={<IconMailForward size={18} />}
          disabled={selectedApps.length === 0}
          onClick={() => setModalOpened(true)}
        >
          Update Selected ({selectedApps.length})
        </Button>
      </Group>

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
          <Alert color="yellow" title="No candidates">
            There are no applications currently in the Video HR or Final Interview stage for this job.
          </Alert>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 40 }}>
                  <Checkbox
                    checked={selectAll}
                    indeterminate={selectedApps.length > 0 && selectedApps.length < processedApps.length}
                    onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                  />
                </Table.Th>
                <Table.Th style={{ width: 40 }}></Table.Th>
                <Table.Th>ID</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Stage</Table.Th>
                {renderSortableHeader('CAT θ', 'cat_theta')}
                {renderSortableHeader('CAT %ile', 'cat_percentile')}
                {renderSortableHeader('Video Score', 'video_score')}
                {renderSortableHeader('Final Score', 'final_score')}
                <Table.Th>Responses</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* MODAL: Bulk Update Status */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setBulkMessage('');
          setBulkStage('');
        }}
        title={`Bulk Update ${selectedApps.length} Application${selectedApps.length > 1 ? 's' : ''}`}
        size="lg"
      >
        <Stack gap="md">
          <Select
            label="New Stage"
            data={stageOptions}
            value={bulkStage}
            onChange={setBulkStage}
            required
            placeholder="Select stage"
          />
          <Textarea
            label="Custom Email Message (Optional)"
            placeholder="Thank you for your interest..."
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.currentTarget.value)}
            minRows={4}
          />
          <Checkbox
            label="Send personalized email to each candidate"
            checked={bulkSendEmail}
            onChange={(e) => setBulkSendEmail(e.currentTarget.checked)}
          />
          
          {bulkStage === 'aptitude' && bulkSendEmail && (
            <Alert color="blue" title="Auto Exam Key">
              Unique 8-character keys will be generated and emailed.
            </Alert>
          )}
          {(bulkStage === 'video hr' || bulkStage === 'video_hr') && bulkSendEmail && (
            <Alert color="blue" title="Video HR Invite">
              Video interview keys will be generated and sent.
            </Alert>
          )}
          {bulkStage === 'final_interview' && bulkSendEmail && (
            <Alert color="green" title="Final Interview">
              Candidates will be notified for the final interview round.
            </Alert>
          )}
          {bulkStage === 'rejected' && bulkSendEmail && (
            <Alert color="red" title="Rejection Notice">
              A rejection email will be sent to the selected candidates.
            </Alert>
          )}
          {(bulkStage === 'offer' || bulkStage === 'hired') && bulkSendEmail && (
            <Alert color="teal" title="Offer/Hired">
              Congratulations email will be sent to selected candidates.
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setModalOpened(false)}>
              Cancel
            </Button>
            <Button
              color="blue"
              loading={bulkUpdating}
              onClick={handleBulkStatusUpdate}
              leftSection={<IconMailForward size={16} />}
              disabled={!bulkStage}
            >
              Update & Notify
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
