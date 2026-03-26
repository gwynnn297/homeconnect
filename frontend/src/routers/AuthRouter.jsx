import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from '../pages/Home/HomePage'
import LoginPage from '../pages/Login/LoginPage'
import RegisterPage from '../pages/Register/RegisterPage'
import PrivacyPolicyPage from '../pages/Register/PrivacyPolicyPage'
import TermsofServicePage from '../pages/Register/TermsofServicePage'
import CustomerDashboardPage from '../pages/Customer/CustomerDashboardPage'
import CustomerProfilePage from '../pages/Customer/CustomerProfilePage'
import CustomerWalletPage from '../pages/Customer/CustomerWalletPage'
import HelperDashboardPage from '../pages/Helper/HelperDashboardPage'
import HelperProfilePage from '../pages/Helper/HelperProfilePage'
import HelperNewJobPage from '../pages/Helper/HelperNewJobPage'
import AdminDashboardPage from '../pages/Admin/AdminDashboardPage'
import AdminHelpersPage from '../pages/Admin/AdminHelpersPage'
import AdminHelperDetailPage from '../pages/Admin/AdminHelperDetailPage'
import AdminNotificationsPage from '../pages/Admin/AdminNotificationsPage'
import AdminUsersPage from '../pages/Admin/AdminUsersPage'
import AdminBookingsPage from '../pages/Admin/AdminBookingsPage'
import AdminWalletTransactionsPage from '../pages/Admin/AdminWalletTransactionsPage'
import AdminComplaintsPage from '../pages/Admin/AdminComplaintsPage'
import AdminReportsPage from '../pages/Admin/AdminReportsPage'
import ServiceManagerPage from '../pages/Admin/ServiceManagerPage'
import HelperSchedulePage from '../pages/Helper/HelperSchedulePage'
import ForgotPasswordPage from '../pages/ForgotPassword/ForgotPasswordPage'
import CustomerPostJobPage from '../pages/Customer/CustomerPostJobPage'
import CustomerManagePostsPage from '../pages/Customer/CustomerManagePostsPage'
import CustomerPostDetailPage from '../pages/Customer/CustomerPostDetailPage'

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
        <Route path="/customer/profile" element={<CustomerProfilePage />} />
        <Route path="/customer/wallet" element={<CustomerWalletPage />} />
        <Route path="/helper/dashboard" element={<HelperDashboardPage />} />
        <Route path="/helper/profile" element={<HelperProfilePage />} />
        <Route path="/helper/schedule" element={<HelperSchedulePage />} />
        <Route path="/helper/new-jobs" element={<HelperNewJobPage />} />
        {/* legacy path kept for compatibility */}
        <Route path="/helper-dashboard" element={<HelperDashboardPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/helpers" element={<AdminHelpersPage />} />
        <Route path="/admin/helpers/:helperId" element={<AdminHelperDetailPage />} />
        <Route path="/admin/services" element={<ServiceManagerPage />} />
        <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/bookings" element={<AdminBookingsPage />} />
        <Route path="/admin/wallet-transactions" element={<AdminWalletTransactionsPage />} />
        <Route path="/admin/complaints" element={<AdminComplaintsPage />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="/customer/post-job" element={<CustomerPostJobPage />} />
        <Route path="/customer/manage-posts" element={<CustomerManagePostsPage />} />
        <Route path="/customer/manage-posts/:postId" element={<CustomerPostDetailPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AuthRouter
