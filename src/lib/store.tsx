import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Conversation, Message, Notification, Post, Story, User } from "./types";
import { avatarFallback } from "./format";
import { toast } from "sonner";
import { reportCaughtError } from "./error-capture";

export type Theme = "light" | "dark";

type Store = {
  ready: boolean;
  theme: Theme;
  me: User | undefined;
  users: User[];
  posts: Post[];
  stories: Story[];
  notifications: Notification[];
  conversations: Conversation[];
  liked: Set<string>;
  saved: Set<string>;
  following: Set<string>;
  blocked: Set<string>;
  getUser: (id: string) => User | undefined;
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
  isAdmin: boolean;
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

export const MAX_FILE_SIZE = 250 * 1024 * 1024;

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
        try { msg = JSON.parse(xhr.responseText)?.message ?? msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(file);
  });
  return path;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
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
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("shyfft_last_seen") || "{}"); } catch { return {}; }
  });
  const uidRef = useRef<string | null>(null);
  uidRef.current = uid;

  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState<{ verify: boolean; deletePosts: boolean; viewReports: boolean }>({
    verify: false, deletePosts: false, viewReports: false,
  });

  useEffect(() => {
    const savedTheme = (localStorage.getItem("shyfft_theme") as Theme) || "light";
    setThemeState(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("shyfft_theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUid(session?.user?.id ?? null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUid(session?.user?.id ?? null);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const load = async (userId: string) => {
    try {
      const [pRes, postRes, sRes, mRes, nRes, lRes, svRes, fRes, bRes, rRes, permRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("posts").select("*, comments(*)").order("created_at", { ascending: false }),
        supabase.from("stories").select("*").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
        supabase.from("messages").select("*").or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).order("created_at", { ascending: true }),
        supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("likes").select("post_id").eq("user_id", userId),
        supabase.from("saves").select("post_id").eq("user_id", userId),
        supabase.from("follows").select("following_id").eq("follower_id", userId),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("admin_permissions").select("can_verify, can_delete_posts, can_view_reports").eq("user_id", userId).maybeSingle(),
      ]);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const isSuper = authUser?.email === "shreyashchavaragi@gmail.com";
      const hasAdminRole = rRes.data?.some((r) => r.role === "admin") ?? false;
      const isUserAdmin = isSuper || hasAdminRole;
      setIsAdmin(isUserAdmin);

      if (isUserAdmin) {
        setPerms({ verify: true, deletePosts: true, viewReports: true });
      } else if (permRes.data) {
        setPerms({
          verify: !!permRes.data.can_verify,
          deletePosts: !!permRes.data.can_delete_posts,
          viewReports: !!permRes.data.can_view_reports,
        });
      } else {
        setPerms({ verify: false, deletePosts: false, viewReports: false });
      }

      const pathsToSign: string[] = [];
      pRes.data?.forEach((p) => p.avatar_url && pathsToSign.push(p.avatar_url));
      postRes.data?.forEach((p) => p.media_url && pathsToSign.push(p.media_url));
      sRes.data?.forEach((s) => s.media_url && pathsToSign.push(s.media_url));
      mRes.data?.forEach((m) => m.media_url && pathsToSign.push(m.media_url));
      const urls = await signPaths(pathsToSign);

      setUsers((pRes.data ?? []).map((p) => toUser(p, urls)));
      setPosts((postRes.data ?? []).map((p) => toPost(p, urls)));
      setStories((sRes.data ?? []).map((s) => toStory(s, urls)));
      setMessages((mRes.data ?? []).map((m) => toMessage(m, urls)));
      setNotifications((nRes.data ?? []).map(toNotification));
      setLiked(new Set((lRes.data ?? []).map((l) => l.post_id)));
      setSaved(new Set((svRes.data ?? []).map((s) => s.post_id)));
      setFollowing(new Set((fRes.data ?? []).map((f) => f.following_id)));
      setBlocked(new Set((bRes.data ?? []).map((b) => b.blocked_id)));

      const undelivered = (mRes.data ?? []).filter((m) => m.recipient_id === userId && !m.delivered_at).map((m) => m.id);
      if (undelivered.length) {
        supabase.from("messages").update({ delivered_at: new Date().toISOString() }).in("id", undelivered).then();
      }
    } catch {
      // silent background handling
    } finally {
      setReady(true);
    }
  };

  const syncMessages = async (meId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
        .order("created_at", { ascending: true });
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
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (!uid) { setReady(false); return; }
    load(uid);

    const channel = supabase
      .channel(`user-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${uid}` },
        async (p) => {
          try {
            const row = p.new as Tables["messages"]["Row"];
            let urls: Map<string, string> | undefined;
            try {
              urls = isPath(row.media_url) ? await signPaths([row.media_url!]) : undefined;
            } catch {}
            setMessages((m) => m.some((x) => x.id === row.id) ? m : [...m, toMessage(row, urls)]);
            supabase.from("messages").update({ delivered_at: new Date().toISOString() }).eq("id", row.id).is("delivered_at", null).then();
          } catch {}
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `sender_id=eq.${uid}` },
        (p) => {
          const row = p.new as Tables["messages"]["Row"];
          setMessages((ms) => ms.map((m) => m.id === row.id
            ? {
                ...m,
                read: !!row.read_at,
                deliveredAt: row.delivered_at ? ts(row.delivered_at) : m.deliveredAt,
                readAt: row.read_at ? ts(row.read_at) : m.readAt,
              }
            : m));
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (p) => setNotifications((n) => [toNotification(p.new as Tables["notifications"]["Row"]), ...n]))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") syncMessages(uid);
      });

    const onOnline = () => syncMessages(uid);
    window.addEventListener("online", onOnline);

    // Silent 2-second auto sync in background without page refresh
    const syncInterval = setInterval(() => {
      if (uid) syncMessages(uid);
    }, 2000);

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
      clearInterval(syncInterval);
      window.removeEventListener("online", onOnline);
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [uid]);

  const me = users.find((u) => u.id === uid);

  const conversations = useMemo<Conversation[]>(() => {
    if (!uid) return [];
    const map = new Map<string, Message[]>();
    for (const m of messages) {
      const other = m.fromId === uid ? m.toId : m.fromId;
      if (!map.has(other)) map.set(other, []);
      map.get(other)!.push(m);
    }
    return Array.from(map.entries()).map(([userId, ms]) => ({
      id: userId,
      userId,
      messages: ms,
      unread: ms.filter((m) => m.toId === uid && !m.read).length,
    }));
  }, [uid, messages]);

  const value = useMemo<Store>(() => {
    const myId = uid ?? "";
    return {
      ready,
      theme,
      me,
      users,
      posts,
      stories,
      notifications,
      conversations,
      liked,
      saved,
      following,
      blocked,
      isAdmin,
      perms,
      getUser: (id) => users.find((u) => u.id === id),
      getUserPresence: (userId: string) => {
        const isOnline = onlineUserIds.has(userId);
        if (isOnline) return { isOnline: true, lastSeen: Date.now() };
        let lastSeen = lastSeenMap[userId];
        if (!lastSeen) {
          const userMsgs = messages.filter((m) => m.fromId === userId);
          if (userMsgs.length > 0) lastSeen = userMsgs[userMsgs.length - 1].createdAt;
        }
        if (!lastSeen) {
          const userPosts = posts.filter((p) => p.userId === userId);
          if (userPosts.length > 0) lastSeen = userPosts[0].createdAt;
        }
        return { isOnline: false, lastSeen };
      },
      toggleLike: (postId) => {
        const wasLiked = liked.has(postId);
        setLiked((l) => { const n = new Set(l); wasLiked ? n.delete(postId) : n.add(postId); return n; });
        setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, likes: p.likes + (wasLiked ? -1 : 1) } : p)));
        (wasLiked ? supabase.from("likes").delete().match({ post_id: postId, user_id: myId }) : supabase.from("likes").insert({ post_id: postId, user_id: myId })).then();
      },
      toggleSave: (postId) => {
        const wasSaved = saved.has(postId);
        setSaved((s) => { const n = new Set(s); wasSaved ? n.delete(postId) : n.add(postId); return n; });
        (wasSaved ? supabase.from("saves").delete().match({ post_id: postId, user_id: myId }) : supabase.from("saves").insert({ post_id: postId, user_id: myId })).then();
      },
      toggleFollow: (userId) => {
        const wasFollowing = following.has(userId);
        setFollowing((f) => { const n = new Set(f); wasFollowing ? n.delete(userId) : n.add(userId); return n; });
        setUsers((us) => us.map((u) => {
          if (u.id === userId) return { ...u, followers: u.followers + (wasFollowing ? -1 : 1) };
          if (u.id === myId) return { ...u, following: u.following + (wasFollowing ? -1 : 1) };
          return u;
        }));
        (wasFollowing ? supabase.from("follows").delete().match({ follower_id: myId, following_id: userId }) : supabase.from("follows").insert({ follower_id: myId, following_id: userId })).then();
      },
      toggleBlock: (userId) => {
        const wasBlocked = blocked.has(userId);
        setBlocked((b) => { const n = new Set(b); wasBlocked ? n.delete(userId) : n.add(userId); return n; });
        (wasBlocked ? supabase.from("blocks").delete().match({ blocker_id: myId, blocked_id: userId }) : supabase.from("blocks").insert({ blocker_id: myId, blocked_id: userId })).then();
      },
      report: async (userId, reason, postId) => {
        await supabase.from("reports").insert({ reporter_id: myId, reported_user_id: userId, reported_post_id: postId ?? null, reason });
        toast.success("Report submitted — thank you for keeping shyfft safe");
      },
      addComment: async (postId, text) => {
        const { data } = await supabase.from("comments").insert({ post_id: postId, user_id: myId, text }).select().single();
        if (data) {
          const c = { id: data.id, userId: myId, text, createdAt: ts(data.created_at) };
          setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1, comments: [...p.comments, c] } : p)));
        }
      },
      createPost: async ({ file, kind, caption, location, onProgress }) => {
        const path = await uploadMedia(myId, file, onProgress);
        const media_type = file.type.startsWith("video") ? "video" : "image";
        const { data, error } = await supabase.from("posts").insert({
          user_id: myId, media_url: path, media_type, kind, caption, location: location ?? null,
        }).select().single();
        if (error) throw error;
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
        let media_url: string | null = null;
        let media_type: string | null = null;
        if (opts?.file) {
          if (opts.file.size > MAX_FILE_SIZE) return;
          if (!/^image\/|^video\//.test(opts.file.type)) return;
          try {
            media_url = await uploadMedia(myId, opts.file, opts.onProgress);
          } catch {
            return;
          }
          media_type = opts.file.type.startsWith("video") ? "video" : "image";
        }

        const trimmed = text.trim();
        const safeText = trimmed.length > 0 
          ? trimmed 
          : (opts?.file ? (opts.file.type.startsWith("video") ? "🎥 Video" : "📷 Photo") : (opts?.postId ? "🎬 Reel" : " "));

        try {
          const { data, error } = await supabase.from("messages").insert({
            sender_id: myId,
            recipient_id: userId,
            text: safeText,
            media_url,
            media_type,
            post_id: opts?.postId ?? null,
          }).select().single();

          if (error || !data) return;
          const urls = media_url ? await signPaths([media_url]) : undefined;
          setMessages((m) => m.some((x) => x.id === data.id) ? m : [...m, toMessage(data, urls)]);
        } catch {}
      },
      openConversation: (userId) => userId,
      markConversationRead: (userId) => {
        if (!messages.some((m) => m.fromId === userId && m.toId === myId && !m.read)) return;
        const now = new Date().toISOString();
        const nowTs = new Date(now).getTime();
        setMessages((ms) => ms.map((m) => (m.fromId === userId && m.toId === myId ? { ...m, read: true, readAt: nowTs } : m)));
        supabase.from("messages").update({ read_at: now }).match({ sender_id: userId, recipient_id: myId }).is("read_at", null).then();
      },
      markNotificationsRead: () => {
        setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
        supabase.from("notifications").update({ read: true }).eq("user_id", myId).eq("read", false).then();
      },
      updateMe: async (patch) => {
        const { error } = await supabase.from("profiles").update({
          username: patch.username,
          name: patch.name,
          bio: patch.bio,
          is_private: patch.isPrivate,
          onboarded: patch.onboarded,
        }).eq("id", myId);
        if (error) return error.message;
        setUsers((us) => us.map((u) => (u.id === myId ? { ...u, ...patch } : u)));
        return null;
      },
      uploadAvatar: async (file) => {
        const path = await uploadMedia(myId, file);
        const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", myId);
        if (error) throw error;
        const urls = await signPaths([path]);
        const signed = urls.get(path);
        setUsers((us) => us.map((u) => (u.id === myId ? { ...u, avatar: signed ?? u.avatar, avatarPath: path } : u)));
        toast.success("Profile photo updated");
      },
      setPrivateAccount: (isPrivate) => {
        setUsers((us) => us.map((u) => (u.id === myId ? { ...u, isPrivate } : u)));
        supabase.from("profiles").update({ is_private: isPrivate }).eq("id", myId).then();
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setUid(null);
      },
      refresh: () => load(myId),
      setVerified: async (userId, verified) => {
        const { error } = await supabase.rpc("set_user_verified", { _target: userId, _verified: verified });
        if (error) throw error;
        setUsers((us) => us.map((u) => (u.id === userId ? { ...u, verified } : u)));
      },
    };
  }, [uid, ready, authChecked, me, users, posts, stories, messages, conversations, notifications, liked, saved, following, blocked, theme, setTheme, isAdmin, perms, onlineUserIds, lastSeenMap]);

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
    deliveredAt: m.delivered_at ? ts(m.delivered_at) : undefined,
    readAt: m.read_at ? ts(m.read_at) : undefined,
    media: m.media_url ? (mediaPath ? urls?.get(mediaPath) : m.media_url) : undefined,
    mediaType: m.media_type as Message["mediaType"],
    postId: m.post_id ?? undefined,
  };
}

function toPost(p: Tables["posts"]["Row"] & { comments?: Tables["comments"]["Row"][] }, urls: Map<string, string>): Post {
  const mediaPath = isPath(p.media_url) ? p.media_url : null;
  return {
    id: p.id,
    userId: p.user_id,
    media: mediaPath ? urls.get(mediaPath) ?? p.media_url : p.media_url,
    mediaType: p.media_type as Post["mediaType"],
    kind: p.kind as Post["kind"],
    caption: p.caption,
    likes: p.likes_count,
    commentCount: p.comments_count,
    comments: (p.comments ?? []).map((c) => ({
      id: c.id,
      userId: c.user_id,
      text: c.text,
      createdAt: ts(c.created_at),
    })),
    createdAt: ts(p.created_at),
    location: p.location ?? undefined,
  };
}

function toStory(s: Tables["stories"]["Row"], urls: Map<string, string>): Story {
  const mediaPath = isPath(s.media_url) ? s.media_url : null;
  return {
    id: s.id,
    userId: s.user_id,
    media: mediaPath ? urls.get(mediaPath) ?? s.media_url : s.media_url,
    createdAt: ts(s.created_at),
  };
}

function toNotification(n: Tables["notifications"]["Row"]): Notification {
  return {
    id: n.id,
    type: n.type as Notification["type"],
    userId: n.actor_id ?? n.user_id,
    postId: n.post_id ?? undefined,
    createdAt: ts(n.created_at),
    read: n.read,
  };
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be inside StoreProvider");
  return v;
}
