import { useState } from 'react';
import { Routes, Route } from "react-router-dom";
import { FooterLinks } from './components/FooterLinks/FooterLinks';
import { AuthenticationForm } from './components/AuthenticationForm/AuthenticationForm';
import Home from './components/Home/Home';
import FileUploadComponent from './components/FileUpload';
import GeminiChatModal from './components/GeminiChatModal';
import { HeaderSimple } from './components/HeaderSimple/HeaderSimple';



import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      {/* <Router> has been removed from here */}
      {/* <HeaderMegaMenu /> */}
      <HeaderSimple/>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<AuthenticationForm />} />
      </Routes>
      <FooterLinks />
      <GeminiChatModal />
      {/* </Router> has been removed from here */}
    </div>
  );
}

export default App;
