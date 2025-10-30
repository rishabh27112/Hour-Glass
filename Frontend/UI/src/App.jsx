import React from 'react'
import { Routes, Route } from 'react-router-dom';

// import pages
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signin" element={<LoginPage />} />
    </Routes>
  )
}

export default App