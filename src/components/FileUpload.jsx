import React, { useState } from 'react';
import { Button, FileInput, TextInput, Box, Text, Group, Paper, Title } from '@mantine/core';
import { IconUpload, IconLink } from '@tabler/icons-react';
import axios from 'axios'; // Import axios
import GeminiChatModal from './GeminiChatModal';

function FileUploadComponent() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileKey, setFileKey] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [presignedUrl, setPresignedUrl] = useState('');

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatusMessage('Please select a file first.');
      return;
    }

    setIsUploading(true);
    setStatusMessage(`Uploading ${selectedFile.name}...`);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // --- START OF UPDATE 1 ---
      // Switched to axios and added withCredentials
      const response = await axios.post('http://localhost:8081/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true,
      });
      // --- END OF UPDATE 1 ---

      const key = response.data;
      setStatusMessage(`Upload successful! File key: ${key}`);
      setFileKey(key);
    } catch (error) {
      const errorMessage = error.response?.data || error.message || 'Upload failed.';
      setStatusMessage(`Error: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateUrl = async () => {
    if (!fileKey) {
      setStatusMessage('Please upload a file or enter a key first.');
      return;
    }

    setStatusMessage(`Generating URL for key: ${fileKey}...`);
    try {
      // --- START OF UPDATE 2 ---
      // Switched to axios and added withCredentials
      const response = await axios.get(`http://localhost:8081/generate-presigned-url/${fileKey}`, {
        withCredentials: true,
      });
      // --- END OF UPDATE 2 ---

      const url = response.data;
      setPresignedUrl(url);
      setStatusMessage('URL generated successfully!');
    } catch (error) {
      const errorMessage = error.response?.data || error.message || 'Failed to generate URL.';
      setStatusMessage(`Error: ${errorMessage}`);
    }
  };

  return (
    <Paper shadow="md" p="xl" withBorder>
      <Box maw={600} mx="auto">
        <Title order={2} ta="center" mb="lg">S3 File URL Generator</Title>

        {/* Upload Section */}
        <Box mb="xl">
          <Title order={4} mb="sm">1. Upload a File</Title>
          <Group>
            <FileInput
              placeholder="Select a file (video, PDF, etc.)"
              value={selectedFile}
              onChange={setSelectedFile}
              style={{ flex: 1 }}
              clearable
            />
            <Button onClick={handleUpload} leftSection={<IconUpload size={14} />} loading={isUploading} disabled={!selectedFile}>
              Upload
            </Button>
          </Group>
        </Box>

        {/* Generate URL Section */}
        <Box>
          <Title order={4} mb="sm">2. Generate URL</Title>
          <Group>
            <TextInput
              placeholder="File key will appear here after upload"
              value={fileKey}
              onChange={(event) => setFileKey(event.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={handleGenerateUrl} leftSection={<IconLink size={14} />} disabled={!fileKey}>
              Get URL
            </Button>
          </Group>
        </Box>

        {/* Status and URL Display */}
        <Box mt="lg">
          {statusMessage && <Text c="dimmed" ta="center">{statusMessage}</Text>}
          {presignedUrl && (
            <Box mt="sm">
              <Text fw={500}>Shareable URL (valid for 10 minutes):</Text>
              <Text c="blue" component="a" href={presignedUrl} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
                {presignedUrl}
              </Text>
            </Box>
          )}
        </Box>
      </Box>
      <GeminiChatModal />
    </Paper>
  );
}

export default FileUploadComponent;
