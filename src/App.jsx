import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Components
import HeaderSimple from './components/HeaderSimple/HeaderSimple';
import { FooterLinks } from './components/FooterLinks/FooterLinks';
import Home from './components/Home/Home';
import ProtectedRoute from './components/ProtectedRoute';

// Auth
import { AuthenticationForm } from './components/AuthenticationForm/AuthenticationForm';

// Jobs
import JobList from './Jobs/JobList';
import JobDetails from './Jobs/JobDetails';
import JobCreate from './Jobs/JobCreate';
import JobEdit from './Jobs/JobEdit';

// Applications
import ApplicationCreate from './Applications/ApplicationCreate';
import ApplicationDetails from './Applications/ApplicationDetails';
import ApplicationList from './Applications/ApplicationList';

// CAT (Aptitude Test)
import CATTest from './CAT/CATTest';
import CATResults from './CAT/CATResults';

import CATManagement from './CAT/CATManagement';

// Dashboard
import HRDashboard from './Dashboard/HRDashboard';

// Video Interview
import VideoRecorder from './VideoInterview/VideoRecorder';
import VideoReview from './VideoInterview/VideoReview';


import JobApplications from './Jobs/JobApplications';
// import ApplicationDetails from './Applications/ApplicationDetails';

import CATExam from './CAT/CATExam';
import ExamComplete from './CAT/ExamComplete';
import ExamLogin from './CAT/ExamLogin';


import HRVideoExamLogin from './HrVideoExam/HRVideoExamLogin';
import VideoQuestionsManagement from './HrVideoExam/VideoQuestionsManagement';
import HRVideoExamEvaluation from './HrVideoExam/HRVideoExamEvaluation';
import VideoExamEvaluation from './HrVideoExam/VideoExamEvaluation';


function App() {
  return (
    <div>
      <HeaderSimple />
      <Routes>
        {/* ============ PUBLIC ROUTES ============ */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<AuthenticationForm />} />

        {/* ============ JOBS ROUTES ============ */}
        {/* Public - Anyone can view jobs */}
        <Route path="/jobs" element={<JobList />} />
        <Route path="/jobs/:id" element={<JobDetails />} />

        {/* Protected - Admin only */}
        <Route path="/jobs/create" element={
          <ProtectedRoute>
            <JobCreate />
          </ProtectedRoute>
        } />
        <Route path="/jobs/edit/:id" element={
          <ProtectedRoute>
            <JobEdit />
          </ProtectedRoute>
        } />
        <Route path="/jobs/:id/applications" element={
          <ProtectedRoute>
            <JobApplications />
          </ProtectedRoute>
        } />

        {/* ============ APPLICATIONS ROUTES ============ */}
        {/* Public - Anyone can apply */}
        <Route path="/apply/:jobId" element={<ApplicationCreate />} />

        {/* Protected - Admin only */}
        <Route path="/applications" element={
          <ProtectedRoute>
            <ApplicationList />
          </ProtectedRoute>
        } />
        <Route path="/applications/:id" element={
          <ProtectedRoute>
            <ApplicationDetails />
          </ProtectedRoute>
        } />
        <Route path="/applications/:applicationId" element={
          <ProtectedRoute>
            <ApplicationDetails />
          </ProtectedRoute>
        } />

        {/* HR specific applications route */}
        <Route path="/hr/applications" element={
          <ProtectedRoute>
            <ApplicationList />
          </ProtectedRoute>
        } />

        {/* ============ CAT (APTITUDE TEST) ROUTES ============ */}
        {/* Public - Candidates with exam key */}
        <Route path="/exam/login" element={<ExamLogin />} />
        <Route path="/exam" element={<CATExam />} />
        <Route path="/exam/complete" element={<ExamComplete />} />

        {/* Protected - Admin only */}
        <Route path="/cat/test/:applicationId" element={
          <ProtectedRoute>
            <CATTest />
          </ProtectedRoute>
        } />
        <Route path="/cat/results/:applicationId" element={
          <ProtectedRoute>
            <CATResults />
          </ProtectedRoute>
        } />
        <Route path="/cat/management" element={
          <ProtectedRoute>
            <CATManagement />
          </ProtectedRoute>
        } />

        {/* ============ DASHBOARD ROUTES ============ */}
        <Route path="/hr/dashboard" element={
          <ProtectedRoute>
            <HRDashboard />
          </ProtectedRoute>
        } />

        {/* ============ VIDEO INTERVIEW ROUTES ============ */}
        {/* Public - Candidates with exam key */}
        <Route path="/hr-video-exam" element={<HRVideoExamLogin />} />

        {/* Protected - Admin only */}
        <Route path="/video/record/:questionId" element={
          <ProtectedRoute>
            <VideoRecorder />
          </ProtectedRoute>
        } />
        <Route path="/video/review/:applicationId" element={
          <ProtectedRoute>
            <VideoReview />
          </ProtectedRoute>
        } />
        <Route path="/hr-video-exam/questions-management" element={
          <ProtectedRoute>
            <VideoQuestionsManagement />
          </ProtectedRoute>
        } />
        <Route path="/hr-video-exam/evaluation" element={
          <ProtectedRoute>
            <HRVideoExamEvaluation />
          </ProtectedRoute>
        } />
        <Route path="/jobs/:id/video-exam-evaluation" element={
          <ProtectedRoute>
            <VideoExamEvaluation />
          </ProtectedRoute>
        } />

        {/* ============ FALLBACK ============ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FooterLinks />
    </div>
  );
}

export default App;