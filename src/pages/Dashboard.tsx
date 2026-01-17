import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '@/components/DashboardHeader';
import { TriageOverview } from '@/components/TriageOverview';
import { PatientCard } from '@/components/PatientCard';
import { applyResolvedAlerts, getTriageStats, mockPatients } from '@/data/mockPatients';
import { useAlerts } from '@/context/AlertsContext';

type TriageFilter = 'all' | 'red' | 'amber' | 'green';

export default function Dashboard() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TriageFilter>('all');
  const { resolvedAlertIds } = useAlerts();
  const patients = useMemo(
    () => applyResolvedAlerts(mockPatients, resolvedAlertIds),
    [resolvedAlertIds]
  );
  const stats = useMemo(() => getTriageStats(patients), [patients]);

  const unreadAlerts = patients.reduce(
    (acc, p) => acc + p.alerts.filter((a) => !a.resolved).length,
    0
  );

  const filteredPatients = useMemo(() => {
    const filtered =
      filter === 'all'
        ? patients
        : patients.filter((p) => p.triageLevel === filter);

    // Sort by triage level: red > amber > green
    const triageOrder = { red: 0, amber: 1, green: 2 };
    return [...filtered].sort(
      (a, b) => triageOrder[a.triageLevel] - triageOrder[b.triageLevel]
    );
  }, [filter, patients]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader unreadAlerts={unreadAlerts} />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Today's Overview</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-GB', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
        </div>

        <TriageOverview 
          stats={stats} 
          activeFilter={filter} 
          onFilterChange={setFilter} 
        />

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {filter === 'all' ? 'All Patients' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Triage`} 
            <span className="ml-1">({filteredPatients.length})</span>
          </h3>
          
          <div className="space-y-3">
            {filteredPatients.map((patient, index) => (
              <div 
                key={patient.id} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <PatientCard
                  patient={patient}
                  onClick={() => navigate(`/patient/${patient.id}`)}
                />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
