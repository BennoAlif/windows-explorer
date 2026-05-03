import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import FolderTree from "./FolderTree.vue";
import { makeFolderNode } from "@/test/factories";

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

describe("FolderTree", () => {
	it("renders visible root folders", () => {
		const folders = [
			makeFolderNode({ id: 1, name: "Documents" }),
			makeFolderNode({ id: 2, name: "Pictures" }),
		];

		const wrapper = mount(FolderTree, {
			props: {
				folders,
				selectedId: null,
				hasMore: false,
				isLoadingMore: false,
			},
		});

		expect(wrapper.text()).toContain("Documents");
		expect(wrapper.text()).toContain("Pictures");
	});

	it("renders children for expanded folders", () => {
		const child = makeFolderNode({ id: 2, name: "Nested", parentId: 1 });
		const folders = [
			makeFolderNode({
				id: 1,
				name: "Root",
				children: [child],
				isOpen: true,
			}),
		];

		const wrapper = mount(FolderTree, {
			props: {
				folders,
				selectedId: null,
				hasMore: false,
				isLoadingMore: false,
			},
		});

		expect(wrapper.text()).toContain("Root");
		expect(wrapper.text()).toContain("Nested");
	});

	it("emits select when a node is selected", async () => {
		const folder = makeFolderNode({ id: 1, name: "Root" });
		const wrapper = mount(FolderTree, {
			props: {
				folders: [folder],
				selectedId: null,
				hasMore: false,
				isLoadingMore: false,
			},
		});

		await wrapper
			.getComponent({ name: "FolderTreeNode" })
			.vm.$emit("select", folder);

		expect(wrapper.emitted("select")).toEqual([[folder]]);
	});

	it("emits loadMore when scrolled near the bottom and more roots exist", async () => {
		const wrapper = mount(FolderTree, {
			props: {
				folders: [makeFolderNode()],
				selectedId: null,
				hasMore: true,
				isLoadingMore: false,
			},
		});
		const scroller = wrapper.get(".h-full.overflow-auto");
		setScrollMetrics(scroller.element, {
			scrollHeight: 1000,
			scrollTop: 850,
			clientHeight: 100,
		});

		await scroller.trigger("scroll");

		expect(wrapper.emitted("loadMore")).toHaveLength(1);
	});

	it("does not emit loadMore while already loading", async () => {
		const wrapper = mount(FolderTree, {
			props: {
				folders: [makeFolderNode()],
				selectedId: null,
				hasMore: true,
				isLoadingMore: true,
			},
		});
		const scroller = wrapper.get(".h-full.overflow-auto");
		setScrollMetrics(scroller.element, {
			scrollHeight: 1000,
			scrollTop: 850,
			clientHeight: 100,
		});

		await scroller.trigger("scroll");

		expect(wrapper.emitted("loadMore")).toBeUndefined();
	});
});
