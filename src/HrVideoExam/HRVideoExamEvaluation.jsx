import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    Container,
    Title,
    Card,
    Text,
    Loader,
    Group,
    Stack,
    Badge,
    Button,
    Paper,
    Select,
    Divider,
    Alert,
    NumberInput,
    Textarea,
    SimpleGrid,
    Table,
    ScrollArea,
    ThemeIcon,
    Center,
    Box,
} from "@mantine/core";
import {
    IconAlertCircle,
    IconCircleCheck,
    IconVideo,
    IconEdit,
    IconCheck,
    IconStar,
    IconClockHour4,
    IconUsers,
    IconEye,
    IconTrophy,
    IconArrowLeft,
    IconDeviceFloppy,
} from "@tabler/icons-react";

const API_BASE_URL = "https://ratio-infections-singer-auction.trycloudflare.com";

const HRVideoExamEvaluation = () => {
    // ============================================================
    // STATE MANAGEMENT
    // ============================================================

    // Main Data
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [videoResponses, setVideoResponses] = useState([]);

    // UI States
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [savingScores, setSavingScores] = useState({});
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Evaluation scores (local state before saving)
    const [hrScores, setHrScores] = useState({});
    const [hrFeedbacks, setHrFeedbacks] = useState({});

    // ============================================================
    // DATA FETCHING
    // ============================================================

    useEffect(() => {
        fetchJobs();
    }, []);

    useEffect(() => {
        if (selectedJobId) {
            fetchCandidatesForJob(selectedJobId);
        } else {
            setCandidates([]);
        }
    }, [selectedJobId]);

    const fetchJobs = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/jobs`);
            setJobs(response.data);
        } catch (err) {
            console.error("Error fetching jobs:", err);
            setError("Failed to load jobs");
        }
    };

    const fetchCandidatesForJob = async (jobId) => {
        setLoading(true);
        setError("");

        try {
            const response = await axios.get(
                `${API_BASE_URL}/applications?job_id=${jobId}&limit=100`
            );

            // Filter to only show candidates who have submitted video responses
            const filteredCandidates = response.data.filter(
                (app) => app.video_hr_submitted === true
            );

            // Fetch video responses for each candidate to calculate avg scores
            const candidatesWithScores = await Promise.all(
                filteredCandidates.map(async (candidate) => {
                    try {
                        const responsesRes = await axios.get(
                            `${API_BASE_URL}/applications/${candidate.id}/video-responses`
                        );
                        const responses = responsesRes.data;

                        const avgAiScore =
                            responses.length > 0
                                ? (
                                    responses.reduce(
                                        (sum, r) => sum + (r.ai_score || 0),
                                        0
                                    ) / responses.length
                                ).toFixed(2)
                                : "N/A";

                        const hrScored = responses.filter((r) => r.hr_score !== null);
                        const avgHrScore =
                            hrScored.length > 0
                                ? (
                                    hrScored.reduce(
                                        (sum, r) => sum + r.hr_score,
                                        0
                                    ) / hrScored.length
                                ).toFixed(2)
                                : "N/A";

                        return {
                            ...candidate,
                            avgAiScore,
                            avgHrScore,
                            totalResponses: responses.length,
                            evaluatedCount: hrScored.length,
                        };
                    } catch (err) {
                        console.error(
                            `Error fetching responses for candidate ${candidate.id}:`,
                            err
                        );
                        return {
                            ...candidate,
                            avgAiScore: "N/A",
                            avgHrScore: "N/A",
                            totalResponses: 0,
                            evaluatedCount: 0,
                        };
                    }
                })
            );

            setCandidates(candidatesWithScores);
        } catch (err) {
            console.error("Error fetching candidates:", err);
            setError("Failed to load candidates");
        } finally {
            setLoading(false);
        }
    };

    const fetchCandidateResponses = async (candidateId) => {
        setDetailLoading(true);
        setError("");

        try {
            const response = await axios.get(
                `${API_BASE_URL}/applications/${candidateId}/video-responses`
            );
            setVideoResponses(response.data);

            // Initialize local scores state
            const scores = {};
            const feedbacks = {};
            response.data.forEach((resp) => {
                scores[resp.id] = resp.hr_score || null;
                feedbacks[resp.id] = resp.hr_feedback || "";
            });
            setHrScores(scores);
            setHrFeedbacks(feedbacks);
        } catch (err) {
            console.error("Error fetching responses:", err);
            setError("Failed to load responses");
        } finally {
            setDetailLoading(false);
        }
    };

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    const handleSelectJob = (jobId) => {
        setSelectedJobId(jobId);
        setSelectedCandidate(null);
        setVideoResponses([]);
    };

    const handleSelectCandidate = (candidate) => {
        setSelectedCandidate(candidate);
        fetchCandidateResponses(candidate.id);
    };

    const handleBackToCandidates = () => {
        setSelectedCandidate(null);
        setVideoResponses([]);
        setHrScores({});
        setHrFeedbacks({});
    };

    const handleBackToJobs = () => {
        setSelectedJobId(null);
        setCandidates([]);
        setSelectedCandidate(null);
        setVideoResponses([]);
    };

    const handleSaveEvaluation = async (responseId) => {
        const score = hrScores[responseId];

        if (score === null || score < 0 || score > 10) {
            setError("Please enter a valid score between 0 and 10");
            return;
        }

        setSavingScores((prev) => ({ ...prev, [responseId]: true }));
        setError("");

        try {
            await axios.put(
                `${API_BASE_URL}/video-responses/${responseId}`,
                null,
                {
                    params: {
                        hr_score: score,
                        hr_feedback: hrFeedbacks[responseId] || "",
                        hr_reviewed_by: 1, // TODO: Replace with actual HR user ID
                    },
                }
            );

            setSuccessMessage(`Evaluation for response #${responseId} saved!`);

            // Refresh the responses to show updated data
            await fetchCandidateResponses(selectedCandidate.id);

            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error saving evaluation:", err);
            setError("Failed to save evaluation. Please try again.");
        } finally {
            setSavingScores((prev) => ({ ...prev, [responseId]: false }));
        }
    };

    const handleSaveAllEvaluations = async () => {
        const responsesToSave = videoResponses.filter(
            (resp) =>
                hrScores[resp.id] !== null &&
                hrScores[resp.id] >= 0 &&
                hrScores[resp.id] <= 10
        );

        if (responsesToSave.length === 0) {
            setError("Please enter at least one valid score to save");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await Promise.all(
                responsesToSave.map((resp) =>
                    axios.put(`${API_BASE_URL}/video-responses/${resp.id}`, null, {
                        params: {
                            hr_score: hrScores[resp.id],
                            hr_feedback: hrFeedbacks[resp.id] || "",
                            hr_reviewed_by: 1,
                        },
                    })
                )
            );

            setSuccessMessage(
                `Successfully saved ${responsesToSave.length} evaluation(s)!`
            );

            // Refresh data
            await fetchCandidateResponses(selectedCandidate.id);
            await fetchCandidatesForJob(selectedJobId);

            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            console.error("Error saving evaluations:", err);
            setError("Failed to save some evaluations. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // RENDER: JOB SELECTION
    // ============================================================

    const renderJobSelection = () => (
        <Stack spacing="lg">
            <div>
                <Title order={2}>HR Video Exam Evaluation</Title>
                <Text size="sm" color="dimmed">
                    Select a job to view candidates and evaluate their video responses
                </Text>
            </div>

            <Paper p="xl" radius="md" withBorder>
                <Stack spacing="md">
                    <Text weight={500}>Step 1: Select Job</Text>
                    <Select
                        label="Job Position"
                        placeholder="Choose a job to evaluate candidates"
                        value={selectedJobId}
                        onChange={handleSelectJob}
                        data={jobs.map((job) => ({
                            value: job.id.toString(),
                            label: `${job.title} (${job.department || "N/A"})`,
                        }))}
                        size="md"
                        searchable
                        clearable
                    />
                </Stack>
            </Paper>

            {error && (
                <Alert
                    icon={<IconAlertCircle size={16} />}
                    title="Error"
                    color="red"
                    onClose={() => setError("")}
                    withCloseButton
                >
                    {error}
                </Alert>
            )}
        </Stack>
    );

    // ============================================================
    // RENDER: CANDIDATES TABLE
    // ============================================================

    const renderCandidatesTable = () => {
        const selectedJob = jobs.find((j) => j.id.toString() === selectedJobId);

        return (
            <Stack spacing="lg">
                <Group position="apart">
                    <div>
                        <Title order={2}>{selectedJob?.title || "Job"}</Title>
                        <Text size="sm" color="dimmed">
                            {candidates.length} candidate(s) with video submissions
                        </Text>
                    </div>
                    <Button variant="default" onClick={handleBackToJobs} leftIcon={<IconArrowLeft size={16} />}>
                        Change Job
                    </Button>
                </Group>

                {/* Stats Cards */}
                <SimpleGrid cols={3} spacing="lg" breakpoints={[{ maxWidth: 'md', cols: 1 }]}>
                    <Paper p="md" radius="md" withBorder>
                        <Group position="apart">
                            <div>
                                <Text size="xs" color="dimmed" weight={500}>
                                    Total Candidates
                                </Text>
                                <Text size="xl" weight={700}>
                                    {candidates.length}
                                </Text>
                            </div>
                            <ThemeIcon size={48} radius="md" variant="light" color="blue">
                                <IconUsers size={28} />
                            </ThemeIcon>
                        </Group>
                    </Paper>

                    <Paper p="md" radius="md" withBorder>
                        <Group position="apart">
                            <div>
                                <Text size="xs" color="dimmed" weight={500}>
                                    Fully Evaluated
                                </Text>
                                <Text size="xl" weight={700} color="green">
                                    {
                                        candidates.filter(
                                            (c) => c.evaluatedCount === c.totalResponses
                                        ).length
                                    }
                                </Text>
                            </div>
                            <ThemeIcon size={48} radius="md" variant="light" color="green">
                                <IconCircleCheck size={28} />
                            </ThemeIcon>
                        </Group>
                    </Paper>

                    <Paper p="md" radius="md" withBorder>
                        <Group position="apart">
                            <div>
                                <Text size="xs" color="dimmed" weight={500}>
                                    Pending Review
                                </Text>
                                <Text size="xl" weight={700} color="orange">
                                    {
                                        candidates.filter(
                                            (c) => c.evaluatedCount < c.totalResponses
                                        ).length
                                    }
                                </Text>
                            </div>
                            <ThemeIcon size={48} radius="md" variant="light" color="orange">
                                <IconClockHour4 size={28} />
                            </ThemeIcon>
                        </Group>
                    </Paper>
                </SimpleGrid>

                {error && (
                    <Alert
                        icon={<IconAlertCircle size={16} />}
                        title="Error"
                        color="red"
                        onClose={() => setError("")}
                        withCloseButton
                    >
                        {error}
                    </Alert>
                )}

                {/* Candidates Table */}
                {loading ? (
                    <Center py="xl">
                        <Loader size="lg" />
                    </Center>
                ) : candidates.length === 0 ? (
                    <Paper p="xl" radius="md" withBorder>
                        <Center>
                            <Stack align="center" spacing="md">
                                <IconVideo size={48} color="#adb5bd" />
                                <Text color="dimmed">
                                    No video submissions found for this job
                                </Text>
                            </Stack>
                        </Center>
                    </Paper>
                ) : (
                    <Paper radius="md" withBorder>
                        <ScrollArea>
                            <Table highlightOnHover>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>AI Avg Score</th>
                                        <th>HR Avg Score</th>
                                        <th>Evaluation Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {candidates.map((candidate) => (
                                        <tr key={candidate.id}>
                                            <td>
                                                <Text weight={500}>{candidate.full_name}</Text>
                                            </td>
                                            <td>
                                                <Text size="sm">{candidate.email}</Text>
                                            </td>
                                            <td>
                                                <Badge variant="light" color="violet" size="lg">
                                                    {candidate.avgAiScore}/10
                                                </Badge>
                                            </td>
                                            <td>
                                                <Badge
                                                    variant="light"
                                                    color={candidate.avgHrScore !== "N/A" ? "green" : "gray"}
                                                    size="lg"
                                                >
                                                    {candidate.avgHrScore !== "N/A"
                                                        ? `${candidate.avgHrScore}/10`
                                                        : "Not Evaluated"}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Text size="sm" color="dimmed">
                                                    {candidate.evaluatedCount}/{candidate.totalResponses} Evaluated
                                                </Text>
                                            </td>
                                            <td>
                                                <Button
                                                    size="xs"
                                                    variant="light"
                                                    leftIcon={<IconEye size={16} />}
                                                    onClick={() => handleSelectCandidate(candidate)}
                                                >
                                                    Preview & Evaluate
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </ScrollArea>
                    </Paper>
                )}
            </Stack>
        );
    };

    // ============================================================
    // RENDER: EVALUATION PAGE (All Questions)
    // ============================================================

    const renderEvaluationPage = () => (
        <Stack spacing="lg">
            {/* Header */}
            <Group position="apart">
                <div>
                    <Title order={2}>{selectedCandidate.full_name}</Title>
                    <Text size="sm" color="dimmed">
                        {selectedCandidate.email} • {videoResponses.length} Questions
                    </Text>
                </div>
                <Button
                    variant="default"
                    onClick={handleBackToCandidates}
                    leftIcon={<IconArrowLeft size={16} />}
                >
                    Back to Candidates
                </Button>
            </Group>

            {/* Success/Error Messages */}
            {successMessage && (
                <Alert icon={<IconCircleCheck size={16} />} color="green">
                    {successMessage}
                </Alert>
            )}

            {error && (
                <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                    onClose={() => setError("")}
                    withCloseButton
                >
                    {error}
                </Alert>
            )}

            {/* Loading State */}
            {detailLoading ? (
                <Center py="xl">
                    <Loader size="lg" />
                </Center>
            ) : videoResponses.length === 0 ? (
                <Alert icon={<IconAlertCircle size={16} />} color="blue">
                    No video responses found for this candidate.
                </Alert>
            ) : (
                <>
                    {/* All Questions - Scrollable */}
                    <Stack spacing="xl">
                        {videoResponses.map((response, index) => (
                            <Card key={response.id} shadow="sm" radius="md" withBorder p="lg">
                                <Stack spacing="md">
                                    {/* Question Header */}
                                    <Group position="apart">
                                        <Badge size="lg">Question {index + 1}</Badge>
                                        {response.hr_reviewed ? (
                                            <Badge color="green" size="lg" leftIcon={<IconCheck size={14} />}>
                                                Evaluated
                                            </Badge>
                                        ) : (
                                            <Badge color="orange" size="lg">
                                                Pending
                                            </Badge>
                                        )}
                                    </Group>

                                    <Text weight={500} size="md">
                                        {response.question_text}
                                    </Text>

                                    <Divider />

                                    {/* Video Player */}
                                    <Box>
                                        <Text size="sm" weight={500} mb="xs">
                                            📹 Video Response
                                        </Text>
                                        <div
                                            style={{
                                                backgroundColor: "#000",
                                                borderRadius: "8px",
                                                overflow: "hidden",
                                            }}
                                        >
                                            <video
                                                controls
                                                style={{
                                                    width: "100%",
                                                    maxHeight: "400px",
                                                    objectFit: "contain",
                                                }}
                                                src={`${API_BASE_URL}/${response.video_path}`}
                                            />
                                        </div>
                                        <Text size="xs" color="dimmed" mt="xs">
                                            Duration: {response.duration_seconds}s
                                        </Text>
                                    </Box>

                                    {/* Answer Transcription */}
                                    {response.user_answer_text && (
                                        <Box>
                                            <Text size="sm" weight={500} mb="xs">
                                                💬 Transcription
                                            </Text>
                                            <Paper p="md" radius="md" bg="gray.0">
                                                <Text size="sm">{response.user_answer_text}</Text>
                                            </Paper>
                                        </Box>
                                    )}

                                    {/* AI Score */}
                                    <Paper p="md" radius="md" withBorder bg="violet.0">
                                        <Group position="apart">
                                            <Text size="sm" weight={500}>
                                                🤖 AI Score (Reference)
                                            </Text>
                                            <Badge size="xl" variant="filled" color="violet">
                                                {response.ai_score || "N/A"}/10
                                            </Badge>
                                        </Group>
                                        {response.ai_feedback && (
                                            <Text size="xs" color="dimmed" mt="xs">
                                                {response.ai_feedback}
                                            </Text>
                                        )}
                                    </Paper>

                                    <Divider label="HR Evaluation" labelPosition="center" />

                                    {/* HR Evaluation Form */}
                                    <SimpleGrid cols={2} spacing="md" breakpoints={[{ maxWidth: 'sm', cols: 1 }]}>
                                        <NumberInput
                                            label="HR Score"
                                            description="Enter your score (0-10)"
                                            placeholder="Score"
                                            value={hrScores[response.id]}
                                            onChange={(val) =>
                                                setHrScores((prev) => ({ ...prev, [response.id]: val }))
                                            }
                                            min={0}
                                            max={10}
                                            step={0.5}
                                            precision={1}
                                            size="md"
                                            icon={<IconStar size={16} />}
                                        />
                                        <Button
                                            onClick={() => handleSaveEvaluation(response.id)}
                                            loading={savingScores[response.id]}
                                            leftIcon={<IconDeviceFloppy size={16} />}
                                            size="md"
                                            style={{ alignSelf: 'flex-end' }}
                                        >
                                            Save This Question
                                        </Button>
                                    </SimpleGrid>

                                    <Textarea
                                        label="HR Feedback"
                                        description="Add your detailed comments"
                                        placeholder="Enter feedback..."
                                        value={hrFeedbacks[response.id]}
                                        onChange={(e) =>
                                            setHrFeedbacks((prev) => ({
                                                ...prev,
                                                [response.id]: e.target.value,
                                            }))
                                        }
                                        minRows={3}
                                        maxRows={6}
                                        size="md"
                                    />

                                    {/* Current HR Score Display */}
                                    {response.hr_score !== null && (
                                        <Paper p="md" radius="md" withBorder bg="green.0">
                                            <Group position="apart">
                                                <Text size="sm" weight={500}>
                                                    ✓ Current HR Score
                                                </Text>
                                                <Badge size="lg" color="green">
                                                    {response.hr_score}/10
                                                </Badge>
                                            </Group>
                                            {response.hr_feedback && (
                                                <Text size="xs" color="dimmed" mt="xs">
                                                    {response.hr_feedback}
                                                </Text>
                                            )}
                                        </Paper>
                                    )}
                                </Stack>
                            </Card>
                        ))}
                    </Stack>

                    {/* Save All Button */}
                    <Paper p="lg" radius="md" withBorder bg="blue.0" style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
                        <Group position="apart">
                            <Text weight={500}>
                                Ready to submit all evaluations?
                            </Text>
                            <Button
                                size="lg"
                                onClick={handleSaveAllEvaluations}
                                loading={loading}
                                leftIcon={<IconCircleCheck size={20} />}
                            >
                                Save All Evaluations
                            </Button>
                        </Group>
                    </Paper>
                </>
            )}
        </Stack>
    );

    // ============================================================
    // MAIN RENDER
    // ============================================================

    return (
        <Container size="xl" py="xl">
            {!selectedJobId
                ? renderJobSelection()
                : !selectedCandidate
                    ? renderCandidatesTable()
                    : renderEvaluationPage()}
        </Container>
    );
};

export default HRVideoExamEvaluation;
