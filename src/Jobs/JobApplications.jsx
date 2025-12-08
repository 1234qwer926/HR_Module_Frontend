import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Badge, Button, Stack, Group,
  Divider, Loader, Alert, Table, ScrollArea, Modal, Select, Textarea,
  MultiSelect, Checkbox, ActionIcon, Tooltip, NumberInput, FileInput,
  Progress, Tabs
} from '@mantine/core';
import {
  IconAlertCircle, IconArrowLeft, IconUser, IconMail, IconRefresh,
  IconEye, IconMailForward, IconSortAscending, IconSortDescending,
  IconUpload, IconFileSpreadsheet, IconCheck, IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import api from '../utils/api';


// Helper: Title case
const toTitleCase = (str) => {
  if (!str) return '-';
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};


// Map backend stage → UI display
const displayStage = (stage) => {
  const map = {
    applied: 'Applied',
    screening: 'Screening',
    aptitude: 'Aptitude',
    'video hr': 'Video HR',
    video_hr: 'Video HR',
    final_interview: 'Final Interview',
    offer: 'Offer',
    hired: 'Hired',
    rejected: 'Rejected',
  };
  return map[stage] || toTitleCase(stage || '');
};


// Normalize UI → API (for simple endpoint)
const normalizeStatusForAPI = (s) => {
  if (!s) return '';
  const map = {
    video_hr: 'video hr',
    videohr: 'video hr',
    final_interview: 'final interview',
  };
  return map[s] || s;
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

  // Modal state - Status Update
  const [modalOpened, setModalOpened] = useState(false);
  const [bulkStage, setBulkStage] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSendEmail, setBulkSendEmail] = useState(true);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Modal state - Bulk Upload
  const [uploadModalOpened, setUploadModalOpened] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [uploadTab, setUploadTab] = useState('upload');


  // Fetch job
  const fetchJob = async () => {
    setJobLoading(true);
    try {
      const data = await api.get(`/jobs/${id}`);
      setJob(data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Error loading job');
    } finally {
      setJobLoading(false);
    }
  };


  // Fetch applications
  const fetchApplications = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/jobs/${id}/applications`);
      setApplications(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchJob();
    fetchApplications();
  }, [id]);


  // Processed apps: filter + sort + top N
  const processedApps = useMemo(() => {
    let filtered = [...applications];

    if (statusFilter.length > 0) {
      filtered = filtered.filter(app => app.current_stage && statusFilter.includes(app.current_stage));
    }

    filtered.sort((a, b) => {
      let aVal = a[sortBy] ?? 0;
      let bVal = b[sortBy] ?? 0;

      if (sortBy.includes('score') || sortBy === 'cat_theta' || sortBy === 'cat_percentile') {
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


  // ============================================================
  // HANDLE SELECT/DESELECT - FIXED
  // ============================================================
  const handleSelectChange = (appId, checked) => {
    setSelectedApps(prev => {
      if (checked) {
        return [...prev, appId];
      } else {
        return prev.filter(id => id !== appId);
      }
    });
  };


  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedApps(processedApps.map(a => a.id));
    } else {
      setSelectedApps([]);
    }
  };


  // Auto-select top N
  useEffect(() => {
    if (topN > 0 && processedApps.length > 0) {
      const topIds = processedApps.slice(0, topN).map(a => a.id);
      setSelectedApps(topIds);
      setSelectAll(topIds.length === processedApps.length);
    }
  }, [processedApps, topN]);


  // ============================================================
  // BULK UPDATE HANDLER (Status Update)
  // ============================================================
  const handleBulkUpdate = async () => {
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

      const url = `/applications/bulk-status-simple?${queryParams.toString()}`;
      await api.put(url, selectedApps);

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
        message: e.response?.data?.detail || e.message,
        color: 'red',
      });
    } finally {
      setBulkUpdating(false);
    }
  };


  // ============================================================
  // BULK UPLOAD HANDLER - FIXED WITH JOB_ID IN FORMDATA
  // ============================================================
  const handleBulkUpload = async () => {
    if (!uploadFile) {
      notifications.show({
        title: 'Error',
        message: 'Please select an Excel file',
        color: 'red',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 90));
      }, 500);

      // ✅ No query parameters - job_id in body
      const url = `http://100.25.42.222:8000/applications/bulk-upload?job_id=${id}`;

      const res = await fetch(url, {
        method: 'POST',
        body: formData,  // FormData contains: file + job_id
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }

      const result = await res.json();
      setUploadResults(result);
      setUploadTab('results');

      notifications.show({
        title: 'Upload Complete!',
        message: `✓ ${result.successful} successful | ✗ ${result.failed} failed`,
        color: result.failed === 0 ? 'green' : 'orange',
      });

      // Refresh applications after short delay
      setTimeout(() => {
        fetchApplications();
      }, 1000);
    } catch (e) {
      notifications.show({
        title: 'Upload Failed',
        message: e.message,
        color: 'red',
      });
    } finally {
      setUploading(false);
      setUploadFile(null);
    }
  };


  // Toggle sort
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };


  // Stage options
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

  const sortOptions = [
    { value: 'resume_score', label: 'Resume Score' },
    { value: 'skills_match_score', label: 'Skills Match' },
    { value: 'experience_match_score', label: 'Experience Match' },
    { value: 'education_match_score', label: 'Education Match' },
    { value: 'certification_match_score', label: 'Certification Match' },
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
        <Group gap="sm">
          <Button
            variant="light"
            leftSection={<IconRefresh />}
            onClick={fetchApplications}
          >
            Refresh
          </Button>
          <Button
            color="green"
            leftSection={<IconUpload />}
            onClick={() => {
              setUploadModalOpened(true);
              setUploadTab('upload');
              setUploadResults(null);
            }}
          >
            Bulk Upload
          </Button>
        </Group>
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
                setSelectedApps([]);
                setSelectAll(false);
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
                    <Table.Th style={{ width: '40px' }}>
                      <Checkbox
                        checked={selectAll}
                        indeterminate={selectedApps.length > 0 && selectedApps.length < processedApps.length}
                        onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                      />
                    </Table.Th>
                    <Table.Th onClick={() => toggleSort('full_name')} style={{ cursor: 'pointer' }}>
                      Name{' '}
                      {sortBy === 'full_name' && (sortOrder === 'desc' ? <IconSortDescending size={14} /> : <IconSortAscending size={14} />)}
                    </Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Stage</Table.Th>
                    <Table.Th onClick={() => toggleSort('resume_score')} style={{ cursor: 'pointer' }}>
                      Resume Score{' '}
                      {sortBy === 'resume_score' && (sortOrder === 'desc' ? <IconSortDescending size={14} /> : <IconSortAscending size={14} />)}
                    </Table.Th>
                    <Table.Th onClick={() => toggleSort('cat_theta')} style={{ cursor: 'pointer' }}>
                      CAT θ{' '}
                      {sortBy === 'cat_theta' && (sortOrder === 'desc' ? <IconSortDescending size={14} /> : <IconSortAscending size={14} />)}
                    </Table.Th>
                    <Table.Th>Applied</Table.Th>
                    <Table.Th style={{ width: '80px' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {processedApps && processedApps.length > 0 && processedApps.map((app) => (
                    <Table.Tr key={app.id}>
                      <Table.Td>
                        <Checkbox
                          checked={selectedApps.includes(app.id)}
                          onChange={(e) => handleSelectChange(app.id, e.currentTarget.checked)}
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

      {/* MODAL: Bulk Update Status */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setBulkMessage('');
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
          {bulkStage === 'video_hr' && bulkSendEmail && (
            <Alert color="blue" title="Video HR Invite">
              Video interview keys will be generated and sent.
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
              Update & Notify
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* MODAL: Bulk Upload Applications */}
      <Modal
        opened={uploadModalOpened}
        onClose={() => {
          setUploadModalOpened(false);
          setUploadFile(null);
          setUploadResults(null);
          setUploadProgress(0);
        }}
        title="Bulk Upload Applications"
        size="lg"
      >
        <Tabs value={uploadTab} onTabChange={setUploadTab}>
          <Tabs.List>
            <Tabs.Tab value="upload" leftSection={<IconUpload size={14} />}>
              Upload
            </Tabs.Tab>
            <Tabs.Tab
              value="results"
              leftSection={<IconCheck size={14} />}
              disabled={!uploadResults}
            >
              Results
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="upload" py="md">
            <Stack gap="md">
              <div>
                <Text fw={600} mb="sm">Upload Excel File</Text>
                <Alert
                  icon={<IconFileSpreadsheet />}
                  color="blue"
                  title="Required Columns:"
                  mb="md"
                >
                  <ul style={{ marginTop: 8, marginBottom: 0 }}>
                    <li><strong>full_name</strong> - Candidate name</li>
                    <li><strong>email</strong> - Email address</li>
                    <li><strong>phone_number</strong> - Phone number</li>
                    <li><strong>resume_url</strong> - Google Drive or direct PDF URL</li>
                    <li><em>linkedin_profile</em> - (optional) LinkedIn URL</li>
                    <li><em>portfolio_github</em> - (optional) GitHub/Portfolio URL</li>
                    <li><em>specialization</em> - (optional) Specialization</li>
                  </ul>
                </Alert>
              </div>

              <FileInput
                label="Select Excel File"
                placeholder="Choose .xlsx or .xls file"
                accept=".xlsx,.xls"
                value={uploadFile}
                onChange={setUploadFile}
                icon={<IconFileSpreadsheet />}
              />

              {uploading && (
                <div>
                  <Group justify="space-between" mb={8}>
                    <Text size="sm">Uploading...</Text>
                    <Text size="sm" fw={600}>{uploadProgress}%</Text>
                  </Group>
                  <Progress value={uploadProgress} animated />
                </div>
              )}

              <Group justify="flex-end" mt="md">
                <Button
                  variant="light"
                  onClick={() => setUploadModalOpened(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  color="green"
                  loading={uploading}
                  onClick={handleBulkUpload}
                  disabled={!uploadFile}
                  leftSection={<IconUpload size={16} />}
                >
                  Upload & Score
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="results" py="md">
            {uploadResults && (
              <Stack gap="md">
                <Alert
                  color={uploadResults.failed === 0 ? 'green' : 'orange'}
                  icon={uploadResults.failed === 0 ? <IconCheck /> : <IconAlertCircle />}
                  title={uploadResults.failed === 0 ? 'All Successful!' : 'Completed with Errors'}
                >
                  Total: {uploadResults.total} | ✓ Success: {uploadResults.successful} | ✗ Failed: {uploadResults.failed}
                </Alert>

                {uploadResults.successful > 0 && (
                  <div>
                    <Text fw={600} mb="sm" c="green">
                      ✓ {uploadResults.successful} Successful Uploads
                    </Text>
                    <ScrollArea>
                      <Table striped size="sm" withTableBorder>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Name</Table.Th>
                            <Table.Th>Email</Table.Th>
                            <Table.Th>Resume Score</Table.Th>
                            <Table.Th>Skills</Table.Th>
                            <Table.Th>Experience</Table.Th>
                            <Table.Th>Education</Table.Th>
                            <Table.Th>Certifications</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {uploadResults.successful_uploads.map((app, idx) => (
                            <Table.Tr key={idx}>
                              <Table.Td>
                                <Text size="sm" fw={500}>{app.name}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{app.email}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text
                                  size="sm"
                                  fw={600}
                                  c={app.resume_score >= 70 ? 'green' : app.resume_score >= 50 ? 'orange' : 'red'}
                                >
                                  {app.resume_score.toFixed(0)}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{app.skills_match_score.toFixed(0)}%</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{app.experience_match_score.toFixed(0)}%</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{app.education_match_score.toFixed(0)}%</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{app.certification_match_score.toFixed(0)}%</Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}

                {uploadResults.failed > 0 && (
                  <div>
                    <Text fw={600} mb="sm" c="red">
                      ✗ {uploadResults.failed} Failed Uploads
                    </Text>
                    <Stack gap="xs">
                      {uploadResults.failed_uploads.map((fail, idx) => (
                        <Alert
                          key={idx}
                          icon={<IconX size={16} />}
                          color="red"
                          title={fail.name}
                        >
                          <Text size="sm">{fail.email} - {fail.error}</Text>
                        </Alert>
                      ))}
                    </Stack>
                  </div>
                )}

                <Group justify="flex-end" mt="md">
                  <Button
                    variant="light"
                    onClick={() => {
                      setUploadModalOpened(false);
                      setUploadResults(null);
                      setUploadFile(null);
                    }}
                  >
                    Close
                  </Button>
                </Group>
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </Container>
  );
}
