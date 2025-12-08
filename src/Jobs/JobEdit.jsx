import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, TextInput, Textarea, Select, Button,
  Stack, Group, MultiSelect, Alert, NumberInput, Grid, Tabs, Loader
} from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import api from '../utils/api';

export default function JobEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    job_code: '',
    title: '',
    department: '',
    location: '',
    type: 'full-time',
    experience_level: '',
    num_openings: 1,
    required_skills: [],
    preferred_skills: [],
    education_requirement: '',
    minimum_academic_score: '',
    required_certifications: [],
    tools_technologies: [],
    description: '',
    responsibilities: '',
    key_deliverables: '',
    reporting_to: '',
    keywords: [],
    salary_range_text: '',
    benefits: '',
    status: 'open',
    priority: 'medium',
    hiring_manager: '',
    application_deadline: null
  });

  useEffect(() => {
    fetchJob();
  }, [id]);

  const fetchJob = async () => {
    try {
      const data = await api.get(`/jobs/${id}`);
      setFormData({
        job_code: data.job_code || '',
        title: data.title || '',
        department: data.department || '',
        location: data.location || '',
        type: data.type || 'full-time',
        experience_level: data.experience_level || '',
        num_openings: data.num_openings || 1,
        required_skills: data.required_skills || [],
        preferred_skills: data.preferred_skills || [],
        education_requirement: data.education_requirement || '',
        minimum_academic_score: data.minimum_academic_score || '',
        required_certifications: data.required_certifications || [],
        tools_technologies: data.tools_technologies || [],
        description: data.description || '',
        responsibilities: data.responsibilities || '',
        key_deliverables: data.key_deliverables || '',
        reporting_to: data.reporting_to || '',
        keywords: data.keywords || [],
        salary_range_text: data.salary_range_text || '',
        benefits: data.benefits || '',
        status: data.status || 'open',
        priority: data.priority || 'medium',
        hiring_manager: data.hiring_manager || '',
        application_deadline: data.application_deadline || null
      });
    } catch (error) {
      setError(error.response?.data?.detail || 'Error loading job');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await api.put(`/jobs/${id}`, formData);
      notifications.show({
        title: 'Success',
        message: 'Job updated successfully!',
        color: 'green',
        icon: <IconCheck size={16} />
      });
      setTimeout(() => navigate(`/jobs/${id}`), 1500);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to update job');
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/jobs/${id}`);
      notifications.show({
        title: 'Deleted',
        message: 'Job deleted successfully',
        color: 'red'
      });
      setTimeout(() => navigate('/hr/dashboard'), 1500);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete job');
      console.error('Error:', error);
    }
  };

  const handleArrayInput = (field, value) => {
    setFormData({ ...formData, [field]: value || [] });
  };

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Group position="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Title order={2} mb="xl">Edit Job</Title>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" orientation="vertical">
            <Tabs.List>
              <Tabs.Tab value="basic">Basic Info</Tabs.Tab>
              <Tabs.Tab value="requirements">Requirements</Tabs.Tab>
              <Tabs.Tab value="description">Description</Tabs.Tab>
              <Tabs.Tab value="compensation">Compensation</Tabs.Tab>
              <Tabs.Tab value="posting">Posting Details</Tabs.Tab>
            </Tabs.List>

            {/* BASIC INFO TAB */}
            <Tabs.Panel value="basic" ml="xl">
              <Stack spacing="md">
                <TextInput
                  label="Job Code"
                  placeholder="Auto-generated"
                  value={formData.job_code}
                  disabled
                />

                <TextInput
                  required
                  label="Job Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />

                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <TextInput
                      required
                      label="Location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </Grid.Col>
                </Grid>

                <Grid>
                  <Grid.Col span={6}>
                    <Select
                      required
                      label="Job Type"
                      value={formData.type}
                      onChange={(value) => setFormData({ ...formData, type: value })}
                      data={[
                        { value: 'full-time', label: 'Full Time' },
                        { value: 'part-time', label: 'Part Time' },
                        { value: 'contract', label: 'Contract' },
                        { value: 'internship', label: 'Internship' }
                      ]}
                    />
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Select
                      label="Experience Level"
                      value={formData.experience_level}
                      onChange={(value) => setFormData({ ...formData, experience_level: value })}
                      data={[
                        { value: 'fresher', label: 'Fresher' },
                        { value: '1-3 years', label: '1-3 Years' },
                        { value: '3-5 years', label: '3-5 Years' },
                        { value: '5-8 years', label: '5-8 Years' },
                        { value: '8+ years', label: '8+ Years' }
                      ]}
                    />
                  </Grid.Col>
                </Grid>

                <NumberInput
                  label="Number of Openings"
                  value={formData.num_openings}
                  onChange={(value) => setFormData({ ...formData, num_openings: value || 1 })}
                  min={1}
                  max={100}
                />
              </Stack>
            </Tabs.Panel>

            {/* REQUIREMENTS TAB */}
            <Tabs.Panel value="requirements" ml="xl">
              <Stack spacing="md">
                <MultiSelect
                  label="Required Skills"
                  placeholder="Type and press Enter to add"
                  data={formData.required_skills}
                  searchable
                  creatable
                  getCreateLabel={(query) => `+ Add "${query}"`}
                  onCreate={(query) => {
                    const skill = query.trim();
                    if (skill && !formData.required_skills.includes(skill)) {
                      setFormData({ ...formData, required_skills: [...formData.required_skills, skill] });
                    }
                    return skill;
                  }}
                  value={formData.required_skills}
                  onChange={(value) => handleArrayInput('required_skills', value)}
                />

                <MultiSelect
                  label="Preferred Skills"
                  placeholder="Type and press Enter to add"
                  data={formData.preferred_skills}
                  searchable
                  creatable
                  getCreateLabel={(query) => `+ Add "${query}"`}
                  onCreate={(query) => {
                    const skill = query.trim();
                    if (skill && !formData.preferred_skills.includes(skill)) {
                      setFormData({ ...formData, preferred_skills: [...formData.preferred_skills, skill] });
                    }
                    return skill;
                  }}
                  value={formData.preferred_skills}
                  onChange={(value) => handleArrayInput('preferred_skills', value)}
                />

                <TextInput
                  label="Education Requirement"
                  value={formData.education_requirement}
                  onChange={(e) => setFormData({ ...formData, education_requirement: e.target.value })}
                />

                <TextInput
                  label="Minimum Academic Score"
                  value={formData.minimum_academic_score}
                  onChange={(e) => setFormData({ ...formData, minimum_academic_score: e.target.value })}
                />

                <MultiSelect
                  label="Required Certifications"
                  placeholder="Type and press Enter to add"
                  data={formData.required_certifications}
                  searchable
                  creatable
                  getCreateLabel={(query) => `+ Add "${query}"`}
                  onCreate={(query) => {
                    const cert = query.trim();
                    if (cert && !formData.required_certifications.includes(cert)) {
                      setFormData({ ...formData, required_certifications: [...formData.required_certifications, cert] });
                    }
                    return cert;
                  }}
                  value={formData.required_certifications}
                  onChange={(value) => handleArrayInput('required_certifications', value)}
                />

                <MultiSelect
                  label="Tools & Technologies"
                  placeholder="Type and press Enter to add"
                  data={formData.tools_technologies}
                  searchable
                  creatable
                  getCreateLabel={(query) => `+ Add "${query}"`}
                  onCreate={(query) => {
                    const tool = query.trim();
                    if (tool && !formData.tools_technologies.includes(tool)) {
                      setFormData({ ...formData, tools_technologies: [...formData.tools_technologies, tool] });
                    }
                    return tool;
                  }}
                  value={formData.tools_technologies}
                  onChange={(value) => handleArrayInput('tools_technologies', value)}
                />
              </Stack>
            </Tabs.Panel>

            {/* DESCRIPTION TAB */}
            <Tabs.Panel value="description" ml="xl">
              <Stack spacing="md">
                <Textarea
                  required
                  label="Job Description"
                  minRows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <Textarea
                  label="Responsibilities"
                  minRows={4}
                  value={formData.responsibilities}
                  onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                />

                <Textarea
                  label="Key Deliverables"
                  minRows={3}
                  value={formData.key_deliverables}
                  onChange={(e) => setFormData({ ...formData, key_deliverables: e.target.value })}
                />

                <TextInput
                  label="Reporting To"
                  value={formData.reporting_to}
                  onChange={(e) => setFormData({ ...formData, reporting_to: e.target.value })}
                />

                <MultiSelect
                  label="Keywords"
                  placeholder="Type and press Enter to add"
                  data={formData.keywords}
                  searchable
                  creatable
                  getCreateLabel={(query) => `+ Add "${query}"`}
                  onCreate={(query) => {
                    const keyword = query.toLowerCase().trim();
                    if (keyword && !formData.keywords.includes(keyword)) {
                      setFormData({ ...formData, keywords: [...formData.keywords, keyword] });
                    }
                    return keyword;
                  }}
                  value={formData.keywords}
                  onChange={(value) => handleArrayInput('keywords', value)}
                />
              </Stack>
            </Tabs.Panel>

            {/* COMPENSATION TAB */}
            <Tabs.Panel value="compensation" ml="xl">
              <Stack spacing="md">
                <TextInput
                  label="Salary Range"
                  value={formData.salary_range_text}
                  onChange={(e) => setFormData({ ...formData, salary_range_text: e.target.value })}
                />

                <Textarea
                  label="Benefits"
                  minRows={4}
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                />
              </Stack>
            </Tabs.Panel>

            {/* POSTING DETAILS TAB */}
            <Tabs.Panel value="posting" ml="xl">
              <Stack spacing="md">
                <Select
                  label="Job Status"
                  value={formData.status}
                  onChange={(value) => setFormData({ ...formData, status: value })}
                  data={[
                    { value: 'open', label: 'Open' },
                    { value: 'closed', label: 'Closed' },
                    { value: 'draft', label: 'Draft' }
                  ]}
                />

                <Select
                  label="Priority"
                  value={formData.priority}
                  onChange={(value) => setFormData({ ...formData, priority: value })}
                  data={[
                    { value: 'high', label: 'High' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'low', label: 'Low' }
                  ]}
                />

                <TextInput
                  label="Hiring Manager"
                  value={formData.hiring_manager}
                  onChange={(e) => setFormData({ ...formData, hiring_manager: e.target.value })}
                />
              </Stack>
            </Tabs.Panel>
          </Tabs>

          <Group position="apart" mt="xl">
            <Group>
              <Button variant="subtle" onClick={() => navigate(`/jobs/${id}`)}>
                Cancel
              </Button>
              <Button color="red" variant="outline" onClick={handleDelete}>
                Delete Job
              </Button>
            </Group>
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </Group>
        </form>
      </Paper>
    </Container>
  );
}
