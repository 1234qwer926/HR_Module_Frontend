import { IconAt, IconMapPin, IconPhone, IconClock } from '@tabler/icons-react';
import { Box, Stack, Text } from '@mantine/core';
import classes from './ContactIcons.module.css';

function ContactIcon({ icon: Icon, title, description, ...others }) {
  return (
    <div className={classes.wrapper} {...others}>
      <Box mr="md">
        <Icon size={24} />
      </Box>

      <div>
        <Text size="xs" className={classes.title}>
          {title}
        </Text>
        <Text className={classes.description}>{description}</Text>
      </div>
    </div>
  );
}

const MOCKDATA = [
  { title: 'Email', description: 'support@recruitai.com', icon: IconAt },
  { title: 'Phone', description: '+91 (800) 555 1234', icon: IconPhone },
  { title: 'Address', description: 'Bangalore, Karnataka, India', icon: IconMapPin },
  { title: 'Support Hours', description: '9 AM – 6 PM IST (Mon-Fri)', icon: IconClock },
];

export function ContactIconsList() {
  const items = MOCKDATA.map((item, index) => <ContactIcon key={index} {...item} />);
  return <Stack>{items}</Stack>;
}
