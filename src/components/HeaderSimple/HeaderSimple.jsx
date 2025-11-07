import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Burger, Container, Group, Button, Drawer, Stack, Divider, Menu } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUser, IconLogout, IconDashboard, IconBriefcase, IconFileText, IconVideo } from '@tabler/icons-react';
import classes from './HeaderSimple.module.css';

export default function HeaderSimple() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { toggle, close }] = useDisclosure(false);
  const [active, setActive] = useState(location.pathname);

  useEffect(() => {
    setActive(location.pathname);
  }, [location.pathname]);

  const handleNavigation = (path) => {
    navigate(path);
    setActive(path);
    close();
  };

  // Public navigation links
  const publicLinks = [
    { link: '/jobs', label: 'Browse Jobs' },
  ];

  // HR-specific links
  const hrLinks = [
    { link: '/hr/dashboard', label: 'Dashboard', icon: IconDashboard },
    { link: '/jobs', label: 'Jobs', icon: IconBriefcase },
    { link: '/applications', label: 'Applications', icon: IconFileText },
    { link: '/video/questions', label: 'Video Questions', icon: IconVideo },
  ];

  // Candidate-specific links
  const candidateLinks = [
    { link: '/candidate/dashboard', label: 'Dashboard', icon: IconDashboard },
    { link: '/jobs', label: 'Browse Jobs', icon: IconBriefcase },
    { link: '/applications', label: 'My Applications', icon: IconFileText },
  ];

  // Default to public links (no role/auth checking)
  const links = publicLinks;

  const items = links.map((link) => (
    <a
      key={link.label}
      href={link.link}
      className={classes.link}
      data-active={active === link.link || undefined}
      onClick={(event) => {
        event.preventDefault();
        handleNavigation(link.link);
      }}
    >
      {link.label}
    </a>
  ));

  // Mobile menu items
  const mobileItems = links.map((link) => {
    const Icon = link.icon;
    return (
      <a
        key={link.label}
        href={link.link}
        className={classes.mobileLink}
        data-active={active === link.link || undefined}
        onClick={(event) => {
          event.preventDefault();
          handleNavigation(link.link);
        }}
      >
        {Icon && <Icon size={18} style={{ marginRight: '8px' }} />}
        {link.label}
      </a>
    );
  });

  return (
    <>
      <header className={classes.header}>
        <Container size="lg" className={classes.inner}>
          <div 
            className={classes.logo}
            onClick={() => handleNavigation('/')}
            style={{ cursor: 'pointer' }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#228BE6"/>
              <path d="M16 8L20 12H18V20H14V12H12L16 8Z" fill="white"/>
              <rect x="10" y="22" width="12" height="2" rx="1" fill="white"/>
            </svg>
            <span className={classes.logoText}>PulseAI</span>
          </div>
          
          {/* Desktop Navigation */}
          <Group gap={5} visibleFrom="sm">
            {items}
          </Group>

          {/* Desktop Auth Buttons */}
          <Group gap="sm" visibleFrom="sm">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => handleNavigation('/login')}
            >
              Login
            </Button>
            <Button 
              size="sm" 
              onClick={() => handleNavigation('/login')}
            >
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
            <span className={classes.drawerLogoText}>PulseAI</span>
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
            onClick={() => handleNavigation('/login')}
          >
            Login
          </Button>
          <Button 
            size="md" 
            fullWidth 
            onClick={() => handleNavigation('/login')}
          >
            Sign Up
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}