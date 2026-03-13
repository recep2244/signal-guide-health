import { Navigate, useLocation, Link } from "react-router-dom";
import { useDemoAuth } from "@/context/AuthContext";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DemoProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "clinician" | "patient" | "admin";
}

export function DemoProtectedRoute({ children, requiredRole }: DemoProtectedRouteProps) {
  const demo = useDemoAuth();
  const location = useLocation();

  const hasRequiredRole = () => {
    if (!requiredRole) return true;
    if (!demo.user) return false;

    if (requiredRole === "clinician") {
      return demo.user.role === "clinician" || demo.user.role === "admin";
    }
    return demo.user.role === requiredRole;
  };

  if (!demo.isAuthenticated) {
    return <Navigate to="/demo-login" state={{ from: location }} replace />;
  }

  if (!hasRequiredRole()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-amber-600" />
            </div>
            <CardTitle>Demo Access Restricted</CardTitle>
            <CardDescription>
              This demo page requires <span className="font-semibold text-foreground">{requiredRole}</span> role.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" asChild className="w-full">
              <Link to="/demo-login">Switch Demo Role</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export default DemoProtectedRoute;

