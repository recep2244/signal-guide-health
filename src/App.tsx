import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PilotDashboard from "./pilot/pages/Dashboard";
import PilotPatientDetail from "./pilot/pages/PatientDetail";
import DemoDashboard from "./demo/pages/Dashboard";
import DemoPatientDetail from "./demo/pages/PatientDetail";
import PatientDemo from "./demo/pages/PatientDemo";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import PilotLogin from "./pilot/pages/Login";
import DemoLogin from "./demo/pages/Login";
import PilotAdmin from "./pilot/pages/Admin";
import PilotOps from "./pilot/pages/PilotOps";
import PilotDoctorOps from "./pilot/pages/DoctorOps";
import DemoAdmin from "./demo/pages/Admin";
import DemoDoctorOps from "./demo/pages/DoctorOps";
import { AlertsProvider } from "./context/AlertsContext";
import { AuthProvider } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./pilot/components/ProtectedRoute";
import { DemoProtectedRoute } from "./demo/components/DemoProtectedRoute";
import { QUERY_STALE_TIME_MS, API_RETRY_COUNT } from "./config/constants";

const ENABLE_ADMIN_UI = import.meta.env.VITE_ENABLE_ADMIN_UI !== "false";
const DOCTOR_SHARE_MODE = !ENABLE_ADMIN_UI;
const ENABLE_DEMO_LOGIN = import.meta.env.VITE_ENABLE_MOCK_DATA === "true";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      retry: API_RETRY_COUNT,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AlertsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" />
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/pilot-login" element={<PilotLogin />} />
                <Route
                  path="/demo-login"
                  element={ENABLE_DEMO_LOGIN ? <DemoLogin /> : <Navigate to="/pilot-login" replace />}
                />
                <Route path="/login" element={<Navigate to="/pilot-login" replace />} />

                {/* Pilot routes (real auth only) */}
                <Route
                  path="/pilot/dashboard"
                  element={
                    <ProtectedRoute requiredRole="clinician">
                      {DOCTOR_SHARE_MODE ? <PilotDoctorOps /> : <PilotDashboard />}
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pilot/patient/:patientId"
                  element={
                    <ProtectedRoute>
                      <PilotPatientDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pilot/doctor-ops"
                  element={
                    <ProtectedRoute requiredRole="clinician">
                      <PilotDoctorOps />
                    </ProtectedRoute>
                  }
                />

                {/* Pilot admin routes */}
                {ENABLE_ADMIN_UI && (
                  <>
                    <Route
                      path="/pilot/admin"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <PilotAdmin />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pilot/ops"
                      element={
                        <ProtectedRoute requiredRole="admin">
                          <PilotOps />
                        </ProtectedRoute>
                      }
                    />
                  </>
                )}

                {/* Demo portal routes (demo auth only) */}
                <Route
                  path="/demo/dashboard"
                  element={
                    <DemoProtectedRoute requiredRole="clinician">
                      <DemoDashboard />
                    </DemoProtectedRoute>
                  }
                />
                <Route
                  path="/demo/patient/:patientId"
                  element={
                    <DemoProtectedRoute>
                      <DemoPatientDetail />
                    </DemoProtectedRoute>
                  }
                />
                <Route
                  path="/demo/doctor-ops"
                  element={
                    <DemoProtectedRoute requiredRole="clinician">
                      <DemoDoctorOps />
                    </DemoProtectedRoute>
                  }
                />
                {ENABLE_ADMIN_UI && (
                  <Route
                    path="/demo/admin"
                    element={
                      <DemoProtectedRoute requiredRole="admin">
                        <DemoAdmin />
                      </DemoProtectedRoute>
                    }
                  />
                )}

                {/* Demo patient flow (public for investor demos) */}
                <Route path="/demo" element={<PatientDemo />} />

                {/* Legacy aliases -> pilot routes */}
                <Route path="/dashboard" element={<Navigate to="/pilot/dashboard" replace />} />
                <Route path="/doctor-ops" element={<Navigate to="/pilot/doctor-ops" replace />} />
                <Route path="/admin" element={<Navigate to="/pilot/admin" replace />} />
                <Route path="/pilot-ops" element={<Navigate to="/pilot/ops" replace />} />
                <Route
                  path="/patient/:patientId"
                  element={
                    <ProtectedRoute>
                      <PilotPatientDetail />
                    </ProtectedRoute>
                  }
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AlertsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
