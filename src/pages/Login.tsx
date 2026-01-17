/**
 * Login Page
 * Supports demo mode and real authentication
 */

import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Heart, Loader2, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemoAuth } from "@/context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { demoLogin } = useDemoAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the page they were trying to visit
  const from = (location.state as { from?: Location })?.from?.pathname || "/dashboard";

  const handleDemoLogin = (role: "clinician" | "patient") => {
    setIsLoading(true);
    setError(null);

    // Simulate login delay
    setTimeout(() => {
      demoLogin(role);
      setIsLoading(false);
      navigate(role === "clinician" ? "/dashboard" : "/demo", { replace: true });
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // In production, this would call the real auth service
      // For now, treat any login as demo clinician
      if (email && password) {
        demoLogin("clinician");
        navigate(from, { replace: true });
      } else {
        setError("Please enter email and password");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">CardioWatch</span>
          </Link>
          <p className="mt-2 text-muted-foreground">
            Post-discharge cardiac monitoring
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="clinician@hospital.nhs.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with demo
                </span>
              </div>
            </div>

            {/* Demo Login Buttons */}
            <div className="grid gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleDemoLogin("clinician")}
                disabled={isLoading}
              >
                <Stethoscope className="mr-2 h-4 w-4" />
                Demo as Clinician
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleDemoLogin("patient")}
                disabled={isLoading}
              >
                <User className="mr-2 h-4 w-4" />
                Demo as Patient
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Demo mode uses mock data for demonstration purposes.
              No real patient data is accessed.
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By signing in, you agree to our{" "}
          <Link to="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
