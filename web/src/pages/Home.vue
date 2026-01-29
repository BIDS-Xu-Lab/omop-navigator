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

/* Main Menu */
const main_menu = ref();
const main_menu_items = ref([
    {
        label: 'File',
        icon: 'pi pi-file',
        items: [
            {
                label: 'New',
                icon: 'pi pi-plus',
                items: [
                    {
                        label: 'Document',
                        icon: 'pi pi-file'
                    },
                    {
                        label: 'Image',
                        icon: 'pi pi-image'
                    },
                    {
                        label: 'Video',
                        icon: 'pi pi-video'
                    }
                ]
            },
            {
                label: 'Open',
                icon: 'pi pi-folder-open'
            },
            {
                label: 'Print',
                icon: 'pi pi-print'
            }
        ]
    },
    {
        label: 'Edit',
        icon: 'pi pi-file-edit',
        items: [
            {
                label: 'Copy',
                icon: 'pi pi-copy'
            },
            {
                label: 'Delete',
                icon: 'pi pi-times'
            }
        ]
    },
    {
        label: 'Search',
        icon: 'pi pi-search'
    },
    {
        separator: true
    },
    {
        label: 'Share',
        icon: 'pi pi-share-alt',
        items: [
            {
                label: 'Slack',
                icon: 'pi pi-slack'
            },
            {
                label: 'Whatsapp',
                icon: 'pi pi-whatsapp'
            }
        ]
    }
]);

const toggleMainMenu = (event) => {
    main_menu.value.toggle(event);
};
</script>

<template>
<NaviMenu />

<div class="menu">
  <div class="menu-group">
    <Button text
      type="button" 
      size="small"
      @click="toggleMainMenu" 
      aria-haspopup="true" 
      aria-controls="overlay_menu">
      <font-awesome-icon icon="fa-solid fa-bars" />
    </Button>
    <TieredMenu ref="main_menu" id="overlay_menu" 
      :model="main_menu_items" :popup="true" />
  </div>

  <div class="menu-group">
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

  <div class="menu-group">
    <Button text
        class="menu-button"
        v-tooltip.bottom="'Show the detailed user manual in a new window.'"
        @click="data_store.showGuide()">
        <font-awesome-icon icon="fa-solid fa-book" class="menu-icon" />
    </Button>
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
    :style="{ height: 'calc(100svh - 13.5rem)' }">

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
    :style="{ height: 'calc(100svh - 13.5rem)' }">

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
