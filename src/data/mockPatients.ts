export type TriageLevel = 'green' | 'amber' | 'red';

export interface WearableReading {
  date: string;
  restingHR: number;
  hrv: number;
  sleepHours: number;
  steps: number;
}

export interface ChatMessage {
  id: string;
  role: 'patient' | 'agent';
  content: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  type: 'red' | 'amber';
  headline: string;
  description: string;
  timestamp: string;
  resolved: boolean;
}

export interface SBARSummary {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  condition: string;
  dischargeDate: string;
  triageLevel: TriageLevel;
  lastCheckIn: string;
  wellbeingScore: number;
  avatar?: string;
  wearableData: WearableReading[];
  chatHistory: ChatMessage[];
  alerts: Alert[];
  sbar: SBARSummary;
  medications: string[];
  nhsNumber: string;
}

const createSeededRandom = (seed: number) => {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

// Generate last 14 days of dates
const generateDates = (days: number): string[] => {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

const dates = generateDates(14);
const patient1Rand = createSeededRandom(12001);
const patient2Rand = createSeededRandom(12002);
const patient3Rand = createSeededRandom(12003);

export const mockPatients: Patient[] = [
  {
    id: 'pt-001',
    name: 'Margaret Thompson',
    age: 72,
    gender: 'Female',
    condition: 'Post-PCI (LAD stent)',
    dischargeDate: '2026-01-02',
    triageLevel: 'red',
    lastCheckIn: '2026-01-16T09:15:00',
    wellbeingScore: 4,
    nhsNumber: '943 476 5919',
    medications: ['Aspirin 75mg', 'Clopidogrel 75mg', 'Atorvastatin 80mg', 'Bisoprolol 2.5mg'],
    wearableData: dates.map((date, i) => ({
      date,
      restingHR: i < 10 ? 68 + patient1Rand() * 5 : 78 + i * 2 + patient1Rand() * 8, // Trending up last 4 days
      hrv: i < 10 ? 42 + patient1Rand() * 8 : 35 - i * 0.5 + patient1Rand() * 5, // Declining
      sleepHours: i < 10 ? 6.5 + patient1Rand() : 4.5 + patient1Rand() * 1.5, // Poor sleep
      steps: i < 10 ? 4500 + patient1Rand() * 1500 : 1200 + patient1Rand() * 800, // Activity dropped
    })),
    chatHistory: [
      { id: 'msg-1', role: 'agent', content: 'Good morning Margaret. How are you feeling today on a scale of 0-10?', timestamp: '2026-01-16T09:00:00' },
      { id: 'msg-2', role: 'patient', content: 'Not great, maybe a 4. I woke up with chest tightness again.', timestamp: '2026-01-16T09:05:00' },
      { id: 'msg-3', role: 'agent', content: 'I\'m sorry to hear that. Can you tell me more about the chest tightness? When did it start and how severe is it (0-10)?', timestamp: '2026-01-16T09:06:00' },
      { id: 'msg-4', role: 'patient', content: 'Started about an hour ago. Maybe a 6. It feels like pressure in the middle of my chest. I\'m also a bit short of breath just sitting here.', timestamp: '2026-01-16T09:10:00' },
      { id: 'msg-5', role: 'agent', content: '⚠️ Margaret, these symptoms are concerning and need urgent attention. Chest pressure with shortness of breath at rest requires immediate medical evaluation.\n\n**Please seek urgent care now or call 999 if symptoms worsen.**\n\nI\'m alerting your care team immediately. Stay where you are and do not exert yourself.', timestamp: '2026-01-16T09:11:00' },
      { id: 'msg-6', role: 'patient', content: 'Ok, my daughter is here. Should we go to A&E?', timestamp: '2026-01-16T09:15:00' },
      { id: 'msg-7', role: 'agent', content: 'Yes, please go to A&E now. Your symptoms combined with your recent stent procedure need in-person evaluation. Your care team has been notified. Take your medications list with you.', timestamp: '2026-01-16T09:16:00' },
    ],
    alerts: [
      {
        id: 'alert-1',
        type: 'red',
        headline: 'URGENT: Chest pressure + breathlessness at rest',
        description: 'Patient reports 6/10 chest pressure lasting 1 hour with concurrent shortness of breath while seated. 14 days post-PCI. Resting HR elevated 18bpm above baseline. Immediate evaluation required.',
        timestamp: '2026-01-16T09:11:00',
        resolved: false,
      },
    ],
    sbar: {
      situation: 'Margaret Thompson, 72F, reports chest pressure (6/10) and shortness of breath at rest. Symptoms started 1 hour ago. Patient rates overall wellbeing 4/10.',
      background: 'Post-PCI (LAD stent) discharged 14 days ago. On dual antiplatelet therapy. Wearables show resting HR 88bpm (baseline 70bpm), HRV dropped 25%, sleep 4.2 hours last night, activity significantly reduced.',
      assessment: 'HIGH RISK. Red-flag symptoms in post-PCI patient. Wearable trends corroborate clinical deterioration over past 4 days. Concerned for possible in-stent thrombosis, unstable angina, or heart failure exacerbation.',
      recommendation: 'URGENT same-day evaluation. Patient advised to attend A&E. Consider ECG, troponins, echo. Contact cardiology on-call if not already notified.',
    },
  },
  {
    id: 'pt-002',
    name: 'David Chen',
    age: 65,
    gender: 'Male',
    condition: 'Post-MI (NSTEMI)',
    dischargeDate: '2026-01-08',
    triageLevel: 'amber',
    lastCheckIn: '2026-01-16T08:30:00',
    wellbeingScore: 6,
    nhsNumber: '456 789 1234',
    medications: ['Aspirin 75mg', 'Ticagrelor 90mg BD', 'Ramipril 2.5mg', 'Bisoprolol 5mg', 'Atorvastatin 80mg'],
    wearableData: dates.map((date, i) => ({
      date,
      restingHR: 72 + patient2Rand() * 6 + (i > 10 ? 8 : 0), // Slight uptick last 3 days
      hrv: 38 + patient2Rand() * 10 - (i > 10 ? 5 : 0),
      sleepHours: i > 10 ? 5.2 + patient2Rand() : 7 + patient2Rand(),
      steps: i > 10 ? 3000 + patient2Rand() * 1000 : 5500 + patient2Rand() * 1500,
    })),
    chatHistory: [
      { id: 'msg-1', role: 'agent', content: 'Good morning David. How are you feeling today on a scale of 0-10?', timestamp: '2026-01-16T08:00:00' },
      { id: 'msg-2', role: 'patient', content: 'About a 6 I suppose. Had a rough night, couldn\'t sleep well.', timestamp: '2026-01-16T08:10:00' },
      { id: 'msg-3', role: 'agent', content: 'I\'m sorry to hear about your sleep. Have you noticed any chest pain, shortness of breath, or fainting?', timestamp: '2026-01-16T08:11:00' },
      { id: 'msg-4', role: 'patient', content: 'No chest pain. But I do get a bit more breathless when I climb stairs now. More than last week.', timestamp: '2026-01-16T08:20:00' },
      { id: 'msg-5', role: 'agent', content: 'Thank you for sharing that. I notice your activity and sleep have both changed in the last few days. The increased breathlessness on exertion is worth reviewing with your care team.\n\nI\'m flagging this for same-day review. You don\'t need A&E, but your team will be in touch today.', timestamp: '2026-01-16T08:22:00' },
      { id: 'msg-6', role: 'patient', content: 'Ok thanks. Should I rest more or try to keep active?', timestamp: '2026-01-16T08:30:00' },
      { id: 'msg-7', role: 'agent', content: 'Light activity as you feel able is good, but don\'t push yourself if you feel breathless. Rest if needed. Your care team will advise further when they contact you today.', timestamp: '2026-01-16T08:31:00' },
    ],
    alerts: [
      {
        id: 'alert-2',
        type: 'amber',
        headline: 'Review today: Worsening exertional breathlessness',
        description: 'Patient reports increased breathlessness on stairs compared to last week. Poor sleep x3 nights. Resting HR up ~10bpm from baseline. 8 days post-NSTEMI. No chest pain or rest symptoms.',
        timestamp: '2026-01-16T08:22:00',
        resolved: false,
      },
    ],
    sbar: {
      situation: 'David Chen, 65M, reports worsening breathlessness on exertion and poor sleep for 3 nights. Wellbeing 6/10. No chest pain or rest symptoms.',
      background: 'Post-NSTEMI discharged 8 days ago. On optimal medical therapy. Wearables show resting HR 82bpm (baseline 72bpm), reduced sleep (5h vs 7h baseline), reduced activity (3,200 vs 6,000 steps).',
      assessment: 'AMBER - Possible early HF symptoms or deconditioning. Wearable trends suggest subtle decline. Not urgent but warrants same-day clinical review.',
      recommendation: 'Same-day phone review. Consider bringing forward outpatient appointment. Check weight, ask about ankle swelling. May need echo or NT-proBNP if symptoms persist.',
    },
  },
  {
    id: 'pt-003',
    name: 'Sarah Okonkwo',
    age: 58,
    gender: 'Female',
    condition: 'Post-AF ablation',
    dischargeDate: '2026-01-10',
    triageLevel: 'green',
    lastCheckIn: '2026-01-16T07:45:00',
    wellbeingScore: 8,
    nhsNumber: '789 123 4567',
    medications: ['Rivaroxaban 20mg', 'Bisoprolol 2.5mg', 'Omeprazole 20mg'],
    wearableData: dates.map((date) => ({
      date,
      restingHR: 64 + patient3Rand() * 6,
      hrv: 48 + patient3Rand() * 12,
      sleepHours: 7 + patient3Rand() * 1.5,
      steps: 6500 + patient3Rand() * 2500,
    })),
    chatHistory: [
      { id: 'msg-1', role: 'agent', content: 'Good morning Sarah. How are you feeling today on a scale of 0-10?', timestamp: '2026-01-16T07:30:00' },
      { id: 'msg-2', role: 'patient', content: 'Feeling good! I\'d say an 8. Best I\'ve felt in weeks actually.', timestamp: '2026-01-16T07:35:00' },
      { id: 'msg-3', role: 'agent', content: 'That\'s wonderful to hear! Any chest pain, palpitations, shortness of breath, or dizziness?', timestamp: '2026-01-16T07:36:00' },
      { id: 'msg-4', role: 'patient', content: 'None of those. I did a 30 minute walk yesterday with no issues. Sleeping much better too now that my heart isn\'t racing at night.', timestamp: '2026-01-16T07:42:00' },
      { id: 'msg-5', role: 'agent', content: 'Excellent progress! Your wearable data looks stable and healthy. Your resting heart rate and heart rate variability are both in great ranges.\n\nKeep up the walking—it\'s helping your recovery. I\'ll check in again tomorrow. Take care!', timestamp: '2026-01-16T07:45:00' },
    ],
    alerts: [],
    sbar: {
      situation: 'Sarah Okonkwo, 58F, feeling well (8/10). No symptoms. Walking 30 minutes without issues.',
      background: 'Post-AF ablation discharged 6 days ago. On anticoagulation. Procedure uncomplicated.',
      assessment: 'GREEN - Excellent recovery. All wearable metrics stable and within healthy ranges. Patient engaging well with activity.',
      recommendation: 'Continue routine monitoring. No action required. Routine outpatient follow-up as scheduled.',
    },
  },
];

export const applyResolvedAlerts = (
  patients: Patient[],
  resolvedAlertIds: Set<string>
): Patient[] => {
  if (resolvedAlertIds.size === 0) return patients;
  return patients.map((patient) => ({
    ...patient,
    alerts: patient.alerts.map((alert) =>
      resolvedAlertIds.has(alert.id) ? { ...alert, resolved: true } : alert
    ),
  }));
};

export const getPatientById = (
  id: string,
  patients: Patient[] = mockPatients
): Patient | undefined => {
  return patients.find((patient) => patient.id === id);
};

export const getTriageStats = (patients: Patient[] = mockPatients) => {
  return {
    red: patients.filter((p) => p.triageLevel === 'red').length,
    amber: patients.filter((p) => p.triageLevel === 'amber').length,
    green: patients.filter((p) => p.triageLevel === 'green').length,
    total: patients.length,
  };
};
