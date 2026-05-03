import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import SearchResults from "./SearchResults.vue";
import { makeSearchFile, makeSearchFolder } from "@/test/factories";

vi.mock("@tanstack/vue-virtual", async () => {
	const { computed, unref } = await import("vue");

	return {
		useVirtualizer: (options: unknown) =>
			computed(() => {
				const resolved = unref(options) as {
					count: number;
					estimateSize: () => number;
				};
				const size = resolved.estimateSize();

				return {
					getVirtualItems: () =>
						Array.from({ length: resolved.count }, (_, index) => ({
							index,
							key: index,
							size,
							start: index * size,
						})),
					getTotalSize: () => resolved.count * size,
				};
			}),
	};
});

function setScrollMetrics(
	element: Element,
	metrics: { scrollHeight: number; scrollTop: number; clientHeight: number },
) {
	Object.defineProperties(element, {
		scrollHeight: { configurable: true, value: metrics.scrollHeight },
		scrollTop: { configurable: true, value: metrics.scrollTop },
		clientHeight: { configurable: true, value: metrics.clientHeight },
	});
}

describe("SearchResults", () => {
	it("shows the initial loading state", () => {
		const wrapper = mount(SearchResults, {
			props: { items: [], loading: true, hasMore: false, query: "doc" },
		});

		expect(wrapper.text()).toContain("Searching...");
	});

	it("shows the empty state", () => {
		const wrapper = mount(SearchResults, {
			props: { items: [], loading: false, hasMore: false, query: "doc" },
		});

		expect(wrapper.text()).toContain("No results found");
	});

	it("renders result names and paths", () => {
		const wrapper = mount(SearchResults, {
			props: {
				items: [
					makeSearchFolder({ id: 1, name: "Documents", path: "/Documents" }),
					makeSearchFile({
						id: 2,
						name: "Resume.pdf",
						path: "/Documents/Resume.pdf",
					}),
				],
				loading: false,
				hasMore: false,
				query: "doc",
			},
		});

		expect(wrapper.text()).toContain("Documents");
		expect(wrapper.text()).toContain("/Documents");
		expect(wrapper.text()).toContain("Resume.pdf");
		expect(wrapper.text()).toContain("/Documents/Resume.pdf");
	});

	it("emits selectItem when a result is clicked", async () => {
		const item = makeSearchFolder({ id: 1, name: "Documents" });
		const wrapper = mount(SearchResults, {
			props: {
				items: [item],
				loading: false,
				hasMore: false,
				query: "doc",
			},
		});

		await wrapper.get("button").trigger("click");

		expect(wrapper.emitted("selectItem")).toEqual([[item]]);
	});

	it("emits loadMore when scrolled near the bottom and more results exist", async () => {
		const wrapper = mount(SearchResults, {
			props: {
				items: [makeSearchFolder()],
				loading: false,
				hasMore: true,
				query: "doc",
			},
		});
		const scroller = wrapper.get(".min-h-0.flex-1.overflow-auto");
		setScrollMetrics(scroller.element, {
			scrollHeight: 1000,
			scrollTop: 850,
			clientHeight: 100,
		});

		await scroller.trigger("scroll");

		expect(wrapper.emitted("loadMore")).toHaveLength(1);
	});

	it("does not emit loadMore while loading", async () => {
		const wrapper = mount(SearchResults, {
			props: {
				items: [makeSearchFolder()],
				loading: true,
				hasMore: true,
				query: "doc",
			},
		});
		const scroller = wrapper.get(".min-h-0.flex-1.overflow-auto");
		setScrollMetrics(scroller.element, {
			scrollHeight: 1000,
			scrollTop: 850,
			clientHeight: 100,
		});

		await scroller.trigger("scroll");

		expect(wrapper.emitted("loadMore")).toBeUndefined();
	});
});
