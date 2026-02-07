<script setup>
import { computed, ref } from 'vue';
import { useDataStore } from '@/stores/DataStore';
import { useSettingStore } from '@/stores/SettingStore';
import NaviMenu from '@/components/NaviMenu.vue';
import Footer from '@/components/Footer.vue';

const dataStore = useDataStore();
const settingStore = useSettingStore();

const mainMenu = ref();
const dbFileInput = ref(null);
const showSettingsDialog = ref(false);

const settingsDraft = ref({
  openaiApiKey: '',
  openaiModel: 'gpt-4.1-mini',
  maxResultRows: 200,
  autoRunSqlCells: true,
  omopSystemPrompt: '',
});

const activeConversationId = computed({
  get: () => dataStore.activeConversationId,
  set: (value) => {
    void dataStore.selectConversation(value);
  },
});

const conversationOptions = computed(() =>
  dataStore.sortedConversations.map((item) => ({
    label: item.title || 'Untitled',
    value: item.id,
  })),
);

const mainMenuItems = computed(() => [
  {
    label: 'File',
    icon: 'pi pi-file',
    items: [
      {
        label: 'New Conversation',
        icon: 'pi pi-plus',
        command: () => {
          void dataStore.createNewConversation();
        },
      },
      {
        label: 'Load OMOP SQLite File',
        icon: 'pi pi-upload',
        command: () => {
          dbFileInput.value?.click();
        },
      },
      {
        label: 'Delete Current Conversation',
        icon: 'pi pi-trash',
        command: () => {
          if (dataStore.activeConversationId) {
            void dataStore.deleteConversation(dataStore.activeConversationId);
          }
        },
      },
    ],
  },
  {
    label: 'Help',
    icon: 'pi pi-question-circle',
    items: [
      {
        label: 'DuckDB WASM Docs',
        icon: 'pi pi-external-link',
        command: () => {
          window.open('https://duckdb.org/docs/stable/clients/wasm/overview', '_blank');
        },
      },
      {
        label: 'OpenAI Agents JS',
        icon: 'pi pi-external-link',
        command: () => {
          window.open('https://github.com/openai/openai-agents-js', '_blank');
        },
      },
    ],
  },
]);

function toggleMainMenu(event) {
  mainMenu.value.toggle(event);
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleString();
}

function openSettings() {
  settingsDraft.value = {
    ...settingStore.config,
  };
  showSettingsDialog.value = true;
}

function saveSettings() {
  const maxRows = Number(settingsDraft.value.maxResultRows || 200);
  settingStore.updateConfig({
    ...settingsDraft.value,
    maxResultRows: Number.isFinite(maxRows) ? Math.max(1, Math.floor(maxRows)) : 200,
  });
  showSettingsDialog.value = false;
}

async function onDbFileChanged(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  await dataStore.attachSqliteFile(file);
  event.target.value = '';
}

function submitPrompt() {
  void dataStore.sendPrompt(settingStore);
}

function submitManualSql() {
  void dataStore.submitManualSql(
    dataStore.manualSqlInput,
    Number(settingStore.config.maxResultRows || 200),
  );
}

function runQueuedCell(cell) {
  if (!cell?.sql) return;
  void dataStore.runSqlCell({
    title: cell.title,
    sql: cell.sql,
    maxRows: Number(settingStore.config.maxResultRows || 200),
  });
}
</script>

<template>
  <NaviMenu />

  <div class="menu">
    <div class="menu-group">
      <Button text type="button" size="small" @click="toggleMainMenu" aria-haspopup="true" aria-controls="overlay_menu">
        <font-awesome-icon icon="fa-solid fa-bars" />
      </Button>
      <TieredMenu ref="mainMenu" id="overlay_menu" :model="mainMenuItems" :popup="true" />
    </div>

    <div class="menu-group">
      <Button text class="menu-button" v-tooltip.bottom="'Start a new conversation.'" @click="dataStore.createNewConversation()">
        <font-awesome-icon icon="far fa-comments" class="menu-icon" />
        <span>New Question</span>
      </Button>
    </div>

    <div class="menu-group">
      <Button text class="menu-button" v-tooltip.bottom="'Load local OMOP sqlite database file.'" @click="dbFileInput?.click()">
        <font-awesome-icon icon="fa-solid fa-database" class="menu-icon" />
        <span>Load OMOP DB</span>
      </Button>
    </div>

    <div class="menu-group">
      <Button text class="menu-button" v-tooltip.bottom="'Open settings.'" @click="openSettings">
        <font-awesome-icon icon="fa-solid fa-gear" class="menu-icon" />
        <span>Settings</span>
      </Button>
    </div>

    <div class="menu-group">
      <Tag
        :severity="dataStore.dbReady ? 'success' : 'warn'"
        :value="dataStore.dbReady ? `DB: ${dataStore.dbFileName}` : 'No DB loaded'"
      />
    </div>

    <div class="menu-group w-72">
      <Select
        v-model="activeConversationId"
        :options="conversationOptions"
        optionLabel="label"
        optionValue="value"
        class="w-full"
        size="small"
      />
    </div>
  </div>

  <input
    ref="dbFileInput"
    type="file"
    accept=".db,.sqlite,.sqlite3"
    class="hidden"
    @change="onDbFileChanged"
  />

  <Splitter class="main gap-2" style="border: 0;">
    <SplitterPanel class="h-full" :size="35" :minSize="30">
      <Panel class="h-full w-full">
        <template #header>
          <div class="w-full flex justify-between">
            <div class="text-lg font-bold">
              <font-awesome-icon icon="fa-solid fa-message" />
              Chat
            </div>

            <div>
              <Button
                text
                size="small"
                v-tooltip.bottom="'Refresh list'"
                @click="dataStore.doSomething()"
                :disabled="dataStore.isLoadingConversations"
              >
                <font-awesome-icon
                  icon="fa-solid fa-arrows-rotate"
                  :class="{ 'animate-spin': dataStore.isLoadingConversations }"
                />
              </Button>
            </div>
          </div>
        </template>

        <div class="w-full flex flex-col" :style="{ height: 'calc(100svh - 13.5rem)' }">
          <ScrollPanel class="flex-1">
            <div
              v-for="message in dataStore.activeConversation?.messages || []"
              :key="message.id"
              class="message"
            >
              <div class="text-xs text-slate-500 mb-1">{{ formatDate(message.createdAt) }}</div>
              <div :class="message.role === 'user' ? 'user-message' : 'assistant-message'">
                <div class="font-semibold text-xs uppercase mb-1">{{ message.role }}</div>
                <div class="whitespace-pre-wrap">{{ message.content }}</div>
              </div>
            </div>

            <div v-if="(dataStore.activeConversation?.messages || []).length === 0" class="text-slate-500 text-sm">
              Ask a question about your OMOP dataset.
            </div>
          </ScrollPanel>

          <div class="mt-3 space-y-2">
            <Textarea
              v-model="dataStore.messageInput"
              rows="4"
              autoResize
              placeholder="Ask questions like: How many persons are in this OMOP database?"
              class="w-full"
              @keydown.ctrl.enter.prevent="submitPrompt"
            />
            <div class="flex items-center justify-between">
              <small class="text-slate-500">Ctrl+Enter to send</small>
              <Button
                label="Send"
                icon="pi pi-send"
                :loading="dataStore.isSendingPrompt"
                :disabled="dataStore.isSendingPrompt"
                @click="submitPrompt"
              />
            </div>
          </div>
        </div>
      </Panel>
    </SplitterPanel>

    <SplitterPanel class="h-full" :size="65" :minSize="40">
      <Panel class="h-full w-full">
        <template #header>
          <div class="w-full flex justify-between">
            <div class="text-lg font-bold">
              <font-awesome-icon icon="fa-regular fa-comment-dots" />
              Workbench
            </div>

            <div>
              <Button
                text
                size="small"
                v-tooltip.bottom="'Run manual SQL'"
                @click="submitManualSql"
                :disabled="!dataStore.dbReady || dataStore.isRunningSql"
              >
                <font-awesome-icon icon="fa-solid fa-play" />
                Run
              </Button>
            </div>
          </div>
        </template>

        <div class="w-full flex flex-col" :style="{ height: 'calc(100svh - 13.5rem)' }">
          <div class="mb-2">
            <Textarea
              v-model="dataStore.manualSqlInput"
              rows="3"
              autoResize
              placeholder="Write SQL and run it in DuckDB"
              class="w-full"
            />
          </div>

          <ScrollPanel class="flex-1">
            <Card v-for="cell in dataStore.activeConversation?.cells || []" :key="cell.id" class="mb-3">
              <template #title>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm">{{ cell.title }}</span>
                  <div class="flex items-center gap-2">
                    <Tag
                      :severity="cell.status === 'completed' ? 'success' : (cell.status === 'failed' ? 'danger' : (cell.status === 'queued' ? 'warn' : 'info'))"
                      :value="cell.status"
                    />
                    <Button
                      v-if="cell.status === 'queued'"
                      icon="pi pi-play"
                      size="small"
                      text
                      @click="runQueuedCell(cell)"
                    />
                  </div>
                </div>
              </template>

              <template #content>
                <div class="text-xs text-slate-500 mb-2">{{ formatDate(cell.createdAt) }}</div>
                <pre class="mb-3 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{{ cell.sql }}</pre>

                <Message v-if="cell.status === 'failed'" severity="error" :closable="false">
                  {{ cell.error || 'SQL execution failed.' }}
                </Message>

                <div v-if="cell.status === 'completed'" class="space-y-2">
                  <div class="text-xs text-slate-500">
                    Rows: {{ cell.rowCount }}
                    <span v-if="cell.truncated">(truncated)</span>
                  </div>

                  <DataTable
                    v-if="cell.columns?.length"
                    :value="cell.rows"
                    size="small"
                    scrollable
                    scrollHeight="260px"
                    class="text-xs"
                  >
                    <Column v-for="col in cell.columns" :key="col" :field="col" :header="col" />
                  </DataTable>

                  <div v-else class="text-xs text-slate-500">Statement executed with no tabular output.</div>
                </div>
              </template>
            </Card>

            <div v-if="(dataStore.activeConversation?.cells || []).length === 0" class="text-slate-500 text-sm">
              SQL notebook cells will appear here.
            </div>
          </ScrollPanel>
        </div>
      </Panel>
    </SplitterPanel>
  </Splitter>

  <Footer />

  <Dialog
    v-model:visible="showSettingsDialog"
    modal
    header="Settings"
    :style="{ width: 'min(860px, 96vw)' }"
  >
    <div class="grid gap-4">
      <div class="grid gap-2">
        <label class="text-sm font-medium">OpenAI API Key</label>
        <Password
          v-model="settingsDraft.openaiApiKey"
          toggleMask
          :feedback="false"
          class="w-full"
          inputClass="w-full"
          placeholder="sk-..."
        />
        <small class="text-slate-500">Stored in localStorage on this browser only.</small>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="grid gap-2">
          <label class="text-sm font-medium">Model</label>
          <InputText v-model="settingsDraft.openaiModel" placeholder="gpt-4.1-mini" />
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-medium">Max Result Rows</label>
          <InputNumber v-model="settingsDraft.maxResultRows" :min="1" :max="5000" />
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Checkbox v-model="settingsDraft.autoRunSqlCells" binary inputId="auto-run" />
        <label for="auto-run" class="text-sm">Auto-run SQL cells returned by the agent</label>
      </div>

      <div class="grid gap-2">
        <label class="text-sm font-medium">OMOP Agent System Prompt</label>
        <Textarea v-model="settingsDraft.omopSystemPrompt" rows="12" class="w-full font-mono text-xs" />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="showSettingsDialog = false" />
      <Button label="Save" icon="pi pi-check" @click="saveSettings" />
    </template>
  </Dialog>
</template>
