import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './ProtectedRoute';

const LandingPage = lazy(() => import('@/features/auth/LandingPage').then((m) => ({ default: m.LandingPage })));
const AuthPage    = lazy(() => import('@/features/auth/AuthPage').then((m) => ({ default: m.AuthPage })));
const ChatPage    = lazy(() => import('@/features/chat/ChatPage').then((m) => ({ default: m.ChatPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 1000 * 60 * 5 },
  },
});

const Loader: React.FC = () => (
  <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--clr-bg-base)' }}>
    <div style={{ fontSize: '2rem', animation: 'btn-spin 1s linear infinite' }}>⟳</div>
  </div>
);

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/"     element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </QueryClientProvider>
);
