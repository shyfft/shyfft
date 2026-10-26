import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message, User } from "@/lib/types";

const mocks = vi.hoisted(() => ({ store: {} as any, send: vi.fn(), broadcast: vi.fn(), subscribe: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/store", () => ({ MAX_FILE_SIZE: 250 * 1024 * 1024, useStore: () => mocks.store }));
vi.mock("@/components/shyfft/CallManager", () => ({ startCall: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  channel: () => { mocks.subscribe(); const c = { on: () => c, subscribe: () => c, send: mocks.broadcast }; return c; },
  removeChannel: mocks.remove,
} }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({ useParams: () => ({ id: "other" }) }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
import { Chat } from "@/routes/_authenticated/messages.$id";

const user: User = { id: "other", username: "other", name: "Other", avatar: "", avatarPath: null, bio: "", onboarded: true, followers: 0, following: 0 };
const message: Message = { id: "message-1", fromId: "other", toId: "me", text: "Received message", createdAt: 1792980000000, read: false };

describe("Chat updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.broadcast.mockResolvedValue("ok");
    mocks.remove.mockResolvedValue("ok");
    mocks.send.mockResolvedValue(undefined);
    mocks.store = { me: { id: "me" }, conversations: [], getUser: () => user, getUserPresence: () => ({ isOnline: false }), posts: [], sendMessage: mocks.send, markConversationRead: vi.fn() };
  });

  it("keeps the draft and conversation usable when sending fails", async () => {
    mocks.send.mockRejectedValueOnce(new Error("Network unavailable"));
    render(<Chat />);
    fireEvent.change(screen.getByPlaceholderText("Message…"), { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Send", exact: true }));
    await screen.findByRole("alert");
    expect(screen.getByPlaceholderText("Message…")).toHaveValue("Keep this draft");
    fireEvent.click(screen.getByRole("button", { name: "Send", exact: true }));
    await waitFor(() => expect(screen.getByPlaceholderText("Message…")).toHaveValue(""));
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("handles received messages and receipt changes without losing a draft or resubscribing", () => {
    const { rerender } = render(<Chat />);
    fireEvent.change(screen.getByPlaceholderText("Message…"), { target: { value: "Typing a reply" } });
    act(() => { mocks.store.conversations = [{ id: "other", messages: [message], unread: 1 }]; });
    rerender(<Chat />);
    expect(screen.getByText("Received message")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Message…")).toHaveValue("Typing a reply");
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.store.markConversationRead).toHaveBeenCalledWith("other");
    mocks.store.conversations = [{ id: "other", messages: [{ ...message, fromId: "me", read: true, readAt: message.createdAt + 60000 }], unread: 0 }];
    rerender(<Chat />);
    expect(screen.getByLabelText("Seen")).toHaveTextContent("Seen ·");
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  });

  it("contains typing network failures instead of letting them escape the chat", async () => {
    mocks.broadcast.mockRejectedValue(new Error("Socket disconnected"));
    render(<Chat />);
    fireEvent.change(screen.getByPlaceholderText("Message…"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send", exact: true }));
    await waitFor(() => expect(screen.getByPlaceholderText("Message…")).toHaveValue(""));
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
  });
});