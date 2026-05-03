<script setup lang="ts">
import { ChevronDown, ChevronRight, Folder } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { loadFolderNodeChildren, type FolderNode } from '@/lib/api';

const props = defineProps<{
  folder: FolderNode;
  selectedId: number | null;
  depth: number;
}>();

defineEmits<{
  select: [folder: FolderNode];
}>();

async function toggleOpen() {
  await loadFolderNodeChildren(props.folder);

  if (!props.folder.children.length) return;

  props.folder.isOpen = !props.folder.isOpen;
}
</script>

<template>
  <div
    class="flex h-8 w-max min-w-full items-center gap-1 rounded-md px-1 pr-3 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
    :class="folder.id === selectedId ? 'bg-accent text-accent-foreground' : ''"
    :style="{ paddingLeft: `${depth * 16 + 4}px` }"
    @click="$emit('select', folder)"
  >
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      class="shrink-0 cursor-pointer"
      :disabled="
        folder.isLoading || (folder.childrenLoaded && !folder.children.length)
      "
      @click.stop="toggleOpen"
    >
      <ChevronDown v-if="folder.children.length && folder.isOpen" />
      <ChevronRight
        v-else-if="!folder.childrenLoaded || folder.children.length"
      />
      <span v-else class="size-4" />
    </Button>

    <Folder class="folder-icon size-4 shrink-0" />

    <span class="whitespace-nowrap">
      {{ folder.name }}
    </span>
  </div>
</template>
