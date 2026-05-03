<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  buildFolderTree,
  loadFolderNodeItems,
  type FolderNode,
} from '@/lib/api';
import FolderTree from '@/components/FolderTree.vue';
import FolderContents from '@/components/FolderContents.vue';

const folders = ref<FolderNode[]>([]);
const selectedFolder = ref<FolderNode | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    folders.value = await buildFolderTree();
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
</script>

<template>
  <main class="grid h-svh grid-cols-[320px_1fr] bg-background text-foreground">
    <aside class="min-w-0 border-r bg-muted/30">
      <div class="border-b px-3 py-2">
        <h1 class="text-sm font-semibold">Folders</h1>
      </div>

      <div class="h-[calc(100svh-41px)] overflow-auto p-2">
        <p v-if="loading" class="p-2 text-sm text-muted-foreground">
          Loading folders...
        </p>

        <p v-else-if="error" class="p-2 text-sm text-destructive">
          {{ error }}
        </p>

        <FolderTree
          v-else
          :folders="folders"
          :selected-id="selectedFolder?.id ?? null"
          @select="selectFolder"
        />
      </div>
    </aside>

    <section class="min-w-0 overflow-auto p-4">
      <FolderContents :folder="selectedFolder" />
    </section>
  </main>
</template>
