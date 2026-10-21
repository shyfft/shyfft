// UI-facing shapes, mapped from database rows in src/lib/store.tsx.
export type User = {
  id: string;
  username: string;
  name: string;
  avatar: string;
  avatarPath: string | null;
  bio: string;
  verified?: boolean;
  isPrivate?: boolean;
  onboarded: boolean;
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
  commentCount: number;
  comments: Comment[];
  createdAt: number;
  location?: string | undefined;
};

export type Story = { id: string; userId: string; media: string; createdAt: number };

export type Message = { id: string; fromId: string; toId: string; text: string; createdAt: number; read: boolean };
/** Conversation id is the other participant's user id. */
export type Conversation = { id: string; userId: string; messages: Message[]; unread: number };

export type Notification = {
  id: string;
  type: "like" | "comment" | "follow" | "mention";
  userId: string;
  postId?: string | undefined;
  text?: string | undefined;
  createdAt: number;
  read: boolean;
};
