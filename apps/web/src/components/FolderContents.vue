<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import {
  ArrowLeft,
  File,
  FilePlus,
  Folder,
  FolderPlus,
  LayoutGrid,
  LayoutList,
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
  deleteItem: [item: FolderItemDTO];
}>();

const parentRef = ref<HTMLElement | null>(null);
const viewMode = ref<'list' | 'grid'>('list');

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

watchEffect(async () => {
  const folder = props.folder;
  // Track reactive dependencies: re-run when items change or view mode changes
  void items.value.length;
  void viewMode.value;

  if (!folder?.nextCursor || folder.isLoading) return;

  await nextTick();

  const el = parentRef.value;
  if (!el) return;

  if (el.scrollHeight <= el.clientHeight) {
    await loadMoreFolderNodeItems(folder);
  }
});
</script>

<template>
  <div class="flex h-full flex-col gap-4">
    <header class="shrink-0 border-b pb-3">
      <div
        class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        <div class="flex min-w-0 items-center gap-2 overflow-hidden">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            :disabled="!folder"
            @click="$emit('goBack')"
          >
            <ArrowLeft />
          </Button>

          <Breadcrumb class="min-w-0 overflow-x-auto overflow-y-hidden">
            <BreadcrumbList class="w-max flex-nowrap">
              <BreadcrumbItem class="shrink-0">
                <BreadcrumbLink
                  as="button"
                  class="cursor-pointer text-sm"
                  @click="$emit('selectRoot')"
                >
                  Explorer
                </BreadcrumbLink>
              </BreadcrumbItem>

              <template v-for="(crumb, i) in breadcrumbs" :key="crumb.id">
                <BreadcrumbSeparator class="shrink-0" />
                <BreadcrumbItem class="shrink-0">
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

        <div class="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" size="sm" @click="$emit('createFolder')">
            <FolderPlus data-icon="inline-start" class="folder-icon" />
            <span class="hidden sm:inline">New Folder</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="!folder"
            @click="$emit('createFile')"
          >
            <FilePlus data-icon="inline-start" />
            <span class="hidden sm:inline">New File</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="!folder"
            @click="$emit('renameFolder')"
          >
            <Pencil data-icon="inline-start" />
            <span class="hidden sm:inline">Rename</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            :disabled="!folder"
            @click="$emit('deleteFolder')"
          >
            <Trash2 data-icon="inline-start" />
            <span class="hidden sm:inline">Delete</span>
          </Button>

          <div class="ml-1 flex items-center rounded-md border">
            <Button
              type="button"
              size="icon-sm"
              :variant="viewMode === 'list' ? 'secondary' : 'ghost'"
              title="List view"
              class="rounded-r-none border-r"
              @click="viewMode = 'list'"
            >
              <LayoutList class="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              :variant="viewMode === 'grid' ? 'secondary' : 'ghost'"
              title="Grid view"
              class="rounded-l-none"
              @click="viewMode = 'grid'"
            >
              <LayoutGrid class="size-4" />
            </Button>
          </div>
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
      <template v-if="viewMode === 'list'">
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
                class="folder-icon size-4 shrink-0"
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
                  title="Delete"
                  @click.stop="$emit('deleteItem', items[virtualRow.index])"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div
          class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1 p-1"
        >
          <div
            v-for="item in items"
            :key="`${item.type}-${item.id}`"
            class="group relative flex flex-col items-center gap-1 rounded-lg p-3 text-sm"
            :class="
              item.type === 'folder'
                ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
                : 'hover:bg-accent/50'
            "
            @click="item.type === 'folder' && $emit('selectFolder', item)"
          >
            <Folder
              v-if="item.type === 'folder'"
              class="folder-icon size-10 shrink-0"
            />
            <File v-else class="size-10 shrink-0" />

            <span class="w-full truncate text-center text-xs">
              {{ item.name }}
            </span>

            <div
              class="absolute right-1 top-1 hidden gap-0.5 rounded-md bg-background/80 p-0.5 backdrop-blur-sm group-hover:flex"
            >
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                title="Rename"
                @click.stop="$emit('renameItem', item)"
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                title="Delete"
                @click.stop="$emit('deleteItem', item)"
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>
      </template>

      <div
        v-if="folder.nextCursor || folder.isLoading"
        class="py-3 text-center text-sm text-muted-foreground"
      >
        {{ folder.isLoading ? 'Loading more...' : 'Scroll to load more' }}
      </div>
    </div>
  </div>
</template>
