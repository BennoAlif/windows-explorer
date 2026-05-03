import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FolderTreeNode from "./FolderTreeNode.vue";
import { loadFolderNodeChildren } from "@/lib/api";
import { makeFolderNode } from "@/test/factories";

vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();

	return {
		...actual,
		loadFolderNodeChildren: vi.fn(),
	};
});

const loadFolderNodeChildrenMock = vi.mocked(loadFolderNodeChildren);

describe("FolderTreeNode", () => {
	beforeEach(() => {
		loadFolderNodeChildrenMock.mockReset();
		loadFolderNodeChildrenMock.mockResolvedValue();
	});

	it("renders the folder name", () => {
		const folder = makeFolderNode({ name: "Documents" });
		const wrapper = mount(FolderTreeNode, {
			props: { folder, selectedId: null, depth: 0 },
		});

		expect(wrapper.text()).toContain("Documents");
	});

	it("applies selected styling when the folder is selected", () => {
		const folder = makeFolderNode({ id: 10 });
		const wrapper = mount(FolderTreeNode, {
			props: { folder, selectedId: 10, depth: 0 },
		});

		expect(wrapper.classes()).toContain("bg-accent");
		expect(wrapper.classes()).toContain("text-accent-foreground");
	});

	it("emits select when the row is clicked", async () => {
		const folder = makeFolderNode({ id: 10 });
		const wrapper = mount(FolderTreeNode, {
			props: { folder, selectedId: null, depth: 0 },
		});

		await wrapper.trigger("click");

		expect(wrapper.emitted("select")).toEqual([[folder]]);
	});

	it("loads children and toggles open when children exist", async () => {
		const folder = makeFolderNode({
			children: [makeFolderNode({ id: 11, name: "Child", parentId: 10 })],
			isOpen: false,
		});
		const wrapper = mount(FolderTreeNode, {
			props: { folder, selectedId: null, depth: 0 },
		});

		await wrapper.get("button").trigger("click");

		expect(loadFolderNodeChildrenMock).toHaveBeenCalledWith(folder);
		expect(folder.isOpen).toBe(true);
		expect(wrapper.emitted("select")).toBeUndefined();
	});

	it("does not toggle open when loading finds no children", async () => {
		const folder = makeFolderNode({ children: [], isOpen: false });
		const wrapper = mount(FolderTreeNode, {
			props: { folder, selectedId: null, depth: 0 },
		});

		await wrapper.get("button").trigger("click");

		expect(loadFolderNodeChildrenMock).toHaveBeenCalledWith(folder);
		expect(folder.isOpen).toBe(false);
	});

	it("keeps deeply nested folder names visible through non-collapsing classes", () => {
		const folder = makeFolderNode({
			name: "A very long folder name at a deep nesting level",
		});
		const wrapper = mount(FolderTreeNode, {
			props: { folder, selectedId: null, depth: 12 },
		});

		expect(wrapper.classes()).toEqual(
			expect.arrayContaining(["w-max", "min-w-full"]),
		);
		expect(wrapper.get("span.whitespace-nowrap").text()).toBe(folder.name);
		expect(wrapper.attributes("style")).toContain("padding-left: 196px");
	});
});
