<script setup lang="ts">
import { RiSettingsLine, RiGithubLine, RiSearchLine } from '@remixicon/vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useI18n } from 'vue-i18n';

type Emit = {
  (e: 'show'): void;
}

const emits = defineEmits<Emit>();
const { t } = useI18n();

const handleSearchEngineClick = (event: MouseEvent) => {
  // For Firefox
  if ('external' in window && 'AddSearchProvider' in window.external) {
    event.preventDefault();
    try {
      (window.external as any).AddSearchProvider('/opensearch.xml');
    } catch (error) {
      console.error('Error adding search provider:', error);
      MessagePlugin.error(t('message.searchEngineError'));
    }
  } else if (navigator.userAgent.includes('Chrome')) {
    // For Chrome, show instructions
    event.preventDefault();
    const searchUrl = `${window.location.origin}/search?q=%s`;
    navigator.clipboard.writeText(searchUrl).then(() => {
      MessagePlugin.info({
        content: t('message.chromeInstructions'),
        duration: 15000,
        closeBtn: true,
        placement: 'top-right'
      });
    });
  }
  // For other browsers, let the link handle it naturally
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
        <!-- Use a real link that browsers will recognize -->
        <a
          href="/opensearch.xml"
          rel="search"
          type="application/opensearchdescription+xml"
          title="Search with AI"
          @click="handleSearchEngineClick"
          class="inline-block"
        >
          <t-button shape="circle" theme="default">
            <template #icon> <RiSearchLine /></template>
          </t-button>
        </a>
      </t-tooltip>
    </div>
  </div>
</template>

<style scoped>
a {
  text-decoration: none;
  color: inherit;
}
</style>
