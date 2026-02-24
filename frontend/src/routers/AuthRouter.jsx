import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from '../pages/Home/HomePage'
import LoginPage from '../pages/Login/LoginPage'
import RegisterPage from '../pages/Register/RegisterPage'
import PrivacyPolicyPage from '../pages/Register/PrivacyPolicyPage'
import TermsofServicePage from '../pages/Register/TermsofServicePage'
import CustomerDashboardPage from '../pages/Customer/CustomerDashboardPage'
import HelperDashboardPage from '../pages/Helper/HelperDashboardPage'
import ForgotPasswordPage from '../pages/ForgotPassword/ForgotPasswordPage'

const AuthRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsofServicePage />} />
        <Route path="/customer-dashboard" element={<CustomerDashboardPage />} />
        <Route path="/helper-dashboard" element={<HelperDashboardPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AuthRouter
