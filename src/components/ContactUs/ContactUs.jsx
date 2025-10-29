import { IconBrandLinkedin, IconBrandTwitter, IconBrandGithub } from '@tabler/icons-react';
import {
  ActionIcon,
  Button,
  Group,
  SimpleGrid,
  Text,
  Textarea,
  TextInput,
  Title,
  Container,
} from '@mantine/core';
import { ContactIconsList } from './ContactIcon';
import classes from './ContactUs.module.css';

const social = [IconBrandLinkedin, IconBrandTwitter, IconBrandGithub];

export function ContactUs() {
  const icons = social.map((Icon, index) => (
    <ActionIcon key={index} size={32} className={classes.social} variant="transparent">
      <Icon size={24} stroke={1.5} />
    </ActionIcon>
  ));

  return (
    <Container size="lg" className={classes.wrapper}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={50}>
        <div>
          <Title className={classes.title}>Get In Touch</Title>
          <Text className={classes.description} mt="sm" mb={40}>
            Have questions about our AI recruitment platform? Our team is here to help 
            you transform your hiring process. We typically respond within 24 hours.
          </Text>

          <ContactIconsList />

          <Group mt="xl">{icons}</Group>
        </div>

        <div className={classes.form}>
          <TextInput
            label="Work Email"
            placeholder="hr@company.com"
            required
            radius="md"
            size="md"
            classNames={{ input: classes.input, label: classes.inputLabel }}
          />
          <TextInput
            label="Full Name"
            placeholder="Jane Doe"
            mt="md"
            radius="md"
            size="md"
            classNames={{ input: classes.input, label: classes.inputLabel }}
          />
          <TextInput
            label="Company Name"
            placeholder="Your Company"
            mt="md"
            radius="md"
            size="md"
            classNames={{ input: classes.input, label: classes.inputLabel }}
          />
          <Textarea
            required
            label="Message"
            placeholder="Tell us about your hiring needs..."
            minRows={4}
            mt="md"
            radius="md"
            classNames={{ input: classes.input, label: classes.inputLabel }}
          />

          <Group justify="flex-end" mt="lg">
            <Button size="md" className={classes.control} radius="md">
              Send Message
            </Button>
          </Group>
        </div>
      </SimpleGrid>
    </Container>
  );
}
