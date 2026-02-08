import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage, Patient } from '@/types/patient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  User,
  Bot,
  Send,
  Heart,
  Pill,
  Activity,
  AlertTriangle,
  Stethoscope,
  ThermometerSun,
  Brain,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Clock,
} from 'lucide-react';

// ============================================================================
// MEDICAL KNOWLEDGE BASE
// ============================================================================

interface MedicalResponse {
  content: string;
  category: 'symptom' | 'medication' | 'recovery' | 'emergency' | 'general' | 'vitals';
  urgency: 'low' | 'medium' | 'high';
  followUp?: string[];
}

const MEDICAL_KNOWLEDGE: Record<string, MedicalResponse> = {
  'chest pain': {
    content:
      'Chest pain after a cardiac procedure needs careful evaluation.\n\n' +
      '**Seek immediate help (call 999) if:**\n' +
      '- Pain is severe, crushing, or spreading to arm/jaw\n' +
      '- Accompanied by shortness of breath at rest\n' +
      '- Cold sweats, nausea, or feeling faint\n\n' +
      '**Monitor at home if:**\n' +
      '- Mild discomfort that resolves with rest\n' +
      '- Brief twinges lasting seconds\n' +
      '- Related to movement/position changes\n\n' +
      'Your care team has been notified of this query.',
    category: 'emergency',
    urgency: 'high',
    followUp: ['When did the pain start?', 'Rate pain severity 1-10', 'Any other symptoms?'],
  },
  'shortness of breath': {
    content:
      'Breathlessness is an important symptom to track post-procedure.\n\n' +
      '**Concerning signs (seek urgent care):**\n' +
      '- Breathless at rest or lying flat\n' +
      '- Waking up gasping at night\n' +
      '- Getting worse over hours\n' +
      '- Accompanied by chest pain or swelling\n\n' +
      '**Expected recovery pattern:**\n' +
      '- Mild breathlessness with exertion is normal initially\n' +
      '- Should gradually improve over 2-4 weeks\n' +
      '- Gentle activity helps build tolerance\n\n' +
      'I recommend tracking when breathlessness occurs and sharing this with your care team.',
    category: 'symptom',
    urgency: 'medium',
    followUp: ['Does it happen at rest or with activity?', 'Is it worse than yesterday?'],
  },
  'palpitations': {
    content:
      'Palpitations (feeling your heart race, skip, or flutter) are common after cardiac procedures.\n\n' +
      '**What to watch for:**\n' +
      '- Duration: Brief (seconds) vs sustained (minutes+)\n' +
      '- Frequency: Occasional vs happening daily\n' +
      '- Triggers: Activity, caffeine, stress, position\n\n' +
      '**When to seek help:**\n' +
      '- Sustained rapid heartbeat (>15 minutes)\n' +
      '- Accompanied by dizziness or fainting\n' +
      '- Chest pain during episodes\n\n' +
      '**Self-care tips:**\n' +
      '- Reduce caffeine and alcohol\n' +
      '- Practice slow, deep breathing during episodes\n' +
      '- Your Apple Watch can help log heart rate during episodes',
    category: 'symptom',
    urgency: 'medium',
    followUp: ['How long do episodes last?', 'How often do they occur?'],
  },
  'dizzy': {
    content:
      'Dizziness after a cardiac procedure can have several causes.\n\n' +
      '**Common causes:**\n' +
      '- Blood pressure changes (especially when standing)\n' +
      '- Medication side effects (beta-blockers, ACE inhibitors)\n' +
      '- Dehydration\n' +
      '- Anaemia\n\n' +
      '**When to seek help:**\n' +
      '- Fainting or near-fainting episodes\n' +
      '- Dizziness with chest pain or palpitations\n' +
      '- Persistent dizziness not improving\n\n' +
      '**Self-care:**\n' +
      '- Stand up slowly from sitting/lying\n' +
      '- Stay well hydrated (1.5-2L water daily)\n' +
      '- Avoid sudden position changes',
    category: 'symptom',
    urgency: 'medium',
    followUp: ['When does it happen?', 'Any falls or near-falls?'],
  },
  'swelling': {
    content:
      'Swelling in the legs or ankles is an important sign to monitor.\n\n' +
      '**Possible causes post-procedure:**\n' +
      '- Fluid retention (possible heart failure sign)\n' +
      '- Medication side effects\n' +
      '- Reduced activity/mobility\n' +
      '- Access site complications (if groin/wrist was used)\n\n' +
      '**When to contact your care team:**\n' +
      '- Sudden or worsening swelling\n' +
      '- One leg significantly more swollen than the other\n' +
      '- Accompanied by breathlessness\n' +
      '- Weight gain >1.5kg in 24 hours\n\n' +
      '**Self-monitoring:**\n' +
      '- Weigh yourself daily at the same time\n' +
      '- Elevate feet when sitting\n' +
      '- Reduce salt intake',
    category: 'symptom',
    urgency: 'medium',
    followUp: ['Which areas are swollen?', 'When did you first notice it?'],
  },
  'medication': {
    content:
      'Here is general guidance on common cardiac medications:\n\n' +
      '**Antiplatelet therapy (Aspirin, Clopidogrel, Ticagrelor):**\n' +
      '- Take as prescribed - do NOT stop without medical advice\n' +
      '- Critical for preventing blood clots after stent procedures\n' +
      '- Report any unusual bleeding or bruising\n\n' +
      '**Beta-blockers (Bisoprolol, Atenolol):**\n' +
      '- Helps control heart rate and blood pressure\n' +
      '- May cause tiredness, cold hands, or dizziness initially\n' +
      '- Take at the same time each day\n\n' +
      '**Statins (Atorvastatin):**\n' +
      '- Protects blood vessels long-term\n' +
      '- Report persistent muscle pain\n' +
      '- Best taken in the evening\n\n' +
      '**ACE inhibitors (Ramipril):**\n' +
      '- Protects heart function\n' +
      '- Dry cough is a known side effect\n' +
      '- Report any facial swelling immediately',
    category: 'medication',
    urgency: 'low',
    followUp: ['Which medication are you asking about?', 'Are you experiencing side effects?'],
  },
  'sleep': {
    content:
      'Good sleep is crucial for cardiac recovery.\n\n' +
      '**Common sleep challenges post-procedure:**\n' +
      '- Difficulty finding comfortable positions\n' +
      '- Anxiety about heart condition\n' +
      '- Medication side effects\n' +
      '- Pain or discomfort\n\n' +
      '**Sleep hygiene tips:**\n' +
      '- Maintain a consistent bedtime routine\n' +
      '- Avoid screens 1 hour before bed\n' +
      '- Keep bedroom cool and dark\n' +
      '- Limit caffeine after 2pm\n' +
      '- Light physical activity during the day helps\n\n' +
      '**Warning signs:**\n' +
      '- Waking up breathless (orthopnoea) - contact care team\n' +
      '- Needing extra pillows to breathe comfortably\n' +
      '- Persistent insomnia affecting daytime function\n\n' +
      'Your Apple Watch sleep data is being monitored for patterns.',
    category: 'recovery',
    urgency: 'low',
    followUp: ['How many hours are you sleeping?', 'Do you wake up breathless?'],
  },
  'exercise': {
    content:
      'Physical activity is essential for cardiac recovery, but needs to be gradual.\n\n' +
      '**Phase 1 (Week 1-2 post-discharge):**\n' +
      '- Short walks (5-10 minutes) several times daily\n' +
      '- Light household tasks\n' +
      '- Avoid lifting >5kg\n\n' +
      '**Phase 2 (Week 2-4):**\n' +
      '- Gradually increase walk duration (15-30 min)\n' +
      '- Gentle stretching\n' +
      '- Resume light daily activities\n\n' +
      '**Phase 3 (Week 4+):**\n' +
      '- Cardiac rehabilitation programme\n' +
      '- Moderate activity as tolerated\n' +
      '- Follow your care team\'s specific guidance\n\n' +
      '**Stop and rest if:**\n' +
      '- You feel chest pain or tightness\n' +
      '- Excessive breathlessness\n' +
      '- Dizziness or light-headedness\n' +
      '- Heart rate stays elevated for >10 min after stopping',
    category: 'recovery',
    urgency: 'low',
    followUp: ['How many days post-procedure are you?', 'What activity level are you at?'],
  },
  'diet': {
    content:
      'A heart-healthy diet supports your recovery and long-term cardiac health.\n\n' +
      '**Key dietary principles:**\n' +
      '- Reduce salt intake (<6g/day) to manage blood pressure\n' +
      '- Limit saturated fats (fatty meat, butter, cheese)\n' +
      '- Increase omega-3 fatty acids (oily fish 2x/week)\n' +
      '- Eat 5+ portions of fruit and vegetables daily\n' +
      '- Choose whole grains over refined carbohydrates\n\n' +
      '**Foods to limit:**\n' +
      '- Processed foods (high in salt and fat)\n' +
      '- Sugary drinks and snacks\n' +
      '- Excessive alcohol (max 14 units/week)\n' +
      '- Caffeine (max 3-4 cups tea/coffee daily)\n\n' +
      '**Heart-protective foods:**\n' +
      '- Nuts and seeds\n' +
      '- Berries and leafy greens\n' +
      '- Olive oil\n' +
      '- Oily fish (salmon, mackerel)',
    category: 'recovery',
    urgency: 'low',
  },
  'anxiety': {
    content:
      'Feeling anxious after a cardiac event is very common and completely understandable.\n\n' +
      '**What you may experience:**\n' +
      '- Worry about having another event\n' +
      '- Fear of physical activity\n' +
      '- Difficulty sleeping due to worry\n' +
      '- Hyperawareness of heartbeat\n' +
      '- Mood changes or irritability\n\n' +
      '**Coping strategies:**\n' +
      '- Talk to family, friends, or your care team about how you feel\n' +
      '- Gentle breathing exercises (4 sec in, 4 sec hold, 4 sec out)\n' +
      '- Gradual return to activities builds confidence\n' +
      '- Regular daily routine helps stability\n\n' +
      '**When to seek support:**\n' +
      '- Anxiety interferes with daily activities\n' +
      '- Persistent low mood for >2 weeks\n' +
      '- Panic attacks or severe distress\n\n' +
      'Your care team can refer you to cardiac psychology support if needed.',
    category: 'general',
    urgency: 'low',
    followUp: ['Would you like mental health support information?', 'How is this affecting your daily life?'],
  },
  'fatigue': {
    content:
      'Tiredness and fatigue are very common during cardiac recovery.\n\n' +
      '**Why you may feel tired:**\n' +
      '- Your body is healing from the procedure\n' +
      '- Medications (especially beta-blockers) can cause fatigue\n' +
      '- Disrupted sleep patterns\n' +
      '- Emotional stress and anxiety\n' +
      '- Reduced physical conditioning\n\n' +
      '**Recovery timeline:**\n' +
      '- Weeks 1-2: Significant fatigue is normal\n' +
      '- Weeks 2-4: Gradual improvement expected\n' +
      '- Month 2-3: Energy levels should be noticeably better\n\n' +
      '**Tips to manage:**\n' +
      '- Pace activities throughout the day\n' +
      '- Short naps (20-30 min) can help\n' +
      '- Stay hydrated and eat regular meals\n' +
      '- Gentle activity actually helps reduce fatigue',
    category: 'symptom',
    urgency: 'low',
    followUp: ['How many days post-discharge are you?', 'Is the fatigue getting better or worse?'],
  },
  'blood pressure': {
    content:
      'Monitoring blood pressure is essential after cardiac procedures.\n\n' +
      '**Target ranges:**\n' +
      '- Systolic: 120-140 mmHg (top number)\n' +
      '- Diastolic: 70-90 mmHg (bottom number)\n' +
      '- Below 90/60 may indicate medication needs adjusting\n\n' +
      '**When to contact care team:**\n' +
      '- Consistently above 160/100\n' +
      '- Below 90/60 with symptoms (dizziness, fatigue)\n' +
      '- Large fluctuations between readings\n\n' +
      '**Tips for accurate readings:**\n' +
      '- Sit quietly for 5 minutes before measuring\n' +
      '- Use the same arm each time\n' +
      '- Avoid caffeine 30 minutes before\n' +
      '- Take at the same time each day\n' +
      '- Record readings to share with your care team',
    category: 'vitals',
    urgency: 'low',
    followUp: ['What are your recent readings?', 'Are you monitoring at home?'],
  },
  'heart rate': {
    content:
      'Understanding your heart rate patterns aids recovery monitoring.\n\n' +
      '**Normal resting heart rate:** 60-100 bpm\n' +
      '**Your Apple Watch data** is automatically tracked.\n\n' +
      '**What changes to watch:**\n' +
      '- Resting HR rising >15 bpm above your baseline\n' +
      '- Sudden drops in heart rate variability (HRV)\n' +
      '- Irregular rhythms detected by your watch\n' +
      '- Heart rate not recovering after light activity\n\n' +
      '**HRV (Heart Rate Variability):**\n' +
      '- Higher HRV generally indicates good recovery\n' +
      '- Declining HRV may signal stress or deterioration\n' +
      '- Your trends are monitored by the clinical team\n\n' +
      'Your wearable data is being continuously analysed for patterns.',
    category: 'vitals',
    urgency: 'low',
    followUp: ['Are you noticing irregular heartbeats?', 'What is your typical resting HR?'],
  },
};

const QUICK_TOPICS = [
  { label: 'Chest pain', icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
  { label: 'Medications', icon: Pill, color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { label: 'Heart rate', icon: Heart, color: 'text-teal-600 bg-teal-50 border-teal-200 hover:bg-teal-100' },
  { label: 'Exercise', icon: Activity, color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100' },
  { label: 'Sleep', icon: ThermometerSun, color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { label: 'Anxiety', icon: Brain, color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
];

// ============================================================================
// RESPONSE MATCHING
// ============================================================================

function findBestResponse(query: string, patient: Patient): MedicalResponse {
  const lowerQuery = query.toLowerCase();

  // Check each knowledge base entry for keyword matches
  const matches: { key: string; score: number }[] = [];
  for (const key of Object.keys(MEDICAL_KNOWLEDGE)) {
    const keywords = key.split(' ');
    let score = 0;
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) score += 2;
    }
    // Check for related terms
    if (key === 'chest pain' && (lowerQuery.includes('chest') || lowerQuery.includes('pressure') || lowerQuery.includes('tightness'))) score += 3;
    if (key === 'shortness of breath' && (lowerQuery.includes('breath') || lowerQuery.includes('breathing') || lowerQuery.includes('breathless'))) score += 3;
    if (key === 'palpitations' && (lowerQuery.includes('palpitation') || lowerQuery.includes('racing') || lowerQuery.includes('flutter') || lowerQuery.includes('skipping'))) score += 3;
    if (key === 'dizzy' && (lowerQuery.includes('dizzy') || lowerQuery.includes('dizziness') || lowerQuery.includes('lightheaded') || lowerQuery.includes('faint'))) score += 3;
    if (key === 'swelling' && (lowerQuery.includes('swell') || lowerQuery.includes('ankle') || lowerQuery.includes('leg') || lowerQuery.includes('oedema'))) score += 3;
    if (key === 'medication' && (lowerQuery.includes('med') || lowerQuery.includes('drug') || lowerQuery.includes('pill') || lowerQuery.includes('tablet') || lowerQuery.includes('prescription'))) score += 3;
    if (key === 'sleep' && (lowerQuery.includes('sleep') || lowerQuery.includes('insomnia') || lowerQuery.includes('tired') || lowerQuery.includes('rest'))) score += 3;
    if (key === 'exercise' && (lowerQuery.includes('exercise') || lowerQuery.includes('walk') || lowerQuery.includes('activity') || lowerQuery.includes('physical') || lowerQuery.includes('gym'))) score += 3;
    if (key === 'diet' && (lowerQuery.includes('diet') || lowerQuery.includes('food') || lowerQuery.includes('eat') || lowerQuery.includes('nutrition') || lowerQuery.includes('salt'))) score += 3;
    if (key === 'anxiety' && (lowerQuery.includes('anxious') || lowerQuery.includes('anxiety') || lowerQuery.includes('worried') || lowerQuery.includes('scared') || lowerQuery.includes('fear') || lowerQuery.includes('panic') || lowerQuery.includes('mental') || lowerQuery.includes('mood') || lowerQuery.includes('depressed'))) score += 3;
    if (key === 'fatigue' && (lowerQuery.includes('fatigue') || lowerQuery.includes('tired') || lowerQuery.includes('exhausted') || lowerQuery.includes('weak') || lowerQuery.includes('energy'))) score += 3;
    if (key === 'blood pressure' && (lowerQuery.includes('blood pressure') || lowerQuery.includes('bp') || lowerQuery.includes('hypertension'))) score += 3;
    if (key === 'heart rate' && (lowerQuery.includes('heart rate') || lowerQuery.includes('pulse') || lowerQuery.includes('bpm') || lowerQuery.includes('hrv'))) score += 3;

    if (score > 0) matches.push({ key, score });
  }

  matches.sort((a, b) => b.score - a.score);
  if (matches.length > 0) {
    return MEDICAL_KNOWLEDGE[matches[0].key];
  }

  // Default contextual response based on patient data
  const latest = patient.wearableData[patient.wearableData.length - 1];
  return {
    content:
      `I understand your concern. Based on your latest data:\n\n` +
      `- Resting HR: ${Math.round(latest.restingHR)} bpm\n` +
      `- HRV: ${Math.round(latest.hrv)} ms\n` +
      `- Sleep: ${latest.sleepHours.toFixed(1)} hours\n` +
      `- Steps: ${Math.round(latest.steps).toLocaleString()}\n\n` +
      `For specific medical questions, try asking about:\n` +
      `- Symptoms (chest pain, breathlessness, palpitations, dizziness)\n` +
      `- Medications and side effects\n` +
      `- Exercise and recovery guidelines\n` +
      `- Diet and lifestyle advice\n` +
      `- Mental health and anxiety support\n\n` +
      `If you have an urgent concern, please contact your care team directly or call 999 for emergencies.`,
    category: 'general',
    urgency: 'low',
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

interface MedicalChatAssistantProps {
  messages: ChatMessage[];
  patient: Patient;
  className?: string;
}

export function MedicalChatAssistant({ messages, patient, className }: MedicalChatAssistantProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(messages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isTyping]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryBadge = (category: MedicalResponse['category']) => {
    const map = {
      emergency: { label: 'Urgent', class: 'bg-red-100 text-red-700 border-red-200' },
      symptom: { label: 'Symptom Guidance', class: 'bg-amber-100 text-amber-700 border-amber-200' },
      medication: { label: 'Medication Info', class: 'bg-blue-100 text-blue-700 border-blue-200' },
      recovery: { label: 'Recovery Advice', class: 'bg-green-100 text-green-700 border-green-200' },
      vitals: { label: 'Vital Signs', class: 'bg-teal-100 text-teal-700 border-teal-200' },
      general: { label: 'General', class: 'bg-slate-100 text-slate-700 border-slate-200' },
    };
    return map[category] || map.general;
  };

  const addAssistantResponse = (query: string) => {
    setIsTyping(true);
    const response = findBestResponse(query, patient);
    const badge = getCategoryBadge(response.category);

    setTimeout(() => {
      const newMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'agent',
        content:
          `[${badge.label}]\n\n${response.content}` +
          (response.urgency === 'high'
            ? '\n\n**This has been flagged to your care team.**'
            : ''),
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, newMessage]);
      setIsTyping(false);

      // Add follow-up suggestions if available
      if (response.followUp && response.followUp.length > 0) {
        setTimeout(() => {
          const followUpMessage: ChatMessage = {
            id: `followup-${Date.now()}`,
            role: 'agent',
            content: `Would you like to tell me more? You can ask:\n${response.followUp!.map((q) => `- ${q}`).join('\n')}`,
            timestamp: new Date().toISOString(),
          };
          setChatMessages((prev) => [...prev, followUpMessage]);
        }, 600);
      }
    }, 800 + Math.random() * 400);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'patient',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    const query = inputValue;
    setInputValue('');
    addAssistantResponse(query);
  };

  const handleQuickTopic = (topic: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'patient',
      content: topic,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    addAssistantResponse(topic);
  };

  const showQuickTopics = chatMessages.length <= messages.length;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-4 py-3 border-b z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Stethoscope size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Medical Assistant</h3>
              <p className="text-xs text-slate-500">
                {chatMessages.length} messages - Ask about symptoms, medications, or recovery
              </p>
            </div>
          </div>
          <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
            <ShieldCheck size={10} className="mr-1" />
            Clinician-Reviewed
          </Badge>
        </div>
      </div>

      {/* Quick Topics */}
      {showQuickTopics && (
        <div className="px-4 py-3 border-b bg-slate-50/50">
          <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
            <Sparkles size={12} className="text-teal-500" />
            Quick Topics - Ask the assistant about:
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TOPICS.map((topic) => {
              const Icon = topic.icon;
              return (
                <Button
                  key={topic.label}
                  variant="outline"
                  size="sm"
                  className={cn('text-xs h-8 px-3 rounded-full gap-1.5 border', topic.color)}
                  onClick={() => handleQuickTopic(topic.label)}
                >
                  <Icon size={12} />
                  {topic.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto max-h-[500px] scrollbar-thin">
        <div className="space-y-4 p-4">
          {chatMessages.map((message, index) => {
            const isNew = index >= messages.length;
            return (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3 animate-fade-in',
                  message.role === 'patient' ? 'flex-row' : 'flex-row-reverse'
                )}
                style={{ animationDelay: isNew ? '0ms' : `${index * 50}ms` }}
              >
                <div
                  className={cn(
                    'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    message.role === 'patient'
                      ? 'bg-secondary'
                      : isNew
                        ? 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-md shadow-teal-500/20'
                        : 'bg-primary'
                  )}
                >
                  {message.role === 'patient' ? (
                    <User size={16} className="text-secondary-foreground" />
                  ) : isNew ? (
                    <Stethoscope size={14} className="text-white" />
                  ) : (
                    <Bot size={16} className="text-primary-foreground" />
                  )}
                </div>

                <div
                  className={cn(
                    'flex flex-col gap-1 max-w-[85%]',
                    message.role === 'patient' ? 'items-start' : 'items-end'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                      message.role === 'patient'
                        ? 'bg-teal-600 text-white rounded-bl-md'
                        : isNew
                          ? 'bg-white border-2 border-slate-200 text-slate-700 rounded-br-md shadow-sm'
                          : 'chat-bubble chat-bubble-agent'
                    )}
                  >
                    {message.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
                    <Clock size={8} />
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3 flex-row-reverse animate-fade-in">
              <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md shadow-teal-500/20">
                <Stethoscope size={14} className="text-white" />
              </div>
              <div className="bg-white border-2 border-slate-200 rounded-2xl rounded-br-md px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200">
            <ShieldCheck size={8} className="mr-1" />
            Not a substitute for medical advice - contact your care team for urgent concerns
          </Badge>
        </div>
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about symptoms, medications, recovery..."
            className="flex-1 h-11 rounded-full border-2 border-slate-200 px-4 focus:border-teal-500 focus:ring-teal-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isTyping}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            size="icon"
            className="h-11 w-11 rounded-full bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20 disabled:opacity-50"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
