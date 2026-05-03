<script setup lang="ts">
import { computed, ref } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { File, Folder } from 'lucide-vue-next';
import { loadMoreFolderNodeItems, type FolderNode } from '@/lib/api';

const props = defineProps<{
  folder: FolderNode | null;
}>();

const parentRef = ref<HTMLElement | null>(null);

const items = computed(() => props.folder?.items ?? []);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: items.value.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => 36,
    overscan: 16,
  })),
);

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

async function handleScroll(event: Event) {
  if (!props.folder || !props.folder.nextCursor || props.folder.isLoading) {
    return;
  }

  const target = event.currentTarget as HTMLElement;
  const distanceFromBottom =
    target.scrollHeight - target.scrollTop - target.clientHeight;

  if (distanceFromBottom < 240) {
    await loadMoreFolderNodeItems(props.folder);
  }
}
</script>

<template>
  <div
    v-if="!folder"
    class="flex h-full items-center justify-center text-sm text-muted-foreground"
  >
    Select a folder
  </div>

  <div v-else class="flex h-full flex-col gap-4">
    <header class="shrink-0 border-b pb-3">
      <h1 class="text-lg font-semibold">
        {{ folder.name }}
      </h1>

      <p class="text-sm text-muted-foreground">
        <template v-if="folder.isLoading && !folder.itemsLoaded">
          Loading...
        </template>
        <template v-else>
          {{ folder.items.length }} item{{
            folder.items.length === 1 ? '' : 's'
          }}
        </template>
      </p>
    </header>

    <div
      v-if="folder.isLoading && !folder.itemsLoaded"
      class="py-8 text-center text-sm text-muted-foreground"
    >
      Loading folder contents...
    </div>

    <div
      v-else-if="items.length === 0"
      class="py-8 text-center text-sm text-muted-foreground"
    >
      This folder is empty
    </div>

    <div
      v-else
      ref="parentRef"
      class="min-h-0 flex-1 overflow-auto"
      @scroll="handleScroll"
    >
      <div class="relative w-full" :style="{ height: `${totalSize}px` }">
        <div
          v-for="virtualRow in virtualRows"
          :key="`${items[virtualRow.index].type}-${items[virtualRow.index].id}`"
          class="absolute left-0 top-0 w-full"
          :style="{
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }"
        >
          <div
            class="flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Folder
              v-if="items[virtualRow.index].type === 'folder'"
              class="size-4 shrink-0"
            />
            <File v-else class="size-4 shrink-0" />

            <span class="min-w-0 truncate">
              {{ items[virtualRow.index].name }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="folder.nextCursor || folder.isLoading"
        class="py-3 text-center text-sm text-muted-foreground"
      >
        {{ folder.isLoading ? 'Loading more...' : 'Scroll to load more' }}
      </div>
    </div>
  </div>
</template>
