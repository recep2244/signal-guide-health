import {
  Heart,
  Bell,
  User,
  Smartphone,
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
import { useDemoAuth } from '@/context/AuthContext';
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

interface DemoDashboardHeaderProps {
  unreadAlerts?: number;
}

export function DemoDashboardHeader({ unreadAlerts = 0 }: DemoDashboardHeaderProps) {
  const navigate = useNavigate();
  const demo = useDemoAuth();
  const user = demo.user;
  const isAuthenticated = demo.isAuthenticated;
  const enableAdminUi = import.meta.env.VITE_ENABLE_ADMIN_UI !== 'false';

  const paths = {
    dashboard: '/demo/dashboard',
    admin: '/demo/admin',
    doctorOps: '/demo/doctor-ops',
    patient: (id: string) => `/demo/patient/${id}`,
    login: '/demo-login',
  };

  const hasClinicianAccess = user?.role === 'clinician' || user?.role === 'admin';
  const hasAdminAccess = user?.role === 'admin';

  const handleLogout = () => {
    demo.demoLogout();
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
        return 'bg-purple-50 text-purple-700 border-purple-200';
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Heart size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">CardioWatch</h1>
              <p className="text-xs text-slate-500">Demo Portal</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50" asChild>
              <Link to={paths.dashboard}>Dashboard</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50" asChild>
              <Link to="/demo">Patient Demo</Link>
            </Button>
            {enableAdminUi && hasClinicianAccess && (
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50" asChild>
                <Link to={paths.doctorOps}>Doctor Workspace</Link>
              </Button>
            )}
            {enableAdminUi && hasAdminAccess && (
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50" asChild>
                <Link to={paths.admin} className="flex items-center gap-1.5">
                  <Shield size={14} />
                  Admin
                </Link>
              </Button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/demo')}
            className="hidden lg:flex gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Smartphone size={16} />
            Patient Demo
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-slate-600 hover:text-indigo-600 hover:bg-indigo-50">
                <Bell size={20} />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadAlerts}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="px-4 py-3 border-b bg-slate-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
                  {unreadAlerts > 0 && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">{unreadAlerts} unread</Badge>
                  )}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {unreadAlerts > 0 ? (
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => navigate(paths.patient('pt-001'))}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle size={14} className="text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-red-700">URGENT: Demo alert</p>
                        <p className="text-xs text-slate-600 mt-0.5">Margaret Thompson - Sample event</p>
                        <p className="text-[10px] text-slate-400 mt-1">16 Jan, 09:11</p>
                      </div>
                    </button>
                    <button
                      onClick={() => navigate(paths.patient('pt-002'))}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-amber-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle size={14} className="text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-amber-700">Review today: Demo symptom</p>
                        <p className="text-xs text-slate-600 mt-0.5">David Chen - Sample event</p>
                        <p className="text-[10px] text-slate-400 mt-1">16 Jan, 08:22</p>
                      </div>
                    </button>
                    <button
                      onClick={() => navigate(paths.patient('pt-003'))}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-green-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={14} className="text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-green-700">Check-in complete</p>
                        <p className="text-xs text-slate-600 mt-0.5">Sarah Okonkwo - Sample event</p>
                        <p className="text-[10px] text-slate-400 mt-1">16 Jan, 07:45</p>
                      </div>
                    </button>
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
                  className="w-full text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
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
                <Avatar className="h-8 w-8 border-2 border-indigo-100">
                  <AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs font-bold">
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
