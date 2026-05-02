import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AccountBlockedGate from '../components/AccountBlockedGate'
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
import AdminUserDetailPage from '../pages/Admin/AdminUserDetailPage'
import AdminBookingsPage from '../pages/Admin/AdminBookingsPage'
import AdminBookingDetailPage from '../pages/Admin/AdminBookingDetailPage'
import AdminFraudAlertsPage from '../pages/Admin/AdminFraudAlertsPage'
import AdminJobPostsPage from '../pages/Admin/AdminJobPostsPage'
import AdminJobPostDetailPage from '../pages/Admin/AdminJobPostDetailPage'
import AdminWalletTransactionsPage from '../pages/Admin/AdminWalletTransactionsPage'
import AdminComplaintsPage from '../pages/Admin/AdminComplaintsPage'
import AdminReportsPage from '../pages/Admin/AdminReportsPage'
import ServiceManagerPage from '../pages/Admin/ServiceManagerPage'
import AdminWithdrawalsPage from '../pages/Admin/AdminWithdrawalsPage'
import HelperSchedulePage from '../pages/Helper/HelperSchedulePage'
import HelperWalletPage from '../pages/Helper/HelperWalletPage'
import HelperReviewsPage from '../pages/Helper/HelperReviewsPage'
import ForgotPasswordPage from '../pages/ForgotPassword/ForgotPasswordPage'
import CustomerPostJobPage from '../pages/Customer/CustomerPostJobPage'
import CustomerManagePostsPage from '../pages/Customer/CustomerManagePostsPage'
import CustomerPostDetailPage from '../pages/Customer/CustomerPostDetailPage'
import CustomerBookingDetailPage from '../pages/Customer/CustomerBookingDetailPage'
import HistoryBookingPage from '../pages/Customer/HistoryBookingPage'
import SearchHelperPage from '../pages/Customer/SearchHelperPage'

const AuthRouter = () => {
  return (
    <BrowserRouter>
      <AccountBlockedGate />
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
        <Route path="/helper/checkin" element={<Navigate to="/helper/new-jobs" replace />} />
        <Route path="/helper/schedule" element={<HelperSchedulePage />} />
        <Route path="/helper/new-jobs" element={<HelperNewJobPage />} />
        <Route path="/helper/wallet" element={<HelperWalletPage />} />
        <Route path="/helper/reviews" element={<HelperReviewsPage />} />
        {/* legacy path kept for compatibility */}
        <Route path="/helper-dashboard" element={<HelperDashboardPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/helpers" element={<AdminHelpersPage />} />
        <Route path="/admin/helpers/:helperId" element={<AdminHelperDetailPage />} />
        <Route path="/admin/services" element={<ServiceManagerPage />} />
        <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
        <Route path="/admin/bookings" element={<AdminBookingsPage />} />
        <Route path="/admin/fraud-alerts" element={<AdminFraudAlertsPage />} />
        <Route path="/admin/bookings/:bookingId" element={<AdminBookingDetailPage />} />
        <Route path="/admin/job-posts" element={<AdminJobPostsPage />} />
        <Route path="/admin/job-posts/:postId" element={<AdminJobPostDetailPage />} />
        <Route path="/admin/wallet-transactions" element={<AdminWalletTransactionsPage />} />
        <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="/admin/complaints" element={<AdminComplaintsPage />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="/customer/post-job" element={<CustomerPostJobPage />} />
        <Route path="/customer/manage-posts" element={<CustomerManagePostsPage />} />
        <Route path="/customer/manage-posts/:postId" element={<CustomerPostDetailPage />} />
        <Route path="/customer/search-helper" element={<SearchHelperPage />} />
        <Route path="/customer/bookings/:bookingId" element={<CustomerBookingDetailPage />} />
        <Route path="/customer/history" element={<HistoryBookingPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AuthRouter
