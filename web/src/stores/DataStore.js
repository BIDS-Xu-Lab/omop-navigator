/**
 * This file defines the data store for the system UI
 *
 * The data store is a global state for all Vue.js components
 * including:
 *
 * - panels
 * - charts
 */
import { defineStore } from "pinia";
import router from "../router";

export const useDataStore = defineStore("data", {
  state: () => ({
    prj: "",

    // just a reference to the router
    router: router,

    // to other stores
    // will be injected in main.js
    setting_store: null,

    // views
    // - navigation
    // - setting
    current_view: 'navigator',

    // for start screen
    flag_is_starting: false,
    start_screen_messages: [
      'Initializing system ...',
    ],

    // this is from the settings.json
    settings: {},

  }),

  getters: {
  },

  actions: {
    init: function () {
      // // create axios instance
      // this.axios_instance = axios.create({
      //   baseURL: this.setting_store.config.backend.endpoint,
      //   timeout: 30 * 1000,
      //   // headers: {
      //   //   "x-token": this.setting_store.config.backend.token,
      //   // },
      // });

      // console.log("* inited data store");

      // // load datasets
      // this.loadDatasets();
    },

    gotoView: function (view_name) {
      this.current_view = view_name;
    },

    setInited: function () {
      this.flag_is_starting = false;
      this.flag_is_ready = true;
    },

    addStartScreenMessage: function (msg) {
      this.start_screen_message = msg;
    },

    showGuide: function () {
      window.open('https://www.google.com', '_blank');
    },

    doSomething: function () {
      console.log('* do something');
    }
  },
});
