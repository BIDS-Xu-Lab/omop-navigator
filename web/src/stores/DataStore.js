import { defineStore } from 'pinia';
import { deleteConversationById, listConversations, saveConversation } from '@/utils/persistence';
import { duckdbService } from '@/utils/duckdb_service';
import { runOmopAgent } from '@/utils/agent_service';

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createConversation(title = 'New Conversation') {
  const timestamp = nowIso();
  return {
    id: uid(),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
    cells: [],
  };
}

export const useDataStore = defineStore('data', {
  state: () => ({
    // legacy/global UI flags for existing navbar/footer components
    app_config: { system: { name: 'OMOP Navigator' } },
    version: '',
    current_view: 'navigator',
    flag_is_starting: false,

    initialized: false,
    isLoadingConversations: false,
    isSendingPrompt: false,
    isRunningSql: false,

    dbReady: false,
    dbFileName: '',
    dbError: '',

    conversations: [],
    activeConversationId: '',

    messageInput: '',
    manualSqlInput: '',
  }),

  getters: {
    activeConversation(state) {
      return state.conversations.find((c) => c.id === state.activeConversationId) || null;
    },

    sortedConversations(state) {
      return [...state.conversations].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    },
  },

  actions: {
    gotoView(viewName) {
      this.current_view = viewName;
    },

    showGuide() {
      window.open('https://duckdb.org/docs/stable/clients/wasm/overview', '_blank');
    },

    doSomething() {
      // backward compatible no-op used by old buttons
    },

    async init() {
      if (this.initialized) return;

      this.isLoadingConversations = true;
      try {
        const saved = await listConversations();
        this.conversations = saved;

        if (this.conversations.length === 0) {
          await this.createNewConversation();
        } else {
          this.activeConversationId = this.conversations[0].id;
        }

        await duckdbService.init();
      } catch (error) {
        console.error('Initialization failed:', error);
      } finally {
        this.isLoadingConversations = false;
        this.initialized = true;
      }
    },

    async createNewConversation() {
      const conversation = createConversation();
      this.conversations.unshift(conversation);
      this.activeConversationId = conversation.id;
      await saveConversation(conversation);
      return conversation;
    },

    async selectConversation(conversationId) {
      this.activeConversationId = conversationId;
    },

    async renameConversation(conversationId, title) {
      const conversation = this.conversations.find((c) => c.id === conversationId);
      if (!conversation) return;

      conversation.title = title?.trim() || conversation.title;
      conversation.updatedAt = nowIso();
      await saveConversation(conversation);
    },

    async deleteConversation(conversationId) {
      const idx = this.conversations.findIndex((c) => c.id === conversationId);
      if (idx < 0) return;

      this.conversations.splice(idx, 1);
      await deleteConversationById(conversationId);

      if (this.activeConversationId === conversationId) {
        if (this.conversations.length === 0) {
          const newConversation = await this.createNewConversation();
          this.activeConversationId = newConversation.id;
        } else {
          this.activeConversationId = this.conversations[0].id;
        }
      }
    },

    async persistActiveConversation() {
      const conversation = this.activeConversation;
      if (!conversation) return;
      await saveConversation(conversation);
    },

    async attachSqliteFile(file) {
      if (!file) return;

      this.dbError = '';
      try {
        await duckdbService.attachOmopSqlite(file);
        this.dbReady = true;
        this.dbFileName = file.name;

        const contextCell = {
          id: uid(),
          title: `Attached SQLite DB: ${file.name}`,
          sql: "SHOW TABLES FROM omop;",
          createdAt: nowIso(),
          status: 'completed',
          columns: [],
          rows: [],
          rowCount: 0,
          truncated: false,
          error: '',
        };

        try {
          const tableResult = await duckdbService.listOmopTables(200);
          contextCell.columns = tableResult.columns;
          contextCell.rows = tableResult.rows;
          contextCell.rowCount = tableResult.rowCount;
          contextCell.truncated = tableResult.truncated;
        } catch (error) {
          contextCell.status = 'failed';
          contextCell.error = String(error?.message || error);
        }

        if (this.activeConversation) {
          this.activeConversation.cells.unshift(contextCell);
          this.activeConversation.updatedAt = nowIso();
          await this.persistActiveConversation();
        }
      } catch (error) {
        this.dbReady = false;
        this.dbFileName = '';
        this.dbError = String(error?.message || error);
      }
    },

    async attachParquetFiles(files) {
      const selected = Array.from(files || []).filter(Boolean);
      if (selected.length === 0) return;

      this.dbError = '';
      try {
        const mappings = await duckdbService.attachParquetFiles(selected);
        this.dbReady = true;
        this.dbFileName = `${selected.length} parquet files`;

        const contextCell = {
          id: uid(),
          title: `Loaded Parquet Files (${selected.length})`,
          sql: "SHOW TABLES FROM omop;",
          createdAt: nowIso(),
          status: 'completed',
          columns: [],
          rows: [],
          rowCount: 0,
          truncated: false,
          error: '',
        };

        try {
          const tableResult = await duckdbService.listOmopTables(500);
          contextCell.columns = tableResult.columns;
          contextCell.rows = tableResult.rows;
          contextCell.rowCount = tableResult.rowCount;
          contextCell.truncated = tableResult.truncated;
        } catch (error) {
          contextCell.status = 'failed';
          contextCell.error = String(error?.message || error);
        }

        if (this.activeConversation) {
          this.activeConversation.cells.unshift(contextCell);
          this.activeConversation.updatedAt = nowIso();
          await this.persistActiveConversation();
        }

        if (mappings.length > 0 && this.activeConversation) {
          this.activeConversation.messages.push({
            id: uid(),
            role: 'assistant',
            content: `Loaded ${mappings.length} parquet files into schema omop. Example table: ${mappings[0].tableName}`,
            createdAt: nowIso(),
          });
          this.activeConversation.updatedAt = nowIso();
          await this.persistActiveConversation();
        }
      } catch (error) {
        this.dbReady = false;
        this.dbFileName = '';
        this.dbError = String(error?.message || error);
      }
    },

    async runSqlCell({ title, sql, maxRows = 200 }) {
      const conversation = this.activeConversation;
      if (!conversation) return null;

      const cell = {
        id: uid(),
        title: title?.trim() || 'SQL Cell',
        sql,
        createdAt: nowIso(),
        status: 'running',
        columns: [],
        rows: [],
        rowCount: 0,
        truncated: false,
        error: '',
      };

      conversation.cells.unshift(cell);
      conversation.updatedAt = nowIso();
      await this.persistActiveConversation();

      this.isRunningSql = true;
      try {
        const sqlResult = await duckdbService.runSql(sql, maxRows);
        cell.status = 'completed';
        cell.columns = sqlResult.columns;
        cell.rows = sqlResult.rows;
        cell.rowCount = sqlResult.rowCount;
        cell.truncated = sqlResult.truncated;
      } catch (error) {
        cell.status = 'failed';
        cell.error = String(error?.message || error);
      } finally {
        this.isRunningSql = false;
        conversation.updatedAt = nowIso();
        await this.persistActiveConversation();
      }

      return cell;
    },

    async submitManualSql(sqlText, maxRows = 200) {
      const sql = String(sqlText || '').trim();
      if (!sql) return;
      await this.runSqlCell({ title: 'Manual SQL', sql, maxRows });
      this.manualSqlInput = '';
    },

    async sendPrompt(settingStore) {
      const conversation = this.activeConversation;
      if (!conversation) return;

      const userMessage = String(this.messageInput || '').trim();
      if (!userMessage) return;

      conversation.messages.push({
        id: uid(),
        role: 'user',
        content: userMessage,
        createdAt: nowIso(),
      });

      if (conversation.title === 'New Conversation') {
        conversation.title = userMessage.slice(0, 60);
      }

      this.messageInput = '';
      conversation.updatedAt = nowIso();
      await this.persistActiveConversation();

      this.isSendingPrompt = true;
      try {
        const omopContext = this.dbReady
          ? `Attached database alias: omop\nAttached file: ${this.dbFileName}`
          : 'No database attached yet.';

        const agentResult = await runOmopAgent({
          apiKey: settingStore.config.openaiApiKey,
          model: settingStore.config.openaiModel,
          systemPrompt: settingStore.config.omopSystemPrompt,
          userPrompt: userMessage,
          omopContext,
        });

        conversation.messages.push({
          id: uid(),
          role: 'assistant',
          content: agentResult.assistantResponse,
          createdAt: nowIso(),
        });

        if (settingStore.config.autoRunSqlCells) {
          for (const cell of agentResult.sqlCells) {
            await this.runSqlCell({
              ...cell,
              maxRows: Number(settingStore.config.maxResultRows || 200),
            });
          }
        } else {
          for (const cell of agentResult.sqlCells) {
            conversation.cells.unshift({
              id: uid(),
              title: cell.title,
              sql: cell.sql,
              createdAt: nowIso(),
              status: 'queued',
              columns: [],
              rows: [],
              rowCount: 0,
              truncated: false,
              error: '',
            });
          }
        }
      } catch (error) {
        conversation.messages.push({
          id: uid(),
          role: 'assistant',
          content: `Agent error: ${String(error?.message || error)}`,
          createdAt: nowIso(),
        });
      } finally {
        conversation.updatedAt = nowIso();
        await this.persistActiveConversation();
        this.isSendingPrompt = false;
      }
    },
  },
});
