import { vi } from "vitest";

class ResizeObserverMock implements ResizeObserver {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}

Object.defineProperty(globalThis, "ResizeObserver", {
	value: ResizeObserverMock,
	writable: true,
});

Object.defineProperty(HTMLElement.prototype, "scrollTo", {
	value: vi.fn(),
	writable: true,
});
