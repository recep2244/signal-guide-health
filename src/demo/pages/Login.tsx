/**
 * Demo Login Page
 * Separate from pilot authentication
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Loader2, Shield, Sparkles, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemoAuth } from "@/context/AuthContext";

export default function DemoLogin() {
  const navigate = useNavigate();
  const { demoLogin } = useDemoAuth();
  const enableAdminUi = import.meta.env.VITE_ENABLE_ADMIN_UI !== "false";
  const [isLoading, setIsLoading] = useState(false);

  const handleDemoLogin = (role: "clinician" | "patient" | "admin") => {
    setIsLoading(true);
    const redirectMap: Record<string, string> = {
      clinician: "/demo/dashboard",
      patient: "/demo",
      admin: enableAdminUi ? "/demo/admin" : "/demo/dashboard",
    };

    setTimeout(() => {
      demoLogin(role);
      setIsLoading(false);
      navigate(redirectMap[role], { replace: true });
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-xl shadow-teal-500/20">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900">CardioWatch</span>
              <p className="text-sm text-slate-500">Demo login</p>
            </div>
          </Link>
        </div>

        <Card className="border-2 border-slate-200 shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold text-slate-900">Choose demo role</CardTitle>
            <CardDescription className="text-slate-500">
              Synthetic data only. No pilot credentials required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-11 border-2 border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 font-medium"
              onClick={() => handleDemoLogin("clinician")}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}
              Demo as Clinician
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-medium"
              onClick={() => handleDemoLogin("patient")}
              disabled={isLoading}
            >
              <User className="mr-2 h-4 w-4" />
              Demo as Patient
            </Button>
            {enableAdminUi && (
              <Button
                variant="outline"
                className="w-full h-11 border-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 font-medium"
                onClick={() => handleDemoLogin("admin")}
                disabled={isLoading}
              >
                <Shield className="mr-2 h-4 w-4" />
                Demo as Admin
              </Button>
            )}

            <Button className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-medium" asChild>
              <Link to="/pilot-login">Go to Pilot Login</Link>
            </Button>

            <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-lg">
              <Sparkles size={14} className="text-teal-500" />
              <p className="text-xs text-slate-500">Demo mode uses synthetic/sample data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
