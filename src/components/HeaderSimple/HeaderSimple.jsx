import { useState } from 'react';
import { Burger, Container, Group, Button, Drawer, Stack, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import classes from './HeaderSimple.module.css';

const links = [
  { link: '/jobs', label: 'Browse Jobs' },
  { link: '/employers', label: 'For Employers' },
  { link: '/how-it-works', label: 'How It Works' },
  { link: '/pricing', label: 'Pricing' },
];

export function HeaderSimple() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [active, setActive] = useState(links.link);

  const handleLinkClick = (link) => {
    setActive(link);
    close(); // Close drawer when link is clicked
  };

  const items = links.map((link) => (
    <a
      key={link.label}
      href={link.link}
      className={classes.link}
      data-active={active === link.link || undefined}
      onClick={(event) => {
        event.preventDefault();
        handleLinkClick(link.link);
      }}
    >
      {link.label}
    </a>
  ));

  // Mobile menu items
  const mobileItems = links.map((link) => (
    <a
      key={link.label}
      href={link.link}
      className={classes.mobileLink}
      data-active={active === link.link || undefined}
      onClick={(event) => {
        event.preventDefault();
        handleLinkClick(link.link);
      }}
    >
      {link.label}
    </a>
  ));

  return (
    <>
      <header className={classes.header}>
        <Container size="lg" className={classes.inner}>
          <div className={classes.logo}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#228BE6"/>
              <path d="/" fill="white"/>
              <rect x="10" y="22" width="12" height="2" rx="1" fill="white"/>
            </svg>
            <span className={classes.logoText}>RecruitAI</span>
          </div>
          
          {/* Desktop Navigation */}
          <Group gap={5} visibleFrom="sm">
            {items}
          </Group>

          {/* Desktop Auth Buttons */}
          <Group gap="sm" visibleFrom="sm">
            <Button variant="default" size="sm" component="a" href="/login">
              Login
            </Button>
            <Button size="sm" component="a" href="/register">
              Sign Up
            </Button>
          </Group>

          {/* Mobile Burger */}
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        </Container>
      </header>

      {/* Mobile Drawer Menu */}
      <Drawer
        opened={opened}
        onClose={close}
        size="100%"
        padding="md"
        title={
          <div className={classes.drawerLogo}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#228BE6"/>
              <path d="M16 8L20 12H18V20H14V12H12L16 8Z" fill="white"/>
              <rect x="10" y="22" width="12" height="2" rx="1" fill="white"/>
            </svg>
            <span className={classes.drawerLogoText}>RecruitAI</span>
          </div>
        }
        hiddenFrom="sm"
        zIndex={1000000}
      >
        <Stack gap="md" mt="lg">
          {mobileItems}
          
          <Divider my="md" />
          
          <Button 
            variant="default" 
            size="md" 
            fullWidth 
            component="a" 
            href="/login"
            onClick={close}
          >
            Login
          </Button>
          <Button 
            size="md" 
            fullWidth 
            component="a" 
            href="/register"
            onClick={close}
          >
            Sign Up
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
