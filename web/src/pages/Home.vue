<script setup>
import { onMounted, ref, computed } from 'vue';
import { useDataStore } from '../stores/DataStore';
import { useSettingStore } from '../stores/SettingStore';
import NaviMenu from '../components/NaviMenu.vue';
import Footer from '../components/Footer.vue';
import markdownit from 'markdown-it';
const md = markdownit()

const store = useDataStore();
const setting_store = useSettingStore();

const is_loading_list = ref(false);
const is_loading_detail = ref(false);

onMounted(() => {
    console.log('* mounted Home page');
});

function formatDate(date_string) {
    const date = new Date(date_string);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

</script>

<template>
<NaviMenu />

<div class="menu">
    <div class="menu-group">
        <div class="menu-group-box">
            <p class="px-2"
                style="width: 20rem; line-height: 1.3rem;">
                Click the chat title to view the conversation. All conversations are saved for future reference.
            </p>
        </div>
        <div class="menu-group-title">
            About
        </div>
    </div>

    <div class="menu-group">
        <div class="menu-group-box">
            <Button text
                class="menu-button"
                v-tooltip.bottom="'Start a new chat.'"
                @click="store.doSomething()">
                <font-awesome-icon icon="far fa-comments" class="menu-icon" />
                <span>
                    New Question
                </span>
            </Button>
        </div>
        <div class="menu-group-title">
            Question
        </div>
    </div>

    <div class="menu-group">
        <div class="menu-group-box">

            <Button text
                class="menu-button"
                v-tooltip.bottom="'Show the detailed user manual in a new window.'"
                @click="data_store.showGuide()">
                <font-awesome-icon icon="fa-solid fa-book" class="menu-icon" />
                <span>
                    How-to Guide
                </span>
            </Button>
        </div>
        <div class="menu-group-title">
            Help
        </div>
    </div>
</div>


<Splitter class="main gap-2" style="border: 0;">
<SplitterPanel class="h-full" :size="35" :minSize="30">
<Panel class="h-full w-full">
<template #header>
    <div class="w-full flex justify-between">
        <div class="flex">
            <div class="flex-col">
                <div class="text-lg font-bold">
                    <font-awesome-icon icon="fa-solid fa-message" />
                    Chat
                    
                </div>
            </div>
        </div>

        <div>
            <Button
                text
                size="small"
                v-tooltip.bottom="'Refresh list'"
                @click="store.doSomething()"
                :disabled="is_loading_list">
                <font-awesome-icon
                    icon="fa-solid fa-arrows-rotate"
                    :class="{ 'animate-spin': is_loading_list }" />
            </Button>
        </div>
    </div>
</template>

<div class="w-full flex flex-col"
    :style="{ height: 'calc(100svh - 17.5rem)' }">

    <div class="flex-1 overflow-y-auto"
      style="width: calc(100% + 1rem);">

      <!-- Loading state -->
      <div v-if="is_loading_list" class="p-4 text-center light:text-gray-500">
        <font-awesome-icon icon="fa-solid fa-spinner" spin />
        Loading workbench ...
      </div>


    </div>
</div>
</Panel>
</SplitterPanel>


<SplitterPanel class="h-full"
  :size="65" :minSize="40">
<Panel class="h-full w-full">
<template #header>
    <div class="w-full flex justify-between">
        <div class="flex">
            <div class="flex-col">
                <div class="text-lg font-bold">
                    <font-awesome-icon icon="fa-regular fa-comment-dots" />
                    Workbench
                </div>
            </div>
        </div>

        <div>
            <Button
                text
                size="small"
                v-tooltip.bottom="'Continue this conversation'"
                @click="store.doSomething()">
                <font-awesome-icon icon="fa-solid fa-arrow-right" />
                Continue
            </Button>
        </div>
    </div>
</template>

<div class="w-full flex flex-col"
    :style="{ height: 'calc(100svh - 17.5rem)' }">

    <div class="flex-1 overflow-y-auto"
      style="width: calc(100% + 1rem);">


    </div>
</div>

</Panel>
</SplitterPanel>
</Splitter>


<Footer />

</template>

<style scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
}

.conversation-item {
  padding: 0.75rem;
  border-bottom: 1px solid var(--bd-color);
  cursor: pointer;
  transition: background-color 0.15s;
  margin-right: 1rem;
}

.conversation-item:hover {
  background-color: var(--bg-color-menu-hover);
}

.conversation-item.selected {
  background-color: var(--bg-hover-color);
  border-left: 3px solid #3b82f6;
}

.conversation-title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-date {
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.message {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--bd-color);
}

.user-message {
  background-color: var(--bg-message-user-color);
  padding: 0.75rem;
  border-radius: 0.5rem;
  margin-right: 1rem;
}

.assistant-message {
  padding: 0.75rem;
  margin-right: 1rem;
}

.tool-calls-section {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--bd-color);
}

.tool-summary {
  padding: 0.25rem 0.5rem;
  background-color: var(--bg-hover-color);
  border-radius: 0.25rem;
  display: inline-block;
  margin-right: 0.5rem;
  margin-bottom: 0.25rem;
}
</style>
