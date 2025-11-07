import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Components
import HeaderSimple from './components/HeaderSimple/HeaderSimple';
import {FooterLinks} from './components/FooterLinks/FooterLinks';
import GeminiChatModal from './components/GeminiChatModal';
import Home from './components/Home/Home';

// Auth
import {AuthenticationForm} from './components/AuthenticationForm/AuthenticationForm';

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

// Dashboard
import HRDashboard from './Dashboard/HRDashboard';

// Video Interview
import VideoQuestionList from './VideoInterview/VideoQuestionList';
import VideoRecorder from './VideoInterview/VideoRecorder';
import VideoReview from './VideoInterview/VideoReview';


import JobApplications from './Jobs/JobApplications';
// import ApplicationDetails from './Applications/ApplicationDetails';

import CATExam from './CAT/CATExam';
import ExamComplete from './CAT/ExamComplete';
import ExamLogin from './CAT/ExamLogin';

function App() {
  return (
    <div>
      <HeaderSimple />
      <Routes>
        {/* ============ PUBLIC ROUTES ============ */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<AuthenticationForm />} />

        {/* ============ JOBS ROUTES ============ */}
        <Route path="/jobs" element={<JobList />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/jobs/create" element={<JobCreate />} />
        <Route path="/jobs/edit/:id" element={<JobEdit />} />

        {/* ============ APPLICATIONS ROUTES ============ */}
        {/* Public application route - anyone can apply */}
        <Route path="/apply/:jobId" element={<ApplicationCreate />} />
        
        {/* Application routes - candidates & HR */}
        <Route path="/applications" element={<ApplicationList />} />
        <Route path="/applications/:id" element={<ApplicationDetails />} />
        
        {/* HR specific applications route */}
        <Route path="/hr/applications" element={<ApplicationList />} />

        {/* ============ CAT (APTITUDE TEST) ROUTES ============ */}
        <Route path="/cat/test/:applicationId" element={<CATTest />} />
        <Route path="/cat/results/:applicationId" element={<CATResults />} />

        {/* ============ DASHBOARD ROUTES ============ */}
        {/* <Route path="/candidate/dashboard" element={<CandidateDashboard />} /> */}
        <Route path="/hr/dashboard" element={<HRDashboard />} />

        {/* ============ VIDEO INTERVIEW ROUTES ============ */}
        <Route path="/video/questions" element={<VideoQuestionList />} />
        <Route path="/video/record/:questionId" element={<VideoRecorder />} />
        <Route path="/video/review/:applicationId" element={<VideoReview />} />

        <Route path="/jobs/:id/applications" element={<JobApplications />} />
        <Route path="/applications/:applicationId" element={<ApplicationDetails />} />

        {/* CAT EXAM */}
         <Route path="/exam/login" element={<ExamLogin />} />
        <Route path="/exam" element={<CATExam />} />
        <Route path="/exam/complete" element={<ExamComplete />} />

        {/* ============ FALLBACK ============ */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
      <FooterLinks />
      <GeminiChatModal />
    </div>
  );
}

export default App;