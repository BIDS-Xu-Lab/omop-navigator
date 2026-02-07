import { defineStore } from 'pinia';

const SETTINGS_KEY = 'omop_navigator_settings_v1';

const DEFAULT_OMOP_SYSTEM_PROMPT = `You are an OMOP CDM analytics assistant running SQL in DuckDB against an attached SQLite OMOP database.

Rules:
1. Produce SQL that works in DuckDB.
2. OMOP schema is attached as database alias: omop.
3. Prefer explicit columns over SELECT *.
4. Keep queries safe and read-only.
5. Use LIMIT for exploratory queries.
6. When uncertain about table/column names, first query DuckDB metadata.

You must respond with JSON only:
{
  "assistant_response": "short plain-language answer",
  "sql_cells": [
    {
      "title": "short title",
      "sql": "SQL statement"
    }
  ]
}`;

export const useSettingStore = defineStore('setting', {
  state: () => ({
    show_setting_panel: false,
    config: {
      openaiApiKey: '',
      openaiModel: 'gpt-4.1-mini',
      maxResultRows: 200,
      autoRunSqlCells: true,
      omopSystemPrompt: DEFAULT_OMOP_SYSTEM_PROMPT,
    },
  }),

  actions: {
    loadSettingsFromLocalStorage() {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.config = {
            ...this.config,
            ...parsed,
          };
        }
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    },

    saveSettingsToLocalStorage() {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.config));
    },

    clearSettingsFromLocalStorage() {
      localStorage.removeItem(SETTINGS_KEY);
      this.config = {
        openaiApiKey: '',
        openaiModel: 'gpt-4.1-mini',
        maxResultRows: 200,
        autoRunSqlCells: true,
        omopSystemPrompt: DEFAULT_OMOP_SYSTEM_PROMPT,
      };
    },

    updateConfig(patch) {
      this.config = {
        ...this.config,
        ...patch,
      };
      this.saveSettingsToLocalStorage();
    },
  },
});
