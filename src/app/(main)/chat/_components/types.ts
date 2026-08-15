export interface MessageReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export interface ChatMessage {
  id: string;
  channel: string;
  senderId: string;
  senderName: string;
  senderColor?: string;
  content: string;
  createdAt: string;
  threadParentId: string | null;
  deletedAt: string | null;
  threadCount: number;
  reactions: MessageReaction[];
}

export type ActiveChannel = string;

export const COMMON_EMOJIS = [
  "👍","👎","❤️","😂","😮","😢","🎉","🔥",
  "✅","❌","🤔","💡","📌","🚀","💯","👀",
  "🙌","💪","🎯","⭐","🏆","👏","✨","🤝",
  "📚","💬","🔬","📊","📝","⚡","🌟","😊",
];

export const GROUP_GAP_MS = 5 * 60 * 1000;
