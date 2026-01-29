<script setup>
import { useDataStore } from "../stores/DataStore";
import { onMounted } from "vue";
const store = useDataStore();

onMounted(() => {
});
</script>

<template>
<div class="footer">
<div class="footer-left flex flex-row items-center">

<div>
    <font-awesome-icon icon="fa-solid fa-ear-listen" />
    {{ store.app_config.system.name }} 
    {{ store.version }}
</div>

</div>

<div class="footer-right flex flex-row items-center">
    <template v-if="store.flag_is_starting">
        <div>
            <font-awesome-icon icon="fa-solid fa-spinner" spin />
            Loading...
        </div>
    </template>
    <template v-else>
        <div>
            <font-awesome-icon icon="fa-solid fa-check" />
            Ready
        </div>
    </template>
</div>
</div>


</template>