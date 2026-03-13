import { Activity, HeartPulse, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function PilotOpsHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/pilot-login");
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b shadow-sm">
      <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/pilot/ops" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <HeartPulse size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Pilot Ops Console</h1>
              <p className="text-xs text-slate-500">WhatsApp + Wearables Operations</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50" asChild>
              <Link to="/pilot/ops" className="flex items-center gap-1.5">
                <Activity size={14} />
                Pilot Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50" asChild>
              <Link to="/pilot/admin" className="flex items-center gap-1.5">
                <Shield size={14} />
                Admin Console
              </Link>
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user?.role && (
            <Badge variant="outline" className="hidden sm:inline-flex text-xs border-indigo-200 text-indigo-700 bg-indigo-50">
              {user.role}
            </Badge>
          )}
          <Button variant="outline" size="sm" className="border-slate-200" onClick={handleLogout}>
            <LogOut size={14} className="mr-1.5" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

export default PilotOpsHeader;
