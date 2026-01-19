import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Activity,
  Shield,
  Settings,
  FileText,
  AlertTriangle,
  TrendingUp,
  Clock,
  Heart,
  ArrowLeft,
  RefreshCw,
  Search,
  MoreHorizontal,
  UserPlus,
  Download,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// Mock data for admin dashboard
const mockUsers = [
  {
    id: "usr-001",
    name: "Dr. Sarah Mitchell",
    email: "s.mitchell@cardiowatch.nhs.uk",
    role: "clinician",
    status: "active",
    lastActive: "2 minutes ago",
    patientsAssigned: 24,
  },
  {
    id: "usr-002",
    name: "Dr. James Wilson",
    email: "j.wilson@cardiowatch.nhs.uk",
    role: "clinician",
    status: "active",
    lastActive: "15 minutes ago",
    patientsAssigned: 18,
  },
  {
    id: "usr-003",
    name: "Nurse Emma Thompson",
    email: "e.thompson@cardiowatch.nhs.uk",
    role: "clinician",
    status: "active",
    lastActive: "1 hour ago",
    patientsAssigned: 32,
  },
  {
    id: "usr-004",
    name: "Admin John Smith",
    email: "j.smith@cardiowatch.nhs.uk",
    role: "admin",
    status: "active",
    lastActive: "Just now",
    patientsAssigned: 0,
  },
  {
    id: "usr-005",
    name: "Dr. Lisa Chen",
    email: "l.chen@cardiowatch.nhs.uk",
    role: "clinician",
    status: "inactive",
    lastActive: "3 days ago",
    patientsAssigned: 12,
  },
];

const mockAuditLogs = [
  {
    id: "log-001",
    timestamp: "2026-01-18 13:45:22",
    user: "Dr. Sarah Mitchell",
    action: "PATIENT_VIEW",
    resource: "Patient: Margaret Thompson",
    ip: "192.168.1.45",
    status: "success",
  },
  {
    id: "log-002",
    timestamp: "2026-01-18 13:42:15",
    user: "Dr. James Wilson",
    action: "ALERT_RESOLVE",
    resource: "Alert: pt-002-alert-01",
    ip: "192.168.1.67",
    status: "success",
  },
  {
    id: "log-003",
    timestamp: "2026-01-18 13:38:44",
    user: "Admin John Smith",
    action: "USER_UPDATE",
    resource: "User: Dr. Lisa Chen",
    ip: "192.168.1.12",
    status: "success",
  },
  {
    id: "log-004",
    timestamp: "2026-01-18 13:35:10",
    user: "Nurse Emma Thompson",
    action: "MESSAGE_SEND",
    resource: "Patient: David Chen",
    ip: "192.168.1.89",
    status: "success",
  },
  {
    id: "log-005",
    timestamp: "2026-01-18 13:30:55",
    user: "Unknown",
    action: "LOGIN_ATTEMPT",
    resource: "Auth System",
    ip: "203.45.67.89",
    status: "failed",
  },
  {
    id: "log-006",
    timestamp: "2026-01-18 13:28:30",
    user: "Dr. Sarah Mitchell",
    action: "WEARABLE_SYNC",
    resource: "Patient: Sarah Okonkwo",
    ip: "192.168.1.45",
    status: "success",
  },
];

const mockStats = {
  totalUsers: 28,
  activeUsers: 24,
  totalPatients: 128,
  activeAlerts: 7,
  avgResponseTime: "12m",
  readmissionRate: "18%",
  wearablesSynced: 98,
  messagesPerDay: 342,
};

export default function Admin() {
  const [userSearch, setUserSearch] = useState("");
  const [logFilter, setLogFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredLogs =
    logFilter === "all"
      ? mockAuditLogs
      : mockAuditLogs.filter((log) => log.status === logFilter);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-lg font-semibold">Admin Console</h1>
                <p className="text-xs text-muted-foreground">System Administration</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">{mockStats.activeUsers} active</span> • {mockStats.totalUsers - mockStats.activeUsers} inactive
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Patients Monitored</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.totalPatients}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-amber-600">{mockStats.activeAlerts} active alerts</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.avgResponseTime}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">-2m</span> from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Readmission Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">-{mockStats.readmissionRate}</div>
              <p className="text-xs text-muted-foreground">
                vs. baseline (industry avg: 25%)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage clinicians, nurses, and admin accounts</CardDescription>
                  </div>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="clinician">Clinician</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Patients</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === "active" ? "outline" : "destructive"} className={user.status === "active" ? "border-green-500 text-green-600" : ""}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.patientsAssigned}</TableCell>
                        <TableCell className="text-muted-foreground">{user.lastActive}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Profile</DropdownMenuItem>
                              <DropdownMenuItem>Edit User</DropdownMenuItem>
                              <DropdownMenuItem>Reset Password</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Audit Logs</CardTitle>
                    <CardDescription>System activity and security events</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={logFilter} onValueChange={setLogFilter}>
                      <SelectTrigger className="w-[150px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{log.timestamp}</TableCell>
                        <TableCell>{log.user}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{log.resource}</TableCell>
                        <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === "success" ? "outline" : "destructive"} className={log.status === "success" ? "border-green-500 text-green-600" : ""}>
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Alerts & Notifications</CardTitle>
                <CardDescription>Configure alert thresholds and notification settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Alert Thresholds</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Heart Rate - High Threshold (bpm)</Label>
                      <Input type="number" defaultValue="100" />
                    </div>
                    <div className="space-y-2">
                      <Label>Heart Rate - Low Threshold (bpm)</Label>
                      <Input type="number" defaultValue="50" />
                    </div>
                    <div className="space-y-2">
                      <Label>HRV - Critical Low (ms)</Label>
                      <Input type="number" defaultValue="20" />
                    </div>
                    <div className="space-y-2">
                      <Label>Wellbeing Score - Alert Threshold</Label>
                      <Input type="number" defaultValue="4" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Escalation Rules</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-escalate urgent alerts to on-call</Label>
                        <p className="text-sm text-muted-foreground">Automatically notify on-call clinician for urgent patients</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>SMS notifications for critical alerts</Label>
                        <p className="text-sm text-muted-foreground">Send SMS for life-threatening conditions</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Daily digest emails</Label>
                        <p className="text-sm text-muted-foreground">Send summary of patient status each morning</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>General application configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input defaultValue="Midlands Heart Centre" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Timezone</Label>
                    <Select defaultValue="europe-london">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="europe-london">Europe/London (GMT)</SelectItem>
                        <SelectItem value="america-newyork">America/New_York (EST)</SelectItem>
                        <SelectItem value="asia-tokyo">Asia/Tokyo (JST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Session Timeout (minutes)</Label>
                    <Input type="number" defaultValue="30" />
                  </div>
                  <Button className="w-full">Save Settings</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Integration Settings</CardTitle>
                  <CardDescription>Wearable and communication integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Apple HealthKit</Label>
                      <p className="text-sm text-muted-foreground">Sync with Apple Watch</p>
                    </div>
                    <Badge variant="outline" className="border-green-500 text-green-600">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Fitbit API</Label>
                      <p className="text-sm text-muted-foreground">Sync with Fitbit devices</p>
                    </div>
                    <Badge variant="outline" className="border-green-500 text-green-600">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>WhatsApp Business API</Label>
                      <p className="text-sm text-muted-foreground">Patient messaging</p>
                    </div>
                    <Badge variant="outline" className="border-green-500 text-green-600">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>NHS Spine Integration</Label>
                      <p className="text-sm text-muted-foreground">Patient demographics</p>
                    </div>
                    <Badge variant="outline" className="border-amber-500 text-amber-600">Pending</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Authentication and access control</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Require MFA for all users</Label>
                        <p className="text-sm text-muted-foreground">Two-factor authentication</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enforce password complexity</Label>
                        <p className="text-sm text-muted-foreground">Min 12 chars, special chars required</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-lock after inactivity</Label>
                        <p className="text-sm text-muted-foreground">Lock session after 15 min idle</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>IP Whitelisting</Label>
                        <p className="text-sm text-muted-foreground">Restrict access by IP</p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
