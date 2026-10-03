import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import MoleculeDraw from './pages/MoleculeDraw.jsx'
import Home from './pages/Home.jsx'
import TermsPrivacy from './pages/TermsPrivacy.jsx'
import Help from './pages/Help.jsx'
import Tutorial from './pages/Tutorial.jsx'
import Features from './pages/Features.jsx'
import About from './pages/About.jsx'
import Experiments from './pages/Experiments.jsx'
import SavedDocuments from './pages/SavedDocuments.jsx'
import BatchScreening from './pages/BatchScreening.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/draw" element={<MoleculeDraw />} />
          <Route path="/home" element={<Home />} />
          <Route path="/terms" element={<TermsPrivacy />} />
          <Route path="/privacy" element={<TermsPrivacy />} />
          <Route path="/terms-and-privacy" element={<TermsPrivacy />} />
          <Route path="/help" element={<Tutorial />} />
          <Route path="/tutorial" element={<Tutorial />} />
          <Route path="/contact" element={<Help />} />
          <Route path="/features" element={<Features />} />
          <Route path="/about" element={<About />} />
          <Route path="/experiments" element={<Experiments />} />
          <Route path="/documents" element={<SavedDocuments />} />
          <Route path="/batch" element={<BatchScreening />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
