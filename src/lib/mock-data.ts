import p1 from "@/assets/p1.jpg";
import p2 from "@/assets/p2.jpg";
import p3 from "@/assets/p3.jpg";
import p4 from "@/assets/p4.jpg";
import type { Conversation, Notification, Post, Story, User } from "./types";

const av = (seed: string) => `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=c0f2dc,b6d8ff,d1f7ef`;
const now = Date.now();
const h = 3600_000;

export const ME_ID = "me";

export const seedUsers: User[] = [
  { id: ME_ID, username: "you", name: "You", avatar: av("you"), bio: "Shifting perspectives ✨", followers: 248, following: 180 },
  { id: "u1", username: "maya.wild", name: "Maya Rivers", avatar: av("maya"), bio: "Mountains & mornings 🏔️", verified: true, followers: 12400, following: 320 },
  { id: "u2", username: "neon.nora", name: "Nora Vance", avatar: av("nora"), bio: "Night photographer · NYC", followers: 8930, following: 412 },
  { id: "u3", username: "brew.lab", name: "Brew Lab Café", avatar: av("brew"), bio: "Small batch coffee ☕", followers: 3120, following: 88 },
  { id: "u4", username: "kai.skates", name: "Kai Moreno", avatar: av("kai"), bio: "Skate. Film. Repeat.", followers: 21800, following: 150, verified: true },
  { id: "u5", username: "lena.draws", name: "Lena Park", avatar: av("lena"), bio: "Illustrator 🎨", followers: 5400, following: 610, isPrivate: true },
];

const imgs = [p1, p2, p3, p4];

export const seedPosts: Post[] = [
  { id: "p1", userId: "u1", media: p1, mediaType: "image", kind: "post", caption: "Fog rolled in just as the sun came up. Worth the 4am alarm.", likes: 1284, location: "Lake Bled", createdAt: now - 2 * h, comments: [
    { id: "c1", userId: "u2", text: "Unreal colours 😍", createdAt: now - h },
    { id: "c2", userId: "u4", text: "Need to go here", createdAt: now - 0.5 * h },
  ] },
  { id: "p2", userId: "u2", media: p2, mediaType: "image", kind: "post", caption: "City glow after the rain.", likes: 932, location: "Manhattan", createdAt: now - 5 * h, comments: [] },
  { id: "p3", userId: "u3", media: p3, mediaType: "image", kind: "post", caption: "Fresh croissants out of the oven every morning 🥐", likes: 418, createdAt: now - 9 * h, comments: [
    { id: "c3", userId: "u1", text: "My Sunday plan sorted", createdAt: now - 7 * h },
  ] },
  { id: "p4", userId: "u4", media: p4, mediaType: "image", kind: "reel", caption: "Finally landed it 🛹", likes: 5210, createdAt: now - 20 * h, comments: [] },
  ...Array.from({ length: 8 }, (_, i): Post => ({
    id: `x${i}`, userId: seedUsers[(i % 5) + 1].id, media: imgs[i % 4], mediaType: "image", kind: i % 3 === 0 ? "reel" : "post",
    caption: "Moments ✨", likes: 100 + i * 37, createdAt: now - (24 + i * 6) * h, comments: [],
  })),
];

export const seedStories: Story[] = [
  { id: "s1", userId: "u1", media: p1, createdAt: now - 3 * h },
  { id: "s2", userId: "u2", media: p2, createdAt: now - 6 * h },
  { id: "s3", userId: "u4", media: p4, createdAt: now - 10 * h },
  { id: "s4", userId: "u3", media: p3, createdAt: now - 14 * h },
  { id: "s5", userId: "u5", media: p2, createdAt: now - 30 * h }, // expired, filtered out
];

export const seedConversations: Conversation[] = [
  { id: "d1", userId: "u1", unread: 2, messages: [
    { id: "m1", fromId: "u1", text: "Hey! Loved your last post", createdAt: now - 2 * h },
    { id: "m2", fromId: ME_ID, text: "Thank you!! 🙌", createdAt: now - 1.8 * h },
    { id: "m3", fromId: "u1", text: "Want to shoot together this weekend?", createdAt: now - 0.4 * h },
  ] },
  { id: "d2", userId: "u4", unread: 0, messages: [
    { id: "m4", fromId: "u4", text: "That trick took 40 tries lol", createdAt: now - 20 * h },
  ] },
  { id: "d3", userId: "u3", unread: 0, messages: [
    { id: "m5", fromId: ME_ID, text: "Are you open on Sunday?", createdAt: now - 30 * h },
    { id: "m6", fromId: "u3", text: "8am to 4pm ☕", createdAt: now - 29 * h },
  ] },
];

export const seedNotifications: Notification[] = [
  { id: "n1", type: "like", userId: "u1", postId: "p1", createdAt: now - 0.2 * h, read: false },
  { id: "n2", type: "follow", userId: "u4", createdAt: now - 1 * h, read: false },
  { id: "n3", type: "comment", userId: "u2", postId: "p1", text: "Unreal colours 😍", createdAt: now - 3 * h, read: true },
  { id: "n4", type: "mention", userId: "u3", postId: "p3", text: "mentioned you in a comment", createdAt: now - 26 * h, read: true },
];

export function timeAgo(t: number) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function compact(n: number) {
  return Intl.NumberFormat("en", { notation: "compact" }).format(n);
}
