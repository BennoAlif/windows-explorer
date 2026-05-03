<script setup lang="ts">
import { computed, ref } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import FolderTreeNode from './FolderTreeNode.vue';
import type { FolderNode } from '@/lib/api';
import { flattenVisibleFolders } from '@/lib/tree';

const props = defineProps<{
  folders: FolderNode[];
  selectedId: number | null;
  hasMore: boolean;
  isLoadingMore: boolean;
}>();

const emit = defineEmits<{
  select: [folder: FolderNode];
  loadMore: [];
}>();

const parentRef = ref<HTMLElement | null>(null);

const rows = computed(() => flattenVisibleFolders(props.folders));

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => 32,
    overscan: 12,
  })),
);

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

function handleScroll(event: Event) {
  const target = event.currentTarget as HTMLElement;
  const distanceFromBottom =
    target.scrollHeight - target.scrollTop - target.clientHeight;

  if (distanceFromBottom < 160 && props.hasMore && !props.isLoadingMore) {
    emit('loadMore');
  }
}
</script>
<template>
  <div ref="parentRef" class="h-full overflow-auto" @scroll="handleScroll">
    <div class="relative w-full" :style="{ height: `${totalSize}px` }">
      <div
        v-for="virtualRow in virtualRows"
        :key="rows[virtualRow.index].folder.id"
        class="absolute left-0 top-0 w-full"
        :style="{
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        }"
      >
        <FolderTreeNode
          :folder="rows[virtualRow.index].folder"
          :selected-id="selectedId"
          :depth="rows[virtualRow.index].depth"
          @select="$emit('select', $event)"
        />
      </div>
    </div>

    <div v-if="isLoadingMore" class="px-3 py-2 text-xs text-muted-foreground">
      Loading more folders...
    </div>
  </div>
</template>
