import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  Textarea,
  Button,
  Stack,
  Alert,
  Loader,
  Group,
  Stepper,
  NumberInput,
  TagsInput,
  FileInput,
  Grid,
  Select,
} from '@mantine/core';
import { IconCheck, IconAlertCircle, IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DateInput } from '@mantine/dates';

export default function ApplicationCreate() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(0);
  const [resumeFile, setResumeFile] = useState(null);
  const [parsing, setParsing] = useState(false);

  // ===== FIXED: Use 0 or null for public applications (no candidate login required) =====
  const candidateId = parseInt(localStorage.getItem('userId'), 10) || null;
  const [resume_path, set_resume_path] = useState("");

  const [formData, setFormData] = useState({
    job_id: parseInt(jobId, 10),
    candidate_id: candidateId, // Can be null for public applications

    // Personal Info
    full_name: '',
    email: '',
    phone_number: '',
    date_of_birth: null,
    gender: '',
    linkedin_profile: '',
    portfolio_github: '',
    resume_path: '',

    // Education
    highest_qualification: '',
    specialization: '',
    university_college: '',
    year_of_graduation: null,
    academic_score: '',

    // Experience
    total_experience: 0,
    current_company: '',
    previous_companies: [],
    current_role: '',
    key_responsibilities: '',
    achievements: '',
    notice_period: '',
    current_ctc: null,
    expected_ctc: null,

    // Skills
    technical_skills: [],
    soft_skills: [],
    certifications: [],
    projects: [],
    project_technologies: [],
    resume_keywords: [],

    // Other
    employment_type_preference: 'full-time',
    availability_date: null,
    cover_letter: '',
  });

  useEffect(() => {
    fetchJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const response = await fetch(`https://promptly-skill-employer-precisely.trycloudflare.com/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      } else {
        setError('Job not found');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error loading job details');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeUpload = async (file) => {
    if (!file) return;

    setResumeFile(file);
    setParsing(true);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const uploadResponse = await fetch('https://promptly-skill-employer-precisely.trycloudflare.com/upload-to-s3', {
        method: 'POST',
        body: formDataUpload,
      });

      const uploadResult = await uploadResponse.json();
      console.log("S3 upload:", uploadResult);

      // Save the S3 resume path
      set_resume_path(uploadResult.key);

      setFormData((prev) => ({
        ...prev,
        resume_path: uploadResult.key,
      }));




    } catch (err) {
      console.error('Error parsing resume:', err);
      notifications.show({
        title: 'Warning',
        message: 'Could not parse resume automatically. Please fill the form manually.',
        color: 'yellow',
      });
    } finally {
      setParsing(false);
    }
  };

  const nextStep = () => {
    if (active === 0) {
      if (!formData.full_name || !formData.email || !formData.phone_number) {
        setError('Please fill all required personal information fields');
        return;
      }
    } else if (active === 1) {
      if (!formData.highest_qualification) {
        setError('Please provide your highest qualification');
        return;
      }
    } else if (active === 2) {
      const skillsCount = (formData.technical_skills || [])
        .map((s) => (s ?? '').trim())
        .filter(Boolean).length;
      if (skillsCount === 0) {
        setError('Please add at least one technical skill');
        return;
      }
    }

    setError(null);
    setActive((current) => (current < 3 ? current + 1 : current));
  };

  const prevStep = () => {
    setActive((current) => (current > 0 ? current - 1 : current));
    setError(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      // ===== FIXED: Send candidate_id as null if no user is logged in =====
      const submissionData = {
        ...formData,
        job_id: parseInt(jobId, 10),
        resume_path: resume_path,
        candidate_id: candidateId, // Will be null for public applications
        date_of_birth: formData.date_of_birth
          ? new Date(formData.date_of_birth).toISOString().split('T')[0]
          : null,
        availability_date: formData.availability_date
          ? new Date(formData.availability_date).toISOString().split('T')[0]
          : null,
      };

      console.log('Submitting application:', submissionData);

      const response = await fetch('https://promptly-skill-employer-precisely.trycloudflare.com/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }), // Only send token if available
        },
        body: JSON.stringify(submissionData),
      });

      if (response.ok) {
        const data = await response.json();

        notifications.show({
          title: 'Success',
          message: `Application submitted successfully! Your score: ${data.resume_score?.toFixed(1)}%`,
          color: 'green',
          icon: <IconCheck size={16} />,
          autoClose: 5000,
        });

        setTimeout(() => navigate('/candidate/dashboard'), 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to submit application');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (error && !job) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          {error}
        </Alert>
        <Button mt="md" onClick={() => navigate('/jobs')}>
          Back to Jobs
        </Button>
      </Container>
    );
  }

  const skillsInvalid =
    active === 2 &&
    ((formData.technical_skills || []).map((s) => (s ?? '').trim()).filter(Boolean).length === 0);

  return (
    <Container size="lg" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack gap="lg">
          <div>
            <Title order={2}>Apply for Position</Title>
            <Text size="lg" fw={500} mt="xs">
              {job?.title}
            </Text>
            <Text size="sm" c="dimmed">
              {job?.department} • {job?.location}
            </Text>
          </div>

          {error && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Error"
              color="red"
              withCloseButton
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <Stepper
            active={active}
            breakpoint="sm"
            allowNextStepsSelect={false}
          >
            <Stepper.Step label="Personal Info" description="Basic information">
              <Stack gap="md" mt="xl">
                <FileInput
                  label="Upload Resume (Optional but Recommended)"
                  placeholder="Upload PDF or DOCX"
                  leftSection={<IconUpload size={14} />}
                  accept=".pdf,.docx,.doc"
                  value={resumeFile}
                  onChange={handleResumeUpload}
                  disabled={parsing}
                />
                {parsing && <Loader size="sm" />}

                <TextInput
                  required
                  label="Full Name"
                  placeholder="John Doe"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />

                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      required
                      label="Email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      required
                      label="Phone Number"
                      placeholder="+91 9876543210"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    />
                  </Grid.Col>
                </Grid>

                <Grid>
                  <Grid.Col span={6}>
                    <DateInput
                      label="Date of Birth"
                      placeholder="Select date"
                      value={formData.date_of_birth}
                      onChange={(date) => setFormData({ ...formData, date_of_birth: date })}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select
                      label="Gender"
                      placeholder="Select gender"
                      value={formData.gender}
                      onChange={(value) => setFormData({ ...formData, gender: value })}
                      data={[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' },
                        { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                      ]}
                    />
                  </Grid.Col>
                </Grid>

                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="LinkedIn Profile"
                      placeholder="https://linkedin.com/in/johndoe"
                      value={formData.linkedin_profile}
                      onChange={(e) =>
                        setFormData({ ...formData, linkedin_profile: e.target.value })
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Portfolio/GitHub"
                      placeholder="https://github.com/johndoe"
                      value={formData.portfolio_github}
                      onChange={(e) =>
                        setFormData({ ...formData, portfolio_github: e.target.value })
                      }
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="Education" description="Academic background">
              <Stack gap="md" mt="xl">
                <TextInput
                  required
                  label="Highest Qualification"
                  placeholder="B.Tech, M.Tech, MBA, etc."
                  value={formData.highest_qualification}
                  onChange={(e) =>
                    setFormData({ ...formData, highest_qualification: e.target.value })
                  }
                />

                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Specialization"
                      placeholder="Computer Science"
                      value={formData.specialization}
                      onChange={(e) =>
                        setFormData({ ...formData, specialization: e.target.value })
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="University/College"
                      placeholder="ABC University"
                      value={formData.university_college}
                      onChange={(e) =>
                        setFormData({ ...formData, university_college: e.target.value })
                      }
                    />
                  </Grid.Col>
                </Grid>

                <Grid>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Year of Graduation"
                      placeholder="2023"
                      min={1980}
                      max={2030}
                      value={formData.year_of_graduation}
                      onChange={(val) => setFormData({ ...formData, year_of_graduation: val })}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Academic Score"
                      placeholder="8.5 CGPA or 85%"
                      value={formData.academic_score}
                      onChange={(e) =>
                        setFormData({ ...formData, academic_score: e.target.value })
                      }
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="Experience & Skills" description="Professional background">
              <Stack gap="md" mt="xl">
                <NumberInput
                  label="Total Experience (years)"
                  placeholder="0"
                  min={0}
                  max={50}
                  step={0.5}
                  precision={1}
                  value={formData.total_experience}
                  onChange={(val) =>
                    setFormData({
                      ...formData,
                      total_experience: typeof val === 'number' ? val : 0,
                    })
                  }
                />

                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Current Company"
                      placeholder="ABC Corp"
                      value={formData.current_company}
                      onChange={(e) =>
                        setFormData({ ...formData, current_company: e.target.value })
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Current Role"
                      placeholder="Software Engineer"
                      value={formData.current_role}
                      onChange={(e) =>
                        setFormData({ ...formData, current_role: e.target.value })
                      }
                    />
                  </Grid.Col>
                </Grid>

                <TagsInput
                  required
                  label="Technical Skills"
                  placeholder="Type a skill and press Enter"
                  value={formData.technical_skills}
                  onChange={(value) =>
                    setFormData({ ...formData, technical_skills: value || [] })
                  }
                  error={skillsInvalid ? 'Add at least one skill' : null}
                />

                <TagsInput
                  label="Soft Skills"
                  placeholder="Type a skill and press Enter"
                  value={formData.soft_skills}
                  onChange={(value) => setFormData({ ...formData, soft_skills: value || [] })}
                />

                <TagsInput
                  label="Certifications"
                  placeholder="Type certification and press Enter"
                  value={formData.certifications}
                  onChange={(value) =>
                    setFormData({ ...formData, certifications: value || [] })
                  }
                />

                <Textarea
                  label="Key Responsibilities (Current/Previous Role)"
                  placeholder="Describe your main responsibilities..."
                  minRows={3}
                  value={formData.key_responsibilities}
                  onChange={(e) =>
                    setFormData({ ...formData, key_responsibilities: e.target.value })
                  }
                />

                <Grid>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Current CTC (LPA)"
                      placeholder="0"
                      min={0}
                      precision={2}
                      value={formData.current_ctc}
                      onChange={(val) => setFormData({ ...formData, current_ctc: val })}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Expected CTC (LPA)"
                      placeholder="0"
                      min={0}
                      precision={2}
                      value={formData.expected_ctc}
                      onChange={(val) => setFormData({ ...formData, expected_ctc: val })}
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="Final Review" description="Review and submit">
              <Stack gap="md" mt="xl">
                <Textarea
                  label="Cover Letter"
                  placeholder="Explain why you're a good fit for this role..."
                  minRows={4}
                  value={formData.cover_letter}
                  onChange={(e) => setFormData({ ...formData, cover_letter: e.target.value })}
                />

                <Alert color="blue" title="Review Your Application">
                  <Stack gap="xs">
                    <Text size="sm">
                      <strong>Name:</strong> {formData.full_name}
                    </Text>
                    <Text size="sm">
                      <strong>Email:</strong> {formData.email}
                    </Text>
                    <Text size="sm">
                      <strong>Education:</strong>{' '}
                      {formData.highest_qualification || 'Not provided'}
                    </Text>
                    <Text size="sm">
                      <strong>Experience:</strong> {formData.total_experience} years
                    </Text>
                    <Text size="sm">
                      <strong>Skills:</strong> {formData.technical_skills.length} skills added
                    </Text>
                  </Stack>
                </Alert>

                <Alert color="green" title="Scoring Information">
                  <Text size="sm">
                    Your application will be automatically scored based on:
                    • Skills Match (40%)
                    • Experience Match (25%)
                    • Education Match (15%)
                    • Certifications (10%)
                    • Keywords (10%)
                  </Text>
                </Alert>
              </Stack>
            </Stepper.Step>
          </Stepper>

          <Group justify="space-between" mt="xl">
            {active > 0 && (
              <Button variant="default" onClick={prevStep}>
                Back
              </Button>
            )}
            {active < 3 && (
              <Button onClick={nextStep} ml="auto">
                Next
              </Button>
            )}
            {active === 3 && (
              <Button onClick={handleSubmit} loading={submitting} ml="auto">
                Submit Application
              </Button>
            )}
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
}