<script setup lang="ts">
import FolderTreeNode from './FolderTreeNode.vue';
import type { FolderNode } from '@/lib/api';

defineProps<{
  folders: FolderNode[];
  selectedId: number | null;
}>();

defineEmits<{
  select: [folder: FolderNode];
}>();
</script>
<template>
  <div>
    <FolderTreeNode
      v-for="folder in folders"
      :key="folder.id"
      :folder="folder"
      :selected-id="selectedId"
      :depth="0"
      @select="$emit('select', $event)"
    />
  </div>
</template>
