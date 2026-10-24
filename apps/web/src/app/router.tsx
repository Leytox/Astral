import EllipsisLoader from '@/components/feedback/EllipsisLoader';
import { Loader2 } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router';

const AuthLayout = lazy(() => import('./layouts/AuthLayout'));
const RootLayout = lazy(() => import('./layouts/RootLayout'));
const ForgotPasswordRoute = lazy(() => import('./routes/ForgotPassword'));
const LoginRoute = lazy(() => import('./routes/Login'));
const ResetPasswordRoute = lazy(() => import('./routes/ResetPassword'));
const SearchRoute = lazy(() => import('./routes/Search'));
const SignUpRoute = lazy(() => import('./routes/SignUp'));

const HomeRoute = lazy(() => import('./routes/Home'));

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <HomeRoute />,
      },
      {
        path: '/search',
        element: <SearchRoute />,
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <LoginRoute />,
      },
      {
        path: 'signup',
        element: <SignUpRoute />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordRoute />,
      },
      {
        path: 'reset-password',
        element: <ResetPasswordRoute />,
      },
    ],
  },
]);

export default function AppRouter() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen items-center justify-center flex">
          <EllipsisLoader />
        </div>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  );
}
