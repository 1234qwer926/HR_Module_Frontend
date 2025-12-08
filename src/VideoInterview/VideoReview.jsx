import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Button, Stack, Group, Rating,
  Textarea, Badge, Alert, Loader, Divider
} from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function VideoReview() {
  const { applicationId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [videos, setVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [error, setError] = useState(null);

  const [rating, setRating] = useState(3);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    fetchVideos();
  }, [applicationId]);

  const fetchVideos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://100.25.42.222:8000/applications/${applicationId}/video-responses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Video responses:', data);
        setVideos(data);

        if (data.length > 0) {
          setRating(data[0].rating || 3);
          setFeedback(data[0].feedback || '');
        }
      } else {
        console.error('Failed to fetch videos');
      }
    } catch (error) {
      setError('Error loading videos');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const currentVideo = videos[currentVideoIndex];

      const response = await fetch(`http://100.25.42.222:8000/video-responses/${currentVideo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rating,
          feedback,
          reviewed: true
        })
      });

      if (response.ok) {
        notifications.show({
          title: 'Success',
          message: 'Review saved successfully!',
          color: 'green',
          icon: <IconCheck size={16} />
        });

        // Move to next video or finish
        setTimeout(() => {
          if (currentVideoIndex < videos.length - 1) {
            setCurrentVideoIndex(currentVideoIndex + 1);
            const nextVideo = videos[currentVideoIndex + 1];
            setRating(nextVideo.rating || 3);
            setFeedback(nextVideo.feedback || '');
          } else {
            navigate(`/applications/${applicationId}`);
          }
        }, 1000);
      } else {
        setError('Failed to save review');
      }
    } catch (error) {
      setError('Network error');
      console.error('Error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Group position="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (videos.length === 0) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="No videos found" color="yellow">
          This candidate has not submitted video responses yet.
        </Alert>
        <Button mt="md" onClick={() => navigate(`/applications/${applicationId}`)}>
          Back to Application
        </Button>
      </Container>
    );
  }

  const currentVideo = videos[currentVideoIndex];

  return (
    <Container size="md" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack spacing="lg">
          <Group position="apart">
            <Title order={3}>
              Video {currentVideoIndex + 1} of {videos.length}
            </Title>
            <Badge size="lg" color={currentVideo.reviewed ? 'green' : 'yellow'}>
              {currentVideo.reviewed ? 'Reviewed' : 'Pending Review'}
            </Badge>
          </Group>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
              {error}
            </Alert>
          )}

          <Paper p="lg" withBorder>
            <Text size="lg" weight={500} mb="xs">
              Question:
            </Text>
            <Text>
              {currentVideo.question_text || 'Video response'}
            </Text>
          </Paper>

          <Paper p="md" withBorder style={{ backgroundColor: '#000' }}>
            <video
              controls
              style={{ width: '100%', borderRadius: 8 }}
              src={`http://100.25.42.222:8000${currentVideo.video_path}`}
            />
          </Paper>

          <Text size="sm" color="dimmed">
            Duration: {currentVideo.duration_seconds}s |
            Submitted: {new Date(currentVideo.submitted_at).toLocaleString()}
          </Text>

          <Divider />

          <div>
            <Text weight={500} mb="xs">Rating</Text>
            <Rating value={rating} onChange={setRating} size="lg" />
            <Text size="xs" color="dimmed" mt="xs">
              1 = Poor, 5 = Excellent
            </Text>
          </div>

          <Textarea
            label="Feedback"
            placeholder="Provide feedback on this video response..."
            minRows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            description="Share constructive feedback about communication, content, and overall impression"
          />

          <Divider />

          <Group position="apart">
            <Button
              variant="subtle"
              onClick={() => navigate(`/applications/${applicationId}`)}
            >
              Back to Application
            </Button>

            <Group>
              {currentVideoIndex > 0 && (
                <Button
                  variant="light"
                  onClick={() => {
                    setCurrentVideoIndex(currentVideoIndex - 1);
                    const prevVideo = videos[currentVideoIndex - 1];
                    setRating(prevVideo.rating || 3);
                    setFeedback(prevVideo.feedback || '');
                  }}
                >
                  Previous
                </Button>
              )}

              <Button onClick={handleSubmitReview} loading={saving}>
                {currentVideoIndex < videos.length - 1 ? 'Save & Next' : 'Save & Finish'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
}
