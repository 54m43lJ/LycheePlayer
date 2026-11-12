<script setup lang="ts">
import ConfirmDialog from './ConfirmDialog.vue'
import { useDownloadAction } from '../composables/download-action'

const { pendingDelete, confirmDownloadDelete, cancelDownloadDelete } = useDownloadAction()
</script>

<template>
  <ConfirmDialog
    :open="pendingDelete !== null"
    title="删除下载"
    :message="`「${pendingDelete?.name ?? ''}」已下载到本机，是否删除下载文件？`"
    confirm-label="删除下载"
    danger
    @confirm="confirmDownloadDelete()"
    @cancel="cancelDownloadDelete()"
  />
</template>
