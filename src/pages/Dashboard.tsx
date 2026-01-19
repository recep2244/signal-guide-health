import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, RefreshCw, Search } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { TriageOverview } from "@/components/TriageOverview";
import { PatientCard } from "@/components/PatientCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientList, useTriageStatistics, usePatientSearchQuery } from "@/hooks/usePatientData";
import { TriageLevel } from "@/types/patient";

type TriageFilter = "all" | TriageLevel;

export default function Dashboard() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TriageFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch patients using React Query
  const {
    data: patientData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePatientList({
    triageLevel: filter === "all" ? undefined : filter,
    sortBy: "triageLevel",
    sortOrder: "asc",
  });

  // Fetch triage stats
  const { data: stats } = useTriageStatistics();

  // Search patients
  const { data: searchResults } = usePatientSearchQuery(searchQuery);

  // Use search results if searching, otherwise use patient list
  const displayPatients = useMemo(() => {
    if (searchQuery.length >= 2 && searchResults) {
      return searchResults;
    }
    return patientData?.patients || [];
  }, [searchQuery, searchResults, patientData]);

  // Count unread alerts
  const unreadAlerts = useMemo(() => {
    return displayPatients.reduce(
      (acc, p) => acc + p.alerts.filter((a) => !a.resolved).length,
      0
    );
  }, [displayPatients]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader unreadAlerts={0} />
        <main className="container mx-auto px-4 py-6 space-y-6">
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader unreadAlerts={0} />
        <main className="container mx-auto px-4 py-6">
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Failed to load patients</h2>
              <p className="text-muted-foreground mb-4 text-center">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </p>
              <Button onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <DashboardHeader unreadAlerts={unreadAlerts} />

      <main className="container mx-auto px-4 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Today's Overview</h2>
            <p className="text-sm text-slate-500 mt-1">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search patients by name or condition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl border-2 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Triage Overview */}
        {stats && (
          <TriageOverview
            stats={stats}
            activeFilter={filter}
            onFilterChange={setFilter}
          />
        )}

        {/* Patient List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">
              {searchQuery.length >= 2
                ? `Search Results`
                : filter === "all"
                ? "All Patients"
                : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Triage`}
              <span className="ml-2 text-slate-400">({displayPatients.length})</span>
            </h3>
            {isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
            )}
          </div>

          {displayPatients.length === 0 ? (
            <Card className="border-2 border-slate-200">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium">
                  {searchQuery.length >= 2
                    ? "No patients match your search"
                    : "No patients in this category"}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Try adjusting your search or filter
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayPatients.map((patient, index) => (
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
          )}
        </div>
      </main>
    </div>
  );
}
