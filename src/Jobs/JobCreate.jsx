import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, TextInput, Textarea, Select, Button,
  Stack, Group, Alert, NumberInput, Grid, Tabs, TagsInput
} from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function JobCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    // Basic Info
    job_code: '',
    title: '',
    department: '',
    location: 'Hyderabad, India',
    type: 'full-time',
    experience_level: '1-3 years',
    num_openings: 1,

    // Requirements
    required_skills: [],
    preferred_skills: [],
    education_requirement: 'B.Tech / B.E.',
    minimum_academic_score: '60',
    required_certifications: [],
    tools_technologies: [],

    // Description
    description: '',
    responsibilities: '',
    key_deliverables: '',
    reporting_to: '',
    keywords: [],

    // Compensation
    salary_range_text: '',
    benefits: '',

    // Posting Details
    status: 'open',
    priority: 'medium',
    hiring_manager: '',
    posted_by: 1,
    application_deadline: null
  });

  const sanitizeTags = (values) =>
    Array.from(new Set((values || []).map((v) => v.trim()).filter(Boolean)));

  const handleArrayInput = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: sanitizeTags(value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.title || !formData.location || !formData.description) {
      setError('Please fill all required fields: Title, Location, and Description');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const payload = {
        ...formData,
        required_skills: formData.required_skills || [],
        preferred_skills: formData.preferred_skills || [],
        required_certifications: formData.required_certifications || [],
        tools_technologies: formData.tools_technologies || [],
        keywords: formData.keywords || []
      };

      const response = await fetch('http://localhost:8000/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        notifications.show({
          title: 'Success',
          message: 'Job posted successfully!',
          color: 'green',
          icon: <IconCheck size={16} />
        });
        setTimeout(() => navigate(`/jobs/${data.id}`), 1500);
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to create job');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      // eslint-disable-next-line no-console
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Title order={2} mb="xl">
          Post New Job
        </Title>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error"
            color="red"
            mb="md"
            withCloseButton
            onClose={() => setError(null)}
          >
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
                  label="Job Code (Optional)"
                  placeholder="e.g., SE001 (auto-generated if left blank)"
                  value={formData.job_code}
                  onChange={(e) => setFormData({ ...formData, job_code: e.target.value })}
                />

                <TextInput
                  required
                  label="Job Title"
                  placeholder="e.g., Senior Software Engineer"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />

                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Department"
                      placeholder="e.g., Engineering"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <TextInput
                      required
                      label="Location"
                      placeholder="e.g., Hyderabad, India"
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
                <TagsInput
                  label="Required Skills"
                  placeholder="Type and press Enter to add skills"
                  value={formData.required_skills}
                  onChange={(value) => handleArrayInput('required_skills', value)}
                />

                <TagsInput
                  label="Preferred Skills"
                  placeholder="Type and press Enter to add skills"
                  value={formData.preferred_skills}
                  onChange={(value) => handleArrayInput('preferred_skills', value)}
                />

                <TextInput
                  label="Education Requirement"
                  placeholder="e.g., B.Tech, M.Tech, MBA"
                  value={formData.education_requirement}
                  onChange={(e) => setFormData({ ...formData, education_requirement: e.target.value })}
                />

                <TextInput
                  label="Minimum Academic Score"
                  placeholder="e.g., 7.0 CGPA or 70%"
                  value={formData.minimum_academic_score}
                  onChange={(e) => setFormData({ ...formData, minimum_academic_score: e.target.value })}
                />

                <TagsInput
                  label="Required Certifications"
                  placeholder="e.g., AWS Certified, PMP"
                  value={formData.required_certifications}
                  onChange={(value) => handleArrayInput('required_certifications', value)}
                />

                <TagsInput
                  label="Tools & Technologies"
                  placeholder="e.g., Docker, Kubernetes, Git"
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
                  placeholder="Describe the role, what the candidate will do..."
                  minRows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <Textarea
                  label="Responsibilities"
                  placeholder="List key responsibilities..."
                  minRows={4}
                  value={formData.responsibilities}
                  onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                />

                <Textarea
                  label="Key Deliverables"
                  placeholder="List expected deliverables..."
                  minRows={3}
                  value={formData.key_deliverables}
                  onChange={(e) => setFormData({ ...formData, key_deliverables: e.target.value })}
                />

                <TextInput
                  label="Reporting To"
                  placeholder="e.g., Engineering Manager"
                  value={formData.reporting_to}
                  onChange={(e) => setFormData({ ...formData, reporting_to: e.target.value })}
                />

                <TagsInput
                  label="Keywords (for matching algorithm)"
                  placeholder="Type and press Enter to add keywords"
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
                  placeholder="e.g., 12-18 LPA or $80K-$120K"
                  value={formData.salary_range_text}
                  onChange={(e) => setFormData({ ...formData, salary_range_text: e.target.value })}
                />

                <Textarea
                  label="Benefits"
                  placeholder="Health Insurance, Stock Options, Flexible Hours, etc."
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
                  placeholder="e.g., John Doe"
                  value={formData.hiring_manager}
                  onChange={(e) => setFormData({ ...formData, hiring_manager: e.target.value })}
                />

                <Alert color="blue" title="Auto-populated">
                  <Stack spacing="xs">
                    <Text size="sm">Posted By: Admin User (ID: 1)</Text>
                    <Text size="sm">Posted At: {new Date().toLocaleDateString()}</Text>
                  </Stack>
                </Alert>
              </Stack>
            </Tabs.Panel>
          </Tabs>

          <Group position="apart" mt="xl">
            <Button variant="subtle" onClick={() => navigate('/jobs')}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Post Job
            </Button>
          </Group>
        </form>
      </Paper>
    </Container>
  );
}
