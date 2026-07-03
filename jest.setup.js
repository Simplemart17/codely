import '@testing-library/jest-dom';

// Clerk ships ESM (@clerk/backend) that jsdom/Jest doesn't transform, and no
// unit test exercises real auth. Stub the server + client entry points so
// components that transitively import them (e.g. via server actions) load.
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(async () => ({
    userId: 'test-user-id',
    getToken: jest.fn(async () => 'test-token'),
  })),
  currentUser: jest.fn(async () => null),
  clerkMiddleware: (handler) => handler,
  createRouteMatcher: () => () => false,
}));

jest.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }) => children,
  useClerk: () => ({ signOut: jest.fn() }),
  useAuth: () => ({ isSignedIn: true, userId: 'test-user-id' }),
  useUser: () => ({ isSignedIn: true, user: null }),
  useSession: () => ({ session: { getToken: jest.fn(async () => 'test-token') } }),
  SignIn: () => null,
  SignUp: () => null,
}));
