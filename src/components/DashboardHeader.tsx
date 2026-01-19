import { Heart, Bell, User, Smartphone, Shield, LogOut, Home, Activity } from 'lucide-react';
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

interface DashboardHeaderProps {
  unreadAlerts?: number;
}

export function DashboardHeader({ unreadAlerts = 0 }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { user, demoLogout, isAuthenticated } = useDemoAuth();

  const handleLogout = () => {
    demoLogout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case 'admin': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'clinician': return 'bg-teal-50 text-teal-700 border-teal-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
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
              <p className="text-xs text-slate-500">Clinical Dashboard</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 ml-6">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-teal-600 hover:bg-teal-50" asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-teal-600 hover:bg-teal-50" asChild>
              <Link to="/demo">Patient Demo</Link>
            </Button>
            {user?.role === 'admin' && (
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-teal-600 hover:bg-teal-50" asChild>
                <Link to="/admin" className="flex items-center gap-1.5">
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
            className="hidden lg:flex gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50"
          >
            <Smartphone size={16} />
            Patient Demo
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative text-slate-600 hover:text-teal-600 hover:bg-teal-50">
            <Bell size={20} />
            {unreadAlerts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadAlerts}
              </span>
            )}
          </Button>

          {/* User Menu */}
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
                  <DropdownMenuItem onClick={() => navigate('/dashboard')} className="cursor-pointer">
                    <Activity className="mr-2 h-4 w-4 text-slate-500" />
                    Dashboard
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4 text-slate-500" />
                      Admin Console
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/demo')} className="cursor-pointer">
                    <Smartphone className="mr-2 h-4 w-4 text-slate-500" />
                    Patient Demo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => navigate('/login')} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4 text-slate-500" />
                    Sign in
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
