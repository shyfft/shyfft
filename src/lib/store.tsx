import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ME_ID, seedConversations, seedNotifications, seedPosts, seedStories, seedUsers } from "./mock-data";
import type { Conversation, Notification, Post, Story, User } from "./types";

// Local in-memory store. Each action maps 1:1 to a future backend call
// (database insert/delete, storage upload, realtime channel for messages).
type Theme = "light" | "dark";

type Store = {
  me: User;
  users: User[];
  posts: Post[];
  stories: Story[];
  conversations: Conversation[];
  notifications: Notification[];
  liked: Set<string>;
  saved: Set<string>;
  following: Set<string>;
  blocked: Set<string>;
  theme: Theme;
  privateAccount: boolean;
  getUser: (id: string) => User | undefined;
  byUsername: (u: string) => User | undefined;
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  toggleFollow: (userId: string) => void;
  toggleBlock: (userId: string) => void;
  addComment: (postId: string, text: string) => void;
  createPost: (p: Pick<Post, "media" | "mediaType" | "kind" | "caption" | "location">) => void;
  createStory: (media: string) => void;
  sendMessage: (convId: string, text: string) => void;
  openConversation: (userId: string) => string;
  markNotificationsRead: () => void;
  updateMe: (patch: Partial<User>) => void;
  setTheme: (t: Theme) => void;
  setPrivateAccount: (v: boolean) => void;
};

const Ctx = createContext<Store | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);
const toggleIn = (s: Set<string>, id: string) => {
  const n = new Set(s);
  n.has(id) ? n.delete(id) : n.add(id);
  return n;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState(seedUsers);
  const [posts, setPosts] = useState(seedPosts);
  const [stories, setStories] = useState(seedStories);
  const [conversations, setConversations] = useState(seedConversations);
  const [notifications, setNotifications] = useState(seedNotifications);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set(["u1", "u2", "u3"]));
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [theme, setThemeState] = useState<Theme>("light");
  const [privateAccount, setPrivateAccount] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("shyfft-theme") as Theme | null;
    if (t) setThemeState(t);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setThemeState("dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("shyfft-theme", t);
  }, []);

  const me = users.find((u) => u.id === ME_ID)!;

  const value = useMemo<Store>(() => ({
    me, users, posts: posts.filter((p) => !blocked.has(p.userId)),
    stories: stories.filter((s) => Date.now() - s.createdAt < 24 * 3600_000 && !blocked.has(s.userId)),
    conversations, notifications, liked, saved, following, blocked, theme, privateAccount,
    getUser: (id) => users.find((u) => u.id === id),
    byUsername: (n) => users.find((u) => u.username === n),
    toggleLike: (id) => {
      const was = liked.has(id);
      setLiked((s) => toggleIn(s, id));
      setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes: p.likes + (was ? -1 : 1) } : p)));
    },
    toggleSave: (id) => setSaved((s) => toggleIn(s, id)),
    toggleFollow: (id) => {
      const was = following.has(id);
      setFollowing((s) => toggleIn(s, id));
      setUsers((us) => us.map((u) =>
        u.id === id ? { ...u, followers: u.followers + (was ? -1 : 1) } :
        u.id === ME_ID ? { ...u, following: u.following + (was ? -1 : 1) } : u));
    },
    toggleBlock: (id) => {
      setBlocked((s) => toggleIn(s, id));
      setFollowing((s) => { const n = new Set(s); n.delete(id); return n; });
    },
    addComment: (postId, text) => setPosts((ps) => ps.map((p) => p.id === postId
      ? { ...p, comments: [...p.comments, { id: uid(), userId: ME_ID, text, createdAt: Date.now() }] } : p)),
    createPost: (p) => setPosts((ps) => [{ ...p, id: uid(), userId: ME_ID, likes: 0, comments: [], createdAt: Date.now() }, ...ps]),
    createStory: (media) => setStories((s) => [{ id: uid(), userId: ME_ID, media, createdAt: Date.now() }, ...s]),
    sendMessage: (cid, text) => setConversations((cs) => cs.map((c) => c.id === cid
      ? { ...c, messages: [...c.messages, { id: uid(), fromId: ME_ID, text, createdAt: Date.now() }] } : c)),
    openConversation: (userId) => {
      const ex = conversations.find((c) => c.userId === userId);
      if (ex) {
        setConversations((cs) => cs.map((c) => (c.id === ex.id ? { ...c, unread: 0 } : c)));
        return ex.id;
      }
      const id = uid();
      setConversations((cs) => [{ id, userId, messages: [], unread: 0 }, ...cs]);
      return id;
    },
    markNotificationsRead: () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))),
    updateMe: (patch) => setUsers((us) => us.map((u) => (u.id === ME_ID ? { ...u, ...patch } : u))),
    setTheme, setPrivateAccount,
  }), [me, users, posts, stories, conversations, notifications, liked, saved, following, blocked, theme, privateAccount, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
