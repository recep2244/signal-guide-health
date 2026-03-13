import { useState } from "react";
import { CheckCircle2, History, Loader2, RotateCw, ShieldAlert, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IntegrationProvider,
  useIntegrationKeyHistory,
  useIntegrationKeyStatus,
  useRotateIntegrationKeys,
  useUpdateIntegrationKeys,
  useValidateIntegrationKeys,
} from "@/hooks/useIntegrationKeys";

export function IntegrationKeysPanel() {
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider>("whatsapp");
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [mfaCode, setMfaCode] = useState("");
  const [rotationReason, setRotationReason] = useState("");

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useIntegrationKeyStatus();
  const historyQuery = useIntegrationKeyHistory(selectedProvider, 12);
  const updateMutation = useUpdateIntegrationKeys();
  const rotateMutation = useRotateIntegrationKeys();
  const validateMutation = useValidateIntegrationKeys();

  const providers = data?.providers || [];
  const provider = providers.find((item) => item.provider === selectedProvider);

  const saveDisabled = updateMutation.isPending || !provider;
  const rotateDisabled = rotateMutation.isPending || !provider;
  const validateDisabled = validateMutation.isPending || !provider;

  const handleSave = async () => {
    if (!provider) return;

    const payload = Object.fromEntries(
      Object.entries(draftValues).filter(([, value]) => value.trim() !== "")
    );

    if (Object.keys(payload).length === 0) {
      toast.error("Enter at least one key value");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        provider: provider.provider,
        keys: payload,
        mfaCode: /^\d{6}$/.test(mfaCode.trim()) ? mfaCode.trim() : undefined,
      });
      setDraftValues({});
      toast.success("Integration keys saved", {
        description: `${provider.label} credentials updated`,
      });
    } catch (saveError) {
      toast.error("Failed to save keys", {
        description: saveError instanceof Error ? saveError.message : "Unknown error",
      });
    }
  };

  const handleRotate = async () => {
    if (!provider) return;

    try {
      const result = await rotateMutation.mutateAsync({
        provider: provider.provider,
        reason: rotationReason.trim() || undefined,
        mfaCode: /^\d{6}$/.test(mfaCode.trim()) ? mfaCode.trim() : undefined,
      });
      toast.success("Rotation completed", {
        description: `${result.rotatedCount} keys rotated for ${provider.label}`,
      });
    } catch (rotateError) {
      toast.error("Rotation failed", {
        description: rotateError instanceof Error ? rotateError.message : "Unknown error",
      });
    }
  };

  const handleValidate = async () => {
    if (!provider) return;

    try {
      const result = await validateMutation.mutateAsync(provider.provider);
      if (result.valid) {
        toast.success("Validation passed", {
          description: result.message,
        });
      } else {
        toast.error("Validation failed", {
          description: result.message,
        });
      }
    } catch (validateError) {
      toast.error("Validation failed", {
        description: validateError instanceof Error ? validateError.message : "Unknown error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-slate-200">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-teal-600" />
                Integration Keys
              </CardTitle>
              <CardDescription>
                Phase 1: status and health | Phase 2: save and validate | Phase 3: rotate and history
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Refresh Status
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="py-8 text-center text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading integration status...
            </div>
          )}

          {isError && (
            <div className="py-8 text-center text-red-700">
              {error instanceof Error ? error.message : "Failed to load integration status"}
            </div>
          )}

          {!isLoading && !isError && (
            <div className="grid md:grid-cols-3 gap-3">
              {providers.map((item) => (
                <button
                  key={item.provider}
                  className={`text-left p-3 rounded-xl border-2 transition-colors ${
                    selectedProvider === item.provider
                      ? "border-teal-300 bg-teal-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  onClick={() => {
                    setSelectedProvider(item.provider);
                    setDraftValues({});
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <Badge
                      variant="outline"
                      className={
                        item.isValid
                          ? "border-green-300 text-green-700 bg-green-50"
                          : "border-amber-300 text-amber-700 bg-amber-50"
                      }
                    >
                      {item.isValid ? "Ready" : "Needs setup"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.configuredCount}/{item.totalKeys} configured
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {provider && (
        <Card className="border-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">{provider.label} Keys</CardTitle>
            <CardDescription>
              Values are write-only and stored encrypted. Existing secrets are never returned.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm">
              <Label className="text-xs">Provider</Label>
              <Select
                value={selectedProvider}
                onValueChange={(value) => {
                  setSelectedProvider(value as IntegrationProvider);
                  setDraftValues({});
                }}
              >
                <SelectTrigger className="border-2 border-slate-200 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((item) => (
                    <SelectItem key={item.provider} value={item.provider}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">MFA Code (optional in local mode)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value)}
                  className="border-2 border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rotation Reason (optional)</Label>
                <Input
                  type="text"
                  placeholder="Quarterly rotation"
                  value={rotationReason}
                  onChange={(event) => setRotationReason(event.target.value)}
                  className="border-2 border-slate-200"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {provider.keys.map((key) => (
                <div key={key.keyName} className="space-y-1.5 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{key.label}</Label>
                    <div className="flex items-center gap-1.5">
                      {key.required && (
                        <Badge variant="outline" className="text-[10px] border-slate-300">
                          Required
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          key.configured
                            ? "text-[10px] border-green-300 text-green-700 bg-green-50"
                            : "text-[10px] border-slate-300 text-slate-600"
                        }
                      >
                        {key.configured ? "Configured" : "Not set"}
                      </Badge>
                    </div>
                  </div>
                  <Input
                    type="password"
                    placeholder={`Enter ${key.keyName}`}
                    value={draftValues[key.keyName] || ""}
                    onChange={(event) =>
                      setDraftValues((current) => ({
                        ...current,
                        [key.keyName]: event.target.value,
                      }))
                    }
                    className="border-2 border-slate-200"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Source: {key.source}
                      {key.fingerprintPreview ? ` (${key.fingerprintPreview})` : ""}
                    </span>
                    <span>
                      v{key.version ?? "-"} | {key.validationStatus}
                    </span>
                  </div>
                  {key.lastRotatedAt && (
                    <p className="text-[11px] text-slate-500">
                      Last rotated: {new Date(key.lastRotatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSave} disabled={saveDisabled} className="bg-teal-600 hover:bg-teal-700">
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldAlert className="h-4 w-4 mr-2" />
                )}
                Save Keys
              </Button>
              <Button variant="outline" onClick={handleRotate} disabled={rotateDisabled}>
                {rotateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RotateCw className="h-4 w-4 mr-2" />
                )}
                Rotate Provider Keys
              </Button>
              <Button variant="outline" onClick={handleValidate} disabled={validateDisabled}>
                {validateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Validate Provider
              </Button>
            </div>

            {!historyQuery.isLoading && historyQuery.data?.items && historyQuery.data.items.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <History className="h-4 w-4 text-slate-600" />
                  Key Version History
                </div>
                <div className="space-y-1.5">
                  {historyQuery.data.items.slice(0, 6).map((item) => (
                    <div
                      key={`${item.keyName}-${item.version}-${item.createdAt}`}
                      className="flex flex-col md:flex-row md:items-center md:justify-between text-xs text-slate-600 rounded-md bg-slate-50 px-2.5 py-2"
                    >
                      <span className="font-medium text-slate-700">
                        {item.keyName} v{item.version} ({item.status})
                      </span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default IntegrationKeysPanel;
