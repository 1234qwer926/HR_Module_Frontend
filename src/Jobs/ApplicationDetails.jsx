// src/pages/ApplicationDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Group, Stack, Badge, Divider, Loader, Alert, Grid, Anchor, Button
} from '@mantine/core';
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';

export default function ApplicationDetails() {
  const { applicationId } = useParams();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`http://localhost:8000/applications/${applicationId}`);
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || 'Failed to load application');
        }
        const data = await res.json();
        setApplication(data);
      } catch (e) {
        setErr(e.message || 'Error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [applicationId]);

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Group justify="center"><Loader size="lg" /></Group>
      </Container>
    );
  }

  if (err || !application) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
          {err || 'Application not found'}
        </Alert>
        <Button variant="subtle" onClick={() => navigate(-1)} leftSection={<IconArrowLeft size={16} />}>
          Back
        </Button>
      </Container>
    );
  }

  const a = application;

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="md">
        <Button variant="subtle" onClick={() => navigate(-1)} leftSection={<IconArrowLeft size={16} />}>
          Back
        </Button>
      </Group>

      <Paper p="xl" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Title order={2}>{a.full_name || a.name || 'Applicant'}</Title>
              <Text c="dimmed" size="sm">
                Application ID: {a.id} {a.job_id ? `• Job ID: ${a.job_id}` : ''}
              </Text>
            </div>
            <Badge variant="filled">{String(a.status || a.current_stage || 'SUBMITTED').toUpperCase()}</Badge>
          </Group>

          <Divider />

          <Title order={4}>Contact</Title>
          <Grid>
            <Grid.Col span={6}><Text>Email: {a.email || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Phone: {a.phone_number || a.phone || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>DOB: {a.date_of_birth || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Gender: {a.gender || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>LinkedIn: {a.linkedin_profile ? <Anchor href={a.linkedin_profile} target="_blank">Open</Anchor> : '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Portfolio/GitHub: {a.portfolio_github ? <Anchor href={a.portfolio_github} target="_blank">Open</Anchor> : '-'}</Text></Grid.Col>
          </Grid>

          <Divider />

          <Title order={4}>Education & Experience</Title>
          <Grid>
            <Grid.Col span={6}><Text>Highest Qualification: {a.highest_qualification || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Specialization: {a.specialization || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>College/University: {a.university_college || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Graduation Year: {a.year_of_graduation ?? '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Total Experience (yrs): {a.total_experience ?? '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Current Role: {a.current_role || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Current Company: {a.current_company || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Notice Period: {a.notice_period || '-'}</Text></Grid.Col>
          </Grid>

          <Divider />

          <Title order={4}>Compensation</Title>
          <Grid>
            <Grid.Col span={6}><Text>Current CTC: {a.current_ctc ?? '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Expected CTC: {a.expected_ctc ?? '-'}</Text></Grid.Col>
          </Grid>

          <Divider />

          <Title order={4}>Skills & Certifications</Title>
          <Text>Technical Skills: {Array.isArray(a.technical_skills) ? a.technical_skills.join(', ') : '-'}</Text>
          <Text>Soft Skills: {Array.isArray(a.soft_skills) ? a.soft_skills.join(', ') : '-'}</Text>
          <Text>Certifications: {Array.isArray(a.certifications) ? a.certifications.join(', ') : '-'}</Text>

          <Divider />

          <Title order={4}>Assessment & Scores</Title>
          <Grid>
            <Grid.Col span={6}><Text>Resume Score: {a.resume_score ?? '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Skills Match: {a.skills_match_score ?? '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Experience Match: {a.experience_match_score ?? '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Education Score: {a.education_match_score ?? '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Certification Score: {a.certification_match_score ?? '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>CAT Completed: {a.cat_completed ? 'Yes' : 'No'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Video Submitted: {a.video_hr_submitted ? 'Yes' : 'No'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>CAT Percentile: {a.cat_percentile ?? '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>CAT Theta: {a.cat_theta ?? '-'}</Text></Grid.Col>
          </Grid>

          <Divider />

          <Title order={4}>Application Meta</Title>
          <Grid>
            <Grid.Col span={6}><Text>Current Stage: {a.current_stage || '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Applied At: {a.applied_at ? new Date(a.applied_at).toLocaleString() : '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Updated At: {a.updated_at ? new Date(a.updated_at).toLocaleString() : '-'}</Text></Grid.Col>
            <Grid.Col span={6}><Text>Resume File: {a.resume_path ? <Anchor href={a.resume_path} target="_blank" rel="noreferrer">Download</Anchor> : '-'}</Text></Grid.Col>
          </Grid>

          {a.cover_letter && (
            <>
              <Divider />
              <Title order={4}>Cover Letter</Title>
              <Text style={{ whiteSpace: 'pre-wrap' }}>{a.cover_letter}</Text>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
