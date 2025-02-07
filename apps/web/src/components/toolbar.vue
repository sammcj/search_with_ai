<script setup lang="ts">
import { RiSettingsLine, RiGithubLine, RiSearchLine } from '@remixicon/vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useI18n } from 'vue-i18n';

type Emit = {
  (e: 'show'): void;
}

const emits = defineEmits<Emit>();
const { t } = useI18n();

const addToSearchEngine = async () => {
  const isFirefox = 'external' in window && 'AddSearchProvider' in window.external;
  const isChrome = navigator.userAgent.includes('Chrome');

  if (isFirefox) {
    try {
      // Firefox: Use the OpenSearch XML
      // The browser will resolve relative URLs in the XML against the current origin
      (window.external as any).AddSearchProvider('/opensearch.xml');
      MessagePlugin.success(t('message.searchEngineAdded'));
    } catch (error) {
      console.error('Error adding search provider:', error);
      MessagePlugin.error(t('message.searchEngineError'));
    }
  } else if (isChrome) {
    try {
      // Chrome: Copy the search URL
      // Use window.location.origin to get the current domain
      const searchUrl = `${window.location.origin}/search?q=%s`;
      await navigator.clipboard.writeText(searchUrl);

      // Show detailed instructions
      MessagePlugin.info({
        content: t('message.chromeInstructions'),
        duration: 15000,
        closeBtn: true,
        placement: 'top-right'
      });
    } catch (error) {
      console.error('Error copying search URL:', error);
      MessagePlugin.error(t('message.copyError'));
    }
  } else {
    // Unsupported browser
    MessagePlugin.warning({
      content: t('message.browserNotSupported'),
      duration: 5000
    });
  }
};
</script>

<script lang="ts">
export default {
  name: 'ToolBar'
};
</script>

<template>
  <div class="fixed bottom-1/3 right-4 z-50 flex flex-col items-center justify-center gap-4">
    <div class="flex w-9 justify-center gap-2 rounded-xl bg-gray-200 p-1 shadow-lg dark:bg-gray-600">
      <t-button href="https://github.com/yokingma/search_with_ai" target="_blank" shape="circle" theme="default">
        <template #icon> <RiGithubLine /></template>
      </t-button>
    </div>
    <div class="flex w-9 justify-center gap-2 rounded-xl bg-gray-200 p-1 shadow-lg dark:bg-gray-600">
      <t-button shape="circle" theme="default" @click="emits('show')">
        <template #icon> <RiSettingsLine /></template>
      </t-button>
    </div>
    <div class="flex w-9 justify-center gap-2 rounded-xl bg-gray-200 p-1 shadow-lg dark:bg-gray-600">
      <t-tooltip :content="t('addToSearchEngine')" placement="left">
        <t-button shape="circle" theme="default" @click="addToSearchEngine">
          <template #icon> <RiSearchLine /></template>
        </t-button>
      </t-tooltip>
    </div>
  </div>
</template>
