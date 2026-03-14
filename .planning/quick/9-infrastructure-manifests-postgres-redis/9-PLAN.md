---
phase: quick
plan: 9
type: execute
wave: 1
depends_on: []
files_modified:
  - infrastructure/kubernetes/postgres-deployment.yaml
  - infrastructure/kubernetes/redis-deployment.yaml
  - infrastructure/kubernetes/secrets.yaml
  - backend/Dockerfile
  - .env.production
autonomous: true
requirements: [INFRA-01]

must_haves:
  truths:
    - "postgres-deployment.yaml creates a StatefulSet (or Deployment) with a PVC and a ClusterIP Service on 5432"
    - "redis-deployment.yaml creates a Deployment (no PVC) with a ClusterIP Service on 6379"
    - "secrets.yaml has a HOWTO comment block explaining how to populate placeholder values"
    - "backend/Dockerfile entrypoint runs prisma migrate deploy before starting the server"
    - ".env.production exists at project root with mock-data flags false and correct API base URL"
  artifacts:
    - path: "infrastructure/kubernetes/postgres-deployment.yaml"
      provides: "PostgreSQL 16 StatefulSet + PVC + Service"
    - path: "infrastructure/kubernetes/redis-deployment.yaml"
      provides: "Redis 7 Deployment + Service (no persistence)"
    - path: ".env.production"
      provides: "Frontend production env vars"
  key_links:
    - from: "secrets.yaml"
      to: "postgres-deployment.yaml"
      via: "env.valueFrom.secretKeyRef name: cardiowatch-secrets key: postgres-password"
    - from: "backend/Dockerfile CMD"
      to: "prisma migrate deploy"
      via: "shell entrypoint before node dist/app.js"
---

<objective>
Add the missing Kubernetes manifests for PostgreSQL and Redis, add a HOWTO block to secrets.yaml, wire prisma migrate deploy into the Dockerfile entrypoint, and create .env.production for the frontend build.

Purpose: The cluster manifests are incomplete — api-deployment.yaml references postgres and redis services that do not yet have deployment files. The Dockerfile also starts the app without running migrations, which will fail on a fresh cluster or after a schema change.
Output: Five files created or modified; no code logic changes.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@infrastructure/kubernetes/api-deployment.yaml
@infrastructure/kubernetes/secrets.yaml
@infrastructure/kubernetes/configmap.yaml
@backend/Dockerfile
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write postgres-deployment.yaml and redis-deployment.yaml</name>
  <files>infrastructure/kubernetes/postgres-deployment.yaml, infrastructure/kubernetes/redis-deployment.yaml</files>
  <action>
Create infrastructure/kubernetes/postgres-deployment.yaml with:

```yaml
# Namespace must exist first — apply namespace.yaml before this file
# kubectl apply -f infrastructure/kubernetes/
# Secrets must be populated — see secrets.yaml HOWTO block

apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: cardiowatch
  labels:
    app: cardiowatch
    component: postgres
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cardiowatch-postgres
  namespace: cardiowatch
  labels:
    app: cardiowatch
    component: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cardiowatch
      component: postgres
  strategy:
    type: Recreate        # Required for single-replica + PVC
  template:
    metadata:
      labels:
        app: cardiowatch
        component: postgres
    spec:
      securityContext:
        runAsUser: 999    # postgres user inside image
        fsGroup: 999
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - name: postgres
              containerPort: 5432
              protocol: TCP
          env:
            - name: POSTGRES_DB
              value: "cardiowatch"
            - name: POSTGRES_USER
              value: "cardiowatch"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: cardiowatch-secrets
                  key: postgres-password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            exec:
              command: ["pg_isready", "-U", "cardiowatch", "-d", "cardiowatch"]
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "cardiowatch", "-d", "cardiowatch"]
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: postgres-data
          persistentVolumeClaim:
            claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: cardiowatch-postgres
  namespace: cardiowatch
  labels:
    app: cardiowatch
    component: postgres
spec:
  type: ClusterIP
  ports:
    - port: 5432
      targetPort: postgres
      protocol: TCP
      name: postgres
  selector:
    app: cardiowatch
    component: postgres
```

Note on secrets.yaml: the existing `database-url` key should reference `cardiowatch-postgres:5432` as host once deployed. Add `postgres-password` key to secrets.yaml in Task 2.

Create infrastructure/kubernetes/redis-deployment.yaml with:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cardiowatch-redis
  namespace: cardiowatch
  labels:
    app: cardiowatch
    component: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cardiowatch
      component: redis
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        app: cardiowatch
        component: redis
    spec:
      securityContext:
        runAsUser: 999    # redis user inside image
        fsGroup: 999
      containers:
        - name: redis
          image: redis:7-alpine
          command: ["redis-server", "--requirepass", "$(REDIS_PASSWORD)"]
          ports:
            - name: redis
              containerPort: 6379
              protocol: TCP
          env:
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: cardiowatch-secrets
                  key: redis-password
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          livenessProbe:
            exec:
              command: ["redis-cli", "-a", "$(REDIS_PASSWORD)", "ping"]
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            exec:
              command: ["redis-cli", "-a", "$(REDIS_PASSWORD)", "ping"]
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
      # No PVC — Redis is used as cache only; data loss on restart is acceptable
```

```yaml
---
apiVersion: v1
kind: Service
metadata:
  name: cardiowatch-redis
  namespace: cardiowatch
  labels:
    app: cardiowatch
    component: redis
spec:
  type: ClusterIP
  ports:
    - port: 6379
      targetPort: redis
      protocol: TCP
      name: redis
  selector:
    app: cardiowatch
    component: redis
```

Both files must use namespace: cardiowatch, matching all existing manifests.
  </action>
  <verify>
    <automated>grep -l "kind: Deployment" /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/infrastructure/kubernetes/postgres-deployment.yaml /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/infrastructure/kubernetes/redis-deployment.yaml && grep "postgres:16-alpine" /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/infrastructure/kubernetes/postgres-deployment.yaml && grep "redis:7-alpine" /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/infrastructure/kubernetes/redis-deployment.yaml</automated>
  </verify>
  <done>Both files exist; postgres-deployment.yaml references image postgres:16-alpine and a PVC; redis-deployment.yaml references image redis:7-alpine with no PVC; both services target correct ports.</done>
</task>

<task type="auto">
  <name>Task 2: Update secrets.yaml with HOWTO block and new keys; create .env.production</name>
  <files>infrastructure/kubernetes/secrets.yaml, .env.production</files>
  <action>
Prepend a HOWTO comment block to infrastructure/kubernetes/secrets.yaml at the very top (before the existing WARNING comment), and add two new stringData keys: `postgres-password` and `redis-password`.

Replace the top of secrets.yaml so the file begins with:

```yaml
# ============================================================
# HOWTO: Populate secrets before deploying to the cluster
# ============================================================
#
# 1. Generate cryptographic secrets (run each command once):
#
#   JWT_SECRET:              openssl rand -base64 32
#   REFRESH_TOKEN_SECRET:    openssl rand -base64 32
#   COOKIE_SECRET:           openssl rand -base64 32
#   ENCRYPTION_KEY:          openssl rand -base64 32
#   POSTGRES_PASSWORD:       openssl rand -base64 24
#   REDIS_PASSWORD:          openssl rand -base64 24
#
# 2. Replace every "REPLACE_WITH_*" placeholder below with the
#    generated value.
#
# 3. Set database-url and redis-url to use the in-cluster service
#    names once postgres and redis are deployed:
#
#   database-url:
#     postgresql://cardiowatch:<POSTGRES_PASSWORD>@cardiowatch-postgres:5432/cardiowatch
#
#   redis-url:
#     redis://:<REDIS_PASSWORD>@cardiowatch-redis:6379
#
# 4. Apply the secret — do NOT commit the populated file to git:
#
#   kubectl apply -f infrastructure/kubernetes/secrets.yaml -n cardiowatch
#
# 5. For production, prefer external-secrets-operator or sealed-secrets
#    over storing plaintext values in this file.
# ============================================================
#
# WARNING: This is a template. Never commit actual secrets to git!
# Use kubectl create secret or external-secrets-operator in production
```

Then within the stringData block, add the following two new keys immediately after the existing `redis-url` line:

```yaml
  # PostgreSQL password (must match POSTGRES_PASSWORD in postgres-deployment.yaml)
  postgres-password: "REPLACE_WITH_SECURE_PASSWORD"

  # Redis password (must match REDIS_PASSWORD in redis-deployment.yaml)
  redis-password: "REPLACE_WITH_SECURE_PASSWORD"
```

Do not change any existing keys or values.

Create .env.production at the project root (next to package.json / vite.config.ts):

```
# Frontend production environment
# Used by Vite during `npm run build` for the production image

# Disable all mock/demo data in production builds
VITE_ENABLE_MOCK_DATA=false
VITE_ENABLE_PILOT_MOCK_DATA=false

# API base URL — requests are proxied through the ingress to the API service
# This must match the path prefix configured in the ingress resource
VITE_API_BASE_URL=/api/v1
```
  </action>
  <verify>
    <automated>grep -c "HOWTO" /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/infrastructure/kubernetes/secrets.yaml && grep "postgres-password" /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/infrastructure/kubernetes/secrets.yaml && grep "redis-password" /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/infrastructure/kubernetes/secrets.yaml && grep "VITE_ENABLE_MOCK_DATA=false" /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/.env.production</automated>
  </verify>
  <done>secrets.yaml starts with the HOWTO block and contains both postgres-password and redis-password keys; .env.production exists at project root with all three VITE_ vars set correctly.</done>
</task>

<task type="auto">
  <name>Task 3: Add prisma migrate deploy to backend Dockerfile entrypoint</name>
  <files>backend/Dockerfile</files>
  <action>
The current CMD in backend/Dockerfile is:

```dockerfile
CMD ["node", "dist/app.js"]
```

Replace it with a shell-form entrypoint that runs migrations before starting the server. The container already copies the prisma/ directory (line 56: `COPY --from=builder /app/prisma ./prisma`) and has npx available.

Replace the final CMD line with:

```dockerfile
# Run Prisma migrations then start server.
# Using shell form so the command runs in a shell that can chain statements.
# migrate deploy is idempotent — safe to run on every startup.
CMD npx prisma migrate deploy && node dist/app.js
```

Do not change any other line in the Dockerfile. The HEALTHCHECK and EXPOSE lines above CMD must remain unchanged.
  </action>
  <verify>
    <automated>grep -n "prisma migrate deploy" /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend/Dockerfile</automated>
  </verify>
  <done>backend/Dockerfile final CMD line is `CMD npx prisma migrate deploy && node dist/app.js`; all other lines unchanged.</done>
</task>

</tasks>

<verification>
After all tasks complete:

1. Both new manifests exist and are valid YAML:
   `python3 -c "import yaml; yaml.safe_load(open('infrastructure/kubernetes/postgres-deployment.yaml'))"` — no error
   `python3 -c "import yaml; yaml.safe_load(open('infrastructure/kubernetes/redis-deployment.yaml'))"` — no error

2. secrets.yaml still parses as valid YAML after the edits:
   `python3 -c "import yaml; list(yaml.safe_load_all(open('infrastructure/kubernetes/secrets.yaml')))"`

3. Dockerfile ends with the migrate+start command:
   `tail -3 backend/Dockerfile` should show the CMD line.

4. .env.production has no VITE_ENABLE_MOCK_DATA=true lines.
</verification>

<success_criteria>
- infrastructure/kubernetes/postgres-deployment.yaml: PVC (20Gi) + Deployment (postgres:16-alpine, single replica, Recreate strategy, password from secret) + ClusterIP Service on 5432
- infrastructure/kubernetes/redis-deployment.yaml: Deployment (redis:7-alpine, single replica, no PVC, password from secret) + ClusterIP Service on 6379
- infrastructure/kubernetes/secrets.yaml: HOWTO comment block at top, postgres-password and redis-password keys added, existing content unchanged
- backend/Dockerfile: CMD runs `npx prisma migrate deploy && node dist/app.js`
- .env.production: VITE_ENABLE_MOCK_DATA=false, VITE_ENABLE_PILOT_MOCK_DATA=false, VITE_API_BASE_URL=/api/v1
</success_criteria>

<output>
After completion, create `.planning/quick/9-infrastructure-manifests-postgres-redis/9-SUMMARY.md` with:
- Files created/modified
- Key decisions (e.g. Recreate strategy for PVC-backed postgres, no persistence for Redis)
- Any deviations from this plan
</output>
