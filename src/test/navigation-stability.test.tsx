import { useEffect, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ router: { resolvedLocation: { pathname: "/" }, isLoading: false, status: "idle" } }));
vi.mock("@tanstack/react-router", () => ({ useRouterState: ({ select }: { select: (s: typeof state.router) => unknown }) => select(state.router) }));
import { PageFade } from "@/components/shyfft/NavProgress";

describe("Navigation lifecycle", () => {
  it("preserves shared state and subscriptions while navigation is pending and after the path changes", () => {
    const mount = vi.fn();
    const cleanup = vi.fn();
    function Workspace() {
      const [n, setN] = useState(0);
      useEffect(() => { mount(); return cleanup; }, []);
      return <button onClick={() => setN(n + 1)}>Draft {n}</button>;
    }
    const { rerender } = render(<PageFade><Workspace /></PageFade>);
    fireEvent.click(screen.getByText("Draft 0"));
    state.router.isLoading = true;
    rerender(<PageFade><Workspace /></PageFade>);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
    state.router.isLoading = false;
    state.router.resolvedLocation.pathname = "/reels";
    rerender(<PageFade><Workspace /></PageFade>);
    expect(screen.getByText("Draft 1")).toBeInTheDocument();
    expect(mount).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
  });
});