import {
  Heart,
  Bell,
  User,
  Shield,
  LogOut,
  Home,
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/api/client';

interface ApiAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  createdAt: string;
  patientId: string;
  patient: {
    id: string;
    nhsNumber: string;
    user: { firstName: string; lastName: string };
  };
}

interface AlertsResponse {
  status: string;
  data: { alerts: ApiAlert[]; total: number };
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface PilotDashboardHeaderProps {
  unreadAlerts?: number;
}

export function PilotDashboardHeader({ unreadAlerts = 0 }: PilotDashboardHeaderProps) {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth.user;
  const isAuthenticated = auth.isAuthenticated;
  const enableAdminUi = import.meta.env.VITE_ENABLE_ADMIN_UI !== 'false';

  const paths = {
    dashboard: '/pilot/dashboard',
    admin: '/pilot/admin',
    doctorOps: '/pilot/doctor-ops',
    patient: (id: string) => `/pilot/patient/${id}`,
    login: '/pilot-login',
  };

  const hasClinicianAccess =
    user?.role === 'clinician' ||
    user?.role === 'doctor' ||
    user?.role === 'nurse' ||
    user?.role === 'admin' ||
    user?.role === 'super_admin';
  const hasAdminAccess = user?.role === 'admin' || user?.role === 'super_admin';

  const { data: alertsData } = useQuery({
    queryKey: ['header-alerts'],
    queryFn: async () => {
      const res = await apiClient.get<AlertsResponse>('/alerts?resolved=false&limit=10');
      return res.data;
    },
    staleTime: 30_000,
    retry: false,
  });
  const liveAlerts = alertsData?.data?.alerts ?? [];
  const liveUnreadCount = liveAlerts.length;

  const handleLogout = async () => {
    await auth.logout();
    navigate(paths.login);
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case 'admin':
      case 'super_admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'doctor':
      case 'nurse':
      case 'clinician':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b shadow-sm">
      <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Heart size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">CardioWatch</h1>
              <p className="text-xs text-slate-500">Pilot Dashboard</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-teal-600 hover:bg-teal-50" asChild>
              <Link to={paths.dashboard}>Dashboard</Link>
            </Button>
            {enableAdminUi && hasClinicianAccess && (
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-teal-600 hover:bg-teal-50" asChild>
                <Link to={paths.doctorOps}>Doctor Workspace</Link>
              </Button>
            )}
            {enableAdminUi && hasAdminAccess && (
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-teal-600 hover:bg-teal-50" asChild>
                <Link to={paths.admin} className="flex items-center gap-1.5">
                  <Shield size={14} />
                  Admin
                </Link>
              </Button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-slate-600 hover:text-teal-600 hover:bg-teal-50">
                <Bell size={20} />
                {liveUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {liveUnreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="px-4 py-3 border-b bg-slate-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
                  {liveUnreadCount > 0 && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">{liveUnreadCount} unread</Badge>
                  )}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {liveUnreadCount > 0 ? (
                  <div className="p-2 space-y-1">
                    {liveAlerts.map((alert) => {
                      const isCritical = alert.severity === 'critical' || alert.severity === 'high';
                      const patientName = `${alert.patient.user.firstName} ${alert.patient.user.lastName}`;
                      return (
                        <button
                          key={alert.id}
                          onClick={() => navigate(paths.patient(alert.patientId))}
                          className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
                            isCritical ? 'hover:bg-red-50' : 'hover:bg-amber-50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isCritical ? 'bg-red-100' : 'bg-amber-100'
                          }`}>
                            {isCritical
                              ? <AlertCircle size={14} className="text-red-600" />
                              : <AlertTriangle size={14} className="text-amber-600" />}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
                              {alert.title}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">{patientName} — {alert.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {new Date(alert.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <CheckCircle2 size={24} className="mx-auto text-green-500 mb-2" />
                    <p className="text-sm text-slate-600">All caught up</p>
                    <p className="text-xs text-slate-400">No new notifications</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-2.5 border-t bg-slate-50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                  onClick={() => navigate(paths.dashboard)}
                >
                  View all patients
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Avatar className="h-8 w-8 border-2 border-teal-100">
                  <AvatarFallback className="bg-teal-50 text-teal-700 text-xs font-bold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isAuthenticated && user ? (
                <>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1.5">
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                      <Badge variant="outline" className={`w-fit text-[10px] ${getRoleBadgeColor()}`}>
                        {user.role}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/')} className="cursor-pointer">
                    <Home className="mr-2 h-4 w-4 text-slate-500" />
                    Home
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(paths.dashboard)} className="cursor-pointer">
                    <Activity className="mr-2 h-4 w-4 text-slate-500" />
                    Dashboard
                  </DropdownMenuItem>
                  {enableAdminUi && hasClinicianAccess && (
                    <DropdownMenuItem onClick={() => navigate(paths.doctorOps)} className="cursor-pointer">
                      <Activity className="mr-2 h-4 w-4 text-slate-500" />
                      Doctor Workspace
                    </DropdownMenuItem>
                  )}
                  {enableAdminUi && hasAdminAccess && (
                    <DropdownMenuItem onClick={() => navigate(paths.admin)} className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4 text-slate-500" />
                      Admin Console
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => navigate(paths.login)} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4 text-slate-500" />
                  Sign in
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
