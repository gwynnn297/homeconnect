import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from '../pages/Home/HomePage'
import LoginPage from '../pages/Login/LoginPage'
import RegisterPage from '../pages/Register/RegisterPage'
import PrivacyPolicyPage from '../pages/Register/PrivacyPolicyPage'
import TermsofServicePage from '../pages/Register/TermsofServicePage'
import CustomerDashboardPage from '../pages/Customer/CustomerDashboardPage'
import CustomerProfilePage from '../pages/Customer/CustomerProfilePage'
import HelperDashboardPage from '../pages/Helper/HelperDashboardPage'
import HelperProfilePage from '../pages/Helper/HelperProfilePage'
import AdminDashboardPage from '../pages/Admin/AdminDashboardPage'
import AdminHelpersPage from '../pages/Admin/AdminHelpersPage'
import AdminHelperDetailPage from '../pages/Admin/AdminHelperDetailPage'
import AdminNotificationsPage from '../pages/Admin/AdminNotificationsPage'
import HelperSchedulePage from '../pages/Helper/HelperSchedulePage'

const AuthRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsofServicePage />} />
        <Route path="/customer-dashboard" element={<CustomerDashboardPage />} />
        <Route path="/customer/profile" element={<CustomerProfilePage />} />
        <Route path="/helper/dashboard" element={<HelperDashboardPage />} />
        <Route path="/helper/profile" element={<HelperProfilePage />} />
        <Route path="/helper/schedule" element={<HelperSchedulePage />} />
        {/* legacy path kept for compatibility */}
        <Route path="/helper-dashboard" element={<HelperDashboardPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/helpers" element={<AdminHelpersPage />} />
        <Route path="/admin/helpers/:helperId" element={<AdminHelperDetailPage />} />
        <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AuthRouter
