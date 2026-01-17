import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import PatientDetail from "./pages/PatientDetail";
import PatientDemo from "./pages/PatientDemo";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import { AlertsProvider } from "./context/AlertsContext";
import { AuthProvider } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { QUERY_STALE_TIME_MS, API_RETRY_COUNT } from "./config/constants";

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
                <Route path="/login" element={<Login />} />

                {/* Protected clinician routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute requiredRole="clinician">
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/:patientId"
                  element={
                    <ProtectedRoute>
                      <PatientDetail />
                    </ProtectedRoute>
                  }
                />

                {/* Patient demo (public for investor demos) */}
                <Route path="/demo" element={<PatientDemo />} />

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
