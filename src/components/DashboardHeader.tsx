import { Heart, Bell, User, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface DashboardHeaderProps {
  unreadAlerts?: number;
}

export function DashboardHeader({ unreadAlerts = 0 }: DashboardHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Heart size={20} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">CardioWatch</h1>
            <p className="text-xs text-muted-foreground">Clinical Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/demo')}
            className="hidden sm:flex gap-1.5"
          >
            <Smartphone size={16} />
            Patient Demo
          </Button>
          <Button variant="ghost" size="icon" className="relative">
            <Bell size={20} />
            {unreadAlerts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-triage-red text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadAlerts}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon">
            <User size={20} />
          </Button>
        </div>
      </div>
    </header>
  );
}
