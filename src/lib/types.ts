// Shapes mirror the planned database tables (profiles, posts, comments, stories,
// follows, likes, saves, messages, notifications, blocks, reports).
export type User = {
  id: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  verified?: boolean;
  isPrivate?: boolean;
  followers: number;
  following: number;
};

export type MediaType = "image" | "video";

export type Comment = { id: string; userId: string; text: string; createdAt: number };

export type Post = {
  id: string;
  userId: string;
  media: string;
  mediaType: MediaType;
  kind: "post" | "reel";
  caption: string;
  likes: number;
  comments: Comment[];
  createdAt: number;
  location?: string | undefined;
};

export type Story = { id: string; userId: string; media: string; createdAt: number };

export type Message = { id: string; fromId: string; text: string; createdAt: number };
export type Conversation = { id: string; userId: string; messages: Message[]; unread: number };

export type Notification = {
  id: string;
  type: "like" | "comment" | "follow" | "mention";
  userId: string;
  postId?: string;
  text?: string;
  createdAt: number;
  read: boolean;
};
