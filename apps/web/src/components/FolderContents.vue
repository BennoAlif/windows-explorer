<script setup lang="ts">
import { computed, ref } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import {
  ArrowLeft,
  File,
  FilePlus,
  Folder,
  FolderPlus,
  MoveRight,
  Pencil,
  Trash2,
} from 'lucide-vue-next';
import type { FolderItemDTO } from 'types';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { loadMoreFolderNodeItems, type FolderNode } from '@/lib/api';

const props = defineProps<{
  folder: FolderNode | null;
  breadcrumbs: FolderNode[];
}>();

defineEmits<{
  createFolder: [];
  createFile: [];
  selectRoot: [];
  goBack: [];
  selectFolder: [item: FolderItemDTO];
  navigateTo: [node: FolderNode];
  renameFolder: [];
  deleteFolder: [];
  renameItem: [item: FolderItemDTO];
  moveItem: [item: FolderItemDTO];
  deleteItem: [item: FolderItemDTO];
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
  <div class="flex h-full flex-col gap-4">
    <header class="shrink-0 border-b pb-3">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            :disabled="!folder"
            @click="$emit('goBack')"
          >
            <ArrowLeft />
          </Button>

          <Breadcrumb class="min-w-0">
            <BreadcrumbList class="flex-nowrap">
              <BreadcrumbItem>
                <BreadcrumbLink
                  as="button"
                  class="cursor-pointer text-sm"
                  @click="$emit('selectRoot')"
                >
                  Explorer
                </BreadcrumbLink>
              </BreadcrumbItem>

              <template v-for="(crumb, i) in breadcrumbs" :key="crumb.id">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage
                    v-if="i === breadcrumbs.length - 1"
                    class="max-w-45 truncate text-sm"
                  >
                    {{ crumb.name }}
                  </BreadcrumbPage>
                  <BreadcrumbLink
                    v-else
                    as="button"
                    class="max-w-30 cursor-pointer truncate text-sm"
                    @click="$emit('navigateTo', crumb)"
                  >
                    {{ crumb.name }}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </template>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div class="flex shrink-0 flex-wrap justify-end gap-2">
          <Button type="button" size="sm" @click="$emit('createFolder')">
            <FolderPlus data-icon="inline-start" />
            New Folder
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="!folder"
            @click="$emit('createFile')"
          >
            <FilePlus data-icon="inline-start" />
            New File
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="!folder"
            @click="$emit('renameFolder')"
          >
            <Pencil data-icon="inline-start" />
            Rename
          </Button>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            :disabled="!folder"
            @click="$emit('deleteFolder')"
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>
    </header>

    <div
      v-if="!folder"
      class="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground"
    >
      Select a folder
    </div>

    <div
      v-else-if="folder.isLoading && !folder.itemsLoaded"
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
            class="flex h-9 items-center gap-2 rounded-md px-2 text-sm"
            :class="
              items[virtualRow.index].type === 'folder'
                ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
                : 'hover:bg-accent/50'
            "
            @click="
              items[virtualRow.index].type === 'folder' &&
              $emit('selectFolder', items[virtualRow.index])
            "
          >
            <Folder
              v-if="items[virtualRow.index].type === 'folder'"
              class="size-4 shrink-0"
            />
            <File v-else class="size-4 shrink-0" />

            <span class="min-w-0 truncate">
              {{ items[virtualRow.index].name }}
            </span>

            <div class="ml-auto flex shrink-0 gap-1">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                title="Rename"
                @click.stop="$emit('renameItem', items[virtualRow.index])"
              >
                <Pencil />
              </Button>

              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                title="Move"
                @click.stop="$emit('moveItem', items[virtualRow.index])"
              >
                <MoveRight />
              </Button>

              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                title="Delete"
                @click.stop="$emit('deleteItem', items[virtualRow.index])"
              >
                <Trash2 />
              </Button>
            </div>
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
