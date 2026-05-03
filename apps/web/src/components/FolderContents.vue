<script setup lang="ts">
import { File, Folder } from 'lucide-vue-next';
import type { FolderNode } from '@/lib/api';

defineProps<{
  folder: FolderNode | null;
}>();
</script>

<template>
  <div
    v-if="!folder"
    class="flex h-full items-center justify-center text-sm text-muted-foreground"
  >
    Select a folder
  </div>

  <div v-else class="flex flex-col gap-4">
    <header class="border-b pb-3">
      <h1 class="text-lg font-semibold">
        {{ folder.name }}
      </h1>
      <p class="text-sm text-muted-foreground">
        <template v-if="folder.isLoading">Loading...</template>
        <template v-else>
          {{ folder.items.length }} item{{ folder.items.length === 1 ? '' : 's' }}
        </template>
      </p>
    </header>

    <div v-if="folder.isLoading" class="py-8 text-center text-sm text-muted-foreground">
      Loading folder contents...
    </div>

    <div v-else class="grid gap-1">
      <div
        v-for="item in folder.items"
        :key="`${item.type}-${item.id}`"
        class="flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent hover:text-accent-foreground"
      >
        <Folder v-if="item.type === 'folder'" class="size-4 shrink-0" />
        <File v-else class="size-4 shrink-0" />

        <span class="min-w-0 truncate">
          {{ item.name }}
        </span>
      </div>

      <div
        v-if="folder.items.length === 0"
        class="py-8 text-center text-sm text-muted-foreground"
      >
        This folder is empty
      </div>
    </div>
  </div>
</template>
