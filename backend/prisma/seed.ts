import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

function generatePassword(length = 20): string {
  return crypto.randomBytes(Math.ceil(length * 3 / 4))
    .toString('base64')
    .replace(/[+/=]/g, '')
    .slice(0, length);
}

type SeedUser = {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password: string;
};

type SeedPatient = {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  nhsNumber: string;
  dateOfBirth: string;
  whatsappPhone: string;
  triageLevel: 'red' | 'amber' | 'green';
  wellbeingScore: number;
  primaryDiagnosis: string;
};

const PILOT_USERS: Omit<SeedUser, 'password'>[] = [
  {
    email: 'admin@cardiowatch.nhs.uk',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    role: 'super_admin',
  },
  {
    email: 'ops@cardiowatch.nhs.uk',
    firstName: 'James',
    lastName: 'Wilson',
    role: 'admin',
  },
  {
    email: 'dr.patel@nhs.uk',
    firstName: 'Raj',
    lastName: 'Patel',
    role: 'doctor',
  },
];

const PILOT_PATIENTS: SeedPatient[] = [
  {
    key: 'pt-local-001',
    email: 'margaret.thompson@pilot.local',
    firstName: 'Margaret',
    lastName: 'Thompson',
    nhsNumber: '9876543210',
    dateOfBirth: '1952-03-15',
    whatsappPhone: '+447700900301',
    triageLevel: 'amber',
    wellbeingScore: 6,
    primaryDiagnosis: 'Heart Failure (HFrEF)',
  },
  {
    key: 'pt-local-002',
    email: 'david.chen@pilot.local',
    firstName: 'David',
    lastName: 'Chen',
    nhsNumber: '1234567890',
    dateOfBirth: '1958-07-22',
    whatsappPhone: '+447700900302',
    triageLevel: 'red',
    wellbeingScore: 4,
    primaryDiagnosis: 'Acute Myocardial Infarction',
  },
  {
    key: 'pt-local-003',
    email: 'sarah.okonkwo@pilot.local',
    firstName: 'Sarah',
    lastName: 'Okonkwo',
    nhsNumber: '5678901234',
    dateOfBirth: '1965-11-08',
    whatsappPhone: '+447700900303',
    triageLevel: 'green',
    wellbeingScore: 8,
    primaryDiagnosis: 'Atrial Fibrillation',
  },
];

async function upsertUser(user: SeedUser, organizationId: string): Promise<void> {
  const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);

  const created = await prisma.user.upsert({
    where: { email: user.email.toLowerCase() },
    update: {
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: 'active',
      emailVerified: true,
      organizationId,
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: user.email.toLowerCase(),
      passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: 'active',
      emailVerified: true,
      organizationId,
    },
  });

  if (user.role === 'admin' || user.role === 'super_admin') {
    await prisma.admin.upsert({
      where: { userId: created.id },
      update: {
        adminLevel: user.role === 'super_admin' ? 'super' : 'standard',
        canManageDoctors: true,
        canManagePatients: true,
        canManageAdmins: user.role === 'super_admin',
        canViewAnalytics: true,
        canManageSettings: true,
      },
      create: {
        userId: created.id,
        adminLevel: user.role === 'super_admin' ? 'super' : 'standard',
        canManageDoctors: true,
        canManagePatients: true,
        canManageAdmins: user.role === 'super_admin',
        canViewAnalytics: true,
        canManageSettings: true,
      },
    });
  }

  if (user.role === 'doctor' || user.role === 'nurse') {
    await prisma.doctor.upsert({
      where: { userId: created.id },
      update: {
        specialty: 'cardiology',
        department: 'Cardiology',
        jobTitle: user.role === 'doctor' ? 'Consultant' : 'Specialist Nurse',
      },
      create: {
        userId: created.id,
        specialty: 'cardiology',
        department: 'Cardiology',
        jobTitle: user.role === 'doctor' ? 'Consultant' : 'Specialist Nurse',
      },
    });
  }
}

async function upsertPatient(
  patient: SeedPatient,
  organizationId: string,
  password: string
): Promise<{ userId: string; patientId: string }> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const createdUser = await prisma.user.upsert({
    where: { email: patient.email.toLowerCase() },
    update: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      role: 'patient',
      status: 'active',
      emailVerified: true,
      organizationId,
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: patient.email.toLowerCase(),
      passwordHash,
      firstName: patient.firstName,
      lastName: patient.lastName,
      role: 'patient',
      status: 'active',
      emailVerified: true,
      organizationId,
    },
  });

  const createdPatient = await prisma.patient.upsert({
    where: { userId: createdUser.id },
    update: {
      nhsNumber: patient.nhsNumber,
      dateOfBirth: new Date(patient.dateOfBirth),
      primaryDiagnosis: patient.primaryDiagnosis,
      triageLevel: patient.triageLevel,
      wellbeingScore: patient.wellbeingScore,
      whatsappPhone: patient.whatsappPhone,
      whatsappOptedIn: true,
      dataSharingConsent: true,
      researchConsent: true,
      consentDate: new Date(),
      dischargeDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      lastCheckIn: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    create: {
      userId: createdUser.id,
      nhsNumber: patient.nhsNumber,
      dateOfBirth: new Date(patient.dateOfBirth),
      primaryDiagnosis: patient.primaryDiagnosis,
      triageLevel: patient.triageLevel,
      wellbeingScore: patient.wellbeingScore,
      whatsappPhone: patient.whatsappPhone,
      whatsappOptedIn: true,
      dataSharingConsent: true,
      researchConsent: true,
      consentDate: new Date(),
      dischargeDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      lastCheckIn: new Date(Date.now() - 2 * 60 * 60 * 1000),
      allergies: [],
      chronicConditions: [],
      secondaryDiagnoses: [],
      cardiacDevices: [],
    },
  });

  return { userId: createdUser.id, patientId: createdPatient.id };
}

async function ensureDoctorAssignments(doctorId: string, patientIds: string[]): Promise<void> {
  for (const patientId of patientIds) {
    const existing = await prisma.doctorPatientAssignment.findFirst({
      where: { doctorId, patientId },
      select: { id: true },
    });

    if (existing) {
      await prisma.doctorPatientAssignment.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          isPrimary: true,
        },
      });
      continue;
    }

    await prisma.doctorPatientAssignment.create({
      data: {
        doctorId,
        patientId,
        isPrimary: true,
        status: 'active',
      },
    });
  }
}

async function seedPilotOperationalData(
  patientIdsByKey: Record<string, string>,
  doctorId: string
): Promise<void> {
  const now = Date.now();

  for (const patient of PILOT_PATIENTS) {
    const patientId = patientIdsByKey[patient.key];
    if (!patientId) continue;

    await prisma.conversation.upsert({
      where: { id: `conv-${patient.key}` },
      update: {
        channel: 'whatsapp',
        status: 'active',
        currentFlow: 'symptoms',
        assignedDoctorId: doctorId,
        lastMessageAt: new Date(now - 10 * 60 * 1000),
      },
      create: {
        id: `conv-${patient.key}`,
        patientId,
        channel: 'whatsapp',
        status: 'active',
        currentFlow: 'symptoms',
        assignedDoctorId: doctorId,
        startedAt: new Date(now - 30 * 60 * 1000),
        lastMessageAt: new Date(now - 10 * 60 * 1000),
      },
    });

    await prisma.chatMessage.upsert({
      where: { id: `msg-out-${patient.key}` },
      update: {
        content:
          'Hi, this is your CardioWatch daily follow-up. On a scale from 0 to 10, how are you feeling today?',
        flowStep: 'wellbeing',
        direction: 'outbound',
        senderType: 'system',
        whatsappStatus: 'read',
      },
      create: {
        id: `msg-out-${patient.key}`,
        patientId,
        channel: 'whatsapp',
        direction: 'outbound',
        senderType: 'system',
        content:
          'Hi, this is your CardioWatch daily follow-up. On a scale from 0 to 10, how are you feeling today?',
        flowStep: 'wellbeing',
        whatsappStatus: 'read',
        isAutomated: true,
        createdAt: new Date(now - 20 * 60 * 1000),
      },
    });

    await prisma.chatMessage.upsert({
      where: { id: `msg-in-${patient.key}` },
      update: {
        content: String(patient.wellbeingScore),
        flowStep: 'wellbeing',
        direction: 'inbound',
        senderType: 'patient',
        whatsappStatus: 'received',
      },
      create: {
        id: `msg-in-${patient.key}`,
        patientId,
        channel: 'whatsapp',
        direction: 'inbound',
        senderType: 'patient',
        content: String(patient.wellbeingScore),
        flowStep: 'wellbeing',
        whatsappStatus: 'received',
        createdAt: new Date(now - 12 * 60 * 1000),
      },
    });

    await prisma.checkIn.upsert({
      where: { id: `checkin-${patient.key}` },
      update: {
        channel: 'whatsapp',
        wellbeingScore: patient.wellbeingScore,
        triageOutcome: patient.triageLevel,
        medicationsTaken: true,
        requiresCallback: patient.triageLevel === 'red',
      },
      create: {
        id: `checkin-${patient.key}`,
        patientId,
        channel: 'whatsapp',
        wellbeingScore: patient.wellbeingScore,
        triageOutcome: patient.triageLevel,
        medicationsTaken: true,
        requiresCallback: patient.triageLevel === 'red',
        timestamp: new Date(now - 11 * 60 * 1000),
      },
    });

    const isApple = patient.key !== 'pt-local-002';
    const deviceType = isApple ? 'apple_watch' : 'health_connect';
    const deviceName = isApple ? 'Apple Watch Series 9' : 'Pixel Watch';

    await prisma.wearableDevice.upsert({
      where: { id: `device-${patient.key}` },
      update: {
        deviceType,
        deviceName,
        deviceModel: isApple ? 'S9' : 'Pixel',
        serialNumber: `${patient.key.toUpperCase()}-SERIAL`,
        isConnected: true,
        connectionStatus: 'connected',
        batteryLevel: isApple ? 72 : 58,
        lastSyncAt: new Date(now - 25 * 60 * 1000),
      },
      create: {
        id: `device-${patient.key}`,
        patientId,
        deviceType,
        deviceName,
        deviceModel: isApple ? 'S9' : 'Pixel',
        serialNumber: `${patient.key.toUpperCase()}-SERIAL`,
        isConnected: true,
        connectionStatus: 'connected',
        batteryLevel: isApple ? 72 : 58,
        lastSyncAt: new Date(now - 25 * 60 * 1000),
      },
    });

    await prisma.wearableReading.upsert({
      where: { id: `reading-${patient.key}` },
      update: {
        restingHeartRate: patient.triageLevel === 'red' ? 92 : patient.triageLevel === 'amber' ? 82 : 69,
        avgHeartRate: patient.triageLevel === 'red' ? 101 : patient.triageLevel === 'amber' ? 88 : 74,
        hrvMs: patient.triageLevel === 'red' ? 20 : patient.triageLevel === 'amber' ? 27 : 43,
        steps: patient.triageLevel === 'red' ? 1800 : patient.triageLevel === 'amber' ? 3200 : 7600,
        sleepHours: patient.triageLevel === 'red' ? 4.9 : patient.triageLevel === 'amber' ? 5.8 : 7.7,
        bloodOxygenPercent: patient.triageLevel === 'red' ? 93 : 95,
      },
      create: {
        id: `reading-${patient.key}`,
        patientId,
        deviceId: `device-${patient.key}`,
        readingDate: new Date(),
        restingHeartRate: patient.triageLevel === 'red' ? 92 : patient.triageLevel === 'amber' ? 82 : 69,
        avgHeartRate: patient.triageLevel === 'red' ? 101 : patient.triageLevel === 'amber' ? 88 : 74,
        hrvMs: patient.triageLevel === 'red' ? 20 : patient.triageLevel === 'amber' ? 27 : 43,
        steps: patient.triageLevel === 'red' ? 1800 : patient.triageLevel === 'amber' ? 3200 : 7600,
        sleepHours: patient.triageLevel === 'red' ? 4.9 : patient.triageLevel === 'amber' ? 5.8 : 7.7,
        bloodOxygenPercent: patient.triageLevel === 'red' ? 93 : 95,
      },
    });
  }
}

async function main(): Promise<void> {
  const generatedPasswords: Record<string, string> = {};
  for (const user of PILOT_USERS) {
    generatedPasswords[user.email] = generatePassword();
  }
  const patientPassword = generatePassword();

  const org = await prisma.organization.upsert({
    where: { id: 'org-local-001' },
    update: {
      name: 'CardioWatch Local Pilot',
      type: 'hospital',
      email: 'admin@cardiowatch.local',
    },
    create: {
      id: 'org-local-001',
      name: 'CardioWatch Local Pilot',
      type: 'hospital',
      email: 'admin@cardiowatch.local',
      settings: {},
    },
  });

  for (const user of PILOT_USERS) {
    await upsertUser({ ...user, password: generatedPasswords[user.email]! }, org.id);
  }

  const doctorUser = await prisma.user.findUnique({
    where: { email: 'dr.patel@nhs.uk' },
    select: { id: true },
  });

  const doctorRecord = doctorUser
    ? await prisma.doctor.findUnique({
        where: { userId: doctorUser.id },
        select: { id: true },
      })
    : null;

  if (!doctorRecord) {
    throw new Error('Doctor seed user was not created correctly.');
  }

  const patientIdsByKey: Record<string, string> = {};
  for (const patient of PILOT_PATIENTS) {
    const result = await upsertPatient(patient, org.id, patientPassword);
    patientIdsByKey[patient.key] = result.patientId;
  }

  await ensureDoctorAssignments(doctorRecord.id, Object.values(patientIdsByKey));
  await seedPilotOperationalData(patientIdsByKey, doctorRecord.id);

  console.log('\n=== GENERATED PILOT CREDENTIALS (save these — shown once) ===');
  for (const user of PILOT_USERS) {
    console.log(`${user.email}  ${generatedPasswords[user.email]}`);
  }
  console.log(`patient accounts (all):  ${patientPassword}`);
  console.log('=============================================================\n');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
