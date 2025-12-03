import {
  IconBrandLinkedin,
  IconBrandTwitter,
  IconBrandGithub,
} from "@tabler/icons-react";
import { ActionIcon, Container, Group, Text } from "@mantine/core";
import { useLocation, useNavigate } from "react-router-dom";
import classes from "./FooterLinks.module.css";

const data = [
  {
    title: "For Candidates",
    links: [
      { label: "Browse Jobs", link: "/jobs" },
      { label: "How It Works", link: "/candidate-guide" },
      { label: "Practice Tests", link: "/practice" },
      { label: "Career Resources", link: "/resources" },
    ],
  },
  {
    title: "For Employers",
    links: [
      { label: "Post a Job", link: "/post-job" },
      { label: "Pricing Plans", link: "/pricing" },
      { label: "HR Dashboard", link: "/hr/dashboard" },
      { label: "API Documentation", link: "/api-docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", link: "/about" },
      { label: "Contact", link: "/contact" },
      { label: "Privacy Policy", link: "/privacy" },
      { label: "Terms of Service", link: "/terms" },
    ],
  },
];

export function FooterLinks() {
  const location = useLocation();
  const navigate = useNavigate();

  // Paths where footer must be hidden (same as header)
  const hideFooterPaths = [
    "/exam/login",
    "/exam",
    "/exam/complete",
    "/hr-video-exam",
  ];

  // If current path is in hideFooterPaths, render nothing
  if (hideFooterPaths.includes(location.pathname)) {
    return null;
  }

  const groups = data.map((group) => {
    const links = group.links.map((link, index) => (
      <Text
        key={index}
        className={classes.link}
        component="a"
        href={link.link}
        onClick={(event) => {
          event.preventDefault();
          navigate(link.link);
        }}
      >
        {link.label}
      </Text>
    ));

    return (
      <div className={classes.wrapper} key={group.title}>
        <Text className={classes.title}>{group.title}</Text>
        {links}
      </div>
    );
  });

  return (
    <footer className={classes.footer}>
      <Container className={classes.inner} size="lg">
        <div className={classes.logo}>
          <div className={classes.logoContainer}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#228BE6" />
              <path d="M16 8L20 12H18V20H14V12H12L16 8Z" fill="white" />
              <rect x="10" y="22" width="12" height="2" rx="1" fill="white" />
            </svg>
            <Text size="xl" fw={700} className={classes.logoText}>
              PulseAI
            </Text>
          </div>
          <Text size="sm" c="dimmed" className={classes.description}>
            AI-powered recruitment platform streamlining hiring with adaptive
            testing, resume screening, and video interviews. Hire smarter, hire
            faster.
          </Text>
        </div>
        <div className={classes.groups}>{groups}</div>
      </Container>
      <Container className={classes.afterFooter} size="lg">
        <Text c="dimmed" size="sm">
          © 2025 PulseAI. All rights reserved.
        </Text>

        <Group
          gap={8}
          className={classes.social}
          justify="flex-end"
          wrap="nowrap"
        >
          <ActionIcon size="lg" color="gray" variant="subtle" radius="md">
            <IconBrandLinkedin size={20} stroke={1.5} />
          </ActionIcon>
          <ActionIcon size="lg" color="gray" variant="subtle" radius="md">
            <IconBrandTwitter size={20} stroke={1.5} />
          </ActionIcon>
          <ActionIcon size="lg" color="gray" variant="subtle" radius="md">
            <IconBrandGithub size={20} stroke={1.5} />
          </ActionIcon>
        </Group>
      </Container>
    </footer>
  );
}
