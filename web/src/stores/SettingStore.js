/**
 * This file defines the setting store for the system
 */
import { defineStore } from "pinia";

export const useSettingStore = defineStore("setting", {
    state: () => ({

        // for ui status
        show_setting_panel: false,

        config: {
            keywords: [],
            backend: {
                endpoint: import.meta.env.VITE_BACKEND_ENDPOINT || 'http://localhost:8333',
                token: '',
            },
        }
    }),

    getters: {
    },

    actions: {
        updateSettingsByJSON: function (json) {
            // copy the items from json to store.config
            for (let key in this.config) {
                if (json.hasOwnProperty(key)) {
                    // special rule for ai models
                    if (key == 'ai_models') {
                        // for this case, search all settings from the json
                        for (let model_id in json[key]) {
                            if (this.config[key].hasOwnProperty(model_id)) {
                                for (let model_attribute in json[key][model_id]) {
                                    this.config[key][model_id][model_attribute] = json[key][model_id][model_attribute];
                                }
                            } else {
                                // just copy the whole content if not found
                                // which means the localStorage has custmoized settings
                                this.config[key][model_id] = json[key][model_id];
                            }
                        }
                    } else {
                        this.config[key] = json[key];
                    }
                }
            }
        },

        hasKeywordInSettings: function (keyword) {
            for (let kw of this.config.keywords) {
                if (typeof kw === 'string') {
                    if (kw == keyword) {
                        return true;
                    }
                } else if (kw.token == keyword) {
                    return true;
                }
            }
            return false;
        },

        removeKeywordFromSettings: function (index) {
            this.config.keywords.splice(index, 1);
        },

        saveSettingsToLocalStorage: function () {
            localStorage.setItem(
                "config",
                JSON.stringify(this.config)
            );
            console.log('* saved config to local storage');
        },

        loadSettingsFromLocalStorage: function () {
            // just load the object from localstorage
            let x = localStorage.getItem('config');

            if (x == null) {
                console.log('* not found config from local');
                return;
            }

            // parse
            let cfg = JSON.parse(x);
            console.log('* local storage config:', cfg);

            this.updateSettingsByJSON(cfg);

            console.log('* loaded config from local storage');
        },

        clearSettingsFromLocalStorage: function () {
            localStorage.removeItem('config');

            // reload the page
            window.location.reload();
        },
    },
});
