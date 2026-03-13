/**
 * Login Page
 * Pilot authentication entry point
 */

import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const enableDemoPortal = import.meta.env.VITE_ENABLE_MOCK_DATA === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the page they were trying to visit
  const from = (location.state as { from?: Location })?.from?.pathname || "/pilot/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!email || !password) {
        setError("Please enter email and password");
        return;
      }

      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-xl shadow-teal-500/20">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900">CardioWatch</span>
              <p className="text-sm text-slate-500">Post-discharge cardiac monitoring</p>
            </div>
          </Link>
        </div>

        {/* Login Card */}
        <Card className="border-2 border-slate-200 shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold text-slate-900">Welcome back</CardTitle>
            <CardDescription className="text-slate-500">
              Pilot login for real/local operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="clinician@hospital.nhs.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-11 rounded-lg border-2 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-11 rounded-lg border-2 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-lg shadow-teal-600/20"
                disabled={isLoading}
              >
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
            {enableDemoPortal && (
              <Button variant="outline" className="w-full h-11 border-2" asChild>
                <Link to="/demo-login">Go to Demo Login</Link>
              </Button>
            )}

            <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-lg">
              <Sparkles size={14} className="text-teal-500" />
              <p className="text-xs text-slate-500">
                Pilot login uses your configured backend auth service
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400">
          By signing in, you agree to our{" "}
          <Link to="/terms" className="text-teal-600 hover:text-teal-700 underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-teal-600 hover:text-teal-700 underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
