import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { avatarFallback } from "./format";
import type { Comment, Conversation, MediaType, Message, Notification, Post, Story, User } from "./types";

type Tables = Database["public"]["Tables"];
type Theme = "light" | "dark";

type Store = {
  ready: boolean;
  authed: boolean;
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
  report: (userId: string, reason: string, postId?: string) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<void>;
  createPost: (p: { file: File; kind: "post" | "reel"; caption: string; location?: string | undefined; onProgress?: (pct: number) => void }) => Promise<void>;
  createStory: (file: File, onProgress?: (pct: number) => void) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  editPost: (postId: string, caption: string) => Promise<void>;
  deleteStory: (storyId: string) => Promise<void>;
  sendMessage: (userId: string, text: string, opts?: { file?: File; postId?: string; onProgress?: (pct: number) => void }) => Promise<void>;
  openConversation: (userId: string) => string;
  markConversationRead: (userId: string) => void;
  markNotificationsRead: () => void;
  updateMe: (patch: { username?: string; name?: string; bio?: string; isPrivate?: boolean; onboarded?: boolean }) => Promise<string | null>;
  uploadAvatar: (file: File) => Promise<void>;
  setTheme: (t: Theme) => void;
  setPrivateAccount: (v: boolean) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** UI hint only; the database enforces admin rights in set_user_verified. */
  isAdmin: boolean;
  /** UI hint only; database functions/RLS enforce these. */
  perms: { verify: boolean; deletePosts: boolean; viewReports: boolean };
  setVerified: (userId: string, verified: boolean) => Promise<void>;
  getUserPresence: (userId: string) => { isOnline: boolean; lastSeen?: number };
};

const Ctx = createContext<Store | null>(null);
const ts = (s: string) => new Date(s).getTime();
const isPath = (v: string | null | undefined): v is string => !!v && !/^https?:/.test(v);

async function signPaths(paths: string[]) {
  const unique = [...new Set(paths.filter(isPath))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from("media").createSignedUrls(unique, 60 * 60 * 24 * 7);
  data?.forEach((d) => d.path && d.signedUrl && map.set(d.path, d.signedUrl));
  return map;
}

function toUser(p: Tables["profiles"]["Row"], urls: Map<string, string>): User {
  return {
    id: p.id,
    username: p.username,
    name: p.name,
    bio: p.bio,
    verified: p.verified,
    isPrivate: p.is_private,
    onboarded: p.onboarded,
    followers: p.followers_count,
    following: p.following_count,
    avatarPath: p.avatar_url,
    avatar: isPath(p.avatar_url) ? urls.get(p.avatar_url) ?? avatarFallback(p.username) : p.avatar_url ?? avatarFallback(p.username),
  };
}

export const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250 MB — matches the media bucket limit

// XHR-based upload so large files report real progress and never block the UI thread.
async function uploadMedia(uid: string, file: File, onProgress?: (pct: number) => void) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/media/${path}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session?.access_token ?? ""}`);
    xhr.setRequestHeader("apikey", import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `Upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.message ?? msg; } catch { /* keep default */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload — check your connection and try again"));
    xhr.ontimeout = () => reject(new Error("Upload timed out — try again on a better connection"));
    xhr.send(file);
  });
  return path;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState({ verify: false, deletePosts: false, viewReports: false });
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [theme, setThemeState] = useState<Theme>("light");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>({});
  const reading = useRef(new Set<string>());
  const uidRef = useRef<string | null>(null);
  uidRef.current = uid;

  // Theme
  useEffect(() => {
    try { setLastSeenMap(JSON.parse(localStorage.getItem("shyfft_last_seen") || "{}")); } catch { /* optional cache */ }
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

  // Auth
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        setUid(session?.user.id ?? null);
        setAuthChecked(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async (me: string) => {
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [profiles, postsRes, likes, saves, follows, blocks, storiesRes, msgs, notifs] = await Promise.all([
      supabase.from("profiles").select("*").limit(1000),
      supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("likes").select("post_id").eq("user_id", me),
      supabase.from("saves").select("post_id").eq("user_id", me),
      supabase.from("follows").select("following_id").eq("follower_id", me),
      supabase.from("blocks").select("blocked_id").eq("blocker_id", me),
      supabase.from("stories").select("*").gt("created_at", dayAgo).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").or(`sender_id.eq.${me},recipient_id.eq.${me}`).order("created_at").limit(1000),
      supabase.from("notifications").select("*").eq("user_id", me).order("created_at", { ascending: false }).limit(100),
    ]);

    const postRows = postsRes.data ?? [];
    const commentsRes = postRows.length
      ? await supabase.from("comments").select("*").in("post_id", postRows.map((p) => p.id)).order("created_at")
      : { data: [] as Tables["comments"]["Row"][] };

    const urls = await signPaths([
      ...(profiles.data ?? []).map((p) => p.avatar_url ?? ""),
      ...postRows.map((p) => p.media_url),
      ...(storiesRes.data ?? []).map((s) => s.media_url),
      ...(msgs.data ?? []).map((m) => m.media_url ?? ""),
    ]);

    const byPost = new Map<string, Comment[]>();
    (commentsRes.data ?? []).forEach((c) => {
      const list = byPost.get(c.post_id) ?? [];
      list.push({ id: c.id, userId: c.user_id, text: c.text, createdAt: ts(c.created_at) });
      byPost.set(c.post_id, list);
    });

    setUsers((profiles.data ?? []).map((p) => toUser(p, urls)));
    setPosts(postRows.map((p) => ({
      id: p.id,
      userId: p.user_id,
      media: urls.get(p.media_url) ?? p.media_url,
      mediaType: p.media_type as Post["mediaType"],
      kind: p.kind as Post["kind"],
      caption: p.caption,
      likes: p.like_count,
      commentCount: p.comment_count,
      comments: byPost.get(p.id) ?? [],
      createdAt: ts(p.created_at),
      location: p.location ?? undefined,
    })));
    setStories((storiesRes.data ?? []).map((s) => ({
      id: s.id,
      userId: s.user_id,
      media: urls.get(s.media_url) ?? s.media_url,
      createdAt: ts(s.created_at),
    })));
    setLiked(new Set((likes.data ?? []).map((l) => l.post_id)));
    setSaved(new Set((saves.data ?? []).map((l) => l.post_id)));
    setFollowing(new Set((follows.data ?? []).map((f) => f.following_id)));
    setBlocked(new Set((blocks.data ?? []).map((b) => b.blocked_id)));
    setMessages((msgs.data ?? []).map((m) => toMessage(m, urls)));

    const undelivered = (msgs.data ?? []).filter((m) => m.recipient_id === me && !m.delivered_at).map((m) => m.id);
    if (undelivered.length) {
      supabase.from("messages").update({ delivered_at: new Date().toISOString() }).in("id", undelivered).then();
    }

    setNotifications((notifs.data ?? []).map(toNotification));

    const adminRes = await supabase.rpc("has_role", { _user_id: me, _role: "admin" });
    setIsAdmin(adminRes.data === true);
    const permRes = await supabase.from("admin_permissions").select("*").eq("user_id", me).maybeSingle();
    const sup = adminRes.data === true;
    setPerms({ verify: sup || !!permRes.data?.can_verify, deletePosts: sup || !!permRes.data?.can_delete_posts, viewReports: sup || !!permRes.data?.can_view_reports });
    setReady(true);
  }, []);

  // Silent background resync of just the messages — merges by id so nothing
  // duplicates, disappears, or resets scroll position. Used after realtime
  // (re)connects and when the network comes back.
  const syncMessages = useCallback(async (meId: string) => {
    try {
      const { data, error } = await supabase.from("messages").select("*")
        .or(`sender_id.eq.${meId},recipient_id.eq.${meId}`).order("created_at").limit(1000);
      if (error || !data) return;
      const urls = await signPaths(data.map((m) => m.media_url ?? ""));
      const incoming = data.map((m) => toMessage(m, urls));
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        incoming.forEach((m) => byId.set(m.id, m));
        return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
      });
      const undelivered = data.filter((m) => m.recipient_id === meId && !m.delivered_at).map((m) => m.id);
      if (undelivered.length) {
        supabase.from("messages").update({ delivered_at: new Date().toISOString() }).in("id", undelivered).then();
      }
    } catch { /* background resync must never surface errors */ }
  }, []);

  useEffect(() => {
    if (!uid) { setReady(false); return; }
    load(uid);

    const channel = supabase
      .channel(`user-${uid}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${uid}` },
        async (p) => {
          try {
            const row = p.new as Tables["messages"]["Row"];
            let urls: Map<string, string> | undefined;
            try {
              urls = isPath(row.media_url) ? await signPaths([row.media_url]) : undefined;
            } catch { /* media URL can be re-signed later; still show the message */ }
            setMessages((m) => m.some((x) => x.id === row.id) ? m : [...m, toMessage(row, urls)]);
            void Promise.resolve(supabase.from("messages").update({ delivered_at: new Date().toISOString() }).eq("id", row.id).is("delivered_at", null)).catch(() => {});
          } catch { /* a realtime event must never crash the app */ }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `sender_id=eq.${uid}` },
        (p) => {
          const row = p.new as Tables["messages"]["Row"];
          setMessages((ms) => ms.map((m) => m.id === row.id
            ? { ...m, read: !!row.read_at, readAt: row.read_at ? ts(row.read_at) : undefined, deliveredAt: row.delivered_at ? ts(row.delivered_at) : m.deliveredAt }
            : m));
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (p) => setNotifications((n) => [toNotification(p.new as Tables["notifications"]["Row"]), ...n]))
      .subscribe((status) => {
        // After every (re)join — including automatic reconnects — quietly catch
        // up on anything missed while the socket was down. No reload, no toast.
        if (status === "SUBSCRIBED") syncMessages(uid);
      });

    const onOnline = () => syncMessages(uid);
    window.addEventListener("online", onOnline);

    const presenceChannel = supabase.channel("online-presence", {
      config: { presence: { key: uid } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        const now = Date.now();
        const updated: Record<string, number> = {};
        for (const key of Object.keys(state)) {
          online.add(key);
          updated[key] = now;
        }
        setOnlineUserIds(online);
        setLastSeenMap((prev) => {
          const next = { ...prev, ...updated };
          try { localStorage.setItem("shyfft_last_seen", JSON.stringify(next)); } catch {}
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setLastSeenMap((prev) => {
          const next = { ...prev, [key]: Date.now() };
          try { localStorage.setItem("shyfft_last_seen", JSON.stringify(next)); } catch {}
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      window.removeEventListener("online", onOnline);
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [uid, load, syncMessages]);

  const me = users.find((u) => u.id === uid);

  const conversations = useMemo<Conversation[]>(() => {
    if (!uid) return [];
    const map = new Map<string, Message[]>();
    messages.forEach((m) => {
      const other = m.fromId === uid ? m.toId : m.fromId;
      map.set(other, [...(map.get(other) ?? []), m]);
    });
    return [...map.entries()]
      .map(([userId, ms]) => ({ id: userId, userId, messages: ms, unread: ms.filter((m) => m.toId === uid && !m.read).length }))
      .sort((a, b) => (b.messages.at(-1)?.createdAt ?? 0) - (a.messages.at(-1)?.createdAt ?? 0));
  }, [messages, uid]);

  const fail = (e: any) => {
    const msg = e?.message || e?.error_description || (typeof e === "string" ? e : "Something went wrong");
    toast.error(msg);
  };

  const value = useMemo<Store>(() => {
    const myId = uid ?? "";
    return {
      ready: ready && !!me,
      authed: authChecked && !!uid,
      me: me as User,
      users,
      conversations,
      notifications,
      liked,
      saved,
      following,
      blocked,
      theme,
      privateAccount: !!me?.isPrivate,
      posts: posts.filter((p) => !blocked.has(p.userId)),
      stories: stories.filter((s) => !blocked.has(s.userId)),
      getUser: (id) => users.find((u) => u.id === id),
      byUsername: (n) => users.find((u) => u.username === n),
      toggleLike: (id) => {
        const was = liked.has(id);
        setLiked((s) => { const n = new Set(s); was ? n.delete(id) : n.add(id); return n; });
        setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes: p.likes + (was ? -1 : 1) } : p)));
        (was ? supabase.from("likes").delete().match({ user_id: myId, post_id: id }) : supabase.from("likes").insert({ user_id: myId, post_id: id }))
          .then(({ error }) => error && fail(error));
      },
      toggleSave: (id) => {
        const was = saved.has(id);
        setSaved((s) => { const n = new Set(s); was ? n.delete(id) : n.add(id); return n; });
        (was ? supabase.from("saves").delete().match({ user_id: myId, post_id: id }) : supabase.from("saves").insert({ user_id: myId, post_id: id }))
          .then(({ error }) => error && fail(error));
      },
      toggleFollow: (id) => {
        const was = following.has(id);
        setFollowing((s) => { const n = new Set(s); was ? n.delete(id) : n.add(id); return n; });
        setUsers((us) => us.map((u) =>
          u.id === id ? { ...u, followers: u.followers + (was ? -1 : 1) } :
          u.id === myId ? { ...u, following: u.following + (was ? -1 : 1) } : u));
        (was ? supabase.from("follows").delete().match({ follower_id: myId, following_id: id }) : supabase.from("follows").insert({ follower_id: myId, following_id: id }))
          .then(({ error }) => error && fail(error));
      },
      toggleBlock: (id) => {
        const was = blocked.has(id);
        setBlocked((s) => { const n = new Set(s); was ? n.delete(id) : n.add(id); return n; });
        if (!was) setFollowing((s) => { const n = new Set(s); n.delete(id); return n; });
        (was ? supabase.from("blocks").delete().match({ blocker_id: myId, blocked_id: id }) : supabase.from("blocks").insert({ blocker_id: myId, blocked_id: id }))
          .then(({ error }) => error && fail(error));
      },
      report: async (userId, reason, postId) => {
        const { error } = await supabase.from("reports").insert({ reporter_id: myId, target_user_id: userId, post_id: postId ?? null, reason });
        if (error) throw error;
      },
      addComment: async (postId, text) => {
        const { data, error } = await supabase.from("comments").insert({ post_id: postId, user_id: myId, text }).select().single();
        if (error) { fail(error); return; }
        setPosts((ps) => ps.map((p) => p.id === postId
          ? { ...p, commentCount: p.commentCount + 1, comments: [...p.comments, { id: data.id, userId: myId, text, createdAt: ts(data.created_at) }] } : p));
      },
      createPost: async ({ file, kind, caption, location, onProgress }) => {
        const path = await uploadMedia(myId, file, onProgress);
        const { data, error } = await supabase.from("posts").insert({
          user_id: myId, media_url: path, media_type: file.type.startsWith("video") ? "video" : "image", kind, caption, location: location ?? null,
        }).select().single();
        if (error) throw error;
        // Insert locally instead of reloading everything — no feed flicker or scroll reset.
        const localUrl = URL.createObjectURL(file);
        setPosts((ps) => [{
          id: data.id, userId: myId, media: localUrl,
          mediaType: data.media_type as Post["mediaType"], kind: data.kind as Post["kind"],
          caption: data.caption, likes: 0, commentCount: 0, comments: [],
          createdAt: ts(data.created_at), location: data.location ?? undefined,
        }, ...ps]);
      },
      createStory: async (file, onProgress) => {
        const path = await uploadMedia(myId, file, onProgress);
        const { data, error } = await supabase.from("stories").insert({ user_id: myId, media_url: path }).select().single();
        if (error) throw error;
        setStories((ss) => [{ id: data.id, userId: myId, media: URL.createObjectURL(file), createdAt: ts(data.created_at) }, ...ss]);
      },
      deletePost: async (postId) => {
        const { error } = await supabase.from("posts").delete().eq("id", postId);
        if (error) { toast.error("Could not delete post"); throw error; }
        setPosts((ps) => ps.filter((p) => p.id !== postId));
        toast.success("Post deleted");
      },
      editPost: async (postId, caption) => {
        const { error } = await supabase.from("posts").update({ caption }).eq("id", postId).eq("user_id", myId);
        if (error) { toast.error("Could not update caption"); throw error; }
        setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, caption } : p)));
        toast.success("Post updated");
      },
      deleteStory: async (storyId) => {
        const { error } = await supabase.from("stories").delete().eq("id", storyId).eq("user_id", myId);
        if (error) { toast.error("Could not delete story"); throw error; }
        setStories((ss) => ss.filter((s) => s.id !== storyId));
        toast.success("Story deleted");
      },
      sendMessage: async (userId, text, opts) => {
        if (!myId) throw new Error("Please sign in again before sending.");
        if (!text.trim() && !opts?.file && !opts?.postId) return;
        let media_url: string | null = null;
        let media_type: string | null = null;
        if (opts?.file) {
          if (opts.file.size > MAX_FILE_SIZE) throw new Error("File too large — max 250 MB");
          if (!/^image\/|^video\//.test(opts.file.type)) throw new Error("Only photos and videos can be sent");
          media_url = await uploadMedia(myId, opts.file, opts.onProgress);
          media_type = opts.file.type.startsWith("video") ? "video" : "image";
        }

        // Database me text empty hone par aane wale constraint error ka permanent fix
        const trimmed = text.trim();
        const safeText = trimmed.length > 0 
          ? trimmed 
          : (opts?.file ? (opts.file.type.startsWith("video") ? "🎥 Video" : "📷 Photo") : (opts?.postId ? "🎬 Reel" : " "));

        const { data, error } = await supabase.from("messages").insert({
          sender_id: myId,
          recipient_id: userId,
          text: safeText,
          media_url,
          media_type,
          post_id: opts?.postId ?? null,
        }).select().single();

        if (error) throw new Error(error.message);
        if (!data) throw new Error("Message wasn't sent. Please try again.");
        let urls: Map<string, string> | undefined;
        try { urls = media_url ? await signPaths([media_url]) : undefined; } catch { /* insert succeeded; never encourage a duplicate send */ }
        setMessages((m) => m.some((x) => x.id === data.id) ? m : [...m, toMessage(data, urls)]);
      },
      getUserPresence: (userId: string) => {
        const isOnline = onlineUserIds.has(userId);
        if (isOnline) return { isOnline: true, lastSeen: Date.now() };

        let lastSeen = lastSeenMap[userId];
        if (!lastSeen) {
          const userMsgs = messages.filter((m) => m.fromId === userId);
          lastSeen = userMsgs.at(-1)?.createdAt;
        }
        if (!lastSeen) {
          const userPosts = posts.filter((p) => p.userId === userId);
          lastSeen = userPosts[0]?.createdAt;
        }
        return { isOnline: false, ...(lastSeen !== undefined ? { lastSeen } : {}) };
      },
      openConversation: (userId) => userId,
      markConversationRead: (userId) => {
        const ids = messages.filter((m) => m.fromId === userId && m.toId === myId && !m.read).map((m) => m.id);
        if (!ids.length || reading.current.has(userId)) return;
        reading.current.add(userId);
        const readAt = Date.now();
        void Promise.resolve(supabase.from("messages").update({ read_at: new Date(readAt).toISOString() }).in("id", ids).eq("recipient_id", myId).is("read_at", null))
          .then(({ error }) => {
            if (!error) setMessages((ms) => ms.map((m) => ids.includes(m.id) ? { ...m, read: true, readAt } : m));
          }).catch(() => { /* reconnect resync retries; keep unconfirmed messages unread */ })
          .finally(() => reading.current.delete(userId));
      },
      markNotificationsRead: () => {
        setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
        supabase.from("notifications").update({ read: true }).eq("user_id", myId).eq("read", false).then();
      },
      updateMe: async (patch) => {
        const { error } = await supabase.from("profiles").update({
          ...(patch.username !== undefined && { username: patch.username }),
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.bio !== undefined && { bio: patch.bio }),
          ...(patch.isPrivate !== undefined && { is_private: patch.isPrivate }),
          ...(patch.onboarded !== undefined && { onboarded: patch.onboarded }),
        }).eq("id", myId);
        if (error) return error.code === "23505" ? "That username is taken" : error.message;
        setUsers((us) => us.map((u) => (u.id === myId ? { ...u, ...patch } : u)));
        return null;
      },
      uploadAvatar: async (file) => {
        const path = await uploadMedia(myId, file);
        const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", myId);
        if (error) throw error;
        const url = URL.createObjectURL(file);
        setUsers((us) => us.map((u) => (u.id === myId ? { ...u, avatar: url, avatarPath: path } : u)));
      },
      setTheme,
      setPrivateAccount: (v) => {
        setUsers((us) => us.map((u) => (u.id === myId ? { ...u, isPrivate: v } : u)));
        supabase.from("profiles").update({ is_private: v }).eq("id", myId).then(({ error }) => error && fail(error));
      },
      signOut: async () => { await supabase.auth.signOut(); },
      refresh: async () => { if (uidRef.current) await load(uidRef.current); },
      isAdmin,
      perms,
      setVerified: async (userId, verified) => {
        const { error } = await supabase.rpc("set_user_verified", { _target: userId, _verified: verified });
        if (error) throw error;
        setUsers((us) => us.map((u) => (u.id === userId ? { ...u, verified } : u)));
      },
    };
  }, [uid, ready, authChecked, me, users, posts, stories, messages, conversations, notifications, liked, saved, following, blocked, theme, setTheme, load, isAdmin, perms, onlineUserIds, lastSeenMap]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function toMessage(m: Tables["messages"]["Row"], urls?: Map<string, string>): Message {
  const mediaPath = isPath(m.media_url) ? m.media_url : null;
  return {
    id: m.id,
    fromId: m.sender_id,
    toId: m.recipient_id,
    text: m.text,
    createdAt: ts(m.created_at),
    read: !!m.read_at,
    readAt: m.read_at ? ts(m.read_at) : undefined,
    deliveredAt: m.delivered_at ? ts(m.delivered_at) : undefined,
    media: m.media_url ? (mediaPath ? urls?.get(mediaPath) : m.media_url) : undefined,
    mediaType: (m.media_type as MediaType | null) ?? undefined,
    postId: m.post_id ?? undefined,
  };
}

function toNotification(n: Tables["notifications"]["Row"]): Notification {
  return {
    id: n.id,
    type: n.type as Notification["type"],
    userId: n.actor_id,
    postId: n.post_id ?? undefined,
    text: n.text ?? undefined,
    createdAt: ts(n.created_at),
    read: n.read,
  };
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
