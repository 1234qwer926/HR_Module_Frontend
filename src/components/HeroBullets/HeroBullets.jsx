import { IconCheck } from '@tabler/icons-react';
import { Button, Container, Group, Image, List, Text, ThemeIcon, Title } from '@mantine/core';
import classes from './HeroBullets.module.css';

export function HeroBullets() {
  return (
    <Container size="lg" py={80}>
      <div className={classes.inner}>
        <div className={classes.content}>
          <Title className={classes.title}>
            Hire <span className={classes.highlight}>smarter</span> with{' '}
            <span className={classes.highlight}>AI-powered</span> recruitment
          </Title>
          <Text c="dimmed" mt="md" size="lg">
            Transform your hiring process with adaptive testing, AI resume screening, 
            and video interviews. Find the perfect candidates faster than ever.
          </Text>

          <List
            mt={40}
            spacing="md"
            size="md"
            icon={
              <ThemeIcon size={24} radius="xl" color="blue" variant="light">
                <IconCheck size={16} stroke={2.5} />
              </ThemeIcon>
            }
          >
            <List.Item>
              <b>Adaptive CAT Testing</b> – IRT-based 3PL model dynamically adjusts question 
              difficulty based on candidate performance for accurate skill assessment
            </List.Item>
            <List.Item>
              <b>AI Resume Scoring</b> – Automated resume analysis with keyword matching and 
              relevance scoring to identify top candidates instantly
            </List.Item>
            <List.Item>
              <b>Video HR Interviews</b> – Asynchronous video responses with AI sentiment analysis 
              and HR rating system for efficient screening
            </List.Item>
            <List.Item>
              <b>Complete Hiring Pipeline</b> – End-to-end recruitment workflow from job posting 
              to offer letters with automated notifications
            </List.Item>
          </List>

          <Group mt={40}>
            <Button size="lg" radius="md" className={classes.control}>
              Post a Job
            </Button>
            <Button variant="default" size="lg" radius="md" className={classes.control}>
              Browse Jobs
            </Button>
          </Group>
        </div>
        <div className={classes.imageWrapper}>
          <Image 
            src="https://ui.mantine.dev/_next/static/media/image.9a65bd94.svg" 
            className={classes.image}
            alt="Recruitment illustration"
          />
        </div>
      </div>
    </Container>
  );
}
