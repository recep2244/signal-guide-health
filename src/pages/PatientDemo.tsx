import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Send, ArrowLeft, Watch, Phone, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'patient' | 'agent';
  content: string;
  timestamp: Date;
  options?: string[];
}

const DEMO_FLOW: { content: string; options?: string[]; nextOnOption?: Record<string, number> }[] = [
  {
    content: "Good morning! 👋 I'm your CardioWatch assistant. I'll be checking in with you daily to help monitor your recovery.\n\nHow are you feeling today on a scale of 0-10?",
    options: ["8 - Feeling good", "6 - Okay", "4 - Not great", "2 - Struggling"],
  },
  {
    content: "Thank you for sharing. Before we continue, I need to ask about any urgent symptoms.\n\nAre you experiencing any of the following right now?",
    options: ["Chest pain or pressure", "Shortness of breath at rest", "Fainting or near-fainting", "None of these"],
  },
  {
    content: "Great, thank you for confirming. I notice from your Apple Watch that your resting heart rate has been stable at around 68 bpm, and you got 7.2 hours of sleep last night. 💪\n\nHave you noticed any changes in how you feel during physical activity?",
    options: ["Feeling stronger", "About the same", "More tired than usual", "Getting breathless easier"],
  },
  {
    content: "That's wonderful progress! Your wearable data supports this - your activity levels have been increasing steadily. 📈\n\nAre you taking all your medications as prescribed?",
    options: ["Yes, all of them", "Missed one dose", "Having side effects", "Need a refill soon"],
  },
  {
    content: "Excellent! You're doing really well with your recovery. Here's your daily summary:\n\n✅ **Triage: GREEN (Stable)**\n• Wellbeing: Good\n• No red flag symptoms\n• Wearables within normal range\n• Medication adherence: Good\n\nI'll check in again tomorrow. Take care! 💚",
  },
];

// Alternative flow for concerning symptoms
const CONCERN_FLOW: { content: string; options?: string[] }[] = [
  {
    content: "I'm sorry to hear that. Can you tell me more about what you're experiencing?\n\nWhen did this start?",
    options: ["Just now", "A few hours ago", "Since yesterday", "Getting worse over days"],
  },
  {
    content: "I understand. On a scale of 0-10, how severe would you rate this symptom?",
    options: ["Mild (1-3)", "Moderate (4-6)", "Severe (7-8)", "Very severe (9-10)"],
  },
  {
    content: "⚠️ Based on what you've shared, I'm flagging this for your care team to review today.\n\n**Triage: AMBER (Review Today)**\n\nYour symptoms combined with your recent procedure warrant a same-day check. A member of your care team will contact you within the next few hours.\n\nIn the meantime:\n• Rest and don't overexert yourself\n• Keep your phone nearby\n• If symptoms suddenly worsen, seek urgent care\n\nIs there anything else you'd like me to note for your care team?",
    options: ["No, that's all", "Yes, I have more to add"],
  },
];

// Urgent flow
const URGENT_FLOW: { content: string; options?: string[] }[] = [
  {
    content: "⚠️ **This could be serious.**\n\nChest pain or pressure after your procedure needs immediate medical attention.\n\n**Please seek urgent care NOW or call 999 if:**\n• Pain is severe or worsening\n• You feel short of breath\n• You feel sweaty, nauseous, or dizzy\n\n🚨 I'm alerting your care team immediately.\n\nDo you have someone with you who can help?",
  },
];

export default function PatientDemo() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [flowType, setFlowType] = useState<'normal' | 'concern' | 'urgent'>('normal');
  const [isTyping, setIsTyping] = useState(false);
  const [demoStarted, setDemoStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getCurrentFlow = () => {
    switch (flowType) {
      case 'concern':
        return CONCERN_FLOW;
      case 'urgent':
        return URGENT_FLOW;
      default:
        return DEMO_FLOW;
    }
  };

  const addAgentMessage = (content: string, options?: string[]) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content,
          timestamp: new Date(),
          options,
        },
      ]);
      setIsTyping(false);
    }, 1000 + Math.random() * 500);
  };

  const startDemo = () => {
    setDemoStarted(true);
    const firstMessage = DEMO_FLOW[0];
    addAgentMessage(firstMessage.content, firstMessage.options);
  };

  const handleOptionSelect = (option: string) => {
    // Add patient message
    setMessages(prev => [
      ...prev,
      {
        id: `patient-${Date.now()}`,
        role: 'patient',
        content: option,
        timestamp: new Date(),
      },
    ]);

    // Determine flow based on selection
    if (currentStep === 1) {
      if (option === "Chest pain or pressure") {
        setFlowType('urgent');
        setTimeout(() => {
          addAgentMessage(URGENT_FLOW[0].content);
        }, 500);
        return;
      } else if (option !== "None of these") {
        setFlowType('concern');
        setTimeout(() => {
          addAgentMessage(CONCERN_FLOW[0].content, CONCERN_FLOW[0].options);
        }, 500);
        setCurrentStep(0);
        return;
      }
    }

    // Progress normal flow
    const flow = getCurrentFlow();
    const nextStep = currentStep + 1;
    
    if (nextStep < flow.length) {
      setCurrentStep(nextStep);
      setTimeout(() => {
        const nextMessage = flow[nextStep];
        addAgentMessage(nextMessage.content, nextMessage.options);
      }, 500);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    setMessages(prev => [
      ...prev,
      {
        id: `patient-${Date.now()}`,
        role: 'patient',
        content: inputValue,
        timestamp: new Date(),
      },
    ]);
    setInputValue('');

    // Generic response for free-text input
    setTimeout(() => {
      addAgentMessage(
        "Thank you for sharing that. I've noted this for your care team. Is there anything else you'd like to tell me?",
        ["No, that's everything", "Yes, one more thing"]
      );
    }, 500);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const resetDemo = () => {
    setMessages([]);
    setCurrentStep(0);
    setFlowType('normal');
    setDemoStarted(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Heart size={16} className="text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-semibold">CardioWatch</h1>
                <p className="text-[10px] text-muted-foreground">Daily Check-in</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-triage-green">
              <Watch size={14} />
              <span className="hidden sm:inline">Connected</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main chat area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!demoStarted ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="max-w-md w-full p-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Heart size={40} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Patient Demo</h2>
                <p className="text-muted-foreground text-sm">
                  Experience the AI-powered daily check-in from a patient's perspective. 
                  This demo simulates how the CardioWatch agent interacts with post-discharge cardiac patients.
                </p>
              </div>
              <div className="space-y-3 text-left bg-secondary/50 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demo scenario</p>
                <p className="text-sm">
                  You are <strong>Sarah Okonkwo</strong>, 58, recently discharged after a cardiac ablation procedure. 
                  Your Apple Watch is connected and sharing health data.
                </p>
              </div>
              <Button onClick={startDemo} className="w-full" size="lg">
                Start Daily Check-in
              </Button>
            </Card>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3 animate-fade-in',
                    message.role === 'patient' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {message.role === 'agent' && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Heart size={14} className="text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex flex-col gap-2',
                      message.role === 'patient' ? 'items-end' : 'items-start'
                    )}
                  >
                    <div
                      className={cn(
                        'chat-bubble whitespace-pre-wrap',
                        message.role === 'patient' ? 'chat-bubble-agent' : 'chat-bubble-patient'
                      )}
                    >
                      {message.content}
                    </div>
                    {message.options && message.role === 'agent' && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {message.options.map((option) => (
                          <Button
                            key={option}
                            variant="outline"
                            size="sm"
                            className="text-xs h-auto py-2 px-3"
                            onClick={() => handleOptionSelect(option)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground px-1">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Heart size={14} className="text-primary-foreground" />
                  </div>
                  <div className="chat-bubble chat-bubble-patient">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t bg-card p-4">
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} size="icon">
                  <Send size={18} />
                </Button>
              </div>
              <div className="flex justify-center mt-3">
                <Button variant="ghost" size="sm" onClick={resetDemo} className="text-xs text-muted-foreground">
                  Restart Demo
                </Button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Urgent alert overlay */}
      {flowType === 'urgent' && messages.length > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-fade-in">
          <Card className="bg-triage-red-bg border-triage-red p-4 flex items-center gap-3">
            <AlertTriangle className="text-triage-red shrink-0" size={24} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-triage-red-foreground">Care team alerted</p>
              <p className="text-xs text-triage-red-foreground/80">Emergency contact will call shortly</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 border-triage-red text-triage-red hover:bg-triage-red hover:text-white">
              <Phone size={14} className="mr-1" />
              Call 999
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
