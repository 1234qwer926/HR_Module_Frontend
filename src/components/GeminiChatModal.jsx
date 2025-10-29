import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  Textarea,
  Box,
  Text,
  Paper,
  Title,
  Loader,
  ScrollArea,
  ActionIcon
} from '@mantine/core';
import { IconMessageChatbot, IconSend } from '@tabler/icons-react';
import axios from 'axios'; // Import axios

function GeminiChatModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const viewport = useRef(null);

  const scrollToBottom = () => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!prompt.trim()) {
      return;
    }

    const userMessage = { sender: 'user', text: prompt };
    setChatHistory(prev => [...prev, userMessage]);
    setPrompt('');
    setIsLoading(true);
    setError('');

    try {
      // --- START OF UPDATE ---
      // Switched to axios and added withCredentials
      const response = await axios.post(
        'http://localhost:8081/api/gemini/ask',
        prompt, // Sending the prompt string directly as the body
        {
          headers: {
            'Content-Type': 'text/plain',
          },
          withCredentials: true,
        }
      );
      // --- END OF UPDATE ---

      const botMessage = { sender: 'bot', text: response.data };
      setChatHistory(prev => [...prev, botMessage]);

    } catch (err) {
      // Updated error handling for axios
      const errorMessage = err.response?.data || err.message || 'An unexpected error occurred.';
      setError(errorMessage);
      const errorBotMessage = { sender: 'bot', text: 'Sorry, I ran into an error. Please try again.' };
      setChatHistory(prev => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (message, index) => (
    <Paper
      key={index}
      p="sm"
      radius="lg"
      withBorder
      mb="sm"
      style={{
        backgroundColor: message.sender === 'user' ? '#e7f5ff' : '#f8f9fa',
        alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
      }}
    >
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{message.text}</Text>
    </Paper>
  );

  return (
    <>
      <ActionIcon
        variant="filled"
        color="blue"
        size="xl"
        radius="xl"
        style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}
        onClick={() => setIsOpen(true)}
      >
        <IconMessageChatbot size={24} />
      </ActionIcon>

      <Modal
        opened={isOpen}
        onClose={() => setIsOpen(false)}
        title={<Title order={4}>Chat with AI Assistant</Title>}
        size="lg"
      >
        <Box style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
          <ScrollArea viewportRef={viewport} style={{ flex: 1, marginBottom: '1rem' }}>
            <Box style={{ display: 'flex', flexDirection: 'column', padding: '0 1rem' }}>
              {chatHistory.map(renderMessage)}
              {isLoading && <Loader size="sm" style={{ alignSelf: 'flex-start' }} />}
            </Box>
          </ScrollArea>
          <Box>
            {error && <Text c="red" size="xs" mb="xs">{error}</Text>}
            <Textarea
              placeholder="Ask me anything..."
              value={prompt}
              onChange={(event) => setPrompt(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage();
                }
              }}
              autosize
              minRows={2}
              rightSection={
                <ActionIcon onClick={handleSendMessage} loading={isLoading} size={32} radius="xl" variant="filled">
                  <IconSend size={18} />
                </ActionIcon>
              }
            />
          </Box>
        </Box>
      </Modal>
    </>
  );
}

export default GeminiChatModal;
