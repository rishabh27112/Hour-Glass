import React from 'react'
import { Routes, Route } from 'react-router-dom';

// import pages
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage'

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage  />} />
      <Route path="/signin" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    </Routes>
  )
}

export default App