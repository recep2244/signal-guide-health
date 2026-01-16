import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/data/mockPatients';
import { User, Bot } from 'lucide-react';

interface ChatHistoryProps {
  messages: ChatMessage[];
  className?: string;
}

export function ChatHistory({ messages, className }: ChatHistoryProps) {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn('space-y-4 p-4', className)}>
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={cn(
            'flex gap-3 animate-fade-in',
            message.role === 'patient' ? 'flex-row' : 'flex-row-reverse'
          )}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div
            className={cn(
              'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
              message.role === 'patient' 
                ? 'bg-secondary' 
                : 'bg-primary'
            )}
          >
            {message.role === 'patient' ? (
              <User size={16} className="text-secondary-foreground" />
            ) : (
              <Bot size={16} className="text-primary-foreground" />
            )}
          </div>

          <div
            className={cn(
              'flex flex-col gap-1',
              message.role === 'patient' ? 'items-start' : 'items-end'
            )}
          >
            <div
              className={cn(
                'chat-bubble whitespace-pre-wrap',
                message.role === 'patient' 
                  ? 'chat-bubble-patient' 
                  : 'chat-bubble-agent'
              )}
            >
              {message.content}
            </div>
            <span className="text-[10px] text-muted-foreground px-1">
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
