import React, { useState, useEffect } from 'react';
import { Container, Grid, Card, Text, Badge, Button, Group, Stack, Title, Loader, TextInput, Alert, Select } from '@mantine/core';
import { IconBriefcase, IconMapPin, IconClock, IconSearch, IconAlertCircle, IconUsers } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterExperience, setFilterExperience] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchJobs();
  }, [filterStatus, filterExperience]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      let url = 'http://localhost:8000/jobs';
      const params = new URLSearchParams();
      
      if (filterStatus && filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      if (filterExperience) {
        params.append('experience_level', filterExperience);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched jobs:', data);
        setJobs(data);
        setError(null);
      } else {
        setError('Failed to load jobs');
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
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

  const getTypeColor = (type) => {
    switch (type) {
      case 'full-time': return 'blue';
      case 'part-time': return 'cyan';
      case 'contract': return 'orange';
      case 'internship': return 'grape';
      default: return 'gray';
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

  const filteredJobs = jobs.filter(job => 
    (job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.keywords?.some(k => k.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center" mt={50}>
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between">
          <Title order={2}>Open Positions</Title>
          <Text c="dimmed">{filteredJobs.length} jobs available</Text>
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
            {error}
          </Alert>
        )}

        {/* FILTERS */}
        <Group gap="md" grow>
          <TextInput
            placeholder="Search by title, department, location, or skills..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="md"
          />

          <Select
            placeholder="Filter by status"
            value={filterStatus}
            onChange={(value) => setFilterStatus(value || 'open')}
            data={[
              { value: 'all', label: 'All Statuses' },
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
              { value: 'draft', label: 'Draft' }
            ]}
            clearable
            searchable
          />

          <Select
            placeholder="Filter by experience"
            value={filterExperience}
            onChange={setFilterExperience}
            data={[
              { value: '', label: 'All Experience Levels' },
              { value: 'fresher', label: 'Fresher' },
              { value: '1-3 years', label: '1-3 Years' },
              { value: '3-5 years', label: '3-5 Years' },
              { value: '5-8 years', label: '5-8 Years' },
              { value: '8+ years', label: '8+ Years' }
            ]}
            clearable
            searchable
          />
        </Group>

        {/* JOBS GRID */}
        <Grid>
          {filteredJobs.map((job) => (
            <Grid.Col key={job.id} span={{ xs: 12, sm: 6, md: 4 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Stack gap="md" style={{ flex: 1 }}>
                  {/* STATUS & PRIORITY BADGES */}
                  <Group justify="space-between">
                    <Badge color={getStatusColor(job.status)} variant="filled" size="sm">
                      {job.status.toUpperCase()}
                    </Badge>
                    <Badge color={getTypeColor(job.type)} variant="light" size="sm">
                      {job.type}
                    </Badge>
                  </Group>

                  {/* JOB TITLE */}
                  <div style={{ flex: 1 }}>
                    <Text fw={600} size="lg" lineClamp={2} onClick={() => navigate(`/jobs/${job.id}`)} style={{ cursor: 'pointer' }}>
                      {job.title}
                    </Text>
                    {job.department && (
                      <Text size="sm" c="dimmed" mt="xs">
                        {job.department}
                      </Text>
                    )}
                  </div>

                  {/* LOCATION & TIME */}
                  <Stack gap="xs">
                    <Group gap="xs">
                      <IconMapPin size={16} />
                      <Text size="sm">{job.location || 'Remote'}</Text>
                    </Group>

                    <Group gap="xs">
                      <IconClock size={16} />
                      <Text size="sm">
                        Posted: {new Date(job.posted_at).toLocaleDateString()}
                      </Text>
                    </Group>

                    {job.num_openings && (
                      <Group gap="xs">
                        <IconUsers size={16} />
                        <Text size="sm">{job.num_openings} Opening(s)</Text>
                      </Group>
                    )}
                  </Stack>

                  {/* EXPERIENCE LEVEL */}
                  {job.experience_level && (
                    <Badge color="orange" variant="light" size="sm" style={{ width: 'fit-content' }}>
                      {job.experience_level}
                    </Badge>
                  )}

                  {/* SALARY */}
                  {job.salary_range_text && (
                    <Group gap="xs">
                      <Text fw={500} size="sm">Salary:</Text>
                      <Text size="sm">{job.salary_range_text}</Text>
                    </Group>
                  )}

                  {/* SKILLS PREVIEW */}
                  {job.required_skills && job.required_skills.length > 0 && (
                    <div>
                      <Text size="xs" fw={500} mb="xs">Key Skills:</Text>
                      <Group gap="xs">
                        {job.required_skills.slice(0, 3).map((skill, index) => (
                          <Badge key={index} size="sm" variant="outline" color="blue">
                            {skill}
                          </Badge>
                        ))}
                        {job.required_skills.length > 3 && (
                          <Badge size="sm" variant="outline">
                            +{job.required_skills.length - 3}
                          </Badge>
                        )}
                      </Group>
                    </div>
                  )}

                  {/* KEYWORDS */}
                  {job.keywords && job.keywords.length > 0 && (
                    <Group gap="xs">
                      {job.keywords.slice(0, 2).map((keyword, index) => (
                        <Badge key={index} size="xs" variant="outline">
                          {keyword}
                        </Badge>
                      ))}
                      {job.keywords.length > 2 && (
                        <Badge size="xs" variant="outline">
                          +{job.keywords.length - 2}
                        </Badge>
                      )}
                    </Group>
                  )}

                  {/* PRIORITY */}
                  {job.priority && (
                    <Badge 
                      color={getPriorityColor(job.priority)} 
                      variant="dot" 
                      size="sm"
                      style={{ width: 'fit-content' }}
                    >
                      {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)} Priority
                    </Badge>
                  )}

                  {/* VIEW DETAILS BUTTON */}
                  <Button
                    fullWidth
                    variant="light"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    mt="auto"
                  >
                    View Details
                  </Button>
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>

        {/* NO JOBS MESSAGE */}
        {filteredJobs.length === 0 && !error && (
          <Text ta="center" c="dimmed" py="xl">
            {jobs.length === 0 
              ? 'No jobs available yet.' 
              : 'No jobs found matching your search.'}
          </Text>
        )}
      </Stack>
    </Container>
  );
}