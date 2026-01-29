import { createRouter, createWebHistory } from 'vue-router';
import Home from './pages/Home.vue';

const routes = [
    {
        path: '/',
        name: 'home',
        component: Home,
        meta: { requiresAuth: false }
    },
];

const router = createRouter({
    history: createWebHistory(
        import.meta.env.BASE_URL
    ),
    routes
});

// Navigation guard for authentication
router.beforeEach(async (to, from, next) => {
    next();
});

export default router;
