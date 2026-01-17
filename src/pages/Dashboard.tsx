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
    <div className="min-h-screen bg-background">
      <DashboardHeader unreadAlerts={unreadAlerts} />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">Today's Overview</h2>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {searchQuery.length >= 2
                ? `Search Results`
                : filter === "all"
                ? "All Patients"
                : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Triage`}
              <span className="ml-1">({displayPatients.length})</span>
            </h3>
            {isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {displayPatients.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery.length >= 2
                    ? "No patients match your search"
                    : "No patients in this category"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
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
