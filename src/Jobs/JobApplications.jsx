import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Badge, Button, Stack, Group,
  Divider, Loader, Alert, Table, ScrollArea, Modal, Select, Textarea,
  MultiSelect, Checkbox, ActionIcon, Tooltip, NumberInput
} from '@mantine/core';
import {
  IconAlertCircle, IconArrowLeft, IconUser, IconMail, IconRefresh,
  IconEye, IconMailForward, IconSortAscending, IconSortDescending
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

// Helper: Proper title case in JS
const toTitleCase = (str) => {
  if (!str) return '-';
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

// Map backend/current values to display
const displayStage = (stage) => {
  const map = {
    applied: 'Applied',
    screening: 'Screening',
    aptitude: 'Aptitude',
    'video hr': 'Video HR', // handle space variant from backend
    video_hr: 'Video HR',
    final_interview: 'Final Interview',
    offer: 'Offer',
    hired: 'Hired',
    rejected: 'Rejected',
  };
  return map[stage] || toTitleCase(stage || '');
};

// Normalize UI value to API expected value for simple endpoint
const normalizeStatusForAPI = (s) => {
  if (!s) return '';
  if (s === 'video_hr' || s === 'videohr') return 'video hr';
  return s;
};

export default function JobApplications() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobLoading, setJobLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting
  const [statusFilter, setStatusFilter] = useState([]);
  const [sortBy, setSortBy] = useState('resume_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [topN, setTopN] = useState(10);

  // Bulk selection
  const [selectedApps, setSelectedApps] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Modal
  const [modalOpened, setModalOpened] = useState(false);
  const [bulkStage, setBulkStage] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSendEmail, setBulkSendEmail] = useState(true);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const fetchJob = async () => {
    setJobLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/jobs/${id}`);
      if (res.ok) setJob(await res.json());
    } catch (e) {
      setError('Error loading job');
    } finally {
      setJobLoading(false);
    }
  };

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/jobs/${id}/applications`);
      if (res.ok) {
        const data = await res.json();
        setApplications(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to load applications');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
    fetchApplications();
  }, [id]);

  // Processed applications: filter + sort + top N
  const processedApps = useMemo(() => {
    let filtered = [...applications];

    if (statusFilter.length > 0) {
      filtered = filtered.filter(
        (app) => app.current_stage && statusFilter.includes(app.current_stage)
      );
    }

    filtered.sort((a, b) => {
      let aVal = a[sortBy] ?? 0;
      let bVal = b[sortBy] ?? 0;

      if (typeof aVal === 'string') aVal = bVal = 0;
      if (
        sortBy.includes('score') ||
        sortBy === 'cat_theta' ||
        sortBy === 'cat_percentile'
      ) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else if (sortBy === 'applied_at') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      }

      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return topN > 0 ? filtered.slice(0, topN) : filtered;
  }, [applications, statusFilter, sortBy, sortOrder, topN]);

  // Auto-select top N
  useEffect(() => {
    if (topN > 0 && processedApps.length > 0) {
      setSelectedApps(processedApps.slice(0, topN).map((a) => a.id));
    }
  }, [processedApps, topN]);

  const handleBulkUpdate = async () => {
    if (selectedApps.length === 0 || !bulkStage) {
      notifications.show({
        title: 'Error',
        message: 'Select candidates and stage',
        color: 'red',
      });
      return;
    }

    setBulkUpdating(true);
    try {
      // Build query params for the SIMPLE endpoint: app_ids and new_status as query params
      const params = new URLSearchParams();
      selectedApps.forEach((id) => params.append('app_ids', String(id)));
      params.append('new_status', normalizeStatusForAPI(bulkStage));
      const url = `http://localhost:8000/applications/bulk-status-simple?${params.toString()}`;

      const res = await fetch(url, { method: 'PUT' });

      if (!res.ok) throw new Error((await res.text()) || 'Update failed');

      notifications.show({
        title: 'Success!',
        message: `Updated ${selectedApps.length} applications → ${toTitleCase(bulkStage)}`,
        color: 'green',
      });

      setModalOpened(false);
      fetchApplications();
      setSelectedApps([]);
      setSelectAll(false);
    } catch (e) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' });
    } finally {
      setBulkUpdating(false);
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Keep UI stage options; we normalize only when sending
  const stageOptions = [
    { value: 'applied', label: 'Applied' },
    { value: 'screening', label: 'Screening' },
    { value: 'aptitude', label: 'Aptitude' },
    { value: 'video_hr', label: 'Video HR' }, // will be sent as "video hr"
    { value: 'final_interview', label: 'Final Interview' },
    { value: 'offer', label: 'Offer' },
    { value: 'hired', label: 'Hired' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const sortOptions = [
    { value: 'resume_score', label: 'Resume Score' },
    { value: 'cat_theta', label: 'CAT Theta' },
    { value: 'cat_percentile', label: 'CAT Percentile' },
    { value: 'applied_at', label: 'Applied Date' },
  ];

  return (
    <Container size="xl" py="xl">
      {error && (
        <Alert icon={<IconAlertCircle />} title="Error" color="red" mb="md">
          {error}
        </Alert>
      )}

      <Group justify="space-between" mb="md">
        <Button variant="subtle" leftSection={<IconArrowLeft />} onClick={() => navigate(-1)}>
          Back to Jobs
        </Button>
        <Button variant="light" leftSection={<IconRefresh />} onClick={fetchApplications}>
          Refresh
        </Button>
      </Group>

      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <div>
              <Title order={2}>Applications {job ? `– ${job.title}` : ''}</Title>
              <Text c="dimmed" size="sm">
                Total: {applications.length} | Showing: {processedApps.length} | Selected: {selectedApps.length}
              </Text>
            </div>
            <Button
              color="blue"
              leftSection={<IconMailForward size={18} />}
              disabled={selectedApps.length === 0}
              onClick={() => setModalOpened(true)}
            >
              Update Selected ({selectedApps.length})
            </Button>
          </Group>

          <Group grow>
            <MultiSelect
              label="Filter by Stage"
              data={stageOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All stages"
              clearable
              searchable
            />
            <Select label="Sort By" data={sortOptions} value={sortBy} onChange={setSortBy} />
            <NumberInput
              label="Top N Candidates"
              value={topN}
              onChange={(v) => setTopN(Number(v) || 0)}
              min={0}
              max={500}
              placeholder="All"
            />
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter([]);
                setSortBy('resume_score');
                setSortOrder('desc');
                setTopN(10);
              }}
            >
              Reset Filters
            </Button>
          </Group>

          <Divider />

          {loading ? (
            <Group justify="center" py="xl">
              <Loader size="xl" />
            </Group>
          ) : processedApps.length === 0 ? (
            <Alert color="gray" title="No Applications">
              No applications match your filters.
            </Alert>
          ) : (
            <ScrollArea h={620}>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>
                      <Checkbox
                        checked={selectAll}
                        indeterminate={
                          selectedApps.length > 0 && selectedApps.length < processedApps.length
                        }
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          setSelectAll(checked);
                          setSelectedApps(checked ? processedApps.map((a) => a.id) : []);
                        }}
                      />
                    </Table.Th>
                    <Table.Th
                      onClick={() => toggleSort('full_name')}
                      style={{ cursor: 'pointer' }}
                    >
                      Name{' '}
                      {sortBy === 'full_name' &&
                        (sortOrder === 'desc' ? (
                          <IconSortDescending size={14} />
                        ) : (
                          <IconSortAscending size={14} />
                        ))}
                    </Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Stage</Table.Th>
                    <Table.Th
                      onClick={() => toggleSort('resume_score')}
                      style={{ cursor: 'pointer' }}
                    >
                      Resume Score{' '}
                      {sortBy === 'resume_score' &&
                        (sortOrder === 'desc' ? (
                          <IconSortDescending size={14} />
                        ) : (
                          <IconSortAscending size={14} />
                        ))}
                    </Table.Th>
                    <Table.Th
                      onClick={() => toggleSort('cat_theta')}
                      style={{ cursor: 'pointer' }}
                    >
                      CAT θ{' '}
                      {sortBy === 'cat_theta' &&
                        (sortOrder === 'desc' ? (
                          <IconSortDescending size={14} />
                        ) : (
                          <IconSortAscending size={14} />
                        ))}
                    </Table.Th>
                    <Table.Th>Applied</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {processedApps.map((app) => (
                    <Table.Tr key={app.id}>
                      <Table.Td>
                        <Checkbox
                          checked={selectedApps.includes(app.id)}
                          onChange={(e) => {
                            setSelectedApps((prev) =>
                              e.currentTarget.checked
                                ? [...prev, app.id]
                                : prev.filter((id) => id !== app.id)
                            );
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <IconUser size={16} />
                          <Text fw={500}>{app.full_name || 'N/A'}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <IconMail size={16} />
                          <Text size="sm">{app.email || 'N/A'}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="blue" variant="light">
                          {displayStage(app.current_stage)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          fw={600}
                          c={app.resume_score >= 70 ? 'green' : app.resume_score >= 50 ? 'orange' : 'red'}
                        >
                          {app.resume_score ? app.resume_score.toFixed(1) : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600}>{app.cat_theta ? app.cat_theta.toFixed(2) : '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <Tooltip label="View Full Application">
                            <ActionIcon onClick={() => navigate(`/applications/${app.id}`)}>
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Stack>
      </Paper>

      {/* Bulk Update Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
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
            placeholder="Thank you for your application..."
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
            <Alert color="blue" title="Exam Invite">
              Exam keys will be auto-generated for the selected candidates.
            </Alert>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setModalOpened(false)}>
              Cancel
            </Button>
            <Button
              color="blue"
              loading={bulkUpdating}
              onClick={handleBulkUpdate}
              leftSection={<IconMailForward size={16} />}
            >
              Update
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
