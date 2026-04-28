import { motion } from 'motion/react';
import { Calendar, CheckCircle2, Mail, Trash2 } from 'lucide-react';
import type { FC } from 'react';

interface Message {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  category: string;
  message: string;
  priority: string;
  timestamp: string;
  replied?: boolean;
  respondedAt?: string | null;
}

interface MessageCardProps {
  message: Message;
  onClick: (message: Message) => void;
  onDelete?: (message: Message) => void;
  isDeleting?: boolean;
}

const MessageCard: FC<MessageCardProps> = ({ message, onClick, onDelete, isDeleting = false }) => {
  const date = new Date(message.timestamp).toLocaleDateString();
  const repliedDate = message.respondedAt ? new Date(message.respondedAt).toLocaleDateString() : null;
  
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={() => onClick(message)}
      className="glass-morphism p-5 rounded-xl cursor-pointer hover:border-primary/40 transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {message.firstName[0]}{message.lastName[0]}
          </div>
          <div>
            <h4 className="font-semibold group-hover:text-primary transition-colors">
              {message.firstName} {message.lastName}
            </h4>
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <Mail className="w-3 h-3" />
              {message.email}
            </div>
          </div>
        </div>
        <span className={`badge ${
          message.replied ? 'bg-success/20 text-success' :
            message.priority === 'High' ? 'bg-error/20 text-error' :
              message.priority === 'Medium' ? 'bg-amber-500/20 text-amber-500' :
                message.priority === 'Low' ? 'bg-success/20 text-success' :
                  'bg-border/40 text-text-muted'
        }`}>
          {message.replied ? 'Replied' : (message.priority === 'Pending' ? 'Pending AI' : message.priority)}
        </span>
      </div>

      <p className="text-sm text-text-muted line-clamp-2 mb-4 leading-relaxed">
        {message.message}
      </p>

      <div className="flex justify-between items-center pt-4 border-t border-border mt-auto">
        <div className="flex items-center gap-2">
          <span className="badge bg-primary/10 text-primary">
            {message.category}
          </span>
          {message.replied && (
            <span className="badge bg-success/10 text-success flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Sent
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-text-muted">
          <Calendar className="w-3 h-3" />
          {message.replied && repliedDate ? repliedDate : date}
        </div>
      </div>
      {message.replied && onDelete && (
        <div className="pt-3 mt-3 border-t border-border">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(message);
            }}
            disabled={isDeleting}
            className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 ${
              isDeleting
                ? 'border-error/30 text-error/60 bg-error/5 cursor-not-allowed'
                : 'border-error/40 text-error hover:bg-error/10'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default MessageCard;
