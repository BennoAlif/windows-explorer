<script setup lang="ts">
import { computed, ref } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { File, Folder } from 'lucide-vue-next';
import type { SearchItemDTO } from 'types';

const props = defineProps<{
  items: SearchItemDTO[];
  loading: boolean;
  hasMore: boolean;
  query: string;
}>();

const emit = defineEmits<{
  loadMore: [];
  selectItem: [item: SearchItemDTO];
}>();

const parentRef = ref<HTMLElement | null>(null);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.items.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => 36,
    overscan: 16,
  })),
);

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

function handleScroll(event: Event) {
  if (!props.hasMore || props.loading) return;

  const target = event.currentTarget as HTMLElement;
  const distanceFromBottom =
    target.scrollHeight - target.scrollTop - target.clientHeight;

  if (distanceFromBottom < 240) {
    emit('loadMore');
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-4">
    <header class="shrink-0 border-b pb-3">
      <h1 class="text-lg font-semibold">
        Results for
        <span class="text-muted-foreground">"{{ query }}"</span>
      </h1>
    </header>

    <div
      v-if="loading && items.length === 0"
      class="py-8 text-center text-sm text-muted-foreground"
    >
      Searching...
    </div>

    <div
      v-else-if="items.length === 0"
      class="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground"
    >
      No results found
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
          <button
            type="button"
            class="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            @click="emit('selectItem', items[virtualRow.index])"
          >
            <Folder
              v-if="items[virtualRow.index].type === 'folder'"
              class="folder-icon size-4 shrink-0"
            />
            <File v-else class="size-4 shrink-0" />

            <span class="min-w-0 flex-1 truncate font-medium">
              {{ items[virtualRow.index].name }}
            </span>

            <span
              class="ml-auto min-w-0 max-w-[50%] truncate text-xs text-muted-foreground"
            >
              {{ items[virtualRow.index].path }}
            </span>
          </button>
        </div>
      </div>

      <div
        v-if="loading"
        class="py-4 text-center text-sm text-muted-foreground"
      >
        Loading more...
      </div>
    </div>
  </div>
</template>
