<script setup>
import { useDataStore } from "../stores/DataStore";
import { onMounted, ref } from "vue";
const store = useDataStore();

onMounted(() => {
    console.log('* mounted NaviMenu');
});
</script>

<template>
<div id="navi">
    <div class="navi-left prevent-select">
        <!-- <div class="navi-item home"
            @click="store.gotoView('home')">
            <font-awesome-icon :icon="['fa', 'home']" />
            Home
        </div> -->

        <div class="navi-item ml-1" 
            v-tooltip.bottom="'Use the navigator to explore the OMOP CDM data.'"
            @click="store.gotoView('navigator')" 
            :class="{ 'active-page': store.current_view == 'navigator' }">
            <font-awesome-icon :icon="['far', 'comments']" />
            Navigator
        </div>
        
        <div class="navi-item" 
            v-tooltip.bottom="'Change local settings and preferences.'"
            @click="store.gotoView('setting')" 
            :class="{ 'active-page': store.current_view == 'setting' }">
            <font-awesome-icon :icon="['fas', 'gear']" />
            Settings
        </div>

        <!-- <div class="navi-item" 
            v-tooltip.bottom="'View the visual exploration results.'"
            @click="store.gotoView('vis')" 
            :class="{ 'active-page': store.current_view == 'vis' }">
            <font-awesome-icon :icon="['fas', 'chart-column']" />
            Visual Exploration
        </div> -->
    </div>

    <div class="navi-right">
        <div v-if="true"
            class="navi-link">
            {{ store.app_config.system.name }} {{ store.version }}
            |
            <a href="https://github.com/BIDS-Xu-Lab/omop-navigator" 
                v-tooltip.bottom="'View source code on GitHub.'"
                target="_blank">
                <font-awesome-icon icon="fa-brands fa-github" />
            </a>
        </div>
        
    </div>
</div>
</template>

<style scoped>

#navi {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
    height: 2.5rem;
    position: absolute;
    top: 0;

    z-index: 10;
}

.navi-left {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
}

.navi-right {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    padding: 0 0.5rem 0 0;
}

.navi-link {
    margin-right: 0.5rem;
    padding: 0.5rem;
    border: 1px solid transparent;
    border-bottom: 0;
    text-align: center;
    cursor: pointer;
}

.navi-item {
    margin-right: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    border-bottom: 0;
    text-align: center;
    cursor: pointer;
}

.navi-item:hover {
    background-color: var(--bg-color-menu-hover);
}

.navi-item.active-page {
    font-weight: bold;
    border: 1px solid var(--bd-color);
    border-bottom: 0;
    background-color: var(--bg-color-menu);

    /* offset for merging to the menu */
    position: relative;
    bottom: -1px;
}
.home {
    color: white;
    background: #09457a;
}
.home:hover {
    background: #072c5c;
}
</style>