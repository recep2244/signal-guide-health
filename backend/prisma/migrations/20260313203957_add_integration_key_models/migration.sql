-- CreateTable
CREATE TABLE "admin_integration_keys" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key_name" TEXT NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "value_fingerprint" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_rotated_at" TIMESTAMP(3),
    "last_validated_at" TIMESTAMP(3),
    "last_validation_status" TEXT,
    "last_validation_message" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_integration_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_integration_key_versions" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key_name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "value_fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rotation_reason" TEXT,
    "rotated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "admin_integration_key_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_integration_keys_provider_key_name_key" ON "admin_integration_keys"("provider", "key_name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_integration_key_versions_provider_key_name_version_key" ON "admin_integration_key_versions"("provider", "key_name", "version");

-- AddForeignKey
ALTER TABLE "admin_integration_key_versions" ADD CONSTRAINT "admin_integration_key_versions_provider_key_name_fkey" FOREIGN KEY ("provider", "key_name") REFERENCES "admin_integration_keys"("provider", "key_name") ON DELETE CASCADE ON UPDATE CASCADE;
