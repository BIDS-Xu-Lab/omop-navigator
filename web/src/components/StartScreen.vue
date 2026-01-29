<script setup>
const props = defineProps({
    messages: Array,
});
</script>


<template>
<div id="start-screen">
    <h1>
        <img src="/logo.svg" alt="Logo" 
            style="height: 1.5em; margin-right: 0.2em;" />
        Guideline Assistant
    </h1>
    <div id="ss-msg">
        <div v-for="(msg, index) in props.messages" 
            class="msg" :key="index">
            {{ msg }}
        </div>
    </div>
</div>
</template>

<style scoped>
#start-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--bg-color);
    color: var(--text-color);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-size: 1.5em;
    z-index: 1000;
}
#start-screen h1 {
    margin-bottom: 0;
    display: flex;
    align-items: center;
    font-weight: bold;
}
#ss-msg {
    font-size: 1em;
}
</style>