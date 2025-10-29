import { 
  IconBrain, 
  IconChartLine, 
  IconRobot, 
  IconVideo, 
  IconFileAnalytics, 
  IconClock 
} from '@tabler/icons-react';
import { Button, Container, Grid, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core';
import classes from './FeaturesTitle.module.css';

const features = [
  {
    icon: IconBrain,
    title: 'Adaptive CAT Testing',
    description:
      'Item Response Theory 3PL model dynamically adjusts difficulty for precise candidate assessment',
  },
  {
    icon: IconRobot,
    title: 'AI Resume Screening',
    description: 
      'Automated parsing and scoring with keyword matching to filter top candidates instantly',
  },
  {
    icon: IconVideo,
    title: 'Video HR Interviews',
    description:
      'Asynchronous video responses with customizable questions and AI-powered sentiment analysis',
  },
  {
    icon: IconFileAnalytics,
    title: 'Real-time Analytics',
    description:
      'Comprehensive dashboards with theta scores, percentiles, and application stage tracking',
  },
  {
    icon: IconChartLine,
    title: 'Performance Insights',
    description:
      'Detailed CAT response analysis with accuracy metrics and difficulty progression',
  },
  {
    icon: IconClock,
    title: 'Workflow Automation',
    description:
      'Automated email notifications, stage transitions, and offer letter generation',
  },
];

export function FeaturesTitle() {
  const items = features.map((feature) => (
    <div key={feature.title}>
      <ThemeIcon
        size={50}
        radius="md"
        variant="gradient"
        gradient={{ deg: 133, from: 'blue', to: 'cyan' }}
      >
        <feature.icon size={28} stroke={1.5} />
      </ThemeIcon>

      <Text fz="lg" mt="md" fw={600}>
        {feature.title}
      </Text>

      <Text c="dimmed" fz="sm" mt="xs">
        {feature.description}
      </Text>
    </div>
  ));

  return (
    <Container size="lg" className={classes.wrapper}>
      <Grid gutter={60}>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Title className={classes.title} order={2}>
            AI-Powered Recruitment Platform Built for Modern Hiring
          </Title>

          <Text c="dimmed" size="md" mt="md">
            Streamline your entire hiring pipeline with intelligent automation. 
            From resume screening to final interviews, our platform uses cutting-edge 
            AI to identify the best candidates while saving you time and resources.
          </Text>

          <Button
            variant="gradient"
            gradient={{ deg: 133, from: 'blue', to: 'cyan' }}
            size="lg"
            radius="md"
            mt="xl"
          >
            Start Hiring
          </Button>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={30}>
            {items}
          </SimpleGrid>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
