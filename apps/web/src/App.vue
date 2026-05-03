<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  loadRootFolderPage,
  loadFolderNodeItems,
  type FolderNode,
} from '@/lib/api';
import FolderTree from '@/components/FolderTree.vue';
import FolderContents from '@/components/FolderContents.vue';

const folders = ref<FolderNode[]>([]);
const selectedFolder = ref<FolderNode | null>(null);
const loading = ref(true);
const loadingMoreRoots = ref(false);
const rootNextCursor = ref<string | null>(null);
const error = ref<string | null>(null);

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
    await loadFolderNodeItems(folder);
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
</script>

<template>
  <main class="grid h-svh grid-cols-[320px_1fr] bg-background text-foreground">
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
      <FolderContents :folder="selectedFolder" />
    </section>
  </main>
</template>
