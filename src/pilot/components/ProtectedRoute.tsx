/**
 * Protected Route Component
 * Wraps pilot routes that require real authentication
 */

import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2, ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "clinician" | "doctor" | "nurse" | "patient" | "admin" | "super_admin";
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const auth = useAuth();
  const location = useLocation();
  const user = auth.user;
  const isAuthenticated = auth.isAuthenticated;
  const isLoading = auth.isLoading;

  const hasRequiredRole = () => {
    if (!requiredRole) return true;
    if (!user) return false;

    const role = user.role;
    if (requiredRole === "clinician") {
      return role === "clinician" || role === "doctor" || role === "nurse" || role === "admin" || role === "super_admin";
    }
    if (requiredRole === "admin") {
      return role === "admin" || role === "super_admin";
    }
    return role === requiredRole;
  };

  if (isLoading) {
    return <LoadingScreen message="Checking session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/pilot-login" state={{ from: location }} replace />;
  }

  if (!hasRequiredRole()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-amber-600" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              This page requires <span className="font-semibold text-foreground">{requiredRole}</span> access.
              You are currently signed in as <span className="font-semibold text-foreground">{user?.role}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Pilot Access Required</p>
              <p>Ask an admin to grant the correct role for your pilot account.</p>
            </div>
            <div className="grid gap-2">
              <Button variant="outline" asChild className="w-full">
                <Link to="/pilot-login">Go to Pilot Login</Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Loading Spinner Component
 */
export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default ProtectedRoute;
