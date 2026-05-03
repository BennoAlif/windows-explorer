import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FolderContents from "./FolderContents.vue";
import { loadMoreFolderNodeItems } from "@/lib/api";
import { makeFileItem, makeFolderItem, makeFolderNode } from "@/test/factories";

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

vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();

	return {
		...actual,
		loadMoreFolderNodeItems: vi.fn(),
	};
});

const loadMoreFolderNodeItemsMock = vi.mocked(loadMoreFolderNodeItems);

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

function findButtonByText(wrapper: VueWrapper, text: string) {
	const button = wrapper
		.findAll("button")
		.find((candidate) => candidate.text().includes(text));

	if (!button) {
		throw new Error(`Button not found: ${text}`);
	}

	return button;
}

function findItemRow(wrapper: VueWrapper, name: string) {
	const row = wrapper.findAll("div").find((candidate) => {
		const classes = candidate.classes();

		return (
			candidate.text().includes(name) &&
			classes.includes("h-9") &&
			classes.includes("px-2")
		);
	});

	if (!row) {
		throw new Error(`Item row not found: ${name}`);
	}

	return row;
}

describe("FolderContents", () => {
	beforeEach(() => {
		loadMoreFolderNodeItemsMock.mockReset();
		loadMoreFolderNodeItemsMock.mockResolvedValue();
	});

	it("shows the unselected state", () => {
		const wrapper = mount(FolderContents, {
			props: { folder: null, breadcrumbs: [] },
		});

		expect(wrapper.text()).toContain("Select a folder");
	});

	it("shows the loading state", () => {
		const folder = makeFolderNode({
			isLoading: true,
			itemsLoaded: false,
		});
		const wrapper = mount(FolderContents, {
			props: { folder, breadcrumbs: [folder] },
		});

		expect(wrapper.text()).toContain("Loading folder contents...");
	});

	it("shows the empty state", () => {
		const folder = makeFolderNode({
			items: [],
			itemsLoaded: true,
		});
		const wrapper = mount(FolderContents, {
			props: { folder, breadcrumbs: [folder] },
		});

		expect(wrapper.text()).toContain("This folder is empty");
	});

	it("renders breadcrumbs and emits navigation actions", async () => {
		const root = makeFolderNode({ id: 1, name: "Root" });
		const child = makeFolderNode({ id: 2, name: "Child", parentId: 1 });
		const wrapper = mount(FolderContents, {
			props: { folder: child, breadcrumbs: [root, child] },
		});

		await wrapper.get("button").trigger("click");
		await findButtonByText(wrapper, "Explorer").trigger("click");
		await findButtonByText(wrapper, "Root").trigger("click");

		expect(wrapper.emitted("goBack")).toHaveLength(1);
		expect(wrapper.emitted("selectRoot")).toHaveLength(1);
		expect(wrapper.emitted("navigateTo")).toEqual([[root]]);
	});

	it("keeps long breadcrumbs constrained away from action buttons", () => {
		const folder = makeFolderNode({ name: "Current" });
		const wrapper = mount(FolderContents, {
			props: { folder, breadcrumbs: [folder] },
		});

		expect(wrapper.get("header > div").classes()).toEqual(
			expect.arrayContaining(["grid", "sm:grid-cols-[minmax(0,1fr)_auto]"]),
		);
		expect(wrapper.get('[data-slot="breadcrumb"]').classes()).toEqual(
			expect.arrayContaining(["min-w-0", "overflow-x-auto"]),
		);
		expect(wrapper.get('[data-slot="breadcrumb-list"]').classes()).toEqual(
			expect.arrayContaining(["w-max", "flex-nowrap"]),
		);
	});

	it("emits toolbar actions", async () => {
		const folder = makeFolderNode();
		const wrapper = mount(FolderContents, {
			props: { folder, breadcrumbs: [folder] },
		});

		await findButtonByText(wrapper, "New Folder").trigger("click");
		await findButtonByText(wrapper, "New File").trigger("click");
		await findButtonByText(wrapper, "Rename").trigger("click");
		await findButtonByText(wrapper, "Delete").trigger("click");

		expect(wrapper.emitted("createFolder")).toHaveLength(1);
		expect(wrapper.emitted("createFile")).toHaveLength(1);
		expect(wrapper.emitted("renameFolder")).toHaveLength(1);
		expect(wrapper.emitted("deleteFolder")).toHaveLength(1);
	});

	it("renders list rows and emits row actions", async () => {
		const folderItem = makeFolderItem({ id: 10, name: "Child folder" });
		const fileItem = makeFileItem({ id: 11, name: "Notes.txt" });
		const folder = makeFolderNode({
			items: [folderItem, fileItem],
			itemsLoaded: true,
		});
		const wrapper = mount(FolderContents, {
			props: { folder, breadcrumbs: [folder] },
		});

		await findItemRow(wrapper, "Child folder").trigger("click");
		await wrapper.get('button[title="Rename"]').trigger("click");
		const moveButtons = wrapper.findAll('button[title="Move"]');
		expect(moveButtons).toHaveLength(0);
		await wrapper.get('button[title="Delete"]').trigger("click");

		expect(wrapper.text()).toContain("Child folder");
		expect(wrapper.text()).toContain("Notes.txt");
		expect(wrapper.emitted("selectFolder")).toEqual([[folderItem]]);
		expect(wrapper.emitted("renameItem")).toEqual([[folderItem]]);
		expect(wrapper.emitted("deleteItem")).toEqual([[folderItem]]);
	});

	it("switches to grid mode and still emits folder and item actions", async () => {
		const folderItem = makeFolderItem({ id: 10, name: "Grid folder" });
		const folder = makeFolderNode({
			items: [folderItem],
			itemsLoaded: true,
		});
		const wrapper = mount(FolderContents, {
			props: { folder, breadcrumbs: [folder] },
		});

		await wrapper.get('button[title="Grid view"]').trigger("click");
		await nextTick();
		const card = wrapper.findAll("div").find((candidate) => {
			const classes = candidate.classes();

			return (
				candidate.text().includes("Grid folder") &&
				classes.includes("group") &&
				classes.includes("relative")
			);
		});

		if (!card) {
			throw new Error("Grid card not found");
		}

		await card.trigger("click");
		await wrapper.get('button[title="Rename"]').trigger("click");

		expect(wrapper.emitted("selectFolder")).toEqual([[folderItem]]);
		expect(wrapper.emitted("renameItem")).toEqual([[folderItem]]);
	});

	it("loads more items when scrolled near the bottom", async () => {
		const folder = makeFolderNode({
			items: [makeFolderItem()],
			itemsLoaded: true,
			nextCursor: "next-page",
		});
		const wrapper = mount(FolderContents, {
			props: { folder, breadcrumbs: [folder] },
		});

		await nextTick();
		loadMoreFolderNodeItemsMock.mockClear();
		const scroller = wrapper.get(".min-h-0.flex-1.overflow-auto");
		setScrollMetrics(scroller.element, {
			scrollHeight: 1000,
			scrollTop: 850,
			clientHeight: 100,
		});

		await scroller.trigger("scroll");

		expect(loadMoreFolderNodeItemsMock).toHaveBeenCalledWith(folder);
	});
});
