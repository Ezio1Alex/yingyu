import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/learn',
    name: 'learn',
    component: () => import('../views/NewWordsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/review',
    name: 'review',
    component: () => import('../views/ReviewView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/review/new',
    name: 'review-new',
    component: () => import('../views/NewReviewView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/review/complete',
    name: 'review-complete',
    component: () => import('../views/ReviewComplete.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('../views/StatsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/words',
    name: 'words',
    component: () => import('../views/WordBankView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/parent',
    name: 'parent-login',
    component: () => import('../views/ParentLogin.vue'),
  },
  {
    path: '/parent/dashboard',
    name: 'parent-dashboard',
    component: () => import('../views/ParentDashboard.vue'),
    meta: { requiresPin: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const user = localStorage.getItem('vocab_user')
  if (to.meta.requiresAuth && !user) {
    next('/')
  } else {
    next()
  }
})

export default router
