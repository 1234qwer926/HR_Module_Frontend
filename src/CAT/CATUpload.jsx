// CATUpload.jsx
import React, { useState } from "react";
import axios from "axios";
import { Button, FileInput, Text, Stack, Title } from "@mantine/core";

const CATUpload = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select an Excel file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file); // must match FastAPI param name

    try {
      setLoading(true);
      setMessage(null);

      const res = await axios.post(
        "http://localhost:8000/cat/upload-questions",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setMessage(res.data?.message || "Upload successful.");
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to upload file.";
      setMessage(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack w={400}>
      <Title order={3}>Upload CAT Questions</Title>

      <FileInput
        label="Excel file"
        placeholder="Select .xlsx or .xls"
        accept=".xlsx,.xls"
        value={file}
        onChange={(f) => {
          setFile(f);
          setMessage(null);
        }}
      />

      <Button onClick={handleUpload} loading={loading} disabled={!file}>
        Upload
      </Button>

      {file && (
        <Text size="sm" c="dimmed">
          Selected: {file.name}
        </Text>
      )}

      {message && (
        <Text size="sm" c={message.startsWith("Successfully") ? "green" : "red"}>
          {message}
        </Text>
      )}
    </Stack>
  );
};

export default CATUpload;
