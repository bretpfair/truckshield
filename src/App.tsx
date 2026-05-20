import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import NotFound from "./pages/NotFound.tsx";
import PreviewClient from "./pages/PreviewClient.tsx";
import PreviewStaff from "./pages/PreviewStaff.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import AppLayout from "./components/AppLayout.tsx";
import RoleRedirect from "./components/RoleRedirect.tsx";
import StaffDashboard from "./pages/StaffDashboard.tsx";
import StaffEmailLog from "./pages/StaffEmailLog.tsx";
import ClientPortal from "./pages/ClientPortal.tsx";
import ClientPortalForAccount from "./pages/ClientPortalForAccount.tsx";
import AccountDetail from "./components/staff/AccountDetail.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/preview-client" element={<PreviewClient />} />
            <Route path="/preview-staff" element={<PreviewStaff />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleRedirect />} />
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/staff/accounts" element={<StaffDashboard />} />
              <Route path="/staff/pdf-upload" element={<StaffDashboard />} />
              <Route path="/staff/carriers" element={<StaffDashboard />} />
              <Route path="/staff/analytics" element={<StaffDashboard />} />
              <Route path="/staff/invite" element={<StaffDashboard />} />
              <Route path="/staff/invite-staff" element={<StaffDashboard />} />
              <Route path="/staff/staff-manage" element={<StaffDashboard />} />
              <Route path="/staff/emails" element={<StaffEmailLog />} />
              <Route path="/staff/accounts/:accountId" element={<AccountDetail />} />
              <Route path="/staff/accounts/:accountId/application" element={<AccountDetail />} />
              <Route path="/staff/preview/:accountId" element={<ClientPortalForAccount />} />
              <Route path="/staff/preview/:accountId/application" element={<ClientPortalForAccount />} />
              <Route path="/client" element={<ClientPortal />} />
              <Route path="/client/application" element={<ClientPortal />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
