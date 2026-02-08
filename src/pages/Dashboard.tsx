import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, RefreshCw, Search, Clock, Heart, Activity, CheckCircle2, TrendingDown, Stethoscope, Watch, Moon, Gauge, Syringe, Waves, FlaskConical, AlertTriangle, Pill } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { TriageOverview } from "@/components/TriageOverview";
import { PatientCard } from "@/components/PatientCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientList, useTriageStatistics, usePatientSearchQuery } from "@/hooks/usePatientData";
import { TriageLevel, type Patient, type NYHAClass } from "@/types/patient";

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

        {/* Clinical Summary Metrics */}
        {displayPatients.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(() => {
              const avgHR = Math.round(
                displayPatients.reduce((acc, p) => acc + p.wearableData[p.wearableData.length - 1].restingHR, 0) / displayPatients.length
              );
              const avgHRV = Math.round(
                displayPatients.reduce((acc, p) => acc + p.wearableData[p.wearableData.length - 1].hrv, 0) / displayPatients.length
              );
              const avgSleep = (
                displayPatients.reduce((acc, p) => acc + p.wearableData[p.wearableData.length - 1].sleepHours, 0) / displayPatients.length
              ).toFixed(1);
              const avgWellbeing = (
                displayPatients.reduce((acc, p) => acc + p.wellbeingScore, 0) / displayPatients.length
              ).toFixed(1);
              const totalAlerts = displayPatients.reduce((acc, p) => acc + p.alerts.filter(a => !a.resolved).length, 0);
              const resolvedToday = displayPatients.reduce((acc, p) => acc + p.alerts.filter(a => a.resolved).length, 0);

              return [
                {
                  label: "Avg Resting HR",
                  value: `${avgHR} bpm`,
                  icon: Heart,
                  color: avgHR > 80 ? "text-red-600 bg-red-50 border-red-100" : "text-teal-600 bg-teal-50 border-teal-100",
                  detail: avgHR > 80 ? "Above normal range" : "Within normal range",
                },
                {
                  label: "Avg HRV",
                  value: `${avgHRV} ms`,
                  icon: Activity,
                  color: avgHRV < 30 ? "text-amber-600 bg-amber-50 border-amber-100" : "text-blue-600 bg-blue-50 border-blue-100",
                  detail: avgHRV < 30 ? "Below baseline" : "Healthy variability",
                },
                {
                  label: "Avg Sleep",
                  value: `${avgSleep} hrs`,
                  icon: Moon,
                  color: parseFloat(avgSleep) < 6 ? "text-amber-600 bg-amber-50 border-amber-100" : "text-purple-600 bg-purple-50 border-purple-100",
                  detail: parseFloat(avgSleep) < 6 ? "Below 6hr threshold" : "Adequate recovery",
                },
                {
                  label: "Avg Wellbeing",
                  value: `${avgWellbeing}/10`,
                  icon: CheckCircle2,
                  color: parseFloat(avgWellbeing) <= 4 ? "text-red-600 bg-red-50 border-red-100" : parseFloat(avgWellbeing) <= 6 ? "text-amber-600 bg-amber-50 border-amber-100" : "text-green-600 bg-green-50 border-green-100",
                  detail: `${totalAlerts} active alerts, ${resolvedToday} resolved`,
                },
              ].map((metric) => (
                <Card key={metric.label} className={`p-4 border-2 ${metric.color}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center shadow-sm">
                      <metric.icon size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                      <p className="text-lg font-bold">{metric.value}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{metric.detail}</p>
                </Card>
              ));
            })()}
          </div>
        )}

        {/* Clinical Actions Bar */}
        <Card className="border-2 border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Stethoscope size={20} className="text-teal-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Clinician Summary</p>
                <p className="text-xs text-slate-500">
                  {displayPatients.filter(p => p.triageLevel === 'red').length > 0
                    ? `${displayPatients.filter(p => p.triageLevel === 'red').length} patient(s) require urgent review`
                    : 'No urgent patients - all queues manageable'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
                <Watch size={12} className="mr-1" />
                {displayPatients.length} wearables active
              </Badge>
              <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                <Clock size={12} className="mr-1" />
                Last sync: {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Cardiac Clinical Overview */}
        {displayPatients.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Gauge size={20} className="text-teal-600" />
              <h3 className="text-lg font-bold text-slate-900">Cardiac Clinical Overview</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Ejection Fraction Summary */}
              <Card className="border-2 border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Heart size={16} className="text-blue-600" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Ejection Fraction</p>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {displayPatients.filter(p => p.ejectionFraction != null).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No EF data available</p>
                  ) : (
                    displayPatients
                      .filter(p => p.ejectionFraction != null)
                      .sort((a, b) => (a.ejectionFraction ?? 100) - (b.ejectionFraction ?? 100))
                      .map(p => {
                        const ef = p.ejectionFraction!;
                        const colorClass = ef < 40
                          ? "text-red-700 bg-red-50 border-red-200"
                          : ef < 50
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : "text-green-700 bg-green-50 border-green-200";
                        const label = ef < 40 ? "HFrEF" : ef < 50 ? "Mildly reduced" : "Preserved";
                        return (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 truncate mr-2">{p.name}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`font-bold ${ef < 40 ? "text-red-600" : ef < 50 ? "text-amber-600" : "text-green-600"}`}>
                                {ef}%
                              </span>
                              <Badge className={`text-[10px] px-1.5 py-0 border ${colorClass}`}>
                                {label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </Card>

              {/* Biomarker Alerts */}
              <Card className="border-2 border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                    <FlaskConical size={16} className="text-purple-600" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Biomarker Alerts</p>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {displayPatients.filter(p => p.cardiacBiomarkers).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No biomarker data available</p>
                  ) : (
                    displayPatients
                      .filter(p => p.cardiacBiomarkers)
                      .sort((a, b) => (b.cardiacBiomarkers?.ntProBNP ?? 0) - (a.cardiacBiomarkers?.ntProBNP ?? 0))
                      .map(p => {
                        const bio = p.cardiacBiomarkers!;
                        const bnpElevated = bio.ntProBNP > 300;
                        const tropElevated = bio.hsTroponinI > 14;
                        return (
                          <div key={p.id} className="text-xs space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600 truncate mr-2">{p.name}</span>
                              {(bnpElevated || tropElevated) && (
                                <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex gap-2">
                              <span className={bnpElevated ? "text-red-600 font-semibold" : "text-slate-500"}>
                                BNP: {bio.ntProBNP}
                              </span>
                              <span className={tropElevated ? "text-red-600 font-semibold" : "text-slate-500"}>
                                TnI: {bio.hsTroponinI}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </Card>

              {/* NYHA & ECG Status */}
              <Card className="border-2 border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                    <Waves size={16} className="text-teal-600" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">NYHA & ECG</p>
                </div>
                <div className="space-y-2">
                  {/* NYHA Distribution */}
                  {(() => {
                    const nyhaCounts: Record<string, number> = {};
                    displayPatients.forEach(p => {
                      if (p.nyhaClass) {
                        nyhaCounts[p.nyhaClass] = (nyhaCounts[p.nyhaClass] || 0) + 1;
                      }
                    });
                    const nyhaColors: Record<string, string> = {
                      I: "bg-green-100 text-green-700",
                      II: "bg-amber-100 text-amber-700",
                      III: "bg-orange-100 text-orange-700",
                      IV: "bg-red-100 text-red-700",
                    };
                    return Object.keys(nyhaCounts).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(["I", "II", "III", "IV"] as NYHAClass[])
                          .filter(cls => nyhaCounts[cls])
                          .map(cls => (
                            <Badge key={cls} className={`text-[10px] px-1.5 py-0 ${nyhaColors[cls]}`}>
                              NYHA {cls}: {nyhaCounts[cls]}
                            </Badge>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic mb-2">No NYHA data</p>
                    );
                  })()}
                  {/* ECG per patient */}
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {displayPatients.filter(p => p.ecgStatus).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No ECG data</p>
                    ) : (
                      displayPatients
                        .filter(p => p.ecgStatus)
                        .map(p => {
                          const isNormal = p.ecgStatus === "Normal sinus rhythm";
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 truncate mr-2">{p.name}</span>
                              <span className={`flex-shrink-0 ${isNormal ? "text-green-600" : "text-amber-600 font-medium"}`}>
                                {p.ecgStatus}
                              </span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </Card>

              {/* Risk Score Highlights */}
              <Card className="border-2 border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <AlertTriangle size={16} className="text-red-600" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Risk Scores</p>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(() => {
                    const patientsWithScores = displayPatients.filter(p => p.riskScores);
                    if (patientsWithScores.length === 0) {
                      return <p className="text-xs text-slate-400 italic">No risk score data</p>;
                    }
                    const highestGrace = patientsWithScores
                      .filter(p => p.riskScores?.grace != null)
                      .sort((a, b) => (b.riskScores?.grace ?? 0) - (a.riskScores?.grace ?? 0))[0];
                    const elevatedCha2 = patientsWithScores.filter(
                      p => p.riskScores?.cha2ds2vasc != null && p.riskScores.cha2ds2vasc >= 2
                    );
                    const elevatedHasbled = patientsWithScores.filter(
                      p => p.riskScores?.hasbled != null && p.riskScores.hasbled >= 3
                    );
                    return (
                      <div className="space-y-2 text-xs">
                        {highestGrace && highestGrace.riskScores?.grace != null && (
                          <div>
                            <p className="text-slate-500 font-medium mb-0.5">Highest GRACE</p>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">{highestGrace.name}</span>
                              <span className={`font-bold ${highestGrace.riskScores.grace > 140 ? "text-red-600" : highestGrace.riskScores.grace > 108 ? "text-amber-600" : "text-green-600"}`}>
                                {highestGrace.riskScores.grace}
                              </span>
                            </div>
                          </div>
                        )}
                        {elevatedCha2.length > 0 && (
                          <div>
                            <p className="text-slate-500 font-medium mb-0.5">
                              CHA₂DS₂-VASc {"\u2265"}2
                            </p>
                            {elevatedCha2.map(p => (
                              <div key={p.id} className="flex items-center justify-between">
                                <span className="text-slate-600">{p.name}</span>
                                <span className="font-bold text-amber-600">{p.riskScores!.cha2ds2vasc}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {elevatedHasbled.length > 0 && (
                          <div>
                            <p className="text-slate-500 font-medium mb-0.5">
                              HAS-BLED {"\u2265"}3
                            </p>
                            {elevatedHasbled.map(p => (
                              <div key={p.id} className="flex items-center justify-between">
                                <span className="text-slate-600">{p.name}</span>
                                <span className="font-bold text-red-600">{p.riskScores!.hasbled}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </Card>
            </div>

            {/* Blood Pressure Overview */}
            <Card className="border-2 border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <Syringe size={16} className="text-rose-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Blood Pressure Overview</p>
              </div>
              {displayPatients.filter(p => p.bloodPressure).length === 0 ? (
                <p className="text-xs text-slate-400 italic">No blood pressure data available</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {displayPatients
                    .filter(p => p.bloodPressure)
                    .sort((a, b) => (b.bloodPressure?.systolic ?? 0) - (a.bloodPressure?.systolic ?? 0))
                    .map(p => {
                      const bp = p.bloodPressure!;
                      const isHypertensive = bp.systolic > 140 || bp.diastolic > 90;
                      const isElevated = bp.systolic > 130 || bp.diastolic > 85;
                      const colorClass = isHypertensive
                        ? "border-red-200 bg-red-50"
                        : isElevated
                        ? "border-amber-200 bg-amber-50"
                        : "border-green-200 bg-green-50";
                      const textColor = isHypertensive
                        ? "text-red-700"
                        : isElevated
                        ? "text-amber-700"
                        : "text-green-700";
                      return (
                        <div key={p.id} className={`rounded-lg border-2 px-3 py-2 ${colorClass}`}>
                          <p className="text-xs text-slate-500 mb-0.5 truncate max-w-[120px]">{p.name}</p>
                          <p className={`text-sm font-bold ${textColor}`}>
                            {bp.systolic}/{bp.diastolic}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {isHypertensive ? "Hypertensive" : isElevated ? "Elevated" : "Normal"}
                          </p>
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
          </div>
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
