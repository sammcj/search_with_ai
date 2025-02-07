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
  try {
    // Fetch the OpenSearch XML
    const response = await fetch('/opensearch.xml');
    const xmlText = await response.text();

    // Replace the placeholder with actual origin
    const modifiedXml = xmlText.replace(/ORIGIN_PLACEHOLDER/g, window.location.origin);

    // Create a Blob with the modified XML
    const blob = new Blob([modifiedXml], { type: 'application/opensearchdescription+xml' });
    const xmlUrl = URL.createObjectURL(blob);

    // Add the search engine
    if ('external' in window && 'AddSearchProvider' in window.external) {
      // Firefox
      try {
        (window.external as any).AddSearchProvider(xmlUrl);
        MessagePlugin.success(t('message.searchEngineAdded'));
      } catch (error) {
        console.error('Error adding search provider:', error);
        MessagePlugin.error(t('message.searchEngineError'));
      }
    } else if ('chrome' in window) {
      // Chrome - show instructions since Chrome requires manual addition
      const searchUrl = `${window.location.origin}/search?q=%s`;
      MessagePlugin.info({
        content: t('message.chromeInstructions'),
        duration: 10000,
        closeBtn: true,
      });

      // Copy the search URL to clipboard for easier adding
      await navigator.clipboard.writeText(searchUrl);
    } else {
      // Unsupported browser
      MessagePlugin.warning(t('message.browserNotSupported'));
    }

    // Clean up
    URL.revokeObjectURL(xmlUrl);
  } catch (error) {
    console.error('Error setting up search engine:', error);
    MessagePlugin.error(t('message.searchEngineError'));
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
      <t-tooltip :content="t('addToSearchEngine')">
        <t-button shape="circle" theme="default" @click="addToSearchEngine">
          <template #icon> <RiSearchLine /></template>
        </t-button>
      </t-tooltip>
    </div>
  </div>
</template>
