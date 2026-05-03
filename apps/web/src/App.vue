<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { FileDTO, FolderDTO, FolderItemDTO, SearchItemDTO } from 'types';
import {
  createFile,
  createFolder,
  deleteFile,
  deleteFolder,
  folderDTOToNode,
  loadRootFolderPage,
  loadFolderNodeItems,
  searchPage,
  updateFile,
  updateFolder,
  type FolderNode,
} from '@/lib/api';
import { Search, X } from 'lucide-vue-next';
import FolderTree from '@/components/FolderTree.vue';
import FolderContents from '@/components/FolderContents.vue';
import SearchResults from '@/components/SearchResults.vue';

const folders = ref<FolderNode[]>([]);
const selectedFolder = ref<FolderNode | null>(null);
const loading = ref(true);
const loadingMoreRoots = ref(false);
const rootNextCursor = ref<string | null>(null);
const error = ref<string | null>(null);

const searchQuery = ref('');
const searchResults = ref<SearchItemDTO[]>([]);
const searchNextCursor = ref<string | null>(null);
const isSearchMode = ref(false);
const searchLoading = ref(false);

onMounted(async () => {
  try {
    const page = await loadRootFolderPage();

    folders.value = page.folders;
    rootNextCursor.value = page.nextCursor;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load folders';
  } finally {
    loading.value = false;
  }
});

async function selectFolder(folder: FolderNode) {
  selectedFolder.value = folder;

  try {
    await loadFolderNodeItems(selectedFolder.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load folder';
  }
}

async function loadMoreRootFolders() {
  if (!rootNextCursor.value || loadingMoreRoots.value) return;

  loadingMoreRoots.value = true;

  try {
    const page = await loadRootFolderPage(rootNextCursor.value);

    folders.value.push(...page.folders);
    rootNextCursor.value = page.nextCursor;
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Failed to load more folders';
  } finally {
    loadingMoreRoots.value = false;
  }
}

function selectRoot() {
  selectedFolder.value = null;
}

function findFolderNode(
  nodes: FolderNode[],
  id: FolderNode['id'],
): FolderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;

    const child = findFolderNode(node.children, id);
    if (child) return child;
  }

  return null;
}

function removeFolderNode(
  nodes: FolderNode[],
  id: FolderNode['id'],
): FolderNode | null {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const [removed] = nodes.splice(index, 1);
    return removed ?? null;
  }

  for (const node of nodes) {
    const removed = removeFolderNode(node.children, id);
    if (removed) return removed;
  }

  return null;
}

function folderTreeContainsId(
  folder: FolderNode,
  id: FolderNode['id'],
): boolean {
  if (folder.id === id) return true;
  return folder.children.some((child) => folderTreeContainsId(child, id));
}

function removeItemFromLoadedFolders(type: FolderItemDTO['type'], id: number) {
  const visit = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      const index = node.items.findIndex(
        (item) => item.type === type && item.id === id,
      );

      if (index >= 0) {
        node.items.splice(index, 1);
      }

      visit(node.children);
    }
  };

  visit(folders.value);
}

function renameFolderLocally(folder: FolderDTO) {
  const node = findFolderNode(folders.value, folder.id);
  if (node) {
    node.name = folder.name;
    node.parentId = folder.parentId;
  }

  const visit = (nodes: FolderNode[]) => {
    for (const current of nodes) {
      const item = current.items.find(
        (candidate) =>
          candidate.type === 'folder' && candidate.id === folder.id,
      );

      if (item) item.name = folder.name;
      visit(current.children);
    }
  };

  visit(folders.value);
}

function renameFileLocally(file: FileDTO) {
  const visit = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      const item = node.items.find(
        (candidate) => candidate.type === 'file' && candidate.id === file.id,
      );

      if (item) item.name = file.name;
      visit(node.children);
    }
  };

  visit(folders.value);
}

function appendFolderToParent(folder: FolderDTO) {
  const item: FolderItemDTO = {
    type: 'folder',
    id: folder.id,
    name: folder.name,
  };
  const node = folderDTOToNode(folder);

  if (folder.parentId === null) {
    folders.value.push(node);
    return;
  }

  const parent = findFolderNode(folders.value, folder.parentId);
  if (!parent) return;

  if (!parent.children.some((child) => child.id === folder.id)) {
    parent.children.push(node);
  }

  if (
    parent.itemsLoaded &&
    !parent.items.some(
      (candidate) => candidate.type === 'folder' && candidate.id === folder.id,
    )
  ) {
    parent.items.push(item);
  }
}

function appendFileToFolder(file: FileDTO) {
  const parent = findFolderNode(folders.value, file.folderId);
  if (!parent || !parent.itemsLoaded) return;

  if (
    parent.items.some(
      (candidate) => candidate.type === 'file' && candidate.id === file.id,
    )
  ) {
    return;
  }

  parent.items.push({
    type: 'file',
    id: file.id,
    name: file.name,
  });
}

async function createFolderAction() {
  const name = window
    .prompt(selectedFolder.value ? 'New folder name' : 'New root folder name')
    ?.trim();

  if (!name) return;

  try {
    const folder = await createFolder({
      name,
      parentId: selectedFolder.value?.id ?? null,
    });

    appendFolderToParent(folder);
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Failed to create folder';
  }
}

async function createFileAction() {
  if (!selectedFolder.value) return;

  const name = window.prompt('New file name')?.trim();
  if (!name) return;

  try {
    const file = await createFile(selectedFolder.value.id, { name });

    appendFileToFolder(file);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create file';
  }
}

async function renameSelectedFolderAction() {
  if (!selectedFolder.value) return;

  const name = window
    .prompt('Rename folder', selectedFolder.value.name)
    ?.trim();
  if (!name || name === selectedFolder.value.name) return;

  try {
    const folder = await updateFolder(selectedFolder.value.id, { name });

    renameFolderLocally(folder);
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Failed to rename folder';
  }
}

async function deleteSelectedFolderAction() {
  if (!selectedFolder.value) return;
  if (!window.confirm(`Delete folder "${selectedFolder.value.name}"?`)) return;

  const deletedId = selectedFolder.value.id;

  try {
    await deleteFolder(deletedId);
    const removed = removeFolderNode(folders.value, deletedId);
    removeItemFromLoadedFolders('folder', deletedId);

    if (
      !removed ||
      !selectedFolder.value ||
      folderTreeContainsId(removed, selectedFolder.value.id)
    ) {
      selectedFolder.value = null;
    }
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Failed to delete folder';
  }
}

async function renameItemAction(item: FolderItemDTO) {
  const name = window.prompt(`Rename ${item.type}`, item.name)?.trim();
  if (!name || name === item.name) return;

  try {
    if (item.type === 'folder') {
      const folder = await updateFolder(item.id, { name });
      renameFolderLocally(folder);
    } else {
      const file = await updateFile(item.id, { name });
      renameFileLocally(file);
    }
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : `Failed to rename ${item.type}`;
  }
}

async function moveItemAction(item: FolderItemDTO) {
  const target = window
    .prompt(
      item.type === 'folder'
        ? 'Move to parent folder ID. Leave empty for root.'
        : 'Move to folder ID.',
    )
    ?.trim();

  if (target === undefined) return;

  const targetId = target === '' ? null : Number(target);
  if (targetId !== null && !Number.isInteger(targetId)) {
    error.value = 'Folder ID must be a number';
    return;
  }

  try {
    if (item.type === 'folder') {
      const folder = await updateFolder(item.id, { parentId: targetId });
      const movedNode = removeFolderNode(folders.value, item.id);

      removeItemFromLoadedFolders('folder', item.id);
      appendFolderToParent(folder);

      const appendedNode = findFolderNode(folders.value, folder.id);
      if (movedNode && appendedNode) {
        appendedNode.children = movedNode.children;
        appendedNode.items = movedNode.items;
        appendedNode.isOpen = movedNode.isOpen;
        appendedNode.isLoading = movedNode.isLoading;
        appendedNode.itemsLoaded = movedNode.itemsLoaded;
        appendedNode.childrenLoaded = movedNode.childrenLoaded;
        appendedNode.nextCursor = movedNode.nextCursor;

        if (selectedFolder.value?.id === appendedNode.id) {
          selectedFolder.value = appendedNode;
        }
      }
      renameFolderLocally(folder);
    } else {
      if (targetId === null) {
        error.value = 'Files must be moved into a folder';
        return;
      }

      const file = await updateFile(item.id, { folderId: targetId });

      removeItemFromLoadedFolders('file', item.id);
      appendFileToFolder(file);
    }
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : `Failed to move ${item.type}`;
  }
}

async function deleteItemAction(item: FolderItemDTO) {
  if (!window.confirm(`Delete ${item.type} "${item.name}"?`)) return;

  try {
    if (item.type === 'folder') {
      await deleteFolder(item.id);
      const removed = removeFolderNode(folders.value, item.id);
      removeItemFromLoadedFolders('folder', item.id);

      if (
        removed &&
        selectedFolder.value &&
        folderTreeContainsId(removed, selectedFolder.value.id)
      ) {
        selectedFolder.value = null;
      }
    } else {
      await deleteFile(item.id);
      removeItemFromLoadedFolders('file', item.id);
    }
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : `Failed to delete ${item.type}`;
  }
}

let searchDebounce: ReturnType<typeof setTimeout> | undefined;

function clearSearch() {
  clearTimeout(searchDebounce);
  searchQuery.value = '';
  searchResults.value = [];
  searchNextCursor.value = null;
  isSearchMode.value = false;
}

function onSearchInput() {
  clearTimeout(searchDebounce);
  const query = searchQuery.value.trim();
  if (!query) {
    searchResults.value = [];
    searchNextCursor.value = null;
    isSearchMode.value = false;
    return;
  }
  searchDebounce = setTimeout(() => performSearch(query), 300);
}

async function performSearch(query: string) {
  searchLoading.value = true;
  searchResults.value = [];
  searchNextCursor.value = null;
  isSearchMode.value = true;

  try {
    const result = await searchPage(query);
    searchResults.value = result.items;
    searchNextCursor.value = result.nextCursor;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Search failed';
  } finally {
    searchLoading.value = false;
  }
}

async function loadMoreSearchResults() {
  if (!searchNextCursor.value || searchLoading.value) return;

  searchLoading.value = true;
  try {
    const result = await searchPage(
      searchQuery.value.trim(),
      searchNextCursor.value,
    );
    searchResults.value.push(...result.items);
    searchNextCursor.value = result.nextCursor;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Search failed';
  } finally {
    searchLoading.value = false;
  }
}

function buildBreadcrumbs(nodes: FolderNode[], targetId: number): FolderNode[] {
  for (const node of nodes) {
    if (node.id === targetId) return [node];
    const child = buildBreadcrumbs(node.children, targetId);
    if (child.length > 0) return [node, ...child];
  }
  return [];
}

const breadcrumbs = computed((): FolderNode[] => {
  if (!selectedFolder.value) return [];
  const path = buildBreadcrumbs(folders.value, selectedFolder.value.id);
  return path.length > 0 ? path : [selectedFolder.value];
});

async function selectFolderItem(item: FolderItemDTO) {
  if (item.type !== 'folder') return;
  const node =
    selectedFolder.value?.children.find((c) => c.id === item.id) ??
    findFolderNode(folders.value, item.id) ??
    folderDTOToNode({
      id: item.id,
      name: item.name,
      parentId: selectedFolder.value?.id ?? null,
    });
  await selectFolder(node);
}

async function goBack() {
  const prev = breadcrumbs.value.at(-2);
  if (prev) {
    await selectFolder(prev);
  } else {
    selectRoot();
  }
}

async function handleSearchResultSelect(item: SearchItemDTO) {
  const folderId = item.type === 'folder' ? item.id : item.folderId;
  const folderName =
    item.type === 'folder'
      ? item.name
      : (item.path.split('/').filter(Boolean).slice(0, -1).at(-1) ?? 'Folder');
  const folderParentId = item.type === 'folder' ? item.parentId : null;

  clearSearch();

  let node = findFolderNode(folders.value, folderId);
  if (!node) {
    node = folderDTOToNode({
      id: folderId,
      name: folderName,
      parentId: folderParentId,
    });
  }

  await selectFolder(node);
}
</script>

<template>
  <main class="flex h-svh flex-col bg-background text-foreground">
    <header class="shrink-0 border-b px-4 py-2">
      <div class="relative flex items-center">
        <Search
          class="pointer-events-none absolute left-3 size-4 text-muted-foreground"
        />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search files and folders..."
          class="h-9 w-full rounded-md border bg-transparent py-1 pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          @input="onSearchInput"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-3 text-muted-foreground hover:text-foreground"
          @click="clearSearch"
        >
          <X class="size-4" />
        </button>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
      <aside class="flex min-h-0 flex-col border-r bg-muted/30">
        <div class="shrink-0 border-b px-3 py-2">
          <h1 class="text-sm font-semibold">Folders</h1>
        </div>

        <div class="min-h-0 flex-1">
          <p v-if="loading" class="p-2 text-sm text-muted-foreground">
            Loading...
          </p>

          <p v-else-if="error" class="p-2 text-sm text-destructive">
            {{ error }}
          </p>

          <FolderTree
            v-else
            :folders="folders"
            :selected-id="selectedFolder?.id ?? null"
            :has-more="rootNextCursor !== null"
            :is-loading-more="loadingMoreRoots"
            @select="selectFolder"
            @load-more="loadMoreRootFolders"
          />
        </div>
      </aside>

      <section class="min-h-0 min-w-0 p-4">
        <SearchResults
          v-if="isSearchMode"
          :items="searchResults"
          :loading="searchLoading"
          :has-more="searchNextCursor !== null"
          :query="searchQuery.trim()"
          @load-more="loadMoreSearchResults"
          @select-item="handleSearchResultSelect"
        />
        <FolderContents
          v-else
          :folder="selectedFolder"
          :breadcrumbs="breadcrumbs"
          @create-folder="createFolderAction"
          @create-file="createFileAction"
          @select-root="selectRoot"
          @select-folder="selectFolderItem"
          @navigate-to="selectFolder"
          @go-back="goBack"
          @rename-folder="renameSelectedFolderAction"
          @delete-folder="deleteSelectedFolderAction"
          @rename-item="renameItemAction"
          @move-item="moveItemAction"
          @delete-item="deleteItemAction"
        />
      </section>
    </div>
  </main>
</template>
